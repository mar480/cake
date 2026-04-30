import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TreeSelect } from "primereact/treeselect";
import type { TreeNode } from "primereact/treenode";
import { DomainMember } from "./HypercubeDisplay";

interface MemberDropdownProps {
  members: DomainMember[];
  defaultSelection: string | null;
  level: number; // kept for compatibility with existing call sites
  language: "en" | "cy";
}

const DEFAULT_EXPAND_DEPTH = 2; // set to 3 if you want one more level open by default

const buildExpandedKeys = (
  nodes: TreeNode[],
  maxDepth: number,
  depth = 0,
  acc: Record<string, boolean> = {}
): Record<string, boolean> => {
  for (const node of nodes) {
    const key = String(node.key ?? "");
    if (key && depth < maxDepth && node.children?.length) {
      acc[key] = true;
      buildExpandedKeys(node.children, maxDepth, depth + 1, acc);
    }
  }
  return acc;
};

const MemberDropdown: React.FC<MemberDropdownProps> = ({
  members,
  defaultSelection,
  language,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultSelection);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toTreeNodes = useCallback(
    (nodes: DomainMember[]): TreeNode[] =>
      nodes.map((m) => {
        const label = language === "cy" && m.label_cy ? m.label_cy : m.label;
        return {
          key: m.name,
          label,
          data: {
            isDefault: m.name === defaultSelection,
          },
          children: m.children?.length ? toTreeNodes(m.children) : undefined,
        };
      }),
    [defaultSelection, language]
  );

  const treeOptions = useMemo(() => toTreeNodes(members), [members, toTreeNodes]);

  useEffect(() => {
    setExpandedKeys(buildExpandedKeys(treeOptions, DEFAULT_EXPAND_DEPTH));
  }, [treeOptions]);

  useEffect(() => {
    setSelectedKey(defaultSelection);
  }, [defaultSelection]);

  const findNodeByKey = (nodes: TreeNode[], key: string | null): TreeNode | null => {
    if (!key) return null;
    for (const n of nodes) {
      if (String(n.key) === key) return n;
      if (n.children?.length) {
        const found = findNodeByKey(n.children, key);
        if (found) return found;
      }
    }
    return null;
  };

  const hasDefaultTag = (text: string) => /\[default\]/i.test(text);

  const withSingleDefaultTag = (text: string, isDefault: boolean) => {
    if (!isDefault) return text;
    return hasDefaultTag(text) ? text : `${text} [default]`;
  };

  const selectedNode = findNodeByKey(treeOptions, selectedKey);
  const selectedLabel = selectedNode?.label ? String(selectedNode.label) : "";
  const selectedIsDefault = Boolean(selectedNode?.data?.isDefault);

  return (
  <div className="hypercube-member-select">
    <TreeSelect
      value={selectedKey}
      onChange={(e) => setSelectedKey((e.value as string) ?? null)}
      options={treeOptions}
      selectionMode="single"
      expandedKeys={expandedKeys}
      onToggle={(e) => setExpandedKeys((e.value ?? {}) as Record<string, boolean>)}
      placeholder="Select member"
      className="w-full text-[12px] font-normal text-slate-700"
      panelClassName="hypercube-member-select-panel"
      scrollHeight="420px"
      nodeTemplate={(node) => {
        const isDefault = Boolean(node.data?.isDefault);
        const cleanLabel = withSingleDefaultTag(String(node.label ?? ""), isDefault);

        return (
          <span className={`leading-[1.3] ${isDefault ? "is-default" : ""}`}>
            {cleanLabel}
          </span>
        );
      }}
      valueTemplate={() =>
        selectedKey ? (
          <span className={`leading-[1.3] ${selectedIsDefault ? "is-default" : ""}`}>
            {withSingleDefaultTag(selectedLabel, selectedIsDefault)}
          </span>
        ) : (
          <span className="text-slate-400">Select member</span>
        )
      }
    />
  </div>
);
};

export default MemberDropdown;
