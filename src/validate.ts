/**
 * Validate orchestrator: composes shape → parse → allowlist →
 * reachability → invariant phases. Implements the non-cascading rule:
 * a target with shape errors is not subjected to later phases; a token
 * with parse errors is not subjected to allowlist/reachability checks.
 */

import {
  FAMILY_TO_CANONICAL_VAR,
  RUNTIME_CSS_VAR_FAMILIES,
  STATIC_ENUM_UTILS,
  VARIANT_REQUIRED_NUMERIC_UTILS,
  isRuntimeCanonicalVar,
  isRuntimeVariantBearing,
  buildTimeStaticAllowed,
  rejectedReason,
  type ValueBearingFamily,
} from "./allowlist.js";
import { mkDiag } from "./diag.js";
import { parseClass, tokenize } from "./parse.js";
import { resolveOptions } from "./options.js";
import { validateShape } from "./shape.js";
import type {
  Diagnostic,
  LayoutClassTarget,
  LayoutLintInput,
  ParsedClass,
  ResolvedOptions,
  TargetRef,
  ValidateOptions,
  ValidationResult,
} from "./types.js";
import { validateValue } from "./values.js";

const VALUE_BEARING_FAMILY_SET: ReadonlySet<string> = new Set<ValueBearingFamily>([
  "grid-cols",
  "grid-rows",
  "col-span",
  "row-span",
  "gap",
  "gap-x",
  "gap-y",
  "basis",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "order",
]);

function isValueBearingFamily(s: string): s is ValueBearingFamily {
  return VALUE_BEARING_FAMILY_SET.has(s);
}

export function validate(input: unknown, options?: ValidateOptions): ValidationResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  const { resolved, warnings: optWarnings } = resolveOptions(options);
  warnings.push(...optWarnings);

  // ── shape ─────────────────────────────────────────────────────
  const shape = validateShape(input);
  errors.push(...shape.errors);
  warnings.push(...shape.warnings);

  if (!shape.input) {
    return errors.length > 0
      ? { ok: false, errors, warnings }
      : ({ ok: false, errors, warnings } as ValidationResult);
  }

  // We have a structurally-valid input; analyze each live target.
  const validatedInput: LayoutLintInput = shape.input;

  // ── parse + allowlist + reachability + invariants per target ──────
  const parsedByTarget = new Map<string, ParsedClass[]>();

  for (const ref of shape.liveTargets) {
    const target = getTarget(validatedInput, ref);
    if (!target) continue;
    const targetPath = pathOfTarget(ref);
    const parsed: ParsedClass[] = [];

    for (const token of tokenize(target.className)) {
      const result = parseClass(token);
      if (!result.ok) {
        errors.push(
          mkDiag({
            code: result.error.code,
            path: [...targetPath, "className", token],
            message: parseErrorMessage(result.error.code, token),
          }),
        );
        continue;
      }
      parsed.push(result.parsed);
    }

    parsedByTarget.set(targetKey(ref), parsed);

    // allowlist phase per target
    for (const p of parsed) {
      const allowDiags = checkAllowlist(p, ref, resolved, [
        ...targetPath,
        "className",
        p.raw,
      ]);
      errors.push(...allowDiags.errors);
      warnings.push(...allowDiags.warnings);
    }

    // conflict-detection phase per target — find utilities from the same
    // family that target the same CSS property at the same variant scope.
    warnings.push(...checkConflicts(parsed, targetPath));

    // reachability phase per target
    const reachDiags = checkReachability(target, parsed, resolved, targetPath);
    errors.push(...reachDiags.errors);
    warnings.push(...reachDiags.warnings);
  }

  // ── structural invariants (cross-target) ─────────────────────
  const invDiags = checkInvariants(validatedInput, parsedByTarget, shape.liveTargets);
  errors.push(...invDiags.errors);
  warnings.push(...invDiags.warnings);

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, input: validatedInput, warnings };
}

// ───────────────────────────── allowlist ─────────────────────────────

