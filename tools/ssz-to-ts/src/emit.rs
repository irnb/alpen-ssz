use std::{
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    fs,
    path::Path,
};

use anyhow::{Context, Result, anyhow};
use sizzle_parser::{
    AliasDef, ClassDef, ClassFieldDef, SszSchema,
    tysys::{ConstValue, Ty, TyExpr},
};

/// Topologically sort classes within a module so each class's dependencies
/// appear before it. Classes that reference each other within the same file
/// are sorted into a usable order; cycles fall back to declaration order.
fn topo_sort_classes(classes: &[ClassDef]) -> Vec<usize> {
    let names: HashMap<&str, usize> = classes
        .iter()
        .enumerate()
        .map(|(i, c)| (c.name().0.as_str(), i))
        .collect();

    fn deps_of(c: &ClassDef, names: &HashMap<&str, usize>) -> Vec<usize> {
        let mut out = Vec::new();
        // Parent type — handles the "MyContainer(SomeStable)" case.
        for ident in c.parent_ty().iter_idents() {
            if let Some(&i) = names.get(ident.0.as_str()) {
                out.push(i);
            }
        }
        // Field types.
        for f in c.fields() {
            if let Some(ty) = f.ty() {
                for ident in ty.iter_idents() {
                    if let Some(&i) = names.get(ident.0.as_str()) {
                        out.push(i);
                    }
                }
            }
        }
        out
    }

    let mut order = Vec::with_capacity(classes.len());
    let mut visiting = vec![false; classes.len()];
    let mut visited = vec![false; classes.len()];

    fn visit(
        i: usize,
        classes: &[ClassDef],
        names: &HashMap<&str, usize>,
        visiting: &mut [bool],
        visited: &mut [bool],
        order: &mut Vec<usize>,
    ) {
        if visited[i] {
            return;
        }
        if visiting[i] {
            // Cycle — bail and emit in declaration order from here.
            return;
        }
        visiting[i] = true;
        for d in deps_of(&classes[i], names) {
            if d != i {
                visit(d, classes, names, visiting, visited, order);
            }
        }
        visiting[i] = false;
        visited[i] = true;
        order.push(i);
    }

    for i in 0..classes.len() {
        visit(
            i,
            classes,
            &names,
            &mut visiting,
            &mut visited,
            &mut order,
        );
    }

    order
}

use crate::{
    config::Config,
    external_stubs::{self, Stub, StubKind},
    walker::{Parsed, ScannedFile},
};

/// Build a lookup table mapping (module_path, const_name) -> evaluated value.
/// Used to resolve imported constants referenced as List/Vector size args.
fn build_const_table(parsed: &Parsed) -> HashMap<(std::path::PathBuf, String), u64> {
    let mut out = HashMap::new();
    for (path, schema) in &parsed.schemas {
        for c in schema.constants() {
            out.insert((path.clone(), c.name().0.clone()), c.value().eval());
        }
    }
    out
}

/// Stub for a function the resolution loop calls to record an inline-fallback
/// reference (so the primitive external module gets emitted too). Currently
/// inlining the expr means we don't need to chain any imports for the primitive
/// type, so this is a no-op.
fn referenced_externals_pending(_prim: &str, _name: &str) {}

