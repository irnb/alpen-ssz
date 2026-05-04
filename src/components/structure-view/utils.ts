import {
  BitArray,
  BitListType,
  BitVectorType,
  BooleanType,
  ByteListType,
  ByteVectorType,
  ContainerType,
  ListBasicType,
  ListCompositeType,
  NoneType,
  OptionalType,
  ProfileType,
  StableContainerType,
  type Type,
  UintBigintType,
  UintNumberType,
  UnionType,
  VectorBasicType,
  VectorCompositeType,
} from "@chainsafe/ssz";
import {CheckpointSidecar} from "../../generated/modules/subprotocols-checkpoint-types-payload";

// SSZ types whose bytes are actually wire-encoded with strata_codec (Rust-side
// framework, not SSZ). When we encounter one of these, the inspector offers a
// secondary decode pass via the schemas in src/lib/strata-codec.ts.
//
// Identity-based: each entry references the unique Type instance from the
// generated SSZ schema, so renaming the field name elsewhere would not match
// here by accident.
const RUST_CODEC_TYPES = new Map<Type<unknown>, RustCodecKind>([
  [CheckpointSidecar.fields.ol_state_diff as Type<unknown>, "olStateDiff"],
]);

export type RustCodecKind = "olStateDiff";

export type SszCategory = "uint" | "bytes" | "container" | "list" | "boolean" | "unknown";

export type TreeNodeData = {
  key: string;
  typeName: string;
  category: SszCategory;
  value: string | null;
  /** Semantic summary shown when value is truncated (e.g. "32 bytes", "4096 bits") */
  valueSuffix: string | null;
  children: TreeNodeData[] | null;
  gindex: string;
  /** Raw bytes — populated for byte leaves whose contents need a follow-up decode. */
  rawBytes: Uint8Array | null;
  /** When set, these bytes are decodable via a non-SSZ Rust codec. */
  rustCodec: RustCodecKind | null;
};

export function getCategory(type: Type<unknown>): SszCategory {
  if (type instanceof UintNumberType || type instanceof UintBigintType) return "uint";
  if (type instanceof ByteVectorType || type instanceof ByteListType) return "bytes";
  if (type instanceof BooleanType || type instanceof BitListType || type instanceof BitVectorType) return "boolean";
  if (type instanceof ContainerType || type instanceof StableContainerType || type instanceof ProfileType)
    return "container";
  if (type instanceof UnionType || type instanceof OptionalType) return "container";
  if (
    type instanceof ListBasicType ||
    type instanceof ListCompositeType ||
    type instanceof VectorBasicType ||
    type instanceof VectorCompositeType
  )
    return "list";
  if (type instanceof NoneType) return "unknown";
  return "unknown";
}

export function getTypeName(type: Type<unknown>): string {
  if (type instanceof UintNumberType) return `uint${type.byteLength * 8}`;
  if (type instanceof UintBigintType) return `uint${type.byteLength * 8}`;
  if (type instanceof BooleanType) return "boolean";
  if (type instanceof ByteVectorType) return `ByteVector[${type.lengthBytes}]`;
  if (type instanceof ByteListType) return `ByteList[${type.limitBytes}]`;
  if (type instanceof BitListType) return `BitList[${type.limitBits}]`;
  if (type instanceof BitVectorType) return `BitVector[${type.lengthBits}]`;
  if (type instanceof ContainerType) return "Container";
  if (type instanceof StableContainerType) return "StableContainer";
  if (type instanceof ProfileType) return "Profile";
  if (type instanceof OptionalType) return "Optional";
  if (type instanceof ListBasicType) return `List[${type.limit}]`;
  if (type instanceof ListCompositeType) return `List[${type.limit}]`;
  if (type instanceof VectorBasicType) return `Vector[${type.length}]`;
  if (type instanceof VectorCompositeType) return `Vector[${type.length}]`;
  if (type instanceof UnionType) return "Union";
  if (type instanceof NoneType) return "None";
  return "unknown";
}

export function isLeafType(type: Type<unknown>): boolean {
  const cat = getCategory(type);
  return cat === "uint" || cat === "boolean" || cat === "bytes";
}

function formatValue(value: unknown): {text: string; suffix: string | null} {
  if (value === undefined || value === null) return {text: "null", suffix: null};
  if (typeof value === "bigint") return {text: value.toString(), suffix: null};
  if (typeof value === "boolean") return {text: String(value), suffix: null};
  if (typeof value === "number") return {text: String(value), suffix: null};
  if (value instanceof BitArray) {
    const bools = value.toBoolArray();
    const set = bools.filter(Boolean).length;
    return {
      text: bools.map((b) => (b ? "1" : "0")).join(""),
      suffix: `${value.bitLen} bits, ${set} set`,
    };
  }
  if (value instanceof Uint8Array) {
    return {
      text: `0x${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}`,
      suffix: `${value.length} bytes`,
    };
  }
  return {text: String(value), suffix: null};
}

