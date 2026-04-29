import type { LayoutLintInput } from "tw-layout-lint";

export type CanonicalExample = {
  id: string;
  title: string;
  description: string;
  /** What an LLM might be asked to produce in plain English. */
  intent: string;
  input: LayoutLintInput;
  /** Region content used for rendering. */
  regions: Record<string, string>;
};

export const CANONICAL_EXAMPLES: ReadonlyArray<CanonicalExample> = [
  {
    id: "vertical-stack",
    title: "Vertical stack",
    description:
      "Three sections, top to bottom, with a 1rem gap. No container variants — the simplest case.",
    intent: "Stack header / body / footer with a 1rem gap.",
    input: {
      root: {
        className: "flex flex-col gap-(--ll-gap)",
        style: { "--ll-gap": "1rem" },
      },
      regions: {
        header: { className: "" },
        body: { className: "" },
        footer: { className: "" },
      },
    },
    regions: {
      header: "Header",
      body: "Body content",
      footer: "Footer",
    },
  },
  {
    id: "sidebar-main",
    title: "Sidebar + main, collapses below md",
    description:
      "Two-column grid where the sidebar collapses below the md container breakpoint. The main track uses minmax(0, 1fr) so the layout never overflows the container, even at intermediate widths.",
    intent: "Flexible main content + 240px sidebar; sidebar collapses below md.",
    input: {
      container: { className: "@container/layout" },
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: {
          "--ll-cols": "minmax(0, 1fr) 240px",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        main: { className: "" },
        aside: { className: "@max-md/layout:hidden" },
      },
    },
    regions: {
      main: "Main content. Below md, this region takes the full width.",
      aside: "Sidebar (hidden below md).",
    },
  },
  {
    id: "auto-fit-gallery",
    title: "Auto-fit gallery",
    description:
      "Variable-column grid that fills available width, with each cell at least 240px wide.",
    intent: "Gallery of cards, fills width, each card ≥ 240px.",
    input: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap)",
        style: {
          "--ll-cols": "repeat(auto-fit, minmax(240px, 1fr))",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        a: { className: "" },
        b: { className: "" },
        c: { className: "" },
        d: { className: "" },
      },
    },
    regions: {
      a: "Card A",
      b: "Card B",
      c: "Card C",
      d: "Card D",
    },
  },
  {
    id: "two-row-vertical",
    title: "Two-row vertical split",
    description: "Header sized to its content, body fills remaining space.",
    intent: "Header + body, header is auto-sized, body fills the rest.",
    input: {
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-rows-(--ll-rows) gap-(--ll-gap)",
        style: {
          "--ll-rows": "auto 1fr",
          "--ll-gap": "0.5rem",
        },
      },
      regions: {
        header: { className: "" },
        body: { className: "" },
      },
    },
    regions: {
      header: "Header",
      body: "Body fills the remaining space.",
    },
  },
  {
    id: "ordered-flex",
    title: "Ordered flex",
    description:
      "Two regions in source order [primary, secondary] but visually rendered with secondary first.",
    intent: "Reverse the visual order without changing DOM/focus order.",
    input: {
      root: {
        className: "flex flex-col gap-(--ll-gap)",
        style: { "--ll-gap": "0.5rem" },
      },
      regions: {
        primary: { className: "order-last" },
        secondary: { className: "order-first" },
      },
    },
    regions: {
      primary: "Primary (DOM-first, visually last)",
      secondary: "Secondary (DOM-second, visually first)",
    },
  },
  {
    id: "bounded-content",
    title: "Bounded content width",
    description: "Content column with a max width.",
    intent: "Content column with max-width 42rem.",
    input: {
      root: {
        className:
          "flex flex-col items-start max-w-(--ll-max-w) gap-(--ll-gap)",
        style: {
          "--ll-max-w": "42rem",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        content: { className: "" },
      },
    },
    regions: {
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The container is bounded; the layout doesn't try to fill everything.",
    },
  },
  {
    id: "label-value",
    title: "Label + value (flex-row)",
    description:
      "A fixed-width label and a value that grows to fill remaining space.",
    intent: "Fixed-width label + value that grows to fill.",
    input: {
      root: {
        className: "flex flex-row gap-(--ll-gap)",
        style: { "--ll-gap": "1rem" },
      },
      regions: {
        label: {
          className: "flex-none basis-(--ll-basis)",
          style: { "--ll-basis": "8rem" },
        },
        value: { className: "flex-1" },
      },
    },
    regions: {
      label: "Label",
      value: "Value that grows to fill the remaining space.",
    },
  },
  {
    id: "responsive-three-pane",
    title: "Three-pane that collapses",
    description: "Three columns at md+, single column below md.",
    intent: "Three columns; single column below md.",
    input: {
      container: { className: "@container/layout" },
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: {
          "--ll-cols": "1fr 1fr 1fr",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        a: { className: "" },
        b: { className: "" },
        c: { className: "" },
      },
    },
    regions: {
      a: "Pane A",
      b: "Pane B",
      c: "Pane C",
    },
  },
];
