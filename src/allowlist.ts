import type { ContainerBreakpoint } from "./types.js";

// ─────────────────────── container breakpoints ───────────────────────

export const CONTAINER_BREAKPOINTS: readonly ContainerBreakpoint[] = [
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
] as const;

const BREAKPOINT_SET: ReadonlySet<string> = new Set(CONTAINER_BREAKPOINTS);

export function isContainerBreakpoint(s: string): s is ContainerBreakpoint {
  return BREAKPOINT_SET.has(s);
}

// Tailwind v4 default container-breakpoint sizes (3xs=16rem, 2xs=18rem, xs=20rem,
// sm=24rem, md=28rem, lg=32rem, xl=36rem, 2xl=42rem, 3xl=48rem, 4xl=56rem,
// 5xl=64rem, 6xl=72rem, 7xl=80rem) are documented here for reference. They are
// not consulted by tw-layout-lint at runtime — describe() expands a breakpoint
// name to a value only when the caller passes one in `options.theme.containerBreakpoints`.

// ──────────────────────── utility categories ────────────────────────
// All entries are the *exact* utility name (no value suffix) unless
// otherwise marked as a "value-bearing" family (see VALUE_BEARING below).

/** Display utilities accepted on every target in both modes. */
export const DISPLAY_UTILS: ReadonlySet<string> = new Set([
  "flex",
  "grid",
  "hidden",
  "block",
  "inline",
  "inline-flex",
  "inline-grid",
  "contents",
]);

/** Flex axis + flex item shorthand — both modes. */
export const FLEX_UTILS: ReadonlySet<string> = new Set([
  "flex-row",
  "flex-col",
  "flex-wrap",
  "flex-nowrap",
  "flex-1",
  "flex-auto",
  "flex-none",
  "grow",
  "grow-0",
  "shrink",
  "shrink-0",
]);

/** Grid auto-cols / auto-rows / grid-flow — both modes. */
export const GRID_AUTO_UTILS: ReadonlySet<string> = new Set([
  "auto-cols-auto",
  "auto-cols-min",
  "auto-cols-max",
  "auto-cols-fr",
  "auto-rows-auto",
  "auto-rows-min",
  "auto-rows-max",
  "auto-rows-fr",
  "grid-flow-row",
  "grid-flow-col",
  "grid-flow-dense",
  "grid-flow-row-dense",
  "grid-flow-col-dense",
  "col-span-full",
  "row-span-full",
]);

/** Alignment + justification — both modes. */
export const ALIGNMENT_UTILS: ReadonlySet<string> = new Set([
  "items-start",
  "items-center",
  "items-end",
  "items-stretch",
  "items-baseline",
  "justify-start",
  "justify-center",
  "justify-end",
  "justify-between",
  "justify-around",
  "justify-evenly",
  "justify-stretch",
  "place-items-start",
  "place-items-center",
  "place-items-end",
  "place-items-stretch",
  "place-items-baseline",
  "place-content-start",
  "place-content-center",
  "place-content-end",
  "place-content-between",
  "place-content-around",
  "place-content-evenly",
  "place-content-stretch",
  "self-auto",
  "self-start",
  "self-center",
  "self-end",
  "self-stretch",
  "self-baseline",
  "justify-self-auto",
  "justify-self-start",
  "justify-self-center",
  "justify-self-end",
  "justify-self-stretch",
]);

/** Order — `order-first` and `order-last` are both modes; `order-<n>` is build-time. */
export const ORDER_KEYWORD_UTILS: ReadonlySet<string> = new Set(["order-first", "order-last"]);

/** Both-mode statics that require a container variant in runtime mode (see §10.2). */
export const VARIANT_REQUIRED_NUMERIC_UTILS: ReadonlySet<string> = new Set([
  "grid-cols-1",
  "grid-rows-1",
]);

/**
 * Static enum utilities accepted in both modes (subject to the
 * variant-required rule for VARIANT_REQUIRED_NUMERIC_UTILS).
 */
export const STATIC_ENUM_UTILS: ReadonlySet<string> = new Set([
  ...DISPLAY_UTILS,
  ...FLEX_UTILS,
  ...GRID_AUTO_UTILS,
  ...ALIGNMENT_UTILS,
  ...ORDER_KEYWORD_UTILS,
  ...VARIANT_REQUIRED_NUMERIC_UTILS,
]);

// ──────────────────────── value-bearing families ────────────────────────

/**
 * For each value-bearing utility family, the list of utility prefixes that
 * may take a static numeric value, a CSS-variable shorthand, or (build-time
 * only) an arbitrary value. The "family" is the canonical CSS-var name
 * suffix used to name its associated runtime canonical variable.
 */
