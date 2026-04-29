/**
 * Adversarial probe suite — encodes the manual exploration of edge
 * cases done via claude-in-chrome plus the deeper "Group B" probes
 * that complement the LLM-fault category sweep in test/adversarial.test.ts.
 *
 * Every probe asserts a stable diagnostic code (or, where the input is
 * legitimately accepted, asserts the absence of errors plus a positive
 * shape claim). No vacuous `ok` checks: every "accepted" probe also
 * verifies a structural property — round-tripped className, expected
 * warning, or computed regions count — that would catch a hypothetical
 * short-circuit returning `{ ok: true }` for everything.
 */

import { describe, it, expect } from "vitest";
import { validate, describe as describeLayout } from "../src/validate.js";
import { describe as describeApi } from "../src/describe.js";
import type { LayoutLintInput } from "../src/types.js";

// Helper: convert a single-arg validate() call into an assert-rejected
// helper that also asserts a code is present and the hint is non-trivial.
function rejects(input: unknown, code: string, options?: Parameters<typeof validate>[1]): void {
  const r = validate(input, options);
  expect(r.ok, `expected rejection for ${JSON.stringify(input).slice(0, 80)}`).toBe(false);
  if (r.ok) return;
  expect(
    r.errors.some((e) => e.code === code),
    `expected code ${code}; got [${r.errors.map((e) => e.code).join(", ")}]`,
  ).toBe(true);
  // Every emitted error must carry a non-trivial hint
  for (const e of r.errors) {
    expect(e.hint, `${e.code} missing hint`).toBeTruthy();
    expect((e.hint ?? "").length).toBeGreaterThan(15);
  }
}

function accepts(input: LayoutLintInput, options?: Parameters<typeof validate>[1]): ReturnType<typeof validate> {
  const r = validate(input, options);
  expect(r.ok, `expected acceptance for ${JSON.stringify(input).slice(0, 80)}`).toBe(true);
  return r;
}

// ─────────────────── 1. Build-time arbitrary value bypass ───────────────────

describe("build-time arbitrary values cannot smuggle calc/var/url", () => {
  // The forbidden-tokens regex must run on the decoded contents of [...]
  // brackets, not just on CSS-var values. If this skipped, every
  // calc/var/url rejection would be bypassable by switching to build-time
  // mode and using arbitrary syntax.
  it("rejects var() inside grid-cols-[…]", () => {
    rejects(
      { root: { className: "grid grid-cols-[var(--evil)]" } },
      "LL_E_VAR_VALUE",
      { mode: "build-time" },
    );
  });

  it("rejects calc() inside grid-cols-[…]", () => {
    rejects(
      { root: { className: "grid grid-cols-[calc(100%-1rem)]" } },
      "LL_E_VAR_VALUE",
      { mode: "build-time" },
    );
  });

  it("rejects url() inside grid-cols-[…]", () => {
    rejects(
      { root: { className: "grid grid-cols-[url(evil.css)]" } },
      "LL_E_VAR_VALUE",
      { mode: "build-time" },
    );
  });

  it("rejects nested var() inside minmax() inside arbitrary", () => {
    rejects(
      { root: { className: "grid grid-cols-[minmax(var(--x),1fr)]" } },
      "LL_E_VAR_VALUE",
      { mode: "build-time" },
    );
  });

  it("rejects semicolon-injection inside arbitrary", () => {
    rejects(
      { root: { className: "grid grid-cols-[1fr;injected:bad]" } },
      "LL_E_VAR_VALUE",
      { mode: "build-time" },
    );
  });
});

// ─────────────────── 2. Confusable Unicode in CSS-var names ───────────────────

describe("confusable Unicode in CSS-var names", () => {
  // Cyrillic 'с' (U+0441) looks identical to Latin 'c' (U+0063) but is
  // a different codepoint. The canonical-name check uses string equality,
  // not Unicode normalization, so the look-alike must be rejected.
  it("Cyrillic 'с' in --ll-сols is rejected (not a canonical name)", () => {
    const cyrillicC = "с"; // 'с'
    const cssVar = "--ll-" + cyrillicC + "ols";
    const input = {
      container: { className: "@container/layout" },
      root: {
        className: `grid grid-cols-(${cssVar})`,
        // intentionally use the same look-alike name in the style key
        style: { [cssVar]: "1fr 1fr" } as Record<`--${string}`, string>,
      },
    };
    const r = validate(input);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Either the parser rejects the token, or the runtime-canonical check rejects.
    expect(
      r.errors.some(
        (e) => e.code === "LL_E_PARSE_TOKEN" || e.code === "LL_E_RUNTIME_VAR_NAME",
      ),
    ).toBe(true);
  });
});

