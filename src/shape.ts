/**
 * Top-level input shape validation. Runs before parse/allowlist phases.
 *
 * Produces shape-phase diagnostics (LL_E_INPUT_SHAPE / LL_E_CLASSNAME_NOT_STRING /
 * LL_E_STYLE_NOT_OBJECT / LL_E_STYLE_VALUE_NOT_STRING / LL_E_REGION_ID).
 *
 * On success returns a fully-typed LayoutLintInput so subsequent phases
 * can rely on the shape without re-checking. Non-cascading: a target
 * with shape errors yields one diagnostic for that target and is then
 * pruned from further analysis.
 */

import type { LayoutLintInput, Diagnostic, LayoutClassTarget, TargetRef } from "./types.js";
import { mkDiag, pathTextOf } from "./diag.js";

const REGION_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export type ShapeResult = {
  input: LayoutLintInput | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  /**
   * Targets that survived shape validation (so subsequent phases skip
   * targets that were pruned). Keys: stable target ids.
   */
  liveTargets: TargetRef[];
};

const KNOWN_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "container",
  "root",
  "regions",
]);

const KNOWN_TARGET_KEYS: ReadonlySet<string> = new Set(["className", "style"]);

export function validateShape(raw: unknown): ShapeResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const liveTargets: TargetRef[] = [];

  if (!isPlainObject(raw)) {
    errors.push(
      mkDiag({
        code: "LL_E_INPUT_SHAPE",
        path: [],
        message:
          "Top-level input must be a plain object. Received: " + describeType(raw),
      }),
    );
    return { input: null, errors, warnings, liveTargets };
  }

  // Warn on unknown top-level fields before structural validation so the
  // user sees the dropped fields even if other shape errors short-circuit.
  for (const key of Object.keys(raw)) {
    if (KNOWN_TOP_LEVEL_KEYS.has(key)) continue;
    warnings.push(
      mkDiag({
        code: "LL_W_UNKNOWN_FIELD",
        path: [key],
        message: `Top-level field '${key}' is not part of LayoutLintInput and was ignored. Known top-level fields: container, root, regions.`,
      }),
    );
  }

  const out: LayoutLintInput = { root: { className: "" } };
  applyTopLevelTarget(raw, "root", out, liveTargets, errors, warnings, /*required*/ true);
  applyTopLevelTarget(raw, "container", out, liveTargets, errors, warnings, /*required*/ false);
  applyRegions(raw, out, liveTargets, errors, warnings);

  if (!liveTargets.some((t) => t.kind === "root")) {
    return { input: null, errors, warnings, liveTargets };
  }
  return { input: out, errors, warnings, liveTargets };
}

function applyTopLevelTarget(
  raw: Record<string, unknown>,
  field: "root" | "container",
  out: LayoutLintInput,
  liveTargets: TargetRef[],
  errors: Diagnostic[],
  warnings: Diagnostic[],
  required: boolean,
): void {
  if (!(field in raw) || raw[field] === undefined) {
    if (required) {
      errors.push(
        mkDiag({
          code: "LL_E_INPUT_SHAPE",
          path: [field],
          message: `Missing required field '${field}'.`,
        }),
      );
    }
    return;
  }
  const result = validateTarget(raw[field], [field]);
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  if (!result.target) return;
  if (field === "root") {
    out.root = result.target;
    liveTargets.push({ kind: "root" });
  } else {
    out.container = result.target;
    liveTargets.push({ kind: "container" });
  }
}

function applyRegions(
  raw: Record<string, unknown>,
  out: LayoutLintInput,
  liveTargets: TargetRef[],
  errors: Diagnostic[],
  warnings: Diagnostic[],
): void {
  if (!("regions" in raw) || raw["regions"] === undefined) return;
  const regionsRaw = raw["regions"];
  if (!isPlainObject(regionsRaw)) {
    errors.push(
      mkDiag({
        code: "LL_E_INPUT_SHAPE",
        path: ["regions"],
        message:
          "'regions' must be a plain object mapping region ids to LayoutClassTarget. Received: " +
          describeType(regionsRaw),
      }),
    );
    return;
  }
  const regions: Record<string, LayoutClassTarget> = {};
  for (const id of Object.keys(regionsRaw)) {
    if (FORBIDDEN_KEYS.has(id) || !REGION_ID_RE.test(id)) {
      errors.push(
        mkDiag({
          code: "LL_E_REGION_ID",
          path: ["regions", id],
          message: `Region id ${JSON.stringify(id)} is not a valid identifier.`,
        }),
      );
      continue;
    }
    const result = validateTarget(regionsRaw[id], ["regions", id]);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (!result.target) continue;
    regions[id] = result.target;
    liveTargets.push({ kind: "region", id });
  }
  if (Object.keys(regions).length > 0) out.regions = regions;
}

// ───────────────────────── target shape ─────────────────────────

type ValidateTargetResult = {
  target: LayoutClassTarget | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
};

function validateTarget(raw: unknown, path: (string | number)[]): ValidateTargetResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  if (!isPlainObject(raw)) {
    errors.push(
      mkDiag({
        code: "LL_E_INPUT_SHAPE",
        path,
        message:
          `Target at ${pathTextOf(path)} must be a plain object of shape ` +
          `{ className: string, style?: Record<\`--\${string}\`, string> }. Received: ${describeType(raw)}`,
      }),
    );
    return { target: null, errors, warnings };
  }

  // Warn on unknown fields on this target
  for (const key of Object.keys(raw)) {
    if (KNOWN_TARGET_KEYS.has(key)) continue;
    warnings.push(
      mkDiag({
        code: "LL_W_UNKNOWN_FIELD",
        path: [...path, key],
        message: `Field '${key}' is not part of LayoutClassTarget and was ignored. Known target fields: className, style.`,
      }),
    );
  }

  const className = raw["className"];
  if (typeof className !== "string") {
    errors.push(
      mkDiag({
        code: "LL_E_CLASSNAME_NOT_STRING",
        path: [...path, "className"],
        message: `className must be a string. Received: ${describeType(className)}`,
      }),
    );
    return { target: null, errors, warnings };
  }

  const target: LayoutClassTarget = { className };

  if ("style" in raw && raw["style"] !== undefined) {
    const styleRaw = raw["style"];
    if (!isPlainObject(styleRaw)) {
      errors.push(
        mkDiag({
          code: "LL_E_STYLE_NOT_OBJECT",
          path: [...path, "style"],
          message: `style must be a plain object. Received: ${describeType(styleRaw)}`,
        }),
      );
      return { target: null, errors, warnings };
    }
    const style: Record<`--${string}`, string> = {};
    let styleHadError = false;
    for (const key of Object.keys(styleRaw)) {
      const value = styleRaw[key];
      if (typeof value !== "string") {
        errors.push(
          mkDiag({
            code: "LL_E_STYLE_VALUE_NOT_STRING",
            path: [...path, "style", key],
            message: `style values must be strings. Received: ${describeType(value)}`,
          }),
        );
        styleHadError = true;
        continue;
      }
      // Note: namespace check (LL_E_VAR_OUT_OF_NAMESPACE) happens in the
      // reachability phase. Shape phase only enforces the type contract.
      style[key as `--${string}`] = value;
    }
    if (!styleHadError && Object.keys(style).length > 0) {
      target.style = style;
    }
    // If style had errors, keep target with empty/partial style — shape
    // errors prune the target, but we don't here because the className
    // is still valid; let reachability phase finish the picture.
  }

  return { target, errors, warnings };
}

// ───────────────────────────── helpers ─────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return "non-plain object";
    return "object";
  }
  return typeof value;
}
