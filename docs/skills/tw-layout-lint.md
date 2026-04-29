---
name: tw-layout-lint
description: Use when emitting Tailwind v4 layout class strings for partial agent-generated UI regions in a shadcn/Tailwind host app. Ensures the output is layout-only (no colors, typography, positioning), uses container queries correctly, and stays inside the runtime safelist so Tailwind actually generates CSS for what you produce.
---

# Skill: emit valid `tw-layout-lint` input

You are producing the *layout* class strings for a partial UI region that will be dropped into a host shadcn/Tailwind v4 page that you did **not** generate. Your output is consumed by `tw-layout-lint`'s `validate(input)` API, which enforces a layout-only allowlist and a finite runtime safelist.

## When to use this skill

Use this skill **only** for layout (placement, sizing constraints, gap, responsive collapse). Do **not** use it for:

- Colors, typography, shadows, borders, radii — those belong in the host's classes, applied via the `<SlotLayout>` `className` prop, not via `input`.
- Margins or padding — host owns spacing.
- Positioning (`absolute`, `relative`, `z-*`) — not layout.
- Animation, transitions, dark-mode variants — not layout.

If you need a single-element region or a plain stack with no responsive behavior, prefer plain Tailwind directly without this package.

## Input shape

```ts
type LayoutLintInput = {
  container?: { className: string; style?: Record<`--ll-…`, string> };
  root: { className: string; style?: Record<`--ll-…`, string> };
  regions?: Record<string, { className: string; style?: Record<`--ll-…`, string> }>;
};
```

Defaults assumed by this skill (runtime mode):

- Container name: **`layout`** — use `@container/layout`, `@max-md/layout:`, `@md/layout:`.
- CSS-variable prefix: **`--ll-`**. Eleven canonical names: `--ll-cols`, `--ll-rows`, `--ll-gap`, `--ll-gap-x`, `--ll-gap-y`, `--ll-basis`, `--ll-min-w`, `--ll-min-h`, `--ll-max-w`, `--ll-max-h`, `--ll-order`.

## Allowed utilities (runtime mode)

| Purpose | Use |
|---|---|
| Display | `flex`, `grid`, `block`, `inline-flex`, `inline-grid` |
| Flex direction | `flex-row`, `flex-col`, `flex-wrap`, `flex-nowrap` |
| Flex item | `flex-1`, `flex-auto`, `flex-none`, `grow`, `grow-0`, `shrink`, `shrink-0` |
| Grid template (cols) | `grid-cols-(--ll-cols)` + `style: { "--ll-cols": "..." }` |
| Grid template (rows) | `grid-rows-(--ll-rows)` + `style: { "--ll-rows": "..." }` |
| Responsive collapse | `@max-md/layout:grid-cols-1`, `@max-md/layout:grid-rows-1` |
| Grid auto / flow | `auto-cols-fr`, `auto-rows-min`, `grid-flow-row-dense`, etc. |
| Gap | `gap-(--ll-gap)`, `gap-x-(--ll-gap-x)`, `gap-y-(--ll-gap-y)` + matching style |
| Sizing min/max | `min-w-(--ll-min-w)`, `max-w-(--ll-max-w)`, `min-h-(--ll-min-h)`, `max-h-(--ll-max-h)` + matching style |
| Basis | `basis-(--ll-basis)` + matching style |
| Alignment | `items-*`, `justify-*`, `place-items-*`, `place-content-*`, `self-*`, `justify-self-*` |
| Order | `order-(--ll-order)`, `order-first`, `order-last` |
| Hide responsively | `@max-md/layout:hidden`, `@md/layout:hidden`, etc. |

Anything not on this list is rejected.

## Rules you must follow

