import {dependencies} from "../../package.json";

export function Footer() {
  return (
    <footer className="px-5 py-2 text-center text-[10px] text-[var(--color-text-muted)]/50 font-mono">
      <a href="https://chainsafe.io" className="hover:text-[var(--color-text-muted)] transition-colors">ChainSafe</a>
      {" / "}
      ssz {dependencies["@chainsafe/ssz"]}
      {" / "}
      types {dependencies["@lodestar/types"]}
    </footer>
  );
}