/// Top-level entry: write the full src/generated tree.
pub fn emit(out_dir: &Path, parsed: &Parsed, _config: &Config) -> Result<()> {
    fs::create_dir_all(out_dir)?;
    fs::create_dir_all(out_dir.join("modules"))?;
    fs::create_dir_all(out_dir.join("external"))?;

    // virt_path -> ScannedFile lookup
    let by_virt: HashMap<&Path, &ScannedFile> = parsed
        .files
        .iter()
        .map(|f| (f.virt_path.as_path(), f))
        .collect();

    let stub_registry = external_stubs::registry();
    let const_table = build_const_table(parsed);

    // Build (virtual_module_name, class_or_alias_name) -> ts_name (module file
    // stem in src/generated/modules/). Used for cross-crate re-export lookup.
    let mut type_index: HashMap<(String, String), String> = HashMap::new();
    for f in &parsed.files {
        if let Some(schema) = parsed.schemas.get(&f.virt_path) {
            let ts_name = format!("{}-{}", f.module_name, f.stem);
            for c in schema.classes() {
                type_index.insert(
                    (f.module_name.clone(), c.name().0.clone()),
                    ts_name.clone(),
                );
            }
            for a in schema.aliases() {
                type_index.insert(
                    (f.module_name.clone(), a.name().0.clone()),
                    ts_name.clone(),
                );
            }
            for c in schema.constants() {
                type_index.insert(
                    (f.module_name.clone(), c.name().0.clone()),
                    ts_name.clone(),
                );
            }
        }
    }

    // Track which external types were referenced — we error if a referenced
    // type isn't resolvable.
    let mut referenced_externals: HashMap<String, BTreeSet<String>> = HashMap::new();

    // Group files by module_name for the ts module name -> per-file mapping.
    let mut module_ts_names: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    // Map (virt module_name, virt stem) -> ts module name (e.g. "ol-chain-types-block").
    let mut ts_name_for: HashMap<(String, String), String> = HashMap::new();
    // Map full virt_path -> ts module name. Used by ty_to_ts when a Ty::Imported
    // refers to one of our scanned files (cross-crate or sibling-file import).
    let mut virt_path_to_ts_name: HashMap<std::path::PathBuf, String> = HashMap::new();
    for f in &parsed.files {
        let ts_name = format!("{}-{}", f.module_name, f.stem);
        ts_name_for.insert((f.module_name.clone(), f.stem.clone()), ts_name.clone());
        virt_path_to_ts_name.insert(f.virt_path.clone(), ts_name.clone());
        // Also accept the path without the .ssz extension since Ty::Imported.path
        // sometimes drops it during topo-sort normalization.
        let stem_path = f.virt_path.with_extension("");
        virt_path_to_ts_name.insert(stem_path, ts_name.clone());
        module_ts_names
            .entry(f.module_name.clone())
            .or_default()
            .insert(ts_name);
    }

    // Emit one .ts file per scanned .ssz file, in topo order.
    for virt_path in &parsed.parsing_order {
        let file = by_virt
            .get(virt_path.as_path())
            .ok_or_else(|| anyhow!("missing scanned file for {}", virt_path.display()))?;
        let schema = parsed.schemas.get(virt_path).ok_or_else(|| {
            anyhow!("missing parsed schema for {}", virt_path.display())
        })?;

        let ts_name = ts_name_for
            .get(&(file.module_name.clone(), file.stem.clone()))
            .ok_or_else(|| anyhow!("missing ts_name for {}/{}", file.module_name, file.stem))?
            .clone();

        let ctx = EmitCtx {
            current_ts_name: &ts_name,
            ts_name_for: &ts_name_for,
            current_virt_module: &file.module_name,
            current_stem: &file.stem,
            referenced_externals: &mut referenced_externals,
            const_table: &const_table,
            virt_path_to_ts_name: &virt_path_to_ts_name,
        };

        let body = emit_module(schema, ctx)?;
        let path = out_dir.join("modules").join(format!("{ts_name}.ts"));
        fs::write(&path, body).with_context(|| format!("writing {}", path.display()))?;
    }

    // Resolve referenced externals against the registry, falling back to a
    // cross-crate auto-reexport. Any unresolved type is a hard error.
    //
    // Resolution order for `<ext_module>.<type>`:
    //   1. registry has explicit stub → use it.
    //   2. cross_crate_alias maps ext_module to a virtual module `m`,
    //      and `type_index[(m, type)]` exists → emit Reexport stub.
    //   3. for cross-crate aliases, fall through to the "primitive" external
    //      modules (strata_identifiers, strata_btc_types, block_flags) — the
    //      .ssz file likely transitively re-exports the type from a sibling
    //      Rust crate.
    let primitive_externals = ["strata_identifiers", "strata_btc_types", "block_flags"];
    let mut all_module_stubs: BTreeMap<String, Vec<Stub>> = BTreeMap::new();
    for (ext_module, types) in &referenced_externals {
        let mut module_stubs: Vec<Stub> = Vec::new();
        let registry_stubs: Vec<Stub> = stub_registry
            .get(ext_module.as_str())
            .cloned()
            .unwrap_or_default();
        let registry_names: HashSet<&str> =
            registry_stubs.iter().map(|s| s.name).collect();
        module_stubs.extend(registry_stubs);

        for t in types {
            if registry_names.contains(t.as_str()) {
                continue;
            }
            if let Some(crate_alias) = external_stubs::cross_crate_alias(ext_module.as_str()) {
                if let Some(ts_name) = type_index
                    .get(&(crate_alias.to_string(), t.clone()))
                    .cloned()
                {
                    module_stubs.push(Stub {
                        name: Box::leak(t.clone().into_boxed_str()),
                        kind: StubKind::Reexport {
                            module: Box::leak(ts_name.into_boxed_str()),
                        },
                    });
                    continue;
                }
                // Fall through: search primitive external stubs for this name.
                let mut found = false;
                for prim in &primitive_externals {
                    if let Some(stubs) = stub_registry.get(prim) {
                        if let Some(s) = stubs.iter().find(|s| s.name == t.as_str()) {
                            module_stubs.push(s.clone());
                            referenced_externals_pending(prim, s.name);
                            found = true;
                            break;
                        }
                    }
                }
                if found {
                    continue;
                }
                // Last-resort fallback: scan ALL scanned modules for a type
                // matching this name. Useful for transitive Rust re-exports
                // where `strata_asm_common.AsmManifest` actually points to
                // `asm-manifest-types/manifest.ssz`.
                let matches: Vec<&String> = type_index
                    .iter()
                    .filter(|((_, name), _)| name == t)
                    .map(|(_, ts)| ts)
                    .collect();
                if matches.len() == 1 {
                    let ts_name = matches[0].clone();
                    module_stubs.push(Stub {
                        name: Box::leak(t.clone().into_boxed_str()),
                        kind: StubKind::Reexport {
                            module: Box::leak(ts_name.into_boxed_str()),
                        },
                    });
                    continue;
                } else if matches.len() > 1 {
                    return Err(anyhow!(
                        "external type '{ext_module}.{t}' is ambiguous: matches {} scanned modules",
                        matches.len()
                    ));
                }
            }
            return Err(anyhow!(
                "external type '{ext_module}.{t}' has no entry in external_stubs registry and no auto re-export found"
            ));
        }
        all_module_stubs.insert(ext_module.clone(), module_stubs);
    }

    // Emit external/<module>.ts for each referenced external module.
    for (ext_module, stubs) in &all_module_stubs {
        let body = emit_external_module(ext_module, stubs);
        let path = out_dir.join("external").join(format!("{ext_module}.ts"));
        fs::write(&path, body).with_context(|| format!("writing {}", path.display()))?;
    }

    // Emit the top-level alpen-types.ts registry.
    let registry_body = emit_registry(&module_ts_names, &parsed.files);
    fs::write(out_dir.join("alpen-types.ts"), registry_body)
        .with_context(|| "writing alpen-types.ts")?;

    // Emit sources.ts so the UI can show repo URLs and offer per-source toggles.
    let sources_body = emit_sources(_config, &parsed.files);
    fs::write(out_dir.join("sources.ts"), sources_body)
        .with_context(|| "writing sources.ts")?;

    Ok(())
}

