/**
 * Adversarial scenarios for the demo. Each scenario tells a story:
 *
 *   1. The user-level intent (plain English).
 *   2. What the LLM emitted on the first attempt (broken).
 *   3. The diagnostic the validator produced.
 *   4. The repair the LLM (or a reasoner) applied based on the diagnostic.
 *   5. The validated, working result.
 *
 * Pages render this data, so adding/removing/refining a scenario only
 * touches this file.
 */

import type { LayoutLintInput } from "tw-layout-lint";

export type AdversarialScenario = {
  id: string;
  title: string;
  /** What the user asked for. */
  intent: string;
  /** Why this is a likely-real LLM mistake. */
  llmFault: string;
  /** Bad attempt — JSON-shaped but broken. */
  before: unknown;
  /** Repaired version that validates. */
  after: LayoutLintInput;
  /** Region content (used by both before/after where applicable). */
  regions?: Record<string, string>;
  /** Codes we expect to surface from `before`. */
  expectedCodes: ReadonlyArray<string>;
};

export const ADVERSARIAL_SCENARIOS: ReadonlyArray<AdversarialScenario> = [
  {
    id: "static-numeric-gap",
    title: "Static numeric utility used in runtime",
    intent: "Vertical stack of three regions with a 1rem gap.",
    llmFault:
      "LLMs default to Tailwind's spacing-scale shorthand (`gap-4`) because that's what they've seen most. In runtime mode, the validator rejects static numeric utilities because they aren't in the shipped @source inline() safelist — Tailwind would never generate CSS for them.",
    before: {
      root: { className: "flex flex-col gap-4" },
      regions: { a: { className: "" }, b: { className: "" }, c: { className: "" } },
    },
    after: {
      root: {
        className: "flex flex-col gap-(--ll-gap)",
        style: { "--ll-gap": "1rem" },
      },
      regions: { a: { className: "" }, b: { className: "" }, c: { className: "" } },
    },
    regions: { a: "First", b: "Second", c: "Third" },
    expectedCodes: ["LL_E_NUMERIC_UTILITY_RUNTIME"],
  },
  {
    id: "arbitrary-template",
    title: "Arbitrary value in a template",
    intent: "Two-column grid: 320px-min flexible main + 240px sidebar.",
    llmFault:
      "Tailwind v4 supports arbitrary values like `grid-cols-[minmax(320px,1fr)_240px]`. LLMs reach for this because it's the most natural expression. But arbitrary values aren't statically scannable, so Tailwind won't generate CSS for them in runtime mode.",
    before: {
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-[minmax(320px,1fr)_240px] gap-[1rem]" },
      regions: {
        main: { className: "" },
        aside: { className: "" },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "minmax(0, 1fr) 240px",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        main: { className: "" },
        aside: { className: "" },
      },
    },
    regions: {
      main: "Main content (flexible)",
      aside: "Aside (240px)",
    },
    expectedCodes: ["LL_E_ARBITRARY_VALUE_RUNTIME"],
  },
  {
    id: "missing-container",
    title: "Container variant without a container target",
    intent: "Two-column grid that collapses below md.",
    llmFault:
      "LLMs apply container variants like `@max-md/layout:` but forget to declare an `@container/layout` element. Tailwind silently accepts the variant and looks for an ancestor container — but there is none, so the variant never activates.",
    before: {
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "1rem",
        },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "1rem",
        },
      },
      regions: { a: { className: "" }, b: { className: "" } },
    },
    regions: { a: "Column A", b: "Column B" },
    expectedCodes: ["LL_E_CONTAINER_MISSING"],
  },
  {
    id: "container-on-root",
    title: "Container marker placed on root",
    intent: "Sidebar + main, collapses below md.",
    llmFault:
      "LLMs flatten the structure and put `@container/layout` on the same element that uses container variants. In Tailwind, the container marker and the variant variants belong on different elements (parent vs descendants).",
    before: {
      root: {
        className:
          "@container/layout grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "1fr 240px" },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "1fr 240px", "--ll-gap": "1rem" },
      },
      regions: {
        main: { className: "" },
        aside: { className: "@max-md/layout:hidden" },
      },
    },
    regions: { main: "Main content", aside: "Sidebar" },
    expectedCodes: ["LL_E_CONTAINER_PLACEMENT"],
  },
  {
    id: "cross-pair-var",
    title: "Cross-pair CSS variable",
    intent: "Two equal columns with a 1rem gap.",
    llmFault:
      "LLMs sometimes reuse one variable across multiple families ('I already named one --ll-cols, why not use it for gap too?'). The validator pairs each family with its own canonical variable; cross-pairs would produce inert classes that Tailwind never sees.",
    before: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-cols)",
        style: { "--ll-cols": "1fr 1fr" },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: { "--ll-cols": "1fr 1fr", "--ll-gap": "1rem" },
      },
      regions: { a: { className: "" }, b: { className: "" } },
    },
    regions: { a: "Column A", b: "Column B" },
    expectedCodes: ["LL_E_RUNTIME_FAMILY_VAR_PAIR"],
  },
  {
    id: "dangling-ref",
    title: "Variable utility with no style entry",
    intent: "Custom three-track grid template.",
    llmFault:
      "LLMs forget to attach the `style` map when they use a CSS-variable utility. The class name is structurally fine but the variable resolves to nothing at runtime.",
    before: {
      container: { className: "@container/layout" },
      root: { className: "grid grid-cols-(--ll-cols)" },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: { "--ll-cols": "1fr 2fr 1fr", "--ll-gap": "1rem" },
      },
      regions: {
        a: { className: "" },
        b: { className: "" },
        c: { className: "" },
      },
    },
    regions: { a: "Track 1 (1fr)", b: "Track 2 (2fr)", c: "Track 3 (1fr)" },
    expectedCodes: ["LL_E_VAR_DANGLING_REF"],
  },
  {
    id: "calc-in-value",
    title: "calc() inside a CSS-var value",
    intent: "Gap that scales with viewport.",
    llmFault:
      "LLMs reach for `calc()` to compute responsive values. The value-grammar rule rejects expression functions; layouts must use static lengths or container queries. Most apparent calc() needs are container-query needs in disguise.",
    before: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "calc(1rem + 0.5vw)",
        },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "1fr 1fr",
          "--ll-gap": "1rem",
        },
      },
      regions: { a: { className: "" }, b: { className: "" } },
    },
    regions: { a: "Cell A", b: "Cell B" },
    expectedCodes: ["LL_E_VAR_VALUE"],
  },
  {
    id: "visual-styling",
    title: "Visual styling leaking into layout",
    intent: "Card with a subtle border, 1rem padding, and a flex-row of two regions.",
    llmFault:
      "LLMs treat `className` as a single visual-and-layout bag. The package's contract is that `input.root.className` is layout-only — visual styling belongs on the host's outer container, not on the validated input.",
    before: {
      root: {
        className: "flex flex-row gap-4 p-4 border-2 rounded-xl bg-white shadow-md",
      },
    },
    after: {
      // The visual styling moves to the host's wrapper className (passed
      // via the <SlotLayout className="…"> prop), which the React adapter
      // emits unchanged on the outermost wrapper. Only layout classes
      // remain in input.root.className.
      root: {
        className: "flex flex-row gap-(--ll-gap)",
        style: { "--ll-gap": "1rem" },
      },
      regions: { a: { className: "" }, b: { className: "" } },
    },
    regions: {
      a: "Region A",
      b: "Region B",
    },
    expectedCodes: ["LL_E_PARSE_TOKEN", "LL_E_NUMERIC_UTILITY_RUNTIME"],
  },
  {
    id: "stacked-variants",
    title: "Stacked container variants",
    intent: "Hide aside between sm and md.",
    llmFault:
      "LLMs reach for the stacked-variant syntax that works in pseudo-class chains (`hover:focus:underline`). v0.1 forbids stacking on container variants — the safelist is finite by construction.",
    before: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) @sm/layout:@max-md/layout:hidden",
        style: { "--ll-cols": "1fr 1fr" },
      },
    },
    after: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "1fr 1fr", "--ll-gap": "1rem" },
      },
      regions: {
        main: { className: "" },
        aside: { className: "@max-md/layout:hidden" },
      },
    },
    regions: { main: "Main", aside: "Aside (hidden below md)" },
    expectedCodes: ["LL_E_VARIANT_STACK_NOT_ALLOWED"],
  },
];