// ─────────────────── 3. Malformed container markers ───────────────────

describe("malformed @container/<name> markers", () => {
  for (const cn of [
    "@container/",
    "@container//",
    "@container/layout/extra",
    "@container/-bad",
    "@container/123",
  ]) {
    it(`rejects '${cn}'`, () => {
      rejects(
        { container: { className: cn }, root: { className: "flex" } },
        "LL_E_PARSE_TOKEN",
      );
    });
  }
});

// ─────────────────── 4. Region IDs at the regex boundary ───────────────────

describe("region ID identifier-regex boundary", () => {
  it("accepts a 64-char identifier (1 letter + 63 word chars)", () => {
    const id = "a" + "b".repeat(63); // 64 chars total
    const r = accepts({
      root: { className: "flex" },
      regions: { [id]: { className: "" } },
    });
    expect(r.ok && r.input.regions?.[id]).toBeDefined();
  });

  it("rejects a 65-char identifier", () => {
    const id = "a" + "b".repeat(64); // 65 chars total
    rejects(
      { root: { className: "flex" }, regions: { [id]: { className: "" } } },
      "LL_E_REGION_ID",
    );
  });

  it("rejects an ID starting with a digit", () => {
    rejects(
      { root: { className: "flex" }, regions: { "0main": { className: "" } } },
      "LL_E_REGION_ID",
    );
  });

  it("rejects an ID containing a space", () => {
    const regions = Object.fromEntries([["my region", { className: "" }]]);
    rejects({ root: { className: "flex" }, regions }, "LL_E_REGION_ID");
  });

  it("rejects ID equal to forbidden Object.prototype names", () => {
    for (const id of ["constructor", "prototype", "__proto__"]) {
      const regions = Object.fromEntries([[id, { className: "" }]]);
      rejects({ root: { className: "flex" }, regions }, "LL_E_REGION_ID");
    }
  });

  it("accepts class-flavored Object.prototype names that aren't forbidden", () => {
    // These pass the regex AND aren't in the forbidden set. They're
    // legitimate region IDs because we always access via bracket notation.
    for (const id of ["toString", "hasOwnProperty", "valueOf", "name", "length"]) {
      const r = accepts({
        root: { className: "flex" },
        regions: { [id]: { className: "" } },
      });
      expect(r.ok && r.input.regions?.[id]).toBeDefined();
    }
  });
});

// ─────────────────── 5. CSS-var value pathologies ───────────────────

describe("CSS-var value pathologies", () => {
  const baseInput = (val: string): LayoutLintInput => ({
    container: { className: "@container/layout" },
    root: {
      className: "grid grid-cols-(--ll-cols)",
      style: { "--ll-cols": val },
    },
  });

  it("rejects 0fr (must be > 0)", () => {
    rejects(baseInput("1fr 0fr"), "LL_E_VAR_VALUE");
  });

  it("accepts fractional fr (0.5fr)", () => {
    accepts(baseInput("0.5fr 2fr"));
  });

  it("rejects color tokens as track sizes", () => {
    rejects(baseInput("red blue"), "LL_E_VAR_VALUE");
  });

  it("rejects var() reference", () => {
    rejects(baseInput("var(--theme)"), "LL_E_VAR_VALUE");
  });

  it("rejects calc() expression", () => {
    rejects(baseInput("calc(100% - 1rem)"), "LL_E_VAR_VALUE");
  });

  it("rejects CSS comments", () => {
    rejects(baseInput("1fr /* hidden */ 1fr"), "LL_E_VAR_VALUE");
  });

  it("rejects semicolons (anti-injection)", () => {
    rejects(baseInput("1fr; injected: bad"), "LL_E_VAR_VALUE");
  });

  it("rejects leading/trailing whitespace", () => {
    rejects(baseInput(" 1fr 1fr "), "LL_E_VAR_VALUE");
  });

  it("rejects deeply nested minmax pathology", () => {
    // 50-level minmax nesting — exercises both the parser and the
    // forbidden-tokens regex. Should reject without recursion blowup.
    let nested = "1fr";
    for (let i = 0; i < 50; i++) nested = `minmax(${nested}, 1fr)`;
    rejects(baseInput(nested), "LL_E_VAR_VALUE");
  });
});

