import type {Type} from "@chainsafe/ssz";
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
  onModeChange: (serialize: boolean) => void;
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
}

export function OutputPanel({
  serializeMode,
  onModeChange,
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
    <div className="flex flex-col">
      {/* Mode tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => onModeChange(true)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              serializeMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Serialize
          </button>
          <button
            onClick={() => onModeChange(false)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              !serializeMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Deserialize
          </button>
        </div>
        <FormatTabs options={formatNames} selected={outputFormat} onChange={onOutputFormatChange} />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Hash tree root (serialize mode only) */}
      {serializeMode && hashTreeRootText && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Hash Tree Root</span>
            <CopyButton text={hashTreeRootText} />
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-3 font-mono text-sm text-slate-300 break-all">
            {hashTreeRootText}
          </div>
        </div>
      )}

      {/* Main output */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider">
          {serializeMode ? "Serialized" : "Deserialized"}
        </span>
        <div className="flex gap-2">
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
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Download
          </button>
        </div>
      </div>
      <textarea
        readOnly
        value={loading ? "Processing..." : outputText}
        className="min-h-[200px] bg-slate-900 text-slate-300 font-mono text-sm rounded-lg border border-slate-700 p-4 resize-none focus:outline-none"
      />
    </div>
  );
}