export function buildTree(type: Type<unknown>, data: unknown, key: string, gindex: string): TreeNodeData {
  const category = getCategory(type);
  const typeName = getTypeName(type);

  if (isLeafType(type)) {
    const {text, suffix} = formatValue(data);
    const rustCodec = RUST_CODEC_TYPES.get(type) ?? null;
    const rawBytes = rustCodec && data instanceof Uint8Array ? data : null;
    return {key, typeName, category, value: text, valueSuffix: suffix, children: null, gindex, rawBytes, rustCodec};
  }

  if (type instanceof ContainerType || type instanceof StableContainerType || type instanceof ProfileType) {
    const fields = (type as ContainerType<Record<string, Type<unknown>>>).fields as Record<string, Type<unknown>>;
    const fieldNames = Object.keys(fields);
    const depth = Math.ceil(Math.log2(Math.max(fieldNames.length, 1)));
    const children = fieldNames.map((fieldName, i) => {
      const fieldGindex = (BigInt(gindex) * 2n ** BigInt(depth) + BigInt(i)).toString();
      const fieldData = data && typeof data === "object" ? (data as Record<string, unknown>)[fieldName] : undefined;
      return buildTree(fields[fieldName], fieldData, fieldName, fieldGindex);
    });
    return {key, typeName, category, value: null, valueSuffix: null, children, gindex, rawBytes: null, rustCodec: null};
  }

  if (type instanceof OptionalType) {
    const inner = (type as unknown as {elementType: Type<unknown>}).elementType;
    if (data === null || data === undefined) {
      return {
        key,
        typeName,
        category,
        value: "absent",
        valueSuffix: null,
        children: null,
        gindex,
        rawBytes: null,
        rustCodec: null,
      };
    }
    return buildTree(inner, data, key, gindex);
  }

  if (type instanceof UnionType) {
    const variants = (type as unknown as {types: Type<unknown>[]}).types ?? [];
    const obj = data && typeof data === "object" ? (data as {selector?: number; value?: unknown}) : {};
    const selector = typeof obj.selector === "number" ? obj.selector : 0;
    const variantType = variants[selector];
    if (!variantType || variantType instanceof NoneType) {
      return {
        key,
        typeName: `${typeName} (variant ${selector})`,
        category,
        value: "none",
        valueSuffix: null,
        children: null,
        gindex,
        rawBytes: null,
        rustCodec: null,
      };
    }
    const child = buildTree(variantType, obj.value, `variant[${selector}]`, gindex);
    return {
      key,
      typeName,
      category,
      value: null,
      valueSuffix: null,
      children: [child],
      gindex,
      rawBytes: null,
      rustCodec: null,
    };
  }

  if (
    type instanceof ListBasicType ||
    type instanceof ListCompositeType ||
    type instanceof VectorBasicType ||
    type instanceof VectorCompositeType
  ) {
    const elementType = type.elementType as Type<unknown>;
    const items = Array.isArray(data) ? data : [];
    const baseGindex = BigInt(gindex) * 2n;
    const children = items.slice(0, 100).map((item, i) => {
      const elemGindex = (baseGindex + BigInt(i)).toString();
      return buildTree(elementType, item, `[${i}]`, elemGindex);
    });
    if (items.length > 100) {
      children.push({
        key: `... ${items.length - 100} more`,
        typeName: "",
        category: "unknown",
        value: null,
        valueSuffix: null,
        children: null,
        gindex: "",
        rawBytes: null,
        rustCodec: null,
      });
    }
    return {
      key,
      typeName: `${typeName} (${items.length})`,
      category,
      value: null,
      valueSuffix: null,
      children,
      gindex,
      rawBytes: null,
      rustCodec: null,
    };
  }

  const {text, suffix} = formatValue(data);
  return {
    key,
    typeName,
    category,
    value: text,
    valueSuffix: suffix,
    children: null,
    gindex,
    rawBytes: null,
    rustCodec: null,
  };
}

export const categoryColors: Record<SszCategory, string> = {
  uint: "text-[var(--color-ssz-uint)]",
  bytes: "text-[var(--color-ssz-bytes)]",
  container: "text-[var(--color-ssz-container)]",
  list: "text-[var(--color-ssz-list)]",
  boolean: "text-[var(--color-ssz-boolean)]",
  unknown: "text-slate-500",
};
