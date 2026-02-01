import { clerkSetup } from "@clerk/testing/playwright";

async function globalSetup() {
  await clerkSetup({ debug: true });
}

export default globalSetup;
