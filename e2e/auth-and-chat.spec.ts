import { expect, test } from "@playwright/test";

test.describe("smoke: auth and AI endpoints", () => {
  test("demo-1min opens login scene link", async ({ page }) => {
    await page.goto("/demo-1min");
    await expect(page.getByRole("heading", { name: "One-minute walkthrough" })).toBeVisible();

    const sceneLink = page.getByRole("link", { name: "Open this scene now (/login)" });
    await expect(sceneLink).toBeVisible();
    await sceneLink.click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
  });

  test("staff demo login API accepts 1/1", async ({ request }) => {
    const res = await request.post("/api/auth/nurse-login", {
      data: { loginId: "1", password: "1" },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as {
      ok?: unknown;
      nurseId?: unknown;
      hospitalId?: unknown;
    };
    expect(json.ok).toBe(true);
    expect(json.nurseId).toBe("1");
    expect(typeof json.hospitalId).toBe("string");
  });

  test("login page shows invite-token flow controls", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Family & patient invite" })).toBeVisible();
    await expect(page.getByLabel("Invite token")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with token" })).toBeVisible();
  });

  test("chat API returns a triage payload shape", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { message: "I need help" },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as {
      response?: unknown;
      summary?: unknown;
      priority?: unknown;
    };
    expect(typeof json.response).toBe("string");
    expect(typeof json.summary).toBe("string");
    expect(typeof json.priority).toBe("number");
  });

  test("family-summary API returns text response", async ({ request }) => {
    const res = await request.post("/api/family-summary", {
      data: {
        date: "2026/05/09",
        calls: [
          {
            reasons: ["Chat"],
            notes: "Smoke test",
            sender: "Kiyoko",
            time: "10:00",
          },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { text?: unknown };
    expect(typeof json.text).toBe("string");
  });
});
