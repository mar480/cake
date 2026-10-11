import fs from "node:fs/promises";
import { test, expect, anchor, load, selectConcept, tab, tree } from "./fixtures";
import { hrefs, networks, ppe, revenue, revisions } from "./data";

test("loads the manifest and bundle and renders all networks @smoke", async ({ page, api }, testInfo) => {
  await page.goto("/");
  await expect(anchor(page, "network-selector").locator("select")).toBeDisabled();
  await load(page);
  const paths = api.requests.map(request => new URL(request.url()).pathname);
  expect(paths.indexOf("/api/entrypoint-manifest")).toBeLessThan(paths.indexOf(`/api/taxonomy-bundles/2026/${revisions["2026"]}/bundle.json`));
  expect(paths).not.toContain("/api/load-entrypoint");
  for (const network of networks) {
    await anchor(page, "network-selector").locator("select").selectOption(network);
    await expect(tree(page)).toContainText("100 - Financial statements");
  }
  await anchor(page, "network-selector").locator("select").selectOption("presentation");
  await selectConcept(page, ppe);
  if (testInfo.project.name === "chromium") await expect(page).toHaveScreenshot("explorer-details.png");
  const request = api.requests.find(request => new URL(request.url()).pathname === "/api/concept-details")!;
  const params = new URL(request.url()).searchParams;
  expect(params.get("year")).toBe("2026");
  expect(params.get("href")).toBe(hrefs["2026"]);
  expect(params.get("revision")).toBe(revisions["2026"]);
});

test("filters and toggles the PrimeReact tree and switches language @smoke", async ({ page }) => {
  await page.goto("/");
  await load(page);
  await tree(page).getByPlaceholder("Search...").fill("Property, plant and equipment");
  await expect(tree(page).locator(`[title="${ppe}"]`)).toHaveCount(2);
  const toggler = tree(page).locator(".p-tree-toggler").first();
  await toggler.click();
  // Cake deliberately keeps every matching path expanded while filtering.
  await expect(tree(page).locator(`[title="${ppe}"]`)).toHaveCount(2);
  await tree(page).getByRole("button", { name: "Clear tree search" }).click();
  for (const label of ["100 - Financial statements", "Statement of financial position", "200 - Notes"]) {
    const item = tree(page).getByRole("treeitem", { name: label, exact: true });
    if (await item.getAttribute("aria-expanded") !== "true") await item.locator(":scope > .p-treenode-content .p-tree-toggler").click();
    await expect(item).toHaveAttribute("aria-expanded", "true");
  }
  await expect(tree(page).locator(`[title="${ppe}"]`)).toHaveCount(2);
  await toggler.click();
  await expect(tree(page).locator(`[title="${ppe}"]`)).toHaveCount(1);
  await tree(page).getByPlaceholder("Search...").fill("Property, plant and equipment");
  await anchor(page, "language-selector").locator("select").selectOption("cy");
  await tree(page).getByRole("button", { name: "Clear tree search" }).click();
  await tree(page).getByPlaceholder("Search...").fill("Eiddo");
  await expect(tree(page)).toContainText("Eiddo, peiriannau ac offer");
  await anchor(page, "language-selector").locator("select").selectOption("en");
  await tree(page).getByRole("button", { name: "Clear tree search" }).click();
  await expect(tree(page).getByPlaceholder("Search...")).toHaveValue("");
});

