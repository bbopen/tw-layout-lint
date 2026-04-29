# Changelog

All notable changes to this project will be documented here. The format is loosely based on [Keep a Changelog](https://keepachangelog.com), and the project adheres to [Semantic Versioning](https://semver.org).

## [0.1.0] — 2026-04-28

First public release.

### Public API

- `validate(input, options?)` — three-tier diagnostic surface (errors / warnings / typed result)
- `describe(input, options?)` — plain-English layout summary, graceful on invalid input
- `validateOrThrow(input, options?)` — convenience wrapper for non-agent callers
- `LayoutLintError` — frozen `errors`/`warnings` arrays
- `diagnosticCodes`, `generateSourceCss`, `enumerateRuntimeAllowedClasses`
- React adapter at `tw-layout-lint/react`: `<SlotLayout>` + `<SlotLayout.Region>`

### Diagnostic catalog (29 codes, stable from this release)

- 5 shape codes (`LL_E_INPUT_SHAPE`, `LL_E_CLASSNAME_NOT_STRING`, `LL_E_STYLE_NOT_OBJECT`, `LL_E_STYLE_VALUE_NOT_STRING`, `LL_E_REGION_ID`)
- 4 parse codes
- 9 allowlist codes — including `LL_E_RUNTIME_FAMILY_VAR_PAIR` for the family ↔ canonical CSS-variable pairing rule
- 3 reachability codes
- 3 invariant codes (container marker placement, variant placement, missing-container)
- 5 warning codes including `LL_W_CONFLICTING_UTILITY` (multiple utilities targeting the same CSS property at the same scope) and `LL_W_UNKNOWN_FIELD` (extra fields silently ignored)

### Runtime safelist contract

In runtime mode (the default), the accepted class set is mathematically finite:
- `cssVarPrefix` fixed at `--ll-`, `allowedContainerNames` fixed at `["layout"]`
- 11 canonical CSS-variable utilities + named-breakpoint variants (`@<size>/layout:` and `@max-<size>/layout:` for `3xs`..`7xl`) on a finite variant-bearing utility set
- The shipped `dist/source.css` (loaded via `@import "tw-layout-lint/source.css"`) brace-expands to exactly the runtime accept set, so Tailwind v4 generates CSS for everything the validator accepts. Verified end-to-end via real `@tailwindcss/cli` compile in CI.

### Build-time mode

Opt-in: relaxed numeric utilities and arbitrary values are allowed, value-grammar still enforced (rejects `calc()`, `var()` nesting, `url()`, semicolons, scientific notation), custom container names + cssVarPrefix permitted (with `LL_W_BUILDTIME_CUSTOM_NAMES` reminding the consumer they own source coverage).

### Tests

12 files, 263 tests:
- Token grammar, value grammar, shape validation
- Runtime + build-time + family-var-pairing exhaustive coverage
- Adversarial fixtures (LLM-fault categories) + adversarial probes (deeper edge cases)
- React adapter (StrictMode, memo, Fragment, sibling isolation, fail-open)
- Diagnostic catalog drift + diagnostic snapshot stability
- End-to-end Tailwind v4 compile fixture
- Build artifact integrity (bundle size, ESM/CJS interop, source maps)

### Bundle (gz)

- `dist/index.js` — 12 KB
- `dist/index.cjs` — 12 KB
- `dist/react/index.js` — 10 KB
- `dist/react/index.cjs` — 11 KB
- `dist/source.css` — 0.8 KB

### Demo

`examples/demo/` ships a working Vite + React 18 + Tailwind v4 reference app with three pages (Adversarial showcase, Playground, Gallery), plus a Playwright e2e suite.

### Release gate

`scripts/check-consumer.sh` packs the package, installs into a fresh consumer in `$TMPDIR`, builds with Vite + Tailwind v4, and asserts the output CSS contains the expected safelist classes. Run before publish.

[0.1.0]: https://github.com/bbopen/tw-layout-lint/releases/tag/v0.1.0
