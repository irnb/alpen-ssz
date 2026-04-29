// Smoke test: round-trip encode/decode for a few of the generated types.
// Run from alpen-ssz repo root: `node tools/smoke-test.mjs`.

import { Buffer } from "node:buffer";
globalThis.Buffer = Buffer;

const { modules } = await import("../src/generated/alpen-types.ts").catch(async () => {
  // If running before vite/tsx pipeline available, fall back to compiled output.
  throw new Error(
    "Run this with `npx tsx tools/smoke-test.mjs` so .ts imports resolve."
  );
});

const failures = [];
const successes = [];

for (const [moduleName, types] of Object.entries(modules)) {
  for (const [typeName, type] of Object.entries(types)) {
    try {
      const def = type.defaultValue();
      const bytes = type.serialize(def);
      const root = type.hashTreeRoot(def);
      const decoded = type.deserialize(bytes);
      const reBytes = type.serialize(decoded);
      if (Buffer.from(bytes).toString("hex") !== Buffer.from(reBytes).toString("hex")) {
        failures.push(`${moduleName}/${typeName}: round-trip byte mismatch`);
        continue;
      }
      if (root.length !== 32) {
        failures.push(`${moduleName}/${typeName}: root length=${root.length}`);
        continue;
      }
      successes.push(`${moduleName}/${typeName}`);
    } catch (e) {
      failures.push(`${moduleName}/${typeName}: ${e.message}`);
    }
  }
}

console.log(`PASS: ${successes.length}`);
console.log(`FAIL: ${failures.length}`);
for (const f of failures) console.log("  - " + f);
if (failures.length > 0) process.exit(1);