1. **Container marker placement.** `@container/layout` goes only on `input.container.className`. Never on root or regions.
2. **No container variants on the container.** Variants like `@max-md/layout:hidden` go on root or region classNames, not on the container.
3. **Container variants require an explicit container.** Any `@.../layout:` variant requires `input.container = { className: "@container/layout" }`.
4. **No arbitrary breakpoints.** Use named breakpoints from `{3xs, 2xs, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, 7xl}`. Never `@max-[640px]/layout:`.
5. **No stacked variants.** At most one container variant per class token.
6. **No static numeric utilities** like `gap-4` or `grid-cols-3`. Use the CSS-variable forms with the canonical names. The only exceptions are `grid-cols-1` and `grid-rows-1` under a container variant (responsive collapse).
7. **CSS-variable values must be plain.** Reject `calc()`, `var()` nesting, scientific notation, semicolons.
8. **Style keys must be canonical.** Only the eleven `--ll-*` names listed above. No custom names in runtime mode.
9. **Every CSS-variable utility needs a matching style entry.** If you write `grid-cols-(--ll-cols)`, you must include `style: { "--ll-cols": "..." }` on the same target.
10. **No `!important`.** No leading `!`.

## Worked examples

### 1. Simple vertical stack, no responsive behavior

```json
{
  "root": { "className": "flex flex-col" },
  "regions": {
    "header": { "className": "" },
    "body": { "className": "" }
  }
}
```

No container needed because no container variants are used. Add `gap-(--ll-gap)` if spacing is needed.

### 2. Sidebar + main, collapses below md

```json
{
  "container": { "className": "@container/layout" },
  "root": {
    "className": "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
    "style": {
      "--ll-cols": "minmax(320px, 1fr) 240px",
      "--ll-gap": "1rem"
    }
  },
  "regions": {
    "main": { "className": "" },
    "aside": { "className": "@max-md/layout:hidden" }
  }
}
```

### 3. Three equal columns at xl, two at lg, one below md

```json
{
  "container": { "className": "@container/layout" },
  "root": {
    "className": "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-lg/layout:grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
    "style": {
      "--ll-cols": "1fr 1fr 1fr",
      "--ll-gap": "1rem"
    }
  }
}
```

