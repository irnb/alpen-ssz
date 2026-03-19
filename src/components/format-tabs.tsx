type FormatTabsProps = {
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
};

export function FormatTabs({options, selected, onChange}: FormatTabsProps) {
  return (
    <div className="flex gap-0.5 bg-[var(--color-surface)]/60 rounded-md p-0.5 border border-[var(--color-border)]">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 text-[11px] font-mono rounded-[3px] transition-all duration-150 ${
            selected === opt
              ? "bg-[var(--color-eth-blue)]/15 text-[var(--color-eth-blue)] shadow-[inset_0_0_0_1px_var(--color-eth-blue-dim)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