test("restores precise occurrences, reloads, and follows Back and Forward @smoke", async ({ page }) => {
  const params = new URLSearchParams({ year: "2026", entrypoint: hrefs["2026"], network: "presentation", qname: ppe, elr: "urn:cake:presentation:200", occurrence: "2026-presentation-ppe-second" });
  await page.goto(`/?${params}`);
  await expect(anchor(page, "details-view-details")).toContainText(ppe.split(":")[1]);
  await expect(anchor(page, "highlighted-tree-node")).toHaveAttribute("title", ppe);
  await page.reload();
  await expect(anchor(page, "details-view-details")).toContainText(ppe.split(":")[1]);
  const historyLength = await page.evaluate(() => window.history.length);
  await tree(page).getByPlaceholder("Search...").fill("core:");
  await tree(page).locator(`[title="${revenue}"]`).click();
  await expect(page).toHaveURL(/qname=core%3ATurnoverRevenue/);
  // Routine Cake browsing replaces history. Seed an independent deep-link entry
  // to exercise real popstate restoration without changing that existing policy.
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
  await page.evaluate(url => window.history.pushState(window.history.state, "", url), `/?${params}`);
  await page.goBack();
  await expect(anchor(page, "details-view-details")).toContainText(revenue.split(":")[1]);
  await page.goForward();
  await expect(anchor(page, "details-view-details")).toContainText(ppe.split(":")[1]);
  expect(new URL(page.url()).searchParams.get("occurrence")).toBe("2026-presentation-ppe-second");
});

test("keeps request context isolated when changing entry points", async ({ page, api }) => {
  await page.goto("/");
  await load(page);
  await selectConcept(page, revenue);
  await load(page, "2025");
  await selectConcept(page, revenue);
  await expect(anchor(page, "details-view-details")).toContainText("urn:cake:2025");
  const request = api.requests.filter(request => new URL(request.url()).pathname === "/api/concept-details").at(-1)!;
  expect(Object.fromEntries(new URL(request.url()).searchParams)).toMatchObject({ year: "2025", href: hrefs["2025"], revision: revisions["2025"] });
});

test("opens dimensions, members, primary items, and both pop-out routes", async ({ page, context }, testInfo) => {
  await page.goto("/");
  await load(page);
  await selectConcept(page, ppe);
  await tab(page, "hypercube-relationships");
  await expect(page.getByText("PPE analysis", { exact: true })).toBeVisible();
  await page.locator(".p-treeselect").click();
  await page.locator(".hypercube-member-select-panel").getByText("Land", { exact: true }).click();
  await expect(page.locator(".p-treeselect")).toContainText("Land");
  await page.getByRole("button", { name: "Primary items", exact: true }).click();
  await expect(anchor(page, "details-view-hypercube-relationships")).toContainText("Assets");
  if (testInfo.project.name === "chromium") await expect(page).toHaveScreenshot("explorer-dimensions.png");
  const hypercubeWindow = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open in new window", exact: true }).click();
  const hypercube = await hypercubeWindow;
  await expect(hypercube).toHaveURL(/\/hypercube-popout$/);
  await expect(hypercube.getByText("PPE analysis", { exact: true })).toBeVisible();
  await hypercube.close();
  await tab(page, "tree-locations");
  await expect(anchor(page, "details-view-tree-locations")).toContainText("200 - Notes");
  const locationWindow = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open in new window", exact: true }).click();
  const locations = await locationWindow;
  await expect(locations).toHaveURL(/\/tree-locations-popout$/);
  await expect(locations.getByText("200 - Notes", { exact: true })).toBeVisible();
  await locations.close();
  await anchor(page, "details-view-tree-locations").getByText("Property, plant and equipment", { exact: true }).last().click();
  await expect(anchor(page, "highlighted-tree-node")).toHaveAttribute("title", ppe);
});

test("follows a concept cross-reference without replacing its details", async ({ page }) => {
  await page.goto("/");
  await load(page);
  await selectConcept(page, "core:RevenueReference");
  await tree(page).getByRole("button", { name: "Clear tree search" }).click();
  await anchor(page, "details-view-details").getByRole("button", { name: revenue, exact: true }).click();
  await expect(anchor(page, "highlighted-tree-node")).toHaveAttribute("title", revenue);
  await expect(anchor(page, "details-view-details")).toContainText("RevenueReference");
});

