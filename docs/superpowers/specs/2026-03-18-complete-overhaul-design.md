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
- `js-yaml` — YAML parsing
- TypeScript — latest version

## UI Design

### Layout
Side-by-side workbench: input panel (left), output + structure view (right).

### Header
- Title: "SSZ Playground"
- Fork selector and SSZ type selector always visible in header bar
- Clean, minimal

### Input Panel (left)
- Format tabs: YAML | JSON | Hex
- Monospace textarea/code area for data entry
- Action bar: Upload file, Generate random value
- Live processing — no submit button, debounced reactive updates

### Output Panel (right top)
- Mode tabs: Serialize | Deserialize (determines direction of processing)
- Format tabs for output: Hex | Base64 (serialize) or YAML | JSON (deserialize)
- HashTreeRoot displayed when serializing
- Action bar: Copy to clipboard, Download file
- Read-only monospace display

### Structure View (right bottom)
- Interactive collapsible tree of the SSZ type structure
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
├── index.html                 # Vite HTML
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
│   └── yaml.ts                # Custom YAML schema for BigInt etc.
└── index.css                  # Tailwind directives + minimal custom styles
```

### State Flow
1. User selects fork + SSZ type (header) → stored in app state
2. User enters data in input panel → debounced, sent to worker
3. Worker serializes/deserializes → returns result + parsed structure
4. Output panel displays formatted result
5. Structure view renders parsed type tree

### Worker Design
Single web worker exposed via Comlink with three methods:
- `serialize(typeName, forkName, input, inputFormat)` → `{ serialized, hashTreeRoot }`
- `deserialize(typeName, forkName, data)` → `{ deserialized }`
- `randomValue(typeName, forkName)` → `{ value }`

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
- The `lib/types.ts` module preserves the fork/type registry logic from `util/types.ts`
- The `lib/yaml.ts` module preserves custom YAML schema from `util/yaml/`
- The `lib/formats.ts` module consolidates `util/input_types.ts` and `util/output_types.ts`
- Worker logic from `components/worker/` is simplified into `workers/ssz-worker.ts`
