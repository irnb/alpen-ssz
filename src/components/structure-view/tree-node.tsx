import { useState } from "react";
import { type TreeNodeData, categoryColors } from "./utils";

type TreeNodeProps = {
  node: TreeNodeData;
  depth?: number;
};

export function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-slate-800 pl-3" : ""}>
      <div
        className="flex items-baseline gap-2 py-0.5 hover:bg-slate-800/50 rounded px-1 group cursor-default"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <span className="w-4 text-center text-slate-600 text-xs flex-shrink-0">
          {hasChildren ? (
            <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>
              &#9654;
            </span>
          ) : (
            <span className="text-slate-800">&middot;</span>
          )}
        </span>

        <span className="font-mono text-sm text-slate-300">{node.key}</span>

        <span className={`font-mono text-xs ${categoryColors[node.category]}`}>
          {node.typeName}
        </span>

        {node.gindex && (
          <span className="font-mono text-xs text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
            gi:{node.gindex}
          </span>
        )}

        {node.value != null && (
          <span className="font-mono text-xs text-slate-400 truncate max-w-[300px]">
            = {node.value}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.key}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
