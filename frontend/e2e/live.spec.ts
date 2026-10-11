import { test, expect, type Request } from "@playwright/test";
import { anchor, baselineWarnings, selectConcept, tab, tree } from "./fixtures";
import { hrefs, ppe } from "./data";

// Pin the installed inputs used for both sides of the migration comparison.
const installedRevisions = {
  "2026": "5078ddb204fbf3bf47c8bc17d5f3fed3b15206308f5273d481f40fca0f12c6fa",
  "2025": "1df5cf46b4040f0d0eafbbeacb14360d42d7590d7d1e1087408957957ab3e2b7",
};

for (const year of ["2026", "2025"]) {
  test(`installed ${year} taxonomy loads and responds to navigation @smoke`, async ({ page, request }, testInfo) => {
    const qname = year === "2026" ? ppe : "core:PropertyPlantEquipmentIncludingRight-of-useAssets";
    const errors: string[] = [];
    const detailRequests: Request[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/concept-details") detailRequests.push(request);
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (["error", "warning"].includes(message.type()) && !baselineWarnings.some(pattern => pattern.test(message.text()))) errors.push(message.text());
    });
    const catalog = await request.get("http://127.0.0.1:5000/api/taxonomies");
    const suite = (await catalog.json()).suites.find(item => item.value === year);
    expect(suite.revision, "Installed inputs must match the React 18 baseline").toBe(installedRevisions[year]);
    await page.goto("/");
    await anchor(page, "year-selector").locator("select").selectOption(year);
    await anchor(page, "entrypoint-selector").getByRole("combobox").click();
    await page.getByRole("option", { name: year === "2026" ? /^FRS 102$/ : /^IFRS$/ }).click();
    const started = Date.now();
    await expect(anchor(page, "network-selector").locator("select")).toBeEnabled({ timeout: 30_000 });
    const loadMs = Date.now() - started;
    const navigationStarted = Date.now();
    await selectConcept(page, qname);
    const detailRequest = detailRequests.filter(request => new URL(request.url()).searchParams.get("qname") === qname).at(-1);
    expect(detailRequest).toBeDefined();
    const params = new URL(detailRequest!.url()).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ year, href: hrefs[year], revision: installedRevisions[year] });
    const navigationMs = Date.now() - navigationStarted;
    await tab(page, "hypercube-relationships");
    await expect(anchor(page, "details-view-hypercube-relationships").getByRole("button", { name: "Dimensions", exact: true }).first()).toBeVisible();
    await tab(page, "tree-locations");
    await expect(anchor(page, "details-view-tree-locations")).toContainText(qname);
    await anchor(page, "network-selector").locator("select").selectOption("definition_all");
    await expect(tree(page)).toBeVisible();
    await anchor(page, "network-selector").locator("select").selectOption("presentation");
    await expect(tree(page).getByPlaceholder("Search...")).toHaveValue("");
    await tab(page, "advanced-search");
    await page.getByPlaceholder("e.g. turnover, revenue, core:TurnoverRevenue").fill("Turnover");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(anchor(page, "details-view-search-results")).toContainText(/Turnover/i, { timeout: 30_000 });
    const measurements = { year, revision: installedRevisions[year], browser: testInfo.project.name, loadMs, navigationMs };
    console.log(JSON.stringify(measurements));
    await testInfo.attach(`live-${year}-timings`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
    expect(errors).toEqual([]);
  });
}
