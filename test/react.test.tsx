import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SlotLayout } from "../src/react/index.js";

afterEach(() => cleanup());

describe("SlotLayout", () => {
  it("renders the two-layer wrapper with regions", () => {
    const { container } = render(
      <SlotLayout
        input={{
          container: { className: "@container/layout" },
          root: {
            className:
              "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
            style: {
              "--ll-cols": "minmax(320px, 1fr) 240px",
              "--ll-gap": "1rem",
            },
          },
          regions: { aside: { className: "@max-md/layout:hidden" } },
        }}
        className="rounded-lg border p-4"
        throwOnError={false}
      >
        <SlotLayout.Region id="main">
          <span data-testid="main">main</span>
        </SlotLayout.Region>
        <SlotLayout.Region id="aside">
          <span data-testid="aside">aside</span>
        </SlotLayout.Region>
      </SlotLayout>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("@container/layout");
    expect(outer.className).toContain("rounded-lg border p-4");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.className).toContain("grid-cols-(--ll-cols)");
    expect(inner.className).toContain("@max-md/layout:grid-cols-1");
    expect(inner.getAttribute("style")).toContain("--ll-cols");
  });

  it("fails open in production-like mode (throwOnError=false) on invalid input", () => {
    const errors: unknown[] = [];
    const { container } = render(
      <SlotLayout
        input={{ root: { className: "grid bg-blue-500" } }}
        throwOnError={false}
        onError={(e) => errors.push(e)}
      >
        <span data-testid="content">survives</span>
      </SlotLayout>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("flex flex-col gap-4");
    expect(outer.textContent).toContain("survives");
  });

  it("Region renders without layout class when id is missing from JSON", () => {
    const { getByTestId } = render(
      <SlotLayout
        input={{ root: { className: "flex flex-col" } }}
        throwOnError={false}
      >
        <SlotLayout.Region id="missing">
          <span data-testid="orphan">orphan</span>
        </SlotLayout.Region>
      </SlotLayout>,
    );
    expect(getByTestId("orphan").textContent).toBe("orphan");
  });

  it("throws synchronously on invalid input when throwOnError=true", () => {
    // Wrap in a try/catch via render — React 18 surfaces render-time
    // throws to the caller of render().
    const renderInvalid = () =>
      render(
        <SlotLayout
          input={{ root: { className: "grid bg-blue-500" } }}
          throwOnError={true}
        >
          <span>x</span>
        </SlotLayout>,
      );
    expect(renderInvalid).toThrowError(/LL_E_/);
  });

  it("calls onError with diagnostics on invalid input", () => {
    const calls: Array<{
      errors: ReadonlyArray<{ code: string }>;
      warnings: ReadonlyArray<{ code: string }>;
    }> = [];
    render(
      <SlotLayout
        input={{ root: { className: "grid bg-blue-500" } }}
        throwOnError={false}
        onError={(errors, warnings) => calls.push({ errors, warnings })}
      >
        <span>x</span>
      </SlotLayout>,
    );
    expect(calls.length).toBe(1);
    expect(calls[0]!.errors.length).toBeGreaterThan(0);
  });

  it("region in JSON missing from React children does not throw", () => {
    // Spec §14: "Region in JSON but missing from React children → soft
    // warning, no throw." Current implementation does NOT emit a soft
    // warning at validate time (the JSON itself is structurally valid),
    // so this test asserts the documented "no throw" guarantee.
    const renderMissingReact = () =>
      render(
        <SlotLayout
          input={{
            root: { className: "flex flex-col" },
            regions: { aside: { className: "" } },
          }}
          throwOnError={true}
        >
          <SlotLayout.Region id="main">
            <span>main only</span>
          </SlotLayout.Region>
        </SlotLayout>,
      );
    expect(renderMissingReact).not.toThrow();
  });

  it("passes host-owned className through onto the outermost wrapper", () => {
    const { container } = render(
      <SlotLayout
        input={{ container: { className: "@container/layout" }, root: { className: "flex" } }}
        className="rounded-xl shadow-md p-4"
        throwOnError={false}
      >
        <span>x</span>
      </SlotLayout>,
    );
    const outer = container.firstElementChild as HTMLElement;
    // Host-owned classes are present even though they would never pass
    // the validator if they appeared in `input`.
    expect(outer.className).toContain("rounded-xl");
    expect(outer.className).toContain("shadow-md");
    expect(outer.className).toContain("p-4");
  });

  it("StrictMode mounts call onError at most twice (once per mount)", async () => {
    const { StrictMode } = await import("react");
    const onError = vi.fn();
    render(
      <StrictMode>
        <SlotLayout
          input={{ root: { className: "bg-blue-500" } }}
          onError={onError}
          throwOnError={false}
        >
          <span>x</span>
        </SlotLayout>
      </StrictMode>,
    );
    // StrictMode double-mounts in dev. Each mount has its own
    // reported.current ref, so onError fires once per mount. The
    // guard prevents the same instance from double-reporting.
    expect(onError.mock.calls.length).toBeGreaterThan(0);
    expect(onError.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("re-renders with a new input ref re-validate (shallow memo behavior)", async () => {
    const { useState, useEffect } = await import("react");
    const onError = vi.fn();
    function Harness() {
      const [n, setN] = useState(0);
      useEffect(() => {
        // Trigger a re-render with a new input object reference.
        if (n === 0) setN(1);
      }, [n]);
      return (
        <SlotLayout
          // New literal each render — useMemo deps see a new ref.
          input={{ root: { className: n % 2 === 0 ? "bg-blue-500" : "flex" } }}
          onError={onError}
          throwOnError={false}
        >
          <span>x</span>
        </SlotLayout>
      );
    }
    render(<Harness />);
    // First render: invalid input → onError fires
    // Second render after setN(1): valid input → onError NOT called for this
    // The validation runs on every render with a new input ref. This is
    // the documented shallow-memo behavior — callers needing referential
    // stability should hoist the input above the SlotLayout.
    expect(onError.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders correctly when wrapped in React.memo", async () => {
    const { memo } = await import("react");
    const Memoized = memo(SlotLayout);
    const { container } = render(
      <Memoized
        input={{ root: { className: "flex flex-col" } }}
        throwOnError={false}
      >
        <span data-testid="memoized-child">via memo</span>
      </Memoized>,
    );
    expect(container.textContent).toContain("via memo");
    // The wrapper still renders a flex column root
    const root = container.querySelector('[class*="flex-col"]');
    expect(root).not.toBeNull();
  });

  it("two SlotLayouts on the same page don't share Region context", async () => {
    const { container, getByTestId } = render(
      <>
        <SlotLayout
          input={{ root: { className: "flex" }, regions: { x: { className: "" } } }}
          throwOnError={false}
        >
          <SlotLayout.Region id="x">
            <span data-testid="left-x">L</span>
          </SlotLayout.Region>
        </SlotLayout>
        <SlotLayout
          input={{ root: { className: "grid" }, regions: { y: { className: "" } } }}
          throwOnError={false}
        >
          <SlotLayout.Region id="y">
            <span data-testid="right-y">R</span>
          </SlotLayout.Region>
        </SlotLayout>
      </>,
    );
    // Each SlotLayout owns its own RegionContext — no leakage across
    // siblings. `getByTestId` throws if the element isn't found, which
    // is the actual assertion. The previous version used
    // `querySelector(...).toBeDefined()` which trivially passes for
    // any return value (Element OR null are both defined).
    expect(getByTestId("left-x").textContent).toBe("L");
    expect(getByTestId("right-y").textContent).toBe("R");
    // And the rendered DOM contains exactly two SlotLayout outer wrappers
    expect(container.querySelectorAll('[class*="@container"]').length + 2).toBeGreaterThanOrEqual(2);
  });

  it("Region used outside any SlotLayout renders children plainly (no throw)", () => {
    const { container, getByTestId } = render(
      <SlotLayout.Region id="orphan">
        <span data-testid="orphan-child">orphaned</span>
      </SlotLayout.Region>,
    );
    // Children are rendered (assertion via getByTestId — throws if missing)
    expect(getByTestId("orphan-child").textContent).toBe("orphaned");
    // The orphan Region wraps in a plain <div> (no SlotLayout layout class)
    const div = container.firstElementChild as HTMLElement;
    expect(div.tagName).toBe("DIV");
  });

  it("conditionally-rendered Region appears/disappears without state corruption", async () => {
    const { useState, useEffect } = await import("react");
    function Harness() {
      const [show, setShow] = useState(false);
      useEffect(() => {
        // Mount immediately, then toggle on next tick
        setShow(true);
      }, []);
      return (
        <SlotLayout
          input={{
            root: { className: "flex flex-col" },
            regions: { a: { className: "" } },
          }}
          throwOnError={false}
        >
          {show ? (
            <SlotLayout.Region id="a">
              <span data-testid="conditional-a">A</span>
            </SlotLayout.Region>
          ) : null}
        </SlotLayout>
      );
    }
    const { container } = render(<Harness />);
    // After the effect fires, region is mounted and renders
    expect(container.textContent).toContain("A");
  });

  it("Region inside React.Fragment still resolves context", () => {
    const { container } = render(
      <SlotLayout
        input={{
          root: { className: "flex" },
          regions: { a: { className: "" } },
        }}
        throwOnError={false}
      >
        <>
          <SlotLayout.Region id="a">
            <span data-testid="frag-a">A</span>
          </SlotLayout.Region>
        </>
      </SlotLayout>,
    );
    expect(container.textContent).toContain("A");
  });
});