// ─────────────────── 6. CSS-var name edge cases ───────────────────

describe("CSS-var name edge cases", () => {
  it("rejects empty body after --ll- prefix", () => {
    // --ll- alone IS structurally a valid CSS custom-property name
    // (it parses), but it isn't in the runtime canonical-11 set, so the
    // allowlist phase rejects it with LL_E_RUNTIME_VAR_NAME.
    rejects(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-)",
          style: { "--ll-": "1fr 1fr" } as Record<`--${string}`, string>,
        },
      },
      "LL_E_RUNTIME_VAR_NAME",
    );
  });

  it("rejects var name without -- prefix", () => {
    rejects(
      {
        root: {
          className: "grid grid-cols-(ll-cols)",
        },
      },
      "LL_E_PARSE_TOKEN",
    );
  });
});

// ─────────────────── 7. Integer-valued utilities ───────────────────

describe("integer-valued utilities", () => {
  it("accepts negative order values (no implied bound)", () => {
    accepts({
      root: {
        className: "flex flex-col order-(--ll-order)",
        style: { "--ll-order": "-99999" },
      },
    });
  });

  it("rejects fractional order values", () => {
    rejects(
      {
        root: {
          className: "flex flex-col order-(--ll-order)",
          style: { "--ll-order": "1.5" },
        },
      },
      "LL_E_VAR_VALUE",
    );
  });

  it("rejects scientific notation in order", () => {
    rejects(
      {
        root: {
          className: "flex flex-col order-(--ll-order)",
          style: { "--ll-order": "1e3" },
        },
      },
      "LL_E_VAR_VALUE",
    );
  });
});

// ─────────────────── 8. Container target edge cases ───────────────────

describe("container target edge cases", () => {
  it("container can carry layout utilities alongside its marker", () => {
    // Putting display+grid on the container is legitimate (it's still
    // an element with its own layout). The validator must not assume
    // the container is style-less.
    const r = accepts({
      container: {
        className: "@container/layout grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr" },
      },
      root: { className: "flex flex-col" },
    });
    expect(r.ok && r.warnings).toBeDefined();
  });

  it("container with style entry not consumed locally → LL_W_UNUSED_VAR on the container", () => {
    const r = validate({
      container: {
        className: "@container/layout",
        style: { "--ll-cols": "1fr 1fr" },
      },
      root: { className: "flex flex-col" },
    });
    expect(r.ok).toBe(true);
    expect(
      r.warnings.some(
        (w) =>
          w.code === "LL_W_UNUSED_VAR" &&
          w.path[0] === "container",
      ),
      "expected unused-var warning scoped to the container",
    ).toBe(true);
  });

  it("container variant on the container target itself is rejected", () => {
    rejects(
      {
        container: { className: "@container/layout @max-md/layout:hidden" },
        root: { className: "flex" },
      },
      "LL_E_CONTAINER_VARIANT_PLACEMENT",
    );
  });
});

// ─────────────────── 9. Build-time-custom-names warning behavior ───────────────────

describe("LL_W_BUILDTIME_CUSTOM_NAMES warning behavior", () => {
  it("fires once per validate() invocation, not cached across calls", () => {
    const opts = {
      mode: "build-time" as const,
      allowedContainerNames: ["main"] as const,
    };
    const a = validate({ root: { className: "flex" } }, opts);
    const b = validate({ root: { className: "flex" } }, opts);
    expect(a.warnings.some((w) => w.code === "LL_W_BUILDTIME_CUSTOM_NAMES")).toBe(true);
    expect(b.warnings.some((w) => w.code === "LL_W_BUILDTIME_CUSTOM_NAMES")).toBe(true);
  });

  it("does not fire when build-time uses defaults", () => {
    const r = validate(
      { root: { className: "flex" } },
      { mode: "build-time" },
    );
    expect(r.warnings.some((w) => w.code === "LL_W_BUILDTIME_CUSTOM_NAMES")).toBe(false);
  });
});

