# tw-layout-lint

A layout-only class validator for Tailwind CSS v4 agent output, with stable diagnostic codes and a finite runtime safelist.

```ts
import { validate, describe } from "tw-layout-lint";

const result = validate({
  container: { className: "@container/layout" },
  root: {
    className: "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
    style: { "--ll-cols": "minmax(320px, 1fr) 240px", "--ll-gap": "1rem" },
  },
  regions: {
    aside: { className: "@max-md/layout:hidden" },
  },
});

if (!result.ok) {
  for (const e of result.errors) console.error(e.code, e.pathText, e.message);
}
```

## What it is

A small package that takes the *layout-only* Tailwind class strings an LLM emits, validates them against a strict layout-utility allowlist, and returns stable diagnostic codes so the agent can self-correct. Plus a tiny React adapter, a JSON-Schema-like input shape, and a generated `@source inline()` artifact that pins the runtime class set.

## What it isn't

- Not a layout DSL — the LLM emits Tailwind directly, in its native vocabulary.
- Not a JSX/HTML parser — the input is a small JSON shape (`container` / `root` / `regions`).
- Not a Tailwind plugin — runs in your code at validation time, no PostCSS hooks.
- Not a constraint solver — that's a separate v0.2+ idea (see the [design spec](./docs/superpowers/specs/2026-04-27-tw-layout-lint-design.md) §19).

## Install

```sh
npm install tw-layout-lint
```

For the React adapter, `react@>=18` is a peer dependency.

## Setup (Tailwind v4)

Add the runtime safelist so Tailwind generates CSS for the finite class set:

```css
/* globals.css */
@import "tailwindcss";
@import "tw-layout-lint/source.css";
```

This pins ~200 classes (display + flex + grid enums, alignment, the eleven canonical CSS-variable utilities, and the named-container variant cross-product). Nothing more. If you change `allowedContainerNames` or `cssVarPrefix`, you must opt into build-time mode and provide your own source coverage — see "Modes" below.

## Use

### Validating an LLM emission

```ts
import { validate } from "tw-layout-lint";

const result = validate(intent /* unknown */);
if (!result.ok) {
  for (const err of result.errors) {
    // err.code      — stable identifier (e.g. "LL_E_RUNTIME_VAR_NAME")
    // err.pathText  — bracket form, e.g. root.className["@max-md/layout:hidden"]
    // err.hint      — concrete suggested fix
    // err.related   — additional pointers for multi-field errors
  }
}
```

### Describing what you got

```ts
import { describe } from "tw-layout-lint";

const desc = describe(intent);
console.log(desc.description);
// → "Container query scope 'layout'. Root: Grid layout, columns via `--ll-cols` (`minmax(320px, 1fr) 240px`), gap `1rem`. Region 'aside': Below the md container breakpoint, hides."
```

### React

```tsx
import { SlotLayout } from "tw-layout-lint/react";

<SlotLayout
  input={validated}                          // the LayoutLintInput
  className="rounded-lg border p-4"          // host-owned, NOT validated
>
  <SlotLayout.Region id="main">{mainContent}</SlotLayout.Region>
  <SlotLayout.Region id="aside">{asideContent}</SlotLayout.Region>
</SlotLayout>;
```

In development, invalid input throws (with the first error's `pathText` and `message`). In production, content is rendered in a fail-open `flex flex-col gap-4` fallback so it survives a bad emission.

## Modes

Default mode is `runtime`. In runtime mode:

- `cssVarPrefix` is fixed at `--ll-`.
- `allowedContainerNames` is fixed at `["layout"]`.
- Static numeric utilities (`gap-4`, `grid-cols-3`) are **rejected**. Use the canonical CSS-variable forms instead (`gap-(--ll-gap)`, `grid-cols-(--ll-cols)`).
- Arbitrary-value utilities (`grid-cols-[...]`) are **rejected**.
- Arbitrary container breakpoints (`@max-[640px]/layout:`) are **rejected**.
- The variant × utility cross-product is finite and matches the shipped `source.css`.

Build-time mode (opt-in) relaxes the value constraints — static numeric utilities and arbitrary values become allowed (subject to value-grammar validation), and `cssVarPrefix` / `allowedContainerNames` become customizable. Use this when the agent writes source code that Tailwind scans before build, not when it emits class strings into an already-built app.

```ts
validate(input, { mode: "build-time", allowedContainerNames: ["main"] });
```

## Diagnostic catalog

Every code is documented in [`docs/diagnostics.md`](./docs/diagnostics.md), generated from `src/diagnostics.ts`. Codes are stable starting at 0.1.0 — never reused, never removed. Codes that no longer fire are marked deprecated rather than removed.

Categories: `shape` / `parse` / `allowlist` / `reachability` / `invariant` / `describe`.

## License

MIT
