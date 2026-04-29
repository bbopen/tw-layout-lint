/**
 * Adversarial fixtures — every category of mistake we expect an LLM
 * to make when emitting a `LayoutLintInput`. Each fixture asserts:
 *
 *   1. Validation rejects the input (or accepts with a soft warning).
 *   2. The diagnostic code is the one we want the LLM to encounter.
 *   3. The hint text contains repair guidance the LLM can act on.
 *
 * Plus a "self-correction simulation" sub-suite that takes a broken
 * input, applies a mechanical fix derived from the first diagnostic,
 * and asserts validation passes within ≤ 3 iterations. This is the
 * proof that diagnostics are actionable, not just informative.
 */

import { describe, it, expect } from "vitest";
import { validate } from "../src/validate.js";
import type { Diagnostic, LayoutLintInput } from "../src/types.js";

// ───────────────────────── helpers ─────────────────────────

type Fixture = {
  name: string;
  input: unknown;
  expectedCodes: ReadonlyArray<string>;
  options?: Parameters<typeof validate>[1];
};

function assertRejects(fix: Fixture): void {
  const r = validate(fix.input, fix.options);
  expect(r.ok, `${fix.name}: expected rejection`).toBe(false);
  if (r.ok) return;
  const codes = new Set(r.errors.map((e) => e.code));
  for (const expected of fix.expectedCodes) {
    expect(
      codes.has(expected),
      `${fix.name}: expected code ${expected}; got [${[...codes].join(", ")}]`,
    ).toBe(true);
  }
  // Every error must have an actionable hint.
  for (const e of r.errors) {
    expect(e.hint, `${fix.name}: error ${e.code} missing hint`).toBeTruthy();
    expect((e.hint ?? "").length, `${fix.name}: error ${e.code} has trivial hint`).toBeGreaterThan(20);
  }
}

// ─────────────── A. hallucinated layout utilities ───────────────

