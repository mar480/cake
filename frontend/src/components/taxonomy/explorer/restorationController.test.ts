import assert from "node:assert/strict";
import test from "node:test";
import { nextRestorationStage, unavailableRestorationResource, type RestorationSnapshot } from "./restorationController";
import type { TaxonomyUrlState } from "./urlState";

const target: TaxonomyUrlState = { year: "2026", entrypoint: "ep", network: "presentation", qname: "x:y" };
const ready: RestorationSnapshot = { selectedYear: "2026", entrypointsYear: "2026", entrypoints: ["ep"], loadedYear: "2026", loadedEntrypoint: "ep", entrypointLoaded: true, networks: ["presentation"] };

test("restoration selects year before waiting for its entrypoints", () => {
  assert.equal(nextRestorationStage(target, { ...ready, selectedYear: "2025", entrypointsYear: "2025" }), "select-year");
  assert.equal(nextRestorationStage(target, { ...ready, entrypointsYear: "2025" }), "wait-entrypoints");
});

test("restoration distinguishes missing taxonomy version, entrypoint, and network", () => {
  assert.equal(unavailableRestorationResource(target, ["2025"], ready), "taxonomy-version");
  assert.equal(unavailableRestorationResource(target, ["2026"], { ...ready, entrypoints: [] }), "entrypoint");
  assert.equal(unavailableRestorationResource(target, ["2026"], { ...ready, networks: [] }), "network");
});

test("restoration loads only after exact-year entrypoints and navigates only after exact taxonomy load", () => {
  assert.equal(nextRestorationStage(target, { ...ready, loadedYear: null, loadedEntrypoint: null, entrypointLoaded: false }), "load-entrypoint");
  assert.equal(nextRestorationStage(target, { ...ready, loadedYear: "2025" }), "load-entrypoint");
  assert.equal(nextRestorationStage(target, ready), "navigate");
});
