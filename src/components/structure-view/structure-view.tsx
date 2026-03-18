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
      <div className="flex items-center justify-center h-full text-[12px] text-[var(--color-text-muted)]/50 font-mono py-8">
        Structure appears when data is loaded
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <TreeNode node={tree} />
    </div>
  );
}
