import { dependencies } from "../../package.json";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 px-6 py-4 text-center text-sm text-slate-500">
      <p>
        Made with love by{" "}
        <a href="https://chainsafe.io" className="text-slate-400 hover:text-white transition-colors">
          ChainSafe Systems
        </a>
        {" & "}
        <a
          href="https://github.com/chainsafe/simpleserialize.com/graphs/contributors"
          className="text-slate-400 hover:text-white transition-colors"
        >
          ETH Consensus Friends
        </a>
        {" | "}
        <a
          href="https://github.com/chainsafe/simpleserialize.com"
          className="text-slate-400 hover:text-white transition-colors"
        >
          GitHub
        </a>
      </p>
      <p className="mt-1 text-xs text-slate-600 font-mono">
        @chainsafe/ssz {dependencies["@chainsafe/ssz"]} | @lodestar/types {dependencies["@lodestar/types"]}
      </p>
    </footer>
  );
}
