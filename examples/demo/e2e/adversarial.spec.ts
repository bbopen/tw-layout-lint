import { test, expect } from "@playwright/test";

test.describe("Adversarial showcase", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/adversarial");
    await expect(page.getByTestId("adversarial-page")).toBeVisible();
  });

  test("renders every scenario with a paired before/after", async ({ page }) => {
    const scenarioIds = [
      "static-numeric-gap",
      "arbitrary-template",
      "missing-container",
      "container-on-root",
      "cross-pair-var",
      "dangling-ref",
      "calc-in-value",
      "visual-styling",
      "stacked-variants",
    ];
    for (const id of scenarioIds) {
      await expect(page.getByTestId(`scenario-${id}`)).toBeVisible();
      await expect(page.getByTestId(`scenario-${id}-before`)).toBeVisible();
      await expect(page.getByTestId(`scenario-${id}-after`)).toBeVisible();
    }
  });

  test("each broken scenario surfaces at least one error diagnostic", async ({ page }) => {
    const scenarioIds = [
      "static-numeric-gap",
      "arbitrary-template",
      "missing-container",
      "container-on-root",
      "cross-pair-var",
      "dangling-ref",
      "calc-in-value",
      "stacked-variants",
    ];
    for (const id of scenarioIds) {
      const firstError = page.getByTestId(`scenario-${id}-before-diag-error-0`);
      await expect(firstError).toBeVisible();
      // Diagnostic carries a stable code attribute
      await expect(firstError).toHaveAttribute("data-code", /^LL_/u);
      await expect(firstError).toHaveAttribute("data-severity", "error");
    }
  });

  test("static-numeric-gap surfaces LL_E_NUMERIC_UTILITY_RUNTIME", async ({
    page,
  }) => {
    const diag = page.getByTestId("scenario-static-numeric-gap-before-diag-error-0");
    await expect(diag).toHaveAttribute(
      "data-code",
      "LL_E_NUMERIC_UTILITY_RUNTIME",
    );
  });

  test("arbitrary-template surfaces LL_E_ARBITRARY_VALUE_RUNTIME", async ({
    page,
  }) => {
    const diag = page.getByTestId("scenario-arbitrary-template-before-diag-error-0");
    await expect(diag).toHaveAttribute(
      "data-code",
      "LL_E_ARBITRARY_VALUE_RUNTIME",
    );
  });

  test("missing-container surfaces LL_E_CONTAINER_MISSING", async ({ page }) => {
    const diag = page.getByTestId("scenario-missing-container-before-diag-error-0");
    await expect(diag).toHaveAttribute("data-code", "LL_E_CONTAINER_MISSING");
  });

  test("cross-pair-var surfaces LL_E_RUNTIME_FAMILY_VAR_PAIR", async ({
    page,
  }) => {
    const diag = page.getByTestId("scenario-cross-pair-var-before-diag-error-0");
    await expect(diag).toHaveAttribute(
      "data-code",
      "LL_E_RUNTIME_FAMILY_VAR_PAIR",
    );
  });

  test("each repaired scenario validates clean", async ({ page }) => {
    const scenarioIds = [
      "static-numeric-gap",
      "arbitrary-template",
      "missing-container",
      "container-on-root",
      "cross-pair-var",
      "dangling-ref",
      "calc-in-value",
      "visual-styling",
      "stacked-variants",
    ];
    for (const id of scenarioIds) {
      await expect(page.getByTestId(`scenario-${id}-after-ok`)).toBeVisible();
    }
  });

  test("each repaired scenario renders a real DOM tree from SlotLayout", async ({
    page,
  }) => {
    const sample = page.getByTestId("scenario-static-numeric-gap-preview");
    await expect(sample).toBeVisible();
    // The preview must contain at least one element with a layout class
    await expect(sample.locator("[class*='flex']")).toHaveCount(1);
  });

  test("Tailwind v4 actually compiled CSS for our classes", async ({ page }) => {
    // Probe one of the rendered containers and verify computed styles
    // reflect the layout we declared (display: grid + grid-template-columns).
    const handle = await page.evaluateHandle(() => {
      const el = document.querySelector(
        '[data-testid="scenario-arbitrary-template-preview"] [class*="grid-cols"]',
      );
      if (!el) return null;
      const style = window.getComputedStyle(el as Element);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
      };
    });
    const result = (await handle.jsonValue()) as
      | { display: string; gridTemplateColumns: string }
      | null;
    expect(result).not.toBeNull();
    expect(result!.display).toBe("grid");
    // gridTemplateColumns is the resolved computed value; just assert it's
    // not empty (indicates the class generated CSS rather than being inert).
    expect(result!.gridTemplateColumns).not.toBe("");
    expect(result!.gridTemplateColumns).not.toBe("none");
  });
});