function checkAllowlist(
  p: ParsedClass,
  ref: TargetRef,
  opts: ResolvedOptions,
  classPath: (string | number)[],
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  // Container marker token
  if (p.utility.startsWith("@container/")) {
    const name = p.utility.slice("@container/".length);
    if (!opts.allowedContainerNames.includes(name)) {
      errors.push(
        mkDiag({
          code: "LL_E_VARIANT_NOT_ALLOWED",
          path: classPath,
          message: `Container name '${name}' is not in allowedContainerNames (${opts.allowedContainerNames.join(", ")}).`,
          validValues: opts.allowedContainerNames,
        }),
      );
    }
    // Marker placement is handled in invariants phase.
    return { errors, warnings };
  }

  // Validate variant names against allowedContainerNames
  for (const v of p.variants) {
    if (!opts.allowedContainerNames.includes(v.name)) {
      errors.push(
        mkDiag({
          code: "LL_E_VARIANT_NOT_ALLOWED",
          path: classPath,
          message: `Variant references container name '${v.name}' which is not in allowedContainerNames (${opts.allowedContainerNames.join(", ")}).`,
          validValues: opts.allowedContainerNames,
        }),
      );
    }
  }

  // Order-keyword warning (must run before static-enum early return below)
  if (p.utility === "order-first" || p.utility === "order-last") {
    warnings.push(
      mkDiag({
        code: "LL_W_ORDER_A11Y",
        path: classPath,
        message: "Visual order via 'order-*' can diverge from DOM/focus order; verify keyboard navigation.",
      }),
    );
  }

  // Static enum case
  if (STATIC_ENUM_UTILS.has(p.utility) && p.value.kind === "none") {
    // Numeric variant-required exception (grid-cols-1 / grid-rows-1)
    if (
      VARIANT_REQUIRED_NUMERIC_UTILS.has(p.utility) &&
      p.variants.length === 0 &&
      opts.mode === "runtime"
    ) {
      errors.push(
        mkDiag({
          code: "LL_E_NUMERIC_UTILITY_RUNTIME",
          path: classPath,
          message: `Static numeric utility '${p.utility}' is allowed in runtime mode only under a container variant (responsive collapse).`,
        }),
      );
      return { errors, warnings };
    }
    // hidden / contents on root or container: warn
    if ((p.utility === "hidden" || p.utility === "contents") && p.variants.length === 0) {
      if (ref.kind === "root" || ref.kind === "container") {
        warnings.push(
          mkDiag({
            code: p.utility === "hidden" ? "LL_W_ROOT_HIDDEN" : "LL_W_CONTENTS_DISPLAY",
            path: classPath,
            message:
              p.utility === "hidden"
                ? `'hidden' on ${ref.kind} erases content at all sizes; consider gating with a container variant.`
                : `'contents' on ${ref.kind} can confuse layout ownership and has accessibility edge cases.`,
          }),
        );
      }
    }
    // Runtime variant-bearing safelist check (variants present)
    if (opts.mode === "runtime" && p.variants.length > 0) {
      if (!isRuntimeVariantBearing(p.utility)) {
        errors.push(
          mkDiag({
            code: "LL_E_VARIANT_TARGET_RUNTIME",
            path: classPath,
            message: `Variant + utility '${p.variants[0]?.raw ?? ""}${p.utility}' is not in the runtime safelist.`,
          }),
        );
      }
    }
    return { errors, warnings };
  }

  // Value-bearing case
  if (isValueBearingFamily(p.utility)) {
    const narrowed = p as ParsedClass & { utility: ValueBearingFamily };
    return checkValueBearing(narrowed, ref, opts, classPath);
  }

  // Not in any allowlist
  const reason = rejectedReason(p.utility);
  errors.push(
    mkDiag({
      code: "LL_E_UTILITY_NOT_LAYOUT",
      path: classPath,
      message: reason
        ? `'${p.raw}' is not a layout utility (${reason}).`
        : `'${p.raw}' is not in the layout-only allowlist.`,
    }),
  );
  return { errors, warnings };
}

