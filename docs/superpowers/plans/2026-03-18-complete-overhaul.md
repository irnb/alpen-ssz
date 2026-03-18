# simpleserialize.com Complete Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild simpleserialize.com as a modern, reactive SSZ developer workbench with Vite, React 19, Tailwind CSS 4, and an interactive structure view.

**Architecture:** Single-page app with lifted state in app.tsx. Input panel (left) and output+structure panels (right) in a side-by-side layout. Web worker via Comlink handles all SSZ operations. Dark theme, live processing with debounced updates.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS 4, Comlink, sonner, js-yaml, @chainsafe/ssz, @lodestar/types

**Spec:** `docs/superpowers/specs/2026-03-18-complete-overhaul-design.md`

---

## File Structure

```
index.html                              # Vite HTML entry (project root)
vite.config.ts                          # Vite configuration
tsconfig.json                           # Updated TypeScript config for Vite
biome.jsonc                             # Updated to include .ts files
package.json                            # New dependencies

src/
├── vite-env.d.ts                       # Vite type declarations (import.meta.url, etc.)
├── main.tsx                            # Entry: createRoot + render App
├── index.css                           # Tailwind directives + custom CSS vars
├── app.tsx                             # Root layout, all lifted state, orchestration
├── components/
│   ├── header.tsx                      # Title, spec badge, fork selector, type selector
│   ├── footer.tsx                      # Credits, versions, GitHub link
│   ├── input-panel.tsx                 # Format tabs, textarea, upload, default value
│   ├── output-panel.tsx                # Mode tabs, output display, copy, download
│   ├── format-tabs.tsx                 # Reusable tab bar
│   ├── structure-view/
│   │   ├── structure-view.tsx          # Tree container, builds tree from type+value
│   │   ├── tree-node.tsx               # Recursive collapsible node renderer
│   │   └── utils.ts                    # Type introspection, color mapping, generalized index
│   └── ui/
│       ├── copy-button.tsx             # Clipboard copy with toast feedback
│       └── file-upload.tsx             # Mode-aware file upload
├── hooks/
│   ├── use-ssz.ts                      # Orchestrates worker calls, manages result state
│   ├── use-worker.ts                   # Comlink worker lifecycle (init/terminate)
│   └── use-debounce.ts                 # Debounced value hook
├── workers/
│   └── ssz-worker.ts                   # Comlink-exposed: serialize, deserialize, defaultValue
└── lib/
    ├── types.ts                        # Fork registry, patchSszTypes, typeNames()
    ├── formats.ts                      # Input/output format parse/dump
    └── yaml.ts                         # js-yaml wrapper (dump/load)
```

---

## Task 1: Scaffold Vite + React 19 + Tailwind CSS 4

**Files:**
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Create: `src/app.tsx` (minimal shell)
- Modify: `package.json` (complete rewrite)
- Modify: `tsconfig.json` (update for Vite)
- Modify: `biome.jsonc` (update file includes)
- Delete: `webpack.config.js`, `.babelrc`, `.prettierrc.js`, `src/index.tsx`, `src/index.html`, `src/styles.scss`, `src/App.tsx`

- [ ] **Step 1: Delete old build config and entry files**

```bash
rm -f webpack.config.js .babelrc .prettierrc.js src/index.tsx src/index.html src/styles.scss src/App.tsx yarn.lock
```

- [ ] **Step 2: Write new package.json**

Replace the entire package.json with new dependencies. Keep `@chainsafe/ssz`, `@lodestar/types`, `js-yaml`. Add `react@^19`, `react-dom@^19`, `comlink`, `sonner`. Add dev deps: `vite`, `@vitejs/plugin-react`, `tailwindcss@^4`, `@tailwindcss/vite`, `typescript`, `@types/react@^19`, `@types/react-dom@^19`, `@biomejs/biome`, `@chainsafe/biomejs-config`. Remove everything else.

```json
{
  "private": true,
  "name": "simpleserialize.com",
  "version": "1.0.0",
  "type": "module",
  "repository": "https://github.com/chainsafe/simpleserialize.com",
  "author": "Chainsafe Systems",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "check-types": "tsc",
    "lint": "biome check",
    "lint:fix": "biome check --write"
  },
  "dependencies": {
    "@chainsafe/ssz": "^1.2.1",
    "@lodestar/types": "^1.34.0",
    "comlink": "^4.4.2",
    "js-yaml": "^4.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "sonner": "^2.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@chainsafe/biomejs-config": "^0.1.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/js-yaml": "^4.0.9",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.8.3",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

- [ ] **Step 3: Write vite.config.ts**

```typescript
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
});
```

- [ ] **Step 4: Write index.html at project root**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SSZ Playground | Chainsafe Systems</title>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write src/index.css**

```css
@import "tailwindcss";

@theme {
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;

  --color-ssz-uint: #60a5fa;
  --color-ssz-bytes: #34d399;
  --color-ssz-container: #a78bfa;
  --color-ssz-list: #fb923c;
  --color-ssz-boolean: #94a3b8;
}
```

- [ ] **Step 6: Write src/main.tsx**

```tsx
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster theme="dark" position="bottom-right" />
  </>
);
```

- [ ] **Step 7: Write src/app.tsx (minimal shell)**

Minimal app that renders "SSZ Playground" in a dark page to verify the setup works.

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-mono text-white">SSZ Playground</h1>
    </div>
  );
}
```

