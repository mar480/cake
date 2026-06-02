import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DetailsTab from "./DetailsTab";
import { getReferenceType } from "./referenceDisplayUtils";
import type { ConceptDetailsResponse } from "./apiTypes";
import type { TreeNode } from "./tree_utils";

const conceptWithSourceOnlyReference: ConceptDetailsResponse = {
  concept: {
    qname: "test:Concept",
    local_name: "Concept",
  },
  references: [
    {
      source: "UK XBRL standard",
      number: "1",
      year: "2026",
    },
  ],
};

const selectedNode: TreeNode = {
  key: "test:Concept",
  label: "Concept",
  data: { qname: "test:Concept" },
};

describe("DetailsTab references", () => {
  it("uses source as the Type value when reference_role is absent", () => {
    const [reference] = conceptWithSourceOnlyReference.references ?? [];

    assert.equal(getReferenceType(reference), "UK XBRL standard");

    const html = renderToStaticMarkup(
      <DetailsTab concept={conceptWithSourceOnlyReference} selectedNode={selectedNode} />
    );

    assert.match(html, /<td[^>]*>UK XBRL standard<\/td>/);
    assert.doesNotMatch(html, /<div[^>]*>Source<\/div>/);
  });
});
