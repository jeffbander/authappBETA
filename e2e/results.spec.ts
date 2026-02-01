import { test, expect } from "@playwright/test";

test.describe("Results page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/results");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Authorization Results" })
    ).toBeVisible();
  });

  test("filter controls are visible", async ({ page }) => {
    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Date of Service")).toBeVisible();
  });

  test("status dropdown has correct options", async ({ page }) => {
    const select = page.getByLabel("Status");
    const options = select.locator("option");
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText("All Statuses");
    await expect(options.nth(1)).toHaveText("Processing");
    await expect(options.nth(2)).toHaveText("Complete");
    await expect(options.nth(3)).toHaveText("Needs Review");
  });

  test("Clear Filters button appears when a filter is set", async ({
    page,
  }) => {
    // Initially no Clear Filters
    await expect(page.getByText("Clear Filters")).not.toBeVisible();

    // Set a filter
    await page.getByLabel("Status").selectOption("PROCESSING");
    await expect(page.getByText("Clear Filters")).toBeVisible();

    // Click Clear Filters
    await page.getByText("Clear Filters").click();
    await expect(page.getByText("Clear Filters")).not.toBeVisible();
    await expect(page.getByLabel("Status")).toHaveValue("");
  });

  test("patient card can be expanded and collapsed", async ({ page }) => {
    // Wait for results to load
    await page.waitForSelector('text="Loading results..."', {
      state: "hidden",
      timeout: 10_000,
    });

    // Check if there are any results
    const noResults = page.getByText("No results found");
    const hasResults = await noResults.isVisible().catch(() => false);

    if (!hasResults) {
      // Click the first patient card to expand
      const firstCard = page.locator("button").filter({ hasText: /MRN:/ }).first();
      if (await firstCard.isVisible()) {
        await firstCard.click();
        // Should show expanded content (rationale section or extracted data)
        await expect(
          page.locator(".border-t.border-slate-100").first()
        ).toBeVisible();

        // Click again to collapse
        await firstCard.click();
        await expect(
          page.locator(".border-t.border-slate-100").first()
        ).not.toBeVisible();
      }
    }
  });
});