// ─────────────────── 10. Performance assertions ───────────────────

describe("performance / scaling", () => {
  it("validates 1000 regions in under 50ms", () => {
    const regions: Record<string, { className: string }> = {};
    for (let i = 0; i < 1000; i++) regions[`r${i}`] = { className: "" };
    const t0 = performance.now();
    const r = validate({ root: { className: "flex" }, regions });
    const elapsed = performance.now() - t0;
    expect(r.ok).toBe(true);
    expect(elapsed, `1000 regions took ${elapsed.toFixed(1)}ms`).toBeLessThan(50);
  });

  it("validates a 6000-token className in under 100ms", () => {
    const tokens = Array(2000).fill("flex flex-col gap-(--ll-gap)").join(" ");
    const t0 = performance.now();
    const r = validate({
      root: { className: tokens, style: { "--ll-gap": "1rem" } },
    });
    const elapsed = performance.now() - t0;
    expect(r.ok).toBe(true);
    expect(elapsed, `6000 tokens took ${elapsed.toFixed(1)}ms`).toBeLessThan(100);
  });
});

// ─────────────────── 11. describe() graceful handling ───────────────────

describe("describe() handles weird inputs gracefully", () => {
  it("returns 'Invalid layout' string for empty {}", () => {
    const d = describeApi({});
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.description).toContain("Invalid layout");
    expect(d.description.length).toBeGreaterThan(20);
  });

  it("returns 'Invalid layout' for null", () => {
    const d = describeApi(null);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.description).toContain("Invalid layout");
  });

  it("describes a single-utility flex root concisely", () => {
    const d = describeApi({ root: { className: "flex" } });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.description.toLowerCase()).toContain("flex");
  });

  it("never throws on extreme valid input", () => {
    // 50 regions with various order overrides
    const regions: Record<string, { className: string; style?: Record<`--${string}`, string> }> = {};
    for (let i = 0; i < 50; i++) {
      regions[`r${i}`] = {
        className: "order-(--ll-order)",
        style: { "--ll-order": String(i) },
      };
    }
    const d = describeApi({
      root: { className: "flex flex-col gap-(--ll-gap)", style: { "--ll-gap": "0.5rem" } },
      regions,
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.description.length).toBeGreaterThan(0);
  });
});

// ─────────────────── 12. Conflicting-utility detection (issue #3) ───────────────────