function checkValueBearing(
  p: ParsedClass & { utility: ValueBearingFamily },
  _ref: TargetRef,
  opts: ResolvedOptions,
  classPath: (string | number)[],
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  if (p.utility === "order" && p.value.kind !== "none") {
    warnings.push(
      mkDiag({
        code: "LL_W_ORDER_A11Y",
        path: classPath,
        message: "Visual order via 'order-*' can diverge from DOM/focus order; verify keyboard navigation.",
      }),
    );
  }

  // ── arbitrary values ──────────────────────────────────────────
  if (p.value.kind === "arbitrary") {
    if (opts.mode === "runtime") {
      errors.push(
        mkDiag({
          code: "LL_E_ARBITRARY_VALUE_RUNTIME",
          path: classPath,
          message: `Arbitrary value '[${p.value.raw}]' is not allowed in runtime mode; use a CSS variable form.`,
        }),
      );
      return { errors, warnings };
    }
    // build-time: validate the value against the family grammar
    const r = validateValue(p.utility, p.value.raw);
    if (!r.ok) {
      errors.push(
        mkDiag({
          code: "LL_E_VAR_VALUE",
          path: classPath,
          message: `Arbitrary value for '${p.utility}-[…]' is invalid: ${r.reason}`,
        }),
      );
    }
    return { errors, warnings };
  }

  // ── CSS-var shorthand ─────────────────────────────────────────
  if (p.value.kind === "css-var") {
    if (!p.value.ref.startsWith(opts.cssVarPrefix)) {
      errors.push(
        mkDiag({
          code: "LL_E_VAR_OUT_OF_NAMESPACE",
          path: classPath,
          message: `CSS variable '${p.value.ref}' is outside the configured namespace ('${opts.cssVarPrefix}…').`,
        }),
      );
      return { errors, warnings };
    }
    if (opts.mode === "runtime" && !isRuntimeCanonicalVar(p.value.ref)) {
      errors.push(
        mkDiag({
          code: "LL_E_RUNTIME_VAR_NAME",
          path: classPath,
          message: `Runtime mode accepts only canonical variable names; '${p.value.ref}' is not in the canonical set.`,
        }),
      );
      return { errors, warnings };
    }
    // §9.5/§10: in runtime mode each family pairs with its own canonical
    // variable; cross-pairs (e.g. col-span-(--ll-cols)) and families with no
    // CSS-var form (col-span, row-span) are rejected.
    if (opts.mode === "runtime") {
      if (!RUNTIME_CSS_VAR_FAMILIES.has(p.utility)) {
        errors.push(
          mkDiag({
            code: "LL_E_RUNTIME_FAMILY_VAR_PAIR",
            path: classPath,
            message: `'${p.utility}' has no CSS-variable form in runtime mode. Use a static value (in build-time mode) or a different utility.`,
          }),
        );
        return { errors, warnings };
      }
      const expected = FAMILY_TO_CANONICAL_VAR[p.utility];
      if (p.value.ref !== expected) {
        errors.push(
          mkDiag({
            code: "LL_E_RUNTIME_FAMILY_VAR_PAIR",
            path: classPath,
            message: `Runtime mode requires '${p.utility}-(${expected})'; received '${p.utility}-(${p.value.ref})'.`,
            validValues: [expected],
          }),
        );
        return { errors, warnings };
      }
    }
    if (
      opts.mode === "runtime" &&
      p.variants.length > 0 &&
      !isRuntimeVariantBearing(`${p.utility}-(${p.value.ref})`)
    ) {
      errors.push(
        mkDiag({
          code: "LL_E_VARIANT_TARGET_RUNTIME",
          path: classPath,
          message: `Variant + utility '${p.variants[0]?.raw ?? ""}${p.utility}-(${p.value.ref})' is not in the runtime safelist.`,
        }),
      );
      return { errors, warnings };
    }
    return { errors, warnings };
  }

  // ── static numeric / fraction / keyword ───────────────────────
  if (p.value.kind === "static") {
    if (opts.mode === "runtime") {
      errors.push(
        mkDiag({
          code: "LL_E_NUMERIC_UTILITY_RUNTIME",
          path: classPath,
          message: `Static numeric utility '${p.utility}-${p.value.raw}' is not allowed in runtime mode; use a CSS-variable form.`,
        }),
      );
      return { errors, warnings };
    }
    // build-time: must be in the small allowlisted ranges
    if (!buildTimeStaticAllowed(p.utility, p.value.raw)) {
      errors.push(
        mkDiag({
          code: "LL_E_UTILITY_NOT_LAYOUT",
          path: classPath,
          message: `Static value '${p.utility}-${p.value.raw}' is outside the build-time allowlist.`,
        }),
      );
    }
    return { errors, warnings };
  }

  // value.kind === "none" — should not happen for value-bearing families
  errors.push(
    mkDiag({
      code: "LL_E_PARSE_TOKEN",
      path: classPath,
      message: `Value-bearing utility '${p.utility}' is missing its value.`,
    }),
  );
  return { errors, warnings };
}

