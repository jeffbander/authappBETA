import { test, expect } from "@playwright/test";

test.describe("Admin Rules page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/rules");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Authorization Rules" })
    ).toBeVisible();
  });

  test("shows rules or Load Default Rules button", async ({ page }) => {
    // Wait for loading
    await page.waitForSelector("text=Loading...", {
      state: "hidden",
      timeout: 10_000,
    });

    const loadDefaultBtn = page.getByRole("button", {
      name: "Load Default Rules",
    });
    const editRulesBtn = page.getByRole("button", { name: "Edit Rules" });

    const hasLoadDefault = await loadDefaultBtn.isVisible().catch(() => false);
    const hasEditBtn = await editRulesBtn.first().isVisible().catch(() => false);

    // Either rules are loaded (Edit Rules visible) or no rules (Load Default visible)
    expect(hasLoadDefault || hasEditBtn).toBeTruthy();
  });

  test("edit mode toggle and cancel", async ({ page }) => {
    // Wait for loading
    await page.waitForSelector("text=Loading...", {
      state: "hidden",
      timeout: 10_000,
    });

    const editBtn = page.getByRole("button", { name: "Edit Rules" }).first();
    const hasEditBtn = await editBtn.isVisible().catch(() => false);

    if (hasEditBtn) {
      // Click Edit Rules to enter edit mode
      await editBtn.click();

      // Should see textarea and Save/Cancel buttons
      await expect(page.locator("textarea").first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save" }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cancel" }).first()
      ).toBeVisible();

      // Click Cancel to return to read-only
      await page.getByRole("button", { name: "Cancel" }).first().click();
      await expect(page.locator("textarea")).not.toBeVisible();

      // Edit Rules button should be visible again
      await expect(editBtn).toBeVisible();
    }
  });
});
