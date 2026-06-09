import { HelpContentId } from "./helpContent";
import { ExplorerDemoActions, ExplorerDemoState } from "@/components/taxonomy/explorer/explorerHelpTypes";

export type TourRuntimeContext = {
  explorer: {
    actions: ExplorerDemoActions | null;
    state: ExplorerDemoState | null;
    getActions?: () => ExplorerDemoActions | null;
    getState?: () => ExplorerDemoState | null;
  };
};

export type TourStep = {
  id: string;
  targetAnchor: string;
  spotlightAnchors?: string[];
  spotlightStrategy?: "merge" | "separate";
  cardAnchor?: string;
  spotlightPadding?: number;
  spotlightRadius?: number;
  title: string;
  body: string;
  loadingMessage?: string;
  placement?: "top" | "right" | "bottom" | "left" | "center";
  helpId?: HelpContentId;
  beforeStep?: (context: TourRuntimeContext) => Promise<void> | void;
  waitFor?: (context: TourRuntimeContext) => boolean;
  timeoutMs?: number;
};

export type TourDefinition = {
  id: string;
  title: string;
  steps: TourStep[];
};

async function waitForAvailableEntrypoint(
  context: TourRuntimeContext,
  timeoutMs = 5000
): Promise<string | null> {
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

async function waitForExplorerCondition(
  context: TourRuntimeContext,
  predicate: (state: ExplorerDemoState | null) => boolean,
  timeoutMs = 4000
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = context.explorer.getState?.() ?? context.explorer.state ?? null;
    if (predicate(state)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return false;
}

export function pickBeginnerDemoEntrypoint(
  entrypoints: Array<{ name: string; href: string }>
): string | null {
  const frs102 = entrypoints.find(
    (entrypoint) =>
      /frs[\s-]*102/i.test(entrypoint.name) ||
      /frs[\s-]*102/i.test(entrypoint.href)
  );
  return frs102?.href ?? entrypoints[0]?.href ?? null;
}

export const tours: Record<string, TourDefinition> = {
  "beginner-overview": {
    id: "beginner-overview",
    title: "Beginner overview",
    steps: [
      {
        id: "choose-year",
        targetAnchor: "year-selector",
        title: "Choose a taxonomy version",
        body: "The FRC releases a new taxonomy suite every year to reflect changes to reporting requirements, UK GAAP and UK-endorsed IFRS. \n\n ifferent years can have different concepts, labels, and structures.Preparers should confirm which year versions are valid for their needs by consulting HMRC and/or Companies House documentation.",
        placement: "bottom",
        spotlightPadding: 4,
        spotlightRadius: 12,
        helpId: "app.yearSelector",
        beforeStep: async ({ explorer }) => {
          explorer.actions?.selectYear("2026");
        },
        waitFor: ({ explorer }) =>
          explorer.state?.year === "2026" &&
          explorer.state.entrypointsYear === "2026" &&
          explorer.state.availableEntrypoints.length > 0,
        timeoutMs: 6000,
      },
      {
        id: "choose-entrypoint",
        targetAnchor: "entrypoint-selector",
        title: "Choose an entry point",
        body: "Each year's taxonomy suite contains a list of entry points - a specific starting file in a taxonomy. It loads the parts of the taxonomy needed for a particular reporting purpose. \n\n In the UK taxonomies, there are different entry points available for each accounting standard (e.g. FRS 101, FRS 102) and for some Companies House-specific forms (e.g. CIC-34, DSEP-AA06).",
        loadingMessage: "The tour will continue when the entry point has loaded.",
        placement: "bottom",
        spotlightPadding: 4,
        spotlightRadius: 12,
        helpId: "app.entrypoint",
        beforeStep: async ({ explorer }) => {
          const candidateHref =
            pickBeginnerDemoEntrypoint(explorer.state?.availableEntrypoints ?? []) ??
            (await waitForAvailableEntrypoint({ explorer }));
          if (candidateHref) {
            explorer.actions?.loadEntrypoint(candidateHref);
          }
        },
        waitFor: ({ explorer }) => {
          const candidateHref = pickBeginnerDemoEntrypoint(explorer.state?.availableEntrypoints ?? []);
          return Boolean(
            candidateHref &&
            explorer.state?.entrypointLoaded &&
            explorer.state.loadedEntrypoint === candidateHref
          );
        },
        timeoutMs: 15000,
      },
      {
        id: "browse-tree",
        targetAnchor: "taxonomy-tree-panel",
        title: "Browse the taxonomy tree",
        body: "The presentation tree view shows how concepts are organised. Click the arrows next to concepts to expand them and reveal their hierarchical structure. \n\n  Colours and icons are used in the tree view to indicate different concept types (e.g. monetary, string, percentage etc.). \n\n Clicking a concept displays information about it in the Details, Hypercube Relationships, and Tree Nodes tabs.",
        placement: "right",
        beforeStep: async ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.selectNetwork("presentation");
            explorer.actions?.setTreeFilter("");
          }
        },
        waitFor: ({ explorer }) =>
          !explorer.state?.entrypointLoaded || explorer.state.network === "presentation",
        timeoutMs: 10000,
      },
      {
        id: "filter-tree",
        targetAnchor: "taxonomy-tree-search",
        spotlightAnchors: ["taxonomy-tree-search", "highlighted-tree-node"],
        spotlightStrategy: "separate",
        title: "Filter the current tree",
        body: "The presentation tree can be searched using a concept's label or QName. \n\n Click the blue download arrow in the search bar to export the results as csv, json, html and png files.",
        placement: "right",
        helpId: "tree.search",
        beforeStep: async ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.setTreeFilter("property, plant and equipment");
            const filterReady = await waitForExplorerCondition(
              { explorer },
              (state) => state?.treeFilter === "property, plant and equipment",
              2500
            );
            if (!filterReady) {
              return;
            }
            explorer.actions?.navigateToConcept("core:PropertyPlantEquipment", {
              preserveDetails: true,
              persistentHighlight: true,
              allowWhileFiltered: true,

            });
          }
        },
        waitFor: ({ explorer }) =>
          !explorer.state?.entrypointLoaded ||
          (explorer.state.treeFilter === "property, plant and equipment" &&
            explorer.state.selectedTreeConceptQname === "core:PropertyPlantEquipment"),
        timeoutMs: 5000,
      },
      {
        id: "inspect-details",
        targetAnchor: "details-panel",
        spotlightAnchors: ["details-panel", "highlighted-tree-node"],
        spotlightStrategy: "separate",
        title: "Inspect concept details",
        body: "When a concept is selected, this panel explains its properties. \n\n Pay particular attention to the balance, period and data type properties to undertand how the concept is intended to be used and the labels for any supporting information. \n\n References provide useful context, linking concepts with legislation, regulation and accounting standards ",
        placement: "left",
        helpId: "details.tabs",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {          
            if (explorer.state.selectedConceptQname !== "core:PropertyPlantEquipment") {
              explorer.actions?.navigateToConcept("core:PropertyPlantEquipment", {
                persistentHighlight: true,
                allowWhileFiltered: true,
              });
            }            
            explorer.actions?.openDetailsTab("Details");
          }
        },
        waitFor: ({ explorer }) =>
          explorer.state?.selectedConceptQname === "core:PropertyPlantEquipment" &&
          explorer.state.activeDetailsTab === "Details",
        timeoutMs: 5000,
      },
      {
        id: "hypercube-relationships-tab",
        targetAnchor: "details-tab-hypercube-relationships",
        spotlightAnchors: [
          "details-tab-hypercube-relationships",
          "details-view-hypercube-relationships",
        ],
        cardAnchor: "details-panel",
        title: "Show hypercube relationships",
        body: "This tab shows how aspects of a concept can be further broken down using the dimensions available. Applying dimensions is common when tagging the Notes to the Accounts. \n\n Concepts belong to hypercubes (tables). A hypercube (table) is a data structure made up of reportable concepts (rows) and available dimensions (columns). The UK taxonomies use closed hypercubes. This means that every line item concept belongs to at least one hypercube, and users cannot create their own taxonomy concepts.\n\n\ This tab shows the available dimensions (columns) as dropdown selectors. In this example, we can see that Property, Plant, and Equipment can be broken down by dimensions 6053 PPE Ownership and 6052 PPE Classes. \n\n The contents of those dropdowns are the dimension's domain members. All of the other reportable concepts (rows) available in this hypercube are listed under \"Primary Items\". \n\n Hypercube tabs can be popped out to make it easier to compare the dimensional structure of different concepts.",
        placement: "left",
        helpId: "details.tab.hypercubeRelationships",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.selectedConceptQname) {
            explorer.actions?.clearTreeHighlight();
            explorer.actions?.openDetailsTab("Hypercube Relationships");
          }
        },
        waitFor: ({ explorer }) =>
          explorer.state?.activeDetailsTab === "Hypercube Relationships",
        timeoutMs: 4000,
      },
      {
        id: "tree-locations-tab",
        targetAnchor: "details-tab-tree-locations",
        spotlightAnchors: [
          "details-tab-tree-locations",
          "details-view-tree-locations",
        ],
        cardAnchor: "details-panel",
        title: "Open a non-default details tab",
        body: "This tab shows the tree locations for the selected concept. \n\n Concepts will appear in the presentation and definition trees according to the relationships defined in the taxonomy. This view can be used to  trace the relationships between concepts, hypercubes, dimensions and their domain members.\n\n Tree Node tabs can be popped out to make it easier to compare the locations of different concepts.",
        placement: "left",
        helpId: "details.tab.treeLocations",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.selectedConceptQname) {
            explorer.actions?.openDetailsTab("Tree Locations");
          }
        },
        waitFor: ({ explorer }) =>
          explorer.state?.activeDetailsTab === "Tree Locations",
        timeoutMs: 4000,
      },
      {
        id: "advanced-search-tab",
        targetAnchor: "details-tab-advanced-search",
        spotlightAnchors: [
          "details-tab-advanced-search",
          "details-view-advanced-search",
        ],
        spotlightStrategy: "separate",
        cardAnchor: "details-panel",
        title: "Switch to advanced search",
        body: "The taxonomy viewer offers a robust search engine that can filter concepts based on all relevant XBRL taxonomy criteria (the properties in the details tab). \n\n Users can also search by reference, if looking to understand how the taxonomy maps to specific legislation, regulation or accounting standards.",
        placement: "left",
        helpId: "details.tab.advancedSearch",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.openDetailsTab("Advanced Search");
            explorer.actions?.setAdvancedSearchQuery("Turnover");
          }
        },
        waitFor: ({ explorer }) =>
          explorer.state?.activeDetailsTab === "Advanced Search" &&
          explorer.state.advancedSearchQuery === "Turnover",
        timeoutMs: 4000,
      },
      {
        id: "advanced-search-view",
        targetAnchor: "details-view-search-results",
        cardAnchor: "details-panel",
        title: "Explore filtered search",
        body: "Search results can be filtered by relevant taxonomy criteria. All filters applied can be toggled on and off. \n\n Click \"Go to node\" to navigate to the selected concept in any tree it appears, even in different entry points.\n\n Click \"Export results\" to export the results as csv and json.",
        placement: "left",
        helpId: "details.tab.advancedSearch",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.activeDetailsTab === "Advanced Search") {
            explorer.actions?.runAdvancedSearch();
          }
        },
        waitFor: ({ explorer }) =>
          explorer.state?.activeDetailsTab === "Search Results" &&
          explorer.state.advancedSearchHasRun &&
          !explorer.state.advancedSearchLoading &&
          explorer.state.advancedSearchResultCount > 0,
        timeoutMs: 10000,
      },
    ],
  },
};

export function getTour(tourId: string | null): TourDefinition | null {
  if (!tourId) {
    return null;
  }
  return tours[tourId] ?? null;
}