- [ ] **Step 8: Update tsconfig.json for Vite**

```json
{
  "include": ["src"],
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 9: Write src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 10: Update biome.jsonc — include .ts and .tsx files**

Update the `files.include` to `["src/**/*.ts", "src/**/*.tsx"]` so it lints all source files, not just .tsx.

- [ ] **Step 11: Delete node_modules and reinstall**

```bash
rm -rf node_modules dist package-lock.json
npm install
```

- [ ] **Step 12: Verify dev server starts**

```bash
npx vite --host 0.0.0.0
```

Expected: Dev server starts on localhost:5173, page shows "SSZ Playground" in white on dark background.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React 19 + Tailwind CSS 4"
```

---

## Task 2: Port Core Library Modules

**Files:**
- Create: `src/lib/types.ts` (from `src/util/types.ts`)
- Create: `src/lib/yaml.ts` (from `src/util/yaml/index.ts`)
- Create: `src/lib/formats.ts` (from `src/util/input_types.ts` + `src/util/output_types.ts`)
- Delete: `src/util/` (entire directory)
- Delete: `src/types/` (entire directory)
- Delete: `src/components/worker/` (entire directory)
- Delete: `src/components/TreeView.tsx`, `src/components/ForkMe.tsx`
- Delete: `src/components/Tabs.tsx`, `src/components/Serialize.tsx`
- Delete: `src/components/Input.tsx`, `src/components/Output.tsx`
- Delete: `src/components/Header.tsx`, `src/components/Footer.tsx`
- Delete: `src/components/display/NamedOutput.tsx`, `src/components/display/ErrorBox.tsx`

- [ ] **Step 1: Write src/lib/types.ts**

Port from `src/util/types.ts`. Keep `patchSszTypes` and `replaceUintTypeWithUintBigintType` exactly as-is. Drop `sszTypesFor` and `gloas` from the destructuring. Keep the fork accumulation pattern.

```typescript
import {
  ContainerType,
  ListBasicType,
  ListCompositeType,
  type Type,
  UintBigintType,
  UintNumberType,
  VectorBasicType,
  VectorCompositeType,
} from "@chainsafe/ssz";
import { ssz } from "@lodestar/types";

let {
  phase0,
  altair,
  bellatrix,
  capella,
  deneb,
  electra,
  fulu,
  // intentionally dropped: sszTypesFor, gloas — not used by the app
  ...primitive
} = ssz;

phase0 = patchSszTypes(phase0);
altair = patchSszTypes(altair);
bellatrix = patchSszTypes(bellatrix);
capella = patchSszTypes(capella);
deneb = patchSszTypes(deneb);
electra = patchSszTypes(electra);
fulu = patchSszTypes(fulu);
primitive = patchSszTypes(primitive);

export const forks = {
  phase0: { ...phase0, ...primitive },
  altair: { ...phase0, ...altair, ...primitive },
  bellatrix: { ...phase0, ...altair, ...bellatrix, ...primitive },
  capella: { ...phase0, ...altair, ...bellatrix, ...capella, ...primitive },
  deneb: { ...phase0, ...altair, ...bellatrix, ...capella, ...deneb, ...primitive },
  electra: { ...phase0, ...altair, ...bellatrix, ...capella, ...deneb, ...electra, ...primitive },
  fulu: { ...phase0, ...altair, ...bellatrix, ...capella, ...deneb, ...electra, ...fulu, ...primitive },
} as Record<string, Record<string, Type<unknown>>>;

export type ForkName = keyof typeof forks;

export const forkNames = Object.keys(forks);

export function typeNames(types: Record<string, Type<unknown>>): string[] {
  return Object.keys(types).sort();
}

/**
 * Patch SSZ types to support the full uint64 range on the website.
 * Recursively replaces all 8-byte UintNumberType with UintBigintType.
 */
function patchSszTypes<T extends Record<keyof T, Type<unknown>>>(sszTypes: T): T {
  const types = { ...sszTypes };
  for (const key of Object.keys(types) as (keyof typeof types)[]) {
    types[key] = replaceUintTypeWithUintBigintType(types[key]);
  }
  return types;
}

function replaceUintTypeWithUintBigintType<T extends Type<unknown>>(type: T): T {
  if (type instanceof UintNumberType && type.byteLength === 8) {
    return new UintBigintType(type.byteLength) as unknown as T;
  }
  if (type instanceof ContainerType) {
    const fields = { ...type.fields };
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      fields[key] = replaceUintTypeWithUintBigintType(fields[key]);
    }
    return new ContainerType(fields, type.opts) as unknown as T;
  }
  if (type instanceof ListBasicType) {
    return new ListBasicType(replaceUintTypeWithUintBigintType(type.elementType), type.limit) as unknown as T;
  }
  if (type instanceof VectorBasicType) {
    return new VectorBasicType(replaceUintTypeWithUintBigintType(type.elementType), type.length) as unknown as T;
  }
  if (type instanceof ListCompositeType) {
    return new ListCompositeType(replaceUintTypeWithUintBigintType(type.elementType), type.limit) as unknown as T;
  }
  if (type instanceof VectorCompositeType) {
    return new VectorCompositeType(replaceUintTypeWithUintBigintType(type.elementType), type.length) as unknown as T;
  }
  return type;
}
```

