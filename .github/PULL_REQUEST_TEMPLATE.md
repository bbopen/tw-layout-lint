<!--
Thanks for the PR! A short description and a few checks help reviewers move fast.
-->

## Summary

<!-- What does this change? Why? Link to any related issues with `Fixes #N`. -->

## Affected surface

<!-- Which of these does the change touch? -->
- [ ] Validator behavior (`src/validate.ts`, `src/parse.ts`, `src/values.ts`, `src/shape.ts`)
- [ ] Diagnostic catalog (`src/diagnostics.ts`)
- [ ] React adapter (`src/react/`)
- [ ] Source-css generator / runtime safelist (`src/source-css.ts`, `dist/source.css`)
- [ ] Build / packaging (`tsup.config.ts`, `package.json`, `scripts/`)
- [ ] Demo (`examples/demo/`)
- [ ] Docs / Skill.md (`docs/`)

## Diagnostic-code policy

<!-- Skip if no diagnostic-catalog change. -->
- [ ] No new codes added — leave checked.
- [ ] New codes added: every name follows `LL_E_*` (errors) or `LL_W_*` (warnings); each has a non-trivial `defaultHint` (>15 chars).
- [ ] Existing code's `severity`, `phase`, or meaning was changed: this is a major-version-bump-worthy break of the stable-codes policy. Justify in the summary.
- [ ] Code marked `status: "deprecated"`: replacement code is documented in the hint.

## Tests

- [ ] `npm test` passes locally
- [ ] New behavior has at least one test that asserts a specific diagnostic code (or specific output) — not just `r.ok` boolean
- [ ] If a new diagnostic was added, it's referenced from the source AND from at least one test (the catalog-integrity check enforces this)

## Build artifact

<!-- For changes that affect the shipped artifact -->
- [ ] `npm run build` clean — bundle sizes within budget (core <15KB gz, react <13KB gz)
- [ ] `bash scripts/check-consumer.sh` passes (release-gate; fresh consumer build still works)
