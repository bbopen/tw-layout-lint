/**
 * Public API surface — validateOrThrow + LayoutLintError.
 * These exports are part of the package contract; if they regress,
 * downstream non-agent users (who prefer throw semantics) break.
 */

import { describe, it, expect } from "vitest";
import { validateOrThrow, LayoutLintError } from "../src/index.js";

describe("validateOrThrow", () => {
  it("returns the validated input on success", () => {
    const input = {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: { "--ll-cols": "1fr 1fr", "--ll-gap": "1rem" },
      },
    };
    const out = validateOrThrow(input);
    expect(out.root.className).toBe(input.root.className);
    expect(out.container?.className).toBe("@container/layout");
  });

  it("throws LayoutLintError on validation failure", () => {
    expect(() =>
      validateOrThrow({ root: { className: "grid bg-blue-500" } }),
    ).toThrowError(LayoutLintError);
  });

  it("throws LayoutLintError carrying the first error code in the message", () => {
    let caught: unknown;
    try {
      validateOrThrow({ root: { className: "grid grid-cols-3" } });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LayoutLintError);
    if (!(caught instanceof LayoutLintError)) return;
    expect(caught.message).toContain("LL_E_NUMERIC_UTILITY_RUNTIME");
    expect(caught.message).toContain("root.className");
  });

  it("LayoutLintError exposes errors and warnings arrays", () => {
    let caught: LayoutLintError | undefined;
    try {
      validateOrThrow(null);
    } catch (e) {
      if (e instanceof LayoutLintError) caught = e;
    }
    expect(caught).toBeDefined();
    if (!caught) return;
    expect(caught.errors.length).toBeGreaterThan(0);
    expect(caught.errors[0]?.code).toBe("LL_E_INPUT_SHAPE");
    expect(Array.isArray(caught.warnings)).toBe(true);
  });

  it("LayoutLintError.name is 'LayoutLintError' (for instanceof checks across realms)", () => {
    let caught: LayoutLintError | undefined;
    try {
      validateOrThrow(null);
    } catch (e) {
      if (e instanceof LayoutLintError) caught = e;
    }
    expect(caught?.name).toBe("LayoutLintError");
  });

  it("includes 'and N more' suffix when there are multiple errors", () => {
    let caught: LayoutLintError | undefined;
    try {
      validateOrThrow({
        root: { className: "grid grid-cols-3 gap-4 bg-blue-500" },
      });
    } catch (e) {
      if (e instanceof LayoutLintError) caught = e;
    }
    expect(caught).toBeDefined();
    if (!caught) return;
    // Force multi-error precondition. If a future change short-circuits
    // after the first error or dedupes them, this assertion fails loudly
    // instead of the test silently no-op'ing.
    expect(
      caught.errors.length,
      `expected >1 errors so the suffix is exercised; got ${caught.errors.length}`,
    ).toBeGreaterThan(1);
    expect(caught.message).toMatch(/\+\d+ more/u);
  });

  it("LayoutLintError.errors is frozen — runtime mutation rejected", () => {
    let caught: LayoutLintError | undefined;
    try {
      validateOrThrow({ root: { className: "bg-blue-500" } });
    } catch (e) {
      if (e instanceof LayoutLintError) caught = e;
    }
    expect(caught).toBeDefined();
    if (!caught) return;
    // The TypeScript type is ReadonlyArray, but that only protects
    // compile-time call sites. At runtime, the constructor must freeze
    // the arrays so a caller can't `errors.push(...)` and corrupt the
    // diagnostic record.
    const before = caught.errors.length;
    expect(() => {
      // @ts-expect-error — intentional runtime mutation attempt
      caught!.errors.push({ code: "FAKE" });
    }).toThrow(TypeError);
    expect(caught.errors.length).toBe(before);
  });

  it("LayoutLintError.warnings is frozen — runtime mutation rejected", () => {
    let caught: LayoutLintError | undefined;
    try {
      validateOrThrow({ root: { className: "bg-blue-500" } });
    } catch (e) {
      if (e instanceof LayoutLintError) caught = e;
    }
    expect(caught).toBeDefined();
    if (!caught) return;
    expect(() => {
      // @ts-expect-error — intentional runtime mutation attempt
      caught!.warnings.push({ code: "FAKE" });
    }).toThrow(TypeError);
  });
});