/// Map each source to the set of module labels it contributes (e.g. the
/// `alpen` source might own `alpen/acct-types`, `alpen/ol/chain-types`, ...).
fn emit_sources(config: &Config, files: &[ScannedFile]) -> String {
    use std::collections::BTreeSet;
    let mut by_source: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
    for f in files {
        let label = format!(
            "{}/{}",
            f.source,
            f.module_dir
                .trim_start_matches("crates/")
                .trim_end_matches("/ssz")
        );
        by_source
            .entry(f.source.as_str())
            .or_default()
            .insert(label);
    }
    let mut url_for: BTreeMap<&str, &str> = BTreeMap::new();
    for s in &config.sources {
        if let Some(u) = &s.url {
            url_for.insert(s.name.as_str(), u.as_str());
        }
    }

    let mut body = String::new();
    body.push_str("// Generated by ssz-to-ts. DO NOT EDIT.\n");
    body.push_str("/* eslint-disable */\n");
    body.push_str("/* biome-ignore-all */\n\n");
    body.push_str("export type SourceInfo = {\n");
    body.push_str("  /** Short name used in `schema-sources.toml`. */\n");
    body.push_str("  name: string;\n");
    body.push_str("  /** Repo URL, if configured. */\n");
    body.push_str("  url: string | null;\n");
    body.push_str("  /** Module labels (registry keys) this source contributes. */\n");
    body.push_str("  modules: string[];\n");
    body.push_str("};\n\n");

    body.push_str("export const sources: SourceInfo[] = [\n");
    for (name, labels) in &by_source {
        let url = url_for.get(name).map(|u| format!("\"{u}\"")).unwrap_or_else(|| "null".to_string());
        body.push_str(&format!("  {{\n    name: \"{name}\",\n    url: {url},\n    modules: [\n"));
        for l in labels {
            body.push_str(&format!("      \"{l}\",\n"));
        }
        body.push_str("    ],\n  },\n");
    }
    body.push_str("];\n\n");

    body.push_str("export const moduleToSource: Record<string, string> = {\n");
    for (name, labels) in &by_source {
        for l in labels {
            body.push_str(&format!("  \"{l}\": \"{name}\",\n"));
        }
    }
    body.push_str("};\n");

    body
}

