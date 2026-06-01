import type { AdvancedSearchFilterOptions, AdvancedSearchFilters, AdvancedSearchResult } from "@/types/advancedSearch";

import type { RawElrGroup, RawTreeNode, SearchConceptApiResult } from "./explorerTypes";

export type ConceptElrMap = Record<string, string[]>;
export type ConceptNetworksMap = Record<string, string[]>;
export type ConceptLocationIndex = Record<string, Record<string, Record<string, string[]>>>;
export type TreeNodeOccurrence = {
  network: string;
  elr: string;
  elrDefinition: string;
  qname: string;
  uuid?: string;
};

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

function walkTree(
  node: RawTreeNode,
  visit: (currentNode: RawTreeNode) => void
) {
  visit(node);
  (node.children ?? []).forEach((child) => walkTree(child, visit));
}

export function collectTreeNodeOccurrences(
  rawTreeData: Record<string, RawElrGroup[]>,
  qname: string | undefined
): TreeNodeOccurrence[] {
  if (!qname) return [];

  const occurrencesByTarget = new Map<string, TreeNodeOccurrence>();

  // The same QName can be encountered multiple times for the same network/ELR target;
  // keep one concrete UUID-backed representative so the menu does not show duplicates.
  const addOccurrence = (occurrence: TreeNodeOccurrence) => {
    const occurrenceKey = `${occurrence.network}::${occurrence.elr}::${occurrence.qname}`;
    const existing = occurrencesByTarget.get(occurrenceKey);
    if (!existing || (!existing.uuid && occurrence.uuid)) {
      occurrencesByTarget.set(occurrenceKey, occurrence);
    }
  };

  const visitNode = (network: string, elr: string, elrDefinition: string, node: RawTreeNode) => {
    if (node.qname === qname) {
      addOccurrence({
        network,
        elr,
        elrDefinition,
        qname,
        uuid: node.uuid,
      });
    }

    (node.children ?? []).forEach((child) => visitNode(network, elr, elrDefinition, child));
  };

  Object.entries(rawTreeData).forEach(([network, groups]) => {
    (groups ?? []).forEach((group) => {
      const elr = group.elr ?? "";
      const elrDefinition = group.definition ?? elr;
      (group.root_tree ?? []).forEach((root) => visitNode(network, elr, elrDefinition, root));
    });
  });

  return Array.from(occurrencesByTarget.values());
}

export function buildConceptElrMapForNetwork(groups: RawElrGroup[]): ConceptElrMap {
  const elrsByQname = new Map<string, string[]>();

  const addElr = (qname: string, elrDefinition: string) => {
    if (!qname || !elrDefinition) return;
    const existing = elrsByQname.get(qname) ?? [];
    if (!existing.includes(elrDefinition)) {
      existing.push(elrDefinition);
      elrsByQname.set(qname, existing);
    }
  };

  groups.forEach((group) => {
    const elrDefinition = group.definition ?? group.elr ?? "";
    (group.root_tree ?? []).forEach((root) =>
      walkTree(root, (node) => {
        if (node.qname) {
          addElr(node.qname, elrDefinition);
        }
      })
    );
  });

  return Object.fromEntries(elrsByQname);
}

export function buildConceptNetworksMap(rawTreeData: Record<string, RawElrGroup[]>): ConceptNetworksMap {
  const networksByQname = new Map<string, Set<string>>();

  Object.entries(rawTreeData).forEach(([networkKey, groups]) => {
    (groups ?? []).forEach((group) => {
      (group.root_tree ?? []).forEach((root) =>
        walkTree(root, (node) => {
          if (!node.qname) return;
          if (!networksByQname.has(node.qname)) {
            networksByQname.set(node.qname, new Set<string>());
          }
          networksByQname.get(node.qname)?.add(networkKey);
        })
      );
    });
  });

  return Object.fromEntries(
    Array.from(networksByQname.entries()).map(([qname, networks]) => [qname, Array.from(networks)])
  );
}

export function buildConceptLocationsForEntrypoint(
  rawTreeData: Record<string, RawElrGroup[]>
): Record<string, Record<string, string[]>> {
  const conceptLocations = new Map<string, Map<string, string[]>>();

  Object.entries(rawTreeData).forEach(([networkKey, groups]) => {
    const networkElrs = buildConceptElrMapForNetwork(groups ?? []);
    Object.entries(networkElrs).forEach(([qname, elrs]) => {
      if (!conceptLocations.has(qname)) {
        conceptLocations.set(qname, new Map<string, string[]>());
      }
      conceptLocations.get(qname)?.set(networkKey, elrs);
    });
  });

  return Object.fromEntries(
    Array.from(conceptLocations.entries()).map(([qname, networks]) => [qname, Object.fromEntries(networks)])
  );
}

export function mergeConceptLocationIndex(
  existing: ConceptLocationIndex,
  entrypointHref: string,
  rawTreeData: Record<string, RawElrGroup[]>
): ConceptLocationIndex {
  if (!entrypointHref) return existing;

  const next: ConceptLocationIndex = { ...existing };
  const conceptLocations = buildConceptLocationsForEntrypoint(rawTreeData);

  Object.entries(conceptLocations).forEach(([qname, networks]) => {
    next[qname] = {
      ...(next[qname] ?? {}),
      [entrypointHref]: networks,
    };
  });

  return next;
}

type SearchOptionsPayload = {
  namespace?: string[];
  balance?: string[];
  periodType?: string[];
  xbrlType?: string[];
  conceptType?: string[];
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
    conceptType: opts.conceptType ?? [],
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
    namespace: result.namespace,
    balance: result.balance,
    periodType: result.period_type,
    xbrlType: result.xbrl_type,
    fullType: result.full_type,
    abstract: result.abstract,
    nillable: result.nillable,
    conceptType: result.concept_type,
    substitutionGroup: result.substitution_group,
    hypercubes: result.hypercubes ?? [],
    referenceDisplays: result.reference_displays ?? [],
    score: result.score,
    matchedFields: result.matched_fields ?? [],
  }));
}
