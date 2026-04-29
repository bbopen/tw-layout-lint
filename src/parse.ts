/**
 * Token parser for tw-layout-lint.
 *
 * Splits a className string on whitespace and tokenizes each entry into a
 * `ParsedClass`. Mode-agnostic: this layer rejects only structural
 * problems (stacked variants, arbitrary breakpoints, !important). Mode
 * dispatch happens in validate.ts.
 */

import {
  STATIC_ENUM_UTILS,
  VALUE_BEARING_PREFIXES,
  isContainerBreakpoint,
  type ValueBearingFamily,
} from "./allowlist.js";
import type {
  ContainerBreakpoint,
  ParsedClass,
  ParsedValue,
  ParsedVariant,
  ParseResult,
} from "./types.js";

// ───────────────────────────── public API ─────────────────────────────

/** Split a className string into individual tokens (whitespace-separated, trimmed). */
export function tokenize(className: string): string[] {
  // Reject pathological inputs — but only at the validate layer; here we
  // just split. The validate layer can decide what to do with empty inputs.
  return className.split(/\s+/u).filter((t) => t.length > 0);
}

/**
 * Parse a single class token. Returns either a ParsedClass on success, or
 * a ParseError describing the reason for rejection. Diagnostic codes
 * map 1:1 to the rejection cases.
 */
export function parseClass(raw: string): ParseResult {
  // ── 1. !important modifier ─────────────────────────────────────────
  if (raw.startsWith("!")) {
    return {
      ok: false,
      error: { code: "LL_E_IMPORTANT_NOT_ALLOWED", raw },
    };
  }

  // ── 2. Container marker (@container/<name>) ────────────────────────
  // Must be detected BEFORE generic variant parsing because variants
  // also start with "@". The marker has no trailing colon-utility.
  const markerMatch = /^@container\/([A-Za-z][A-Za-z0-9_-]{0,63})$/u.exec(raw);
  if (markerMatch) {
    const name = markerMatch[1];
    if (typeof name !== "string") {
      return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw } };
    }
    return {
      ok: true,
      parsed: {
        variants: [],
        utility: `@container/${name}`,
        value: { kind: "none" },
        important: false,
        raw,
      },
    };
  }

  // ── 3. Strip + collect variant prefixes ────────────────────────────
  const variantsResult = stripVariants(raw);
  if (!variantsResult.ok) {
    return { ok: false, error: variantsResult.error };
  }
  const { variants, rest } = variantsResult;

  // ── 4. Parse the utility + value portion ───────────────────────────
  const utilResult = parseUtility(rest);
  if (!utilResult.ok) {
    // Preserve the original raw, not the variant-stripped rest, so the
    // diagnostic refers to the user's actual token.
    return { ok: false, error: { ...utilResult.error, raw } };
  }

  return {
    ok: true,
    parsed: {
      variants,
      utility: utilResult.utility,
      value: utilResult.value,
      important: false,
      raw,
    },
  };
}

// ───────────────────────── variant stripping ─────────────────────────

type StripVariantsResult =
  | { ok: true; variants: ParsedVariant[]; rest: string }
  | { ok: false; error: { code: import("./diagnostics.js").DiagnosticCode; raw: string } };

/**
 * Walk the leading `@…:` variants. Reject:
 *   - more than one variant (LL_E_VARIANT_STACK_NOT_ALLOWED)
 *   - arbitrary breakpoints (LL_E_ARBITRARY_BREAKPOINT)
 *   - non-container variants like `hover:` `dark:` (LL_E_VARIANT_NOT_ALLOWED, raised later)
 *
 * Note: a leading non-`@` variant such as `hover:` is left in `rest` and
 * will be rejected at the allowlist phase via parseUtility's "no recognized
 * utility" path → LL_E_PARSE_TOKEN. We could add a finer code here, but
 * since v0.1 forbids all non-container variants, the catch-all is fine.
 */
