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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Input</h2>
        <FormatTabs options={formatNames} selected={inputFormat} onChange={onInputFormatChange} />
      </div>

      <textarea
        className="flex-1 min-h-[300px] bg-slate-900 text-slate-200 font-mono text-sm rounded-lg border border-slate-700 p-4 resize-none focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={serializeMode ? "Enter YAML, JSON, or hex data..." : "Enter hex-encoded SSZ bytes (0x...)"}
        spellCheck={false}
      />

      <div className="flex items-center gap-2 mt-3">
        <FileUpload serializeMode={serializeMode} onLoad={onInputChange} />
        <button
          onClick={onGenerateDefault}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-mono rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Default Value"}
        </button>
      </div>
    </div>
  );
}