- [ ] **Step 2: Write src/lib/yaml.ts**

Simple js-yaml wrapper. BigInt values need to be converted to strings before dumping since js-yaml's default schema doesn't handle BigInt.

```typescript
import yaml from "js-yaml";

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function dumpYaml(input: unknown): string {
  return yaml.dump(JSON.parse(JSON.stringify(input, bigintReplacer)));
}

export function parseYaml(input: string): unknown {
  return yaml.load(input);
}
```

- [ ] **Step 3: Write src/lib/formats.ts**

Consolidates input_types.ts and output_types.ts. Preserves the parse/dump interfaces.

```typescript
import { type Type, fromHexString, toHexString } from "@chainsafe/ssz";
import { dumpYaml, parseYaml } from "./yaml";

// --- Input formats (for parsing user input into SSZ values) ---

type InputFormat = {
  parse: <T>(raw: string, type: Type<T>) => T;
  dump: <T>(value: unknown, type: Type<T>) => string;
};

export const inputFormats: Record<string, InputFormat> = {
  yaml: {
    parse: (raw, type) => type.fromJson(parseYaml(raw)),
    dump: (value, type) =>
      dumpYaml(type.toJson(typeof value === "number" ? value.toString() : value)),
  },
  json: {
    parse: (raw, type) => type.fromJson(JSON.parse(raw)),
    dump: (value, type) => JSON.stringify(type.toJson(value), null, 2),
  },
  hex: {
    parse: (raw, type) => type.deserialize(fromHexString(raw)),
    dump: (value, type) => toHexString(type.serialize(value as never)),
  },
};

// --- Output formats (for displaying results) ---

function toBase64(data: Uint8Array): string {
  const binstr = Array.from(data, (ch) => String.fromCharCode(ch)).join("");
  return btoa(binstr);
}

type SerializeOutputFormat = {
  dump: (value: Uint8Array) => string;
};

export const serializeOutputFormats: Record<string, SerializeOutputFormat> = {
  hex: { dump: (value) => toHexString(value) },
  base64: { dump: (value) => toBase64(value) },
};

type DeserializeOutputFormat = {
  dump: <T>(value: unknown, type: Type<T>) => string;
};

export const deserializeOutputFormats: Record<string, DeserializeOutputFormat> = {
  yaml: {
    dump: (value, type) =>
      dumpYaml(type.toJson(typeof value === "number" ? value.toString() : value)),
  },
  json: {
    dump: (value, type) => JSON.stringify(type.toJson(value), null, 2),
  },
};

export const serializeInputFormatNames = ["yaml", "json", "hex"] as const;
export const deserializeInputFormatNames = ["hex"] as const;
export const serializeOutputFormatNames = ["hex", "base64"] as const;
export const deserializeOutputFormatNames = ["yaml", "json"] as const;
```

- [ ] **Step 4: Delete all old source files**

```bash
rm -rf src/util src/types src/components
```

- [ ] **Step 5: Verify type checking passes**

```bash
npx tsc
```

Expected: No errors (the lib modules should compile cleanly).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: port core library modules (types, formats, yaml)"
```

---

## Task 3: Web Worker with Comlink

**Files:**
- Create: `src/workers/ssz-worker.ts`
- Create: `src/hooks/use-worker.ts`

- [ ] **Step 1: Write src/workers/ssz-worker.ts**

Comlink-exposed worker with serialize, deserialize, and defaultValue methods.

```typescript
import { type Type, fromHexString } from "@chainsafe/ssz";
import * as Comlink from "comlink";
import { inputFormats } from "../lib/formats";
import { forks } from "../lib/types";

function getType(typeName: string, forkName: string): Type<unknown> {
  return forks[forkName][typeName];
}

const worker = {
  serialize(
    typeName: string,
    forkName: string,
    input: string,
    inputFormat: string,
  ) {
    const type = getType(typeName, forkName);
    const parsed = inputFormats[inputFormat].parse(input, type);
    const serialized = type.serialize(parsed);
    const hashTreeRoot = type.hashTreeRoot(parsed);
    return Comlink.transfer(
      { serialized, hashTreeRoot },
      [serialized.buffer, hashTreeRoot.buffer],
    );
  },

  deserialize(
    typeName: string,
    forkName: string,
    hexData: string,
  ): { deserialized: unknown } {
    const type = getType(typeName, forkName);
    const bytes = fromHexString(hexData);
    const deserialized = type.deserialize(bytes);
    return { deserialized };
  },

  defaultValue(
    typeName: string,
    forkName: string,
  ): { value: unknown } {
    const type = getType(typeName, forkName);
    const value = type.defaultValue();
    return { value };
  },
};

export type SszWorkerApi = typeof worker;

