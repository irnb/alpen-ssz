// Buffer polyfill MUST be set before SSZ libs load (they use Buffer.allocUnsafe).
// Comlink is safe to import statically — it doesn't touch Buffer.
import {Buffer} from "buffer";
(globalThis as Record<string, unknown>).Buffer = Buffer;

import * as Comlink from "comlink";

// Lazy-load SSZ libraries via dynamic import so they resolve
// AFTER the Buffer polyfill assignment above has executed.
const libs = (async () => {
  const [{fromHexString}, {inputFormats}, {forks}] = await Promise.all([
    import("@chainsafe/ssz"),
    import("../lib/formats"),
    import("../lib/types"),
  ]);
  return {fromHexString, inputFormats, forks};
})();

type Type<T> = import("@chainsafe/ssz").Type<T>;

function getType(
  types: Record<string, Record<string, Type<unknown>>>,
  typeName: string,
  forkName: string
): Type<unknown> {
  return types[forkName][typeName];
}

// Methods are async — they await the libs promise (resolves once, then cached).
// Comlink transparently handles async return values.
const worker = {
  async serialize(typeName: string, forkName: string, input: string, inputFormat: string) {
    const {inputFormats, forks} = await libs;
    const type = getType(forks, typeName, forkName);
    const parsed = inputFormats[inputFormat].parse(input, type);
    const serialized = type.serialize(parsed);
    const hashTreeRoot = type.hashTreeRoot(parsed);
    return Comlink.transfer({serialized, hashTreeRoot}, [serialized.buffer, hashTreeRoot.buffer]);
  },

  async deserialize(typeName: string, forkName: string, data: string, inputFormat: string) {
    const {fromHexString, forks} = await libs;
    const type = getType(forks, typeName, forkName);
    let bytes: Uint8Array;
    if (inputFormat === "base64") {
      const binstr = atob(data);
      bytes = Uint8Array.from(binstr, (ch) => ch.charCodeAt(0));
    } else {
      bytes = fromHexString(data);
    }
    const deserialized = type.deserialize(bytes);
    return {deserialized};
  },

  async defaultValue(typeName: string, forkName: string) {
    const {forks} = await libs;
    const type = getType(forks, typeName, forkName);
    const value = type.defaultValue();
    return {value};
  },
};

export type SszWorkerApi = {
  serialize(
    typeName: string,
    forkName: string,
    input: string,
    inputFormat: string
  ): Promise<{serialized: Uint8Array; hashTreeRoot: Uint8Array}>;
  deserialize(typeName: string, forkName: string, data: string, inputFormat: string): Promise<{deserialized: unknown}>;
  defaultValue(typeName: string, forkName: string): Promise<{value: unknown}>;
};

// Expose synchronously — Comlink is statically imported so this runs immediately.
Comlink.expose(worker);
