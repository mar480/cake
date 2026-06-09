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

export function splitHelpTextParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export const helpContent = {
  "app.overview": {
    id: "app.overview",
    title: "About this viewer",
    shortText:
      "This viewer helps you to explore the modelling used in the UK Taxonomy Suite",
    longText:
      "Start by choosing a year and an entrypoint. The tree shows how concepts are organised. When you select a concept, the details panels shows its properties, dimensional structures and tree locations",
  },
  "app.helpMode": {
    id: "app.helpMode",
    title: "App info mode",
    shortText:
      "App info mode displays glossary terms as UI hints explaining each aspect of the taxonomy viewer so beginners can explore the interface with less guesswork.",
    longText:
      "App info mode can also be toggled at any time using the button in the top navigation bar.",
  },
  "app.entrypoint": {
    id: "app.entrypoint",
    title: "Entry point",
    shortText:
      "An entry point is a specific starting file in a taxonomy. It loads the parts of the taxonomy needed for a particular reporting purpose.",
    longText:
      "In the UK taxonomies, there are different entry points available for each accounting standard (e.g. FRS 101, FRS 102) and for some Companies House-specific forms (e.g. CIC-34, DSEP-AA06).",
  },
  "app.yearSelector": {
    id: "app.yearSelector",
    title: "Year selector",
    shortText:
      "Choose which taxonomy release year you want to explore before loading an entrypoint.",
    longText:
      "The FRC releases a new taxonomy suite every year to reflect changes to reporting requirements, UK GAAP and UK-endorsed IFRS. \n\n Different years can have different concepts, labels, and structures.Preparers should confirm which year versions are valid for their needs by consulting HMRC and/or Companies House documentation.",
  },
  "app.networkSelector": {
    id: "app.networkSelector",
    title: "Network selector",
    shortText:
      "Switches between presentation and different definition relationship views.",
    longText:
      "Presentation shows the presentation tree reporting hierarchy. Definition networks show dimensional and structural relationships such as hypercubes, domains, members, and cross references. Click the arrows next to concepts to expand them and reveal their hierarchical structure. \n\n  Colours and icons are used in the tree view to indicate different concept types (e.g. monetary, string, percentage etc.).",
  },
  "app.languageSelector": {
    id: "app.languageSelector",
    title: "Language selector",
    shortText:
      "Changes whether labels are shown in English (default) or Welsh.",
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
      "These tabs explain the full meaning of a concept including its details, hypercube relationships, and tree locations, as well as the advanced search, and search results.",
    longText:
      "Pay particular attention to the balance, period and data type properties to undertand how the concept is intended to be used and the labels for any supporting information. \n\n References provide useful context, linking concepts with legislation, regulation and accounting standards. Some tabs only become available when the right context exists, such as a selected concept or a loaded entrypoint with search results.",
  },
  "details.tab.advancedSearch": {
    id: "details.tab.advancedSearch",
    title: "Advanced Search tab",
    shortText:
      "Lets you search concepts using keywords and XBRL-focused filters.",
    longText:
      "Users can also search by reference, if looking to understand how the taxonomy maps to specific legislation, regulation or accounting standards.",
  },
  "details.tab.hypercubeRelationships": {
    id: "details.tab.hypercubeRelationships",
    title: "Hypercube Relationships tab",
    shortText:
      "This tab shows how aspects of a concept can be further broken down using the dimensions available. Applying dimensions is common when tagging the Notes to the Accounts.",
    longText:
      "Concepts belong to hypercubes (tables). A hypercube (table) is a data structure made up of reportable concepts (rows) and available dimensions (columns). The UK taxonomies use closed hypercubes. This means that every line item concept belongs to at least one hypercube, and users cannot create their own taxonomy concepts.\n\n\ This tab shows the available dimensions (columns) as dropdown selectors. \n\n The contents of those dropdowns are the dimension's domain members. All of the other reportable concepts (rows) available in this hypercube are listed under \"Primary Items\". \n\n Hypercube tabs can be popped out to make it easier to compare the dimensional structure of different concepts.",
  },
  "details.tab.treeLocations": {
    id: "details.tab.treeLocations",
    title: "Tree Locations tab",
    shortText:
      "Shows where the selected concept appears across tree structures.",
    longText:
      "Concepts will appear in the presentation and definition trees according to the relationships defined in the taxonomy. This view can be used to  trace the relationships between concepts, hypercubes, dimensions and their domain members.\n\n Tree Node tabs can be popped out to make it easier to compare the locations of different concepts.",
  },
  "details.tab.searchResults": {
    id: "details.tab.searchResults",
    title: "Search Results tab",
    shortText:
      "Lists the concepts returned by the most recent advanced search.",
    longText:
      "Search results can be filtered by relevant taxonomy criteria. All filters applied can be toggled on and off. \n\n Click \"Go to node\" to navigate to the selected concept in any tree it appears, even in different entry points.\n\n Click \"Export results\" to export the results as csv and json.",
  },
  "advancedSearch.keyword": {
    id: "advancedSearch.keyword",
    title: "Keyword",
    shortText: "Use free text to search for concept names, labels, or qnames.",
    longText:
      "A keyword search is the quickest way to start - both normal text and concept QNames can be used. You can then narrow results with filters such as balance, period type, reference source, or data type.",
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
      "References connect concepts to legislation and accounting standards. This filter is useful when you want to find concepts linked to a particular accounting standard or legal source.",
  },
  "advancedSearch.referenceParagraph": {
    id: "advancedSearch.referenceParagraph",
    title: "Reference paragraph",
    shortText:
      "Filters by specific paragraphs within the selected reference source.",
    longText:
      "Choose a source first, then narrow the search to one or more cited paragraphs from that source.",
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
      "A namespace helps keep concept names unique and signals which standard or extension layer owns the concept. In the UK taxonomies, namespaces include: core, common, bus, countries and direp. Namespaces are used in concept qnames (i.e. core:CurrentAssets, countries:UnitedKingdom, bus:UKCompaniesHouseRegisteredNumber)",
  },
  "concept.balance": {
    id: "concept.balance",
    title: "Balance",
    shortText:
      "An attribute that indicates whether a monetary concept normally has a debit or credit balance. .",
    longText:
      "This is an accounting hint rather than a full validation rule. Assets and expenses are commonly debit. Liabilities, equity, and income are commonly credit.",
  },
  "concept.cashFlowClassification": {
    id: "concept.cashFlowClassification",
    title: "Cash flow classification",
    shortText:
      "Shows whether a cash flow concept should be considered as an inflow or outflow of cash.",
    longText:
      "This is a UK-specific relationship using custom inflow and outflow arcroles. They are optional for developers to implement but are included by the FRC to better understand the meaning of concepts in the cash flow statement.",
  },
  "concept.periodType": {
    id: "concept.periodType",
    title: "Period type",
    shortText:
      "Tells you whether a fact is measured at a point in time or across a period.",
    longText:
      "An instant concept is reported at one date, such as Current Assets (Balance Sheet). A duration concept covers a span of time, such as Revenue (Income Statement).",
  },
  "concept.dataType": {
    id: "concept.dataType",
    title: "Data type",
    shortText:
      "The schema data type that controls what kind of value this concept can hold.",
    longText:
      "This tells you whether the concept expects a monetary amount, string, date, boolean, decimal, or another structured value shape. Data types may assist the user in selecting the correct concept for their reporting requirements",
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
      "Abstract concepts structure the taxonomy but cannot be reported as facts.",
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
      "This is a UK-specific relationship using the custom cross-ref arcrole. Cross references help connect related concepts when one concept should be understood through another target concept in the taxonomy. They are optional for developers to implement but are included by the FRC to help users navigate the taxonomy more efficiently.",
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
