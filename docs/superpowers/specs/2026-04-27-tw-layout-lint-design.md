# tw-layout-lint v0.1 — Design

**Status:** Release-candidate spec — pending user re-approval after corrections
**License:** MIT
**npm:** `tw-layout-lint`

## §1. One-line description

A layout-only class validator for Tailwind CSS agent output, with stable diagnostic codes, a finite runtime safelist, and a structural container-query invariant. No custom DSL.

## §2. Purpose

Give an LLM agent a foolproof feedback loop for the *layout-only* Tailwind class strings it emits when generating partial regions of a page. The package validates a small structured input (container / root / regions), enforces a layout-utility allowlist, validates CSS-variable usage against a finite canonical set, and returns stable diagnostic codes so the agent can self-correct in bounded retries. A `describe()` function turns valid input into a plain-English layout summary so the agent can verify what it actually produced.

The agent emits Tailwind directly — its native vocabulary — and the package constrains the surface to layout-only utilities. **In runtime mode, the accepted class set is mathematically finite.**

## §3. Non-goals

- Page-level layout (margin/padding, positioning, z-index)
- Visual styling (color, typography, shadows, borders, radii)
- Animation, transitions, transforms
- Dark-mode variants, hover/focus pseudo-classes, media-query variants
- Stacked variants
- Arbitrary container-query breakpoints (`@max-[640px]/layout:`)
- Replacing Tailwind, ESLint, or Prettier
- Auto-fixing invalid input
- Solver-driven layout (deferred to v0.2+ as a different product)
- Cross-framework output (Tailwind only in v0.1)

## §4. Strategic posture

A *thin pragmatic helper* that fits cleanly into shadcn + Tailwind v4 + React stacks. Not a competitor to v0 / Lovable / json-render / A2UI / Claude Design — a complement. If real usage proves the need for a JSON intent DSL on top, that becomes a v0.2+ optional frontend that compiles to lint-clean class bundles validated by this package.

## §5. Architecture

```
tw-layout-lint/
├── src/
│   ├── parse.ts              token parser: variants + utility + value
│   ├── allowlist.ts          finite utility + variant + canonical-var tables
│   ├── shape.ts              top-level input shape validation
│   ├── validate.ts           orchestrates shape + parse + allowlist + reachability + invariants
│   ├── describe.ts           class bundle → plain-English summary
│   ├── diagnostics.ts        code-first DiagnosticSpec catalog (source of truth)
│   ├── source-css.ts         emits dist/source.css from allowlist
│   ├── index.ts              public API
│   └── react/
│       └── index.tsx         <SlotLayout> + <SlotLayout.Region>
├── dist/
│   ├── index.js              core (no React)
│   ├── react/index.js        peer-dep React 18+
│   └── source.css            generated @source inline() artifact
├── docs/
│   ├── skills/tw-layout-lint.md  Skill.md (worked examples, anti-patterns, recipe)
│   └── diagnostics.md            generated from src/diagnostics.ts
├── examples/
│   ├── partial-dashboard/    host shadcn page + agent-emitted regions
│   └── agent-tool-use/       Anthropic structured-output harness
├── test/                      Vitest + Tailwind compile fixture
├── tsup.config.ts
└── package.json               exports: ".", "./react", "./source.css"
```

**Subpath exports:**
```ts
import { validate, describe, type LayoutLintInput } from "tw-layout-lint";
import { SlotLayout } from "tw-layout-lint/react";  // peer-dep React 18+
```