describe("adversarial — hallucinated utilities", () => {
  const cases: Fixture[] = [
    {
      name: "gap-large (made-up keyword)",
      input: { root: { className: "grid gap-large" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "flex-middle (wrong shadcn-ism)",
      input: { root: { className: "flex flex-middle" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "grid-cols-six (word instead of number)",
      input: { root: { className: "grid grid-cols-six" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "column-start-2 (wrong utility name)",
      input: { root: { className: "grid column-start-2" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── B. mixing visual styling into layout ───────────────

describe("adversarial — visual styling leaking into layout", () => {
  const cases: Fixture[] = [
    {
      name: "grid bg-blue-500 (color)",
      input: { root: { className: "grid bg-blue-500" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "flex p-4 (padding)",
      input: { root: { className: "flex p-4" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "grid rounded-xl (radius)",
      input: { root: { className: "grid rounded-xl" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "grid border-2 (border)",
      input: { root: { className: "grid border-2" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "flex shadow-md (shadow)",
      input: { root: { className: "flex shadow-md" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "flex text-lg (typography)",
      input: { root: { className: "flex text-lg" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── C. positioning utilities ───────────────

describe("adversarial — positioning escape", () => {
  const cases: Fixture[] = [
    {
      name: "flex relative",
      input: { root: { className: "flex relative" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "grid absolute",
      input: { root: { className: "grid absolute" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "grid z-10",
      input: { root: { className: "grid z-10" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "flex inset-0",
      input: { root: { className: "flex inset-0" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── D. CSS-variable mistakes ───────────────

describe("adversarial — CSS-variable misuse", () => {
  const cases: Fixture[] = [
    {
      name: "typo in canonical name (--ll-col instead of --ll-cols)",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-col)",
          style: { "--ll-col": "1fr 1fr" },
        },
      },
      expectedCodes: ["LL_E_RUNTIME_VAR_NAME"],
    },
    {
      name: "cross-pair: gap consuming --ll-cols",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-cols) gap-(--ll-cols)",
          style: { "--ll-cols": "1fr 1fr" },
        },
      },
      expectedCodes: ["LL_E_RUNTIME_FAMILY_VAR_PAIR"],
    },
    {
      name: "cross-pair: col-span (no runtime var form)",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid col-span-(--ll-cols)",
          style: { "--ll-cols": "3" },
        },
      },
      expectedCodes: ["LL_E_RUNTIME_FAMILY_VAR_PAIR"],
    },
    {
      name: "missing prefix (--cols instead of --ll-cols)",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--cols)",
          style: { "--cols": "1fr 1fr" },
        },
      },
      expectedCodes: ["LL_E_VAR_OUT_OF_NAMESPACE"],
    },
    {
      name: "dangling reference (utility but no style)",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-(--ll-cols)" },
      },
      expectedCodes: ["LL_E_VAR_DANGLING_REF"],
    },
    {
      name: "calc() in CSS-var value",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid gap-(--ll-gap)",
          style: { "--ll-gap": "calc(100vw - 1rem)" },
        },
      },
      expectedCodes: ["LL_E_VAR_VALUE"],
    },
    {
      name: "scientific notation in length",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid gap-(--ll-gap)",
          style: { "--ll-gap": "1e3px" },
        },
      },
      expectedCodes: ["LL_E_VAR_VALUE"],
    },
    {
      name: "% in gap (non-allowed unit)",
      input: {
        container: { className: "@container/layout" },
        root: {
          className: "grid gap-(--ll-gap)",
          style: { "--ll-gap": "10%" },
        },
      },
      expectedCodes: ["LL_E_VAR_VALUE"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── E. arbitrary values in runtime ───────────────

describe("adversarial — arbitrary values in runtime", () => {
  const cases: Fixture[] = [
    {
      name: "grid-cols-[…] arbitrary template",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-[minmax(320px,1fr)_240px]" },
      },
      expectedCodes: ["LL_E_ARBITRARY_VALUE_RUNTIME"],
    },
    {
      name: "gap-[2rem] arbitrary length",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid gap-[2rem]" },
      },
      expectedCodes: ["LL_E_ARBITRARY_VALUE_RUNTIME"],
    },
    {
      name: "@max-[640px]/layout: arbitrary breakpoint",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid @max-[640px]/layout:hidden" },
      },
      expectedCodes: ["LL_E_ARBITRARY_BREAKPOINT"],
    },
    {
      name: "grid-cols-3 (static numeric in runtime)",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-3" },
      },
      expectedCodes: ["LL_E_NUMERIC_UTILITY_RUNTIME"],
    },
    {
      name: "gap-4 (static numeric in runtime)",
      input: {
        container: { className: "@container/layout" },
        root: { className: "flex gap-4" },
      },
      expectedCodes: ["LL_E_NUMERIC_UTILITY_RUNTIME"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── F. variant misuse ───────────────

describe("adversarial — variant misuse", () => {
  const cases: Fixture[] = [
    {
      name: "dark:hidden",
      input: { root: { className: "flex dark:hidden" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "hover:flex",
      input: { root: { className: "grid hover:flex" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "print:hidden",
      input: { root: { className: "flex print:hidden" } },
      expectedCodes: ["LL_E_PARSE_TOKEN"],
    },
    {
      name: "stacked container variants",
      input: {
        container: { className: "@container/layout" },
        root: { className: "@max-md/layout:@max-sm/layout:hidden" },
      },
      expectedCodes: ["LL_E_VARIANT_STACK_NOT_ALLOWED"],
    },
    {
      name: "wrong container name (@max-md/main: but no @container/main)",
      input: {
        container: { className: "@container/layout" },
        root: { className: "@max-md/main:hidden" },
      },
      expectedCodes: ["LL_E_VARIANT_NOT_ALLOWED"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── G. container-marker placement ───────────────

describe("adversarial — container-marker placement", () => {
  const cases: Fixture[] = [
    {
      name: "@container/layout on root",
      input: { root: { className: "@container/layout grid" } },
      expectedCodes: ["LL_E_CONTAINER_PLACEMENT"],
    },
    {
      name: "@container/layout on a region",
      input: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-(--ll-cols)", style: { "--ll-cols": "1fr 1fr" } },
        regions: { aside: { className: "@container/layout" } },
      },
      expectedCodes: ["LL_E_CONTAINER_PLACEMENT"],
    },
    {
      name: "container variant with no container declared",
      input: {
        root: { className: "flex @max-md/layout:hidden" },
      },
      expectedCodes: ["LL_E_CONTAINER_MISSING"],
    },
    {
      name: "container variant on the container target itself",
      input: {
        container: { className: "@container/layout @max-md/layout:hidden" },
        root: {
          className: "grid grid-cols-(--ll-cols)",
          style: { "--ll-cols": "1fr 1fr" },
        },
      },
      expectedCodes: ["LL_E_CONTAINER_VARIANT_PLACEMENT"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── H. !important / leading bang ───────────────

describe("adversarial — !important and bang prefixes", () => {
  const cases: Fixture[] = [
    {
      name: "!grid (! prefix)",
      input: { root: { className: "!grid" } },
      expectedCodes: ["LL_E_IMPORTANT_NOT_ALLOWED"],
    },
    {
      name: "!hidden under variant",
      input: {
        container: { className: "@container/layout" },
        root: { className: "flex @max-md/layout:!hidden" },
      },
      expectedCodes: ["LL_E_IMPORTANT_NOT_ALLOWED"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── I. shape-level malformed inputs ───────────────

describe("adversarial — shape-level malformed inputs", () => {
  const cases: Fixture[] = [
    {
      name: "validate(null)",
      input: null,
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
    {
      name: "validate(undefined)",
      input: undefined,
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
    {
      name: "validate(string)",
      input: "flex flex-col",
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
    {
      name: "validate(array)",
      input: ["flex"],
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
    {
      name: "missing root",
      input: { container: { className: "@container/layout" } },
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
    {
      name: "className is a number",
      input: { root: { className: 42 } },
      expectedCodes: ["LL_E_CLASSNAME_NOT_STRING"],
    },
    {
      name: "className is an array",
      input: { root: { className: ["flex", "flex-col"] } },
      expectedCodes: ["LL_E_CLASSNAME_NOT_STRING"],
    },
    {
      name: "style is an array",
      input: { root: { className: "flex", style: [] } },
      expectedCodes: ["LL_E_STYLE_NOT_OBJECT"],
    },
    {
      name: "style value is a number",
      input: { root: { className: "grid grid-cols-(--ll-cols)", style: { "--ll-cols": 3 } } },
      expectedCodes: ["LL_E_STYLE_VALUE_NOT_STRING"],
    },
    {
      name: "region id starts with digit",
      input: {
        root: { className: "flex" },
        regions: { "1abc": { className: "block" } },
      },
      expectedCodes: ["LL_E_REGION_ID"],
    },
    {
      name: "region id is empty string",
      input: {
        root: { className: "flex" },
        regions: { "": { className: "block" } },
      },
      expectedCodes: ["LL_E_REGION_ID"],
    },
    {
      name: "regions is an array",
      input: {
        root: { className: "flex" },
        regions: [],
      },
      expectedCodes: ["LL_E_INPUT_SHAPE"],
    },
  ];
  for (const c of cases) it(c.name, () => assertRejects(c));
});

// ─────────────── J. self-correction simulation ───────────────

describe("self-correction loop — diagnostics are actionable", () => {
  // Each scenario: a deliberately broken input that an LLM might emit,
  // a sequence of mechanical "naive LLM repairs" derived from the first
  // diagnostic of each iteration, and an assertion that validation
  // passes within ≤3 iterations using only the documented diagnostic
  // code as the repair signal.
  type Repair = (input: LayoutLintInput, firstError: Diagnostic) => LayoutLintInput;

  type Scenario = {
    name: string;
    initial: LayoutLintInput;
    repair: Repair;
  };

  const scenarios: Scenario[] = [
    {
      name: "static gap → CSS-var gap",
      initial: {
        container: { className: "@container/layout" },
        root: { className: "flex gap-4" },
      },
      repair: (input, err) => {
        if (err.code !== "LL_E_NUMERIC_UTILITY_RUNTIME") return input;
        return {
          ...input,
          root: {
            className: "flex gap-(--ll-gap)",
            style: { ...(input.root.style ?? {}), "--ll-gap": "1rem" },
          },
        };
      },
    },
    {
      name: "arbitrary template → CSS-var template",
      initial: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-[1fr_2fr]" },
      },
      repair: (input, err) => {
        if (err.code !== "LL_E_ARBITRARY_VALUE_RUNTIME") return input;
        return {
          ...input,
          root: {
            className: "grid grid-cols-(--ll-cols)",
            style: { ...(input.root.style ?? {}), "--ll-cols": "1fr 2fr" },
          },
        };
      },
    },
    {
      name: "missing container target → add it",
      initial: {
        root: {
          className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
          style: { "--ll-cols": "1fr 1fr" },
        },
      },
      repair: (input, err) => {
        if (err.code !== "LL_E_CONTAINER_MISSING") return input;
        return { ...input, container: { className: "@container/layout" } };
      },
    },
    {
      name: "@container/layout on root → move to container",
      initial: {
        root: { className: "@container/layout grid" },
      },
      repair: (input, err) => {
        if (err.code !== "LL_E_CONTAINER_PLACEMENT") return input;
        return {
          container: { className: "@container/layout" },
          root: {
            ...input.root,
            className: input.root.className.replace(/@container\/layout\s*/u, "").trim(),
          },
        };
      },
    },
    {
      name: "dangling ref → add the missing style entry",
      initial: {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-(--ll-cols)" },
      },
      repair: (input, err) => {
        if (err.code !== "LL_E_VAR_DANGLING_REF") return input;
        return {
          ...input,
          root: {
            ...input.root,
            style: { ...(input.root.style ?? {}), "--ll-cols": "1fr 1fr" },
          },
        };
      },
    },
  ];

  for (const s of scenarios) {
    it(`'${s.name}' converges in ≤ 3 iterations`, () => {
      let current: LayoutLintInput = s.initial;
      for (let i = 0; i < 3; i++) {
        const r = validate(current);
        if (r.ok) return; // converged
        const first = r.errors[0];
        if (!first) {
          throw new Error("validate ok=false but no errors emitted");
        }
        current = s.repair(current, first);
      }
      const final = validate(current);
      expect(
        final.ok,
        `${s.name}: did not converge in 3 iterations; final errors: ${final.ok ? "[]" : final.errors.map((e) => e.code).join(", ")}`,
      ).toBe(true);
    });
  }
});

// ─────────────── K. soft-warning paths (acceptance + diagnostics) ───────────────

describe("adversarial — accepted-with-warnings paths", () => {
  it("unprefixed hidden on root produces LL_W_ROOT_HIDDEN warning", () => {
    const r = validate({ root: { className: "hidden" } });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_ROOT_HIDDEN")).toBe(true);
  });

  it("contents on root produces LL_W_CONTENTS_DISPLAY warning", () => {
    const r = validate({ root: { className: "contents" } });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_CONTENTS_DISPLAY")).toBe(true);
  });

  it("order-* produces LL_W_ORDER_A11Y warning", () => {
    const r = validate({
      root: { className: "flex" },
      regions: { a: { className: "order-first" } },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_ORDER_A11Y")).toBe(true);
  });

  it("declared but unused style variable produces LL_W_UNUSED_VAR warning", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr", "--ll-gap": "1rem" },
      },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_UNUSED_VAR")).toBe(true);
  });

  it("custom container names in build-time emit LL_W_BUILDTIME_CUSTOM_NAMES", () => {
    const r = validate(
      {
        container: { className: "@container/main" },
        root: { className: "grid @max-md/main:grid-cols-1" },
      },
      { mode: "build-time", allowedContainerNames: ["main"] },
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_BUILDTIME_CUSTOM_NAMES")).toBe(true);
  });
});

// ─────────────── L. acceptance edge cases ───────────────

describe("adversarial — borderline acceptance", () => {
  it("empty className is accepted (no tokens, no errors)", () => {
    const r = validate({ root: { className: "" } });
    expect(r.ok).toBe(true);
  });

  it("whitespace-only className is accepted", () => {
    const r = validate({ root: { className: "   \n\t  " } });
    expect(r.ok).toBe(true);
  });

  it("region with empty className renders unstyled (no errors)", () => {
    const r = validate({
      root: { className: "flex" },
      regions: { a: { className: "" } },
    });
    expect(r.ok).toBe(true);
  });

  it("multiple instances of the same class do not conflict", () => {
    const r = validate({
      root: { className: "grid grid grid grid" },
    });
    expect(r.ok).toBe(true);
  });

  it("very long className with many tokens is handled in linear time", () => {
    const tokens = Array(100).fill("flex flex-col").join(" ");
    const start = performance.now();
    const r = validate({ root: { className: tokens } });
    const elapsed = performance.now() - start;
    expect(r.ok).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });
});
