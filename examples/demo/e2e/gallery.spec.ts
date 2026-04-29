import { test, expect } from "@playwright/test";

test.describe("Gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/gallery");
    await expect(page.getByTestId("gallery-page")).toBeVisible();
  });

  test("renders every canonical example", async ({ page }) => {
    const ids = [
      "vertical-stack",
      "sidebar-main",
      "auto-fit-gallery",
      "two-row-vertical",
      "ordered-flex",
      "bounded-content",
      "label-value",
      "responsive-three-pane",
    ];
    for (const id of ids) {
      await expect(page.getByTestId(`gallery-${id}`)).toBeVisible();
      await expect(page.getByTestId(`gallery-${id}-render`)).toBeVisible();
      await expect(page.getByTestId(`gallery-${id}-status`)).toHaveAttribute(
        "data-status",
        "ok",
      );
    }
  });

  test("each example provides a non-trivial describe() round-trip", async ({
    page,
  }) => {
    const ids = [
      "vertical-stack",
      "sidebar-main",
      "auto-fit-gallery",
    ];
    for (const id of ids) {
      const desc = page.getByTestId(`gallery-${id}-describe`);
      await expect(desc).toBeVisible();
      const text = await desc.innerText();
      expect(text.length).toBeGreaterThan(20);
    }
  });

  test("sidebar-main grid actually has computed grid layout in the DOM", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="gallery-sidebar-main-render"] [class*="grid-cols"]',
      );
      if (!el) return null;
      const s = window.getComputedStyle(el as Element);
      return {
        display: s.display,
        gridCols: s.gridTemplateColumns,
        gap: s.gap,
      };
    });
    expect(result).not.toBeNull();
    expect(result!.display).toBe("grid");
    expect(result!.gridCols).not.toBe("");
    expect(result!.gap).toBe("16px");
  });
});
