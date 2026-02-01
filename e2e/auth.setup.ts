import { test as setup, expect } from "@playwright/test";
import { setupClerkTestingToken, clerk } from "@clerk/testing/playwright";

setup("authenticate", async ({ page, context }) => {
  // Step 1: Get __clerk_db_jwt via direct HTTP (no browser involved)
  // The Clerk handshake flow: localhost → clerk FAPI → localhost?__clerk_handshake=JWT
  // The handshake JWT contains the __clerk_db_jwt value.
  // We follow the redirects manually to extract it.

  const res1 = await fetch("http://localhost:3000/sign-in", {
    redirect: "manual",
  });
  // Should be 307 → clerk FAPI handshake URL
  const fapiUrl = res1.headers.get("location");
  if (!fapiUrl) throw new Error("Expected redirect to Clerk FAPI");

  const res2 = await fetch(fapiUrl, { redirect: "manual" });
  // Should be 307 → localhost/sign-in?__clerk_handshake=JWT
  const handshakeUrl = res2.headers.get("location");
  if (!handshakeUrl) throw new Error("Expected redirect back from Clerk FAPI");

  // Extract __clerk_db_jwt from the handshake JWT in the URL
  const match = handshakeUrl.match(/__clerk_handshake=([^&]+)/);
  if (!match) throw new Error("No __clerk_handshake in redirect URL");

  const parts = match[1].split(".");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  let dbJwt: string | null = null;
  for (const cookieStr of payload.handshake || []) {
    const m = cookieStr.match(/__clerk_db_jwt=([^;]+)/);
    if (m && m[1]) dbJwt = m[1];
  }

  if (!dbJwt) throw new Error("Could not extract __clerk_db_jwt");
  console.log("Got __clerk_db_jwt:", dbJwt.substring(0, 20) + "...");

  // Step 2: Also complete the handshake so the server processes it
  const res3 = await fetch(handshakeUrl, { redirect: "manual" });
  // This sets cookies via Set-Cookie headers — we capture them all
  const allCookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }> = [];

  // Parse ALL set-cookie headers from the handshake response
  const setCookies = res3.headers.getSetCookie?.() || [];
  for (const sc of setCookies) {
    const nameValue = sc.split(";")[0];
    const [name, ...rest] = nameValue.split("=");
    if (name && rest.length) {
      allCookies.push({
        name: name.trim(),
        value: rest.join("=").trim(),
        domain: "localhost",
        path: "/",
      });
    }
  }

  // Always ensure __clerk_db_jwt is set
  if (!allCookies.find((c) => c.name === "__clerk_db_jwt")) {
    allCookies.push({
      name: "__clerk_db_jwt",
      value: dbJwt,
      domain: "localhost",
      path: "/",
    });
  }
  if (!allCookies.find((c) => c.name === "__client_uat")) {
    allCookies.push({
      name: "__client_uat",
      value: "0",
      domain: "localhost",
      path: "/",
    });
  }

  console.log(
    "Setting cookies:",
    allCookies.map((c) => c.name)
  );

  // Step 3: Inject cookies into the browser context BEFORE any navigation
  await context.addCookies(allCookies);

  // Step 4: Set up testing token interceptor
  await setupClerkTestingToken({ page });

  // Step 5: Navigate — middleware should accept our cookies
  await page.goto("/sign-in", { waitUntil: "domcontentloaded", timeout: 30_000 });

  // Wait for Clerk JS to load
  await page.waitForFunction(
    () => (window as any).Clerk?.loaded === true,
    null,
    { timeout: 30_000 }
  );

  console.log("Clerk loaded successfully!");

  // Step 6: Sign in
  const email = process.env.E2E_CLERK_EMAIL!;
  const password = process.env.E2E_CLERK_PASSWORD!;

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: email,
      password,
    },
  });

  // Verify auth
  await page.goto("/input");
  await expect(page.locator("text=CardioAuth")).toBeVisible({ timeout: 15_000 });

  await context.storageState({ path: "e2e/.auth/user.json" });
});
