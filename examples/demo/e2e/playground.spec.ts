import { test, expect } from "@playwright/test";

test.describe("Playground", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/playground");
    await expect(page.getByTestId("playground-page")).toBeVisible();
  });

  test("starter input validates clean", async ({ page }) => {
    await expect(page.getByTestId("playground-status")).toHaveAttribute(
      "data-status",
      "ok",
    );
    await expect(page.getByTestId("playground-render")).toBeVisible();
  });

  test("editing to invalid input surfaces a diagnostic live", async ({
    page,
  }) => {
    const textarea = page.getByTestId("playground-input-textarea");
    // Replace `gap-(--ll-gap)` with `gap-4` (static numeric runtime fail)
    await textarea.fill(
      JSON.stringify(
        {
          container: { className: "@container/layout" },
          root: {
            className: "grid grid-cols-(--ll-cols) gap-4",
            style: { "--ll-cols": "1fr 1fr" },
          },
        },
        null,
        2,
      ),
    );
    await expect(page.getByTestId("playground-status")).toHaveAttribute(
      "data-status",
      "error",
    );
    const firstError = page.getByTestId("playground-diag-error-0");
    await expect(firstError).toHaveAttribute(
      "data-code",
      "LL_E_NUMERIC_UTILITY_RUNTIME",
    );
  });

  test("invalid JSON shows a parse-error message", async ({ page }) => {
    await page.getByTestId("playground-input-textarea").fill("{ not json");
    await expect(page.getByTestId("playground-json-error")).toBeVisible();
  });

  test("describe() output is shown for valid input", async ({ page }) => {
    // Start fresh with the default
    await page.reload();
    await page.getByText("describe() output").click();
    await expect(page.getByTestId("playground-description")).toBeVisible();
    const text = await page.getByTestId("playground-description").innerText();
    expect(text.length).toBeGreaterThan(20);
  });
});
