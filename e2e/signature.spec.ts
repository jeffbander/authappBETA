import { test, expect } from "@playwright/test";

test.describe("Signature page", () => {
  test("renders the page heading", async ({ page }) => {
    await page.goto("/signature");
    await expect(
      page.getByRole("heading", { name: "Signature Setup" })
    ).toBeVisible();
  });

  test("shows no-provider warning or signature canvas", async ({ page }) => {
    await page.goto("/signature");

    // Wait for loading to finish
    await page.waitForSelector("text=Loading...", {
      state: "hidden",
      timeout: 10_000,
    });

    // Either shows the no-provider warning OR the signature canvas
    const noProviderWarning = page.getByText(
      "No provider profile found for your account"
    );
    const signatureCanvas = page.locator("canvas");
    const saveButton = page.getByRole("button", { name: /Save Signature/ });
    const clearButton = page.getByRole("button", { name: "Clear" });

    const hasWarning = await noProviderWarning.isVisible().catch(() => false);

    if (hasWarning) {
      await expect(noProviderWarning).toBeVisible();
      await expect(
        page.getByText("administrator to create your provider profile")
      ).toBeVisible();
    } else {
      // Provider exists — canvas and buttons should render
      await expect(signatureCanvas).toBeVisible();
      await expect(saveButton).toBeVisible();
      await expect(clearButton).toBeVisible();
    }
  });
});
