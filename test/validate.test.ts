/**
 * validate() — comprehensive behavior coverage.
 *
 * Three concerns, organized by section:
 *
 *  §1. Runtime mode (the default): canonical happy path, mode default,
 *      arbitrary-value rejection, static-numeric rejection, CSS-var
 *      rules, value grammar, container invariants, allowlist edges,
 *      shape-level malformed inputs.
 *
 *  §2. Build-time mode: relaxed numeric utilities, arbitrary-value
 *      acceptance, value-grammar still enforced, custom container
 *      names + cssVarPrefix.
 *
 *  §3. Family ↔ canonical-var pairing (runtime only): the 11 natural
 *      pairs are accepted; all other (family × canonical) cross-pairs
 *      reject with LL_E_RUNTIME_FAMILY_VAR_PAIR; build-time mode
 *      does NOT enforce the pairing.
 */

import { describe, it, expect } from "vitest";
import { validate } from "../src/validate.js";
import type { LayoutLintInput } from "../src/types.js";
import {
  FAMILY_TO_CANONICAL_VAR,
  RUNTIME_CANONICAL_VARS,
  RUNTIME_CSS_VAR_FAMILIES,
  VALUE_BEARING_PREFIXES,
} from "../src/allowlist.js";

const validRuntime: LayoutLintInput = {
  container: { className: "@container/layout" },
  root: {
    className:
      "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
    style: { "--ll-cols": "minmax(320px, 1fr) 240px", "--ll-gap": "1rem" },
  },
  regions: {
    aside: { className: "@max-md/layout:hidden" },
  },
};

// ════════════════════════════════════════════════════════════════════════
// §1. Runtime mode
// ════════════════════════════════════════════════════════════════════════

describe("validate — runtime mode happy path", () => {
  it("accepts the canonical example, preserves input shape, emits no warnings", () => {
    const r = validate(validRuntime);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(r.errors);
      return;
    }
    // Round-trip: the returned input must reflect what we passed in,
    // not an arbitrary value. This catches a hypothetical short-circuit.
    expect(r.input.root.className).toBe(validRuntime.root.className);
    expect(r.input.root.style?.["--ll-cols"]).toBe("minmax(320px, 1fr) 240px");
    expect(r.input.container?.className).toBe("@container/layout");
    expect(r.input.regions?.["aside"]?.className).toBe("@max-md/layout:hidden");
    // No warnings at all on the canonical example.
    expect(r.warnings).toEqual([]);
  });

  it("defaults to runtime mode when options is omitted", () => {
    // `validate(input)` (no options) must reject runtime-forbidden inputs.
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-3" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("validate — runtime rejects arbitrary values", () => {
  it("rejects grid-cols-[minmax(320px,1fr)_240px]", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-[minmax(320px,1fr)_240px]",
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_ARBITRARY_VALUE_RUNTIME")).toBe(true);
  });

  it("rejects @max-[640px]/layout: arbitrary breakpoint", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid @max-[640px]/layout:grid-cols-1" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_ARBITRARY_BREAKPOINT")).toBe(true);
  });
});

describe("validate — runtime rejects static numeric utilities", () => {
  it("rejects unprefixed grid-cols-2", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-2" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_NUMERIC_UTILITY_RUNTIME")).toBe(true);
  });

  it("rejects unprefixed grid-cols-1 (must be under container variant)", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-1" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_NUMERIC_UTILITY_RUNTIME")).toBe(true);
  });

  it("accepts @max-md/layout:grid-cols-1 (responsive collapse exception)", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "minmax(320px, 1fr) 240px" },
      },
    });
    expect(r.ok).toBe(true);
  });
});

describe("validate — runtime CSS-var rules", () => {
  it("rejects non-canonical CSS-var name", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-tracks)",
        style: { "--ll-tracks": "1fr 1fr" },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_RUNTIME_VAR_NAME")).toBe(true);
  });

  it("rejects out-of-namespace style key", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr", "--brand": "red" },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_OUT_OF_NAMESPACE")).toBe(true);
  });

  it("rejects dangling CSS-var ref", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-(--ll-cols)" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_DANGLING_REF")).toBe(true);
  });

  it("warns on unused variable", () => {
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
});

