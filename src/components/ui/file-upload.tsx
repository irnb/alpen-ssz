import {toHexString} from "@chainsafe/ssz";
import type React from "react";
import {useRef} from "react";

type FileUploadProps = {
  serializeMode: boolean;
  onLoad: (content: string) => void;
};

export function FileUpload({serializeMode, onLoad}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onLoad(toHexString(new Uint8Array(reader.result)));
      } else if (typeof reader.result === "string") {
        onLoad(reader.result);
      }
    };

    if (serializeMode) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <label className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer transition-colors">
      Upload
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={serializeMode ? ".yaml,.yml,.json" : ".ssz"}
        onChange={handleChange}
      />
    </label>
  );
}