struct EmitCtx<'a> {
    current_ts_name: &'a str,
    ts_name_for: &'a HashMap<(String, String), String>,
    current_virt_module: &'a str,
    current_stem: &'a str,
    referenced_externals: &'a mut HashMap<String, BTreeSet<String>>,
    const_table: &'a HashMap<(std::path::PathBuf, String), u64>,
    /// virt_path -> ts module name (e.g. "snark-acct-types/update.ssz" ->
    /// "snark-acct-types-update"). Used to resolve local cross-file imports.
    virt_path_to_ts_name: &'a HashMap<std::path::PathBuf, String>,
}

fn emit_module(schema: &SszSchema, mut ctx: EmitCtx<'_>) -> Result<String> {
    let mut imports = ImportTracker::default();
    let mut body = String::new();

    body.push_str("// Generated by ssz-to-ts. DO NOT EDIT.\n");
    body.push_str("/* eslint-disable */\n");
    body.push_str("/* biome-ignore-all */\n\n");

    // Constants first.
    for c in schema.constants() {
        let val = match c.value() {
            ConstValue::Int(n) => format!("{n}"),
            ConstValue::Binop(_, _, _) => format!("{}", c.value().eval()),
        };
        body.push_str(&format!("export const {} = {val};\n", c.name().0));
    }
    if !schema.constants().is_empty() {
        body.push('\n');
    }

    // Aliases.
    for a in schema.aliases() {
        emit_alias(a, &mut body, &mut imports, &mut ctx)?;
    }
    if !schema.aliases().is_empty() {
        body.push('\n');
    }

    // Classes — emit in dependency order so each class's deps are declared first.
    let order = topo_sort_classes(schema.classes());
    for &i in &order {
        emit_class(&schema.classes()[i], &mut body, &mut imports, &mut ctx)?;
    }

    // Ensure even empty schema files are valid TS modules.
    if schema.constants().is_empty()
        && schema.aliases().is_empty()
        && schema.classes().is_empty()
    {
        body.push_str("export {};\n");
    }

    let import_header = imports.render();
    Ok(format!("{import_header}{body}"))
}

