// src/components/taxonomy/explorer/searchResultDisplayUtils.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// src/components/taxonomy/explorer/explorerDataUtils.ts
function collectTreeNodeOccurrences(rawTreeData, qname) {
  if (!qname) return [];
  const occurrencesByTarget = /* @__PURE__ */ new Map();
  const addOccurrence = (occurrence) => {
    const occurrenceKey = `${occurrence.network}::${occurrence.elr}::${occurrence.qname}`;
    const existing = occurrencesByTarget.get(occurrenceKey);
    if (!existing || !existing.uuid && occurrence.uuid) {
      occurrencesByTarget.set(occurrenceKey, occurrence);
    }
  };
  const visitNode = (network, elr, elrDefinition, node) => {
    if (node.qname === qname) {
      addOccurrence({
        network,
        elr,
        elrDefinition,
        qname,
        uuid: node.uuid
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

// src/components/taxonomy/explorer/searchResultDisplayUtils.ts
var getOccurrenceDefinitionElrLabel = (occurrence) => occurrence.elrDefinition || occurrence.elr;
function getDefinitionElrLabelsForOccurrences(occurrences) {
  const labels = [];
  const seenElrs = /* @__PURE__ */ new Set();
  const seenElrDefinitions = /* @__PURE__ */ new Set();
  occurrences.filter((occurrence) => occurrence.network !== "presentation").forEach((occurrence) => {
    const label = getOccurrenceDefinitionElrLabel(occurrence);
    const hasSeenElr = occurrence.elr ? seenElrs.has(occurrence.elr) : false;
    const hasSeenElrDefinition = occurrence.elrDefinition ? seenElrDefinitions.has(occurrence.elrDefinition) : false;
    if (!label || hasSeenElr || hasSeenElrDefinition) return;
    if (occurrence.elr) seenElrs.add(occurrence.elr);
    if (occurrence.elrDefinition) seenElrDefinitions.add(occurrence.elrDefinition);
    labels.push(label);
  });
  return labels;
}

// src/components/taxonomy/explorer/searchResultDisplayUtils.test.ts
var TARGET_QNAME = "test:Revenue";
var SHARED_HYPERCUBE_QNAME = "test:SharedAnalysisTable";
describe("getDefinitionElrLabelsForOccurrences", () => {
  it("shows only concrete definition tree occurrences for a result QName, not reused hypercube memberships", () => {
    const rawTreeData = {
      definition_dommem: [
        {
          elr: "http://example.com/role/concrete-definition",
          definition: "Concrete Definition ELR",
          root_tree: [
            {
              qname: "test:Domain",
              children: [
                { qname: TARGET_QNAME, uuid: "target-definition-1" },
                { qname: TARGET_QNAME, uuid: "target-definition-duplicate" }
              ]
            }
          ]
        }
      ],
      definition_hydim: [
        {
          elr: "http://example.com/role/reused-analysis",
          definition: "Reused Analysis ELR",
          root_tree: [{ qname: SHARED_HYPERCUBE_QNAME, uuid: "shared-hypercube" }]
        }
      ],
      presentation: [
        {
          elr: "http://example.com/role/presentation",
          definition: "Presentation ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "target-presentation" }]
        }
      ]
    };
    const result = {
      qname: TARGET_QNAME,
      hypercubes: [SHARED_HYPERCUBE_QNAME]
    };
    const occurrences = collectTreeNodeOccurrences(rawTreeData, result.qname);
    assert.equal(result.hypercubes.includes(SHARED_HYPERCUBE_QNAME), true);
    assert.deepEqual(getDefinitionElrLabelsForOccurrences(occurrences), [
      "Concrete Definition ELR"
    ]);
  });
  it("deduplicates repeated concrete occurrences by ELR while preferring the ELR definition label", () => {
    const rawTreeData = {
      definition_dommem: [
        {
          elr: "http://example.com/role/repeated-definition",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "first" }]
        }
      ],
      definition_dimdom: [
        {
          elr: "http://example.com/role/repeated-definition",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "second" }]
        },
        {
          elr: "http://example.com/role/repeated-definition-alias",
          definition: "Repeated Definition ELR",
          root_tree: [{ qname: TARGET_QNAME, uuid: "third" }]
        }
      ]
    };
    const occurrences = collectTreeNodeOccurrences(rawTreeData, TARGET_QNAME);
    assert.deepEqual(getDefinitionElrLabelsForOccurrences(occurrences), [
      "Repeated Definition ELR"
    ]);
  });
});

// src/components/help/helpSystem.test.ts
import assert2 from "node:assert/strict";
import { describe as describe2, it as it2 } from "node:test";

// src/components/help/helpContent.ts
var helpContent = {
  "app.overview": {
    id: "app.overview",
    title: "About this viewer",
    shortText: "This viewer lets you choose a taxonomy year and entrypoint, browse the tree, and inspect concept details.",
    longText: "Start by choosing a year and an entrypoint. The tree shows how concepts are organised. When you select a concept, the details panel explains its labels, references, properties, and related structures."
  },
  "app.helpMode": {
    id: "app.helpMode",
    title: "Help mode",
    shortText: "Help mode makes inline hints more visible so beginners can explore the interface with less guesswork.",
    longText: "When help mode is on, the app keeps the main help launcher visible and makes glossary hints more prominent around key fields and concept metadata."
  },
  "app.entrypoint": {
    id: "app.entrypoint",
    title: "Entrypoint",
    shortText: "An entrypoint loads a particular slice of the taxonomy for you to explore.",
    longText: "A taxonomy can expose multiple entrypoints. Each one gathers a specific reporting view, such as a main filing entrypoint or a more focused reporting subset."
  },
  "app.yearSelector": {
    id: "app.yearSelector",
    title: "Year selector",
    shortText: "Choose which taxonomy release year you want to explore before loading an entrypoint.",
    longText: "Different years can have different concepts, labels, and structures. Start here when you want to compare or inspect a particular release."
  },
  "app.networkSelector": {
    id: "app.networkSelector",
    title: "Network selector",
    shortText: "Switches between presentation and different definition relationship views.",
    longText: "Presentation shows reporting structure. Definition networks show dimensional and structural relationships such as hypercubes, domains, members, and cross references."
  },
  "app.languageSelector": {
    id: "app.languageSelector",
    title: "Language selector",
    shortText: "Changes which labels are shown when the taxonomy provides multiple languages.",
    longText: "The technical concept stays the same. This only changes which human-readable labels you see in the explorer when translations exist."
  },
  "tree.search": {
    id: "tree.search",
    title: "Tree search",
    shortText: "Filters the currently loaded tree by matching labels, qnames, definitions, and ELR text.",
    longText: "This does not change the loaded taxonomy. It only narrows the visible nodes in the current tree and expands matching branches automatically."
  },
  "tree.exportFiltered": {
    id: "tree.exportFiltered",
    title: "Export filtered tree",
    shortText: "Exports the currently filtered tree view as JSON, CSV, HTML, or PNG.",
    longText: "Use this after narrowing the tree so you can review just the visible slice outside the explorer."
  },
  "details.tabs": {
    id: "details.tabs",
    title: "Details tabs",
    shortText: "These tabs switch between concept details, tree locations, hypercube relationships, advanced search, and search results.",
    longText: "Some tabs only become available when the right context exists, such as a selected concept or a loaded entrypoint with search results."
  },
  "details.tab.advancedSearch": {
    id: "details.tab.advancedSearch",
    title: "Advanced Search tab",
    shortText: "Lets you search concepts using keywords and XBRL-focused filters.",
    longText: "Use this when you know the kind of concept you want but not where it sits in the tree."
  },
  "details.tab.hypercubeRelationships": {
    id: "details.tab.hypercubeRelationships",
    title: "Hypercube Relationships tab",
    shortText: "Shows dimensional structures related to the selected concept.",
    longText: "This helps explain how the concept participates in dimensional reporting, including tables, axes, domains, and members."
  },
  "details.tab.treeLocations": {
    id: "details.tab.treeLocations",
    title: "Tree Locations tab",
    shortText: "Shows where the selected concept appears across tree structures.",
    longText: "This is useful when the same concept is reused in multiple locations or extended relationship sets."
  },
  "details.tab.searchResults": {
    id: "details.tab.searchResults",
    title: "Search Results tab",
    shortText: "Lists the concepts returned by the most recent advanced search.",
    longText: "Use it to move from a filtered concept list back into the tree and details views."
  },
  "advancedSearch.keyword": {
    id: "advancedSearch.keyword",
    title: "Keyword",
    shortText: "Use free text to search for concept names, labels, or qnames.",
    longText: "A keyword search is the quickest way to start. You can then narrow results with filters such as balance, period type, reference source, or data type."
  },
  "advancedSearch.balance": {
    id: "advancedSearch.balance",
    title: "Balance",
    shortText: "Indicates whether an accounting concept normally increases on the debit side or credit side.",
    longText: "A credit balance is common for income, liabilities, and equity. A debit balance is common for expenses and assets. Some taxonomies do not use this field for every concept.",
    beginnerExample: "Revenue is often credit. Expenses are often debit.",
    relatedHelpIds: ["concept.balance"]
  },
  "advancedSearch.periodType": {
    id: "advancedSearch.periodType",
    title: "Period type",
    shortText: "Tells you whether the fact is measured at one date or across a span of time.",
    longText: "Instant means point-in-time, such as cash at year end. Duration means over a period, such as revenue for the year.",
    relatedHelpIds: ["concept.periodType"]
  },
  "advancedSearch.xbrlType": {
    id: "advancedSearch.xbrlType",
    title: "XBRL type",
    shortText: "The base XBRL data type used to validate values for this concept.",
    longText: "This helps distinguish broad value families such as strings, monetary values, percentages, dates, and other structured XBRL types.",
    relatedHelpIds: ["concept.xbrlType"]
  },
  "advancedSearch.conceptType": {
    id: "advancedSearch.conceptType",
    title: "Concept type",
    shortText: "Helps you filter by the role a concept plays in the taxonomy structure.",
    longText: "This can separate ordinary reportable concepts from dimensions, members, or hypercubes used to organise dimensional reporting."
  },
  "advancedSearch.excludeNotInPresentationTree": {
    id: "advancedSearch.excludeNotInPresentationTree",
    title: "Presentation tree filter",
    shortText: "Use this to remove concepts that are not shown in the entrypoint presentation tree.",
    longText: "Some concepts exist in the taxonomy but are not presented in the current entrypoint tree. Turning this on keeps results focused on the visible presentation structure."
  },
  "advancedSearch.referenceSource": {
    id: "advancedSearch.referenceSource",
    title: "Reference source",
    shortText: "Filters search results by the source of attached references, such as a standard or regulation.",
    longText: "References connect concepts to reporting guidance. This filter is useful when you want to find concepts linked to a particular accounting standard or legal source."
  },
  "advancedSearch.referenceParagraph": {
    id: "advancedSearch.referenceParagraph",
    title: "Reference paragraph",
    shortText: "Filters by specific paragraphs within the selected reference source.",
    longText: "Choose a source first, then narrow the search to one or more cited paragraphs from that source."
  },
  "advancedSearch.namespace": {
    id: "advancedSearch.namespace",
    title: "Namespace",
    shortText: "A namespace tells you which taxonomy vocabulary a concept belongs to.",
    longText: "Namespaces help keep concept names unique across vocabularies. They are especially useful when a taxonomy combines multiple imported standards.",
    relatedHelpIds: ["concept.namespace"]
  },
  "advancedSearch.fullType": {
    id: "advancedSearch.fullType",
    title: "Full type",
    shortText: "The fully qualified type name used by the concept, including its namespace prefix.",
    longText: "This is a more specific technical type than the broad XBRL type. It can help when you need to find concepts using a particular schema type.",
    relatedHelpIds: ["concept.dataType"]
  },
  "advancedSearch.substitutionGroup": {
    id: "advancedSearch.substitutionGroup",
    title: "Substitution group",
    shortText: "Indicates the kind of XML element role the concept belongs to.",
    longText: "In practice this helps distinguish items, tuples, dimensions, hypercubes, and similar structural roles in an XBRL taxonomy.",
    relatedHelpIds: ["concept.substitutionGroup"]
  },
  "advancedSearch.abstract": {
    id: "advancedSearch.abstract",
    title: "Abstract",
    shortText: "Abstract concepts organise the taxonomy but are usually not reportable facts.",
    longText: "They are often used as headings, containers, or grouping nodes in a presentation tree rather than values you would report directly.",
    relatedHelpIds: ["concept.abstract"]
  },
  "advancedSearch.nillable": {
    id: "advancedSearch.nillable",
    title: "Nillable",
    shortText: "Indicates whether a reported fact may explicitly be empty or nil.",
    longText: "A nillable concept can be reported with an explicit nil value when the taxonomy and filing rules allow it.",
    relatedHelpIds: ["concept.nillable"]
  },
  "concept.name": {
    id: "concept.name",
    title: "Concept name",
    shortText: "The local concept name is the taxonomy's technical identifier for this concept.",
    longText: "This name is stable and machine-oriented. It is often less readable than labels, but it is useful for technical matching and navigation."
  },
  "concept.namespace": {
    id: "concept.namespace",
    title: "Namespace",
    shortText: "The namespace identifies which vocabulary or taxonomy module this concept comes from.",
    longText: "A namespace helps keep concept names unique and signals which standard or extension layer owns the concept."
  },
  "concept.balance": {
    id: "concept.balance",
    title: "Balance",
    shortText: "Shows whether the concept normally increases as debit or credit.",
    longText: "This is an accounting hint rather than a full validation rule. Assets and expenses are commonly debit. Liabilities, equity, and income are commonly credit."
  },
  "concept.cashFlowClassification": {
    id: "concept.cashFlowClassification",
    title: "Cash flow classification",
    shortText: "Shows which part of a cash flow statement the concept is usually associated with.",
    longText: "This can help place a concept within operating, investing, financing, or other cash flow reporting groupings when that metadata is present."
  },
  "concept.periodType": {
    id: "concept.periodType",
    title: "Period type",
    shortText: "Tells you whether a fact is measured at a point in time or across a period.",
    longText: "An instant concept is reported at one date, such as cash at year end. A duration concept covers a span of time, such as revenue for the year."
  },
  "concept.dataType": {
    id: "concept.dataType",
    title: "Data type",
    shortText: "The schema data type that controls what kind of value this concept can hold.",
    longText: "This tells you whether the concept expects a monetary amount, string, date, boolean, decimal, or another structured value shape."
  },
  "concept.xbrlType": {
    id: "concept.xbrlType",
    title: "XBRL type",
    shortText: "The base XBRL type groups concepts into broad value families.",
    longText: "This is a higher-level categorisation than the full schema data type and is useful when comparing concepts across a taxonomy."
  },
  "concept.substitutionGroup": {
    id: "concept.substitutionGroup",
    title: "Substitution group",
    shortText: "Shows what kind of XBRL element role this concept plays.",
    longText: "This is part of the XML schema structure and helps distinguish ordinary items from more structural concepts such as dimensions or hypercubes."
  },
  "concept.abstract": {
    id: "concept.abstract",
    title: "Abstract",
    shortText: "Abstract concepts structure the taxonomy but are usually not reported as facts.",
    longText: "They often behave like headings or containers in the tree rather than values that appear in a filing."
  },
  "concept.nillable": {
    id: "concept.nillable",
    title: "Nillable",
    shortText: "Shows whether the concept can be explicitly reported as nil.",
    longText: "Nil means the filing states that the fact is intentionally empty rather than simply omitted."
  },
  "concept.crossReferenceTarget": {
    id: "concept.crossReferenceTarget",
    title: "Cross reference target",
    shortText: "Points to another concept that this concept redirects to or references.",
    longText: "Cross references help connect related concepts when one concept should be understood through another target concept in the taxonomy."
  }
};
var helpContentList = Object.values(helpContent);
var glossaryCategoryOrder = [
  "App",
  "Details tab",
  "Concept",
  "Advanced Search"
];
function getHelpContent(helpId) {
  return helpContent[helpId];
}
function getHelpContentCategory(helpId) {
  const id = typeof helpId === "string" ? helpId : helpId.id;
  if (id.startsWith("app.")) {
    return "App";
  }
  if (id.startsWith("details.")) {
    return "Details tab";
  }
  if (id.startsWith("concept.")) {
    return "Concept";
  }
  return "Advanced Search";
}
function filterHelpContent(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = [...helpContentList].sort((left, right) => left.title.localeCompare(right.title));
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter(
    (entry) => [entry.title, entry.shortText, entry.longText ?? "", entry.id].join(" ").toLocaleLowerCase().includes(normalizedQuery)
  );
}
function getGlossaryEntries(query) {
  const rankedEntries = filterHelpContent(query);
  const entriesByTitle = /* @__PURE__ */ new Map();
  const getPriority = (entry) => {
    const category = getHelpContentCategory(entry);
    if (category === "Concept") {
      return 0;
    }
    if (category === "Details tab") {
      return 1;
    }
    if (category === "App") {
      return 2;
    }
    return 3;
  };
  for (const entry of rankedEntries) {
    const titleKey = entry.title.trim().toLocaleLowerCase();
    const existing = entriesByTitle.get(titleKey);
    if (!existing || getPriority(entry) < getPriority(existing)) {
      entriesByTitle.set(titleKey, entry);
    }
  }
  return [...entriesByTitle.values()].sort((left, right) => left.title.localeCompare(right.title));
}
function groupGlossaryEntries(entries) {
  const grouped = {
    App: [],
    "Details tab": [],
    Concept: [],
    "Advanced Search": []
  };
  for (const entry of entries) {
    grouped[getHelpContentCategory(entry)].push(entry);
  }
  for (const category of glossaryCategoryOrder) {
    grouped[category].sort((left, right) => left.title.localeCompare(right.title));
  }
  return grouped;
}

// src/components/help/tours.ts
async function waitForAvailableEntrypoint(context, timeoutMs = 5e3) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const candidate = context.explorer.state?.availableEntrypoints[0];
    if (context.explorer.state?.entrypointsYear === "2026" && candidate) {
      return candidate.href;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return null;
}
function pickBeginnerDemoEntrypoint(entrypoints) {
  const frs102 = entrypoints.find(
    (entrypoint) => /frs[\s-]*102/i.test(entrypoint.name) || /frs[\s-]*102/i.test(entrypoint.href)
  );
  return frs102?.href ?? entrypoints[0]?.href ?? null;
}
var tours = {
  "beginner-overview": {
    id: "beginner-overview",
    title: "Beginner overview",
    steps: [
      {
        id: "choose-year",
        targetAnchor: "year-selector",
        title: "Choose a taxonomy year",
        body: "The guided demo starts by selecting a real taxonomy year so the rest of the tour can use live entrypoints and trees.",
        placement: "bottom",
        helpId: "app.yearSelector",
        beforeStep: ({ explorer }) => {
          explorer.actions?.selectYear("2026");
        },
        waitFor: ({ explorer }) => explorer.state?.year === "2026" && explorer.state.entrypointsYear === "2026" && explorer.state.availableEntrypoints.length > 0,
        timeoutMs: 6e3
      },
      {
        id: "choose-entrypoint",
        targetAnchor: "entrypoint-selector",
        title: "Choose an entrypoint",
        body: "Now the tour loads a real entrypoint from the current year so the tree and details panel have live taxonomy data to work with.",
        loadingMessage: "The tour will continue when the entrypoint has loaded.",
        placement: "bottom",
        helpId: "app.entrypoint",
        beforeStep: async ({ explorer }) => {
          const candidateHref = pickBeginnerDemoEntrypoint(explorer.state?.availableEntrypoints ?? []) ?? await waitForAvailableEntrypoint({ explorer });
          if (candidateHref) {
            explorer.actions?.loadEntrypoint(candidateHref);
          }
        },
        waitFor: ({ explorer }) => {
          const candidateHref = pickBeginnerDemoEntrypoint(explorer.state?.availableEntrypoints ?? []);
          return Boolean(
            candidateHref && explorer.state?.entrypointLoaded && explorer.state.loadedEntrypoint === candidateHref
          );
        },
        timeoutMs: 15e3
      },
      {
        id: "browse-tree",
        targetAnchor: "taxonomy-tree-panel",
        title: "Browse the taxonomy tree",
        body: "The tree shows how concepts are organised. Select a concept here to inspect labels, references, and technical metadata.",
        placement: "right",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.selectNetwork("presentation");
            explorer.actions?.setTreeFilter("");
          }
        },
        waitFor: ({ explorer }) => !explorer.state?.entrypointLoaded || explorer.state.network === "presentation",
        timeoutMs: 1e4
      },
      {
        id: "filter-tree",
        targetAnchor: "taxonomy-tree-search",
        title: "Filter the current tree",
        body: "Use tree search to narrow the visible concepts without changing the loaded taxonomy. The tour falls back gracefully if the tree controls are not visible yet.",
        placement: "right",
        helpId: "tree.search",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.setTreeFilter("current assets");
          }
        },
        waitFor: ({ explorer }) => !explorer.state?.entrypointLoaded || explorer.state.treeFilter === "current assets",
        timeoutMs: 3e3
      },
      {
        id: "inspect-details",
        targetAnchor: "details-panel",
        title: "Inspect concept details",
        body: "When a concept is selected, this panel explains its properties and gives you richer context for beginner-unfriendly terms.",
        placement: "left",
        helpId: "details.tabs",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.navigateToConcept("core:CurrentAssets");
            explorer.actions?.openDetailsTab("Details");
          }
        },
        waitFor: ({ explorer }) => explorer.state?.selectedConceptQname === "core:CurrentAssets" && explorer.state.activeDetailsTab === "Details",
        timeoutMs: 5e3
      },
      {
        id: "hypercube-relationships-tab",
        targetAnchor: "details-tab-hypercube-relationships",
        title: "Show hypercube relationships",
        body: "This tab is often the most useful next step after properties because it shows how the selected concept participates in tables, dimensions, domains, and members.",
        placement: "left",
        helpId: "details.tab.hypercubeRelationships",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.selectedConceptQname) {
            explorer.actions?.openDetailsTab("Hypercube Relationships");
          }
        },
        waitFor: ({ explorer }) => explorer.state?.activeDetailsTab === "Hypercube Relationships",
        timeoutMs: 4e3
      },
      {
        id: "tree-locations-tab",
        targetAnchor: "details-tab-tree-locations",
        title: "Open a non-default details tab",
        body: "With a concept selected, the demo intentionally switches to Tree Locations so you can see the guided tour control a tab that depends on concept context.",
        placement: "left",
        helpId: "details.tab.treeLocations",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.selectedConceptQname) {
            explorer.actions?.openDetailsTab("Tree Locations");
          }
        },
        waitFor: ({ explorer }) => explorer.state?.activeDetailsTab === "Tree Locations",
        timeoutMs: 4e3
      },
      {
        id: "advanced-search-tab",
        targetAnchor: "details-tab-advanced-search",
        title: "Switch to advanced search",
        body: "The demo finishes by opening Advanced Search. This shows that the guided runtime can move between different explorer surfaces after it has loaded and explored live taxonomy data.",
        placement: "left",
        helpId: "details.tab.advancedSearch",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.openDetailsTab("Advanced Search");
            explorer.actions?.setAdvancedSearchQuery("Turnover");
          }
        },
        waitFor: ({ explorer }) => explorer.state?.activeDetailsTab === "Advanced Search" && explorer.state.advancedSearchQuery === "Turnover",
        timeoutMs: 4e3
      },
      {
        id: "advanced-search-view",
        targetAnchor: "details-view-search-results",
        title: "Explore filtered search",
        body: "The tour now runs a real keyword search for Turnover and shows the matching results so you can move from search back into tree-based inspection.",
        placement: "left",
        helpId: "details.tab.advancedSearch",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.activeDetailsTab === "Advanced Search") {
            explorer.actions?.runAdvancedSearch();
          }
        },
        waitFor: ({ explorer }) => explorer.state?.activeDetailsTab === "Search Results" && explorer.state.advancedSearchHasRun && !explorer.state.advancedSearchLoading && explorer.state.advancedSearchResultCount > 0,
        timeoutMs: 1e4
      }
    ]
  }
};
function getTour(tourId) {
  if (!tourId) {
    return null;
  }
  return tours[tourId] ?? null;
}