export type ValueBearingFamily =
  | "grid-cols"
  | "grid-rows"
  | "col-span"
  | "row-span"
  | "gap"
  | "gap-x"
  | "gap-y"
  | "basis"
  | "min-w"
  | "min-h"
  | "max-w"
  | "max-h"
  | "order";

/**
 * The set of value-bearing utility prefixes recognized by the parser.
 * The order matters: longer prefixes must be tried first to avoid
 * shadowing (e.g. "gap-x" must beat "gap").
 */
export const VALUE_BEARING_PREFIXES: readonly ValueBearingFamily[] = [
  "grid-cols",
  "grid-rows",
  "col-span",
  "row-span",
  "gap-x",
  "gap-y",
  "gap",
  "basis",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "order",
] as const;

/**
 * Small numeric range allowed for static value-bearing utilities in
 * build-time mode. Tailwind's spacing scale keys 0..16 cover the
 * overwhelming majority of layout uses; anything beyond goes through
 * arbitrary values or CSS variables.
 */
export const BUILDTIME_GAP_RANGE: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
];
export const BUILDTIME_TRACK_RANGE: readonly number[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
export const BUILDTIME_SPAN_RANGE: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
export const BUILDTIME_ORDER_RANGE: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
export const BUILDTIME_BASIS_AND_SIZING_RANGE: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 96,
];
export const BUILDTIME_BASIS_FRACTIONS: readonly string[] = [
  "1/2",
  "1/3",
  "2/3",
  "1/4",
  "2/4",
  "3/4",
  "1/5",
  "2/5",
  "3/5",
  "4/5",
  "1/6",
  "5/6",
  "1/12",
  "2/12",
  "3/12",
  "4/12",
  "5/12",
  "6/12",
  "7/12",
  "8/12",
  "9/12",
  "10/12",
  "11/12",
  "full",
  "auto",
];

export function buildTimeStaticAllowed(family: ValueBearingFamily, raw: string): boolean {
  switch (family) {
    case "gap":
    case "gap-x":
    case "gap-y":
      return BUILDTIME_GAP_RANGE.some((n) => String(n) === raw);
    case "grid-cols":
    case "grid-rows":
      return BUILDTIME_TRACK_RANGE.some((n) => String(n) === raw);
    case "col-span":
    case "row-span":
      return BUILDTIME_SPAN_RANGE.some((n) => String(n) === raw);
    case "order":
      return BUILDTIME_ORDER_RANGE.some((n) => String(n) === raw);
    case "basis":
    case "min-w":
    case "min-h":
    case "max-w":
    case "max-h":
      return (
        BUILDTIME_BASIS_AND_SIZING_RANGE.some((n) => String(n) === raw) ||
        BUILDTIME_BASIS_FRACTIONS.includes(raw)
      );
  }
}

// ─────────────────────── runtime canonical CSS-var names ──────────────────────
// §9.5 — the eleven names accepted in runtime mode. Closed set.

export const RUNTIME_CANONICAL_VARS: readonly `--${string}`[] = [
  "--ll-cols",
  "--ll-rows",
  "--ll-gap",
  "--ll-gap-x",
  "--ll-gap-y",
  "--ll-basis",
  "--ll-min-w",
  "--ll-min-h",
  "--ll-max-w",
  "--ll-max-h",
  "--ll-order",
] as const;

const RUNTIME_CANONICAL_VAR_SET: ReadonlySet<string> = new Set(RUNTIME_CANONICAL_VARS);

export function isRuntimeCanonicalVar(name: string): name is `--${string}` {
  return RUNTIME_CANONICAL_VAR_SET.has(name);
}

/**
 * Map: utility family → canonical CSS-var name accepted in runtime mode.
 * In runtime mode, `<family>-(--<canonical>)` is the only accepted form
 * for a value-bearing utility (apart from the `grid-cols-1`/`grid-rows-1`
 * exception under a container variant).
 */
export const FAMILY_TO_CANONICAL_VAR: Record<ValueBearingFamily, `--${string}`> = {
  "grid-cols": "--ll-cols",
  "grid-rows": "--ll-rows",
  "col-span": "--ll-cols", // unused canonical pair; col-span has no runtime CSS-var form
  "row-span": "--ll-rows",
  gap: "--ll-gap",
  "gap-x": "--ll-gap-x",
  "gap-y": "--ll-gap-y",
  basis: "--ll-basis",
  "min-w": "--ll-min-w",
  "min-h": "--ll-min-h",
  "max-w": "--ll-max-w",
  "max-h": "--ll-max-h",
  order: "--ll-order",
};

