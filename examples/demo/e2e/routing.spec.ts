import { test, expect } from "@playwright/test";

test.describe("hash routing", () => {
  test("unknown hash redirects to #/adversarial", async ({ page }) => {
    await page.goto("/#/whatever-bogus-route");
    await expect(page.getByTestId("adversarial-page")).toBeVisible();
    // URL should have been normalized via history.replaceState
    await expect.poll(() => new URL(page.url()).hash).toBe("#/adversarial");
  });

  test("empty hash redirects to #/adversarial", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("adversarial-page")).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe("#/adversarial");
  });

  test("typing an unknown hash live (hashchange) normalizes the URL", async ({
    page,
  }) => {
    await page.goto("/#/playground");
    await expect(page.getByTestId("playground-page")).toBeVisible();
    await page.evaluate(() => {
      window.location.hash = "#/something-bad";
    });
    // After hashchange handler runs: page is adversarial, URL is normalized
    await expect(page.getByTestId("adversarial-page")).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe("#/adversarial");
  });

  test("known hashes are not modified", async ({ page }) => {
    for (const target of ["adversarial", "playground", "gallery"] as const) {
      await page.goto(`/#/${target}`);
      await expect(page.getByTestId(`${target}-page`)).toBeVisible();
      expect(new URL(page.url()).hash).toBe(`#/${target}`);
    }
  });
});
