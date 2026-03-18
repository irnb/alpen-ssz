# simpleserialize.com Complete Overhaul

## Summary

Modernize simpleserialize.com from a clunky form-based SSZ tool into a polished, reactive developer workbench. Replace the entire tech stack, redesign the UI, and add an interactive structure view for SSZ data visualization.

## Tech Stack

### Replacing
| Old | New | Why |
|-----|-----|-----|
| Webpack 5 + Babel + loaders | Vite | Zero-config, fast HMR, native ESM |
| React 17 (class components) | React 19 (hooks) | Modern patterns, smaller bundles |
| Bulma + SCSS | Tailwind CSS 4 | Utility-first, better custom design |
| `threads` library | `comlink` | Tiny, modern worker RPC |
| `react-alert` + `react-loading-overlay` + `react-spinners` | `sonner` | Single modern toast library |
| `eyzy-tree` | Custom tree component | Unused lib, need custom behavior |
| `file-saver` | Native blob download | No library needed |
| `bn.js`, `core-js` | Native BigInt, modern browser APIs | No polyfills needed |

### Keeping (updated to latest)
- `@chainsafe/ssz` — core SSZ library
- `@lodestar/types` — Ethereum consensus types
- `js-yaml` — YAML parsing (default schema only; custom int.js/schema.js are dead code and will be removed)
- `@biomejs/biome` + `@chainsafe/biomejs-config` — linting (already modern, keep as-is)
- TypeScript — latest version

## UI Design

### Layout
Side-by-side workbench: input panel (left), output + structure view (right).

### Header
- Title: "SSZ Playground"
- Fork selector and SSZ type selector always visible in header bar
- Consensus spec version badge (links to Ethereum spec)
- Clean, minimal

### Input Panel (left)
- Format tabs: YAML | JSON | Hex (in serialize mode); Hex only in deserialize mode (SSZ bytes input)
- Monospace textarea/code area for data entry
- Action bar: Upload file (reads as text in serialize mode, as binary→hex in deserialize mode), Generate default value
- Live processing — no submit button, debounced reactive updates

### Output Panel (right top)
- Mode tabs: Serialize | Deserialize (determines direction of processing)
- Format tabs for output: Hex | Base64 (serialize) or YAML | JSON (deserialize)
- HashTreeRoot displayed when serializing
- Action bar: Copy to clipboard, Download file
- Read-only monospace display

### Structure View (right bottom)
- Interactive collapsible tree built from SSZ type schema + actual parsed/deserialized values
- Built on the main thread from the type definition (walks `type.fields`, `type.elementType`, etc.) using the modern @chainsafe/ssz API (ContainerType, ListBasicType, etc.)
- Each node shows: field name, type annotation, current value
- Color-coded by SSZ type category:
  - Blue: uint types
  - Green: bytes/ByteVector/ByteList
  - Purple: containers
  - Orange: lists/vectors
  - Gray: boolean/bit types
- Click to expand/collapse containers and collections
- Generalized index shown on hover
- Subtree highlighting on node selection

### Visual Design
- Dark theme (slate-900/slate-950 background)
- Blue/cyan accent color for interactive elements
- Monospace font (JetBrains Mono or system monospace) for all data
- Sans-serif (Inter or system) for UI labels
- Clean panel borders with subtle separation
- Desktop-first, responsive down to tablet

## Architecture

