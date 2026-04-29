import { describe as testDescribe, it, expect } from "vitest";
import { describe } from "../src/describe.js";

testDescribe("describe — happy path", () => {
  it("describes the canonical sidebar+main layout", () => {
    const r = describe({
      container: { className: "@container/layout" },
      root: {
        className:
          "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: {
          "--ll-cols": "minmax(320px, 1fr) 240px",
          "--ll-gap": "1rem",
        },
      },
      regions: {
        aside: { className: "@max-md/layout:hidden" },
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.description.toLowerCase()).toContain("grid layout");
    expect(r.description).toContain("--ll-cols");
    expect(r.description).toContain("md container breakpoint");
    expect(r.description).toContain("hides");
  });

  it("expands breakpoint when theme is provided", () => {
    const r = describe(
      {
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
          style: { "--ll-cols": "1fr 1fr" },
        },
      },
      { theme: { containerBreakpoints: { md: "28rem" } } },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.description).toContain("(28rem)");
  });
});

testDescribe("describe — graceful failure", () => {
  it("returns a usable string on invalid input", () => {
    const r = describe(null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.description.length).toBeGreaterThan(0);
    expect(r.description).toContain("Invalid layout");
  });
});
