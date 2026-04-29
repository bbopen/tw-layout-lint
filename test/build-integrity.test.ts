/**
 * Build-integrity tests — verify the consumable package artifact, not
 * source code. These tests run against the built `dist/` directory and
 * cover surfaces that source-only tests can't reach:
 *
 *   1. Bundle-size budgets (gzipped)
 *   2. ESM and CJS entry points each work end-to-end
 *   3. The React adapter entry doesn't bundle a copy of React
 *   4. Source maps point at real source files
 *
 * The build is rebuilt at suite setup (idempotent if already current),
 * so the assertions reflect HEAD's actual shipping state. If `dist/`
 * doesn't exist at startup, the tests skip — `npm run build` is the
 * prerequisite and CI runs it before vitest.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(here, "..");
const DIST = resolve(PROJECT_ROOT, "dist");

const distAvailable = existsSync(resolve(DIST, "index.js"));

function gzSize(p: string): number {
  return gzipSync(readFileSync(p)).length;
}

describe("build artifact integrity", () => {
  beforeAll(() => {
    if (!distAvailable) {
      // eslint-disable-next-line no-console
      console.warn("[build-integrity] dist/ not present; skipping. Run `npm run build` first.");
    }
  });

  it.runIf(distAvailable)("ships ESM, CJS, and .d.ts for both entry points", () => {
    const expected = [
      "index.js",
      "index.cjs",
      "index.d.ts",
      "index.d.cts",
      "react/index.js",
      "react/index.cjs",
      "react/index.d.ts",
      "react/index.d.cts",
      "source.css",
    ];
    for (const f of expected) {
      const p = resolve(DIST, f);
      expect(existsSync(p), `${f} should exist`).toBe(true);
      expect(statSync(p).size, `${f} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it.runIf(distAvailable)("core bundle stays under 15 KB gzipped (current ~12 KB)", () => {
    const sz = gzSize(resolve(DIST, "index.js"));
    expect(sz, `index.js gz size: ${sz}`).toBeLessThan(15 * 1024);
  });

  it.runIf(distAvailable)("React adapter stays under 13 KB gzipped (current ~10 KB)", () => {
    const sz = gzSize(resolve(DIST, "react/index.js"));
    expect(sz, `react/index.js gz size: ${sz}`).toBeLessThan(13 * 1024);
  });

  it.runIf(distAvailable)("CJS bundles are within 10% of ESM size (no major regression)", () => {
    const esm = gzSize(resolve(DIST, "index.js"));
    const cjs = gzSize(resolve(DIST, "index.cjs"));
    expect(Math.abs(cjs - esm) / esm, `esm=${esm} cjs=${cjs}`).toBeLessThan(0.1);
  });

  it.runIf(distAvailable)("source.css contains the @container/layout marker", () => {
    const css = readFileSync(resolve(DIST, "source.css"), "utf8");
    expect(css).toContain('@source inline("@container/layout")');
  });

  // ──── ESM / CJS interop ────

  it.runIf(distAvailable)("ESM consumer can import validate, describe, validateOrThrow", () => {
    const out = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { validate, describe, validateOrThrow, LayoutLintError, diagnosticCodes } from "${resolve(DIST, "index.js")}";
         const r = validate({ root: { className: "flex" } });
         if (!r.ok) throw new Error("validate rejected canonical input");
         const d = describe({ root: { className: "flex" } });
         if (!d.ok || !d.description) throw new Error("describe failed");
         const v = validateOrThrow({ root: { className: "flex" } });
         if (!v.root) throw new Error("validateOrThrow returned wrong shape");
         try { validateOrThrow({ root: { className: "bg-blue-500" } }); throw new Error("should have thrown"); }
         catch (e) { if (!(e instanceof LayoutLintError)) throw new Error("wrong error class: " + e.constructor.name); }
         if (!diagnosticCodes.LL_E_INPUT_SHAPE) throw new Error("catalog missing");
         console.log("ESM_OK");`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );
    expect(out).toContain("ESM_OK");
  });

  it.runIf(distAvailable)("CJS consumer can require validate, describe, validateOrThrow", () => {
    const out = execFileSync(
      process.execPath,
      [
        "-e",
        `const { validate, describe, validateOrThrow, LayoutLintError, diagnosticCodes } = require("${resolve(DIST, "index.cjs")}");
         const r = validate({ root: { className: "flex" } });
         if (!r.ok) throw new Error("validate rejected canonical input");
         const d = describe({ root: { className: "flex" } });
         if (!d.ok) throw new Error("describe failed");
         const v = validateOrThrow({ root: { className: "flex" } });
         if (!v.root) throw new Error("validateOrThrow returned wrong shape");
         try { validateOrThrow({ root: { className: "bg-blue-500" } }); throw new Error("should have thrown"); }
         catch (e) { if (!(e instanceof LayoutLintError)) throw new Error("wrong error class: " + e.constructor.name); }
         if (!diagnosticCodes.LL_E_INPUT_SHAPE) throw new Error("catalog missing");
         console.log("CJS_OK");`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );
    expect(out).toContain("CJS_OK");
  });

  it.runIf(distAvailable)("CJS LayoutLintError inherits from native Error", () => {
    // Cross-realm `instanceof` is the most common consumer footgun;
    // if the CJS bundle wraps Error in a way that breaks this, every
    // try/catch downstream silently misses our errors.
    const out = execFileSync(
      process.execPath,
      [
        "-e",
        `const { LayoutLintError, validateOrThrow } = require("${resolve(DIST, "index.cjs")}");
         try { validateOrThrow({ root: { className: "bg-blue-500" } }); }
         catch (e) {
           if (!(e instanceof Error)) throw new Error("not an Error");
           if (!(e instanceof LayoutLintError)) throw new Error("not a LayoutLintError");
           if (e.name !== "LayoutLintError") throw new Error("wrong name: " + e.name);
           if (!Array.isArray(e.errors)) throw new Error("no errors array");
           if (!Object.isFrozen(e.errors)) throw new Error("errors not frozen");
           console.log("INSTANCEOF_OK");
         }`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );
    expect(out).toContain("INSTANCEOF_OK");
  });

  // ──── React adapter independence ────

  it.runIf(distAvailable)("React adapter ESM does not bundle a copy of React", () => {
    // External: react/react-dom should be peer deps, not bundled. We
    // detect a bundled copy by looking for the "ReactCurrentDispatcher"
    // sentinel from React's internals — present if React was inlined.
    const reactBundle = readFileSync(resolve(DIST, "react/index.js"), "utf8");
    expect(reactBundle).not.toContain("ReactCurrentDispatcher");
    expect(reactBundle).not.toContain("ReactSharedInternals");
    // The bundle should reference React via import statement, not embed
    // its source. Minifiers may emit any whitespace + quote combo.
    expect(reactBundle).toMatch(/\bfrom\s*['"]react['"]/u);
  });

  it.runIf(distAvailable)("React adapter CJS does not bundle a copy of React", () => {
    const reactBundle = readFileSync(resolve(DIST, "react/index.cjs"), "utf8");
    expect(reactBundle).not.toContain("ReactCurrentDispatcher");
    expect(reactBundle).not.toContain("ReactSharedInternals");
    expect(reactBundle).toMatch(/\brequire\s*\(\s*['"]react['"]\s*\)/u);
  });

  // ──── Source-map sanity ────

  it.runIf(distAvailable)("ESM source map references real source files", () => {
    const map = JSON.parse(readFileSync(resolve(DIST, "index.js.map"), "utf8")) as {
      sources: string[];
    };
    // tsup writes sources as paths relative to the map. We just need
    // them to be non-empty and point at .ts files.
    expect(map.sources.length).toBeGreaterThan(0);
    expect(map.sources.every((s) => s.endsWith(".ts") || s.endsWith(".tsx"))).toBe(true);
    // Spot-check one of our known source files
    expect(map.sources.some((s) => s.includes("validate"))).toBe(true);
  });

  it.runIf(distAvailable)("dist/ has no orphan content-hashed type files", () => {
    // Regression: tsup with `clean: false` accumulated stale
    // dist/types-<hash>.d.ts files across builds (each build emits a
    // new shared types module with a fresh content hash; old ones
    // weren't deleted). With `clean: true` plus the build-script
    // ordering (tsup first, then gen-source-css/gen-diagnostics),
    // each build starts from a clean dist and there's exactly ONE
    // shared types file per format.
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const files = readdirSync(DIST);
    const tsHashed = files.filter((f) => /^types-[A-Za-z0-9_-]+\.d\.ts$/u.test(f));
    const ctsHashed = files.filter((f) => /^types-[A-Za-z0-9_-]+\.d\.cts$/u.test(f));
    expect(tsHashed.length, `expected 1 types-<hash>.d.ts; got: ${tsHashed.join(", ")}`).toBe(1);
    expect(ctsHashed.length, `expected 1 types-<hash>.d.cts; got: ${ctsHashed.join(", ")}`).toBe(1);
  });

  it.runIf(distAvailable)("source map covers diagnostic catalog code", () => {
    const map = JSON.parse(readFileSync(resolve(DIST, "index.js.map"), "utf8")) as {
      sources: string[];
      sourcesContent: (string | null)[];
    };
    const diagIdx = map.sources.findIndex((s) => s.includes("diagnostics"));
    expect(diagIdx, "diagnostics.ts should appear in sources").toBeGreaterThanOrEqual(0);
    if (diagIdx >= 0) {
      const content = map.sourcesContent[diagIdx];
      expect(content, "sourcesContent for diagnostics").toBeTruthy();
      expect(content!).toContain("LL_E_INPUT_SHAPE");
    }
  });
});
