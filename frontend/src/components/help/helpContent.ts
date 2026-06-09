export type HelpContentEntry = {
  id: string;
  title: string;
  shortText: string;
  longText?: string;
  beginnerExample?: string;
  relatedHelpIds?: string[];
};

export type HelpContentCategory =
  | "App"
  | "Details tab"
  | "Concept"
  | "Advanced Search";

export const helpContent = {
  "app.overview": {
    id: "app.overview",
    title: "About this viewer",
    shortText:
      "This viewer lets you choose a taxonomy year and entrypoint, browse the tree, and inspect concept details.",
    longText:
      "Start by choosing a year and an entrypoint. The tree shows how concepts are organised. When you select a concept, the details panel explains its labels, references, properties, and related structures.",
  },
  "app.helpMode": {
    id: "app.helpMode",
    title: "Help mode",
    shortText:
      "Help mode makes inline hints more visible so beginners can explore the interface with less guesswork.",
    longText:
      "When help mode is on, the app keeps the main help launcher visible and makes glossary hints more prominent around key fields and concept metadata.",
  },
  "app.entrypoint": {
    id: "app.entrypoint",
    title: "Entrypoint",
    shortText:
      "An entrypoint loads a particular slice of the taxonomy for you to explore.",
    longText:
      "A taxonomy can expose multiple entrypoints. Each one gathers a specific reporting view, such as a main filing entrypoint or a more focused reporting subset.",
  },
  "app.yearSelector": {
    id: "app.yearSelector",
    title: "Year selector",
    shortText:
      "Choose which taxonomy release year you want to explore before loading an entrypoint.",
    longText:
      "Different years can have different concepts, labels, and structures. Start here when you want to compare or inspect a particular release.",
  },
  "app.networkSelector": {
    id: "app.networkSelector",
    title: "Network selector",
    shortText:
      "Switches between presentation and different definition relationship views.",
    longText:
      "Presentation shows reporting structure. Definition networks show dimensional and structural relationships such as hypercubes, domains, members, and cross references.",
  },
  "app.languageSelector": {
    id: "app.languageSelector",
    title: "Language selector",
    shortText:
      "Changes which labels are shown when the taxonomy provides multiple languages.",
    longText:
      "The technical concept stays the same. This only changes which human-readable labels you see in the explorer when translations exist.",
  },
  "tree.search": {
    id: "tree.search",
    title: "Tree search",
    shortText:
      "Filters the currently loaded tree by matching labels, qnames, definitions, and ELR text.",
    longText:
      "This does not change the loaded taxonomy. It only narrows the visible nodes in the current tree and expands matching branches automatically.",
  },
  "tree.exportFiltered": {
    id: "tree.exportFiltered",
    title: "Export filtered tree",
    shortText:
      "Exports the currently filtered tree view as JSON, CSV, HTML, or PNG.",
    longText:
      "Use this after narrowing the tree so you can review just the visible slice outside the explorer.",
  },
  "details.tabs": {
    id: "details.tabs",
    title: "Details tabs",
    shortText:
      "These tabs switch between concept details, tree locations, hypercube relationships, advanced search, and search results.",
    longText:
      "Some tabs only become available when the right context exists, such as a selected concept or a loaded entrypoint with search results.",
  },
  "details.tab.advancedSearch": {
    id: "details.tab.advancedSearch",
    title: "Advanced Search tab",
    shortText:
      "Lets you search concepts using keywords and XBRL-focused filters.",
    longText:
      "Use this when you know the kind of concept you want but not where it sits in the tree.",
  },
  "details.tab.hypercubeRelationships": {
    id: "details.tab.hypercubeRelationships",
    title: "Hypercube Relationships tab",
    shortText:
      "Shows dimensional structures related to the selected concept.",
    longText:
      "This helps explain how the concept participates in dimensional reporting, including tables, axes, domains, and members.",
  },
  "details.tab.treeLocations": {
    id: "details.tab.treeLocations",
    title: "Tree Locations tab",
    shortText:
      "Shows where the selected concept appears across tree structures.",
    longText:
      "This is useful when the same concept is reused in multiple locations or extended relationship sets.",
  },
  "details.tab.searchResults": {
    id: "details.tab.searchResults",
    title: "Search Results tab",
    shortText:
      "Lists the concepts returned by the most recent advanced search.",
    longText:
      "Use it to move from a filtered concept list back into the tree and details views.",
  },
  "advancedSearch.keyword": {
    id: "advancedSearch.keyword",
    title: "Keyword",
    shortText: "Use free text to search for concept names, labels, or qnames.",
    longText:
      "A keyword search is the quickest way to start. You can then narrow results with filters such as balance, period type, reference source, or data type.",
  },
  "advancedSearch.balance": {
    id: "advancedSearch.balance",
    title: "Balance",
    shortText:
      "Indicates whether an accounting concept normally increases on the debit side or credit side.",
    longText:
      "A credit balance is common for income, liabilities, and equity. A debit balance is common for expenses and assets. Some taxonomies do not use this field for every concept.",
    beginnerExample:
      "Revenue is often credit. Expenses are often debit.",
    relatedHelpIds: ["concept.balance"],
  },
  "advancedSearch.periodType": {
    id: "advancedSearch.periodType",
    title: "Period type",
    shortText:
      "Tells you whether the fact is measured at one date or across a span of time.",
    longText:
      "Instant means point-in-time, such as cash at year end. Duration means over a period, such as revenue for the year.",
    relatedHelpIds: ["concept.periodType"],
  },
  "advancedSearch.xbrlType": {
    id: "advancedSearch.xbrlType",
    title: "XBRL type",
    shortText:
      "The base XBRL data type used to validate values for this concept.",
    longText:
      "This helps distinguish broad value families such as strings, monetary values, percentages, dates, and other structured XBRL types.",
    relatedHelpIds: ["concept.xbrlType"],
  },
  "advancedSearch.conceptType": {
    id: "advancedSearch.conceptType",
    title: "Concept type",
    shortText:
      "Helps you filter by the role a concept plays in the taxonomy structure.",
    longText:
      "This can separate ordinary reportable concepts from dimensions, members, or hypercubes used to organise dimensional reporting.",
  },
  "advancedSearch.excludeNotInPresentationTree": {
    id: "advancedSearch.excludeNotInPresentationTree",
    title: "Presentation tree filter",
    shortText:
      "Use this to remove concepts that are not shown in the entrypoint presentation tree.",
    longText:
      "Some concepts exist in the taxonomy but are not presented in the current entrypoint tree. Turning this on keeps results focused on the visible presentation structure.",
  },
  "advancedSearch.referenceSource": {
    id: "advancedSearch.referenceSource",
    title: "Reference source",
    shortText:
      "Filters search results by the source of attached references, such as a standard or regulation.",
    longText:
      "References connect concepts to reporting guidance. This filter is useful when you want to find concepts linked to a particular accounting standard or legal source.",
  },
  "advancedSearch.referenceParagraph": {
    id: "advancedSearch.referenceParagraph",
    title: "Reference paragraph",
    shortText:
      "Filters by specific paragraphs within the selected reference source.",
    longText:
      "Choose a source first, then narrow the search to one or more cited paragraphs from that source.",
  },
  "advancedSearch.namespace": {
    id: "advancedSearch.namespace",
    title: "Namespace",
    shortText:
      "A namespace tells you which taxonomy vocabulary a concept belongs to.",
    longText:
      "Namespaces help keep concept names unique across vocabularies. They are especially useful when a taxonomy combines multiple imported standards.",
    relatedHelpIds: ["concept.namespace"],
  },
  "advancedSearch.fullType": {
    id: "advancedSearch.fullType",
    title: "Full type",
    shortText:
      "The fully qualified type name used by the concept, including its namespace prefix.",
    longText:
      "This is a more specific technical type than the broad XBRL type. It can help when you need to find concepts using a particular schema type.",
    relatedHelpIds: ["concept.dataType"],
  },
  "advancedSearch.substitutionGroup": {
    id: "advancedSearch.substitutionGroup",
    title: "Substitution group",
    shortText:
      "Indicates the kind of XML element role the concept belongs to.",
    longText:
      "In practice this helps distinguish items, tuples, dimensions, hypercubes, and similar structural roles in an XBRL taxonomy.",
    relatedHelpIds: ["concept.substitutionGroup"],
  },
  "advancedSearch.abstract": {
    id: "advancedSearch.abstract",
    title: "Abstract",
    shortText:
      "Abstract concepts organise the taxonomy but are usually not reportable facts.",
    longText:
      "They are often used as headings, containers, or grouping nodes in a presentation tree rather than values you would report directly.",
    relatedHelpIds: ["concept.abstract"],
  },
  "advancedSearch.nillable": {
    id: "advancedSearch.nillable",
    title: "Nillable",
    shortText:
      "Indicates whether a reported fact may explicitly be empty or nil.",
    longText:
      "A nillable concept can be reported with an explicit nil value when the taxonomy and filing rules allow it.",
    relatedHelpIds: ["concept.nillable"],
  },
  "concept.name": {
    id: "concept.name",
    title: "Concept name",
    shortText:
      "The local concept name is the taxonomy's technical identifier for this concept.",
    longText:
      "This name is stable and machine-oriented. It is often less readable than labels, but it is useful for technical matching and navigation.",
  },
  "concept.namespace": {
    id: "concept.namespace",
    title: "Namespace",
    shortText:
      "The namespace identifies which vocabulary or taxonomy module this concept comes from.",
    longText:
      "A namespace helps keep concept names unique and signals which standard or extension layer owns the concept.",
  },
  "concept.balance": {
    id: "concept.balance",
    title: "Balance",
    shortText:
      "Shows whether the concept normally increases as debit or credit.",
    longText:
      "This is an accounting hint rather than a full validation rule. Assets and expenses are commonly debit. Liabilities, equity, and income are commonly credit.",
  },
  "concept.cashFlowClassification": {
    id: "concept.cashFlowClassification",
    title: "Cash flow classification",
    shortText:
      "Shows which part of a cash flow statement the concept is usually associated with.",
    longText:
      "This can help place a concept within operating, investing, financing, or other cash flow reporting groupings when that metadata is present.",
  },
  "concept.periodType": {
    id: "concept.periodType",
    title: "Period type",
    shortText:
      "Tells you whether a fact is measured at a point in time or across a period.",
    longText:
      "An instant concept is reported at one date, such as cash at year end. A duration concept covers a span of time, such as revenue for the year.",
  },
  "concept.dataType": {
    id: "concept.dataType",
    title: "Data type",
    shortText:
      "The schema data type that controls what kind of value this concept can hold.",
    longText:
      "This tells you whether the concept expects a monetary amount, string, date, boolean, decimal, or another structured value shape.",
  },
  "concept.xbrlType": {
    id: "concept.xbrlType",
    title: "XBRL type",
    shortText:
      "The base XBRL type groups concepts into broad value families.",
    longText:
      "This is a higher-level categorisation than the full schema data type and is useful when comparing concepts across a taxonomy.",
  },
  "concept.substitutionGroup": {
    id: "concept.substitutionGroup",
    title: "Substitution group",
    shortText:
      "Shows what kind of XBRL element role this concept plays.",
    longText:
      "This is part of the XML schema structure and helps distinguish ordinary items from more structural concepts such as dimensions or hypercubes.",
  },
  "concept.abstract": {
    id: "concept.abstract",
    title: "Abstract",
    shortText:
      "Abstract concepts structure the taxonomy but are usually not reported as facts.",
    longText:
      "They often behave like headings or containers in the tree rather than values that appear in a filing.",
  },
  "concept.nillable": {
    id: "concept.nillable",
    title: "Nillable",
    shortText:
      "Shows whether the concept can be explicitly reported as nil.",
    longText:
      "Nil means the filing states that the fact is intentionally empty rather than simply omitted.",
  },
  "concept.crossReferenceTarget": {
    id: "concept.crossReferenceTarget",
    title: "Cross reference target",
    shortText:
      "Points to another concept that this concept redirects to or references.",
    longText:
      "Cross references help connect related concepts when one concept should be understood through another target concept in the taxonomy.",
  },
} as const satisfies Record<string, HelpContentEntry>;

