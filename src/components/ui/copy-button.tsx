import {toast} from "sonner";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({text, label = "Copy"}: CopyButtonProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}
