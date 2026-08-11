import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectTreeLocations } from "./navigationUtils";
import { mapElrGroupedTreeToTreeNodes } from "./tree_utils";

describe("unnumbered ELRs", () => {
  const countryList = {
    elr: "http://example.com/role/country-list",
    definition: "Country List",
    numeric_part: null,
    root_tree: [
      {
        qname: "core:CountryDomain",
        children: [{ qname: "core:UnitedKingdomMember", uuid: "uk-member" }],
      },
    ],
  };

  it("maps the ELR using its URI and definition when it has no number", () => {
    const [node] = mapElrGroupedTreeToTreeNodes([countryList]);

    assert.equal(node.key, countryList.elr);
    assert.equal(node.label, "Country List");
    assert.equal(node.data?.numeric_part, null);
    assert.equal(node.children?.length, 1);
  });

  it("retains null numeric metadata in tree-location navigation", () => {
    const [location] = collectTreeLocations(
      { definition_dommem: [countryList] },
      "core:UnitedKingdomMember"
    );

    assert.equal(location.elr, countryList.elr);
    assert.equal(location.elrDefinition, "Country List");
    assert.equal(location.numericPart, null);
    assert.equal(location.uuid, "uk-member");
  });
});
