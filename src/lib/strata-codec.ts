// Pure-TS port of the strata_codec wire format and the OLDaPayloadV1 type tree
// used inside CheckpointSidecar.ol_state_diff. The bytes there are NOT SSZ —
// they are encoded with strata_codec (a separate framework). See alpen-a:
//   - crates/ol/da/src/types/payload.rs           (OLDaPayloadV1, StateDiff)
//   - crates/ol/da/src/types/{global,ledger,account,snark,inbox,encoding}.rs
//   - strata-common/crates/codec/src/{varint,varint_vec,types}.rs
//   - alpen-a/crates/da-framework/src/{compound,register,counter,linear_acc,varint64}.rs
//
// Manual port: if upstream Rust types add/reorder fields, update the schemas
// at the bottom of this file (search for "OL DA payload schemas").

// ── BufReader ──────────────────────────────────────────────────────────────

export class CodecError extends Error {
  constructor(
    msg: string,
    readonly offset?: number
  ) {
    super(offset != null ? `${msg} (at byte ${offset})` : msg);
    this.name = "CodecError";
  }
}

class BufReader {
  private offset = 0;
  constructor(private readonly buf: Uint8Array) {}

  pos(): number {
    return this.offset;
  }

  remaining(): number {
    return this.buf.length - this.offset;
  }

  isExhausted(): boolean {
    return this.offset === this.buf.length;
  }

  readArr(n: number): Uint8Array {
    if (this.offset + n > this.buf.length) {
      throw new CodecError(`unexpected end of buffer: need ${n} bytes`, this.offset);
    }
    const out = this.buf.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  readU8(): number {
    return this.readArr(1)[0];
  }

  readI8(): number {
    const v = this.readU8();
    return v >= 0x80 ? v - 0x100 : v;
  }

  readU16(): number {
    const a = this.readArr(2);
    return (a[0] << 8) | a[1];
  }

  readI16(): number {
    const v = this.readU16();
    return v >= 0x8000 ? v - 0x10000 : v;
  }

  readU32(): number {
    const a = this.readArr(4);
    // unsigned 32-bit: avoid sign-extension from bitwise ops
    return a[0] * 0x1000000 + ((a[1] << 16) | (a[2] << 8) | a[3]);
  }

  readI32(): number {
    const a = this.readArr(4);
    return (a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3] | 0;
  }

  readU64(): bigint {
    const a = this.readArr(8);
    let v = 0n;
    for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(a[i]);
    return v;
  }

  readI64(): bigint {
    const v = this.readU64();
    return v >= 1n << 63n ? v - (1n << 64n) : v;
  }

  readBool(): boolean {
    const b = this.readU8();
    if (b !== 0 && b !== 1) {
      throw new CodecError(`invalid bool byte 0x${b.toString(16)}`, this.offset - 1);
    }
    return b === 1;
  }

  // strata_codec::Varint — 1/2/4 byte BE int with top-two-bit width tag.
  readVarint(): number {
    const start = this.offset;
    const first = this.readU8();
    const tag = first >> 6;
    if (tag === 0 || tag === 1) return first;
    if (tag === 2) {
      const second = this.readU8();
      return ((first & 0x3f) << 8) | second;
    }
    // tag === 3: 4-byte form, top 6 bits in first byte
    const rest = this.readArr(3);
    const value = ((first & 0x3f) * 0x1000000) | (rest[0] << 16) | (rest[1] << 8) | rest[2];
    if (value > 0x3fffffff) {
      throw new CodecError("varint exceeds VARINT_MAX", start);
    }
    return value;
  }

  // da-framework UnsignedVarInt — LEB128, up to 10 bytes for u64.
  readUnsignedVarInt(): bigint {
    let value = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      const byte = this.readU8();
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7n;
    }
    throw new CodecError("unsigned varint64: too many bytes", this.offset - 10);
  }

  // da-framework SignedVarInt — first byte: [continuation][sign][6 data], rest LEB128.
  readSignedVarInt(): {positive: boolean; magnitude: bigint} {
    const first = this.readU8();
    const positive = (first & 0x40) === 0;
    let magnitude = BigInt(first & 0x3f);
    if ((first & 0x80) !== 0) {
      let shift = 6n;
      for (let i = 0; i < 10; i++) {
        const byte = this.readU8();
        magnitude |= BigInt(byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
          // zero magnitude normalizes to positive (matches Rust)
          return magnitude === 0n ? {positive: true, magnitude: 0n} : {positive, magnitude};
        }
        shift += 7n;
      }
      throw new CodecError("signed varint64: too many bytes", this.offset - 10);
    }
    return magnitude === 0n ? {positive: true, magnitude: 0n} : {positive, magnitude};
  }
}

