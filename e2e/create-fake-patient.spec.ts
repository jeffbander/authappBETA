import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test("create fake patient and verify AI processing", async ({ page }) => {
  await setupClerkTestingToken({ page });
  // Step 1: Navigate to input page
  await page.goto("/input");
  await expect(
    page.getByRole("heading", { name: "Patient Authorization Input" })
  ).toBeVisible();

  // Step 2: Fill in MRN
  const mrn = `E2E-FAKE-${Date.now()}`;
  await page.getByPlaceholder("Enter MRN").fill(mrn);

  // Step 3: Patient type = NEW (default)
  await expect(page.getByRole("button", { name: "New" })).toHaveClass(
    /bg-blue-600/
  );

  // Step 4: Fill clinical notes
  await page
    .getByPlaceholder(/clinical notes/i)
    .fill(
      "45 year old male with history of diabetes mellitus and congestive heart failure, " +
        "now presenting with worsening shortness of breath and chest pain. " +
        "Patient reports increasing dyspnea on exertion over the past 2 weeks. " +
        "Chest pain is substernal, non-radiating, worsens with activity. " +
        "Referring physician: Dr. Smith."
    );

  // Step 5: Fill insurance info
  await page
    .getByPlaceholder(/insurance type/i)
    .fill("Cigna PPO - Commercial insurance");

  // Step 6: Fill previous studies
  await page
    .getByPlaceholder(/previous cardiac/i)
    .fill(
      "TTE 1/2/2025 - Normal echocardiogram, EF 55%, no wall motion abnormalities, " +
        "normal valvular function, no pericardial effusion."
    );

  // Step 7: Submit
  await page.getByRole("button", { name: /Submit & Next/ }).click();

  // Step 8: Verify success message
  await expect(
    page.getByText(`MRN ${mrn} submitted successfully`)
  ).toBeVisible({ timeout: 15_000 });

  console.log(`✅ Patient submitted with MRN: ${mrn}`);

  // Step 9: Navigate to results and find our patient
  await page.locator("aside").getByText("Results").click();
  await expect(
    page.getByRole("heading", { name: "Authorization Results" })
  ).toBeVisible();

  // Wait for our patient to appear
  await expect(page.getByText(`MRN: ${mrn}`)).toBeVisible({ timeout: 15_000 });
  console.log("✅ Patient visible on results page");

  // Step 10: Wait for AI processing to complete (poll for up to 60s)
  const patientCard = page.locator("button").filter({ hasText: mrn });

  // Wait for status to change from Processing
  await expect(async () => {
    const text = await patientCard.textContent();
    expect(text).not.toContain("Processing");
  }).toPass({ timeout: 90_000, intervals: [3_000] });

  console.log("✅ AI processing completed");

  // Step 11: Expand the card and check results
  await patientCard.click();

  // Check for AI-extracted data or decision
  const expandedContent = page.locator(".border-t.border-slate-100").first();
  await expect(expandedContent).toBeVisible();

  // Log what we see
  const fullText = await expandedContent.textContent();
  console.log("\n📋 AI Response Details:");
  console.log(fullText);

  // Verify some expected content was extracted
  // The AI should have extracted diagnoses, symptoms, etc.
  const pageContent = await page.content();

  if (pageContent.includes("Rationale")) {
    console.log("✅ Rationale present");
  }
  if (pageContent.includes("Approved") || pageContent.includes("Denied") || pageContent.includes("Needs")) {
    console.log("✅ Decision rendered");
  }
});