(Note: a single CSS variable can't drive different track-counts at different breakpoints; for true multi-breakpoint variation, model each as a separate class. Below md, the responsive collapse target `grid-cols-1` is the simplest path.)

### 4. Auto-fit gallery

```json
{
  "container": { "className": "@container/layout" },
  "root": {
    "className": "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
    "style": {
      "--ll-cols": "repeat(auto-fit, minmax(240px, 1fr))",
      "--ll-gap": "1rem"
    }
  }
}
```

### 5. Two-row vertical split

```json
{
  "container": { "className": "@container/layout" },
  "root": {
    "className": "grid grid-rows-(--ll-rows) gap-(--ll-gap)",
    "style": {
      "--ll-rows": "auto 1fr",
      "--ll-gap": "1rem"
    }
  },
  "regions": {
    "header": { "className": "" },
    "body": { "className": "" }
  }
}
```

### 6. Reorder regions

```json
{
  "root": { "className": "flex flex-col gap-(--ll-gap)", "style": { "--ll-gap": "1rem" } },
  "regions": {
    "primary": { "className": "order-first" },
    "secondary": { "className": "order-last" }
  }
}
```

(Note: `order-*` triggers an a11y warning; verify keyboard navigation order matches the visual order.)

### 7. Bounded content width

```json
{
  "root": {
    "className": "flex flex-col items-start max-w-(--ll-max-w) gap-(--ll-gap)",
    "style": { "--ll-max-w": "65ch", "--ll-gap": "1rem" }
  }
}
```

(Reject — `65ch` is not in the allowed length grammar. Use `px`, `rem`, or `%`.)

Corrected:

```json
{
  "root": {
    "className": "flex flex-col items-start max-w-(--ll-max-w) gap-(--ll-gap)",
    "style": { "--ll-max-w": "42rem", "--ll-gap": "1rem" }
  }
}
```

### 8. Two regions side-by-side, with one growing to fill remaining space

```json
{
  "root": {
    "className": "flex flex-row gap-(--ll-gap)",
    "style": { "--ll-gap": "1rem" }
  },
  "regions": {
    "label": { "className": "flex-none basis-(--ll-basis)", "style": { "--ll-basis": "8rem" } },
    "value": { "className": "flex-1" }
  }
}
```

## Anti-patterns (will fail validation)

- ❌ `bg-blue-500`, `text-lg`, `shadow-md`, `rounded-xl`, `border` — visual styling. Goes on the host's `<SlotLayout className="...">`, not the layout input.
- ❌ `m-4`, `p-2`, `mx-auto` — margins/padding. Host owns spacing.
- ❌ `relative`, `absolute`, `z-10`, `inset-0` — positioning. Not layout.
- ❌ `grid-cols-3`, `gap-4` — static numerics in runtime. Use `grid-cols-(--ll-cols)` + style.
- ❌ `grid-cols-[minmax(320px,1fr)_240px]` — arbitrary value in runtime. Use CSS variable form.
- ❌ `@max-[640px]/layout:hidden` — arbitrary breakpoint. Use named breakpoints.
- ❌ `@sm/layout:@max-md/layout:hidden` — stacked variants.
- ❌ `dark:hidden`, `hover:flex` — non-container variants.
- ❌ `--brand-color`, `--my-cols` in style — not in the canonical `--ll-*` set.
- ❌ `style: { "--ll-gap": "calc(100vw - 1rem)" }` — `calc()` is forbidden.
- ❌ `@container/layout` on root — marker only on `input.container`.

## Self-correction loop

```ts
import { validate, describe } from "tw-layout-lint";

let intent = generateIntent(userRequest);
for (let attempt = 0; attempt < 3; attempt++) {
  const r = validate(intent);
  if (r.ok) {
    const desc = describe(intent);
    if (matchesUserRequest(desc.description, userRequest)) return r.input;
    intent = reviseFromDescription(intent, desc.description, userRequest);
    continue;
  }
  // Targeted fix using diagnostic codes.
  intent = applyFixesByCode(intent, r.errors);
}
throw new Error("Could not produce valid intent in 3 attempts");
```

For each diagnostic, read `code` and `pathText`. Common fixes:

| Code | Fix |
|---|---|
| `LL_E_NUMERIC_UTILITY_RUNTIME` | Replace `gap-4` with `gap-(--ll-gap)` + `style: { "--ll-gap": "1rem" }`. |
| `LL_E_ARBITRARY_VALUE_RUNTIME` | Replace `grid-cols-[...]` with `grid-cols-(--ll-cols)` + matching style. |
| `LL_E_RUNTIME_VAR_NAME` | Rename to one of the eleven canonical `--ll-*` names. |
| `LL_E_VAR_DANGLING_REF` | Add the matching `style` entry on the same target. |
| `LL_E_VAR_OUT_OF_NAMESPACE` | Move custom variables out of `style`; only `--ll-*` is allowed. |
| `LL_E_CONTAINER_MISSING` | Add `input.container = { className: "@container/layout" }`. |
| `LL_E_CONTAINER_PLACEMENT` | Move `@container/layout` to `input.container`, off root/regions. |
| `LL_E_CONTAINER_VARIANT_PLACEMENT` | Move `@max-md/layout:` variants off `input.container`, onto root or regions. |
| `LL_E_VARIANT_TARGET_RUNTIME` | The variant + utility pair isn't safelisted. Use `hidden`, `block`, `flex`, `grid`, `flex-row`, `flex-col`, `grid-cols-1`, `grid-rows-1`, `grid-cols-(--ll-cols)`, or `grid-rows-(--ll-rows)` under a variant. |
| `LL_E_VAR_VALUE` | Check the value grammar — no `calc()`, no `var()` nesting, no scientific notation. |

## Round-trip with `describe()`

After valid emission, call `describe(input)` and compare the plain-English summary against the user's request. If `describe()` says "two-column grid" but the user asked for three-column, the JSON has a child-order or template bug — fix without re-rendering anything.