function stripVariants(raw: string): StripVariantsResult {
  const variants: ParsedVariant[] = [];
  let rest = raw;
  let safety = 0;

  while (rest.startsWith("@")) {
    if (++safety > 8) {
      // Pathological input; bail to a generic parse error.
      return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw } };
    }

    // Try to match an arbitrary breakpoint variant first so we can
    // emit a precise diagnostic instead of falling through to "unknown".
    const arbitraryMatch = /^@(?:max-)?\[[^\]]+\]\/[A-Za-z][A-Za-z0-9_-]*:/u.exec(rest);
    if (arbitraryMatch) {
      return { ok: false, error: { code: "LL_E_ARBITRARY_BREAKPOINT", raw } };
    }

    // Named-container variant: @<size>/<name>: or @max-<size>/<name>:
    const namedMatch = /^@(max-)?([0-9a-z]+)\/([A-Za-z][A-Za-z0-9_-]*)(:)/u.exec(rest);
    if (!namedMatch) {
      // Not a recognized variant shape — do NOT consume; let the utility
      // phase fail with a parse-token error.
      break;
    }

    const isMax = namedMatch[1] === "max-";
    const sizeRaw = namedMatch[2];
    const name = namedMatch[3];
    if (typeof sizeRaw !== "string" || typeof name !== "string") {
      return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw } };
    }

    if (!isContainerBreakpoint(sizeRaw)) {
      // Recognized variant shape but unknown size — treat as parse error
      // so we don't claim the user provided a valid breakpoint.
      return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw } };
    }
    const size: ContainerBreakpoint = sizeRaw;

    if (variants.length >= 1) {
      return { ok: false, error: { code: "LL_E_VARIANT_STACK_NOT_ALLOWED", raw } };
    }

    const variantText = namedMatch[0];
    variants.push({
      kind: isMax ? "container-max" : "container-min",
      size,
      name,
      raw: variantText,
    });
    rest = rest.slice(variantText.length);
  }

  return { ok: true, variants, rest };
}

// ───────────────────────── utility parsing ─────────────────────────

type ParseUtilityResult =
  | { ok: true; utility: string; value: ParsedValue }
  | { ok: false; error: { code: import("./diagnostics.js").DiagnosticCode; raw: string } };

function parseUtility(rest: string): ParseUtilityResult {
  if (rest.length === 0) {
    return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw: rest } };
  }

  // Defensive: a stray `!` after a variant prefix would also be !important.
  if (rest.startsWith("!")) {
    return { ok: false, error: { code: "LL_E_IMPORTANT_NOT_ALLOWED", raw: rest } };
  }

  // 1) Static enum match (exact). flex, grid, flex-row, grid-cols-1, etc.
  if (STATIC_ENUM_UTILS.has(rest)) {
    return { ok: true, utility: rest, value: { kind: "none" } };
  }

  // 2) Value-bearing family match (longest prefix first).
  for (const family of VALUE_BEARING_PREFIXES) {
    const dashed = `${family}-`;
    if (!rest.startsWith(dashed)) continue;
    const valuePart = rest.slice(dashed.length);

    // CSS-var shorthand: (--name)
    if (valuePart.startsWith("(") && valuePart.endsWith(")")) {
      const inner = valuePart.slice(1, -1);
      if (!inner.startsWith("--")) {
        return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw: rest } };
      }
      // Validate name body: --[A-Za-z][A-Za-z0-9_-]*
      if (!/^--[A-Za-z][A-Za-z0-9_-]*$/u.test(inner)) {
        return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw: rest } };
      }
      const ref = inner as `--${string}`;
      return {
        ok: true,
        utility: family,
        value: { kind: "css-var", ref },
      };
    }

    // Arbitrary value: [content]
    if (valuePart.startsWith("[") && valuePart.endsWith("]")) {
      const inner = valuePart.slice(1, -1);
      // Tailwind v4 underscore-as-space decoding within []. Escaped
      // underscores (\_) survive as literal underscores, but we don't
      // expect those in layout values; pass-through with naive decode.
      const decoded = inner.replace(/(?<!\\)_/gu, " ").replace(/\\_/gu, "_");
      return {
        ok: true,
        utility: family,
        value: { kind: "arbitrary", raw: decoded },
      };
    }

    // Static value: digits, fractions, or known keywords like "full" / "auto"
    if (/^[0-9]+$/u.test(valuePart) || /^[0-9]+\/[0-9]+$/u.test(valuePart)) {
      return { ok: true, utility: family, value: { kind: "static", raw: valuePart } };
    }
    if (valuePart === "full" || valuePart === "auto") {
      return { ok: true, utility: family, value: { kind: "static", raw: valuePart } };
    }
    if (family === "order" && /^-?[0-9]+$/u.test(valuePart)) {
      return { ok: true, utility: family, value: { kind: "static", raw: valuePart } };
    }

    return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw: rest } };
  }

  // 3) Nothing matched.
  return { ok: false, error: { code: "LL_E_PARSE_TOKEN", raw: rest } };
}
