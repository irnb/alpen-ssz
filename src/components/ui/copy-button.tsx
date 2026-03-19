import {useState} from "react";
import {toast} from "sonner";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({text, label = "Copy"}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className="px-2 py-1 text-[11px] font-mono rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