export type HelpContentId = keyof typeof helpContent;

export const helpContentList = Object.values(helpContent);

export const glossaryCategoryOrder: HelpContentCategory[] = [
  "App",
  "Details tab",
  "Concept",
  "Advanced Search",
];

export function getHelpContent(helpId: HelpContentId): HelpContentEntry {
  return helpContent[helpId];
}

export function getHelpContentCategory(helpId: HelpContentId | HelpContentEntry): HelpContentCategory {
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

export function filterHelpContent(query: string): HelpContentEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const entries = [...helpContentList].sort((left, right) => left.title.localeCompare(right.title));

  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) =>
    [entry.title, entry.shortText, entry.longText ?? "", entry.id]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
}

export function getGlossaryEntries(query: string): HelpContentEntry[] {
  const rankedEntries = filterHelpContent(query);
  const entriesByTitle = new Map<string, HelpContentEntry>();

  const getPriority = (entry: HelpContentEntry) => {
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

export function groupGlossaryEntries(entries: HelpContentEntry[]): Record<HelpContentCategory, HelpContentEntry[]> {
  const grouped = {
    App: [] as HelpContentEntry[],
    "Details tab": [] as HelpContentEntry[],
    Concept: [] as HelpContentEntry[],
    "Advanced Search": [] as HelpContentEntry[],
  };

  for (const entry of entries) {
    grouped[getHelpContentCategory(entry)].push(entry);
  }

  for (const category of glossaryCategoryOrder) {
    grouped[category].sort((left, right) => left.title.localeCompare(right.title));
  }

  return grouped;
}