fn emit_alias(
    a: &AliasDef,
    body: &mut String,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<()> {
    let expr = ty_to_ts(a.ty(), imports, ctx)?;
    body.push_str(&format!("export const {} = {expr};\n", a.name().0));
    Ok(())
}

fn emit_class(
    c: &ClassDef,
    body: &mut String,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<()> {
    let parent = c.parent_ty();
    let parent_name = parent.base_name().0.as_str();

    let expr = match parent_name {
        "Container" => emit_container(c, imports, ctx)?,
        "StableContainer" => emit_stable_container(c, imports, ctx)?,
        "Profile" => emit_profile(c, imports, ctx)?,
        "Union" => emit_union(c, imports, ctx)?,
        other => {
            return Err(anyhow!(
                "unsupported parent type '{other}' for class '{}'",
                c.name().0
            ));
        }
    };

    body.push_str(&format!("export const {} = {expr};\n", c.name().0));
    Ok(())
}

fn emit_container(
    c: &ClassDef,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    imports.builtin("ContainerType");
    let fields = render_field_object(c.fields(), imports, ctx)?;
    Ok(format!("new ContainerType({fields})"))
}

fn emit_stable_container(
    c: &ClassDef,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    imports.builtin("StableContainerType");
    let n = parent_int_arg(c, ctx)?;
    let fields = render_field_object(c.fields(), imports, ctx)?;
    Ok(format!("new StableContainerType({fields}, {n})"))
}

fn emit_profile(
    c: &ClassDef,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    imports.builtin("ProfileType");
    // ProfileType wraps a base StableContainer; we don't have full Profile
    // examples in the current Alpen schemas, so we emit a placeholder.
    let _ = c;
    let _ = ctx;
    Ok("/* Profile not implemented */ undefined".to_string())
}

fn emit_union(
    c: &ClassDef,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    imports.builtin("UnionType");
    imports.builtin("NoneType");
    let mut variants = Vec::new();
    for f in c.fields() {
        match f.ty() {
            None => variants.push("new NoneType()".to_string()),
            Some(ty) => variants.push(ty_to_ts(ty, imports, ctx)?),
        }
    }
    Ok(format!("new UnionType([{}])", variants.join(", ")))
}

fn parent_int_arg(c: &ClassDef, ctx: &EmitCtx<'_>) -> Result<u64> {
    match c.parent_ty() {
        Ty::Complex(_, args) => {
            let arg = args.first().ok_or_else(|| {
                anyhow!("expected at least one parent arg for class '{}'", c.name().0)
            })?;
            extract_int(arg, ctx).ok_or_else(|| {
                anyhow!(
                    "expected integer parent arg for class '{}', got {arg:?}",
                    c.name().0
                )
            })
        }
        other => Err(anyhow!(
            "expected complex parent for class '{}', got {other:?}",
            c.name().0
        )),
    }
}

fn render_field_object(
    fields: &[ClassFieldDef],
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    let mut out = String::from("{");
    for (i, f) in fields.iter().enumerate() {
        if i > 0 {
            out.push_str(", ");
        }
        let ty = f.ty().ok_or_else(|| {
            anyhow!("non-union field '{}' has no type", f.name().0)
        })?;
        let expr = ty_to_ts(ty, imports, ctx)?;
        out.push_str(&format!("{}: {expr}", f.name().0));
    }
    out.push('}');
    Ok(out)
}

/// Convert a parsed `Ty` into a TypeScript expression that constructs the
/// corresponding `@chainsafe/ssz` Type<unknown>.
fn ty_to_ts(
    ty: &Ty,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    match ty {
        Ty::Simple(name) => simple_ty_to_ts(name.0.as_str(), imports, ctx),
        Ty::Complex(name, args) => complex_ty_to_ts(name.0.as_str(), args, imports, ctx),
        Ty::Imported(path, base_name, full_name) => {
            // First check: is this a LOCAL cross-file import (path matches one of
            // our scanned files)? If so, emit a sibling-module import.
            if let Some(target_ts) = ctx.virt_path_to_ts_name.get(path).cloned() {
                if target_ts != ctx.current_ts_name {
                    imports.local_named(&target_ts, &base_name.0);
                }
                return Ok(base_name.0.clone());
            }
            // Otherwise treat as external module reference.
            let full = full_name.0.as_str();
            let (module, _) = full.split_once('.').ok_or_else(|| {
                anyhow!("imported type full_name '{full}' has no dot")
            })?;
            ctx.referenced_externals
                .entry(module.to_string())
                .or_default()
                .insert(base_name.0.clone());
            imports.external(module);
            Ok(format!("{module}.{}", base_name.0))
        }
        Ty::ImportedComplex(path, _base_name, full_name, args) => {
            // Rare in current schemas (`external.List[...]`). Treat conservatively.
            let full = full_name.0.as_str();
            let (module, name) = full.split_once('.').ok_or_else(|| {
                anyhow!("imported complex type full_name '{full}' has no dot")
            })?;
            // Treat the same builtin generics if matched.
            if matches!(
                name,
                "List" | "Vector" | "Bitlist" | "Bitvector" | "Optional" | "Union"
            ) {
                return complex_ty_to_ts(name, args, imports, ctx);
            }
            // Local cross-file complex (rare).
            if let Some(target_ts) = ctx.virt_path_to_ts_name.get(path).cloned() {
                if target_ts != ctx.current_ts_name {
                    imports.local_named(&target_ts, name);
                }
                return Ok(name.to_string());
            }
            ctx.referenced_externals
                .entry(module.to_string())
                .or_default()
                .insert(name.to_string());
            imports.external(module);
            Ok(format!("{module}.{name}"))
        }
    }
}

fn simple_ty_to_ts(
    name: &str,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    match name {
        "boolean" | "bit" => {
            imports.builtin("BooleanType");
            Ok("new BooleanType()".to_string())
        }
        "byte" | "uint8" => {
            imports.builtin("UintNumberType");
            Ok("new UintNumberType(1)".to_string())
        }
        "uint16" => {
            imports.builtin("UintNumberType");
            Ok("new UintNumberType(2)".to_string())
        }
        "uint32" => {
            imports.builtin("UintNumberType");
            Ok("new UintNumberType(4)".to_string())
        }
        "uint64" => {
            imports.builtin("UintBigintType");
            Ok("new UintBigintType(8)".to_string())
        }
        "uint128" | "U128" => {
            imports.builtin("UintBigintType");
            Ok("new UintBigintType(16)".to_string())
        }
        "uint256" | "U256" => {
            imports.builtin("UintBigintType");
            Ok("new UintBigintType(32)".to_string())
        }
        // Bytes1..Bytes64 builtin aliases — the parser may already expand these,
        // but if they pass through as Simple we resolve here.
        other if other.starts_with("Bytes") => {
            if let Ok(n) = other.trim_start_matches("Bytes").parse::<u32>() {
                imports.builtin("ByteVectorType");
                return Ok(format!("new ByteVectorType({n})"));
            }
            local_or_throw(other, ctx)
        }
        other => local_or_throw(other, ctx),
    }
}

fn local_or_throw(name: &str, ctx: &EmitCtx<'_>) -> Result<String> {
    // Reference to a class/alias defined in the current module.
    let _ = ctx; // present so callers are uniform
    Ok(name.to_string())
}

fn complex_ty_to_ts(
    name: &str,
    args: &[TyExpr],
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    match name {
        "List" => emit_list_or_vector(args, true, imports, ctx),
        "Vector" => emit_list_or_vector(args, false, imports, ctx),
        "Bitlist" => {
            imports.builtin("BitListType");
            let n = require_int(args, 0, ctx)?;
            Ok(format!("new BitListType({n})"))
        }
        "Bitvector" => {
            imports.builtin("BitVectorType");
            let n = require_int(args, 0, ctx)?;
            Ok(format!("new BitVectorType({n})"))
        }
        "Optional" => {
            imports.builtin("OptionalType");
            let inner = require_ty(args, 0)?;
            let inner_expr = ty_to_ts(inner, imports, ctx)?;
            Ok(format!("new OptionalType({inner_expr})"))
        }
        "Union" => {
            imports.builtin("UnionType");
            let mut variants = Vec::new();
            for arg in args {
                match arg {
                    TyExpr::None => {
                        imports.builtin("NoneType");
                        variants.push("new NoneType()".to_string());
                    }
                    TyExpr::Ty(t) => variants.push(ty_to_ts(t, imports, ctx)?),
                    other => {
                        return Err(anyhow!("unexpected union variant: {other:?}"));
                    }
                }
            }
            Ok(format!("new UnionType([{}])", variants.join(", ")))
        }
        other => Err(anyhow!("unsupported complex type '{other}'")),
    }
}

fn emit_list_or_vector(
    args: &[TyExpr],
    is_list: bool,
    imports: &mut ImportTracker,
    ctx: &mut EmitCtx<'_>,
) -> Result<String> {
    let elem = require_ty(args, 0)?;
    let n = require_int(args, 1, ctx)?;

    // Special case: Vector/List of bytes -> ByteVector/ByteList.
    if let Ty::Simple(name) = elem {
        let s = name.0.as_str();
        if s == "byte" || s == "uint8" {
            if is_list {
                imports.builtin("ByteListType");
                return Ok(format!("new ByteListType({n})"));
            } else {
                imports.builtin("ByteVectorType");
                return Ok(format!("new ByteVectorType({n})"));
            }
        }
    }

    let basic = elem_is_basic(elem);
    let elem_expr = ty_to_ts(elem, imports, ctx)?;

    if is_list {
        if basic {
            imports.builtin("ListBasicType");
            Ok(format!("new ListBasicType({elem_expr}, {n})"))
        } else {
            imports.builtin("ListCompositeType");
            Ok(format!("new ListCompositeType({elem_expr}, {n})"))
        }
    } else if basic {
        imports.builtin("VectorBasicType");
        Ok(format!("new VectorBasicType({elem_expr}, {n})"))
    } else {
        imports.builtin("VectorCompositeType");
        Ok(format!("new VectorCompositeType({elem_expr}, {n})"))
    }
}

fn elem_is_basic(ty: &Ty) -> bool {
    match ty {
        Ty::Simple(name) => matches!(
            name.0.as_str(),
            "boolean"
                | "bit"
                | "byte"
                | "uint8"
                | "uint16"
                | "uint32"
                | "uint64"
                | "uint128"
                | "uint256"
                | "U128"
                | "U256"
        ),
        _ => false,
    }
}

fn extract_int(arg: &TyExpr, ctx: &EmitCtx<'_>) -> Option<u64> {
    match arg {
        TyExpr::Int(v) => Some(v.eval()),
        TyExpr::ConstRef(_, v) => Some(*v),
        TyExpr::Ty(Ty::Imported(path, base, _)) => {
            // Try the path as-is, then with .ssz extension stripped/added.
            let candidates = [
                path.clone(),
                path.with_extension("ssz"),
                path.with_extension(""),
            ];
            for cand in &candidates {
                if let Some(v) = ctx.const_table.get(&(cand.clone(), base.0.clone())) {
                    return Some(*v);
                }
            }
            None
        }
        _ => None,
    }
}

fn require_int(args: &[TyExpr], idx: usize, ctx: &EmitCtx<'_>) -> Result<u64> {
    let arg = args
        .get(idx)
        .ok_or_else(|| anyhow!("missing arg at index {idx}"))?;
    extract_int(arg, ctx).ok_or_else(|| anyhow!("expected int arg at {idx}, got {arg:?}"))
}

fn require_ty(args: &[TyExpr], idx: usize) -> Result<&Ty> {
    let arg = args
        .get(idx)
        .ok_or_else(|| anyhow!("missing arg at index {idx}"))?;
    match arg {
        TyExpr::Ty(t) => Ok(t),
        other => Err(anyhow!("expected type arg at {idx}, got {other:?}")),
    }
}

#[derive(Default)]
struct ImportTracker {
    builtins: BTreeSet<&'static str>,
    externals: BTreeSet<String>,
    /// Map from ts_name -> set of named bindings to import from `./<ts_name>`.
    locals: BTreeMap<String, BTreeSet<String>>,
}

impl ImportTracker {
    fn builtin(&mut self, name: &'static str) {
        self.builtins.insert(name);
    }
    fn external(&mut self, name: &str) {
        self.externals.insert(name.to_string());
    }
    fn local_named(&mut self, ts_name: &str, binding: &str) {
        self.locals
            .entry(ts_name.to_string())
            .or_default()
            .insert(binding.to_string());
    }
    fn render(&self) -> String {
        let mut s = String::new();
        if !self.builtins.is_empty() {
            let joined = self
                .builtins
                .iter()
                .copied()
                .collect::<Vec<_>>()
                .join(", ");
            s.push_str(&format!("import {{ {joined} }} from \"@chainsafe/ssz\";\n"));
        }
        for ext in &self.externals {
            s.push_str(&format!("import * as {ext} from \"../external/{ext}\";\n"));
        }
        for (ts, names) in &self.locals {
            let joined = names.iter().cloned().collect::<Vec<_>>().join(", ");
            s.push_str(&format!("import {{ {joined} }} from \"./{ts}\";\n"));
        }
        if !s.is_empty() {
            s.push('\n');
        }
        s
    }
}

fn emit_external_module(name: &str, stubs: &[Stub]) -> String {
    let mut body = String::new();
    body.push_str(&format!(
        "// Generated by ssz-to-ts for external module '{name}'. DO NOT EDIT.\n"
    ));
    body.push_str("/* eslint-disable */\n");
    body.push_str("/* biome-ignore-all */\n\n");

    let mut needed_builtins: BTreeSet<&'static str> = BTreeSet::new();
    let mut decls = String::new();
    let mut reexports = String::new();
    let mut alias_imports: BTreeMap<&str, BTreeSet<&str>> = BTreeMap::new();
    let mut alias_decls = String::new();

    for stub in stubs {
        match stub.kind {
            StubKind::Expr(expr) => {
                // Detect builtins referenced in the expression.
                for builtin in [
                    "BooleanType",
                    "ByteListType",
                    "ByteVectorType",
                    "ContainerType",
                    "ListBasicType",
                    "ListCompositeType",
                    "OptionalType",
                    "ProfileType",
                    "StableContainerType",
                    "UintBigintType",
                    "UintNumberType",
                    "UnionType",
                    "VectorBasicType",
                    "VectorCompositeType",
                    "BitListType",
                    "BitVectorType",
                    "NoneType",
                ] {
                    if expr.contains(builtin) {
                        needed_builtins.insert(builtin);
                    }
                }
                decls.push_str(&format!("export const {} = {expr};\n", stub.name));
            }
            StubKind::Reexport { module } => {
                reexports.push_str(&format!(
                    "export {{ {} }} from \"../modules/{module}\";\n",
                    stub.name
                ));
            }
            StubKind::AliasReexport { module, source_name } => {
                alias_imports
                    .entry(module)
                    .or_default()
                    .insert(source_name);
                alias_decls.push_str(&format!(
                    "export const {} = {source_name};\n",
                    stub.name
                ));
            }
        }
    }

    if !needed_builtins.is_empty() {
        let joined = needed_builtins
            .iter()
            .copied()
            .collect::<Vec<_>>()
            .join(", ");
        body.push_str(&format!("import {{ {joined} }} from \"@chainsafe/ssz\";\n"));
    }
    for (module, names) in &alias_imports {
        let joined = names.iter().copied().collect::<Vec<_>>().join(", ");
        body.push_str(&format!(
            "import {{ {joined} }} from \"../modules/{module}\";\n"
        ));
    }
    if !needed_builtins.is_empty() || !alias_imports.is_empty() {
        body.push('\n');
    }

    body.push_str(&decls);
    body.push_str(&alias_decls);
    let prev_block = !decls.is_empty() || !alias_decls.is_empty();
    if prev_block && !reexports.is_empty() {
        body.push('\n');
    }
    body.push_str(&reexports);

    body
}

fn emit_registry(
    module_ts_names: &BTreeMap<String, BTreeSet<String>>,
    files: &[ScannedFile],
) -> String {
    let mut body = String::new();
    body.push_str("// Generated by ssz-to-ts. DO NOT EDIT.\n");
    body.push_str("/* eslint-disable */\n");
    body.push_str("/* biome-ignore-all */\n\n");

    body.push_str("import type { Type } from \"@chainsafe/ssz\";\n");

    // import * as <ts-name> from "./modules/<ts-name>";
    let mut all_ts_names: BTreeSet<&str> = BTreeSet::new();
    for names in module_ts_names.values() {
        for n in names {
            all_ts_names.insert(n.as_str());
        }
    }
    for ts in &all_ts_names {
        body.push_str(&format!(
            "import * as {} from \"./modules/{ts}\";\n",
            ts_ident(ts)
        ));
    }
    body.push('\n');

    // Helper: filter a module's exports to only entries that look like Type<unknown>.
    body.push_str(
        "function pickTypes(m: Record<string, unknown>): Record<string, Type<unknown>> {\n",
    );
    body.push_str("  const out: Record<string, Type<unknown>> = {};\n");
    body.push_str("  for (const k of Object.keys(m)) {\n");
    body.push_str("    const v = m[k];\n");
    body.push_str(
        "    if (v && typeof v === \"object\" && typeof (v as { serialize?: unknown }).serialize === \"function\") {\n",
    );
    body.push_str("      out[k] = v as Type<unknown>;\n");
    body.push_str("    }\n");
    body.push_str("  }\n");
    body.push_str("  return out;\n");
    body.push_str("}\n\n");

    // Group files by module_name and union their exports under one entry.
    body.push_str(
        "export const modules: Record<string, Record<string, Type<unknown>>> = {\n",
    );

    // module_name -> module_path label (e.g. "alpen/ol/chain-types")
    let mut label_for: BTreeMap<&str, String> = BTreeMap::new();
    for f in files {
        let label = format!(
            "{}/{}",
            f.source,
            f.module_dir
                .trim_start_matches("crates/")
                .trim_end_matches("/ssz")
        );
        label_for.insert(f.module_name.as_str(), label);
    }

    for (mod_name, ts_names) in module_ts_names {
        let label = label_for
            .get(mod_name.as_str())
            .cloned()
            .unwrap_or_else(|| mod_name.clone());
        body.push_str(&format!("  \"{label}\": {{\n"));
        for ts in ts_names {
            body.push_str(&format!(
                "    ...pickTypes({} as Record<string, unknown>),\n",
                ts_ident(ts)
            ));
        }
        body.push_str("  },\n");
    }
    body.push_str("};\n\n");

    body.push_str("export type ModuleName = keyof typeof modules;\n");
    body.push_str("export const moduleNames = Object.keys(modules) as ModuleName[];\n");

    body
}

fn ts_ident(s: &str) -> String {
    // module identifiers can't have hyphens
    s.replace('-', "_")
}