describe("validate — value grammar", () => {
  it("rejects calc() in CSS-var value", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "calc(100vw - 1rem)",
        },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_VALUE")).toBe(true);
  });

  it("rejects scientific notation in length", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "1e3px",
        },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_VALUE")).toBe(true);
  });

  it("rejects % in gap", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "10%",
        },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_VALUE")).toBe(true);
  });

  it("accepts minmax(320px, 1fr) 240px as track-list", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "minmax(320px, 1fr) 240px" },
      },
    });
    expect(r.ok).toBe(true);
  });

  it("accepts repeat(auto-fit, minmax(240px, 1fr))", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "repeat(auto-fit, minmax(240px, 1fr))" },
      },
    });
    expect(r.ok).toBe(true);
  });
});

describe("validate — container invariants", () => {
  it("rejects @container/<name> on root", () => {
    const r = validate({
      root: { className: "@container/layout grid" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_CONTAINER_PLACEMENT")).toBe(true);
  });

  it("rejects container variant on input.container", () => {
    const r = validate({
      container: { className: "@container/layout @max-md/layout:hidden" },
      root: { className: "grid grid-cols-(--ll-cols)", style: { "--ll-cols": "1fr 1fr" } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_CONTAINER_VARIANT_PLACEMENT")).toBe(true);
  });

  it("rejects variant referring to undeclared container name", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: { className: "grid @max-md/foo:grid-cols-1" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VARIANT_NOT_ALLOWED")).toBe(true);
  });

  it("rejects variant when no container target exists", () => {
    const r = validate({
      root: { className: "grid @max-md/layout:grid-cols-1" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_CONTAINER_MISSING")).toBe(true);
  });
});

describe("validate — allowlist & rejected categories", () => {
  it("rejects bg-blue-500", () => {
    const r = validate({
      root: { className: "grid bg-blue-500" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Either UTILITY_NOT_LAYOUT or PARSE_TOKEN — both are acceptable; the
    // important thing is that the visual utility is rejected.
    expect(
      r.errors.some(
        (e) => e.code === "LL_E_UTILITY_NOT_LAYOUT" || e.code === "LL_E_PARSE_TOKEN",
      ),
    ).toBe(true);
  });

  it("rejects positioning utilities (relative)", () => {
    const r = validate({
      root: { className: "grid relative" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_PARSE_TOKEN")).toBe(true);
  });

  it("warns on unprefixed hidden on root", () => {
    const r = validate({
      root: { className: "hidden" },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_ROOT_HIDDEN")).toBe(true);
  });

  it("warns on order-first", () => {
    const r = validate({
      root: { className: "flex" },
      regions: {
        a: { className: "order-first" },
      },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_ORDER_A11Y")).toBe(true);
  });
});

describe("validate — shape errors", () => {
  it("rejects null input", () => {
    const r = validate(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_INPUT_SHAPE")).toBe(true);
  });

  it("rejects missing root", () => {
    const r = validate({ container: { className: "@container/layout" } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_INPUT_SHAPE")).toBe(true);
  });

  it("rejects non-string className", () => {
    const r = validate({ root: { className: 42 } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_CLASSNAME_NOT_STRING")).toBe(true);
  });

  it("rejects array as style", () => {
    const r = validate({ root: { className: "flex", style: [] } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_STYLE_NOT_OBJECT")).toBe(true);
  });

  it("rejects forbidden region id (__proto__)", () => {
    // Object literal `{ __proto__: ... }` sets the prototype; build the
    // same shape via Object.fromEntries so __proto__ is an own enumerable key.
    const regions = Object.fromEntries([["__proto__", { className: "block" }]]);
    const r = validate({
      root: { className: "flex" },
      regions,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_REGION_ID")).toBe(true);
  });

  it("rejects region id starting with a digit", () => {
    const r = validate({
      root: { className: "flex" },
      regions: { "1abc": { className: "block" } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_REGION_ID")).toBe(true);
  });

  it("rejects empty region id", () => {
    const r = validate({
      root: { className: "flex" },
      regions: { "": { className: "block" } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_REGION_ID")).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// §2. Build-time mode
// ════════════════════════════════════════════════════════════════════════

describe("validate — build-time mode", () => {
  it("accepts static numeric utilities", () => {
    const r = validate(
      {
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-3 gap-4" },
      },
      { mode: "build-time" },
    );
    expect(r.ok).toBe(true);
  });

  it("accepts arbitrary value classes", () => {
    const r = validate(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-[minmax(320px,1fr)_240px] gap-[1rem]",
        },
      },
      { mode: "build-time" },
    );
    expect(r.ok).toBe(true);
  });

  it("rejects calc() inside arbitrary value", () => {
    const r = validate(
      {
        root: { className: "grid gap-[calc(100vw-1rem)]" },
      },
      { mode: "build-time" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_VAR_VALUE")).toBe(true);
  });

  it("rejects out-of-range static numeric (gap-99)", () => {
    const r = validate(
      {
        root: { className: "grid gap-99" },
      },
      { mode: "build-time" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.code === "LL_E_UTILITY_NOT_LAYOUT")).toBe(true);
  });

  it("warns when custom container names are used", () => {
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

  it("accepts non-canonical CSS-var names with custom prefix", () => {
    const r = validate(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--my-cols)",
          style: { "--my-cols": "1fr 1fr" },
        },
      },
      { mode: "build-time", cssVarPrefix: "--my-" },
    );
    expect(r.ok).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// §3. Family ↔ canonical-var pairing (runtime only)
//
// The runtime contract requires that every accepted CSS-variable utility
// has the form `<family>-(<canonical>)` where (family, canonical) is the
// single natural pair documented in §9.5 / §15. The 11 emitted source.css
// pairs are the WHOLE accepted set in runtime mode.
//
// This section exhaustively enumerates every (family, canonical) cross-
// pair (13 × 11 = 143) and asserts acceptance ONLY on the 11 natural
// pairs.
//
// Background: codecert (commit 212abe7) found that the validator
// previously accepted any (value-bearing family, canonical-11 var)
// pair whose value passed the consuming family's grammar — a soundness
// gap because such cross-pairs are not in the shipped source.css
// safelist and would render as inert classes in a Tailwind v4 app.
// The fix adds LL_E_RUNTIME_FAMILY_VAR_PAIR.
// ════════════════════════════════════════════════════════════════════════

/** A value that passes every consuming family's grammar (universal). */
function universalValue(family: string): string {
  // grid-cols/grid-rows accept track-lists; everything else accepts a length
  // or integer. Use values that pass all of them.
  switch (family) {
    case "grid-cols":
    case "grid-rows":
      return "1fr 1fr";
    case "col-span":
    case "row-span":
    case "order":
      return "3";
    default:
      return "16rem";
  }
}

describe("runtime family ↔ canonical-var pairing", () => {
  it("the 11 natural pairs are accepted", () => {
    for (const family of RUNTIME_CSS_VAR_FAMILIES) {
      const canonical = FAMILY_TO_CANONICAL_VAR[family];
      const cls = `${family}-(${canonical})`;
      // Pick a value that satisfies the consuming family's grammar.
      const value = universalValue(family);
      const r = validate({
        container: { className: "@container/layout" },
        root: {
          className: cls,
          style: { [canonical]: value } as Record<`--${string}`, string>,
        },
      });
      expect(r.ok, `expected acceptance for natural pair ${cls}`).toBe(true);
    }
  });

  it("every cross-pair (family, canonical) where family ∈ RUNTIME_CSS_VAR_FAMILIES rejects with LL_E_RUNTIME_FAMILY_VAR_PAIR", () => {
    for (const family of RUNTIME_CSS_VAR_FAMILIES) {
      const correct = FAMILY_TO_CANONICAL_VAR[family];
      for (const canonical of RUNTIME_CANONICAL_VARS) {
        if (canonical === correct) continue;
        const cls = `${family}-(${canonical})`;
        const value = universalValue(family);
        const r = validate({
          container: { className: "@container/layout" },
          root: {
            className: cls,
            style: { [canonical]: value } as Record<`--${string}`, string>,
          },
        });
        expect(r.ok, `expected rejection for cross-pair ${cls}`).toBe(false);
        if (r.ok) continue;
        expect(
          r.errors.some((e) => e.code === "LL_E_RUNTIME_FAMILY_VAR_PAIR"),
          `expected LL_E_RUNTIME_FAMILY_VAR_PAIR for ${cls}; got ${r.errors.map((e) => e.code).join(", ")}`,
        ).toBe(true);
      }
    }
  });

  it("families without a runtime CSS-var form (col-span, row-span) reject any canonical pair with LL_E_RUNTIME_FAMILY_VAR_PAIR", () => {
    const noVarFamilies = VALUE_BEARING_PREFIXES.filter(
      (f) => !RUNTIME_CSS_VAR_FAMILIES.has(f),
    );
    expect(noVarFamilies).toEqual(["col-span", "row-span"]);

    for (const family of noVarFamilies) {
      for (const canonical of RUNTIME_CANONICAL_VARS) {
        const cls = `${family}-(${canonical})`;
        const r = validate({
          container: { className: "@container/layout" },
          root: {
            className: cls,
            style: { [canonical]: "3" } as Record<`--${string}`, string>,
          },
        });
        expect(r.ok, `expected rejection for ${cls}`).toBe(false);
        if (r.ok) continue;
        expect(
          r.errors.some((e) => e.code === "LL_E_RUNTIME_FAMILY_VAR_PAIR"),
          `expected LL_E_RUNTIME_FAMILY_VAR_PAIR for ${cls}; got ${r.errors.map((e) => e.code).join(", ")}`,
        ).toBe(true);
      }
    }
  });

  it("specific pre-fix witnesses now reject (regression set)", () => {
    // These five inputs were the load-bearing examples in the codecert
    // certificate. Prior to the fix, all five were accepted; afterward,
    // every one must reject with LL_E_RUNTIME_FAMILY_VAR_PAIR.
    const witnesses = [
      {
        className: "grid col-span-(--ll-cols)",
        style: { "--ll-cols": "3" } as Record<`--${string}`, string>,
      },
      {
        className: "grid row-span-(--ll-rows)",
        style: { "--ll-rows": "3" } as Record<`--${string}`, string>,
      },
      {
        className: "flex order-(--ll-cols)",
        style: { "--ll-cols": "5" } as Record<`--${string}`, string>,
      },
      {
        className: "flex basis-(--ll-max-w)",
        style: { "--ll-max-w": "16rem" } as Record<`--${string}`, string>,
      },
      {
        className: "flex min-w-(--ll-basis)",
        style: { "--ll-basis": "16rem" } as Record<`--${string}`, string>,
      },
    ];
    for (const target of witnesses) {
      const r = validate({
        container: { className: "@container/layout" },
        root: target,
      });
      expect(r.ok, `expected rejection for ${target.className}`).toBe(false);
      if (r.ok) continue;
      expect(r.errors.some((e) => e.code === "LL_E_RUNTIME_FAMILY_VAR_PAIR")).toBe(true);
    }
  });

  it("build-time mode does NOT enforce family-var pairing", () => {
    // With a custom prefix, any (family, var) pair with a valid value is
    // accepted in build-time mode. The user is responsible for source
    // coverage when they opt into build-time custom names.
    const r = validate(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid col-span-(--my-cols)",
          style: { "--my-cols": "3" } as Record<`--${string}`, string>,
        },
      },
      { mode: "build-time", cssVarPrefix: "--my-" },
    );
    expect(r.ok).toBe(true);
  });
});