Comlink.expose(worker);
```

- [ ] **Step 2: Write src/hooks/use-worker.ts**

Hook that creates the worker on mount, wraps it with Comlink, and terminates on unmount.

```typescript
import * as Comlink from "comlink";
import { useEffect, useRef } from "react";
import type { SszWorkerApi } from "../workers/ssz-worker";

export function useWorker() {
  const workerRef = useRef<Comlink.Remote<SszWorkerApi> | null>(null);
  const rawWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const raw = new Worker(
      new URL("../workers/ssz-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = Comlink.wrap<SszWorkerApi>(raw);
    rawWorkerRef.current = raw;

    return () => {
      raw.terminate();
      workerRef.current = null;
      rawWorkerRef.current = null;
    };
  }, []);

  return workerRef;
}
```

- [ ] **Step 3: Verify build works**

```bash
npx vite build
```

Expected: Build succeeds. Worker is bundled separately by Vite.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add SSZ web worker with Comlink"
```

---

## Task 4: Hooks — useDebounce and useSsz

**Files:**
- Create: `src/hooks/use-debounce.ts`
- Create: `src/hooks/use-ssz.ts`

- [ ] **Step 1: Write src/hooks/use-debounce.ts**

```typescript
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

- [ ] **Step 2: Write src/hooks/use-ssz.ts**

Central hook that takes all the state (mode, fork, type, input, format) and orchestrates worker calls. Returns the result state.

```typescript
import type * as Comlink from "comlink";
import { useCallback, useEffect, useState } from "react";
import type { SszWorkerApi } from "../workers/ssz-worker";
import { useDebounce } from "./use-debounce";

type SszResult = {
  serialized: Uint8Array | null;
  hashTreeRoot: Uint8Array | null;
  deserialized: unknown | null;
  error: string | null;
  loading: boolean;
};

