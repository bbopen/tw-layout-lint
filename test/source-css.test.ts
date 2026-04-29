/**
 * Source-CSS generator + runtime safelist coverage.
 *
 * Two concerns, one file:
 * 1. `generateSourceCss()` and `enumerateRuntimeAllowedClasses()`
 *    produce expected content for the canonical and custom container
 *    name cases.
 * 2. The §17 contract: every class string accepted in runtime mode is
 *    matched by at least one `@source inline(...)` directive in the
 *    generated CSS, and conversely the safelist contains nothing
 *    outside the runtime allowlist (no orphans).
 *
 * Section 2 re-implements Tailwind v4's brace-expansion semantics
 * (every Cartesian product of `{...}` groups, with literal text
 * between them) and asserts coverage of the union against
 * `enumerateRuntimeAllowedClasses()` in both directions.
 */

import { describe, it, expect } from "vitest";
import {
  enumerateRuntimeAllowedClasses,
  generateSourceCss,
} from "../src/source-css.js";

// ─────────────────── 1. generator output sanity ───────────────────

describe("source.css generator", () => {
  it("includes the container marker", () => {
    expect(generateSourceCss()).toContain('@source inline("@container/layout");');
  });

  it("includes the runtime variant cross-product", () => {
    const css = generateSourceCss();
    expect(css).toContain("@max-md/layout:");
    expect(css).toContain("grid-cols-(--ll-cols)");
    expect(css).toContain("hidden");
  });

  it("uses a custom container name when supplied (and does not leak the default)", () => {
    const css = generateSourceCss("main");
    expect(css).toContain("@container/main");
    expect(css).toContain("@max-md/main:");
    // Negative case: the default 'layout' name must not leak through.
    // If the generator forgot to substitute somewhere, this test catches it.
    expect(css).not.toContain("@container/layout");
    expect(css).not.toContain("@max-md/layout:");
    expect(css).not.toContain("@3xs/layout:");
  });
});

describe("enumerateRuntimeAllowedClasses", () => {
  it("includes the canonical example classes", () => {
    const all = enumerateRuntimeAllowedClasses();
    expect(all).toContain("@container/layout");
    expect(all).toContain("grid");
    expect(all).toContain("grid-cols-(--ll-cols)");
    expect(all).toContain("@max-md/layout:hidden");
    expect(all).toContain("@max-md/layout:grid-cols-1");
    expect(all).toContain("@max-md/layout:grid-cols-(--ll-cols)");
  });

  it("includes every named breakpoint × variant-bearing utility pair", () => {
    const all = new Set(enumerateRuntimeAllowedClasses());
    const breakpoints = [
      "3xs",
      "2xs",
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
      "3xl",
      "4xl",
      "5xl",
      "6xl",
      "7xl",
    ];
    for (const bp of breakpoints) {
      for (const dir of ["@", "@max-"] as const) {
        expect(all.has(`${dir}${bp}/layout:hidden`)).toBe(true);
        expect(all.has(`${dir}${bp}/layout:grid-cols-(--ll-cols)`)).toBe(true);
      }
    }
  });
});

// ─────────────────── 2. safelist coverage cross-check ───────────────────

/**
 * Brace-expand a single Tailwind v4 `@source inline()` literal in the
 * shell sense: `a{x,y}b{p,q}` → `axbp axbq aybp aybq`. Whitespace
 * outside braces is preserved as a separator (so multiple literal
 * tokens in one `inline(...)` produce multiple expansions).
 */
function braceExpand(literal: string): string[] {
  // Split on whitespace at top level (not inside braces).
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of literal) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0 && /\s/u.test(ch)) {
      if (buf.length > 0) {
        parts.push(buf);
        buf = "";
      }
      continue;
    }
    buf += ch;
  }
  if (buf.length > 0) parts.push(buf);

  const out: string[] = [];
  for (const p of parts) out.push(...expandSingle(p));
  return out;
}

function expandSingle(s: string): string[] {
  // Find the first top-level brace group.
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (start === -1 || end === -1) return [s];
  const prefix = s.slice(0, start);
  const inside = s.slice(start + 1, end);
  const suffix = s.slice(end + 1);
  // Split alternatives on top-level commas (respecting nested braces).
  const alts: string[] = [];
  let d2 = 0;
  let altBuf = "";
  for (const ch of inside) {
    if (ch === "{") d2++;
    else if (ch === "}") d2--;
    if (d2 === 0 && ch === ",") {
      alts.push(altBuf);
      altBuf = "";
      continue;
    }
    altBuf += ch;
  }
  alts.push(altBuf);
  const suffixExpansions = expandSingle(suffix);
  const out: string[] = [];
  for (const alt of alts) {
    const combined = prefix + alt;
    for (const sx of suffixExpansions) out.push(combined + sx);
  }
  // Recurse: prefix may itself contain a brace group? No — the loop
  // above found the FIRST top-level brace, so by construction prefix has none.
  return out.flatMap((x) => expandSingle(x));
}

function parseSourceInline(css: string): string[] {
  const out: string[] = [];
  const re = /@source\s+inline\(\s*"([^"]+)"\s*\)\s*;/gu;
  for (const m of css.matchAll(re)) {
    out.push(m[1]!);
  }
  return out;
}

describe("source.css covers every runtime-allowed class", () => {
  it("brace-expander correctness on simple cases", () => {
    expect(braceExpand("foo")).toEqual(["foo"]);
    expect(braceExpand("a b")).toEqual(["a", "b"]);
    expect(braceExpand("x{a,b}")).toEqual(["xa", "xb"]);
    expect(braceExpand("{a,b}{x,y}")).toEqual(["ax", "ay", "bx", "by"]);
    expect(braceExpand("@max-md/layout:{flex,grid}")).toEqual([
      "@max-md/layout:flex",
      "@max-md/layout:grid",
    ]);
  });

  it("every enumerated runtime class is matched by source.css", () => {
    const css = generateSourceCss();
    const directives = parseSourceInline(css);
    const safelisted = new Set<string>();
    for (const literal of directives) {
      for (const expanded of braceExpand(literal)) safelisted.add(expanded);
    }

    const enumerated = enumerateRuntimeAllowedClasses();
    const missing: string[] = [];
    for (const cls of enumerated) {
      if (!safelisted.has(cls)) missing.push(cls);
    }
    expect(missing).toEqual([]);
  });

  it("source.css does not contain stale or unreachable variants", () => {
    // Reverse direction: nothing in source.css should be entirely outside
    // the runtime allowlist. This catches a regression where source.css
    // drifts ahead of the validator.
    const css = generateSourceCss();
    const directives = parseSourceInline(css);
    const safelisted = new Set<string>();
    for (const literal of directives) {
      for (const expanded of braceExpand(literal)) safelisted.add(expanded);
    }
    const enumerated = new Set(enumerateRuntimeAllowedClasses());

    const orphan: string[] = [];
    for (const cls of safelisted) {
      if (!enumerated.has(cls)) orphan.push(cls);
    }
    expect(orphan).toEqual([]);
  });
});