// src/components/help/tourRuntime.ts
function buildTourStepExecutionKey(activeTourId, activeStepIndex, stepId) {
  if (!activeTourId || !stepId) {
    return null;
  }
  return `${activeTourId}:${activeStepIndex}:${stepId}`;
}
function getHelpHomeOpenState() {
  return {
    activeTourId: null,
    activeStepIndex: 0,
    helpHomeOpen: true
  };
}
async function prepareTourStep({
  step,
  getRuntime,
  isCancelled = () => false,
  pollIntervalMs = 120,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onBeforeStepError
}) {
  if (isCancelled()) {
    return "cancelled";
  }
  try {
    await step.beforeStep?.(getRuntime());
  } catch (error) {
    onBeforeStepError?.(error);
    return isCancelled() ? "cancelled" : "failed";
  }
  if (isCancelled()) {
    return "cancelled";
  }
  if (!step.waitFor) {
    return "ready";
  }
  const startedAt = now();
  const timeoutMs = step.timeoutMs ?? 4e3;
  while (!isCancelled()) {
    if (step.waitFor(getRuntime())) {
      return "ready";
    }
    if (now() - startedAt >= timeoutMs) {
      return "timed_out";
    }
    await sleep(pollIntervalMs);
  }
  return "cancelled";
}