// ─────────────────────────── reachability ───────────────────────────

function checkReachability(
  target: LayoutClassTarget,
  parsed: ParsedClass[],
  opts: ResolvedOptions,
  targetPath: (string | number)[],
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const styleEntries = target.style ?? {};
  const referencedVars = collectReferencedVars(parsed);

  errors.push(...checkStyleKeys(styleEntries, opts, targetPath, referencedVars, warnings));
  errors.push(...checkDanglingRefs(parsed, styleEntries, targetPath));
  errors.push(...checkValueGrammar(parsed, styleEntries, targetPath));

  return { errors, warnings };
}

function collectReferencedVars(parsed: ParsedClass[]): Set<string> {
  const refs = new Set<string>();
  for (const p of parsed) if (p.value.kind === "css-var") refs.add(p.value.ref);
  return refs;
}

/** §11 rules 1, 3, 5: namespace, unused, runtime-canonical. Returns errors; warnings pushed via the array param. */
function checkStyleKeys(
  styleEntries: Record<`--${string}`, string>,
  opts: ResolvedOptions,
  targetPath: (string | number)[],
  referencedVars: Set<string>,
  warnings: Diagnostic[],
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  for (const key of Object.keys(styleEntries)) {
    if (!key.startsWith(opts.cssVarPrefix)) {
      errors.push(
        mkDiag({
          code: "LL_E_VAR_OUT_OF_NAMESPACE",
          path: [...targetPath, "style", key],
          message: `'${key}' is outside the configured namespace ('${opts.cssVarPrefix}…').`,
        }),
      );
      continue;
    }
    if (opts.mode === "runtime" && !isRuntimeCanonicalVar(key)) {
      errors.push(
        mkDiag({
          code: "LL_E_RUNTIME_VAR_NAME",
          path: [...targetPath, "style", key],
          message: `Runtime mode accepts only canonical variable names; '${key}' is not in the canonical set.`,
        }),
      );
      continue;
    }
    if (!referencedVars.has(key)) {
      warnings.push(
        mkDiag({
          code: "LL_W_UNUSED_VAR",
          path: [...targetPath, "style", key],
          message: `'${key}' is declared but no utility on this target references it.`,
        }),
      );
    }
  }
  return errors;
}

/** §11 rule 2: every utility CSS-var ref must have a matching style entry. */
function checkDanglingRefs(
  parsed: ParsedClass[],
  styleEntries: Record<`--${string}`, string>,
  targetPath: (string | number)[],
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  for (const p of parsed) {
    if (p.value.kind !== "css-var") continue;
    if (p.value.ref in styleEntries) continue;
    errors.push(
      mkDiag({
        code: "LL_E_VAR_DANGLING_REF",
        path: [...targetPath, "className", p.raw],
        message: `Utility references '${p.value.ref}' but no matching style entry exists on this target.`,
        related: [
          { path: [...targetPath, "style", p.value.ref], label: "expected style entry" },
        ],
      }),
    );
  }
  return errors;
}