export function useSsz(
  worker: Comlink.Remote<SszWorkerApi> | null,
  mode: "serialize" | "deserialize",
  forkName: string,
  typeName: string,
  input: string,
  inputFormat: string,
): SszResult {
  const [result, setResult] = useState<SszResult>({
    serialized: null,
    hashTreeRoot: null,
    deserialized: null,
    error: null,
    loading: false,
  });

  const debouncedInput = useDebounce(input, 300);

  useEffect(() => {
    if (!worker || !debouncedInput.trim() || !typeName || !forkName) {
      return;
    }

    let cancelled = false;
    setResult((prev) => ({ ...prev, loading: true, error: null }));

    const run = async () => {
      try {
        if (mode === "serialize") {
          const { serialized, hashTreeRoot } = await worker.serialize(
            typeName,
            forkName,
            debouncedInput,
            inputFormat,
          );
          if (!cancelled) {
            setResult({
              serialized,
              hashTreeRoot,
              deserialized: null,
              error: null,
              loading: false,
            });
          }
        } else {
          const { deserialized } = await worker.deserialize(
            typeName,
            forkName,
            debouncedInput,
          );
          if (!cancelled) {
            setResult({
              serialized: null,
              hashTreeRoot: null,
              deserialized,
              error: null,
              loading: false,
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setResult({
            serialized: null,
            hashTreeRoot: null,
            deserialized: null,
            error: e instanceof Error ? e.message : String(e),
            loading: false,
          });
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [worker, mode, forkName, typeName, debouncedInput, inputFormat]);

  return result;
}
```

- [ ] **Step 3: Verify type checking**

```bash
npx tsc
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add useDebounce and useSsz hooks"
```

---

## Task 5: UI Components — Header and Footer

**Files:**
- Create: `src/components/header.tsx`
- Create: `src/components/footer.tsx`

- [ ] **Step 1: Write src/components/header.tsx**

Header with title, spec version badge, fork selector, and type selector. Fork and type are controlled props.

```tsx
import { type ForkName, forkNames, forks, typeNames } from "../lib/types";

const SPEC_VERSION = "1.6.0";

type HeaderProps = {
  forkName: string;
  typeName: string;
  onForkChange: (fork: ForkName) => void;
  onTypeChange: (type: string) => void;
};

export function Header({ forkName, typeName, onForkChange, onTypeChange }: HeaderProps) {
  const types = typeNames(forks[forkName]);

  return (
    <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-mono text-white tracking-tight">
            SSZ Playground
          </h1>
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
                <option key={name} value={name}>{name}</option>
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
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Write src/components/footer.tsx**

```tsx
// Only import the specific fields we need to avoid bundling full package.json
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
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add header and footer components"
```

---

## Task 6: UI Components — FormatTabs and small UI pieces

**Files:**
- Create: `src/components/format-tabs.tsx`
- Create: `src/components/ui/copy-button.tsx`
- Create: `src/components/ui/file-upload.tsx`

- [ ] **Step 1: Write src/components/format-tabs.tsx**

Reusable tab bar component.

```tsx
type FormatTabsProps = {
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
};

export function FormatTabs({ options, selected, onChange }: FormatTabsProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
            selected === opt
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write src/components/ui/copy-button.tsx**

```tsx
import { toast } from "sonner";

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Write src/components/ui/file-upload.tsx**

Mode-aware file upload. In serialize mode, reads as text. In deserialize mode, reads as binary and converts to hex.

```tsx
import { toHexString } from "@chainsafe/ssz";
import { useRef } from "react";

type FileUploadProps = {
  serializeMode: boolean;
  onLoad: (content: string) => void;
};

export function FileUpload({ serializeMode, onLoad }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        onLoad(toHexString(new Uint8Array(reader.result)));
      } else if (typeof reader.result === "string") {
        onLoad(reader.result);
      }
    };

    if (serializeMode) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    // Reset input so the same file can be uploaded again
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <label className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer transition-colors">
      Upload
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={serializeMode ? ".yaml,.yml,.json" : ".ssz"}
        onChange={handleChange}
      />
    </label>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add format tabs, copy button, file upload components"
```

---

## Task 7: Input Panel

**Files:**
- Create: `src/components/input-panel.tsx`

- [ ] **Step 1: Write src/components/input-panel.tsx**

The input panel with format tabs, textarea, and action bar.

```tsx
import { serializeInputFormatNames, deserializeInputFormatNames } from "../lib/formats";
import { FormatTabs } from "./format-tabs";
import { FileUpload } from "./ui/file-upload";

type InputPanelProps = {
  serializeMode: boolean;
  input: string;
  inputFormat: string;
  onInputChange: (value: string) => void;
  onInputFormatChange: (format: string) => void;
  onGenerateDefault: () => void;
  loading: boolean;
};

export function InputPanel({
  serializeMode,
  input,
  inputFormat,
  onInputChange,
  onInputFormatChange,
  onGenerateDefault,
  loading,
}: InputPanelProps) {
  const formatNames = serializeMode ? serializeInputFormatNames : deserializeInputFormatNames;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Input</h2>
        <FormatTabs
          options={formatNames}
          selected={inputFormat}
          onChange={onInputFormatChange}
        />
      </div>

      <textarea
        className="flex-1 min-h-[300px] bg-slate-900 text-slate-200 font-mono text-sm rounded-lg border border-slate-700 p-4 resize-none focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={serializeMode ? "Enter YAML, JSON, or hex data..." : "Enter hex-encoded SSZ bytes (0x...)"}
        spellCheck={false}
      />

      <div className="flex items-center gap-2 mt-3">
        <FileUpload serializeMode={serializeMode} onLoad={onInputChange} />
        <button
          onClick={onGenerateDefault}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-mono rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "Default Value"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add input panel component"
```

---

## Task 8: Output Panel

**Files:**
- Create: `src/components/output-panel.tsx`

- [ ] **Step 1: Write src/components/output-panel.tsx**

Output panel with mode tabs, format tabs, result display, and actions.

```tsx
import { toHexString } from "@chainsafe/ssz";
import type { Type } from "@chainsafe/ssz";
import {
  deserializeOutputFormatNames,
  deserializeOutputFormats,
  serializeOutputFormatNames,
  serializeOutputFormats,
} from "../lib/formats";
import { FormatTabs } from "./format-tabs";
import { CopyButton } from "./ui/copy-button";

type OutputPanelProps = {
  serializeMode: boolean;
  onModeChange: (serialize: boolean) => void;
  serialized: Uint8Array | null;
  hashTreeRoot: Uint8Array | null;
  deserialized: unknown | null;
  sszType: Type<unknown> | null;
  typeName: string;
  error: string | null;
  loading: boolean;
  outputFormat: string;
  onOutputFormatChange: (format: string) => void;
};

function downloadBlob(data: Uint8Array | string, filename: string) {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function OutputPanel({
  serializeMode,
  onModeChange,
  serialized,
  hashTreeRoot,
  deserialized,
  sszType,
  typeName,
  error,
  loading,
  outputFormat,
  onOutputFormatChange,
}: OutputPanelProps) {
  const formatNames = serializeMode ? serializeOutputFormatNames : deserializeOutputFormatNames;

  let outputText = "";
  let hashTreeRootText = "";

  if (serializeMode && serialized) {
    const fmt = serializeOutputFormats[outputFormat];
    if (fmt) {
      outputText = fmt.dump(serialized);
      // Hash tree root always displayed as hex regardless of output format
      hashTreeRootText = hashTreeRoot ? serializeOutputFormats.hex.dump(hashTreeRoot) : "";
    }
  } else if (!serializeMode && deserialized != null && sszType) {
    const fmt = deserializeOutputFormats[outputFormat];
    if (fmt) {
      outputText = fmt.dump(deserialized, sszType);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Mode tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => onModeChange(true)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              serializeMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Serialize
          </button>
          <button
            onClick={() => onModeChange(false)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              !serializeMode ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Deserialize
          </button>
        </div>
        <FormatTabs
          options={formatNames}
          selected={outputFormat}
          onChange={onOutputFormatChange}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Hash tree root (serialize mode only) */}
      {serializeMode && hashTreeRootText && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Hash Tree Root</span>
            <CopyButton text={hashTreeRootText} />
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-3 font-mono text-sm text-slate-300 break-all">
            {hashTreeRootText}
          </div>
        </div>
      )}

      {/* Main output */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider">
          {serializeMode ? "Serialized" : "Deserialized"}
        </span>
        <div className="flex gap-2">
          <CopyButton text={outputText} />
          <button
            onClick={() => {
              if (serializeMode && serialized) {
                downloadBlob(serialized, `${typeName}.ssz`);
              } else if (outputText) {
                downloadBlob(outputText, `${typeName}.${outputFormat}`);
              }
            }}
            disabled={!outputText}
            className="px-3 py-1.5 text-xs font-mono rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Download
          </button>
        </div>
      </div>
      <textarea
        readOnly
        value={loading ? "Processing..." : outputText}
        className="min-h-[200px] bg-slate-900 text-slate-300 font-mono text-sm rounded-lg border border-slate-700 p-4 resize-none focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add output panel component"
```

---

## Task 9: Structure View

**Files:**
- Create: `src/components/structure-view/utils.ts`
- Create: `src/components/structure-view/tree-node.tsx`
- Create: `src/components/structure-view/structure-view.tsx`

- [ ] **Step 1: Write src/components/structure-view/utils.ts**

Type introspection utilities using the modern @chainsafe/ssz API.

```typescript
import {
  BitListType,
  BitVectorType,
  BooleanType,
  ByteListType,
  ByteVectorType,
  ContainerType,
  ListBasicType,
  ListCompositeType,
  type Type,
  UintBigintType,
  UintNumberType,
  UnionType,
  VectorBasicType,
  VectorCompositeType,
} from "@chainsafe/ssz";

export type SszCategory = "uint" | "bytes" | "container" | "list" | "boolean" | "unknown";

export type TreeNodeData = {
  key: string;
  typeName: string;
  category: SszCategory;
  value: string | null;
  children: TreeNodeData[] | null;
  gindex: string;
};

export function getCategory(type: Type<unknown>): SszCategory {
  if (type instanceof UintNumberType || type instanceof UintBigintType) return "uint";
  if (type instanceof ByteVectorType || type instanceof ByteListType) return "bytes";
  if (type instanceof BooleanType || type instanceof BitListType || type instanceof BitVectorType) return "boolean";
  if (type instanceof ContainerType) return "container";
  if (
    type instanceof ListBasicType ||
    type instanceof ListCompositeType ||
    type instanceof VectorBasicType ||
    type instanceof VectorCompositeType
  ) return "list";
  return "unknown";
}

export function getTypeName(type: Type<unknown>): string {
  if (type instanceof UintNumberType) return `uint${type.byteLength * 8}`;
  if (type instanceof UintBigintType) return `uint${type.byteLength * 8}`;
  if (type instanceof BooleanType) return "boolean";
  if (type instanceof ByteVectorType) return `ByteVector[${type.length}]`;
  if (type instanceof ByteListType) return `ByteList[${type.limit}]`;
  if (type instanceof BitListType) return `BitList[${type.limit}]`;
  if (type instanceof BitVectorType) return `BitVector[${type.length}]`;
  if (type instanceof ContainerType) return "Container";
  if (type instanceof ListBasicType) return `List[${type.limit}]`;
  if (type instanceof ListCompositeType) return `List[${type.limit}]`;
  if (type instanceof VectorBasicType) return `Vector[${type.length}]`;
  if (type instanceof VectorCompositeType) return `Vector[${type.length}]`;
  if (type instanceof UnionType) return "Union";
  return "unknown";
}

export function isLeafType(type: Type<unknown>): boolean {
  const cat = getCategory(type);
  return cat === "uint" || cat === "boolean" || cat === "bytes";
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  if (value instanceof Uint8Array) {
    if (value.length <= 32) {
      return `0x${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    }
    return `0x${Array.from(value.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("")}... (${value.length} bytes)`;
  }
  return String(value);
}

export function buildTree(
  type: Type<unknown>,
  data: unknown,
  key: string,
  gindex: string,
): TreeNodeData {
  const category = getCategory(type);
  const typeName = getTypeName(type);

  if (isLeafType(type)) {
    return {
      key,
      typeName,
      category,
      value: formatValue(data),
      children: null,
      gindex,
    };
  }

  if (type instanceof ContainerType) {
    const fields = type.fields as Record<string, Type<unknown>>;
    const fieldNames = Object.keys(fields);
    // SSZ containers use a power-of-2 binary tree
    const depth = Math.ceil(Math.log2(Math.max(fieldNames.length, 1)));
    const children = fieldNames.map((fieldName, i) => {
      const fieldGindex = (BigInt(gindex) * (2n ** BigInt(depth)) + BigInt(i)).toString();
      const fieldData = data && typeof data === "object" ? (data as Record<string, unknown>)[fieldName] : undefined;
      return buildTree(fields[fieldName], fieldData, fieldName, fieldGindex);
    });
    return { key, typeName, category, value: null, children, gindex };
  }

  if (
    type instanceof ListBasicType ||
    type instanceof ListCompositeType ||
    type instanceof VectorBasicType ||
    type instanceof VectorCompositeType
  ) {
    const elementType = type.elementType as Type<unknown>;
    const items = Array.isArray(data) ? data : [];
    // For lists/vectors, elements start at gindex * 2 (left child of mix_in_length node for lists)
    const baseGindex = BigInt(gindex) * 2n;
    const children = items.slice(0, 100).map((item, i) => {
      const elemGindex = (baseGindex + BigInt(i)).toString();
      return buildTree(elementType, item, `[${i}]`, elemGindex);
    });
    if (items.length > 100) {
      children.push({
        key: `... ${items.length - 100} more`,
        typeName: "",
        category: "unknown",
        value: null,
        children: null,
        gindex: "",
      });
    }
    return { key, typeName: `${typeName} (${items.length})`, category, value: null, children, gindex };
  }

  return { key, typeName, category, value: formatValue(data), children: null, gindex };
}

export const categoryColors: Record<SszCategory, string> = {
  uint: "text-[var(--color-ssz-uint)]",
  bytes: "text-[var(--color-ssz-bytes)]",
  container: "text-[var(--color-ssz-container)]",
  list: "text-[var(--color-ssz-list)]",
  boolean: "text-[var(--color-ssz-boolean)]",
  unknown: "text-slate-500",
};
```

- [ ] **Step 2: Write src/components/structure-view/tree-node.tsx**

Recursive collapsible tree node.

```tsx
import { useState } from "react";
import { type TreeNodeData, categoryColors } from "./utils";

type TreeNodeProps = {
  node: TreeNodeData;
  depth?: number;
};

export function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-slate-800 pl-3" : ""}>
      <div
        className="flex items-baseline gap-2 py-0.5 hover:bg-slate-800/50 rounded px-1 group cursor-default"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse arrow */}
        <span className="w-4 text-center text-slate-600 text-xs flex-shrink-0">
          {hasChildren ? (
            <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>
              &#9654;
            </span>
          ) : (
            <span className="text-slate-800">&middot;</span>
          )}
        </span>

        {/* Key name */}
        <span className="font-mono text-sm text-slate-300">{node.key}</span>

        {/* Type annotation */}
        <span className={`font-mono text-xs ${categoryColors[node.category]}`}>
          {node.typeName}
        </span>

        {/* Generalized index on hover */}
        {node.gindex && (
          <span className="font-mono text-xs text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
            gi:{node.gindex}
          </span>
        )}

        {/* Value (leaf nodes) */}
        {node.value != null && (
          <span className="font-mono text-xs text-slate-400 truncate max-w-[300px]">
            = {node.value}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.key}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write src/components/structure-view/structure-view.tsx**

Container that builds the tree from type + data and renders it.

```tsx
import type { Type } from "@chainsafe/ssz";
import { useMemo } from "react";
import { TreeNode } from "./tree-node";
import { buildTree } from "./utils";

type StructureViewProps = {
  sszType: Type<unknown> | null;
  data: unknown;
  typeName: string;
};

export function StructureView({ sszType, data, typeName }: StructureViewProps) {
  const tree = useMemo(() => {
    if (!sszType || data == null) return null;
    return buildTree(sszType, data, typeName, "1");
  }, [sszType, data, typeName]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-600 font-mono">
        Structure view will appear here
      </div>
    );
  }

  return (
    <div className="overflow-auto font-mono text-sm">
      <TreeNode node={tree} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add interactive SSZ structure view"
```

---

## Task 10: Wire Everything Together in App

**Files:**
- Modify: `src/app.tsx` (full rewrite from minimal shell)

- [ ] **Step 1: Write the full src/app.tsx**

This is the main orchestration component. Lifts all state, connects input/output panels, manages worker lifecycle.

```tsx
import type { Type } from "@chainsafe/ssz";
import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { InputPanel } from "./components/input-panel";
import { OutputPanel } from "./components/output-panel";
import { StructureView } from "./components/structure-view/structure-view";
import { inputFormats } from "./lib/formats";
import { type ForkName, forks, typeNames } from "./lib/types";
import { useSsz } from "./hooks/use-ssz";
import { useWorker } from "./hooks/use-worker";

const DEFAULT_FORK = "fulu";
const DEFAULT_TYPE = "BeaconBlock";

export default function App() {
  // Core state
  const [forkName, setForkName] = useState<string>(DEFAULT_FORK);
  const [typeName, setTypeName] = useState<string>(DEFAULT_TYPE);
  const [serializeMode, setSerializeMode] = useState(true);
  const [input, setInput] = useState("");
  const [inputFormat, setInputFormat] = useState("yaml");
  const [outputFormat, setOutputFormat] = useState("hex");
  const [parsedValue, setParsedValue] = useState<unknown>(null);

  // Worker
  const workerRef = useWorker();

  // SSZ processing
  const result = useSsz(
    workerRef.current,
    serializeMode ? "serialize" : "deserialize",
    forkName,
    typeName,
    input,
    inputFormat,
  );

  // Get current SSZ type
  const sszType: Type<unknown> | null = forks[forkName]?.[typeName] ?? null;

  // Generate default value when type/fork changes
  const generateDefault = useCallback(async () => {
    const worker = workerRef.current;
    if (!worker || !sszType) return;
    try {
      const { value } = await worker.defaultValue(typeName, forkName);
      const format = serializeMode ? inputFormat : "hex";
      const dumped = inputFormats[format].dump(value, sszType);
      setInput(dumped);
      setParsedValue(value);
    } catch {
      // Silently fail — worker may not be ready yet
    }
  }, [workerRef, typeName, forkName, sszType, serializeMode, inputFormat]);

  // Auto-generate default on initial load and type/fork change
  useEffect(() => {
    generateDefault();
  }, [generateDefault]);

  // When mode changes, adjust formats
  const handleModeChange = useCallback((serialize: boolean) => {
    setSerializeMode(serialize);
    if (serialize) {
      setInputFormat("yaml");
      setOutputFormat("hex");
    } else {
      setInputFormat("hex");
      setOutputFormat("yaml");
    }
  }, []);

  // Handle fork change — reset type if not available
  const handleForkChange = useCallback((newFork: ForkName) => {
    setForkName(newFork);
    const types = typeNames(forks[newFork]);
    if (!types.includes(typeName)) {
      setTypeName(DEFAULT_TYPE);
    }
  }, [typeName]);

  // Handle input format change — re-dump current value in new format
  const handleInputFormatChange = useCallback((format: string) => {
    if (parsedValue != null && sszType) {
      try {
        const dumped = inputFormats[format].dump(parsedValue, sszType);
        setInput(dumped);
      } catch {
        // Keep current input if conversion fails
      }
    }
    setInputFormat(format);
  }, [parsedValue, sszType]);

  // Track parsed value for format conversion and structure view
  useEffect(() => {
    if (serializeMode && input && sszType) {
      try {
        const parsed = inputFormats[inputFormat].parse(input, sszType);
        setParsedValue(parsed);
      } catch {
        // Don't update parsed value on invalid input
      }
    } else if (!serializeMode && result.deserialized != null) {
      setParsedValue(result.deserialized);
    }
  }, [serializeMode, input, inputFormat, sszType, result.deserialized]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header
        forkName={forkName}
        typeName={typeName}
        onForkChange={handleForkChange}
        onTypeChange={setTypeName}
      />

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        {/* Left: Input */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex-1">
            <InputPanel
              serializeMode={serializeMode}
              input={input}
              inputFormat={inputFormat}
              onInputChange={setInput}
              onInputFormatChange={handleInputFormatChange}
              onGenerateDefault={generateDefault}
              loading={result.loading}
            />
          </div>
        </div>

        {/* Right: Output + Structure */}
        <div className="lg:w-1/2 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
            <OutputPanel
              serializeMode={serializeMode}
              onModeChange={handleModeChange}
              serialized={result.serialized}
              hashTreeRoot={result.hashTreeRoot}
              deserialized={result.deserialized}
              sszType={sszType}
              typeName={typeName}
              error={result.error}
              loading={result.loading}
              outputFormat={outputFormat}
              onOutputFormatChange={setOutputFormat}
            />
          </div>
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex-1 min-h-[250px] overflow-auto">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Structure</h2>
            <StructureView
              sszType={sszType}
              data={parsedValue}
              typeName={typeName}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds and runs**

```bash
npx vite build
```

Expected: Build succeeds with no errors.

```bash
npx vite --host 0.0.0.0
```

Expected: App runs. Shows header with selectors, input panel on left, output + structure on right. Default value auto-populates. Live serialization works.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up complete app with all components"
```

---

## Task 11: Cleanup — Delete Old Files and Verify

**Files:**
- Delete: any remaining old files in `src/components/`, `src/util/`, `src/types/`

- [ ] **Step 1: Verify no old files remain**

```bash
find src -name "*.scss" -o -name "*.js" | head -20
ls src/util/ 2>/dev/null
ls src/types/ 2>/dev/null
ls src/components/worker/ 2>/dev/null
```

Expected: No old files. If any remain, delete them.

- [ ] **Step 2: Run lint**

```bash
npx biome check
```

Fix any issues that come up.

- [ ] **Step 3: Run type check**

```bash
npx tsc
```

Fix any type errors.

- [ ] **Step 4: Test production build**

```bash
npx vite build
```

Expected: Clean production build in `dist/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup old files, fix lint and type errors"
```

---

## Task 12: Update Dockerfile

**Files:**
- Modify: `simpleserialize.Dockerfile`

- [ ] **Step 1: Rewrite Dockerfile for npm + Vite**

```dockerfile
FROM node:lts AS build

WORKDIR /usr/src/app
COPY package.json package-lock.json ./

RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: update Dockerfile for npm + Vite build"
```

---

## Task 13: Final Smoke Test and Polish

- [ ] **Step 1: Start dev server and manually test all features**

Test checklist:
- Fork selector changes types list
- Type selector loads default value
- YAML/JSON/Hex input format tabs work in serialize mode
- Hex-only in deserialize mode
- Live serialization produces output
- Hash tree root displays correctly
- Output format switching (hex/base64 for serialize, yaml/json for deserialize)
- Copy button works
- Download button produces correct file
- File upload works in both modes
- Structure view renders tree for parsed data
- Structure view nodes expand/collapse
- Error messages display inline
- Mode switching (serialize/deserialize) works cleanly

- [ ] **Step 2: Fix any issues found during testing**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: polish and bug fixes from smoke testing"
```
