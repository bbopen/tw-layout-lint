/**
 * Diagnostic catalog — source of truth for every diagnostic code emitted by
 * tw-layout-lint. Codes are stable starting at 0.1.0: never reused, never
 * removed; deprecation marks the entry but the entry stays forever.
 *
 * docs/diagnostics.md is generated from this object during prebuild.
 */

export type DiagnosticPhase =
  | "shape"
  | "parse"
  | "allowlist"
  | "reachability"
  | "invariant"
  | "describe";

export type DiagnosticSeverity = "error" | "warning";
export type DiagnosticStatus = "active" | "deprecated";

export type DiagnosticSpec = {
  readonly severity: DiagnosticSeverity;
  readonly phase: DiagnosticPhase;
  readonly status: DiagnosticStatus;
  readonly title: string;
  readonly defaultHint: string;
};

export const diagnosticCodes = {
  // ───────────────────────────── shape ─────────────────────────────
  LL_E_INPUT_SHAPE: {
    severity: "error",
    phase: "shape",
    status: "active",
    title: "Input is not a valid LayoutLintInput object",
    defaultHint:
      "Top-level value must be an object with a 'root' field of shape { className: string, style?: Record<`--…`, string> }.",
  },
  LL_E_CLASSNAME_NOT_STRING: {
    severity: "error",
    phase: "shape",
    status: "active",
    title: "className must be a string",
    defaultHint: "Set className to a single space-separated string of utility classes.",
  },
  LL_E_STYLE_NOT_OBJECT: {
    severity: "error",
    phase: "shape",
    status: "active",
    title: "style must be a plain object of CSS custom property entries",
    defaultHint: "Use { '--ll-cols': '...' }; never an array, function, or null.",
  },
  LL_E_STYLE_VALUE_NOT_STRING: {
    severity: "error",
    phase: "shape",
    status: "active",
    title: "style values must be strings",
    defaultHint:
      "CSS custom property values are strings; numbers and booleans are not accepted.",
  },
  LL_E_REGION_ID: {
    severity: "error",
    phase: "shape",
    status: "active",
    title: "Region id is not a valid identifier",
    defaultHint:
      "Region keys must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/. No empty strings, prototype names, or symbols.",
  },

  // ───────────────────────────── parse ─────────────────────────────
  LL_E_PARSE_TOKEN: {
    severity: "error",
    phase: "parse",
    status: "active",
    title: "Class token does not match the layout grammar",
    defaultHint:
      "Check that the class is one of the allowlisted layout utilities and uses only allowed variants.",
  },
  LL_E_VARIANT_STACK_NOT_ALLOWED: {
    severity: "error",
    phase: "parse",
    status: "active",
    title: "Stacked container variants are not allowed in v0.1",
    defaultHint:
      "Use at most one container variant per class token. e.g. '@max-md/layout:hidden', not '@sm/layout:@max-md/layout:hidden'.",
  },
  LL_E_ARBITRARY_BREAKPOINT: {
    severity: "error",
    phase: "parse",
    status: "active",
    title: "Arbitrary container breakpoints are not allowed in v0.1",
    defaultHint:
      "Use named breakpoints from {3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}, e.g. '@max-md/layout:'.",
  },
  LL_E_IMPORTANT_NOT_ALLOWED: {
    severity: "error",
    phase: "parse",
    status: "active",
    title: "The !important modifier is not allowed",
    defaultHint: "Remove the leading !.",
  },

  // ─────────────────────────── allowlist ───────────────────────────
  LL_E_UTILITY_NOT_LAYOUT: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "Utility is not in the layout-only allowlist",
    defaultHint:
      "Layout regions only allow flex/grid/gap/order/min-*/max-* utilities. Visual styling belongs in the host.",
  },
  LL_E_VARIANT_NOT_ALLOWED: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "Variant prefix is not allowed",
    defaultHint:
      "Only named container variants (@<size>/<name>:, @max-<size>/<name>:) are allowed in layout regions.",
  },
  LL_E_ARBITRARY_VALUE_RUNTIME: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "Arbitrary value classes are not allowed in runtime mode",
    defaultHint:
      "Move the dynamic value to a CSS variable: e.g. grid-cols-(--ll-cols) with style: { '--ll-cols': '...' }.",
  },
  LL_E_NUMERIC_UTILITY_RUNTIME: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "Static numeric utility is not allowed in runtime mode",
    defaultHint:
      "Use a CSS-variable form (e.g. grid-cols-(--ll-cols)) instead. The exceptions are 'grid-cols-1' and 'grid-rows-1' under a container variant for responsive collapse.",
  },
  LL_E_RUNTIME_VAR_NAME: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "CSS variable name is not in the runtime canonical set",
    defaultHint:
      "Runtime mode accepts only canonical variable names: --ll-cols, --ll-rows, --ll-gap, --ll-gap-x, --ll-gap-y, --ll-basis, --ll-min-w, --ll-min-h, --ll-max-w, --ll-max-h, --ll-order. For custom names, use build-time mode.",
  },
  LL_E_VARIANT_TARGET_RUNTIME: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "Variant + utility combination is not in the runtime safelist",
    defaultHint:
      "In runtime mode, container variants are allowed only on a finite set: hidden, block, flex, grid, flex-row, flex-col, grid-cols-1, grid-rows-1, grid-cols-(--ll-cols), grid-rows-(--ll-rows).",
  },
  LL_E_RUNTIME_FAMILY_VAR_PAIR: {
    severity: "error",
    phase: "allowlist",
    status: "active",
    title: "CSS variable does not match the utility family",
    defaultHint:
      "Runtime mode pairs each family with its own canonical variable: grid-cols/(--ll-cols), grid-rows/(--ll-rows), gap/(--ll-gap), gap-x/(--ll-gap-x), gap-y/(--ll-gap-y), basis/(--ll-basis), min-w/(--ll-min-w), min-h/(--ll-min-h), max-w/(--ll-max-w), max-h/(--ll-max-h), order/(--ll-order). 'col-span' and 'row-span' have no CSS-variable form in runtime mode — use a static span or build-time mode.",
  },

  // ────────────────────────── reachability ──────────────────────────
  LL_E_VAR_OUT_OF_NAMESPACE: {
    severity: "error",
    phase: "reachability",
    status: "active",
    title: "CSS variable is outside the configured namespace",
    defaultHint:
      "Use the configured cssVarPrefix (default '--ll-') for every layout-controlled variable.",
  },
  LL_E_VAR_DANGLING_REF: {
    severity: "error",
    phase: "reachability",
    status: "active",
    title: "Utility references a CSS variable with no matching style entry",
    defaultHint:
      "Add the referenced variable to style on the same target, or remove the utility.",
  },
  LL_E_VAR_VALUE: {
    severity: "error",
    phase: "reachability",
    status: "active",
    title: "CSS variable value does not match the consuming utility's grammar",
    defaultHint:
      "Check the value against the expected CSS form (grid-template tracks, length, integer).",
  },

  // ─────────────────────────── invariant ───────────────────────────
  LL_E_CONTAINER_MISSING: {
    severity: "error",
    phase: "invariant",
    status: "active",
    title: "Container query variant requires an explicit container target",
    defaultHint:
      "Add input.container with className containing @container/<name> matching the variant's name.",
  },
  LL_E_CONTAINER_PLACEMENT: {
    severity: "error",
    phase: "invariant",
    status: "active",
    title: "@container/<name> must appear only on input.container.className",
    defaultHint:
      "Move @container/<name> to input.container.className. Root and regions must not declare a container.",
  },
  LL_E_CONTAINER_VARIANT_PLACEMENT: {
    severity: "error",
    phase: "invariant",
    status: "active",
    title: "Container-query variants are not allowed on input.container.className",
    defaultHint:
      "Container variants belong on root.className or regions[*].className, not on the container itself.",
  },

  // ──────────────────────────── warnings ────────────────────────────
  LL_W_ROOT_HIDDEN: {
    severity: "warning",
    phase: "allowlist",
    status: "active",
    title: "Unprefixed 'hidden' on container or root erases content at all sizes",
    defaultHint:
      "Move hidden under a container variant (e.g. @max-md/layout:hidden) or remove it.",
  },
  LL_W_CONTENTS_DISPLAY: {
    severity: "warning",
    phase: "allowlist",
    status: "active",
    title: "display: contents on container or root has accessibility edge cases",
    defaultHint: "Prefer a normal display unless contents is specifically required.",
  },
  LL_W_ORDER_A11Y: {
    severity: "warning",
    phase: "allowlist",
    status: "active",
    title: "Custom order can diverge from DOM/focus order",
    defaultHint: "Verify keyboard navigation order matches the visual order.",
  },
  LL_W_UNUSED_VAR: {
    severity: "warning",
    phase: "reachability",
    status: "active",
    title: "CSS variable is declared but not referenced by any utility on this target",
    defaultHint: "Remove the variable, or add a utility that consumes it.",
  },
  LL_W_BUILDTIME_CUSTOM_NAMES: {
    severity: "warning",
    phase: "shape",
    status: "active",
    title: "Custom container names or cssVarPrefix require user-supplied source coverage",
    defaultHint:
      "Build-time mode permits custom names, but the user is responsible for ensuring Tailwind scans or safelists the resulting classes.",
  },
  LL_W_CONFLICTING_UTILITY: {
    severity: "warning",
    phase: "allowlist",
    status: "active",
    title: "Multiple utilities from the same family target the same CSS property",
    defaultHint:
      "Two or more utilities target the same CSS property at the same variant scope (e.g. 'grid flex' or 'flex-row flex-col'). The browser picks one based on source order; the result is unpredictable. Use only one utility per family per scope.",
  },
  LL_W_UNKNOWN_FIELD: {
    severity: "warning",
    phase: "shape",
    status: "active",
    title: "Field is not part of the LayoutLintInput schema and was ignored",
    defaultHint:
      "Top-level keys are container/root/regions; target keys are className/style. Any other field is silently dropped — move metadata outside the input or remove the field.",
  },
} as const satisfies Record<string, DiagnosticSpec>;

export type DiagnosticCode = keyof typeof diagnosticCodes;
