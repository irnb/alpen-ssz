import {dependencies} from "../../package.json";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-5 py-3">
      <div className="flex items-center justify-between max-w-[1800px] mx-auto text-[10px] font-mono text-[var(--color-text-muted)]">
        <span>
          Alpen SSZ Inspector &middot; forked from{" "}
          <a
            href="https://github.com/ChainSafe/simpleserialize.com"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-eth-blue)] transition-colors"
          >
            ChainSafe simpleserialize.com
          </a>
        </span>
        <span>@chainsafe/ssz {dependencies["@chainsafe/ssz"]}</span>
      </div>
    </footer>
  );
}
