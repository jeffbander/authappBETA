import { test, expect } from "@playwright/test";

test.describe("Input page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/input");
  });

  test("renders the form with correct heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Patient Authorization Input" })
    ).toBeVisible();
    await expect(
      page.getByText("Enter patient information for AI-powered")
    ).toBeVisible();
  });

  test("MRN field is auto-focused", async ({ page }) => {
    const mrnInput = page.getByPlaceholder("Enter MRN");
    await expect(mrnInput).toBeFocused();
  });

  test("Submit & Next button is disabled when MRN is empty", async ({
    page,
  }) => {
    const mrnInput = page.getByPlaceholder("Enter MRN");
    await expect(mrnInput).toHaveValue("");
    const submitBtn = page.getByRole("button", { name: /Submit & Next/ });
    await expect(submitBtn).toBeDisabled();
  });

  test("Submit & Next button is enabled when MRN has a value", async ({
    page,
  }) => {
    await page.getByPlaceholder("Enter MRN").fill("TEST123");
    const submitBtn = page.getByRole("button", { name: /Submit & Next/ });
    await expect(submitBtn).toBeEnabled();
  });

  test("patient type toggle switches between New and Follow-up", async ({
    page,
  }) => {
    const newBtn = page.getByRole("button", { name: "New" });
    const followupBtn = page.getByRole("button", { name: "Follow-up" });

    // Default is NEW
    await expect(newBtn).toHaveClass(/bg-blue-600/);
    await expect(followupBtn).not.toHaveClass(/bg-blue-600/);

    // Click Follow-up
    await followupBtn.click();
    await expect(followupBtn).toHaveClass(/bg-blue-600/);
    await expect(newBtn).not.toHaveClass(/bg-blue-600/);

    // Click New again
    await newBtn.click();
    await expect(newBtn).toHaveClass(/bg-blue-600/);
  });

  test("Clear button resets all fields", async ({ page }) => {
    const mrnInput = page.getByPlaceholder("Enter MRN");
    const clinicalNotes = page.getByPlaceholder(/clinical notes/i);
    const insuranceInfo = page.getByPlaceholder(/insurance type/i);
    const previousStudies = page.getByPlaceholder(/previous cardiac/i);

    await mrnInput.fill("TEST999");
    await clinicalNotes.fill("Some notes");
    await insuranceInfo.fill("Medicare");
    await previousStudies.fill("Echo 2023");

    // Toggle to Follow-up
    await page.getByRole("button", { name: "Follow-up" }).click();

    // Click Clear
    await page.getByRole("button", { name: "Clear" }).click();

    await expect(mrnInput).toHaveValue("");
    await expect(clinicalNotes).toHaveValue("");
    await expect(insuranceInfo).toHaveValue("");
    await expect(previousStudies).toHaveValue("");

    // Patient type should reset to NEW
    await expect(page.getByRole("button", { name: "New" })).toHaveClass(
      /bg-blue-600/
    );
  });

  test("successful submission shows success message", async ({ page }) => {
    const timestamp = Date.now();
    const mrn = `E2E-${timestamp}`;

    await page.getByPlaceholder("Enter MRN").fill(mrn);
    await page
      .getByPlaceholder(/clinical notes/i)
      .fill("E2E test - chest pain, shortness of breath");

    await page.getByRole("button", { name: /Submit & Next/ }).click();

    // Should see success banner
    await expect(page.getByText(`MRN ${mrn} submitted successfully`)).toBeVisible({
      timeout: 10_000,
    });

    // MRN should be cleared for next patient
    await expect(page.getByPlaceholder("Enter MRN")).toHaveValue("");
  });
});
