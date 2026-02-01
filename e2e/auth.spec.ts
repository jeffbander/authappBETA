import { test, expect } from "@playwright/test";

// These tests run WITHOUT stored auth state to verify redirect behavior
test.use({ storageState: { cookies: [], origins: [] } });

const protectedRoutes = [
  "/input",
  "/results",
  "/signature",
  "/admin/providers",
  "/admin/rules",
];

for (const route of protectedRoutes) {
  test(`unauthenticated visit to ${route} redirects to /sign-in`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
  });
}