// ── Decoder combinators ────────────────────────────────────────────────────

export type Decoder<T> = (r: BufReader) => T;

const u16: Decoder<number> = (r) => r.readU16();
const u32: Decoder<number> = (r) => r.readU32();

// strata_codec::U16LenBytes — u16 BE length + raw bytes.
const u16LenBytes: Decoder<Uint8Array> = (r) => {
  const len = r.readU16();
  return r.readArr(len);
};

// strata_codec::U16LenList<T>
function u16LenList<T>(item: Decoder<T>): Decoder<T[]> {
  return (r) => {
    const len = r.readU16();
    const out: T[] = [];
    for (let i = 0; i < len; i++) out.push(item(r));
    return out;
  };
}

// Codec for a #[derive(Codec)] struct: concat of fields in declaration order.
function struct<F extends Record<string, unknown>>(
  name: string,
  fields: {[K in keyof F]: Decoder<F[K]>}
): Decoder<{__struct: string} & F> {
  const keys = Object.keys(fields) as (keyof F)[];
  return (r) => {
    const out = {__struct: name} as {__struct: string} & F;
    for (const k of keys) {
      (out as Record<string, unknown>)[k as string] = fields[k](r);
    }
    return out;
  };
}

// ── Compound types (DA framework) ──────────────────────────────────────────
//
// A compound type starts with a bitmap (u8/u16/…). Each bit indicates whether
// the corresponding field was modified. Set fields are decoded via their
// `decode_set` impl in declaration order; cleared fields take their default.

type DaCompoundField<T> = {
  /** Field name in source order. */
  name: string;
  /** Decoder used when the bit is set. */
  decodeSet: Decoder<T>;
  /** Value used when the bit is unset. Should be a wrapper marking "default". */
  defaultValue: T;
};

function compoundU8<F extends Record<string, unknown>>(
  name: string,
  fields: ReadonlyArray<DaCompoundField<unknown>>
): Decoder<{__struct: string; __compound: true} & F> {
  return (r) => {
    if (fields.length > 8) throw new CodecError(`compound ${name}: >8 fields for u8 mask`);
    const mask = r.readU8();
    const out = {__struct: name, __compound: true} as {__struct: string; __compound: true} & F;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const set = (mask >> i) & 1;
      (out as Record<string, unknown>)[f.name] = set ? f.decodeSet(r) : f.defaultValue;
    }
    return out;
  };
}

// DaRegister<T>: when set, contains a single decoded T.
type Register<T> = {__register: true; set: boolean; value: T | null};

function register<T>(inner: Decoder<T>): DaCompoundField<Register<T>> {
  return {
    name: "", // filled in by caller
    decodeSet: (r) => ({__register: true, set: true, value: inner(r)}),
    defaultValue: {__register: true, set: false, value: null},
  };
}

// DaCounter<S>: when set, contains the increment value (S::Incr).
type Counter<T> = {__counter: true; changed: boolean; incr: T | null};

function counter<T>(incr: Decoder<T>): DaCompoundField<Counter<T>> {
  return {
    name: "",
    decodeSet: (r) => ({__counter: true, changed: true, incr: incr(r)}),
    defaultValue: {__counter: true, changed: false, incr: null},
  };
}

// Compound member that recursively decodes another compound type.
function compoundMember<T>(inner: Decoder<T>, defaultValue: T): DaCompoundField<T> {
  return {name: "", decodeSet: inner, defaultValue};
}

// DaLinacc<A>: when set, A::InsertCnt + that many A::EntryData.
type Linacc<T> = {__linacc: true; entries: T[]};

function linacc<T>(insertCnt: Decoder<number>, entry: Decoder<T>): DaCompoundField<Linacc<T>> {
  return {
    name: "",
    decodeSet: (r) => {
      const cnt = insertCnt(r);
      const entries: T[] = [];
      for (let i = 0; i < cnt; i++) entries.push(entry(r));
      return {__linacc: true, entries};
    },
    defaultValue: {__linacc: true, entries: []},
  };
}

function field<T>(name: string, spec: DaCompoundField<T>): DaCompoundField<T> {
  return {...spec, name};
}

// ── OL DA payload schemas (mirror crates/ol/da/src/types/) ─────────────────
//
// Hashes/IDs are tuple structs with `derive(Codec)`, which encodes as the
// concatenation of fields. AccountId/SubjectId are [u8; 32] wrappers; Hash is
// `Buf32([u8; 32])`; AccountSerial is `u32`; BitcoinAmount is `u64`.