/** §11 rule 4: each variable's value must match the consuming family's grammar. */
function checkValueGrammar(
  parsed: ParsedClass[],
  styleEntries: Record<`--${string}`, string>,
  targetPath: (string | number)[],
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  for (const p of parsed) {
    if (p.value.kind !== "css-var") continue;
    if (!isValueBearingFamily(p.utility)) continue;
    const value = styleEntries[p.value.ref];
    if (value === undefined) continue; // dangling already reported
    const r = validateValue(p.utility, value);
    if (r.ok) continue;
    errors.push(
      mkDiag({
        code: "LL_E_VAR_VALUE",
        path: [...targetPath, "style", p.value.ref],
        message: `Value for '${p.value.ref}' (consumed by '${p.utility}') is invalid: ${r.reason}`,
        related: [
          { path: [...targetPath, "className", p.raw], label: "consuming utility" },
        ],
      }),
    );
  }
  return errors;
}

// ─────────────────────────── invariants ───────────────────────────

function checkInvariants(
  input: LayoutLintInput,
  parsedByTarget: Map<string, ParsedClass[]>,
  liveTargets: TargetRef[],
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const containerNamesDeclared = new Set<string>();

  for (const ref of liveTargets) {
    const parsed = parsedByTarget.get(targetKey(ref)) ?? [];
    errors.push(...checkPlacements(ref, parsed, containerNamesDeclared));
  }

  for (const ref of liveTargets) {
    if (ref.kind === "container") continue;
    const parsed = parsedByTarget.get(targetKey(ref)) ?? [];
    errors.push(...checkVariantsHaveContainer(ref, parsed, input, containerNamesDeclared));
  }

  return { errors, warnings };
}

/** §12.1 + §12.2: container marker only on input.container; variants only off input.container. Records declared container names as a side effect. */
function checkPlacements(
  ref: TargetRef,
  parsed: ParsedClass[],
  containerNamesDeclared: Set<string>,
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  const targetPath = pathOfTarget(ref);
  for (const p of parsed) {
    const classPath = [...targetPath, "className", p.raw];
    if (p.utility.startsWith("@container/")) {
      const name = p.utility.slice("@container/".length);
      if (ref.kind !== "container") {
        errors.push(
          mkDiag({
            code: "LL_E_CONTAINER_PLACEMENT",
            path: classPath,
            message: `'@container/${name}' may only appear on input.container.className.`,
          }),
        );
      } else {
        containerNamesDeclared.add(name);
      }
    }
    if (p.variants.length > 0 && ref.kind === "container") {
      errors.push(
        mkDiag({
          code: "LL_E_CONTAINER_VARIANT_PLACEMENT",
          path: classPath,
          message: `Container variant '${p.variants[0]?.raw ?? ""}' is not allowed on input.container; place it on root or regions.`,
        }),
      );
    }
  }
  return errors;
}

/** §12.3: every variant on root/region must have a matching declared `@container/<name>`. */
function checkVariantsHaveContainer(
  ref: TargetRef,
  parsed: ParsedClass[],
  input: LayoutLintInput,
  containerNamesDeclared: Set<string>,
): Diagnostic[] {
  const errors: Diagnostic[] = [];
  const targetPath = pathOfTarget(ref);
  const related: Array<{ path: (string | number)[]; label: string }> = input.container
    ? [{ path: ["container", "className"], label: "current container className" }]
    : [{ path: ["container"], label: "missing container target" }];

  for (const p of parsed) {
    if (p.variants.length === 0) continue;
    const variant = p.variants[0];
    if (!variant) continue;
    if (containerNamesDeclared.has(variant.name)) continue;
    errors.push(
      mkDiag({
        code: "LL_E_CONTAINER_MISSING",
        path: [...targetPath, "className", p.raw],
        message: `Container variant '${variant.raw}' references container name '${variant.name}', but no input.container declares '@container/${variant.name}'.`,
        related,
      }),
    );
  }
  return errors;
}

// ─────────────────── conflicting-utility detection ───────────────────

