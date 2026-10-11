import type { ConceptDetailsResponse, DimensionalRelationshipsResponse } from "../src/components/taxonomy/explorer/apiTypes";
import type { SearchConceptApiResult } from "../src/components/taxonomy/explorer/explorerTypes";
import type { RawElrGroup } from "../src/components/taxonomy/explorer/tree_utils";
import type { LoadEntrypointResponse } from "../src/components/taxonomy/explorer/services/explorerApi";

export const hrefs = {
  "2026": "https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd",
  "2025": "https://xbrl.frc.org.uk/IFRS/2025-01-01/IFRS-2025-01-01.xsd",
};
export const revisions = { "2026": "a".repeat(64), "2025": "b".repeat(64) };
export const networks = ["presentation", "definition_hydim", "definition_dimdom", "definition_dimdef", "definition_dommem", "definition_all", "definition_crossref", "definition_inflow", "definition_outflow"];
export const ppe = "core:PropertyPlantEquipment";
export const revenue = "core:TurnoverRevenue";
const names = {
  [ppe]: ["Property, plant and equipment", "Eiddo, peiriannau ac offer"],
  [revenue]: ["Turnover revenue", "Trosiant"],
  "core:RevenueReference": ["Revenue cross-reference", "Croesgyfeiriad refeniw"],
};

function node(qname: string, uuid: string) {
  return { qname, uuid, name: names[qname][0], label_cy: names[qname][1], xbrl_type: "monetaryItemType", full_type: "xbrli:monetaryItemType", substitution_group: "xbrli:item", children: [] };
}

export function bundle(year = "2026"): LoadEntrypointResponse {
  const trees: Record<string, RawElrGroup[]> = {};
  for (const network of networks) {
    trees[network + "_tree"] = [{
      elr: `urn:cake:${network}:100`, definition: "100 - Financial statements", numeric_part: 100,
      root_tree: [{ qname: "core:Statement", uuid: `${year}-${network}-root`, name: "Statement of financial position", label_cy: "Datganiad sefyllfa ariannol", abstract: true,
        children: [node(ppe, `${year}-${network}-ppe`), node(revenue, `${year}-${network}-revenue`), node("core:RevenueReference", `${year}-${network}-xref`)] }],
    }];
  }
  trees.presentation_tree.push({ elr: "urn:cake:presentation:200", definition: "200 - Notes", numeric_part: 200, root_tree: [node(ppe, `${year}-presentation-ppe-second`)] });
  return { status: "loaded", revision: revisions[year], trees, filterOptions: {
    namespace: [`urn:cake:${year}`], balance: ["debit", "credit"], periodType: ["instant", "duration"],
    conceptType: ["concept"], xbrlType: ["monetaryItemType"], fullType: ["xbrli:monetaryItemType"], abstract: [false, true], nillable: [true, false], substitutionGroup: ["xbrli:item"],
    referenceSources: ["FRS 102"], referenceParagraphsBySource: { "FRS 102": ["17.1"] },
  } };
}

export function details(qname: string, year = "2026"): ConceptDetailsResponse {
  return {
    concept: { qname, local_name: qname.split(":")[1], namespace: `urn:cake:${year}`, balance: "debit", period_type: "instant", full_type: "xbrli:monetaryItemType", xbrl_type: "monetaryItemType", abstract: false, nillable: true, substitution_group: "xbrli:item" },
    labels: [{ type: "Standard Label", lang: "en", label_text: names[qname]?.[0] ?? qname }, { type: "Standard Label", lang: "cy", label_text: names[qname]?.[1] ?? qname }],
    references: [{ name: "FRS 102", paragraph: "17.1" }],
    ...(qname === "core:RevenueReference" ? { cross_ref_destination: revenue } : {}),
  };
}

export const relationships: DimensionalRelationshipsResponse = {
  selection: { qname: ppe, concept_type: "concept", matched_dimensions: [] },
  hypercubes: [{ hypercubeName: "core:PPEAnalysisTable", hypercubeELR: "urn:cake:table", definition: "PPE analysis", elr_id: 6053,
    dimensions: [{ dimensionName: "core:PPEClassesDimension", definition: "6052 - PPE Classes", elr_id: 6052, defaultMember: "core:AllPPE",
      domainMembers: [{ name: "core:AllPPE", label: "All PPE", label_cy: "Pob eiddo", children: [{ name: "core:Land", label: "Land", label_cy: "Tir", children: [] }] }] }],
    primaryItemsTree: [{ qname: "core:Assets", label: "Assets", children: [{ qname: ppe, label: names[ppe][0], label_cy: names[ppe][1], children: [] }] }],
  }],
};

export function results(year = "2026"): SearchConceptApiResult[] {
  return Array.from({ length: 27 }, (_, index) => ({ qname: index === 0 ? revenue : index === 1 ? ppe : `core:SearchResult${index}`, label: index === 0 ? "Turnover revenue" : `Property, plant and equipment ${index}`, local_name: index === 0 ? "TurnoverRevenue" : "PropertyPlantEquipment", namespace: `urn:cake:${year}`, balance: index === 0 ? "credit" : "debit", period_type: "instant", xbrl_type: "monetaryItemType", full_type: "xbrli:monetaryItemType", concept_type: "concept", abstract: false, nillable: true, score: 10, hypercubes: ["core:PPEAnalysisTable"] }));
}
