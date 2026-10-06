export const TAXONOMY_YEARS = [
  { value: "lloyds-2025", label: "Lloyds" },
  { value: "2027", label: "2027 - draft" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
] as const;

export interface TaxonomyUrlState {
  year: string;
  entrypoint: string;
  network: string;
  qname: string;
  elr?: string;
  occurrence?: string;
}

const REQUIRED = ["year", "entrypoint", "network", "qname"] as const;
const OPTIONAL = ["elr", "occurrence"] as const;
const SUPPORTED = new Set<string>([...REQUIRED, ...OPTIONAL]);

export type ParsedTaxonomyUrl =
  | { kind: "empty" }
  | { kind: "valid"; state: TaxonomyUrlState }
  | { kind: "invalid"; reason: string };

export function parseTaxonomyUrl(search: string): ParsedTaxonomyUrl {
  const params = new URLSearchParams(search);
  if ([...params].length === 0) return { kind: "empty" };

  for (const key of params.keys()) {
    if (!SUPPORTED.has(key)) return { kind: "invalid", reason: `Unsupported URL parameter: ${key}.` };
    if (params.getAll(key).length !== 1) return { kind: "invalid", reason: `URL parameter ${key} must occur exactly once.` };
  }
  for (const key of REQUIRED) {
    const value = params.get(key);
    if (value === null || value.trim() === "") return { kind: "invalid", reason: `URL parameter ${key} is required.` };
  }
  for (const key of OPTIONAL) {
    if (params.has(key) && params.get(key)?.trim() === "") return { kind: "invalid", reason: `URL parameter ${key} cannot be empty.` };
  }

  return {
    kind: "valid",
    state: {
      year: params.get("year")!,
      entrypoint: params.get("entrypoint")!,
      network: params.get("network")!,
      qname: params.get("qname")!,
      ...(params.has("elr") ? { elr: params.get("elr")! } : {}),
      ...(params.has("occurrence") ? { occurrence: params.get("occurrence")! } : {}),
    },
  };
}

export function taxonomySearch(state: TaxonomyUrlState): string {
  const params = new URLSearchParams();
  params.set("year", state.year);
  params.set("entrypoint", state.entrypoint);
  params.set("network", state.network);
  params.set("qname", state.qname);
  if (state.elr) params.set("elr", state.elr);
  if (state.occurrence) params.set("occurrence", state.occurrence);
  return `?${params.toString()}`;
}

export function taxonomyAbsoluteUrl(state: TaxonomyUrlState, location: Pick<Location, "origin" | "pathname">): string {
  return `${location.origin}${location.pathname}${taxonomySearch(state)}`;
}

export function treeNodeElr(key: string): string | undefined {
  const separator = key.indexOf("::");
  return separator < 0 ? undefined : key.slice(0, separator) || undefined;
}

export function createLocationRestorationHandler(readSearch: () => string, accept: (parsed: ParsedTaxonomyUrl) => void) {
  return () => accept(parseTaxonomyUrl(readSearch()));
}
