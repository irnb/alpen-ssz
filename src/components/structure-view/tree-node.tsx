import {useState} from "react";
import {decodeAndFormatOlStateDiff} from "../../lib/strata-codec";
import {type RustCodecKind, type TreeNodeData, categoryColors} from "./utils";

type TreeNodeProps = {
  node: TreeNodeData;
  depth?: number;
};

const VALUE_TRUNCATE_LEN = 64;

const RUST_CODEC_LABEL: Record<RustCodecKind, string> = {
  olStateDiff: "OLDaPayloadV1 (strata_codec)",
};

const RUST_CODEC_TOOLTIP: Record<RustCodecKind, string> = {
  olStateDiff:
    "These bytes are an OLDaPayloadV1 encoded with strata_codec — a separate Rust framework, not SSZ. " +
    "Decoding here mirrors decode_ol_da_payload_bytes in alpen/crates/ol/da/src/types/payload.rs.",
};

function LeafValue({value, suffix}: {value: string; suffix: string | null}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > VALUE_TRUNCATE_LEN;

  if (!isLong) {
    return <span className="font-mono text-[11px] text-[var(--color-text-secondary)] break-all">{value}</span>;
  }

  return (
    <span
      className="font-mono text-[11px] text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)] transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
    >
      {expanded ? (
        <span className="break-all">{value}</span>
      ) : (
        <>
          {value.slice(0, VALUE_TRUNCATE_LEN)}
          <span className="text-[var(--color-text-muted)]">{suffix ? `… ${suffix}` : "…"}</span>
        </>
      )}
    </span>
  );
}

function decodeBytes(kind: RustCodecKind, bytes: Uint8Array): {ok: true; text: string} | {ok: false; error: string} {
  try {
    if (kind === "olStateDiff") {
      return {ok: true, text: decodeAndFormatOlStateDiff(bytes)};
    }
    return {ok: false, error: `unknown rust codec kind: ${kind}`};
  } catch (e) {
    return {ok: false, error: e instanceof Error ? e.message : String(e)};
  }
}

function RustCodecPanel({kind, bytes}: {kind: RustCodecKind; bytes: Uint8Array}) {
  const [decoded, setDecoded] = useState<{ok: true; text: string} | {ok: false; error: string} | null>(null);

  return (
    <div className="ml-7 mt-1 mb-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDecoded(decodeBytes(kind, bytes));
          }}
          className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 transition-all"
        >
          Decode as {RUST_CODEC_LABEL[kind]}
        </button>
        <span className="text-[10px] text-[var(--color-text-muted)]/70 cursor-help" title={RUST_CODEC_TOOLTIP[kind]}>
          (?) not SSZ
        </span>
      </div>
      {decoded && (
        <pre
          className={`mt-1.5 p-2.5 rounded bg-[var(--color-surface)] border ${
            decoded.ok ? "border-[var(--color-border)]" : "border-red-500/30"
          } text-[11px] font-mono text-[var(--color-text-secondary)] overflow-auto max-h-96 leading-relaxed whitespace-pre`}
        >
          {decoded.ok ? decoded.text : `decode error: ${decoded.error}`}
        </pre>
      )}
    </div>
  );
}

export function TreeNode({node, depth = 0}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-3.5 border-l border-[var(--color-border)]/50 pl-3" : ""}>
      <div
        className={`flex items-baseline gap-1.5 py-[3px] rounded px-1.5 group ${
          hasChildren ? "cursor-pointer hover:bg-[var(--color-surface-overlay)]/60" : "cursor-default"
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse arrow */}
        <span className="w-3.5 text-center text-[10px] flex-shrink-0 select-none">
          {hasChildren ? (
            <span
              className={`inline-block transition-transform duration-150 text-[var(--color-text-muted)] ${expanded ? "rotate-90" : ""}`}
            >
              &#9654;
            </span>
          ) : (
            <span className="text-[var(--color-border)]">&#183;</span>
          )}
        </span>

        {/* Key name */}
        <span className="font-mono text-[12px] text-[var(--color-text-primary)] shrink-0">{node.key}</span>

        {/* Type annotation */}
        <span className={`font-mono text-[10px] ${categoryColors[node.category]} opacity-70 shrink-0`}>
          {node.typeName}
        </span>

        {/* Generalized index on hover */}
        {node.gindex && (
          <span className="font-mono text-[10px] text-[var(--color-text-muted)]/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            [{node.gindex}]
          </span>
        )}

        {/* Value (leaf nodes) */}
        {node.value != null && <LeafValue value={node.value} suffix={node.valueSuffix} />}
      </div>

      {/* Rust-codec decode panel for opaque byte fields like sidecar.ol_state_diff. */}
      {node.rustCodec && node.rawBytes && <RustCodecPanel kind={node.rustCodec} bytes={node.rawBytes} />}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children?.map((child, i) => (
            <TreeNode key={`${child.key}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
