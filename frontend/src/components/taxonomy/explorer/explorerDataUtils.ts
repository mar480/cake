import { AdvancedSearchFilterOptions, AdvancedSearchFilters, AdvancedSearchResult } from "@/types/advancedSearch";

import { RawElrGroup, SearchConceptApiResult } from "./explorerTypes";

export function sanitizeAdvancedFilters(next: AdvancedSearchFilters): AdvancedSearchFilters {
  return {
    ...next,
    referenceSource:
      typeof next.referenceSource === "string" && next.referenceSource.trim()
        ? next.referenceSource
        : null,
    referenceParagraph: (Array.isArray(next.referenceParagraph) ? next.referenceParagraph : [])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0),
  };
}

export function mapTreesPayloadToNetworkMap(
  trees: Record<string, unknown>,
  excludedTreeKeys: Set<string>
): Record<string, RawElrGroup[]> {
  const treeMap: Record<string, RawElrGroup[]> = {};

  for (const [key, rawTree] of Object.entries(trees || {})) {
    const normalizedKey = key.replace(/_tree$/, "");
    if (excludedTreeKeys.has(normalizedKey)) continue;
    if (Array.isArray(rawTree)) {
      treeMap[normalizedKey] = rawTree as RawElrGroup[];
    }
  }

  return treeMap;
}

type SearchOptionsPayload = {
  namespace?: string[];
  balance?: string[];
  periodType?: string[];
  xbrlType?: string[];
  fullType?: string[];
  abstract?: boolean[];
  nillable?: boolean[];
  substitutionGroup?: string[];
  referenceSources?: string[];
};

export function mapSearchOptionsPayload(opts: SearchOptionsPayload): AdvancedSearchFilterOptions {
  return {
    namespace: opts.namespace ?? [],
    balance: opts.balance ?? [],
    periodType: opts.periodType ?? [],
    xbrlType: opts.xbrlType ?? [],
    fullType: opts.fullType ?? [],
    abstract: opts.abstract ?? [true, false],
    nillable: opts.nillable ?? [true, false],
    substitutionGroup: opts.substitutionGroup ?? [],
    referenceSources: opts.referenceSources ?? [],
  };
}

export function mapSearchResultsPayload(
  results: SearchConceptApiResult[],
  offset: number
): AdvancedSearchResult[] {
  return (results || []).map((result: SearchConceptApiResult, idx: number) => ({
    id: `${result.qname}-${offset + idx}`,
    qname: result.qname,
    localName: result.local_name,
    label: result.label,
    score: result.score,
    matchedFields: result.matched_fields ?? [],
  }));
}
