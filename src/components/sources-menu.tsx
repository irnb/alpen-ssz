import {useEffect, useRef, useState} from "react";
import {sources} from "../generated/sources";

type Props = {
  isEnabled: (sourceName: string) => boolean;
  onToggle: (sourceName: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
};

/**
 * Popover button in the toolbar listing the configured source repos. Clicking
 * a row toggles whether that source's modules show up in the Module dropdown.
 * State persists in localStorage; types stay loaded so re-enabling is instant.
 */
export function SourcesMenu({isEnabled, onToggle, onEnableAll, onDisableAll}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const enabledCount = sources.filter((s) => isEnabled(s.name)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1 text-[11px] font-mono rounded-md bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-all flex items-center gap-1.5"
        title="Source repos"
      >
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">
          Sources
        </span>
        <span className="text-[var(--color-eth-blue)]">
          {enabledCount}/{sources.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-50 w-[360px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">
              Source repos
            </span>
            <div className="flex gap-1">
              <button
                onClick={onEnableAll}
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
              >
                all
              </button>
              <button
                onClick={onDisableAll}
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all"
              >
                none
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-1">
            {sources.map((s) => {
              const enabled = isEnabled(s.name);
              return (
                <li
                  key={s.name}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-[var(--color-surface-overlay)]/40"
                >
                  <button
                    onClick={() => onToggle(s.name)}
                    className={`mt-0.5 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center text-[9px] leading-none shrink-0 transition-all ${
                      enabled
                        ? "bg-[var(--color-eth-blue)]/15 border-[var(--color-eth-blue)] text-[var(--color-eth-blue)]"
                        : "bg-[var(--color-surface)] border-[var(--color-border)]"
                    }`}
                    aria-label={enabled ? "Disable" : "Enable"}
                  >
                    {enabled ? "✓" : ""}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-[var(--color-text-primary)]">
                        {s.name}
                      </span>
                      <span className="text-[9px] text-[var(--color-text-muted)]/60">
                        {s.modules.length} module{s.modules.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-eth-blue)] transition-colors break-all"
                      >
                        {s.url.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
