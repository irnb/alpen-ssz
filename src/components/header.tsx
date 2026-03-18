import {type ForkName, forkNames, forks, typeNames} from "../lib/types";

const SPEC_VERSION = "1.6.0";

type HeaderProps = {
  forkName: string;
  typeName: string;
  onForkChange: (fork: ForkName) => void;
  onTypeChange: (type: string) => void;
};

export function Header({forkName, typeName, onForkChange, onTypeChange}: HeaderProps) {
  const types = typeNames(forks[forkName]);

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/80 backdrop-blur-sm px-5 py-3.5 sticky top-0 z-10">
      <div className="flex items-center justify-between gap-4 flex-wrap max-w-[1800px] mx-auto">
        <div className="flex items-center gap-3">
          {/* Ethereum diamond icon */}
          <div className="w-7 h-7 rounded-lg bg-[var(--color-eth-blue-dim)] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 256 417" className="text-[var(--color-eth-blue)]">
              <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6" />
              <path fill="currentColor" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
              <path fill="currentColor" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601L256 236.587z" opacity=".6" />
              <path fill="currentColor" d="M127.962 416.905v-104.72L0 236.585z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold font-sans text-[var(--color-text-primary)] leading-tight">
              SSZ Playground
            </h1>
            <a
              href={`https://github.com/ethereum/consensus-specs/blob/v${SPEC_VERSION}/ssz/simple-serialize.md`}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-eth-blue)] transition-colors"
            >
              consensus spec v{SPEC_VERSION}
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[var(--color-surface-overlay)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border)]">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">Fork</span>
            <select
              value={forkName}
              onChange={(e) => onForkChange(e.target.value as ForkName)}
              className="bg-transparent text-[var(--color-text-primary)] text-sm font-mono border-none focus:outline-none cursor-pointer pr-1"
            >
              {forkNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--color-surface-overlay)] rounded-lg px-2.5 py-1.5 border border-[var(--color-border)]">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">Type</span>
            <select
              value={typeName}
              onChange={(e) => onTypeChange(e.target.value)}
              className="bg-transparent text-[var(--color-text-primary)] text-sm font-mono border-none focus:outline-none cursor-pointer pr-1 max-w-[200px]"
            >
              {types.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
