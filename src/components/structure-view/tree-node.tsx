import {useState} from "react";
import {type TreeNodeData, categoryColors} from "./utils";

type TreeNodeProps = {
  node: TreeNodeData;
  depth?: number;
};

const VALUE_TRUNCATE_LEN = 64;

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
          <span className="text-[var(--color-text-muted)]">{suffix ? `\u2026 ${suffix}` : "\u2026"}</span>
        </>
      )}
    </span>
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
