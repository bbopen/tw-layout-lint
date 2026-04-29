/**
 * Catalog integrity — guarantees every diagnostic code emitted anywhere
 * in the source tree is declared in `src/diagnostics.ts`. Without this,
 * a typoed code (e.g. `LL_E_VAR_OUT_OF_NAMESPCAE`) would crash mkDiag()
 * at runtime trying to read `spec.severity` from `undefined`.
 *
 * Two assertions:
 *   1. Every `LL_<E|W>_<NAME>` literal that appears in src/*.ts also
 *      appears in `diagnosticCodes`.
 *   2. Every code in the catalog with status:"active" is referenced
 *      somewhere in source. Deprecated codes are exempt — they may
 *      remain in the catalog indefinitely per the stable-codes policy.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnosticCodes } from "../src/diagnostics.js";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(here, "..", "src");

function readAllSourceFiles(): string {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.match(/\.(ts|tsx)$/u)) continue;
      out.push(readFileSync(full, "utf8"));
    }
  }
  walk(SRC_DIR);
  return out.join("\n");
}

const ALL_SOURCE = readAllSourceFiles();
const REFERENCED: Set<string> = new Set(
  [...ALL_SOURCE.matchAll(/\bLL_[EW]_[A-Z][A-Z0-9_]*\b/gu)].map((m) => m[0]),
);

describe("diagnostic catalog integrity", () => {
  it("every code referenced in source is declared in diagnosticCodes", () => {
    const cataloged = new Set(Object.keys(diagnosticCodes));
    const orphans: string[] = [];
    for (const code of REFERENCED) {
      if (!cataloged.has(code)) orphans.push(code);
    }
    expect(orphans, `codes referenced in source but missing from catalog: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every active code in the catalog is referenced somewhere in source", () => {
    const unused: string[] = [];
    for (const [code, spec] of Object.entries(diagnosticCodes)) {
      if (spec.status !== "active") continue;
      if (!REFERENCED.has(code)) unused.push(code);
    }
    expect(unused, `cataloged active codes not referenced in source: ${unused.join(", ")}`).toEqual([]);
  });

  it("the reference scan finds codes inside both ternary and switch/case forms", () => {
    // Sanity: we know LL_W_ROOT_HIDDEN appears via a ternary in validate.ts
    // and LL_E_NUMERIC_UTILITY_RUNTIME appears as a plain code: literal.
    // If our scan misses ternary-embedded codes, it would emit a false
    // positive in the previous test. Catch that explicitly.
    expect(REFERENCED.has("LL_W_ROOT_HIDDEN")).toBe(true);
    expect(REFERENCED.has("LL_W_CONTENTS_DISPLAY")).toBe(true);
    expect(REFERENCED.has("LL_E_NUMERIC_UTILITY_RUNTIME")).toBe(true);
  });

  it("severity matches code naming convention (LL_E_* = error, LL_W_* = warning)", () => {
    for (const [code, spec] of Object.entries(diagnosticCodes)) {
      if (code.startsWith("LL_E_")) {
        expect(spec.severity, `${code} should be severity:'error'`).toBe("error");
      } else if (code.startsWith("LL_W_")) {
        expect(spec.severity, `${code} should be severity:'warning'`).toBe("warning");
      } else {
        throw new Error(`Code ${code} doesn't match LL_E_* or LL_W_* naming`);
      }
    }
  });

  it("every spec field is present and non-empty", () => {
    for (const [code, spec] of Object.entries(diagnosticCodes)) {
      expect(spec.severity, `${code} severity`).toMatch(/^(error|warning)$/);
      expect(spec.phase, `${code} phase`).toMatch(/^(shape|parse|allowlist|reachability|invariant|describe)$/);
      expect(spec.status, `${code} status`).toMatch(/^(active|deprecated)$/);
      expect(spec.title, `${code} title`).toBeTruthy();
      expect(spec.title.length).toBeGreaterThan(0);
      expect(spec.defaultHint, `${code} hint`).toBeTruthy();
      expect(spec.defaultHint.length, `${code} hint quality`).toBeGreaterThan(15);
    }
  });
});
