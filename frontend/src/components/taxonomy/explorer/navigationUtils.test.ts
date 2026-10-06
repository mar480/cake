import assert from "node:assert/strict";
import test from "node:test";
import { chooseNavigationMatcher } from "./navigationUtils";
import type { TreeNode } from "./tree_utils";

const nodes: TreeNode[] = [
  { key: "role-a::one", label: "one", data: { qname: "x:same", uuid: "one" } },
  { key: "role-b::two", label: "two", data: { qname: "x:same", uuid: "two" } },
];

test("duplicate QName navigation falls back occurrence, then ELR plus QName, then QName", () => {
  assert.equal(chooseNavigationMatcher(nodes, { network: "presentation", qname: "x:same", uuid: "two", elr: "role-a" }).matchStrategy, "uuid");
  assert.equal(chooseNavigationMatcher(nodes, { network: "presentation", qname: "x:same", uuid: "missing", elr: "role-b" }).matchStrategy, "elr+qname");
  assert.equal(chooseNavigationMatcher(nodes, { network: "presentation", qname: "x:same", uuid: "missing", elr: "missing" }).matchStrategy, "qname");
});

test("a missing concept produces no matching path", () => {
  const choice = chooseNavigationMatcher(nodes, { network: "presentation", qname: "x:missing" });
  assert.equal(choice.qnameMatches.length, 0);
  assert.equal(nodes.some(choice.matcher), false);
});
