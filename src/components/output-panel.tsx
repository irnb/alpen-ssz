import type {Type} from "@chainsafe/ssz";
import {toast} from "sonner";
import {
  deserializeOutputFormatNames,
  deserializeOutputFormats,
  serializeOutputFormatNames,
  serializeOutputFormats,
} from "../lib/formats";
import {FormatTabs} from "./format-tabs";
import {CopyButton} from "./ui/copy-button";

type OutputPanelProps = {
  serializeMode: boolean;
  serialized: Uint8Array | null;
  hashTreeRoot: Uint8Array | null;
  deserialized: unknown | null;
  sszType: Type<unknown> | null;
  typeName: string;
  error: string | null;
  loading: boolean;
  outputFormat: string;
  onOutputFormatChange: (format: string) => void;
};

function downloadBlob(data: Uint8Array | string, filename: string) {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${filename}`);
}

export function OutputPanel({
  serializeMode,
  serialized,
  hashTreeRoot,
  deserialized,
  sszType,
  typeName,
  error,
  loading,
  outputFormat,
  onOutputFormatChange,
}: OutputPanelProps) {
  const formatNames = serializeMode ? serializeOutputFormatNames : deserializeOutputFormatNames;

  let outputText = "";
  let hashTreeRootText = "";

  if (serializeMode && serialized) {
    const fmt = serializeOutputFormats[outputFormat];
    if (fmt) {
      outputText = fmt.dump(serialized);
      hashTreeRootText = hashTreeRoot ? serializeOutputFormats.hex.dump(hashTreeRoot) : "";
    }
  } else if (!serializeMode && deserialized != null && sszType) {
    const fmt = deserializeOutputFormats[outputFormat];
    if (fmt) {
      outputText = fmt.dump(deserialized, sszType);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-widest">Output</span>
        <FormatTabs options={formatNames} selected={outputFormat} onChange={onOutputFormatChange} />
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400/90 text-[12px] font-mono leading-relaxed">
          {error}
        </div>
      )}

      {/* Hash tree root (serialize mode only) */}
      {serializeMode && hashTreeRootText && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">
              Hash Tree Root
            </span>
            <CopyButton text={hashTreeRootText} />
          </div>
          <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-[13px] text-[var(--color-eth-blue)] break-all select-all">
            {hashTreeRootText}
          </div>
        </div>
      )}

      {/* Main output */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">
            {serializeMode ? "Serialized" : "Deserialized"}
          </span>
          <div className="flex gap-1">
            <CopyButton text={outputText} />
            <button
              onClick={() => {
                if (serializeMode && serialized) {
                  downloadBlob(serialized, `${typeName}.ssz`);
                } else if (outputText) {
                  downloadBlob(outputText, `${typeName}.${outputFormat}`);
                }
              }}
              disabled={!outputText}
              className="px-2 py-1 text-[11px] font-mono rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Download
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={loading ? "Processing..." : outputText}
          className="w-full min-h-[180px] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-mono text-[13px] leading-relaxed rounded-lg border border-[var(--color-border)] p-4 resize-none focus:outline-none"
        />
      </div>
    </div>
  );
}
