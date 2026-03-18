type FormatTabsProps = {
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
};

export function FormatTabs({options, selected, onChange}: FormatTabsProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
            selected === opt ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
