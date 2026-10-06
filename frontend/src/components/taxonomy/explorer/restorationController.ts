import type { TaxonomyUrlState } from "./urlState";

export type RestorationStage = "select-year" | "wait-entrypoints" | "load-entrypoint" | "wait-taxonomy" | "navigate";

export interface RestorationSnapshot {
  selectedYear: string | null;
  entrypointsYear: string | null;
  entrypoints: string[];
  loadedYear: string | null;
  loadedEntrypoint: string | null;
  entrypointLoaded: boolean;
  networks: string[];
}

export function nextRestorationStage(target: TaxonomyUrlState, snapshot: RestorationSnapshot): RestorationStage {
  if (snapshot.selectedYear !== target.year) return "select-year";
  if (snapshot.entrypointsYear !== target.year) return "wait-entrypoints";
  if (snapshot.loadedYear !== target.year || snapshot.loadedEntrypoint !== target.entrypoint || !snapshot.entrypointLoaded) {
    return snapshot.entrypoints.includes(target.entrypoint) ? "load-entrypoint" : "wait-taxonomy";
  }
  return "navigate";
}

export type RestorationAvailability = "taxonomy-version" | "entrypoint" | "network" | null;

export function unavailableRestorationResource(
  target: TaxonomyUrlState,
  years: readonly string[],
  snapshot: Pick<RestorationSnapshot, "entrypointsYear" | "entrypoints" | "loadedYear" | "loadedEntrypoint" | "networks">
): RestorationAvailability {
  if (!years.includes(target.year)) return "taxonomy-version";
  if (snapshot.entrypointsYear === target.year && !snapshot.entrypoints.includes(target.entrypoint)) return "entrypoint";
  if (snapshot.loadedYear === target.year && snapshot.loadedEntrypoint === target.entrypoint && !snapshot.networks.includes(target.network)) return "network";
  return null;
}
