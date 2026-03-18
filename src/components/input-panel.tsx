import {deserializeInputFormatNames, serializeInputFormatNames} from "../lib/formats";
import {FormatTabs} from "./format-tabs";
import {FileUpload} from "./ui/file-upload";

type InputPanelProps = {
  serializeMode: boolean;
  input: string;
  inputFormat: string;
  onInputChange: (value: string) => void;
  onInputFormatChange: (format: string) => void;
  onGenerateDefault: () => void;
  loading: boolean;
};

export function InputPanel({
  serializeMode,
  input,
  inputFormat,
  onInputChange,
  onInputFormatChange,
  onGenerateDefault,
  loading,
}: InputPanelProps) {
  const formatNames = serializeMode ? serializeInputFormatNames : deserializeInputFormatNames;

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-widest">Input</span>
        <FormatTabs options={formatNames} selected={inputFormat} onChange={onInputFormatChange} />
      </div>

      <textarea
        className="flex-1 min-h-[280px] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-mono text-[13px] leading-relaxed rounded-lg border border-[var(--color-border)] p-4 resize-none focus:border-[var(--color-border-focus)] focus:outline-none placeholder:text-[var(--color-text-muted)]/50 transition-colors"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={serializeMode ? "Paste YAML, JSON, or hex data..." : "Paste hex-encoded SSZ bytes (0x...)"}
        spellCheck={false}
      />

      <div className="flex items-center gap-1.5">
        <FileUpload serializeMode={serializeMode} onLoad={onInputChange} />
        <button
          onClick={onGenerateDefault}
          disabled={loading}
          className="px-2.5 py-1.5 text-[11px] font-mono rounded-md bg-[var(--color-eth-blue)]/15 text-[var(--color-eth-blue)] border border-[var(--color-eth-blue-dim)] hover:bg-[var(--color-eth-blue)]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Loading..." : "Default Value"}
        </button>
      </div>
    </div>
  );
}
