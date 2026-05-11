import type { Page } from "@playwright/test";

/** Home (`/`) finishes hydrate and shows the top patient bar. */
export async function waitForGrandmaHome(page: Page) {
  await page.goto("/");
  await page.getByText("Patient", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
}

/** Simple Kiyoko grid screen at `/kiyoko`. */
export async function gotoKiyokoSimpleScreen(page: Page) {
  await page.goto("/kiyoko");
  await page.getByRole("heading", { name: "Kiyoko — nurse call" }).waitFor({
    state: "visible",
    timeout: 15_000,
  });
}
