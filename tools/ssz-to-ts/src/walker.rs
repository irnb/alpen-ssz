use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, anyhow};
use sizzle_parser::{SszSchema, parse_str_schema};

use crate::config::{Config, Source};

/// One scanned `.ssz` file.
#[derive(Debug, Clone)]
pub struct ScannedFile {
    /// `parse_str_schema`-relative path (e.g. `acct-types/state.ssz`).
    pub virt_path: PathBuf,
    /// Real on-disk path.
    pub disk_path: PathBuf,
    /// Source name (e.g. `alpen`).
    pub source: String,
    /// Module subdir as listed in the config (e.g. `crates/acct-types/ssz`).
    pub module_dir: String,
    /// Crate-style module name (e.g. `acct-types`).
    pub module_name: String,
    /// File stem (e.g. `state`).
    pub stem: String,
    /// File contents.
    pub content: String,
}

#[derive(Debug, Default)]
pub struct Scanned {
    pub files: Vec<ScannedFile>,
    /// Distinct virt module dirs (one entry per `<source>:<module_dir>`).
    pub modules: Vec<String>,
}

#[derive(Debug)]
pub struct Parsed {
    pub schemas: HashMap<PathBuf, SszSchema>,
    pub parsing_order: Vec<PathBuf>,
    pub files: Vec<ScannedFile>,
}

pub fn scan(config: &Config) -> Result<Scanned> {
    let mut out = Scanned::default();
    let mut seen_stems: HashMap<(String, String), PathBuf> = HashMap::new();

    for source in &config.sources {
        for module_dir in &source.modules {
            let dir = source.path.join(module_dir);
            if !dir.is_dir() {
                return Err(anyhow!(
                    "module dir does not exist: {} (in source '{}')",
                    dir.display(),
                    source.name
                ));
            }

            let module_name = module_name_from_dir(module_dir);
            let module_key = format!("{}:{}", source.name, module_dir);
            out.modules.push(module_key.clone());

            for entry in fs::read_dir(&dir)
                .with_context(|| format!("reading dir {}", dir.display()))?
            {
                let entry = entry?;
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) != Some("ssz") {
                    continue;
                }
                let stem = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .ok_or_else(|| anyhow!("invalid filename: {}", path.display()))?
                    .to_string();
                let content = fs::read_to_string(&path)
                    .with_context(|| format!("reading {}", path.display()))?;

                // The parser resolves `import foo` relative to the importing
                // file's parent directory. Place every file at virtual path
                // `<module_name>/<stem>.ssz` so siblings within a crate import
                // each other naturally and cross-crate references resolve via
                // external module declarations instead.
                let virt_path: PathBuf = format!("{module_name}/{stem}.ssz").into();

                if let Some(prev) = seen_stems.insert(
                    (module_name.clone(), stem.clone()),
                    virt_path.clone(),
                ) {
                    return Err(anyhow!(
                        "duplicate stem '{stem}' in module '{module_name}': {} and {}",
                        prev.display(),
                        virt_path.display()
                    ));
                }

                out.files.push(ScannedFile {
                    virt_path,
                    disk_path: path,
                    source: source.name.clone(),
                    module_dir: module_dir.clone(),
                    module_name: module_name.clone(),
                    stem,
                    content,
                });
            }
        }
    }

    out.files.sort_by(|a, b| a.virt_path.cmp(&b.virt_path));
    Ok(out)
}

pub fn parse(scanned: &Scanned, config: &Config) -> Result<Parsed> {
    let files: HashMap<PathBuf, String> = scanned
        .files
        .iter()
        .map(|f| (f.virt_path.clone(), f.content.clone()))
        .collect();

    let externals: Vec<&str> = config.external_modules.iter().map(String::as_str).collect();

    let (parsing_order, schemas) = parse_str_schema(&files, &externals)
        .map_err(|e| anyhow!("sizzle-parser: {e}"))?;

    Ok(Parsed {
        schemas,
        parsing_order,
        files: scanned.files.clone(),
    })
}

/// Derive the module name (e.g. "acct-types") from the on-disk module dir
/// (e.g. "crates/acct-types/ssz" or "crates/ol/chain-types/ssz"). The convention:
/// drop a trailing `ssz` segment and a leading `crates` segment, then join the
/// rest with `-`.
fn module_name_from_dir(module_dir: &str) -> String {
    let parts: Vec<&str> = Path::new(module_dir)
        .components()
        .filter_map(|c| c.as_os_str().to_str())
        .collect();
    let mut filtered: Vec<&str> = parts
        .iter()
        .copied()
        .filter(|p| *p != "crates" && *p != "ssz")
        .collect();
    if filtered.is_empty() {
        // Fallback: use the original dir if filtering ate everything.
        filtered = parts;
    }
    filtered.join("-")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_name_simple() {
        assert_eq!(module_name_from_dir("crates/acct-types/ssz"), "acct-types");
    }

    #[test]
    fn module_name_nested() {
        assert_eq!(
            module_name_from_dir("crates/ol/chain-types/ssz"),
            "ol-chain-types"
        );
    }

    #[test]
    fn module_name_subprotocols() {
        assert_eq!(
            module_name_from_dir("crates/subprotocols/checkpoint/types/ssz"),
            "subprotocols-checkpoint-types"
        );
    }
}
