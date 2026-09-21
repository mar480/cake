import assert from "node:assert/strict";
import test from "node:test";

import { explorerUrl, parseExplorerUrlState, serializeExplorerUrlState } from "./urlState";

const state = {
  year: "2026",
  entrypoint: "https://example.test/accounts?type=full&lang=en",
  network: "presentation",
  qname: "uk-gaap:Profit & loss",
  elr: "https://example.test/role/a b",
  occurrence: "node/one+two",
};

test("explorer URL state round-trips percent-encoded values", () => {
  const serialized = serializeExplorerUrlState(state);
  assert.deepEqual(parseExplorerUrlState(serialized), state);
  assert.match(serialized.toString(), /entrypoint=https%3A%2F%2Fexample\.test%2Faccounts%3Ftype%3Dfull%26lang%3Den/);
  assert.match(serialized.toString(), /qname=uk-gaap%3AProfit\+%26\+loss/);
  assert.equal(explorerUrl(state, { origin: "https://host.test", pathname: "/explorer" }), `https://host.test/explorer?${serialized}`);
});

test("rejects partial, repeated, empty and unsupported combinations", () => {
  assert.equal(parseExplorerUrlState("?year=2026&entrypoint=x&network=presentation"), null);
  assert.equal(parseExplorerUrlState("?year=2026&entrypoint=x&network=presentation&qname=x&elr="), null);
  assert.equal(parseExplorerUrlState("?year=2026&entrypoint=x&network=presentation&qname=x&qname=y"), null);
  assert.equal(parseExplorerUrlState("?year=2026&entrypoint=x&network=presentation&qname=x&uuid=y"), null);
});