/** Families that have a runtime CSS-var form. */
export const RUNTIME_CSS_VAR_FAMILIES: ReadonlySet<ValueBearingFamily> = new Set([
  "grid-cols",
  "grid-rows",
  "gap",
  "gap-x",
  "gap-y",
  "basis",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "order",
] satisfies ValueBearingFamily[]);

// ───────────────────── runtime variant-bearing utilities ─────────────────────
// §9.6 — utilities that may carry a container variant in runtime mode.

export const RUNTIME_VARIANT_BEARING_STATIC: ReadonlySet<string> = new Set([
  "hidden",
  "block",
  "flex",
  "grid",
  "flex-row",
  "flex-col",
  "grid-cols-1",
  "grid-rows-1",
]);

/** CSS-var shorthand utility strings that may carry a container variant in runtime mode. */
export const RUNTIME_VARIANT_BEARING_CSS_VAR: ReadonlySet<string> = new Set([
  "grid-cols-(--ll-cols)",
  "grid-rows-(--ll-rows)",
]);

/**
 * True if `utilityToken` (a full canonicalized utility token without any
 * variant prefix, e.g. "grid-cols-(--ll-cols)" or "hidden") may carry a
 * container variant in runtime mode.
 */
export function isRuntimeVariantBearing(utilityToken: string): boolean {
  return (
    RUNTIME_VARIANT_BEARING_STATIC.has(utilityToken) ||
    RUNTIME_VARIANT_BEARING_CSS_VAR.has(utilityToken)
  );
}

// ─────────────────── rejected utility prefixes (denylist hint) ───────────────────
// Used purely to give a clearer hint when a token doesn't match the allowlist;
// the actual validation is allowlist-based.

export const REJECTED_PREFIX_HINTS: readonly { prefix: string; reason: string }[] = [
  { prefix: "w-", reason: "page sizing belongs in the host" },
  { prefix: "h-", reason: "page sizing belongs in the host" },
  { prefix: "size-", reason: "page sizing belongs in the host" },
  { prefix: "m-", reason: "margins belong in the host" },
  { prefix: "p-", reason: "padding belongs in the host" },
  { prefix: "mx-", reason: "margins belong in the host" },
  { prefix: "my-", reason: "margins belong in the host" },
  { prefix: "mt-", reason: "margins belong in the host" },
  { prefix: "mb-", reason: "margins belong in the host" },
  { prefix: "ml-", reason: "margins belong in the host" },
  { prefix: "mr-", reason: "margins belong in the host" },
  { prefix: "px-", reason: "padding belongs in the host" },
  { prefix: "py-", reason: "padding belongs in the host" },
  { prefix: "pt-", reason: "padding belongs in the host" },
  { prefix: "pb-", reason: "padding belongs in the host" },
  { prefix: "pl-", reason: "padding belongs in the host" },
  { prefix: "pr-", reason: "padding belongs in the host" },
  { prefix: "space-x-", reason: "use gap-* instead" },
  { prefix: "space-y-", reason: "use gap-* instead" },
  { prefix: "relative", reason: "positioning belongs in the host" },
  { prefix: "absolute", reason: "positioning belongs in the host" },
  { prefix: "fixed", reason: "positioning belongs in the host" },
  { prefix: "sticky", reason: "positioning belongs in the host" },
  { prefix: "inset-", reason: "positioning belongs in the host" },
  { prefix: "top-", reason: "positioning belongs in the host" },
  { prefix: "left-", reason: "positioning belongs in the host" },
  { prefix: "right-", reason: "positioning belongs in the host" },
  { prefix: "bottom-", reason: "positioning belongs in the host" },
  { prefix: "z-", reason: "z-index belongs in the host" },
  { prefix: "bg-", reason: "color is visual styling, not layout" },
  { prefix: "text-", reason: "typography is visual styling, not layout" },
  { prefix: "border-", reason: "borders are visual styling, not layout" },
  { prefix: "rounded-", reason: "borders are visual styling, not layout" },
  { prefix: "shadow-", reason: "shadows are visual styling, not layout" },
  { prefix: "ring-", reason: "rings are visual styling, not layout" },
  { prefix: "opacity-", reason: "opacity is visual styling, not layout" },
  { prefix: "outline-", reason: "outlines are visual styling, not layout" },
  { prefix: "animate-", reason: "animation is not layout" },
  { prefix: "transition-", reason: "transitions are not layout" },
  { prefix: "duration-", reason: "transitions are not layout" },
  { prefix: "ease-", reason: "transitions are not layout" },
];

export function rejectedReason(utility: string): string | undefined {
  for (const entry of REJECTED_PREFIX_HINTS) {
    if (utility === entry.prefix || utility.startsWith(entry.prefix)) return entry.reason;
  }
  return undefined;
}
