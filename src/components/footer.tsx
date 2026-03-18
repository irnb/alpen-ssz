import {dependencies} from "../../package.json";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-5 py-3 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[var(--color-text-muted)] font-mono max-w-[1800px] mx-auto w-full">
      <div className="flex items-center gap-1">
        <span>Built by</span>
        <a href="https://chainsafe.io" className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors">
          ChainSafe
        </a>
        <span>&</span>
        <a
          href="https://github.com/chainsafe/simpleserialize.com/graphs/contributors"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors"
        >
          contributors
        </a>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[var(--color-text-muted)]">
          ssz {dependencies["@chainsafe/ssz"]} / types {dependencies["@lodestar/types"]}
        </span>
        <a
          href="https://github.com/chainsafe/simpleserialize.com"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
