import {type Type, fromHexString, toHexString} from "@chainsafe/ssz";
import {dumpYaml, parseYaml} from "./yaml";

function toBase64(data: Uint8Array): string {
  const binstr = Array.from(data, (ch) => String.fromCharCode(ch)).join("");
  return btoa(binstr);
}

/**
 * Parse a strata-codec varint length prefix (big-endian, 1/2/4 byte forms):
 *   0bbbbbbb                              -> 1 byte, value 0..127
 *   10bbbbbb_bbbbbbbb                     -> 2 bytes, value 128..16383
 *   11bbbbbb_bbbbbbbb_bbbbbbbb_bbbbbbbb   -> 4 bytes, value 16384..0x3fffffff
 *
 * Used by CodecSsz<T> wrappers in strata-codec to encode `<varint length><SSZ T>`,
 * which is what's pushed to L1 envelopes after OP_FALSE OP_IF in checkpoint /
 * other protocol transactions.
 */
function readStrataVarint(bytes: Uint8Array): {length: number; headerSize: number} | null {
  if (bytes.length < 1) return null;
  const b0 = bytes[0];
  const tag = b0 >> 6;
  if (tag === 0 || tag === 1) {
    return {length: b0, headerSize: 1};
  }
  if (tag === 2) {
    if (bytes.length < 2) return null;
    return {length: ((b0 & 0x3f) << 8) | bytes[1], headerSize: 2};
  }
  // tag === 3
  if (bytes.length < 4) return null;
  const value =
    ((b0 & 0x3f) << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return {length: value >>> 0, headerSize: 4};
}

/** Strip a strata-codec CodecSsz length prefix and return the inner SSZ bytes. */
function stripStrataCodecPrefix(bytes: Uint8Array): Uint8Array {
  const v = readStrataVarint(bytes);
  if (v === null) {
    throw new Error("envelope: input too short to contain a varint length");
  }
  const expected = v.headerSize + v.length;
  if (expected !== bytes.length) {
    throw new Error(
      `envelope: varint says ${v.length} bytes after a ${v.headerSize}-byte header (total ${expected}), got ${bytes.length} bytes total`
    );
  }
  return bytes.subarray(v.headerSize);
}

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
  /**
   * Bytes posted on L1 inside a Bitcoin envelope (between OP_FALSE OP_IF and
   * OP_ENDIF) for a strata-codec `CodecSsz<T>` wrapper. The wire layout is
   * `<varint length><SSZ T>`; we strip the varint and decode the SSZ portion.
   */
  envelope: {
    parse: (raw, type) =>
      type.deserialize(stripStrataCodecPrefix(fromHexString(raw))),
    dump: (value, type) => {
      const ssz = type.serialize(value as never);
      // Re-emit `<varint length><ssz>` so a paste-and-dump round-trips.
      const lenHeader = encodeStrataVarint(ssz.length);
      const out = new Uint8Array(lenHeader.length + ssz.length);
      out.set(lenHeader, 0);
      out.set(ssz, lenHeader.length);
      return toHexString(out);
    },
  },
};

function encodeStrataVarint(value: number): Uint8Array {
  if (value < 0 || value > 0x3fffffff) {
    throw new Error(`envelope: length ${value} exceeds varint max`);
  }
  if (value < 128) return new Uint8Array([value]);
  if (value < 16384) {
    const v = value | 0x8000;
    return new Uint8Array([(v >> 8) & 0xff, v & 0xff]);
  }
  const v = value | 0xc0000000;
  return new Uint8Array([
    (v >>> 24) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 8) & 0xff,
    v & 0xff,
  ]);
}

// --- Output formats (for displaying results) ---

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
export const deserializeInputFormatNames = ["hex", "envelope"] as const;
export const serializeOutputFormatNames = ["hex", "base64"] as const;
export const deserializeOutputFormatNames = ["yaml", "json"] as const;
