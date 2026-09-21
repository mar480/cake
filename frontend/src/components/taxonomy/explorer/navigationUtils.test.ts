import assert from "node:assert/strict";
import test from "node:test";

import { chooseNavigationMatcher } from "./navigationUtils";
import type { TreeNode } from "./tree_utils";

const nodes: TreeNode[] = [
  { key: "role-one", label: "role one", children: [
    { key: "role-one::first", label: "first", data: { qname: "ex:Duplicate", uuid: "first" } },
  ] },
  { key: "role-two", label: "role two", children: [
    { key: "role-two::second", label: "second", data: { qname: "ex:Duplicate", uuid: "second" } },
  ] },
];

test("occurrence wins when duplicate QNames exist", () => {
  const result = chooseNavigationMatcher(nodes, { network: "presentation", qname: "ex:Duplicate", elr: "role-one", uuid: "second" });
  assert.equal(result.matchStrategy, "uuid");
  assert.equal(result.uuidMatches[0].data?.uuid, "second");
});

test("navigation falls back from a missing occurrence to ELR plus QName, then QName", () => {
  const elr = chooseNavigationMatcher(nodes, { network: "presentation", qname: "ex:Duplicate", elr: "role-two", uuid: "gone" });
  assert.equal(elr.matchStrategy, "elr+qname");
  assert.equal(elr.elrQNameMatches[0].data?.uuid, "second");

  const qname = chooseNavigationMatcher(nodes, { network: "presentation", qname: "ex:Duplicate", elr: "gone", uuid: "gone" });
  assert.equal(qname.matchStrategy, "qname");
  assert.equal(qname.qnameMatches.length, 2);
});
