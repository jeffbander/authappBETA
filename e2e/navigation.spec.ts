import { test, expect } from "@playwright/test";

const navItems = [
  { label: "Input", href: "/input" },
  { label: "Results", href: "/results" },
  { label: "Signature Setup", href: "/signature" },
  { label: "Providers", href: "/admin/providers" },
  { label: "Auth Rules", href: "/admin/rules" },
];

test.describe("Sidebar navigation", () => {
  test("renders all navigation links", async ({ page }) => {
    await page.goto("/input");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    for (const item of navItems) {
      await expect(sidebar.getByText(item.label)).toBeVisible();
    }
  });

  test("shows CardioAuth branding", async ({ page }) => {
    await page.goto("/input");
    await expect(page.locator("text=CardioAuth")).toBeVisible();
    await expect(page.locator("text=MSW Heart Cardiology")).toBeVisible();
  });

  for (const item of navItems) {
    test(`clicking "${item.label}" navigates to ${item.href}`, async ({
      page,
    }) => {
      await page.goto("/input");
      await page.locator("aside").getByText(item.label).click();
      await expect(page).toHaveURL(item.href);
    });
  }

  test("active link is highlighted", async ({ page }) => {
    await page.goto("/input");
    const inputLink = page.locator("aside a", { hasText: "Input" });
    await expect(inputLink).toHaveClass(/bg-blue-700/);

    const resultsLink = page.locator("aside a", { hasText: "Results" });
    await expect(resultsLink).not.toHaveClass(/bg-blue-700/);
  });
});
