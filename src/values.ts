/**
 * Value-grammar validation per §11.4 of the spec.
 *
 * Applies to:
 *   - CSS-variable values supplied via `style: { '--ll-...': '...' }`
 *   - Build-time arbitrary values inside `[...]` (after underscore decoding)
 *
 * Rejected universally: calc(), nested var(), url(), other-variable refs,
 * scientific notation (1e3), NaN, Infinity, leading/trailing whitespace,
 * semicolons.
 */

import type { ValueBearingFamily } from "./allowlist.js";

export type ValueValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Forbidden tokens checked at the start of value validation. Each entry
 * is a regex that must NOT match anywhere in the value, with a reason
 * to surface in the diagnostic. Function names use a (^|[^A-Za-z0-9_-])
 * lookbehind-equivalent so e.g. `minmax(` doesn't trip the `max(` rule.
 */
const FORBIDDEN_PATTERNS: readonly { re: RegExp; reason: string }[] = [
  { re: /(?:^|[^A-Za-z0-9_-])calc\(/u, reason: "calc() is not allowed in layout values" },
  { re: /(?:^|[^A-Za-z0-9_-])var\(/u, reason: "var() references in values are not allowed" },
  { re: /(?:^|[^A-Za-z0-9_-])url\(/u, reason: "url() is not allowed in layout values" },
  { re: /(?:^|[^A-Za-z0-9_-])env\(/u, reason: "env() is not allowed in layout values" },
  { re: /(?:^|[^A-Za-z0-9_-])clamp\(/u, reason: "clamp() is not allowed in layout values" },
  { re: /(?:^|[^A-Za-z0-9_-])min\(/u, reason: "min() top-level is not allowed (use minmax for grids)" },
  { re: /(?:^|[^A-Za-z0-9_-])max\(/u, reason: "max() top-level is not allowed (use minmax for grids)" },
  { re: /;/u, reason: "semicolons are not allowed in layout values" },
  { re: /\bNaN\b/u, reason: "NaN is not a valid number" },
  { re: /\bInfinity\b/u, reason: "Infinity is not a valid number" },
];

export function validateValue(
  family: ValueBearingFamily,
  value: string,
): ValueValidationResult {
  if (value !== value.trim()) {
    return { ok: false, reason: "value has leading or trailing whitespace" };
  }
  if (value.length === 0) {
    return { ok: false, reason: "value is empty" };
  }
  for (const { re, reason } of FORBIDDEN_PATTERNS) {
    if (re.test(value)) return { ok: false, reason };
  }

  switch (family) {
    case "grid-cols":
    case "grid-rows":
      return validateTrackList(value);
    case "col-span":
    case "row-span":
      // No CSS-var form supported in runtime; build-time path uses static numerics.
      return validatePositiveInteger(value);
    case "gap":
    case "gap-x":
    case "gap-y":
      return validateLength(value, { allowZero: true, allowPercent: false });
    case "min-w":
    case "min-h":
      return validateLength(value, { allowZero: true, allowPercent: true });
    case "max-w":
    case "max-h":
    case "basis":
      return validateLength(value, { allowZero: false, allowPercent: true });
    case "order":
      return validateInteger(value);
  }
}

// ─────────────────────────── grid track-list ───────────────────────────

function validateTrackList(value: string): ValueValidationResult {
  const tokens = topLevelSplit(value);
  if (!tokens.ok) return { ok: false, reason: tokens.reason };
  if (tokens.tokens.length === 0) {
    return { ok: false, reason: "track-list is empty" };
  }
  for (const tok of tokens.tokens) {
    const r = validateTrack(tok, /*allowRepeat*/ true);
    if (!r.ok) return r;
  }
  return { ok: true };
}

function validateTrack(token: string, allowRepeat: boolean): ValueValidationResult {
  if (token === "auto" || token === "min-content" || token === "max-content") {
    return { ok: true };
  }
  if (token.startsWith("minmax(") && token.endsWith(")")) {
    const inner = token.slice("minmax(".length, -1);
    const parts = topLevelSplit(inner, /*sep*/ ",");
    if (!parts.ok) return { ok: false, reason: parts.reason };
    if (parts.tokens.length !== 2) {
      return { ok: false, reason: "minmax() requires exactly two arguments" };
    }
    const minToken = parts.tokens[0];
    const maxToken = parts.tokens[1];
    if (minToken === undefined || maxToken === undefined) {
      return { ok: false, reason: "minmax() arguments are malformed" };
    }
    const minStr = minToken.trim();
    const maxStr = maxToken.trim();
    // min: length | 0 | auto | min-content | max-content
    if (minStr !== "0" && !isLengthOk(minStr, { allowZero: true, allowPercent: true }) &&
        minStr !== "auto" && minStr !== "min-content" && minStr !== "max-content") {
      return { ok: false, reason: `minmax() min argument is invalid: ${JSON.stringify(minStr)}` };
    }
    // max: length | fr | auto | min-content | max-content
    if (
      !isLengthOk(maxStr, { allowZero: false, allowPercent: true }) &&
      !isFrOk(maxStr) &&
      maxStr !== "auto" &&
      maxStr !== "min-content" &&
      maxStr !== "max-content"
    ) {
      return { ok: false, reason: `minmax() max argument is invalid: ${JSON.stringify(maxStr)}` };
    }
    return { ok: true };
  }
  if (token.startsWith("repeat(") && token.endsWith(")")) {
    if (!allowRepeat) {
      return { ok: false, reason: "nested repeat() is not allowed" };
    }
    const inner = token.slice("repeat(".length, -1);
    const parts = topLevelSplit(inner, /*sep*/ ",");
    if (!parts.ok) return { ok: false, reason: parts.reason };
    if (parts.tokens.length < 2) {
      return { ok: false, reason: "repeat() requires count and track-list arguments" };
    }
    const countTok = parts.tokens[0]?.trim() ?? "";
    if (
      !/^[1-9][0-9]*$/u.test(countTok) &&
      countTok !== "auto-fit" &&
      countTok !== "auto-fill"
    ) {
      return { ok: false, reason: `repeat() count is invalid: ${JSON.stringify(countTok)}` };
    }
    const innerTracks = parts.tokens.slice(1).join(",");
    const innerSplit = topLevelSplit(innerTracks);
    if (!innerSplit.ok) return { ok: false, reason: innerSplit.reason };
    for (const t of innerSplit.tokens) {
      const r = validateTrack(t, /*allowRepeat*/ false);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  // Bare track-size: length or fr
  if (isLengthOk(token, { allowZero: false, allowPercent: true })) return { ok: true };
  if (isFrOk(token)) return { ok: true };
  return { ok: false, reason: `unrecognized track size: ${JSON.stringify(token)}` };
}

// ───────────────────────────── lengths ─────────────────────────────

type LengthOpts = { allowZero: boolean; allowPercent: boolean };

function validateLength(value: string, opts: LengthOpts): ValueValidationResult {
  if (!isLengthOk(value, opts)) {
    return { ok: false, reason: `not a valid layout length: ${JSON.stringify(value)}` };
  }
  return { ok: true };
}

function isLengthOk(s: string, opts: LengthOpts): boolean {
  // <number>{px|rem|%}; reject scientific notation by disallowing 'e'/'E'.
  // Allow integers and decimals; allow leading negative only if needed
  // (layout lengths are non-negative for our families, so reject `-`).
  const m = /^([0-9]+(?:\.[0-9]+)?)(px|rem|%)$/u.exec(s);
  if (!m) return false;
  const numStr = m[1] ?? "0";
  const unit = m[2];
  if (unit === "%" && !opts.allowPercent) return false;
  const n = Number(numStr);
  if (!Number.isFinite(n)) return false;
  if (n === 0 && !opts.allowZero) return false;
  return true;
}

function isFrOk(s: string): boolean {
  const m = /^([0-9]+(?:\.[0-9]+)?)fr$/u.exec(s);
  if (!m) return false;
  const numStr = m[1] ?? "0";
  const n = Number(numStr);
  if (!Number.isFinite(n)) return false;
  if (n <= 0) return false;
  return true;
}

// ───────────────────────────── integers ─────────────────────────────

function validateInteger(value: string): ValueValidationResult {
  if (!/^-?(?:0|[1-9][0-9]*)$/u.test(value)) {
    return { ok: false, reason: `not an integer: ${JSON.stringify(value)}` };
  }
  return { ok: true };
}

function validatePositiveInteger(value: string): ValueValidationResult {
  if (!/^[1-9][0-9]*$/u.test(value)) {
    return { ok: false, reason: `not a positive integer: ${JSON.stringify(value)}` };
  }
  return { ok: true };
}

// ─────────────────────────── helper: split ───────────────────────────
// Splits `value` on top-level whitespace (or a custom separator, used for
// commas inside minmax/repeat) while respecting parenthesis nesting.

type SplitResult =
  | { ok: true; tokens: string[] }
  | { ok: false; reason: string };

function topLevelSplit(value: string, sep: " " | "," = " "): SplitResult {
  const tokens: string[] = [];
  let depth = 0;
  let buf = "";

  const pushBuf = () => {
    const trimmed = buf.trim();
    if (trimmed.length > 0) tokens.push(trimmed);
    buf = "";
  };

  for (let i = 0; i < value.length; i++) {
    const ch = value[i] ?? "";
    if (ch === "(") {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ")") {
      depth--;
      if (depth < 0) return { ok: false, reason: "unbalanced parentheses" };
      buf += ch;
      continue;
    }
    if (depth === 0) {
      if (sep === " " && /\s/u.test(ch)) {
        pushBuf();
        continue;
      }
      if (sep === "," && ch === ",") {
        pushBuf();
        continue;
      }
    }
    buf += ch;
  }
  if (depth !== 0) return { ok: false, reason: "unbalanced parentheses" };
  pushBuf();
  return { ok: true, tokens };
}
