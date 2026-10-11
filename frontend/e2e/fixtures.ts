import { test as base, expect, type Page, type Request } from "@playwright/test";
import { bundle, details, hrefs, relationships, results, revisions } from "./data";

export interface ApiControl {
  requests: Request[];
  failures: Map<string, { status: number; error: string }>;
  expectedConsole: RegExp[];
  delay: ((url: URL) => Promise<void>) | null;
}
export const baselineWarnings = [
  /^⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7\./,
  /^⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7\./,
  /^Select is changing from (uncontrolled to controlled|controlled to uncontrolled)\. Components should not switch from controlled to uncontrolled \(or vice versa\)\. Decide between using a controlled or uncontrolled value for the lifetime of the component\.$/,
];

export const test = base.extend<{ api: ApiControl }>({
  api: [async ({ context }, use) => {
    const api: ApiControl = { requests: [], failures: new Map(), expectedConsole: [], delay: null };
    const errors: string[] = [];
    context.on("page", page => {
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (["error", "warning"].includes(message.type()) && ![...baselineWarnings, ...api.expectedConsole].some(pattern => pattern.test(message.text()))) errors.push(message.text());
      });
    });
    await context.route("**/api/**", async route => {
      const request = route.request();
      api.requests.push(request);
      const url = new URL(request.url());
      if (api.delay) await api.delay(url);
      const error = api.failures.get(url.pathname);
      if (error) return route.fulfill({ status: error.status, json: { error: error.error } });
      const body = request.method() === "POST" ? request.postDataJSON() : {};
      const year = url.searchParams.get("year") ?? body.year ?? (url.pathname.includes("/2025/") ? "2025" : "2026");
      const revision = url.searchParams.get("revision") ?? body.revision;
      if (revision && revision !== revisions[year]) return route.fulfill({ status: 404, json: { error: "Unknown revision; reload the taxonomy." } });
      if (url.pathname === "/api/taxonomies") return route.fulfill({ json: { suites: Object.keys(hrefs).map(value => ({ value, label: value, revision: revisions[value] })) } });
      if (url.pathname === "/api/entrypoints") return route.fulfill({ json: { entrypoints: [{ name: year === "2026" ? "FRS 102" : "IFRS", label: year === "2026" ? "FRS 102" : "IFRS", href: hrefs[year] }] } });
      if (url.pathname === "/api/entrypoint-manifest") return route.fulfill({ json: { revision: revisions[year], bundleUrl: `/api/taxonomy-bundles/${year}/${revisions[year]}/bundle.json` } });
      if (url.pathname.startsWith("/api/taxonomy-bundles/")) return route.fulfill({ json: bundle(year) });
      if (url.pathname === "/api/concept-details") return route.fulfill({ json: details(url.searchParams.get("qname")!, year) });
      if (url.pathname === "/api/dimensional-relationships") return route.fulfill({ json: relationships });
      if (url.pathname === "/api/presentation-entrypoint-locations") return route.fulfill({ json: { matches: [] } });
      if (url.pathname === "/api/search-filter-options") return route.fulfill({ json: bundle(year).filterOptions });
      if (url.pathname === "/api/search-concepts") {
        const items = body.q === "missing" ? [] : results(year).filter(item => !body.filters?.balance?.length || body.filters.balance.includes(item.balance));
        return route.fulfill({ json: { results: items.slice(body.offset, body.offset + body.limit), total: items.length, offset: body.offset, limit: body.limit } });
      }
      if (url.pathname === "/api/search-concepts/export") return route.fulfill({ contentType: body.format === "json" ? "application/json" : "text/csv", headers: { "Content-Disposition": `attachment; filename="search-export.${body.format}"` }, body: body.format === "json" ? JSON.stringify(results(year).map(item => ({ qname: item.qname, label: item.label }))) : 'qname,label\ncore:TurnoverRevenue,Turnover revenue\n' });
      errors.push(`Unmocked API request: ${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, json: { error: "Unmocked request" } });
    });
    await use(api);
    expect(errors, "Unexpected browser errors or warnings").toEqual([]);
  }, { auto: true }],
});
export { expect };
export const anchor = (page: Page, name: string) => page.locator(`[data-help-anchor="${name}"]`);
export const tree = (page: Page) => anchor(page, "taxonomy-tree");
export async function load(page: Page, year = "2026") {
  await anchor(page, "year-selector").locator("select").selectOption(year);
  await anchor(page, "entrypoint-selector").getByRole("combobox").click();
  await page.getByRole("option", { name: year === "2026" ? "FRS 102" : "IFRS", exact: true }).click();
  await expect(anchor(page, "network-selector").locator("select")).toBeEnabled();
}
export async function selectConcept(page: Page, qname: string) {
  await tree(page).getByPlaceholder("Search...").fill(qname);
  await tree(page).locator(`[title="${qname}"]`).first().click();
  await expect(anchor(page, "details-view-details").getByRole("button", { name: qname.split(":")[1], exact: true })).toBeVisible();
}
export async function tab(page: Page, name: string) {
  await anchor(page, `details-tab-${name}`).click();
}
