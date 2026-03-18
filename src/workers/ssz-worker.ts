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
