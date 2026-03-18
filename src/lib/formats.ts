import {type Type, fromHexString, toHexString} from "@chainsafe/ssz";
import {dumpYaml, parseYaml} from "./yaml";

// --- Input formats (for parsing user input into SSZ values) ---

type InputFormat = {
  parse: <T>(raw: string, type: Type<T>) => T;
  dump: <T>(value: unknown, type: Type<T>) => string;
};

export const inputFormats: Record<string, InputFormat> = {
  yaml: {
    parse: (raw, type) => type.fromJson(parseYaml(raw)),
    dump: (value, type) => dumpYaml(type.toJson((typeof value === "number" ? value.toString() : value) as never)),
  },
  json: {
    parse: (raw, type) => type.fromJson(JSON.parse(raw)),
    dump: (value, type) => JSON.stringify(type.toJson(value as never), null, 2),
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
  hex: {dump: (value) => toHexString(value)},
  base64: {dump: (value) => toBase64(value)},
};

type DeserializeOutputFormat = {
  dump: <T>(value: unknown, type: Type<T>) => string;
};

export const deserializeOutputFormats: Record<string, DeserializeOutputFormat> = {
  yaml: {
    dump: (value, type) => dumpYaml(type.toJson((typeof value === "number" ? value.toString() : value) as never)),
  },
  json: {
    dump: (value, type) => JSON.stringify(type.toJson(value as never), null, 2),
  },
};

export const serializeInputFormatNames = ["yaml", "json", "hex"] as const;
export const deserializeInputFormatNames = ["hex"] as const;
export const serializeOutputFormatNames = ["hex", "base64"] as const;
export const deserializeOutputFormatNames = ["yaml", "json"] as const;