// src/components/help/helpSystem.test.ts
describe2("helpContent", () => {
  it2("keeps help ids unique and aligned with their map keys", () => {
    const ids = helpContentList.map((entry) => entry.id);
    assert2.equal(new Set(ids).size, ids.length);
    for (const [key, entry] of Object.entries(helpContent)) {
      assert2.equal(entry.id, key);
      assert2.ok(entry.title.trim().length > 0);
      assert2.ok(entry.shortText.trim().length > 0);
    }
  });
  it2("only references related help ids that exist", () => {
    const knownIds = new Set(Object.keys(helpContent));
    for (const entry of helpContentList) {
      for (const relatedId of entry.relatedHelpIds ?? []) {
        assert2.equal(knownIds.has(relatedId), true, `${entry.id} references missing id ${relatedId}`);
      }
    }
  });
  it2("returns help entries by id", () => {
    const entry = getHelpContent("concept.periodType");
    assert2.equal(entry.title, "Period type");
  });
  it2("filters glossary entries by representative search terms", () => {
    assert2.equal(filterHelpContent("entrypoint").some((entry) => entry.id === "app.entrypoint"), true);
    assert2.equal(filterHelpContent("credit").some((entry) => entry.id === "concept.balance"), true);
    assert2.equal(filterHelpContent("hypercube").some((entry) => entry.id === "details.tab.hypercubeRelationships"), true);
  });
  it2("deduplicates glossary entries by title while preferring concept terms", () => {
    const entries = getGlossaryEntries("balance");
    assert2.equal(entries.some((entry) => entry.id === "concept.balance"), true);
    assert2.equal(entries.some((entry) => entry.id === "advancedSearch.balance"), false);
  });
  it2("groups glossary entries under the expected headings", () => {
    const grouped = groupGlossaryEntries(getGlossaryEntries(""));
    assert2.equal(grouped.App.some((entry) => entry.id === "app.entrypoint"), true);
    assert2.equal(grouped["Details tab"].some((entry) => entry.id === "details.tab.treeLocations"), true);
    assert2.equal(grouped.Concept.some((entry) => entry.id === "concept.balance"), true);
    assert2.equal(grouped["Advanced Search"].some((entry) => entry.id === "advancedSearch.keyword"), true);
  });
});
describe2("tours", () => {
  it2("exposes the beginner overview tour with stable step metadata", () => {
    const tour = getTour("beginner-overview");
    assert2.ok(tour);
    assert2.equal(tour?.id, "beginner-overview");
    assert2.equal(tour?.steps.length, 9);
    for (const step of tour?.steps ?? []) {
      assert2.ok(step.id.trim().length > 0);
      assert2.ok(step.targetAnchor.trim().length > 0);
      assert2.ok(step.title.trim().length > 0);
      assert2.ok(step.body.trim().length > 0);
    }
  });
  it2("includes demo-capable steps with beforeStep and waitFor hooks", () => {
    const tour = getTour("beginner-overview");
    const filterStep = tour?.steps.find((step) => step.id === "filter-tree");
    const hypercubeStep = tour?.steps.find((step) => step.id === "hypercube-relationships-tab");
    const treeLocationsStep = tour?.steps.find((step) => step.id === "tree-locations-tab");
    const advancedSearchStep = tour?.steps.find((step) => step.id === "advanced-search-tab");
    assert2.equal(typeof filterStep?.beforeStep, "function");
    assert2.equal(typeof filterStep?.waitFor, "function");
    assert2.equal(typeof hypercubeStep?.beforeStep, "function");
    assert2.equal(typeof hypercubeStep?.waitFor, "function");
    assert2.equal(typeof treeLocationsStep?.beforeStep, "function");
    assert2.equal(typeof treeLocationsStep?.waitFor, "function");
    assert2.equal(typeof advancedSearchStep?.beforeStep, "function");
    assert2.equal(typeof advancedSearchStep?.waitFor, "function");
  });
  it2("prefers an FRS 102 entrypoint for the beginner demo when available", () => {
    const href = pickBeginnerDemoEntrypoint([
      { name: "FRS 101", href: "/frs-101" },
      { name: "FRS 102", href: "/frs-102" }
    ]);
    assert2.equal(href, "/frs-102");
  });
  it2("returns null for unknown tours", () => {
    assert2.equal(getTour("missing-tour"), null);
  });
  it2("keeps exported tour ids aligned with their object keys", () => {
    for (const [key, tour] of Object.entries(tours)) {
      assert2.equal(tour.id, key);
    }
  });
});
describe2("tourRuntime", () => {
  it2("builds a stable execution key per active step", () => {
    assert2.equal(
      buildTourStepExecutionKey("beginner-overview", 2, "browse-tree"),
      "beginner-overview:2:browse-tree"
    );
    assert2.equal(buildTourStepExecutionKey(null, 2, "browse-tree"), null);
    assert2.equal(buildTourStepExecutionKey("beginner-overview", 2, null), null);
  });
  it2("opens help home by clearing the active tour state", () => {
    assert2.deepEqual(getHelpHomeOpenState(), {
      activeTourId: null,
      activeStepIndex: 0,
      helpHomeOpen: true
    });
  });
  it2("runs beforeStep once per preparation and resolves when the step becomes ready", async () => {
    let beforeStepCalls = 0;
    let ready = false;
    const result = await prepareTourStep({
      step: {
        id: "choose-entrypoint",
        targetAnchor: "entrypoint-selector",
        title: "Choose an entrypoint",
        body: "Loads one entrypoint and waits for the explorer to finish.",
        beforeStep: async () => {
          beforeStepCalls += 1;
          ready = true;
        },
        waitFor: () => ready,
        timeoutMs: 100
      },
      getRuntime: () => ({ explorer: { actions: null, state: null } }),
      sleep: async () => void 0
    });
    assert2.equal(result, "ready");
    assert2.equal(beforeStepCalls, 1);
  });
  it2("times out cleanly when the wait condition never becomes true", async () => {
    let nowValue = 0;
    const result = await prepareTourStep({
      step: {
        id: "choose-entrypoint",
        targetAnchor: "entrypoint-selector",
        title: "Choose an entrypoint",
        body: "Loads one entrypoint and waits for the explorer to finish.",
        waitFor: () => false,
        timeoutMs: 60
      },
      getRuntime: () => ({ explorer: { actions: null, state: null } }),
      now: () => {
        nowValue += 30;
        return nowValue;
      },
      sleep: async () => void 0
    });
    assert2.equal(result, "timed_out");
  });
});
