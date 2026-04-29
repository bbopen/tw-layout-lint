/**
 * End-to-end integration test against Tailwind v4.
 *
 * §17 of the design spec: "the only test that proves the runtime contract
 * holds end-to-end". Runs the real `@tailwindcss/cli` over our shipped
 * `dist/source.css` and asserts:
 *
 *   1. Every class enumerated by `enumerateRuntimeAllowedClasses()` has
 *      a corresponding CSS rule in Tailwind's output. ⇒ A ⊆ E ⊆ S ⊆ T
 *      (Tailwind actually emits CSS for every class our validator
 *      accepts — closing the runtime contract).
 *   2. No extra classes outside our enumeration are generated. ⇒ closure
 *      against `@source inline()` brace-expansion semantics differing
 *      from our own brace-expander used in source-css-coverage.test.ts.
 *
 * The test runs once per suite (~600ms for the Tailwind compile) and
 * skips automatically when `@tailwindcss/cli` is not installed (so
 * `npm ci --omit=dev` consumers don't fail).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enumerateRuntimeAllowedClasses,
  generateSourceCss,
} from "../src/source-css.js";

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(here, "..");
const TAILWIND_CLI_BIN = resolve(
  PROJECT_ROOT,
  "node_modules/@tailwindcss/cli/dist/index.mjs",
);

let tailwindAvailable = true;
try {
  // Cheap probe — file existence check only. The full run happens in beforeAll.
  readFileSync(TAILWIND_CLI_BIN);
} catch {
  tailwindAvailable = false;
}

const fixtureDir = resolve(PROJECT_ROOT, ".test-tw");

let generatedCss = "";
let emittedSelectorClasses: Set<string> = new Set();

beforeAll(() => {
  if (!tailwindAvailable) return;

  // Re-generate dist/source.css from the in-tree allowlist so the test
  // never compares against a stale shipped artifact.
  const sourceCssContent = generateSourceCss();

  rmSync(fixtureDir, { recursive: true, force: true });
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(fixtureDir, "source.css"), sourceCssContent, "utf8");
  writeFileSync(
    join(fixtureDir, "input.css"),
    `@import "tailwindcss" source(none);\n@import "./source.css";\n`,
    "utf8",
  );

  execFileSync(
    process.execPath,
    [
      TAILWIND_CLI_BIN,
      "-i",
      join(fixtureDir, "input.css"),
      "-o",
      join(fixtureDir, "output.css"),
    ],
    { cwd: PROJECT_ROOT, stdio: "pipe" },
  );

  generatedCss = readFileSync(join(fixtureDir, "output.css"), "utf8");
  emittedSelectorClasses = extractClassSelectors(generatedCss);
}, 60_000);

describe("Tailwind v4 integration", () => {
  it.runIf(tailwindAvailable)(
    "Tailwind v4 generates CSS for every runtime-allowed class",
    () => {
      const expected = enumerateRuntimeAllowedClasses();
      const missing: string[] = [];
      for (const cls of expected) {
        if (!emittedSelectorClasses.has(cls)) missing.push(cls);
      }
      // If this fails, our @source inline() brace-expansion in
      // source-css.ts disagrees with Tailwind's interpretation, OR the
      // class string has a syntax error Tailwind silently rejects.
      expect(missing, formatMissingMessage(missing)).toEqual([]);
    },
  );

  it.runIf(tailwindAvailable)(
    "Tailwind v4 emits no classes outside the runtime allowlist",
    () => {
      // With `source(none)`, Tailwind only emits classes our @source
      // inline() directives request. Anything extra is a leak — either
      // brace-expansion misalignment or a stray inline() spanning more
      // than intended.
      const expected = new Set(enumerateRuntimeAllowedClasses());
      const extra: string[] = [];
      for (const cls of emittedSelectorClasses) {
        if (!expected.has(cls)) extra.push(cls);
      }
      expect(extra, formatExtraMessage(extra)).toEqual([]);
    },
  );

  it.runIf(tailwindAvailable)("@container/layout becomes a real CSS container scope", () => {
    expect(generatedCss).toMatch(/\.\\@container\\\/layout\s*\{/u);
    expect(generatedCss).toMatch(/container-type:\s*inline-size/u);
    expect(generatedCss).toMatch(/container-name:\s*layout/u);
  });

  it.runIf(tailwindAvailable)(
    "named container variants compile to @container queries",
    () => {
      // Tailwind v4 wraps variant utilities in @container queries.
      expect(generatedCss).toMatch(/@container\s+layout\s*\(/u);
    },
  );

  it.runIf(tailwindAvailable)(
    "CSS-variable shorthand utilities reference the canonical var name",
    () => {
      // grid-cols-(--ll-cols) should compile to grid-template-columns: var(--ll-cols);
      expect(generatedCss).toMatch(/grid-template-columns:\s*var\(--ll-cols\)/u);
      expect(generatedCss).toMatch(/grid-template-rows:\s*var\(--ll-rows\)/u);
      expect(generatedCss).toMatch(/gap:\s*var\(--ll-gap\)/u);
    },
  );
});

if (!tailwindAvailable) {
  // eslint-disable-next-line no-console
  console.warn(
    "[tw-layout-lint] Skipping Tailwind integration test — @tailwindcss/cli is not installed.",
  );
}

// ────────────────────────── helpers ──────────────────────────

/**
 * Extract the set of utility class names Tailwind emitted, restricted
 * to selector context. Walks the CSS and only collects `.X` matches
 * that appear in the text between a closing `}` (or start-of-file)
 * and the next opening `{` whose preceding text is NOT a `@`-rule.
 * This rules out false positives from property values like `0.25em`
 * or URL fragments like `github.com`.
 */
function extractClassSelectors(rawCss: string): Set<string> {
  // Strip CSS comments first; their contents (e.g. `tailwindcss.com` in
  // the file header) would otherwise produce false positive matches.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//gu, "");
  const classes = new Set<string>();
  const SELECTOR_RE = /\.((?:\\.|[A-Za-z0-9_-])+)/gu;

  let i = 0;
  let segStart = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "{") {
      const segment = css.slice(segStart, i);
      const trimmed = segment.trimStart();
      if (!trimmed.startsWith("@")) {
        // selector context — extract every `.X` in this segment
        for (const m of segment.matchAll(SELECTOR_RE)) {
          const escaped = m[1];
          if (typeof escaped !== "string") continue;
          const unescaped = escaped.replace(/\\(.)/gu, "$1");
          classes.add(unescaped);
        }
      }
      i++;
      segStart = i;
    } else if (ch === "}") {
      i++;
      segStart = i;
    } else {
      i++;
    }
  }
  return classes;
}

function formatMissingMessage(missing: string[]): string {
  if (missing.length === 0) return "";
  const sample = missing.slice(0, 10);
  const suffix = missing.length > 10 ? ` … (+${missing.length - 10} more)` : "";
  return `Tailwind did not emit ${missing.length} class(es) our validator accepts: ${sample.join(", ")}${suffix}`;
}

function formatExtraMessage(extra: string[]): string {
  if (extra.length === 0) return "";
  const sample = extra.slice(0, 10);
  const suffix = extra.length > 10 ? ` … (+${extra.length - 10} more)` : "";
  return `Tailwind emitted ${extra.length} unexpected class(es) outside the runtime allowlist: ${sample.join(", ")}${suffix}`;
}
