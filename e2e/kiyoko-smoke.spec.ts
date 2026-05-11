import { expect, test } from "@playwright/test";
import { gotoKiyokoSimpleScreen, waitForGrandmaHome } from "./helpers";

/**
 * E2E 雛形: まず安定する画面だけを自動化し、マイク/TTS/STT はローカルで手動 or
 * `test.describe.skip` を外してから調整する。
 */
test.describe("kiyoko: smoke (no mic)", () => {
  test("grandma home loads shell", async ({ page }) => {
    await waitForGrandmaHome(page);
    await expect(page.getByRole("link", { name: "Staff login" })).toBeVisible();
  });

  test("kiyoko simple screen shows two targets", async ({ page }) => {
    await gotoKiyokoSimpleScreen(page);
    await expect(page.getByText("Restroom", { exact: false })).toBeVisible();
    await expect(page.getByText("Hey", { exact: true })).toBeVisible();
  });
});

/**
 * ここに Lantern / Voice フローを足すときの雛形:
 * - マイク許可: `await page.context().grantPermissions(["microphone"])`
 * - `gotoKiyokoSimpleScreen` → GazeHoverSurface で Talk を 2 秒ホールドしてモーダル起動
 * - または `/` で gaze Chat 成功まで進める（虹彩ターゲットは環境依存で不安定）
 *
 * CI では音響デバイスが無いことが多いので既定は skip。
 */
test.describe.skip("kiyoko: voice modal (skeleton — run locally)", () => {
  test("placeholder: open Talk surface after hold", async ({ page }) => {
    await gotoKiyokoSimpleScreen(page);
    // TODO: simulate 2s dwell on Talk tile → VoiceTriageModal → assert dialog role / 終了ボタン
    await expect(page.getByRole("heading", { name: "Kiyoko — nurse call" })).toBeVisible();
  });
});
