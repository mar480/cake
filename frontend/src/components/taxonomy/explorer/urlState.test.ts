import assert from "node:assert/strict";
import test from "node:test";
import { createLocationRestorationHandler, parseTaxonomyUrl, taxonomySearch, type ParsedTaxonomyUrl, type TaxonomyUrlState } from "./urlState";

const complete: TaxonomyUrlState = {
  year: "2026",
  entrypoint: "https://example.test/a package/entry.xsd?mode=full&x=1",
  network: "definition_dommem",
  qname: "uk:Profit & loss",
  elr: "https://example.test/role/One & Two",
  occurrence: "id / 1?x=y",
};

test("taxonomy URL state round trips encoded required and optional values", () => {
  const search = taxonomySearch(complete);
  assert.match(search, /entrypoint=https%3A%2F%2Fexample/);
  assert.match(search, /qname=uk%3AProfit/);
  assert.deepEqual(parseTaxonomyUrl(search), { kind: "valid", state: complete });
});

test("optional ELR and occurrence may be omitted", () => {
  const { elr: _elr, occurrence: _occurrence, ...required } = complete;
  assert.deepEqual(parseTaxonomyUrl(taxonomySearch(required)), { kind: "valid", state: required });
});

for (const search of [
  "?year=2026&entrypoint=x&network=presentation",
  "?year=&entrypoint=x&network=presentation&qname=x%3Ay",
  "?year=2026&year=2025&entrypoint=x&network=presentation&qname=x%3Ay",
  "?year=2026&entrypoint=x&network=presentation&qname=x%3Ay&surprise=1",
  "?year=2026&entrypoint=x&network=presentation&qname=x%3Ay&elr=",
]) test(`rejects invalid parameters: ${search}`, () => assert.equal(parseTaxonomyUrl(search).kind, "invalid"));

test("location handler reparses current search for popstate/back/forward", () => {
  let search = taxonomySearch(complete);
  const received: ParsedTaxonomyUrl[] = [];
  const handle = createLocationRestorationHandler(() => search, (parsed) => received.push(parsed));
  handle();
  search = "?bad=1";
  handle();
  assert.deepEqual(received.map((item) => item.kind), ["valid", "invalid"]);
});
