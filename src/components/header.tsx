const SPEC_VERSION = "1.6.0";

export function Header() {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/80 backdrop-blur-sm px-5 py-2.5">
      <div className="flex items-center justify-between max-w-[1800px] mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[var(--color-eth-blue-dim)] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 256 417" className="text-[var(--color-eth-blue)]">
              <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6" />
              <path fill="currentColor" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
              <path fill="currentColor" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601L256 236.587z" opacity=".6" />
              <path fill="currentColor" d="M127.962 416.905v-104.72L0 236.585z" />
            </svg>
          </div>
          <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">SSZ Playground</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          <a
            href={`https://github.com/ethereum/consensus-specs/blob/v${SPEC_VERSION}/ssz/simple-serialize.md`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-eth-blue)] transition-colors"
          >
            spec v{SPEC_VERSION}
          </a>
          <span className="text-[var(--color-border)]">|</span>
          <a
            href="https://github.com/chainsafe/simpleserialize.com"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-eth-blue)] transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
