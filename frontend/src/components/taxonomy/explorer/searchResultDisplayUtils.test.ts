import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectTreeNodeOccurrences } from "./explorerDataUtils";
import { getDefinitionElrLabelsForOccurrences } from "./searchResultDisplayUtils";
import type { RawElrGroup } from "./explorerTypes";

const TARGET_QNAME = "test:Revenue";
const SHARED_HYPERCUBE_QNAME = "test:SharedAnalysisTable";

describe("getDefinitionElrLabelsForOccurrences", () => {
  it("shows only concrete definition tree occurrences for a result QName, not reused hypercube memberships", () => {
    const rawTreeData: Record<string, RawElrGroup[]> = {
      definition_dommem: [
        {
          elr: "http://example.com/role/concrete-definition",
          definition: "Concrete Definition ELR",
          root_tree: [
            {
              qname: "test:Domain",
              children: [
                { qname: TARGET_QNAME, uuid: "target-definition-1" },
                { qname: TARGET_QNAME, uuid: "target-definition-duplicate" },
              ],
            },
          ],
        },
      ],
      definition_hydim: [
        {
          elr: "http://example.com/role/reused-analysis",
          definition: "Reused Analysis ELR",
          root_tree: [{ qname: SHARED_HYPERCUBE_QNAME, uuid: "shared-hypercube" }],
        },
      ],
      presentation: [
        {
          elr: "http://example.com/role/presentation",
          definition: "Presentation ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "target-presentation" }],
        },
      ],
    };

    const result = {
      qname: TARGET_QNAME,
      hypercubes: [SHARED_HYPERCUBE_QNAME],
    };

    const occurrences = collectTreeNodeOccurrences(rawTreeData, result.qname);

    assert.equal(result.hypercubes.includes(SHARED_HYPERCUBE_QNAME), true);
    assert.deepEqual(getDefinitionElrLabelsForOccurrences(occurrences), [
      "Concrete Definition ELR",
    ]);
  });

  it("deduplicates repeated concrete occurrences by ELR while preferring the ELR definition label", () => {
    const rawTreeData: Record<string, RawElrGroup[]> = {
      definition_dommem: [
        {
          elr: "http://example.com/role/repeated-definition",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "first" }],
        },
      ],
      definition_dimdom: [
        {
          elr: "http://example.com/role/repeated-definition",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "second" }],
        },
        {
          elr: "http://example.com/role/repeated-definition-alias",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "third" }],
        },
      ],
    };

    const occurrences = collectTreeNodeOccurrences(rawTreeData, TARGET_QNAME);

    assert.deepEqual(getDefinitionElrLabelsForOccurrences(occurrences), [
      "Repeated Definition ELR",
    ]);
  });
});