```
src/
├── app.tsx                    # Root layout, lifted state
├── main.tsx                   # Entry point, render root
├── index.css                  # Tailwind directives
├── components/
│   ├── header.tsx             # Title + fork/type selectors
│   ├── footer.tsx             # Credits, versions, links
│   ├── input-panel.tsx        # Input editor + format tabs + actions
│   ├── output-panel.tsx       # Output display + format tabs + actions
│   ├── structure-view/
│   │   ├── structure-view.tsx # Tree container
│   │   ├── tree-node.tsx      # Recursive node renderer
│   │   └── utils.ts           # Node expansion, type color, generalized index
│   ├── format-tabs.tsx        # Reusable tab bar component
│   └── ui/
│       ├── copy-button.tsx    # Copy to clipboard with feedback
│       └── file-upload.tsx    # File upload handler
├── hooks/
│   ├── use-ssz.ts             # Orchestrates serialize/deserialize via worker
│   ├── use-worker.ts          # Comlink worker lifecycle
│   └── use-debounce.ts        # Debounced value for live processing
├── workers/
│   └── ssz-worker.ts          # Comlink-exposed: serialize, deserialize, randomValue
├── lib/
│   ├── types.ts               # Fork definitions, type registry, typeNames()
│   ├── formats.ts             # Input/output format parse/dump
│   └── yaml.ts                # js-yaml dump/load (default schema, no custom BigInt handling needed)
index.html                         # Vite HTML entry (project root, not src/)
```

### State Flow
1. User selects fork + SSZ type (header) → stored in app state
2. User enters data in input panel → debounced, sent to worker
3. Worker serializes/deserializes → returns result + parsed structure
4. Output panel displays formatted result
5. Structure view renders parsed type tree

### Worker Design
Single web worker exposed via Comlink with three methods:
- `serialize(typeName, forkName, input, inputFormat)` → `{ serialized: Uint8Array, hashTreeRoot: Uint8Array }`
- `deserialize(typeName, forkName, data: Uint8Array)` → `{ deserialized: unknown }` (input is raw SSZ bytes; caller converts hex string to Uint8Array before calling)
- `defaultValue(typeName, forkName)` → `{ value: unknown }` (returns `type.defaultValue()`, not random)

Data transfer: Comlink uses structured clone by default. BigInt values in deserialized objects are structured-cloneable, so they transfer correctly. Uint8Array results use Comlink's `transfer()` for zero-copy.

The worker imports `lib/types.ts` which includes the `patchSszTypes` function — this recursively replaces all 8-byte UintNumberType fields with UintBigintType to support full uint64 range. This patching is critical and must be preserved.

Worker instantiation uses Vite's native worker support: `new Worker(new URL('./workers/ssz-worker.ts', import.meta.url), { type: 'module' })`

### Error Handling
- Parse errors shown inline below input (not toast/alert)
- Worker errors shown inline in output panel
- Toast notifications only for user actions (copied, downloaded, etc.)

## What Gets Deleted
- All class components (rewritten as functional)
- webpack.config.js, .babelrc, .prettierrc.js
- All Bulma/SCSS files
- node_modules packages: threads, threads-webpack-plugin, workerize-loader, react-alert, react-alert-template-basic, react-loading-overlay, react-spinners, eyzy-tree, file-saver, bn.js, core-js, all webpack/babel dev deps
- TreeView.tsx (unused, replaced by structure-view)
- ForkMe.tsx (GitHub link moves to footer)

## Migration Notes
- `lib/types.ts` preserves fork/type registry logic from `util/types.ts`, including the critical `patchSszTypes` function that replaces UintNumberType(8) with UintBigintType. `sszTypesFor` and `gloas` from `@lodestar/types/ssz` are intentionally dropped — they are not used by the app.
- `lib/yaml.ts` is a thin wrapper around `js-yaml` using default schema. The custom `util/yaml/int.js` and `util/yaml/schema.js` are dead code (never imported) and will be deleted. BigInt values are converted to strings before YAML dumping.
- `lib/formats.ts` consolidates `util/input_types.ts` and `util/output_types.ts`
- Worker logic from `components/worker/` is simplified into `workers/ssz-worker.ts`
- GitHub repo link fixed to `https://github.com/chainsafe/simpleserialize.com` (was pointing to wrong monorepo path)

## Out of Scope
- URL state / deep linking (can be added later)
- Testing (separate effort after rewrite stabilizes)
- Mobile layout (desktop and tablet only)