test("searches, paginates, exports results, navigates and resets", async ({ page, api }) => {
  await page.goto("/");
  await load(page);
  await tab(page, "advanced-search");
  await page.getByPlaceholder("e.g. turnover, revenue, core:TurnoverRevenue").fill("Turnover");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(anchor(page, "details-view-search-results")).toContainText("Turnover revenue");
  expect(api.requests.filter(request => new URL(request.url()).pathname === "/api/search-concepts").at(-1)!.postDataJSON()).toMatchObject({ year: "2026", href: hrefs["2026"], revision: revisions["2026"], offset: 0 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(anchor(page, "details-view-search-results")).toContainText("26-27");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  for (const format of ["csv", "json"]) {
    await page.getByRole("button", { name: "Export results", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: format.toUpperCase(), exact: true }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: `Export ${format.toUpperCase()}`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`search-export.${format}`);
    const contents = await fs.readFile((await download.path())!, "utf8");
    expect(contents).toContain(revenue);
    if (format === "json") expect(JSON.parse(contents)).toHaveLength(27);
  }
  await page.getByRole("button", { name: "Go to node", exact: true }).first().click();
  await expect(anchor(page, "highlighted-tree-node")).toHaveAttribute("title", revenue);
  await tab(page, "advanced-search");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByPlaceholder("e.g. turnover, revenue, core:TurnoverRevenue")).toHaveValue("");
});

test("applies an advanced-search filter and handles empty results", async ({ page, api }) => {
  await page.goto("/");
  await load(page);
  await tab(page, "advanced-search");
  await page.getByLabel("credit", { exact: true }).check();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(anchor(page, "details-view-search-results")).toContainText("Turnover revenue");
  expect(api.requests.filter(request => new URL(request.url()).pathname === "/api/search-concepts").at(-1)!.postDataJSON().filters.balance).toEqual(["credit"]);
  await tab(page, "advanced-search");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByPlaceholder("e.g. turnover, revenue, core:TurnoverRevenue").fill("missing");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(anchor(page, "details-view-search-results")).toContainText(/No results/i);
});

test("downloads the filtered tree in all four formats", async ({ page }) => {
  await page.goto("/");
  await load(page);
  await tree(page).getByPlaceholder("Search...").fill("Property, plant and equipment");
  for (const format of ["csv", "json", "html", "png"]) {
    await page.getByRole("button", { name: "Export filtered tree" }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${format}`, "i") }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    const contents = await fs.readFile((await download.path())!);
    if (format === "png") expect(contents.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    else expect(contents.toString()).toContain(ppe);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});

test("resizes panels and supports keyboard dropdown and help persistence @smoke", async ({ page }) => {
  await page.goto("/");
  await anchor(page, "year-selector").locator("select").selectOption("2026");
  await anchor(page, "entrypoint-selector").getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(anchor(page, "network-selector").locator("select")).toBeEnabled();
  const before = (await anchor(page, "taxonomy-tree-panel").boundingBox())!.width;
  const gutter = (await page.locator(".gutter").boundingBox())!;
  await page.mouse.move(gutter.x + gutter.width / 2, gutter.y + 100);
  await page.mouse.down();
  await page.mouse.move(gutter.x + 130, gutter.y + 100, { steps: 8 });
  await page.mouse.up();
  expect(Math.abs((await anchor(page, "taxonomy-tree-panel").boundingBox())!.width - before)).toBeGreaterThan(50);
  await page.getByRole("button", { name: "App info off", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "App info on", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open help", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("completes the real automated beginner tour and yields to help", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open help", exact: true }).click();
  await page.getByRole("button", { name: "Start beginner tour", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Open help", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start beginner tour", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start beginner tour", exact: true }).click();
  for (let index = 0; index < 12; index++) {
    const finish = page.getByRole("button", { name: "Finish", exact: true });
    if (await finish.isVisible()) { await expect(finish).toBeEnabled(); await finish.click(); break; }
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled();
    const title = await page.getByRole("dialog").locator("h3").textContent();
    await next.click();
    await expect(page.getByRole("dialog").locator("h3")).not.toHaveText(title!);
  }
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(anchor(page, "details-view-search-results")).toContainText("Turnover revenue");
  await page.reload();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("cancels delayed entry-point responses and ignores stale results", async ({ page, api }) => {
  let release: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  api.delay = async url => { if (url.pathname.startsWith("/api/taxonomy-bundles/2026/")) await held; };
  await page.goto("/");
  await anchor(page, "year-selector").locator("select").selectOption("2026");
  await anchor(page, "entrypoint-selector").getByRole("combobox").click();
  await page.getByRole("option", { name: "FRS 102", exact: true }).click();
  await expect(page.locator(".loader-root").first()).toBeVisible();
  // The loading overlay blocks mouse selection; browser history can still
  // restore a different taxonomy and must cancel the previous request.
  const nextUrl = new URLSearchParams({ year: "2025", entrypoint: hrefs["2025"], network: "presentation", qname: ppe });
  await page.evaluate(url => {
    window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, `/?${nextUrl}`);
  await expect(anchor(page, "details-view-details")).toContainText("urn:cake:2025");
  release!();
  await expect(anchor(page, "details-view-details")).toContainText("urn:cake:2025");
  expect(api.requests.filter(request => new URL(request.url()).pathname === "/api/concept-details").at(-1)!.url()).toContain("year=2025");
});

test("handles API failures, invalid links, and stale revision responses", async ({ page, api }) => {
  api.failures.set("/api/entrypoint-manifest", { status: 503, error: "Fixture unavailable" });
  api.expectedConsole.push(/^Failed to load entrypoint Error: Fixture unavailable/, /^Failed to load resource: the server responded with a status of (503|404)/, /^Error fetching concept: Error: Unknown revision; reload the taxonomy\./);
  await page.goto("/");
  await anchor(page, "year-selector").locator("select").selectOption("2026");
  await anchor(page, "entrypoint-selector").getByRole("combobox").click();
  await page.getByRole("option", { name: "FRS 102", exact: true }).click();
  await expect(page.locator(".loader-root")).toHaveCount(0);
  await expect(anchor(page, "network-selector").locator("select")).toBeDisabled();
  api.failures.clear();
  await page.goto("/?year=2026");
  await expect(anchor(page, "network-selector").locator("select")).toBeDisabled();
  await load(page);
  api.failures.set("/api/concept-details", { status: 404, error: "Unknown revision; reload the taxonomy." });
  await tree(page).getByPlaceholder("Search...").fill(ppe);
  await tree(page).locator(`[title="${ppe}"]`).first().click();
  await expect(anchor(page, "details-panel")).toContainText("Unknown revision; reload the taxonomy.");
});

test("cancels earlier concept details and keeps the latest selection", async ({ page, api }) => {
  let release: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  api.delay = async url => {
    if (url.pathname === "/api/concept-details" && url.searchParams.get("qname") === ppe) await held;
  };
  await page.goto("/");
  await load(page);
  const earlier = page.waitForRequest(request => new URL(request.url()).pathname === "/api/concept-details" && new URL(request.url()).searchParams.get("qname") === ppe);
  await tree(page).getByPlaceholder("Search...").fill(ppe);
  await tree(page).locator(`[title="${ppe}"]`).first().click();
  await earlier;
  const cancelled = page.waitForEvent("requestfailed", request => new URL(request.url()).pathname === "/api/concept-details" && new URL(request.url()).searchParams.get("qname") === ppe);
  try {
    await selectConcept(page, revenue);
    expect((await cancelled).failure()!.errorText).toMatch(/aborted/i);
  } finally {
    release!();
  }
  await expect(anchor(page, "details-view-details")).toContainText("TurnoverRevenue");
  await expect(anchor(page, "details-view-details")).not.toContainText("PropertyPlantEquipment");
  await tree(page).locator(`[title="${revenue}"]`).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Concept actions" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Concept actions" })).not.toBeVisible();
});
