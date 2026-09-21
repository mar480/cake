export interface ExplorerUrlState {
  year: string;
  entrypoint: string;
  network: string;
  qname: string;
  elr?: string;
  occurrence?: string;
}

const REQUIRED_KEYS = ["year", "entrypoint", "network", "qname"] as const;
const SUPPORTED_KEYS = new Set([...REQUIRED_KEYS, "elr", "occurrence"]);

/** Parse a complete explorer location. Partial and unknown combinations are rejected. */
export function parseExplorerUrlState(search: string | URLSearchParams): ExplorerUrlState | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  if ([...params.keys()].some((key) => !SUPPORTED_KEYS.has(key))) return null;
  if ([...SUPPORTED_KEYS].some((key) => params.getAll(key).length > 1)) return null;

  const values = Object.fromEntries(REQUIRED_KEYS.map((key) => [key, params.get(key)?.trim()]));
  if (REQUIRED_KEYS.some((key) => !values[key])) return null;
  const elr = params.get("elr")?.trim();
  const occurrence = params.get("occurrence")?.trim();
  if (params.has("elr") && !elr) return null;
  if (params.has("occurrence") && !occurrence) return null;

  return {
    year: values.year!,
    entrypoint: values.entrypoint!,
    network: values.network!,
    qname: values.qname!,
    ...(elr ? { elr } : {}),
    ...(occurrence ? { occurrence } : {}),
  };
}

export function serializeExplorerUrlState(state: ExplorerUrlState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of REQUIRED_KEYS) {
    if (!state[key]?.trim()) throw new Error(`Missing explorer URL parameter: ${key}`);
    params.set(key, state[key]);
  }
  if (state.elr) params.set("elr", state.elr);
  if (state.occurrence) params.set("occurrence", state.occurrence);
  return params;
}

export function explorerUrl(state: ExplorerUrlState, location: Pick<Location, "origin" | "pathname">): string {
  return `${location.origin}${location.pathname}?${serializeExplorerUrlState(state).toString()}`;
}