const DISPLAY_FAMILY: ReadonlySet<string> = new Set([
  "flex",
  "grid",
  "block",
  "inline",
  "inline-flex",
  "inline-grid",
  "hidden",
  "contents",
]);
const FLEX_DIRECTION_FAMILY: ReadonlySet<string> = new Set([
  "flex-row",
  "flex-col",
]);
const GRID_FLOW_FAMILY: ReadonlySet<string> = new Set([
  "grid-flow-row",
  "grid-flow-col",
  "grid-flow-dense",
  "grid-flow-row-dense",
  "grid-flow-col-dense",
]);

const FAMILIES: ReadonlyArray<{ name: string; members: ReadonlySet<string> }> = [
  { name: "display", members: DISPLAY_FAMILY },
  { name: "flex-direction", members: FLEX_DIRECTION_FAMILY },
  { name: "grid-flow", members: GRID_FLOW_FAMILY },
];

/**
 * Detect tokens from the same CSS-property family that share a variant
 * scope. `flex flex-row flex-col` (all unprefixed) → flex-direction
 * conflict. `flex @max-md/layout:flex-col` (different scopes) → no
 * conflict because they apply at different breakpoints.
 */
function checkConflicts(
  parsed: ParsedClass[],
  targetPath: (string | number)[],
): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  // Group by variant signature (empty string = no variant)
  const groups = new Map<string, ParsedClass[]>();
  for (const p of parsed) {
    const sig = p.variants.map((v) => v.raw).join("");
    const existing = groups.get(sig) ?? [];
    existing.push(p);
    groups.set(sig, existing);
  }

  for (const [, group] of groups) {
    for (const family of FAMILIES) {
      // Dedupe by raw token — `flex-col flex-col` is duplicate noise, not
      // a conflict; only different family members at the same scope count.
      const seenRaw = new Set<string>();
      const members: ParsedClass[] = [];
      for (const p of group) {
        if (!family.members.has(p.utility)) continue;
        if (seenRaw.has(p.raw)) continue;
        seenRaw.add(p.raw);
        members.push(p);
      }
      if (members.length < 2) continue;
      const first = members[0];
      if (!first) continue;
      const others = members.slice(1);
      warnings.push(
        mkDiag({
          code: "LL_W_CONFLICTING_UTILITY",
          path: [...targetPath, "className", first.raw],
          message: `Multiple ${family.name} utilities at the same scope: ${members.map((m) => `'${m.raw}'`).join(", ")}. Browser picks one based on source order.`,
          related: others.map((m) => ({
            path: [...targetPath, "className", m.raw],
            label: "conflicting utility",
          })),
        }),
      );
    }
  }
  return warnings;
}

// ─────────────────────────── helpers ───────────────────────────

function getTarget(input: LayoutLintInput, ref: TargetRef): LayoutClassTarget | null {
  if (ref.kind === "container") return input.container ?? null;
  if (ref.kind === "root") return input.root;
  return input.regions?.[ref.id] ?? null;
}

function pathOfTarget(ref: TargetRef): (string | number)[] {
  if (ref.kind === "container") return ["container"];
  if (ref.kind === "root") return ["root"];
  return ["regions", ref.id];
}

function targetKey(ref: TargetRef): string {
  if (ref.kind === "container") return "container";
  if (ref.kind === "root") return "root";
  return `region:${ref.id}`;
}

function parseErrorMessage(code: import("./diagnostics.js").DiagnosticCode, raw: string): string {
  switch (code) {
    case "LL_E_IMPORTANT_NOT_ALLOWED":
      return `'${raw}' uses the !important modifier, which is not allowed.`;
    case "LL_E_VARIANT_STACK_NOT_ALLOWED":
      return `'${raw}' stacks more than one container variant; v0.1 allows at most one.`;
    case "LL_E_ARBITRARY_BREAKPOINT":
      return `'${raw}' uses an arbitrary container breakpoint; v0.1 requires named breakpoints (3xs..7xl).`;
    case "LL_E_PARSE_TOKEN":
      return `'${raw}' does not match the layout grammar.`;
    default:
      return `'${raw}' could not be parsed (code ${code}).`;
  }
}
