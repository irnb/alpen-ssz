import type {Type} from "@chainsafe/ssz";
import {useMemo} from "react";
import {TreeNode} from "./tree-node";
import {buildTree} from "./utils";

type StructureViewProps = {
  sszType: Type<unknown> | null;
  data: unknown;
  typeName: string;
};

export function StructureView({sszType, data, typeName}: StructureViewProps) {
  const tree = useMemo(() => {
    if (!sszType || data == null) return null;
    return buildTree(sszType, data, typeName, "1");
  }, [sszType, data, typeName]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-600 font-mono">
        Structure view will appear here
      </div>
    );
  }

  return (
    <div className="overflow-auto font-mono text-sm">
      <TreeNode node={tree} />
    </div>
  );
}