User imports the runtime safelist via the JS package (resolved through standard module resolution, not Tailwind's filesystem `@source` registration):

```css
@import "tailwindcss";
@import "tw-layout-lint/source.css";
```

**Tooling:** tsup (dual ESM/CJS), Vitest, TypeScript 5.5+, Node 20+, browsers ES2022.

## §6. Public API

```ts
type LayoutClassTarget = {
  className: string;
  style?: Record<`--${string}`, string>;
};

type LayoutLintInput = {
  container?: LayoutClassTarget;
  root: LayoutClassTarget;
  regions?: Record<string, LayoutClassTarget>;
};

type ValidateMode = "build-time" | "runtime";

type RuntimeValidateOptions = {
  mode?: "runtime";
  // cssVarPrefix and allowedContainerNames are FIXED in runtime mode
  // ("--ll-" and ["layout"] respectively) so the runtime safelist is finite.
  theme?: { containerBreakpoints?: Record<string, string> };
};

type BuildTimeValidateOptions = {
  mode: "build-time";
  allowedContainerNames?: readonly string[];   // default ["layout"]
  cssVarPrefix?: `--${string}`;                // default "--ll-"
  theme?: { containerBreakpoints?: Record<string, string> };
};

type ValidateOptions = RuntimeValidateOptions | BuildTimeValidateOptions;

type ValidationResult =
  | { ok: true;  input: LayoutLintInput; warnings: Diagnostic[] }
  | { ok: false; errors: Diagnostic[]; warnings: Diagnostic[] };

type DescribeResult =
  | { ok: true;  input: LayoutLintInput; description: string; warnings: Diagnostic[] }
  | { ok: false; description: string; errors: Diagnostic[]; warnings: Diagnostic[] };

declare function validate(input: unknown, options?: ValidateOptions): ValidationResult;
declare function describe(input: unknown, options?: ValidateOptions): DescribeResult;

// Convenience for non-agent users
declare function validateOrThrow(input: unknown, options?: ValidateOptions): LayoutLintInput;
```

`validate` and `describe` accept `unknown` — agents may pass malformed values. Shape errors are first-class diagnostics. `describe()` always returns a usable string — degraded but informative on `ok: false`.

**Runtime-mode finite contract.** When `mode` is `"runtime"` (the default), `cssVarPrefix` is fixed at `"--ll-"` and `allowedContainerNames` is fixed at `["layout"]`. This is what makes the runtime safelist finite and shippable. To use custom names or prefixes, opt into `"build-time"`.

## §7. Diagnostic surface

```ts
type DiagnosticPhase =
  | "shape"          // top-level input shape (object, required keys, value types)
  | "parse"          // token grammar
  | "allowlist"      // utility + variant + value form
  | "reachability"   // CSS-var ↔ utility match
  | "invariant"      // structural rules (container placement, etc.)
  | "describe";      // describe() rendering

type Diagnostic = {
  code: DiagnosticCode;                              // stable across versions
  severity: "error" | "warning";
  phase: DiagnosticPhase;
  path: (string | number)[];
  pathText: string;                                  // e.g. root.className["@max-md/layout:hidden"]
  message: string;                                   // addressed to the agent
  hint?: string;
  validValues?: readonly unknown[];
  related?: Array<{
    path: (string | number)[];
    pathText: string;
    label?: string;
  }>;
};
```

### 7.1 Diagnostic catalog (source of truth in `src/diagnostics.ts`)

```ts
export const diagnosticCodes = {
  // shape
  LL_E_INPUT_SHAPE: {
    severity: "error", phase: "shape", status: "active",
    title: "Input is not a valid LayoutLintInput object",
    defaultHint: "Top-level value must be an object with a 'root' field of shape { className: string, style?: Record<`--…`, string> }.",
  },
  LL_E_CLASSNAME_NOT_STRING: {
    severity: "error", phase: "shape", status: "active",
    title: "className must be a string",
    defaultHint: "Set className to a single space-separated string of utility classes.",
  },
  LL_E_STYLE_NOT_OBJECT: {
    severity: "error", phase: "shape", status: "active",
    title: "style must be a plain object of CSS custom property entries",
    defaultHint: "Use { '--ll-cols': '...' }; never an array, function, or null.",
  },
  LL_E_STYLE_VALUE_NOT_STRING: {
    severity: "error", phase: "shape", status: "active",
    title: "style values must be strings",
    defaultHint: "CSS custom property values are strings; numbers and booleans are not accepted.",
  },
  LL_E_REGION_ID: {
    severity: "error", phase: "shape", status: "active",
    title: "Region id is not a valid identifier",
    defaultHint: "Region keys must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/. No empty strings, prototype names, or symbols.",
  },

  // parse
  LL_E_PARSE_TOKEN: {
    severity: "error", phase: "parse", status: "active",
    title: "Class token does not match the layout grammar",
    defaultHint: "Check that the class is one of the allowlisted layout utilities and uses only allowed variants.",
  },
  LL_E_VARIANT_STACK_NOT_ALLOWED: {
    severity: "error", phase: "parse", status: "active",
    title: "Stacked container variants are not allowed in v0.1",
    defaultHint: "Use at most one container variant per class token. e.g. '@max-md/layout:hidden', not '@sm/layout:@max-md/layout:hidden'.",
  },
  LL_E_ARBITRARY_BREAKPOINT: {
    severity: "error", phase: "parse", status: "active",
    title: "Arbitrary container breakpoints are not allowed in v0.1",
    defaultHint: "Use named breakpoints from {3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}, e.g. '@max-md/layout:'.",
  },
  LL_E_IMPORTANT_NOT_ALLOWED: {
    severity: "error", phase: "parse", status: "active",
    title: "The !important modifier is not allowed",
    defaultHint: "Remove the leading !.",
  },

  // allowlist
  LL_E_UTILITY_NOT_LAYOUT: {
    severity: "error", phase: "allowlist", status: "active",
    title: "Utility is not in the layout-only allowlist",
    defaultHint: "Layout regions only allow flex/grid/gap/order/min-*/max-* utilities. Visual styling belongs in the host.",
  },
  LL_E_VARIANT_NOT_ALLOWED: {
    severity: "error", phase: "allowlist", status: "active",
    title: "Variant prefix is not allowed",
    defaultHint: "Only named container variants (@<size>/<name>:, @max-<size>/<name>:) are allowed in layout regions.",
  },
  LL_E_ARBITRARY_VALUE_RUNTIME: {
    severity: "error", phase: "allowlist", status: "active",
    title: "Arbitrary value classes are not allowed in runtime mode",
    defaultHint: "Move the dynamic value to a CSS variable: e.g. grid-cols-(--ll-cols) with style: { '--ll-cols': '...' }.",
  },
  LL_E_NUMERIC_UTILITY_RUNTIME: {
    severity: "error", phase: "allowlist", status: "active",
    title: "Static numeric utility is not allowed in runtime mode",
    defaultHint: "Use a CSS-variable form (e.g. grid-cols-(--ll-cols)) instead. The exceptions are 'grid-cols-1' and 'grid-rows-1' under a container variant for responsive collapse.",
  },
  LL_E_RUNTIME_VAR_NAME: {
    severity: "error", phase: "allowlist", status: "active",
    title: "CSS variable name is not in the runtime canonical set",
    defaultHint: "Runtime mode accepts only canonical variable names: --ll-cols, --ll-rows, --ll-gap, --ll-gap-x, --ll-gap-y, --ll-basis, --ll-min-w, --ll-min-h, --ll-max-w, --ll-max-h, --ll-order. For custom names, use build-time mode.",
  },
  LL_E_VARIANT_TARGET_RUNTIME: {
    severity: "error", phase: "allowlist", status: "active",
    title: "Variant + utility combination is not in the runtime safelist",
    defaultHint: "In runtime mode, container variants are allowed only on a finite set: hidden, block, flex, grid, flex-row, flex-col, grid-cols-1, grid-rows-1, grid-cols-(--ll-cols), grid-rows-(--ll-rows).",
  },

  // reachability
  LL_E_VAR_OUT_OF_NAMESPACE: {
    severity: "error", phase: "reachability", status: "active",
    title: "CSS variable is outside the configured namespace",
    defaultHint: "Use the configured cssVarPrefix (default '--ll-') for every layout-controlled variable.",
  },
  LL_E_VAR_DANGLING_REF: {
    severity: "error", phase: "reachability", status: "active",
    title: "Utility references a CSS variable with no matching style entry",
    defaultHint: "Add the referenced variable to style on the same target, or remove the utility.",
  },
  LL_E_VAR_VALUE: {
    severity: "error", phase: "reachability", status: "active",
    title: "CSS variable value does not match the consuming utility's grammar",
    defaultHint: "Check the value against the expected CSS form (grid-template tracks, length, integer).",
  },

  // invariant
  LL_E_CONTAINER_MISSING: {
    severity: "error", phase: "invariant", status: "active",
    title: "Container query variant requires an explicit container target",
    defaultHint: "Add input.container with className containing @container/<name> matching the variant's name.",
  },
  LL_E_CONTAINER_PLACEMENT: {
    severity: "error", phase: "invariant", status: "active",
    title: "@container/<name> must appear only on input.container.className",
    defaultHint: "Move @container/<name> to input.container.className. Root and regions must not declare a container.",
  },
  LL_E_CONTAINER_VARIANT_PLACEMENT: {
    severity: "error", phase: "invariant", status: "active",
    title: "Container-query variants are not allowed on input.container.className",
    defaultHint: "Container variants belong on root.className or regions[*].className, not on the container itself.",
  },

  // warnings
  LL_W_ROOT_HIDDEN: {
    severity: "warning", phase: "allowlist", status: "active",
    title: "Unprefixed 'hidden' on container or root erases content at all sizes",
    defaultHint: "Move hidden under a container variant (e.g. @max-md/layout:hidden) or remove it.",
  },
  LL_W_CONTENTS_DISPLAY: {
    severity: "warning", phase: "allowlist", status: "active",
    title: "display: contents on container or root has accessibility edge cases",
    defaultHint: "Prefer a normal display unless contents is specifically required.",
  },
  LL_W_ORDER_A11Y: {
    severity: "warning", phase: "allowlist", status: "active",
    title: "Custom order can diverge from DOM/focus order",
    defaultHint: "Verify keyboard navigation order matches the visual order.",
  },
  LL_W_UNUSED_VAR: {
    severity: "warning", phase: "reachability", status: "active",
    title: "CSS variable is declared but not referenced by any utility on this target",
    defaultHint: "Remove the variable, or add a utility that consumes it.",
  },
  LL_W_BUILDTIME_CUSTOM_NAMES: {
    severity: "warning", phase: "shape", status: "active",
    title: "Custom container names or cssVarPrefix require user-supplied source coverage",
    defaultHint: "Build-time mode permits custom names, but the user is responsible for ensuring Tailwind scans or safelists the resulting classes.",
  },
} as const;
```

`docs/diagnostics.md` is **generated** from this object during `prebuild`. CI fails on drift.

### 7.2 Stable-codes policy (in README)

> Diagnostic codes are stable starting at 0.1.0. New codes may be added in any release; existing codes are never reused or removed in 0.x or later. Codes that no longer fire move to `status: "deprecated"` with a pointer to the replacement, but their entry stays in the catalog forever.

### 7.3 Non-cascading rule

> The validator emits the earliest actionable error per subtree and suppresses dependent diagnostics until that subtree is valid. Invalid target structure produces one diagnostic for that target and suppresses token-level diagnostics until the target shape is valid.

## §8. Token parser (`src/parse.ts`)

Each className entry tokenizes into:

```ts
type ContainerBreakpoint =
  | "3xs" | "2xs" | "xs" | "sm" | "md" | "lg"
  | "xl"  | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";

type ParsedVariant = {
  kind: "container-min" | "container-max";
  size: ContainerBreakpoint;
  name: string;
  raw: string;
};

type ParsedClass = {
  variants: ParsedVariant[];                          // length 0 or 1 in v0.1
  utility: string;
  value:
    | { kind: "static";    raw: string }
    | { kind: "css-var";   ref: `--${string}` }       // exact var name including "--" prefix
    | { kind: "arbitrary"; raw: string }              // build-time only; "[…]" content with underscore→space decoded
    | { kind: "none" };
  important: boolean;
  raw: string;
};
```

Rules:
- Each variant must match the named-container grammar. `hover:`, `dark:`, `supports-[…]`, `[@media(…)]:`, `print:`, `motion-*` → `LL_E_VARIANT_NOT_ALLOWED`.
- Stacked variants (more than one variant prefix on a single token) → `LL_E_VARIANT_STACK_NOT_ALLOWED`.
- Arbitrary container breakpoints (`@max-[640px]/layout:`) → `LL_E_ARBITRARY_BREAKPOINT`. Both modes.
- `important: true` (leading `!`) → `LL_E_IMPORTANT_NOT_ALLOWED`.
- Arbitrary-value bracket form: parser decodes `_` → space within `[…]` per Tailwind v4 convention (e.g. `grid-cols-[200px_minmax(900px,_1fr)_100px]`). Permitted in build-time only; runtime → `LL_E_ARBITRARY_VALUE_RUNTIME`.
- Unknown form → `LL_E_PARSE_TOKEN`.
- No prefix matching anywhere — full token grammar.

## §9. Allowlist (`src/allowlist.ts`)

### 9.1 Variants

```
@<size>/<name>:        size ∈ {3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}
@max-<size>/<name>:    same set
```

`<name>` must appear in `allowedContainerNames`. Runtime-mode value: `["layout"]` only.

### 9.2 Utilities (explicit enumeration; no wildcards)

| Category | Both modes (static enums) | Build-time additions | Runtime CSS-var forms |
|---|---|---|---|
| **Display** | `flex`, `grid`, `hidden`, `block`, `inline`, `inline-flex`, `inline-grid`, `contents` | — | — |
| **Container marker** | `@container/<name>` (only on `input.container`) | — | — |
| **Flex axis** | `flex-row`, `flex-col`, `flex-wrap`, `flex-nowrap` | — | — |
| **Flex item** | `flex-1`, `flex-auto`, `flex-none`, `grow`, `grow-0`, `shrink`, `shrink-0` | `basis-<n>` (n: 0,1,2,3,4,5,6,8,10,12,16,20,24,32,40,48,56,64,72,80,96), `basis-<frac>` (1/2,1/3,2/3,1/4,3/4,1/5,2/5,3/5,4/5,1/6,5/6,1/12,…) | `basis-(--ll-basis)` |
| **Grid template** | `grid-cols-1`, `grid-rows-1` (responsive-collapse target only — see §10.2) | `grid-cols-<2..12>`, `grid-rows-<2..12>` | `grid-cols-(--ll-cols)`, `grid-rows-(--ll-rows)` |
| **Grid span** | `col-span-full`, `row-span-full` | `col-span-<1..12>`, `row-span-<1..12>` | — |
| **Grid auto** | `auto-cols-auto`, `auto-cols-min`, `auto-cols-max`, `auto-cols-fr`, `auto-rows-auto`, `auto-rows-min`, `auto-rows-max`, `auto-rows-fr` | — | — |
| **Grid flow** | `grid-flow-row`, `grid-flow-col`, `grid-flow-dense`, `grid-flow-row-dense`, `grid-flow-col-dense` | — | — |
| **Gap** | — | `gap-<0..16>`, `gap-x-<0..16>`, `gap-y-<0..16>` | `gap-(--ll-gap)`, `gap-x-(--ll-gap-x)`, `gap-y-(--ll-gap-y)` |
| **Items** | `items-start`, `items-center`, `items-end`, `items-stretch`, `items-baseline` | — | — |
| **Justify** | `justify-start`, `justify-center`, `justify-end`, `justify-between`, `justify-around`, `justify-evenly`, `justify-stretch` | — | — |
| **Place items** | `place-items-start`, `place-items-center`, `place-items-end`, `place-items-stretch`, `place-items-baseline` | — | — |
| **Place content** | `place-content-start`, `place-content-center`, `place-content-end`, `place-content-between`, `place-content-around`, `place-content-evenly`, `place-content-stretch` | — | — |
| **Self** | `self-auto`, `self-start`, `self-center`, `self-end`, `self-stretch`, `self-baseline` | — | — |
| **Justify-self** | `justify-self-auto`, `justify-self-start`, `justify-self-center`, `justify-self-end`, `justify-self-stretch` | — | — |
| **Sizing** | — | `min-w-<n>`, `min-h-<n>`, `max-w-<n>`, `max-h-<n>` (same numeric set as basis) | `min-w-(--ll-min-w)`, `min-h-(--ll-min-h)`, `max-w-(--ll-max-w)`, `max-h-(--ll-max-h)` |
| **Order** | `order-first`, `order-last` | `order-<1..12>` | `order-(--ll-order)` |

Build-time mode additionally permits `*-[arbitrary]` arbitrary-value form on every value-bearing utility above, **subject to value-grammar validation in §11.4.**

### 9.3 Explicitly rejected categories

`w-*`, `h-*`, `size-*`, `m-*`, `p-*`, `space-x-*`, `space-y-*`, `relative`, `absolute`, `fixed`, `sticky`, `inset-*`, `top-*`, `left-*`, `right-*`, `bottom-*`, `z-*`, `bg-*`, `text-*`, `border-*`, `rounded-*`, `shadow-*`, `ring-*`, `opacity-*`, `outline-*`, `animate-*`, `transition-*`, `duration-*`, `ease-*`, all dark-mode/pseudo-class/media variants.

### 9.4 Soft warnings

- `hidden` or `contents` on `container`/`root` without container variant → `LL_W_ROOT_HIDDEN` / `LL_W_CONTENTS_DISPLAY`
- Any `order-*` use → `LL_W_ORDER_A11Y`
- Build-time mode with custom `allowedContainerNames` or `cssVarPrefix` → `LL_W_BUILDTIME_CUSTOM_NAMES` (one-shot per validate call)

### 9.5 Runtime canonical CSS-variable names (finite set)

```
--ll-cols     --ll-rows
--ll-gap      --ll-gap-x   --ll-gap-y
--ll-basis
--ll-min-w    --ll-min-h
--ll-max-w    --ll-max-h
--ll-order
```

Eleven names. Any other variable in `runtime` mode → `LL_E_RUNTIME_VAR_NAME`. Build-time mode permits any `cssVarPrefix`-conformant name.

### 9.6 Runtime variant-bearing utility set (finite, matches `source.css`)

In runtime mode, container variants are allowed only on this finite set:

```
hidden, block, flex, grid, flex-row, flex-col,
grid-cols-1, grid-rows-1,
grid-cols-(--ll-cols), grid-rows-(--ll-rows)
```

Any other `<variant>:<utility>` pair in runtime mode → `LL_E_VARIANT_TARGET_RUNTIME`. Build-time mode permits variants on any allowlisted utility.

## §10. Mode behavior

### 10.1 Comparison table

| Check | build-time | runtime |
|---|:---:|:---:|
| Class is in layout allowlist | ✓ | ✓ |
| Variants are layout container variants only | ✓ | ✓ |
| At most one variant per token (no stacking) | ✓ | ✓ |
| No arbitrary breakpoints (`@max-[Npx]/…`) | ✓ | ✓ |
| Container-query variant requires explicit `input.container` with `@container/<name>` | ✓ | ✓ |
| `style` keys are CSS custom properties | ✓ | ✓ |
| `style` keys match `cssVarPrefix` | ✓ | ✓ |
| Reachability (var ↔ utility match) | ✓ | ✓ |
| Var-grammar validation per consuming utility | ✓ | ✓ |
| `@container/<name>` only on `input.container` | ✓ | ✓ |
| Container variants only on `root` and `regions[*]` | ✓ | ✓ |
| `cssVarPrefix` configurable | ✓ | fixed `--ll-` |
| `allowedContainerNames` configurable | ✓ | fixed `["layout"]` |
| CSS-var name in canonical set | — | ✓ (only canonical 11 names) |
| Variant + utility pair in §9.6 finite set | — | ✓ |
| Static numeric utilities (`gap-4`, `grid-cols-3`, …) | allowed | **rejected** (`LL_E_NUMERIC_UTILITY_RUNTIME`) |
| Arbitrary-value utilities (`grid-cols-[…]`, `gap-[…]`) | allowed (with §11.4 grammar) | **rejected** (`LL_E_ARBITRARY_VALUE_RUNTIME`) |

Default mode is `runtime`.

### 10.2 The `grid-cols-1` / `grid-rows-1` exception (runtime)

Runtime rejects all static numeric utilities **except** `grid-cols-1` and `grid-rows-1`, and only when used **under a container variant**:

```
✓ @max-md/layout:grid-cols-1
✓ @max-md/layout:grid-rows-1
✗ grid-cols-1                  (unprefixed; LL_E_NUMERIC_UTILITY_RUNTIME)
✗ grid-cols-2                  (LL_E_NUMERIC_UTILITY_RUNTIME)
```

Rationale: responsive collapse to a single track is universally needed, finite, and safelistable. Other counts go through `grid-cols-(--ll-cols)`.

## §11. CSS-variable reachability

For every target (`container`, `root`, `regions[k]`):

1. Every `style` key must start with `cssVarPrefix` (runtime: `--ll-`) → otherwise `LL_E_VAR_OUT_OF_NAMESPACE`.
2. Every utility of form `<utility>-(--ll-foo)` requires `style["--ll-foo"]` on the same target → otherwise `LL_E_VAR_DANGLING_REF`.
3. Every `style[k]` must be referenced by at least one utility on the same target's `className` → otherwise `LL_W_UNUSED_VAR` (warning).
4. Each variable's value validated against the consuming utility's expected grammar (§11.4 below).
5. **Runtime-only:** every `style[k]` must be one of the canonical names in §9.5 → otherwise `LL_E_RUNTIME_VAR_NAME`.

### 11.4 Value grammars (apply to CSS-variable values **and** to build-time arbitrary values)

| Utility family | Grammar |
|---|---|
| `grid-cols-*`, `grid-rows-*` | grid-template tracks: track-list of `<track-size>` separated by spaces, where `<track-size>` ∈ `<number>fr` \| `<number>{px\|rem}` \| `<number>%` \| `auto` \| `min-content` \| `max-content` \| `minmax(<track-min>, <track-max>)` \| `repeat(<positive-int>\|auto-fit\|auto-fill, <track-list>)`. Value `0` permitted **only** as `<track-min>` inside `minmax` (Tailwind's `minmax(0, 1fr)` idiom). |
| `gap-*`, `gap-x-*`, `gap-y-*` | non-negative length: `<number>{px\|rem}` (no `%`) |
| `min-w-*`, `min-h-*` | non-negative length: `<number>{px\|rem\|%}` |
| `max-w-*`, `max-h-*`, `basis-*` | positive length: `<number>{px\|rem\|%}` |
| `order-*` | integer (positive, zero, or negative — but `order-first`/`order-last` are preferred forms) |

**Rejected in all values (CSS-var or build-time arbitrary):** `calc(…)`, `var(…)` nesting, `url(…)`, expressions referencing other variables, scientific notation, `NaN`, `Infinity`, leading/trailing whitespace, semicolons.

Example: `gap-[calc(100vw-1rem)]` → `LL_E_VAR_VALUE` (or its arbitrary-value equivalent code on the build-time path) with a hint pointing at the disallowed `calc()`.

## §12. Container-query structural invariants

### 12.1 Container marker placement

`@container/<name>` may appear **only** on `input.container.className`. If it appears on `root.className` or any `regions[k].className` → `LL_E_CONTAINER_PLACEMENT`.

### 12.2 Container variants placement

`@<size>/<name>:` and `@max-<size>/<name>:` variants may appear **only** on `root.className` or `regions[k].className`. If they appear on `input.container.className` → `LL_E_CONTAINER_VARIANT_PLACEMENT`.

### 12.3 Variant requires container

Every container-query variant on `root` or `regions[*]` requires `input.container?.className` to contain the literal token `@container/<name>` matching the variant's `<name>`. Missing container target or missing matching `@container/<name>` → `LL_E_CONTAINER_MISSING` with `related` paths pointing to the variant token and the (missing) container.

**No inference from class strings alone.**

## §13. `describe()` behavior

Three rendering tiers per utility:

1. **Static enum**: `flex flex-col gap-4` → "Vertical flex stack with gap 4."
2. **CSS-variable shorthand**: `grid-cols-(--ll-cols)` + matching style → "Custom grid template via `--ll-cols` (`minmax(320px, 1fr) 240px`)."
3. **Arbitrary value (build-time)**: `grid-cols-[minmax(320px,1fr)_240px]` → tries to parse the CSS expression; recognized shape ("Custom two-track grid: first track ≥ 320px and flexible, second track 240px"); else fallback ("Custom grid template using an arbitrary Tailwind value").

Container behavior is described symbolically by default ("Aside hides below the md container breakpoint"). If `options.theme?.containerBreakpoints` is supplied, descriptions expand with the configured value ("…below the md container breakpoint (28rem)"). **No hard-coded breakpoint translations.**

`describe()` always produces a string — `ok: false` returns a degraded but informative description ("Invalid layout: 2 errors — see `errors` for details").

`describe()` never throws. Structured-facts variant (`explain()`) is reserved for v0.2+.

## §14. React adapter (`src/react/index.tsx`)

```tsx
import { SlotLayout } from "tw-layout-lint/react";

<SlotLayout
  input={{
    container: { className: "@container/layout" },
    root: {
      className: "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
      style: { "--ll-cols": "minmax(320px, 1fr) 240px", "--ll-gap": "1rem" },
    },
    regions: { aside: { className: "@max-md/layout:hidden" } },
  }}
  className="rounded-lg border p-4"  // host-owned, NOT validated
>
  <SlotLayout.Region id="main">{mainContent}</SlotLayout.Region>
  <SlotLayout.Region id="aside">{asideContent}</SlotLayout.Region>
</SlotLayout>
```

**Host-owned `className`.** The `SlotLayout` component's own `className` prop is host-owned and explicitly **not validated by tw-layout-lint**. It may contain visual styling (border, radius, padding, color, shadow) freely. Only `input.container`, `input.root`, and `input.regions` go through the validator.

Internally renders a two-layer wrapper:
```html
<div class="@container/layout rounded-lg border p-4">
  <div class="grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1"
       style="--ll-cols: minmax(320px, 1fr) 240px; --ll-gap: 1rem">
    <div>{main}</div>
    <div class="@max-md/layout:hidden">{aside}</div>
  </div>
</div>
```

Validation runs once per `input` (memoized by reference + shallow content hash).

**Failure mode (configurable via `onError` prop):**
- Development (`process.env.NODE_ENV !== "production"`): throw with the first error's `pathText` and `message`.
- Production: `console.error` the diagnostics; render children in a fail-open fallback `<div class="flex flex-col gap-4">{children}</div>` so content survives.

`SlotLayout.Region` reads compiled className from context. Missing region in JSON → render unstyled. Region in JSON but missing from React children → soft warning, no throw. Duplicate `<SlotLayout.Region id="…">` children → dev warning (no diagnostic code; this is a React-side concern).

Peer dep: `react@>=18`. ~80 LOC.

## §15. `dist/source.css` artifact (runtime safelist)

Generated during `prebuild` from `src/allowlist.ts`. **Each line is an exact string set, not a brace-cross-product**, to keep coverage auditable.

User imports it via the JS package (resolved through standard module resolution; no Tailwind `@source` filesystem registration):

```css
@import "tailwindcss";
@import "tw-layout-lint/source.css";
```

Generated content:

```css
/* container marker */
@source inline("@container/layout");

/* unprefixed display + flex enums */
@source inline("flex grid hidden block inline inline-flex inline-grid contents");
@source inline("flex-row flex-col flex-wrap flex-nowrap flex-1 flex-auto flex-none grow grow-0 shrink shrink-0");

/* unprefixed grid auto + flow */
@source inline("auto-cols-auto auto-cols-min auto-cols-max auto-cols-fr");
@source inline("auto-rows-auto auto-rows-min auto-rows-max auto-rows-fr");
@source inline("grid-flow-row grid-flow-col grid-flow-dense grid-flow-row-dense grid-flow-col-dense");
@source inline("col-span-full row-span-full");

/* unprefixed alignment */
@source inline("items-start items-center items-end items-stretch items-baseline");
@source inline("justify-start justify-center justify-end justify-between justify-around justify-evenly justify-stretch");
@source inline("place-items-start place-items-center place-items-end place-items-stretch place-items-baseline");
@source inline("place-content-start place-content-center place-content-end place-content-between place-content-around place-content-evenly place-content-stretch");
@source inline("self-auto self-start self-center self-end self-stretch self-baseline");
@source inline("justify-self-auto justify-self-start justify-self-center justify-self-end justify-self-stretch");

/* unprefixed order */
@source inline("order-first order-last");

/* runtime canonical CSS-var utilities (exact pairs only) */
@source inline("grid-cols-(--ll-cols)");
@source inline("grid-rows-(--ll-rows)");
@source inline("gap-(--ll-gap) gap-x-(--ll-gap-x) gap-y-(--ll-gap-y)");
@source inline("basis-(--ll-basis)");
@source inline("min-w-(--ll-min-w) min-h-(--ll-min-h)");
@source inline("max-w-(--ll-max-w) max-h-(--ll-max-h)");
@source inline("order-(--ll-order)");

/* runtime variant-bearing set (Cartesian product of named variants × variant-bearing utilities) */
@source inline("{@max-3xs/layout:,@max-2xs/layout:,@max-xs/layout:,@max-sm/layout:,@max-md/layout:,@max-lg/layout:,@max-xl/layout:,@max-2xl/layout:,@max-3xl/layout:,@max-4xl/layout:,@max-5xl/layout:,@max-6xl/layout:,@max-7xl/layout:,@3xs/layout:,@2xs/layout:,@xs/layout:,@sm/layout:,@md/layout:,@lg/layout:,@xl/layout:,@2xl/layout:,@3xl/layout:,@4xl/layout:,@5xl/layout:,@6xl/layout:,@7xl/layout:}{hidden,block,flex,grid,flex-row,flex-col,grid-cols-1,grid-rows-1}");
@source inline("{@max-3xs/layout:,@max-2xs/layout:,@max-xs/layout:,@max-sm/layout:,@max-md/layout:,@max-lg/layout:,@max-xl/layout:,@max-2xl/layout:,@max-3xl/layout:,@max-4xl/layout:,@max-5xl/layout:,@max-6xl/layout:,@max-7xl/layout:,@3xs/layout:,@2xs/layout:,@xs/layout:,@sm/layout:,@md/layout:,@lg/layout:,@xl/layout:,@2xl/layout:,@3xl/layout:,@4xl/layout:,@5xl/layout:,@6xl/layout:,@7xl/layout:}{grid-cols-(--ll-cols),grid-rows-(--ll-rows)}");
```

Brace-expansion only for the variant×utility cross product; CSS-var utility names themselves are listed exactly.

## §16. Skill.md (`docs/skills/tw-layout-lint.md`)

Sections (vendored by users into their agent setups):

1. **When to use.** "Reach for this when you generate a slot-sized region of a Tailwind layout. For full-page layout or visual styling, this package is not the right tool — use Tailwind directly."
2. **Input shape.** Full TypeScript surface, every field, every default.
3. **Allowlist reference.** §9.2 categories with worked examples for each. Closed list.
4. **Runtime canonical CSS-var names.** §9.5 — the full eleven, with example uses.
5. **Runtime vs build-time.** When each applies. Same intent compiled both ways.
6. **8 worked examples.** scenario → emitted `LayoutLintInput` → compiled HTML.
7. **Anti-patterns.** Don't use margins (host owns spacing); don't use percentages for `gap`; don't set `hidden` on root without a container variant; don't put `@container/<name>` on root or regions; don't stack variants.
8. **Self-correction recipe.** Loop with `validate()` → diagnostic codes → targeted fix → re-emit. Three-attempt cap. Sample fixtures with documented minimal repairs.
9. **Round-trip verification with `describe()`.** emit → `describe()` → confirm matches user request → `validate()` → render.

Skill.md ships as a docs file in the repo, copy-paste vendored — not a marketplace plugin.

## §17. Testing strategy

- **Allowlist completeness.** Every entry in `allowlist.ts` round-trips through `parse → describe → snapshot`.
- **Diagnostic stability snapshots.** `(code, severity, phase, pathText, message, hint)` is locked per fixture. Codes never reused or removed without a major version bump.
- **Mode behavior matrix.** Every row of §10.1 tested with positive and negative fixtures.
- **CSS-variable reachability.** All five §11 rules with positive and negative cases.
- **Value-grammar coverage.** Every utility family in §11.4 tested against passing inputs and the common rejection patterns (`calc`, nested `var`, `url`, `NaN`, scientific notation).
- **Container invariants.** §12.1, §12.2, §12.3 each with multiple positive and negative fixtures, including multiple named containers in build-time mode and nested `<SlotLayout>` instances with different names.
- **Runtime canonical-var coverage.** Every name in §9.5 has a positive fixture; out-of-set names produce `LL_E_RUNTIME_VAR_NAME`.
- **Variant-target safelist.** Every pair in §9.6 generates valid output; pairs outside the set produce `LL_E_VARIANT_TARGET_RUNTIME`.
- **End-to-end Tailwind compile fixture.** A real `globals.css` importing `tailwindcss` and `tw-layout-lint/source.css`, plus a test app HTML containing every runtime-allowlist class. Run `tailwindcss` (the v4 CLI) over it; parse the generated CSS; assert every expected selector is present (e.g. `.\@container\/layout`, `.grid-cols-\(--ll-cols\)`, `.\@max-md\/layout\:hidden`). This is the only test that proves the runtime contract holds end-to-end.
- **Skill repair fixtures.** Each canonical Skill.md repair example asserts the documented minimal fix actually clears the relevant diagnostic.
- **`describe()` graceful degradation.** Invalid input still produces a non-empty string; arbitrary-value parsing degrades to fallback wording.
- **React adapter.** Vitest + Testing Library: context wiring, missing/extra regions, dev-throw vs prod-fallback rendering, host-owned className passthrough.
- **Bundle-size assertion.** CI fails if `dist/index.js` (gz) > 10KB or `dist/react/index.js` (gz) > 7KB.
- **Brand smell.** No class string in the test corpus contains the substring `tailwind`.
- **Property test.** fast-check generators for valid `LayoutLintInput` → `validate()` never throws on syntactically valid inputs; produces stable diagnostics for invalid inputs; `validate()` accepts arbitrary `unknown` without throwing.
- **Diagnostics doc drift.** `prebuild` regenerates `docs/diagnostics.md`; CI fails if generated content differs from committed copy.

## §18. Versioning & release

- **0.x semver**, breaking changes allowed in minors **except** for the diagnostic-code contract (§7.2 stable-codes policy).
- **Changesets** for changelog.
- **GitHub Actions CI:** lint + typecheck + test + Tailwind compile fixture + bundle-size + diagnostics-doc-drift on every PR. Publish on tag.
- No prerelease/canary discipline at v1.

## §19. v0.2+ deferred (explicit, so we don't drift)

- Optional JSON intent DSL frontend that compiles to lint-clean class bundles.
- Cross-region constraints (e.g., aside ≤ main / 2).
- Constraint solver (Kiwi) for content-aware sizing — different product framing, separate API (`solve(intent, {containerWidth})`).
- Solid / Svelte / Vue adapters.
- `explain()` returning structured layout facts.
- Stacked container variants (cross-product safelist generation).
- Arbitrary container breakpoints (`@max-[Npx]/layout:`).
- Custom container names + custom `cssVarPrefix` in runtime mode (would need a `generateSourceCss({...})` codegen API).
- Numeric-range static utilities in runtime mode (would require larger `source.css`).

## §20. Out of scope, ever

- Page-level positioning, spacing, or sizing (margin, padding, position, z-index).
- Visual styling (color, typography, shadows, borders, animation).
- Dark mode, hover, focus, motion variants.
- Replacing or wrapping Tailwind itself.
- Auto-fixing or rewriting agent output.
- Native (iOS/Android) rendering.
