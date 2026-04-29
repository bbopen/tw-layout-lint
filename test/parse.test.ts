import { describe, it, expect } from "vitest";
import { parseClass, tokenize } from "../src/parse.js";

describe("tokenize", () => {
  it("splits on whitespace and trims empties", () => {
    expect(tokenize("flex flex-col gap-4")).toEqual(["flex", "flex-col", "gap-4"]);
    expect(tokenize("  grid   ")).toEqual(["grid"]);
    expect(tokenize("")).toEqual([]);
  });
  it("preserves non-breaking content inside container variants", () => {
    expect(tokenize("@max-md/layout:hidden flex")).toEqual([
      "@max-md/layout:hidden",
      "flex",
    ]);
  });
});

describe("parseClass — static enums", () => {
  it("parses a bare display utility", () => {
    const r = parseClass("flex");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("flex");
    expect(r.parsed.value.kind).toBe("none");
    expect(r.parsed.variants).toEqual([]);
  });

  it("parses flex-1 as a static enum (not flex with value 1)", () => {
    const r = parseClass("flex-1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("flex-1");
    expect(r.parsed.value.kind).toBe("none");
  });

  it("parses grid-cols-1 as a static enum (responsive collapse target)", () => {
    const r = parseClass("grid-cols-1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("grid-cols-1");
    expect(r.parsed.value.kind).toBe("none");
  });
});

describe("parseClass — value-bearing", () => {
  it("parses gap-4 as static value", () => {
    const r = parseClass("gap-4");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("gap");
    expect(r.parsed.value).toEqual({ kind: "static", raw: "4" });
  });

  it("parses gap-(--ll-gap) as a CSS-var ref", () => {
    const r = parseClass("gap-(--ll-gap)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("gap");
    expect(r.parsed.value).toEqual({ kind: "css-var", ref: "--ll-gap" });
  });

  it("parses grid-cols-[minmax(320px,1fr)_240px] as arbitrary with underscore decoded", () => {
    const r = parseClass("grid-cols-[minmax(320px,1fr)_240px]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("grid-cols");
    expect(r.parsed.value).toEqual({
      kind: "arbitrary",
      raw: "minmax(320px,1fr) 240px",
    });
  });

  it("parses gap-x with longest-match (not gap)", () => {
    const r = parseClass("gap-x-2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("gap-x");
    expect(r.parsed.value).toEqual({ kind: "static", raw: "2" });
  });

  it("parses negative order as integer", () => {
    const r = parseClass("order--1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("order");
    expect(r.parsed.value).toEqual({ kind: "static", raw: "-1" });
  });
});

describe("parseClass — variants", () => {
  it("parses @max-md/layout: prefix as a single variant", () => {
    const r = parseClass("@max-md/layout:hidden");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.variants).toHaveLength(1);
    expect(r.parsed.variants[0]).toMatchObject({
      kind: "container-max",
      size: "md",
      name: "layout",
    });
    expect(r.parsed.utility).toBe("hidden");
  });

  it("parses @md/layout: as container-min", () => {
    const r = parseClass("@md/layout:flex");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.variants[0]?.kind).toBe("container-min");
  });

  it("parses container variant + CSS-var utility", () => {
    const r = parseClass("@max-md/layout:grid-cols-(--ll-cols)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.variants[0]?.size).toBe("md");
    expect(r.parsed.utility).toBe("grid-cols");
    expect(r.parsed.value).toEqual({ kind: "css-var", ref: "--ll-cols" });
  });

  it("rejects stacked variants", () => {
    const r = parseClass("@sm/layout:@max-md/layout:hidden");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("LL_E_VARIANT_STACK_NOT_ALLOWED");
  });

  it("rejects arbitrary breakpoints", () => {
    const r = parseClass("@max-[640px]/layout:hidden");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("LL_E_ARBITRARY_BREAKPOINT");
  });

  it("rejects unknown breakpoint names with parse error", () => {
    const r = parseClass("@nope/layout:hidden");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("LL_E_PARSE_TOKEN");
  });
});

describe("parseClass — container marker", () => {
  it("parses @container/layout", () => {
    const r = parseClass("@container/layout");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parsed.utility).toBe("@container/layout");
    expect(r.parsed.variants).toEqual([]);
  });
});

describe("parseClass — !important", () => {
  it("rejects ! prefix", () => {
    const r = parseClass("!flex");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("LL_E_IMPORTANT_NOT_ALLOWED");
  });
});

describe("parseClass — unknown", () => {
  it("rejects bg-* (not a layout utility) with LL_E_PARSE_TOKEN", () => {
    // Parse layer doesn't know about layout vs visual; it just rejects
    // anything that doesn't match the static enum or value-bearing
    // prefix. The allowlist phase wouldn't get to run on these either.
    const r = parseClass("bg-blue-500");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("LL_E_PARSE_TOKEN");
  });
});
