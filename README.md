# alpen-ssz

Internal dev/debug web tool for encoding and decoding Alpen Labs SSZ types.

Forked from [ChainSafe simpleserialize.com](https://github.com/ChainSafe/simpleserialize.com) (LGPL-3.0).
The frontend, structure view, builder form, YAML/hex/JSON tabs, and Web Worker
encoding pipeline are unchanged. The Ethereum type catalog has been replaced
with a generated TypeScript registry derived from Alpen's `.ssz` schema files
across the `alpen`, `asm`, and `strata-common` repos.

## Layout

```
schema-sources.toml             # default repo paths to scan
schema-sources.local.toml.example
tools/ssz-to-ts/                # Rust codegen — parses .ssz -> emits TS
src/generated/                  # GITIGNORED, regenerated on each dev/build
src/lib/types.ts                # imports from src/generated, applies uint64 patch
src/components/toolbar.tsx      # "Module" picker (was "Fork")
src/components/builder/field-input.tsx  # extended for Union/Optional/StableContainer/Profile
```

## Local setup

1. Clone the source repos as siblings of this one:

   ```
   <parent>/alpen
   <parent>/asm
   <parent>/strata-common
   <parent>/alpen-ssz   (this repo)
   ```

   If your checkout is named differently (e.g. `alpen-a`), copy
   `schema-sources.local.toml.example` to `schema-sources.local.toml` and
   override the paths there. The `.local.toml` file is gitignored.

2. Install JS deps and run the codegen + dev server:

   ```bash
   npm install
   npm run dev
   ```

   `npm run dev` runs `cargo run` under the hood (via the `predev` script) to
   regenerate `src/generated/` from the latest `.ssz` files, then starts Vite.
   Open <http://localhost:5173>.

3. To regenerate types without booting Vite:

   ```bash
   npm run codegen
   ```

## Deployment

### GitHub Pages — step by step

The repo ships with `.github/workflows/publish.yml` that clones the three
source repos, regenerates types via `cargo`, builds the Vite SPA, and
publishes `./dist` to GitHub Pages.

1. **Push this repo to GitHub.** Create a fresh repository on GitHub (e.g.
   `your-org/alpen-ssz`) and push the local `alpen-ssz` directory:
   ```bash
   cd alpen-ssz
   git init -b main
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-org/alpen-ssz.git
   git push -u origin main
   ```

2. **Enable GitHub Pages.** On GitHub, open the repo → **Settings → Pages**.
   Under **Build and deployment → Source**, pick **GitHub Actions**. Don't
   pick "Deploy from a branch" — the workflow uses the newer Actions deploy.

3. **Trigger the deploy.** Either push any commit to `main` / `master`, or
   run the workflow manually: **Actions → Deploy to GitHub Pages → Run
   workflow**. The source repos (`alpenlabs/alpen`, `alpenlabs/asm`,
   `alpenlabs/strata-common`) are public, so the default `GITHUB_TOKEN`
   reads them without any PAT setup.

4. **Find your URL.** When the workflow finishes, **Settings → Pages**
   shows the live URL — typically
   `https://your-org.github.io/alpen-ssz/`. The first deploy can take ~3
   minutes; subsequent deploys are faster thanks to the cargo cache.

### Custom domain

If you serve from a custom domain (or a Vercel/Netlify root path), the
default `BASE_PATH=/repo-name/` is wrong. Edit
`.github/workflows/publish.yml` and either remove the `BASE_PATH` env line
(serves from `/`) or set it to your subpath. For Pages with a custom
domain, also add a `CNAME` file under `public/`.

### Vercel / Netlify / other static hosts

The build is a plain Vite SPA; any static host works. Set the build
command to `npm run build` and publish `./dist`. If the site is served at
the domain root, leave `BASE_PATH` unset; otherwise set it to the path
prefix.

For hosts that don't provide Rust, generate the TypeScript locally first
(`npm run codegen`) and either:
- check `src/generated/` into the repo (drop it from `.gitignore`), or
- have CI install Rust + clone the source repos as in the GitHub Pages
  workflow.

## Source-repo settings (in the UI)

The toolbar's **Sources** button (top-right) lists every repo defined in
`schema-sources.toml`, with its URL and a checkbox per source. Unchecking
a source hides its modules from the **Module** dropdown but keeps the
types loaded — re-enabling is instant. Your selection persists in
`localStorage` (`alpen-ssz:disabled-sources`).

## Adding a new `.ssz` source directory

Edit `schema-sources.toml` and add the module path to the appropriate `[sources.X]` block:

```toml
[sources.alpen]
path = "../alpen"
modules = [
  "crates/acct-types/ssz",
  "crates/snark-acct-types/ssz",
  ...
]
```

If a file imports from a Rust crate not in our scan (e.g. a new `strata_*`
crate), add the crate to `[external_modules].names` and provide TypeScript
stubs for its types in `tools/ssz-to-ts/src/external_stubs.rs`.

## How it works

The Rust codegen tool (`tools/ssz-to-ts`) walks each module dir for `.ssz`
files, parses them via the `sizzle-parser` crate (the same parser used by
`ssz-gen` to compile Rust types), and emits TypeScript that constructs
`@chainsafe/ssz` `Type<unknown>` instances. The generated registry shape
mirrors upstream's `Record<fork, Record<typeName, Type>>`, so the existing
toolbar / builder / structure-view components work without further changes.

External crate references that don't have `.ssz` files (e.g. `strata_identifiers`,
`strata_btc_types`, `block_flags`) are resolved via hand-coded stubs in
`tools/ssz-to-ts/src/external_stubs.rs`. Cross-crate references (e.g.
`strata_acct_types.MsgPayload`) are auto-resolved by scanning the type
index for a matching class name.

## License

LGPL-3.0 (inherited from upstream simpleserialize.com).
