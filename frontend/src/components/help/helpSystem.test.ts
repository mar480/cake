import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterHelpContent,
  getGlossaryEntries,
  getHelpContent,
  groupGlossaryEntries,
  helpContent,
  helpContentList,
} from "./helpContent";
import { getTour, pickBeginnerDemoEntrypoint, tours } from "./tours";
import {
  buildTourStepExecutionKey,
  getHelpHomeOpenState,
  prepareTourStep,
} from "./tourRuntime";

describe("helpContent", () => {
  it("keeps help ids unique and aligned with their map keys", () => {
    const ids = helpContentList.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);

    for (const [key, entry] of Object.entries(helpContent)) {
      assert.equal(entry.id, key);
      assert.ok(entry.title.trim().length > 0);
      assert.ok(entry.shortText.trim().length > 0);
    }
  });

  it("only references related help ids that exist", () => {
    const knownIds = new Set(Object.keys(helpContent));

    for (const entry of helpContentList) {
      for (const relatedId of entry.relatedHelpIds ?? []) {
        assert.equal(knownIds.has(relatedId), true, `${entry.id} references missing id ${relatedId}`);
      }
    }
  });

  it("returns help entries by id", () => {
    const entry = getHelpContent("concept.periodType");
    assert.equal(entry.title, "Period type");
  });

  it("filters glossary entries by representative search terms", () => {
    assert.equal(filterHelpContent("entrypoint").some((entry) => entry.id === "app.entrypoint"), true);
    assert.equal(filterHelpContent("credit").some((entry) => entry.id === "concept.balance"), true);
    assert.equal(filterHelpContent("hypercube").some((entry) => entry.id === "details.tab.hypercubeRelationships"), true);
  });

  it("uses concept glossary entries for duplicated concept terms", () => {
    const entries = getGlossaryEntries("balance");
    assert.equal(entries.some((entry) => entry.id === "concept.balance"), true);
  });

  it("groups glossary entries under the expected headings", () => {
    const grouped = groupGlossaryEntries(getGlossaryEntries(""));
    assert.equal(grouped.App.some((entry) => entry.id === "app.entrypoint"), true);
    assert.equal(grouped["Details tab"].some((entry) => entry.id === "details.tab.treeLocations"), true);
    assert.equal(grouped.Concept.some((entry) => entry.id === "concept.balance"), true);
    assert.equal(grouped["Advanced Search"].some((entry) => entry.id === "advancedSearch.keyword"), true);
  });
});

describe("tours", () => {
  it("exposes the beginner overview tour with stable step metadata", () => {
    const tour = getTour("beginner-overview");
    assert.ok(tour);
    assert.equal(tour?.id, "beginner-overview");
    assert.equal(tour?.steps.length, 9);

    for (const step of tour?.steps ?? []) {
      assert.ok(step.id.trim().length > 0);
      assert.ok(step.targetAnchor.trim().length > 0);
      assert.ok(step.title.trim().length > 0);
      assert.ok(step.body.trim().length > 0);
    }
  });

  it("includes demo-capable steps with beforeStep and waitFor hooks", () => {
    const tour = getTour("beginner-overview");
    const filterStep = tour?.steps.find((step) => step.id === "filter-tree");
    const hypercubeStep = tour?.steps.find((step) => step.id === "hypercube-relationships-tab");
    const treeLocationsStep = tour?.steps.find((step) => step.id === "tree-locations-tab");
    const advancedSearchStep = tour?.steps.find((step) => step.id === "advanced-search-tab");

    assert.equal(typeof filterStep?.beforeStep, "function");
    assert.equal(typeof filterStep?.waitFor, "function");
    assert.equal(typeof hypercubeStep?.beforeStep, "function");
    assert.equal(typeof hypercubeStep?.waitFor, "function");
    assert.equal(typeof treeLocationsStep?.beforeStep, "function");
    assert.equal(typeof treeLocationsStep?.waitFor, "function");
    assert.equal(typeof advancedSearchStep?.beforeStep, "function");
    assert.equal(typeof advancedSearchStep?.waitFor, "function");
  });

  it("prefers an FRS 102 entrypoint for the beginner demo when available", () => {
    const href = pickBeginnerDemoEntrypoint([
      { name: "FRS 101", href: "/frs-101" },
      { name: "FRS 102", href: "/frs-102" },
    ]);

    assert.equal(href, "/frs-102");
  });

  it("returns null for unknown tours", () => {
    assert.equal(getTour("missing-tour"), null);
  });

  it("keeps exported tour ids aligned with their object keys", () => {
    for (const [key, tour] of Object.entries(tours)) {
      assert.equal(tour.id, key);
    }
  });
});

describe("tourRuntime", () => {
  it("builds a stable execution key per active step", () => {
    assert.equal(
      buildTourStepExecutionKey("beginner-overview", 2, "browse-tree"),
      "beginner-overview:2:browse-tree"
    );
    assert.equal(buildTourStepExecutionKey(null, 2, "browse-tree"), null);
    assert.equal(buildTourStepExecutionKey("beginner-overview", 2, null), null);
  });

  it("opens help home by clearing the active tour state", () => {
    assert.deepEqual(getHelpHomeOpenState(), {
      activeTourId: null,
      activeStepIndex: 0,
      helpHomeOpen: true,
    });
  });

  it("runs beforeStep once per preparation and resolves when the step becomes ready", async () => {
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
        timeoutMs: 100,
      },
      getRuntime: () => ({ explorer: { actions: null, state: null } }),
      sleep: async () => undefined,
    });

    assert.equal(result, "ready");
    assert.equal(beforeStepCalls, 1);
  });

  it("times out cleanly when the wait condition never becomes true", async () => {
    let nowValue = 0;

    const result = await prepareTourStep({
      step: {
        id: "choose-entrypoint",
        targetAnchor: "entrypoint-selector",
        title: "Choose an entrypoint",
        body: "Loads one entrypoint and waits for the explorer to finish.",
        waitFor: () => false,
        timeoutMs: 60,
      },
      getRuntime: () => ({ explorer: { actions: null, state: null } }),
      now: () => {
        nowValue += 30;
        return nowValue;
      },
      sleep: async () => undefined,
    });

    assert.equal(result, "timed_out");
  });
});
