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
    <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-mono text-white tracking-tight">SSZ Playground</h1>
          <a
            href={`https://github.com/ethereum/consensus-specs/blob/v${SPEC_VERSION}/ssz/simple-serialize.md`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            spec v{SPEC_VERSION}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Fork</span>
            <select
              value={forkName}
              onChange={(e) => onForkChange(e.target.value as ForkName)}
              className="bg-slate-800 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-700 focus:border-blue-500 focus:outline-none"
            >
              {forkNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Type</span>
            <select
              value={typeName}
              onChange={(e) => onTypeChange(e.target.value)}
              className="bg-slate-800 text-slate-200 text-sm rounded px-3 py-1.5 border border-slate-700 focus:border-blue-500 focus:outline-none"
            >
              {types.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
