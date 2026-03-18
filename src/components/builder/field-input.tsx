import {
  BitListType,
  BitVectorType,
  BooleanType,
  ByteListType,
  ByteVectorType,
  ContainerType,
  ListBasicType,
  ListCompositeType,
  type Type,
  UintBigintType,
  UintNumberType,
  VectorBasicType,
  VectorCompositeType,
} from "@chainsafe/ssz";
import {useState} from "react";
import {getCategory, getTypeName} from "../structure-view/utils";

type FieldInputProps = {
  type: Type<unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldName: string;
  depth?: number;
};

const categoryBadgeColors: Record<string, string> = {
  uint: "text-[var(--color-ssz-uint)]/60",
  bytes: "text-[var(--color-ssz-bytes)]/60",
  container: "text-[var(--color-ssz-container)]/60",
  list: "text-[var(--color-ssz-list)]/60",
  boolean: "text-[var(--color-ssz-boolean)]/60",
  unknown: "text-[var(--color-text-muted)]/40",
};

function toHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function FieldInput({type, value, onChange, fieldName, depth = 0}: FieldInputProps) {
  const category = getCategory(type);
  const typeName = getTypeName(type);

  // Boolean
  if (type instanceof BooleanType) {
    return (
      <LeafRow fieldName={fieldName} typeName={typeName} category={category}>
        <button
          onClick={() => onChange(!value)}
          className={`px-2.5 py-0.5 text-[11px] font-mono rounded-md border transition-all ${
            value
              ? "bg-[var(--color-ssz-boolean)]/15 border-[var(--color-ssz-boolean)]/30 text-[var(--color-ssz-boolean)]"
              : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
        >
          {value ? "true" : "false"}
        </button>
      </LeafRow>
    );
  }

  // Uint
  if (type instanceof UintNumberType || type instanceof UintBigintType) {
    const isSmall = type.byteLength <= 4;
    const strVal = value != null ? String(value) : "0";
    return (
      <LeafRow fieldName={fieldName} typeName={typeName} category={category}>
        <input
          type={isSmall ? "number" : "text"}
          value={strVal}
          onChange={(e) => {
            const v = e.target.value;
            if (type instanceof UintBigintType) {
              try { onChange(BigInt(v)); } catch { /* invalid */ }
            } else {
              const n = Number(v);
              if (!Number.isNaN(n)) onChange(n);
            }
          }}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-0.5 text-[12px] font-mono text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none w-full max-w-[200px] transition-colors"
        />
      </LeafRow>
    );
  }

  // Bytes
  if (type instanceof ByteVectorType || type instanceof ByteListType) {
    const byteVal = value instanceof Uint8Array ? value : new Uint8Array(0);
    const hexStr = toHex(byteVal);
    const expectedLen = type instanceof ByteVectorType ? type.lengthBytes : undefined;
    return (
      <LeafRow fieldName={fieldName} typeName={typeName} category={category}>
        <input
          type="text"
          value={hexStr}
          onChange={(e) => {
            try {
              const bytes = fromHex(e.target.value);
              if (expectedLen && bytes.length !== expectedLen) return;
              onChange(bytes);
            } catch { /* invalid hex */ }
          }}
          placeholder={expectedLen ? `0x...(${expectedLen} bytes)` : "0x..."}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none w-full transition-colors"
        />
      </LeafRow>
    );
  }

  // BitList / BitVector
  if (type instanceof BitListType || type instanceof BitVectorType) {
    return (
      <BitField
        type={type}
        value={value}
        onChange={onChange}
        fieldName={fieldName}
        typeName={typeName}
        category={category}
      />
    );
  }

  // Container
  if (type instanceof ContainerType) {
    return (
      <ContainerField
        type={type}
        value={value}
        onChange={onChange}
        fieldName={fieldName}
        typeName={typeName}
        depth={depth}
      />
    );
  }

  // List / Vector
  if (
    type instanceof ListBasicType ||
    type instanceof ListCompositeType ||
    type instanceof VectorBasicType ||
    type instanceof VectorCompositeType
  ) {
    return (
      <ListField
        type={type}
        value={value}
        onChange={onChange}
        fieldName={fieldName}
        typeName={typeName}
        depth={depth}
      />
    );
  }

  // Fallback
  return (
    <LeafRow fieldName={fieldName} typeName={typeName} category={category}>
      <span className="text-[11px] text-[var(--color-text-muted)]">unsupported type</span>
    </LeafRow>
  );
}

// --- Sub-components ---

function LeafRow({
  fieldName,
  typeName,
  category,
  children,
}: {
  fieldName: string;
  typeName: string;
  category: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px] min-h-[28px]">
      <span className="text-[12px] font-mono text-[var(--color-text-primary)] min-w-[120px] shrink-0">{fieldName}</span>
      <span className={`text-[10px] font-mono ${categoryBadgeColors[category]} min-w-[80px] shrink-0`}>{typeName}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ContainerField({
  type,
  value,
  onChange,
  fieldName,
  typeName,
  depth,
}: {
  type: ContainerType<Record<string, Type<unknown>>>;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldName: string;
  typeName: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const fields = type.fields as Record<string, Type<unknown>>;
  const fieldNames = Object.keys(fields);
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const handleFieldChange = (fieldKey: string, fieldValue: unknown) => {
    onChange({...obj, [fieldKey]: fieldValue});
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-[3px] cursor-pointer hover:bg-[var(--color-surface-overlay)]/40 rounded px-1 -mx-1"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-[10px] transition-transform duration-150 text-[var(--color-text-muted)] select-none ${expanded ? "rotate-90" : ""}`}>
          &#9654;
        </span>
        <span className="text-[12px] font-mono text-[var(--color-text-primary)]">{fieldName}</span>
        <span className="text-[10px] font-mono text-[var(--color-ssz-container)]/60">{typeName}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]/40">{fieldNames.length} fields</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-3 border-l border-[var(--color-border)]/40">
          {fieldNames.map((key) => (
            <FieldInput
              key={key}
              type={fields[key]}
              value={obj[key]}
              onChange={(v) => handleFieldChange(key, v)}
              fieldName={key}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListField({
  type,
  value,
  onChange,
  fieldName,
  typeName,
  depth,
}: {
  type: Type<unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldName: string;
  typeName: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  // biome-ignore lint/suspicious/noExplicitAny: SSZ type generics are complex
  const elementType = (type as any).elementType as Type<unknown>;
  const items = Array.isArray(value) ? value : [];
  const isFixed = type instanceof VectorBasicType || type instanceof VectorCompositeType;
  // biome-ignore lint/suspicious/noExplicitAny: accessing limit/length across type variants
  const limit: number = isFixed ? (type as any).length : (type as any).limit;

  const handleItemChange = (index: number, itemValue: unknown) => {
    const next = [...items];
    next[index] = itemValue;
    onChange(next);
  };

  const addItem = () => {
    if (items.length >= limit) return;
    onChange([...items, elementType.defaultValue()]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-[3px] cursor-pointer hover:bg-[var(--color-surface-overlay)]/40 rounded px-1 -mx-1"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-[10px] transition-transform duration-150 text-[var(--color-text-muted)] select-none ${expanded ? "rotate-90" : ""}`}>
          &#9654;
        </span>
        <span className="text-[12px] font-mono text-[var(--color-text-primary)]">{fieldName}</span>
        <span className="text-[10px] font-mono text-[var(--color-ssz-list)]/60">{typeName}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]/40">{items.length} items</span>
      </div>
      {expanded && (
        <div className="ml-3 pl-3 border-l border-[var(--color-border)]/40">
          {items.slice(0, 50).map((item, i) => (
            <div key={i} className="flex items-start gap-1 group/item">
              <div className="flex-1 min-w-0">
                <FieldInput
                  type={elementType}
                  value={item}
                  onChange={(v) => handleItemChange(i, v)}
                  fieldName={`[${i}]`}
                  depth={depth + 1}
                />
              </div>
              {!isFixed && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                  className="mt-1 px-1 text-[10px] text-red-400/40 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          {items.length > 50 && (
            <span className="text-[11px] text-[var(--color-text-muted)] py-1 block">
              ...{items.length - 50} more items
            </span>
          )}
          {!isFixed && items.length < limit && (
            <button
              onClick={addItem}
              className="mt-1 px-2 py-0.5 text-[11px] font-mono rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] border-dashed text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]/30 transition-all"
            >
              + add item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BitField({
  type,
  value,
  onChange,
  fieldName,
  typeName,
  category,
}: {
  type: BitListType | BitVectorType;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldName: string;
  typeName: string;
  category: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFixed = type instanceof BitVectorType;
  const maxBits = isFixed ? type.lengthBits : type.limitBits;

  // BitArray values are boolean arrays in SSZ
  const bits: boolean[] = Array.isArray(value) ? value : [];

  const toggleBit = (index: number) => {
    const next = [...bits];
    next[index] = !next[index];
    onChange(next);
  };

  const addBit = () => {
    if (bits.length >= maxBits) return;
    onChange([...bits, false]);
  };

  const removeBit = () => {
    if (bits.length === 0) return;
    onChange(bits.slice(0, -1));
  };

  const setAll = (val: boolean) => {
    onChange(bits.map(() => val));
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-[3px] cursor-pointer hover:bg-[var(--color-surface-overlay)]/40 rounded px-1 -mx-1"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-[10px] transition-transform duration-150 text-[var(--color-text-muted)] select-none ${expanded ? "rotate-90" : ""}`}>
          &#9654;
        </span>
        <span className="text-[12px] font-mono text-[var(--color-text-primary)]">{fieldName}</span>
        <span className={`text-[10px] font-mono ${categoryBadgeColors[category]}`}>{typeName}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]/40">
          {bits.length} bits, {bits.filter(Boolean).length} set
        </span>
      </div>
      {expanded && (
        <div className="ml-3 pl-3 border-l border-[var(--color-border)]/40 py-1">
          {/* Bit grid */}
          <div className="flex flex-wrap gap-[2px] mb-2">
            {bits.slice(0, 256).map((bit, i) => (
              <button
                key={i}
                onClick={() => toggleBit(i)}
                title={`bit ${i}: ${bit ? "1" : "0"}`}
                className={`w-[14px] h-[14px] rounded-[2px] text-[8px] font-mono leading-none flex items-center justify-center transition-all ${
                  bit
                    ? "bg-[var(--color-ssz-boolean)] text-white"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]/30 hover:border-[var(--color-ssz-boolean)]/40"
                }`}
              >
                {bit ? "1" : "0"}
              </button>
            ))}
            {bits.length > 256 && (
              <span className="text-[10px] text-[var(--color-text-muted)] self-center ml-1">
                ...{bits.length - 256} more
              </span>
            )}
          </div>
          {/* Controls */}
          <div className="flex items-center gap-1.5">
            {!isFixed && bits.length < maxBits && (
              <button
                onClick={addBit}
                className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] border-dashed text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
              >
                + bit
              </button>
            )}
            {!isFixed && bits.length > 0 && (
              <button
                onClick={removeBit}
                className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] border-dashed text-[var(--color-text-muted)] hover:text-red-400/70 transition-all"
              >
                - bit
              </button>
            )}
            {bits.length > 0 && (
              <>
                <button
                  onClick={() => setAll(true)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
                >
                  all 1
                </button>
                <button
                  onClick={() => setAll(false)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
                >
                  all 0
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
