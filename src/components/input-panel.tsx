import type {Type} from "@chainsafe/ssz";
import {deserializeInputFormatNames, serializeInputFormatNames} from "../lib/formats";
import {TypeBuilder} from "./builder/type-builder";
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
  // Builder props
  inputMode: "editor" | "builder";
  onInputModeChange: (mode: "editor" | "builder") => void;
  sszType: Type<unknown> | null;
  typeName: string;
  parsedValue: unknown;
  onParsedValueChange: (value: unknown) => void;
};

export function InputPanel({
  serializeMode,
  input,
  inputFormat,
  onInputChange,
  onInputFormatChange,
  onGenerateDefault,
  loading,
  inputMode,
  onInputModeChange,
  sszType,
  typeName,
  parsedValue,
  onParsedValueChange,
}: InputPanelProps) {
  const formatNames = serializeMode ? serializeInputFormatNames : deserializeInputFormatNames;
  const showBuilder = serializeMode && inputMode === "builder";

  return (
    <div className="flex flex-col h-full gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-widest">Input</span>
          {/* Editor / Builder toggle — only in serialize mode */}
          {serializeMode && (
            <div className="flex gap-0.5 bg-[var(--color-surface)]/60 rounded-md p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => onInputModeChange("editor")}
                className={`px-2 py-0.5 text-[10px] font-mono rounded-[3px] transition-all duration-150 ${
                  inputMode === "editor"
                    ? "bg-[var(--color-eth-blue)]/15 text-[var(--color-eth-blue)] shadow-[inset_0_0_0_1px_var(--color-eth-blue-dim)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => onInputModeChange("builder")}
                className={`px-2 py-0.5 text-[10px] font-mono rounded-[3px] transition-all duration-150 ${
                  inputMode === "builder"
                    ? "bg-[var(--color-eth-blue)]/15 text-[var(--color-eth-blue)] shadow-[inset_0_0_0_1px_var(--color-eth-blue-dim)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Builder
              </button>
            </div>
          )}
        </div>
        {!showBuilder && (
          <FormatTabs options={formatNames} selected={inputFormat} onChange={onInputFormatChange} />
        )}
      </div>

      {showBuilder ? (
        <TypeBuilder
          sszType={sszType}
          value={parsedValue}
          onChange={onParsedValueChange}
          typeName={typeName}
        />
      ) : (
        <textarea
          className="flex-1 min-h-[280px] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-mono text-[13px] leading-relaxed rounded-lg border border-[var(--color-border)] p-4 resize-none focus:border-[var(--color-border-focus)] focus:outline-none placeholder:text-[var(--color-text-muted)]/50 transition-colors"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={serializeMode ? "Paste YAML, JSON, or hex data..." : "Paste hex-encoded SSZ bytes (0x...)"}
          spellCheck={false}
        />
      )}

      <div className="flex items-center gap-1.5">
        {!showBuilder && <FileUpload serializeMode={serializeMode} onLoad={onInputChange} />}
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
