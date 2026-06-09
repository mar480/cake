import { HelpContentId } from "./helpContent";
import { ExplorerDemoActions, ExplorerDemoState } from "@/components/taxonomy/explorer/explorerHelpTypes";

export type TourRuntimeContext = {
  explorer: {
    actions: ExplorerDemoActions | null;
    state: ExplorerDemoState | null;
  };
};

export type TourStep = {
  id: string;
  targetAnchor: string;
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
        title: "Choose a taxonomy year",
        body: "The guided demo starts by selecting a real taxonomy year so the rest of the tour can use live entrypoints and trees.",
        placement: "bottom",
        spotlightPadding: 4,
        spotlightRadius: 12,
        helpId: "app.yearSelector",
        beforeStep: ({ explorer }) => {
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
        title: "Choose an entrypoint",
        body: "Now the tour loads a real entrypoint from the current year so the tree and details panel have live taxonomy data to work with.",
        loadingMessage: "The tour will continue when the entrypoint has loaded.",
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
        body: "The tree shows how concepts are organised. Select a concept here to inspect labels, references, and technical metadata.",
        placement: "right",
        beforeStep: ({ explorer }) => {
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
        title: "Filter the current tree",
        body: "Use tree search to narrow the visible concepts without changing the loaded taxonomy. The tour falls back gracefully if the tree controls are not visible yet.",
        placement: "right",
        helpId: "tree.search",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.entrypointLoaded) {
            explorer.actions?.setTreeFilter("current assets");
          }
        },
        waitFor: ({ explorer }) =>
          !explorer.state?.entrypointLoaded || explorer.state.treeFilter === "current assets",
        timeoutMs: 3000,
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
        waitFor: ({ explorer }) =>
          explorer.state?.selectedConceptQname === "core:CurrentAssets" &&
          explorer.state.activeDetailsTab === "Details",
        timeoutMs: 5000,
      },
      {
        id: "hypercube-relationships-tab",
        targetAnchor: "details-tab-hypercube-relationships",
        cardAnchor: "details-panel",
        title: "Show hypercube relationships",
        body: "This tab is often the most useful next step after properties because it shows how the selected concept participates in tables, dimensions, domains, and members.",
        placement: "left",
        helpId: "details.tab.hypercubeRelationships",
        beforeStep: ({ explorer }) => {
          if (explorer.state?.selectedConceptQname) {
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
        cardAnchor: "details-panel",
        title: "Open a non-default details tab",
        body: "With a concept selected, the demo intentionally switches to Tree Locations so you can see the guided tour control a tab that depends on concept context.",
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
        cardAnchor: "details-panel",
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
        body: "The tour now runs a real keyword search for Turnover and shows the matching results so you can move from search back into tree-based inspection.",
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
