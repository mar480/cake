import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { anchor, baselineWarnings, load, selectConcept, tab } from "./fixtures";
import { ppe } from "./data";

test("serves the packaged assets, restores a deep link and opens both pop-outs @smoke", async ({ page, context, request }) => {
  const errors: string[] = [];
  const watchPage = (observed: typeof page) => {
    observed.on("pageerror", error => errors.push(error.message));
    observed.on("console", message => {
      if (["error", "warning"].includes(message.type()) && !baselineWarnings.some(pattern => pattern.test(message.text()))) errors.push(message.text());
    });
  };
  watchPage(page);
  context.on("page", watchPage);

  const builtHtml = await fs.readFile(path.resolve("dist/index.html"), "utf8");
  const index = await request.get("/");
  expect(index.ok()).toBe(true);
  expect(index.headers()["content-type"]).toContain("text/html");
  expect((await index.text()).trim()).toBe(builtHtml.trim());
  const assets = [...builtHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
  expect(assets.some(asset => asset.endsWith(".js"))).toBe(true);
  expect(assets.some(asset => asset.endsWith(".css"))).toBe(true);
  for (const asset of assets) {
    const response = await request.get(asset);
    expect(response.ok(), `Packaged asset ${asset}`).toBe(true);
    expect(response.headers()["content-type"]).toMatch(asset.endsWith(".js") ? /javascript/ : /text\/css/);
    expect(await response.body()).toEqual(await fs.readFile(path.resolve("dist", asset.slice(1))));
  }

  await page.goto("/");
  await load(page);
  await selectConcept(page, ppe);
  const deepLink = page.url();
  const params = new URL(deepLink).searchParams;
  expect(params.get("qname")).toBe(ppe);
  expect(params.get("occurrence")).toBeTruthy();
  const deepLinkResponse = await request.get(deepLink);
  expect(deepLinkResponse.ok()).toBe(true);
  expect((await deepLinkResponse.text()).trim()).toBe(builtHtml.trim());
  await page.reload();
  await expect(anchor(page, "details-view-details").getByRole("button", { name: ppe.split(":")[1], exact: true })).toBeVisible();
  await expect(page).toHaveURL(deepLink);

  await tab(page, "hypercube-relationships");
  const relationshipPanel = anchor(page, "details-view-hypercube-relationships");
  await expect(relationshipPanel.getByRole("heading", { level: 3 }).first()).toBeVisible();
  const definition = await relationshipPanel.getByRole("heading", { level: 3 }).first().innerText();
  const hypercubeWindow = context.waitForEvent("page");
  await relationshipPanel.getByRole("button", { name: "Open in new window", exact: true }).first().click();
  const hypercube = await hypercubeWindow;
  await hypercube.waitForLoadState("load");
  await expect(hypercube).toHaveURL(/\/hypercube-popout$/);
  await expect(hypercube.getByRole("heading", { name: definition, exact: true })).toBeVisible();
  await expect(hypercube.getByText(ppe, { exact: true })).toBeVisible();
  await expect(hypercube.getByRole("button", { name: "Dimensions", exact: true })).toBeVisible();
  await hypercube.close();

  await tab(page, "tree-locations");
  const locationPanel = anchor(page, "details-view-tree-locations");
  await expect(locationPanel).toContainText(ppe);
  const locationWindow = context.waitForEvent("page");
  await locationPanel.getByRole("button", { name: "Open in new window", exact: true }).click();
  const locations = await locationWindow;
  await locations.waitForLoadState("load");
  await expect(locations).toHaveURL(/\/tree-locations-popout$/);
  await expect(locations.getByText(ppe, { exact: true })).toBeVisible();
  await expect(locations.getByRole("tree")).toContainText("Presentation");
  await locations.close();
  expect(errors, "Unexpected packaged-application errors or warnings").toEqual([]);
});
