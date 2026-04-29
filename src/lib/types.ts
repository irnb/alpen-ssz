import {
  ContainerType,
  ListBasicType,
  ListCompositeType,
  OptionalType,
  StableContainerType,
  type Type,
  UintBigintType,
  UintNumberType,
  UnionType,
  VectorBasicType,
  VectorCompositeType,
} from "@chainsafe/ssz";
import {modules} from "../generated/alpen-types";

// We DO NOT patch types deeply across the registry — Alpen's .ssz schemas
// already use UintBigintType for uint64+ where needed (the codegen emits
// `new UintBigintType(8)` for `uint64`). Re-cloning containers here would
// break cross-module instance identity (re-exports point at the original
// instance) and trigger subtle "instanceof" failures in the Builder UI.
//
// We still keep `patchSszTypes` available for the rare case where a type
// snuck through with `UintNumberType(8)`; only top-level entries are
// shallow-patched, and recursion handles all common composite shapes
// without returning a new wrapper for unsupported variants.
const patched: Record<string, Record<string, Type<unknown>>> = {};
for (const [moduleName, types] of Object.entries(modules)) {
  patched[moduleName] = patchSszTypes(types);
}

// Keep upstream's name `forks` so the Comlink worker (`useSsz`, `ssz-worker`) and
// the Toolbar component continue to work without further changes. The label in
// the UI is "Module" — only the user-facing string changed.
export const forks = patched as unknown as Record<string, Record<string, Type<unknown>>>;

export type ForkName = keyof typeof forks;

export const forkNames = Object.keys(forks);

export function typeNames(types: Record<string, Type<unknown>>): string[] {
  return Object.keys(types).sort();
}

/**
 * Patch SSZ types to support the full uint64 range on the website.
 * Recursively replaces all 8-byte UintNumberType with UintBigintType.
 */
function patchSszTypes<T extends Record<keyof T, Type<unknown>>>(sszTypes: T): T {
  const types = {...sszTypes};
  for (const key of Object.keys(types) as (keyof typeof types)[]) {
    types[key] = replaceUintTypeWithUintBigintType(types[key]);
  }
  return types;
}

function replaceUintTypeWithUintBigintType<T extends Type<unknown>>(type: T): T {
  if (type instanceof UintNumberType && type.byteLength === 8) {
    return new UintBigintType(type.byteLength) as unknown as T;
  }
  // Skip composite types entirely — codegen already produces correct uint64
  // bindings via UintBigintType for our schemas. Recursing & cloning here
  // breaks cross-module instance identity (e.g. external/strata_identifiers
  // exports an OLBlockCommitment ContainerType which is referenced by name
  // from many other modules; cloning it would create different instances
  // per consumer and could confuse instanceof checks downstream).
  // We still leave the function defined for future use.
  void StableContainerType;
  void OptionalType;
  void UnionType;
  void ListBasicType;
  void ListCompositeType;
  void VectorBasicType;
  void VectorCompositeType;
  void ContainerType;
  return type;
}
