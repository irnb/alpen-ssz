import {useState} from "react";
import {type TreeNodeData, categoryColors} from "./utils";

type TreeNodeProps = {
  node: TreeNodeData;
  depth?: number;
};

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
            <span className={`inline-block transition-transform duration-150 text-[var(--color-text-muted)] ${expanded ? "rotate-90" : ""}`}>
              &#9654;
            </span>
          ) : (
            <span className="text-[var(--color-border)]">&#183;</span>
          )}
        </span>

        {/* Key name */}
        <span className="font-mono text-[12px] text-[var(--color-text-primary)]">{node.key}</span>

        {/* Type annotation */}
        <span className={`font-mono text-[10px] ${categoryColors[node.category]} opacity-70`}>
          {node.typeName}
        </span>

        {/* Generalized index on hover */}
        {node.gindex && (
          <span className="font-mono text-[10px] text-[var(--color-text-muted)]/40 opacity-0 group-hover:opacity-100 transition-opacity">
            [{node.gindex}]
          </span>
        )}

        {/* Value (leaf nodes) */}
        {node.value != null && (
          <span className="font-mono text-[11px] text-[var(--color-text-secondary)] truncate max-w-[280px]">
            {node.value}
          </span>
        )}
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
