import type {Type} from "@chainsafe/ssz";
import {FieldInput} from "./field-input";

type TypeBuilderProps = {
  sszType: Type<unknown> | null;
  value: unknown;
  onChange: (value: unknown) => void;
  typeName: string;
};

export function TypeBuilder({sszType, value, onChange, typeName}: TypeBuilderProps) {
  if (!sszType) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-[var(--color-text-muted)]/50 font-mono py-8">
        Select an SSZ type to start building
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 min-h-[280px] bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-3">
      <FieldInput
        type={sszType}
        value={value}
        onChange={onChange}
        fieldName={typeName}
        depth={0}
      />
    </div>
  );
}
