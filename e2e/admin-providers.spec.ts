import { test, expect } from "@playwright/test";

test.describe("Admin Providers page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/providers");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Provider Management" })
    ).toBeVisible();
  });

  test("Add Provider button toggles the form", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: "Add Provider" });
    await expect(addBtn).toBeVisible();

    await addBtn.click();

    // Form should be visible with New Provider heading
    await expect(
      page.getByRole("heading", { name: "New Provider" })
    ).toBeVisible();
    await expect(page.getByLabel("Name *")).toBeVisible();
    await expect(page.getByLabel("Credentials *")).toBeVisible();
    await expect(page.getByLabel("NPI *")).toBeVisible();
    await expect(page.getByLabel("Clerk User ID")).toBeVisible();

    // Add Provider button should be hidden while form is open
    await expect(addBtn).not.toBeVisible();

    // Cancel closes the form
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "New Provider" })
    ).not.toBeVisible();
    await expect(addBtn).toBeVisible();
  });

  test("create a new provider", async ({ page }) => {
    const timestamp = Date.now();
    const providerName = `E2E-Provider-${timestamp}`;

    await page.getByRole("button", { name: "Add Provider" }).click();

    await page.getByLabel("Name *").fill(providerName);
    await page.getByLabel("Credentials *").fill("MD, FACC");
    await page.getByLabel("NPI *").fill(`E2E${timestamp}`);

    await page.getByRole("button", { name: "Create" }).click();

    // Form should close and provider should appear in the table
    await expect(
      page.getByRole("heading", { name: "New Provider" })
    ).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 5_000 });
  });

  test("edit a provider", async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector("text=Loading...", {
      state: "hidden",
      timeout: 10_000,
    });

    // Find an E2E provider to edit (from previous test)
    const editButtons = page.getByTitle("Edit");
    const count = await editButtons.count();

    if (count > 0) {
      await editButtons.first().click();
      await expect(
        page.getByRole("heading", { name: "Edit Provider" })
      ).toBeVisible();

      // Verify form is populated
      await expect(page.getByLabel("Name *")).not.toHaveValue("");

      // Cancel edit
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit Provider" })
      ).not.toBeVisible();
    }
  });

  test("delete button exists for providers", async ({ page }) => {
    await page.waitForSelector("text=Loading...", {
      state: "hidden",
      timeout: 10_000,
    });

    const deleteButtons = page.getByTitle("Delete");
    const count = await deleteButtons.count();

    // If providers exist, delete buttons should be present
    if (count > 0) {
      await expect(deleteButtons.first()).toBeVisible();
    }
  });
});
