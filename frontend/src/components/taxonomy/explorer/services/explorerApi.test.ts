import assert from "node:assert/strict";
import test from "node:test";
import { fetchTaxonomies, loadEntrypoint, searchConcepts } from "./explorerApi";
import { EMPTY_ADVANCED_FILTERS } from "../explorerTypes";

test("entrypoint loading uses the manifest and immutable GET bundle with one abort signal", async () => {
  const previous = globalThis.fetch;
  const requests: { url: string; options?: RequestInit }[] = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    return Response.json(requests.length === 1 ? { revision: "release-a", bundleUrl: "/api/taxonomy-bundles?hash=abc" } : { status: "loaded", trees: { presentation_tree: [] }, filterOptions: { namespace: ["frc"] } });
  };
  try {
    const controller = new AbortController();
    const payload = await loadEntrypoint("2026", "https://example.test/entry?x=1&y=2", controller.signal);
    assert.equal(payload.revision, "release-a");
    assert.deepEqual(payload.filterOptions?.namespace, ["frc"]);
    assert.equal(new URL(requests[0].url, "http://localhost").searchParams.get("href"), "https://example.test/entry?x=1&y=2");
    assert.equal(requests[1].url, "/api/taxonomy-bundles?hash=abc");
    assert.ok(requests.every(({ options }) => options?.signal === controller.signal && !options?.method));
  } finally { globalThis.fetch = previous; }
});

test("aborted loads never fetch the bundle", async () => {
  const previous = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (_input, options) => {
    count += 1;
    options?.signal?.throwIfAborted();
    return Response.json({});
  };
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadEntrypoint("2026", "entry", controller.signal), { name: "AbortError" });
    assert.equal(count, 1);
  } finally { globalThis.fetch = previous; }
});

test("server catalog supports newly installed suites and search pins the loaded revision", async () => {
  const previous = globalThis.fetch;
  let body: Record<string, unknown> = {};
  globalThis.fetch = async (input, options) => {
    if (String(input) === "/api/taxonomies") return Response.json({ suites: [{ value: "2030", label: "2030", revision: "future" }] });
    body = JSON.parse(String(options?.body));
    return Response.json({ results: [], total: 0 });
  };
  try {
    assert.equal((await fetchTaxonomies())[0].value, "2030");
    await searchConcepts({ year: "2030", href: "entry", revision: "future", q: "", filters: EMPTY_ADVANCED_FILTERS, limit: 25, offset: 0 });
    assert.equal(body.revision, "future");
  } finally { globalThis.fetch = previous; }
});

test("manifest failures surface a useful error without downloading a bundle", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "Taxonomy release is not prepared" }, { status: 503 });
  try { await assert.rejects(loadEntrypoint("2026", "entry"), /not prepared/); }
  finally { globalThis.fetch = previous; }
});
