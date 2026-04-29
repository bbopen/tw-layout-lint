# tw-layout-lint demo

A live demo proving `tw-layout-lint` actually works in a real Vite + React 18 + Tailwind v4 stack. Three pages:

1. **Adversarial** — sequence of agent attempts that fail, get a stable diagnostic + actionable hint, then succeed after a single mechanical repair. Shows before/after side by side, with the validator and `<SlotLayout>` running live.
2. **Playground** — paste any JSON, watch the diagnostics update in real time, see the rendered layout.
3. **Gallery** — every canonical Skill.md pattern, rendered live, with `describe()` round-trip text.

## Setup

The demo depends on the parent package via `file:../..`. Build the parent first so `dist/source.css` exists, then install + run.

```sh
# from repository root
npm install
npm run build  # generates dist/source.css and dist/index.js

# in this directory
cd examples/demo
npm install
npm run dev    # http://localhost:5173
```

## Run the e2e tests

```sh
# install Playwright browsers once
npx playwright install chromium

npm run test:e2e
# or, for the UI runner:
npm run test:e2e:ui
```

The Playwright suite verifies:
- Every adversarial scenario surfaces the expected diagnostic code on the broken side.
- Every adversarial scenario validates clean on the repaired side.
- The repaired side renders a real DOM tree from `<SlotLayout>`.
- Tailwind v4 actually compiled CSS for our classes (computed `display: grid`, non-empty `gridTemplateColumns`).
- The Playground reacts to live edits with diagnostic codes.
- The Gallery renders all 8 canonical examples.

## What the demo proves

This is the load-bearing visual proof that `tw-layout-lint` does what it says:

1. The validator's accept set ⊆ what Tailwind v4 actually generates CSS for.
2. Every diagnostic code emitted is a stable, actionable handle for an LLM agent.
3. The diagnostics' hints contain enough information to repair the input on the next iteration.
4. `<SlotLayout>` renders a two-layer wrapper with named regions resolving from JSON.
5. Host-owned className passes through unchanged (the demo's own card chrome — borders, padding, shadows — is layered on top of the validator's contract via the `className` prop).