type Hash32 = {__wrapper: "Hash"; bytes: Uint8Array};
type AccountId = {__wrapper: "AccountId"; bytes: Uint8Array};
type AccountSerial = {__wrapper: "AccountSerial"; value: number};
type BitcoinAmount = {__wrapper: "BitcoinAmount"; sats: bigint};

const hash32: Decoder<Hash32> = (r) => ({__wrapper: "Hash", bytes: r.readArr(32)});
const accountId: Decoder<AccountId> = (r) => ({__wrapper: "AccountId", bytes: r.readArr(32)});
const accountSerial: Decoder<AccountSerial> = (r) => ({__wrapper: "AccountSerial", value: r.readU32()});
const bitcoinAmount: Decoder<BitcoinAmount> = (r) => ({__wrapper: "BitcoinAmount", sats: r.readU64()});

// AccountInit / AccountTypeInit (hand-written enum codec in ledger.rs)
type SnarkAccountInit = {__struct: "SnarkAccountInit"; initial_state_root: Hash32; update_vk: Uint8Array};
type AccountTypeInit =
  | {__enum: "AccountTypeInit"; variant: "Empty"}
  | {__enum: "AccountTypeInit"; variant: "Snark"; value: SnarkAccountInit};
type AccountInit = {__struct: "AccountInit"; balance: BitcoinAmount; type_state: AccountTypeInit};

const snarkAccountInit: Decoder<SnarkAccountInit> = (r) => ({
  __struct: "SnarkAccountInit",
  initial_state_root: hash32(r),
  update_vk: u16LenBytes(r),
});

const accountInit: Decoder<AccountInit> = (r) => {
  const balance = bitcoinAmount(r);
  const tag = r.readU8();
  let type_state: AccountTypeInit;
  switch (tag) {
    case 0:
      type_state = {__enum: "AccountTypeInit", variant: "Empty"};
      break;
    case 1:
      type_state = {__enum: "AccountTypeInit", variant: "Snark", value: snarkAccountInit(r)};
      break;
    default:
      throw new CodecError(`AccountTypeInit: unknown tag ${tag}`);
  }
  return {__struct: "AccountInit", balance, type_state};
};

// MsgPayload (hand-written): BitcoinAmount + Varint length + bytes
const msgPayload = (r: BufReader) => {
  const value = bitcoinAmount(r);
  const len = r.readVarint();
  const data = r.readArr(len);
  return {__struct: "MsgPayload", value, data};
};

// DaMessageEntry (hand-written): AccountId + u32 + MsgPayload
const daMessageEntry = (r: BufReader) => ({
  __struct: "DaMessageEntry",
  source: accountId(r),
  incl_epoch: u32(r),
  payload: msgPayload(r),
});

// DaProofStateDiff: compound u8 mask
//   inner_state: register(Hash)
//   next_inbox_msg_idx: counter(CtrU64ByUnsignedVarInt)
const daProofStateDiff = compoundU8("DaProofStateDiff", [
  field("inner_state", register(hash32)),
  field(
    "next_inbox_msg_idx",
    counter((r) => r.readUnsignedVarInt())
  ),
]);

const daProofStateDiffDefault = {
  __struct: "DaProofStateDiff",
  __compound: true,
  inner_state: {__register: true, set: false, value: null},
  next_inbox_msg_idx: {__counter: true, changed: false, incr: null},
} as const;

// SnarkAccountDiff: compound u8 mask
//   seq_no: counter(CtrU64ByU16)        — Incr = u16 BE
//   proof_state: compound (DaProofStateDiff)
//   inbox: compound (DaLinacc<InboxBuffer>)  — InsertCnt = u16, EntryData = DaMessageEntry
const snarkAccountDiff = compoundU8("SnarkAccountDiff", [
  field("seq_no", counter(u16)),
  field("proof_state", compoundMember(daProofStateDiff, daProofStateDiffDefault)),
  field("inbox", linacc(u16, daMessageEntry)),
]);

const snarkAccountDiffDefault = {
  __struct: "SnarkAccountDiff",
  __compound: true,
  seq_no: {__counter: true, changed: false, incr: null},
  proof_state: daProofStateDiffDefault,
  inbox: {__linacc: true, entries: []},
} as const;

// AccountDiff: compound u8 mask
//   balance: counter(CtrU64BySignedVarInt)
//   snark: compound (SnarkAccountDiff)
const accountDiff = compoundU8("AccountDiff", [
  field(
    "balance",
    counter((r) => r.readSignedVarInt())
  ),
  field("snark", compoundMember(snarkAccountDiff, snarkAccountDiffDefault)),
]);