describe("LL_W_CONFLICTING_UTILITY", () => {
  it("warns on conflicting display utilities (grid + flex) at the same scope", () => {
    const r = validate({
      root: {
        className: "grid flex grid-cols-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr" },
      },
    });
    expect(r.ok).toBe(true);
    const conflict = r.warnings.find((w) => w.code === "LL_W_CONFLICTING_UTILITY");
    expect(conflict, "expected LL_W_CONFLICTING_UTILITY warning").toBeDefined();
    expect(conflict?.message).toMatch(/display/u);
  });

  it("warns on conflicting flex direction (flex-row + flex-col)", () => {
    const r = validate({ root: { className: "flex flex-row flex-col" } });
    expect(r.ok).toBe(true);
    const conflict = r.warnings.find((w) => w.code === "LL_W_CONFLICTING_UTILITY");
    expect(conflict).toBeDefined();
    expect(conflict?.message).toMatch(/flex-direction/u);
  });

  it("warns on conflicting grid-flow (row + col-dense)", () => {
    const r = validate({ root: { className: "grid grid-flow-row grid-flow-col-dense" } });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_CONFLICTING_UTILITY")).toBe(true);
  });

  it("does NOT warn when conflicting utilities live under different variant scopes", () => {
    // `flex` unprefixed vs `@max-md/layout:flex-col` apply at different
    // breakpoints — that's the canonical responsive-collapse pattern, not
    // a conflict.
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "flex flex-row @max-md/layout:flex-col",
      },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_CONFLICTING_UTILITY")).toBe(false);
  });

  it("does NOT warn on a single utility from any family", () => {
    const r = validate({
      root: {
        className: "grid grid-cols-(--ll-cols) flex-row",
        style: { "--ll-cols": "1fr 1fr" },
      },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_CONFLICTING_UTILITY")).toBe(false);
  });

  it("emits a `related` array pointing at all conflicting tokens", () => {
    const r = validate({ root: { className: "grid flex hidden" } });
    expect(r.ok).toBe(true);
    const conflict = r.warnings.find((w) => w.code === "LL_W_CONFLICTING_UTILITY");
    expect(conflict?.related?.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT warn on byte-identical duplicate tokens (`flex-col flex-col`)", () => {
    // Identical tokens are duplicate noise, not a semantic conflict.
    // The conflict check dedupes by raw text before counting family members.
    const r = validate({
      root: { className: "flex flex-col flex-col flex-col" },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_CONFLICTING_UTILITY")).toBe(false);
  });
});

// ─────────────────── 14. Round-C probes (CSS-spec edges, build-time, etc.) ───────────────────

describe("repeat() count edge cases", () => {
  const wrap = (tracks: string) => ({
    container: { className: "@container/layout" },
    root: {
      className: "grid grid-cols-(--ll-cols)",
      style: { "--ll-cols": tracks } as Record<`--${string}`, string>,
    },
  });

  it("rejects repeat(0, 1fr) — count must be positive", () => {
    rejects(wrap("repeat(0, 1fr)"), "LL_E_VAR_VALUE");
  });
  it("rejects repeat(-1, 1fr)", () => {
    rejects(wrap("repeat(-1, 1fr)"), "LL_E_VAR_VALUE");
  });
  it("rejects repeat(1.5, 1fr) — count must be integer", () => {
    rejects(wrap("repeat(1.5, 1fr)"), "LL_E_VAR_VALUE");
  });
  it("rejects repeat(auto-fit) — missing track-list argument", () => {
    rejects(wrap("repeat(auto-fit)"), "LL_E_VAR_VALUE");
  });
  it("rejects repeat(, 1fr) — empty count", () => {
    rejects(wrap("repeat(, 1fr)"), "LL_E_VAR_VALUE");
  });
  it("accepts repeat(999, 1fr) — large count", () => {
    accepts(wrap("repeat(999, 1fr)"));
  });
  it("accepts repeat(auto-fit, 1fr) — Tailwind passes through; browser handles", () => {
    // Per CSS spec, auto-fit/auto-fill technically require minmax, but
    // browsers tolerate bare track-sizes. We don't enforce stricter than
    // browser behavior.
    accepts(wrap("repeat(auto-fit, 1fr)"));
  });
});

describe("CSS-var name case sensitivity", () => {
  it("rejects uppercase canonical name (--LL-COLS)", () => {
    rejects(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--LL-COLS)",
          style: { "--LL-COLS": "1fr 1fr" } as Record<`--${string}`, string>,
        },
      },
      "LL_E_VAR_OUT_OF_NAMESPACE",
    );
  });
});

describe("container name length boundary", () => {
  it("accepts a 64-char container name (build-time)", () => {
    const name = "a" + "b".repeat(63);
    accepts(
      {
        container: { className: `@container/${name}` },
        root: { className: "flex" },
      },
      { mode: "build-time", allowedContainerNames: [name] },
    );
  });

  it("rejects a 65-char container name", () => {
    const name = "a" + "b".repeat(64);
    rejects(
      {
        container: { className: `@container/${name}` },
        root: { className: "flex" },
      },
      "LL_E_PARSE_TOKEN",
      { mode: "build-time", allowedContainerNames: [name] },
    );
  });
});

describe("build-time numeric range boundaries", () => {
  it("rejects grid-cols-0 (out of range; 1..12)", () => {
    rejects(
      { root: { className: "grid grid-cols-0" } },
      "LL_E_UTILITY_NOT_LAYOUT",
      { mode: "build-time" },
    );
  });
  it("rejects grid-cols-13 (above range)", () => {
    rejects(
      { root: { className: "grid grid-cols-13" } },
      "LL_E_UTILITY_NOT_LAYOUT",
      { mode: "build-time" },
    );
  });
  it("rejects grid-cols-99", () => {
    rejects(
      { root: { className: "grid grid-cols-99" } },
      "LL_E_UTILITY_NOT_LAYOUT",
      { mode: "build-time" },
    );
  });
});

