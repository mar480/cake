import assert from "node:assert/strict";
import test from "node:test";
import { canCopyTreeNode, contextMenuForRightClick } from "./contextMenuUtils";

test("only actual QName concepts are copy-link eligible", () => {
  assert.equal(canCopyTreeNode({ key: "r::1", label: "Concept", data: { qname: "x:y" } }), true);
  assert.equal(canCopyTreeNode({ key: "r", label: "ELR", data: { elr: "r" } }), false);
  assert.equal(canCopyTreeNode(null), false);
});

test("a valid right-click captures that exact concept and an invalid click closes stale state", () => {
  const clicked = { key: "r::new", label: "New", data: { qname: "x:new" } };
  const opened = contextMenuForRightClick(clicked, 12, 34);
  assert.equal(opened?.node, clicked);
  assert.equal(contextMenuForRightClick({ key: "r", label: "ELR", data: { elr: "r" } }, 1, 2), null);
});
