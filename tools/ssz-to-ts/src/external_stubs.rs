//! Hand-written definitions for types referenced via external Rust crates.
//!
//! The .ssz files reference types from external crates by name (e.g.
//! `strata_identifiers.Buf32`). The parser leaves these opaque. The emitter
//! looks them up here and emits TypeScript that either:
//!
//! - constructs the type inline (for primitive externals like
//!   `strata_identifiers`, `strata_btc_types`, `block_flags`), or
//! - re-exports it from a generated module (for cross-crate references whose
//!   types are also in our .ssz scan).

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum StubKind {
    /// Inline TypeScript expression that evaluates to a `Type<unknown>`.
    Expr(&'static str),
    /// Re-export `<name>` from `src/generated/modules/<module>.ts`.
    Reexport { module: &'static str },
    /// Import `<source_name>` from `src/generated/modules/<module>.ts` and
    /// re-export it as `<name>`. Used for Rust-level type aliases that don't
    /// exist as SSZ classes (e.g. `Mmr64 = Mmr64B32`).
    AliasReexport {
        module: &'static str,
        source_name: &'static str,
    },
}

#[derive(Debug, Clone)]
pub struct Stub {
    pub name: &'static str,
    pub kind: StubKind,
}

/// All known external types per external module name.
pub fn registry() -> HashMap<&'static str, Vec<Stub>> {
    let mut r = HashMap::new();

    r.insert(
        "strata_identifiers",
        vec![
            // Byte buffers — Buf32, RBuf32 etc. all encode as Bytes32 on the wire.
            inline("Buf32",  "new ByteVectorType(32)"),
            inline("RBuf32", "new ByteVectorType(32)"),
            inline("Buf64",  "new ByteVectorType(64)"),
            inline("Buf20",  "new ByteVectorType(20)"),
            // Newtype primitives.
            inline("Slot",          "new UintBigintType(8)"),
            inline("Epoch",         "new UintNumberType(4)"),
            inline("L1Height",      "new UintNumberType(4)"),
            inline("AccountSerial", "new UintNumberType(4)"),
            // Newtype byte buffers.
            inline("AccountId",  "new ByteVectorType(32)"),
            inline("L1BlockId",  "new ByteVectorType(32)"),
            inline("OLBlockId",  "new ByteVectorType(32)"),
            inline("L2BlockId",  "new ByteVectorType(32)"),
            inline("OLTxId",     "new ByteVectorType(32)"),
            inline("WtxidsRoot", "new ByteVectorType(32)"),
            inline("SubjectId",  "new ByteVectorType(32)"),
            inline("Hash",       "new ByteVectorType(32)"),
            inline("EvmEeBlockCommitment", "new ByteVectorType(32)"),
            inline("ExecBlockCommitment",  "new ByteVectorType(32)"),
            inline("EVMExtraPayload",      "new ByteVectorType(32)"),
            inline("AccountTypeId",        "new UintNumberType(2)"),
            inline("RawAccountTypeId",     "new UintNumberType(2)"),
            // Composite types.
            inline(
                "EpochCommitment",
                "new ContainerType({ epoch: new UintNumberType(4), last_slot: new UintBigintType(8), last_blkid: new ByteVectorType(32) })",
            ),
            inline(
                "OLBlockCommitment",
                "new ContainerType({ slot: new UintBigintType(8), blkid: new ByteVectorType(32) })",
            ),
            inline(
                "L1BlockCommitment",
                "new ContainerType({ height: new UintNumberType(4), blkid: new ByteVectorType(32) })",
            ),
            inline(
                "L2BlockCommitment",
                "new ContainerType({ slot: new UintBigintType(8), blkid: new ByteVectorType(32) })",
            ),
        ],
    );

    r.insert(
        "strata_btc_types",
        vec![inline("BitcoinAmount", "new UintBigintType(8)")],
    );

    r.insert(
        "block_flags",
        vec![inline("BlockFlags", "new UintNumberType(2)")],
    );

    // Rust type aliases that don't exist as SSZ classes — re-export the
    // underlying B32 variants under the alias name.
    r.insert(
        "strata_acct_types",
        vec![
            alias_reexport("Mmr64", "merkle-mmr", "Mmr64B32"),
            alias_reexport("RawMerkleProof", "merkle-proof", "RawMerkleProofB32"),
        ],
    );

    // Rust newtype primitives.
    r.insert(
        "strata_snark_acct_types",
        vec![inline("Seqno", "new UintBigintType(8)")],
    );

    r
}

/// Map from external Rust crate name (`strata_acct_types`) → in-repo virtual
/// module name (`acct-types`). For these, the emitter auto-discovers types
/// defined in the corresponding scanned .ssz files and emits re-exports.
pub fn cross_crate_alias(name: &str) -> Option<&'static str> {
    let table: &[(&str, &str)] = &[
        ("strata_acct_types", "acct-types"),
        ("strata_snark_acct_types", "snark-acct-types"),
        ("strata_asm_common", "asm-common"),
        ("strata_asm_manifest_types", "asm-manifest-types"),
        ("strata_ee_chain_types", "ee-chain-types"),
        ("strata_ee_acct_types", "ee-acct-types"),
        ("strata_predicate", "predicate"),
        ("strata_merkle", "merkle"),
        ("strata_ol_chain_types", "ol-chain-types"),
        ("strata_ol_state_types", "ol-state-types"),
    ];
    for (k, v) in table {
        if *k == name {
            return Some(v);
        }
    }
    None
}

const fn inline(name: &'static str, expr: &'static str) -> Stub {
    Stub {
        name,
        kind: StubKind::Expr(expr),
    }
}

const fn reexport(name: &'static str, module: &'static str) -> Stub {
    Stub {
        name,
        kind: StubKind::Reexport { module },
    }
}

const fn alias_reexport(
    name: &'static str,
    module: &'static str,
    source_name: &'static str,
) -> Stub {
    Stub {
        name,
        kind: StubKind::AliasReexport {
            module,
            source_name,
        },
    }
}