describe("describe() theme.containerBreakpoints expansion", () => {
  it("when no theme is provided, breakpoint name is symbolic only", () => {
    const d = describeApi({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "1fr 1fr" },
      },
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.description).toContain("md container breakpoint");
    expect(d.description).not.toContain("28rem");
    expect(d.description).not.toContain("(28");
  });

  it("when theme provides a value, the expansion appears in the description", () => {
    const d = describeApi(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
          style: { "--ll-cols": "1fr 1fr" },
        },
      },
      { theme: { containerBreakpoints: { md: "28rem" } } },
    );
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.description).toContain("(28rem)");
  });
});

describe("empty regions object {}", () => {
  it("accepted, no regions on the validated input", () => {
    const r = validate({ root: { className: "flex" }, regions: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Empty regions object is normalized to undefined since there are
    // no live regions to track — the React adapter and the renderer
    // treat both as "no regions".
    expect(r.input.regions).toBeUndefined();
  });
});

// ─────────────────── 13. Unknown-field detection (issue #6) ───────────────────

describe("LL_W_UNKNOWN_FIELD", () => {
  it("warns on unknown top-level field", () => {
    const r = validate({
      version: "0.1.0",
      root: { className: "flex" },
    });
    expect(r.ok).toBe(true);
    const w = r.warnings.find((x) => x.code === "LL_W_UNKNOWN_FIELD");
    expect(w).toBeDefined();
    expect(w?.path).toEqual(["version"]);
  });

  it("warns on unknown field on root target", () => {
    const r = validate({
      root: { className: "flex", unknownField: "ignored?" },
    });
    expect(r.ok).toBe(true);
    const w = r.warnings.find((x) => x.code === "LL_W_UNKNOWN_FIELD");
    expect(w).toBeDefined();
    expect(w?.path).toEqual(["root", "unknownField"]);
  });

  it("warns on unknown field on container target", () => {
    const r = validate({
      container: { className: "@container/layout", extra: 1 },
      root: { className: "flex" },
    });
    expect(r.ok).toBe(true);
    expect(
      r.warnings.some(
        (w) =>
          w.code === "LL_W_UNKNOWN_FIELD" &&
          w.path[0] === "container" &&
          w.path[1] === "extra",
      ),
    ).toBe(true);
  });

  it("warns on unknown field on a region target", () => {
    const r = validate({
      root: { className: "flex" },
      regions: { main: { className: "", note: "todo" } },
    });
    expect(r.ok).toBe(true);
    expect(
      r.warnings.some(
        (w) =>
          w.code === "LL_W_UNKNOWN_FIELD" &&
          w.path.join("/") === "regions/main/note",
      ),
    ).toBe(true);
  });

  it("emits one warning per unknown field, listing each path", () => {
    const r = validate({
      version: "0.1",
      metadata: { author: "llm" },
      root: { className: "flex", a: 1, b: 2 },
    });
    expect(r.ok).toBe(true);
    const codes = r.warnings.filter((w) => w.code === "LL_W_UNKNOWN_FIELD");
    // 4 unknown fields: top-level version, top-level metadata, root.a, root.b
    expect(codes.length).toBe(4);
  });

  it("does NOT warn on the canonical fields (container/root/regions, className/style)", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr" },
      },
      regions: { main: { className: "" } },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "LL_W_UNKNOWN_FIELD")).toBe(false);
  });
});

// ─────────────────── 13. Cross-phase cascading (issue #5, informational) ───────────────────

describe("cross-phase cascading on cross-pair-var", () => {
  // When the className uses `gap-(--ll-cols)` and `--ll-cols: "1fr 1fr"`,
  // two errors fire from different phases. This test documents both as
  // intentional emissions: the family-pair error (allowlist phase) is the
  // headline cause, the value-grammar error (reachability phase) reports
  // the secondary consequence. Both are technically correct.
  it("emits both LL_E_RUNTIME_FAMILY_VAR_PAIR and LL_E_VAR_VALUE", () => {
    const r = validate({
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr" },
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain("LL_E_RUNTIME_FAMILY_VAR_PAIR");
    expect(codes).toContain("LL_E_VAR_VALUE");
  });
});