// GlobalStateDiff: compound u8 mask
//   cur_slot: counter(CtrU64ByU16)
const globalStateDiff = compoundU8("GlobalStateDiff", [field("cur_slot", counter(u16))]);

// LedgerDiff: derived Codec — concat of fields
const newAccountEntry = struct("NewAccountEntry", {
  account_id: accountId,
  init: accountInit,
});

const accountDiffEntry = struct("AccountDiffEntry", {
  account_serial: accountSerial,
  diff: accountDiff,
});

const ledgerDiff = struct("LedgerDiff", {
  new_accounts: u16LenList(newAccountEntry),
  account_diffs: u16LenList(accountDiffEntry),
});

const stateDiff = struct("StateDiff", {
  global: globalStateDiff,
  ledger: ledgerDiff,
});

const olDaPayloadV1 = struct("OLDaPayloadV1", {
  state_diff: stateDiff,
});

// ── Public entry point ─────────────────────────────────────────────────────

export function decodeOlStateDiff(bytes: Uint8Array): unknown {
  const r = new BufReader(bytes);
  const value = olDaPayloadV1(r);
  if (!r.isExhausted()) {
    throw new CodecError(`trailing bytes: ${r.remaining()} unread after OLDaPayloadV1`, r.pos());
  }
  return value;
}

// ── Pretty-printer (Rust-Debug-ish) ────────────────────────────────────────

const HEX_TABLE: string[] = [];
for (let i = 0; i < 256; i++) HEX_TABLE.push(i.toString(16).padStart(2, "0"));

function hex(b: Uint8Array): string {
  let s = "0x";
  for (let i = 0; i < b.length; i++) s += HEX_TABLE[b[i]];
  return s;
}

function indent(depth: number): string {
  return "    ".repeat(depth);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function fmt(value: unknown, depth: number): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Uint8Array) return hex(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = value.map((v) => `${indent(depth + 1)}${fmt(v, depth + 1)}`).join(",\n");
    return `[\n${inner},\n${indent(depth)}]`;
  }

  if (!isObject(value)) return String(value);

  // Wrapper types render as Rust-style tuple-struct-newtypes.
  if (value.__wrapper === "AccountId") return `AccountId(${hex(value.bytes as Uint8Array)})`;
  if (value.__wrapper === "Hash") return `Hash(${hex(value.bytes as Uint8Array)})`;
  if (value.__wrapper === "AccountSerial") return `AccountSerial(${value.value})`;
  if (value.__wrapper === "BitcoinAmount") return `BitcoinAmount(${(value.sats as bigint).toString()} sats)`;

  // Compound member envelopes
  if (value.__register) {
    return value.set ? `Set(${fmt(value.value, depth)})` : "Unset";
  }
  if (value.__counter) {
    if (!value.changed) return "Unchanged";
    const incr = value.incr;
    if (isObject(incr) && (incr as {positive?: boolean; magnitude?: bigint}).magnitude !== undefined) {
      const sv = incr as {positive: boolean; magnitude: bigint};
      const sign = sv.positive ? "+" : "-";
      return `Changed(${sign}${sv.magnitude.toString()})`;
    }
    return `Changed(${fmt(incr, depth)})`;
  }
  if (value.__linacc) {
    return `Linacc${fmt(value.entries, depth)}`;
  }

  if (value.__enum) {
    if (value.variant === "Empty") return `${value.__enum}::Empty`;
    return `${value.__enum}::${value.variant}(${fmt((value as {value: unknown}).value, depth)})`;
  }

  if (value.__struct) {
    const skipKeys = new Set(["__struct", "__compound"]);
    const keys = Object.keys(value).filter((k) => !skipKeys.has(k));
    if (keys.length === 0) return `${value.__struct}`;
    const lines = keys
      .map((k) => `${indent(depth + 1)}${k}: ${fmt((value as Record<string, unknown>)[k], depth + 1)}`)
      .join(",\n");
    return `${value.__struct} {\n${lines},\n${indent(depth)}}`;
  }

  // Fallback: generic object
  const keys = Object.keys(value);
  const lines = keys.map((k) => `${indent(depth + 1)}${k}: ${fmt(value[k], depth + 1)}`).join(",\n");
  return `{\n${lines},\n${indent(depth)}}`;
}

export function formatDecoded(value: unknown): string {
  return fmt(value, 0);
}

export function decodeAndFormatOlStateDiff(bytes: Uint8Array): string {
  return formatDecoded(decodeOlStateDiff(bytes));
}
