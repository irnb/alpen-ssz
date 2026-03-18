import {dependencies} from "../../package.json";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-5 py-3">
      <div className="flex items-center justify-between max-w-[1800px] mx-auto text-[10px] font-mono text-[var(--color-text-muted)]">
        <span>
          A{" "}
          <a
            href="https://lodestar.chainsafe.io"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors"
          >
            Lodestar
          </a>
          {" "}tool by{" "}
          <a
            href="https://chainsafe.io"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors"
          >
            ChainSafe Systems
          </a>
        </span>
        <span>
          @chainsafe/ssz {dependencies["@chainsafe/ssz"]} &middot; @lodestar/types {dependencies["@lodestar/types"]}
        </span>
      </div>
    </footer>
  );
}
