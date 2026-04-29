/**
 * Diagnostic stability snapshots — locks `(code, severity, phase,
 * pathText, hint)` for a curated set of trigger inputs. Snapshots
 * deliberately exclude `message` because messages may carry the
 * caller's exact value, but `code` / `phase` / `pathText` / `hint` are
 * the LLM-facing contract and must not drift between releases.
 *
 * If a snapshot fails after a refactor, that is a SIGNAL to consider
 * a major version bump — the diagnostic contract is part of public API.
 */

import { describe, it, expect } from "vitest";
import { validate } from "../src/validate.js";

type SnapshotShape = {
  code: string;
  severity: "error" | "warning";
  phase: string;
  pathText: string;
  hint: string | undefined;
};

function snapshotErrors(input: unknown, options?: Parameters<typeof validate>[1]): SnapshotShape[] {
  const r = validate(input, options);
  const all = r.ok ? [] : r.errors;
  return all
    .map((d) => ({
      code: d.code,
      severity: d.severity,
      phase: d.phase,
      pathText: d.pathText,
      hint: d.hint,
    }))
    .sort((a, b) => a.pathText.localeCompare(b.pathText) || a.code.localeCompare(b.code));
}

function snapshotWarnings(input: unknown, options?: Parameters<typeof validate>[1]): SnapshotShape[] {
  const r = validate(input, options);
  return r.warnings
    .map((d) => ({
      code: d.code,
      severity: d.severity,
      phase: d.phase,
      pathText: d.pathText,
      hint: d.hint,
    }))
    .sort((a, b) => a.pathText.localeCompare(b.pathText) || a.code.localeCompare(b.code));
}

describe("diagnostic stability — runtime mode", () => {
  it("LL_E_NUMERIC_UTILITY_RUNTIME on unprefixed grid-cols-3", () => {
    expect(
      snapshotErrors({
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-3" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_NUMERIC_UTILITY_RUNTIME",
          "hint": "Use a CSS-variable form (e.g. grid-cols-(--ll-cols)) instead. The exceptions are 'grid-cols-1' and 'grid-rows-1' under a container variant for responsive collapse.",
          "pathText": "root.className["grid-cols-3"]",
          "phase": "allowlist",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_ARBITRARY_VALUE_RUNTIME on arbitrary grid-cols", () => {
    expect(
      snapshotErrors({
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-[1fr_2fr]" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_ARBITRARY_VALUE_RUNTIME",
          "hint": "Move the dynamic value to a CSS variable: e.g. grid-cols-(--ll-cols) with style: { '--ll-cols': '...' }.",
          "pathText": "root.className["grid-cols-[1fr_2fr]"]",
          "phase": "allowlist",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_RUNTIME_VAR_NAME on non-canonical CSS variable", () => {
    expect(
      snapshotErrors({
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-tracks)",
          style: { "--ll-tracks": "1fr 1fr" },
        },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_RUNTIME_VAR_NAME",
          "hint": "Runtime mode accepts only canonical variable names: --ll-cols, --ll-rows, --ll-gap, --ll-gap-x, --ll-gap-y, --ll-basis, --ll-min-w, --ll-min-h, --ll-max-w, --ll-max-h, --ll-order. For custom names, use build-time mode.",
          "pathText": "root.className["grid-cols-(--ll-tracks)"]",
          "phase": "allowlist",
          "severity": "error",
        },
        {
          "code": "LL_E_RUNTIME_VAR_NAME",
          "hint": "Runtime mode accepts only canonical variable names: --ll-cols, --ll-rows, --ll-gap, --ll-gap-x, --ll-gap-y, --ll-basis, --ll-min-w, --ll-min-h, --ll-max-w, --ll-max-h, --ll-order. For custom names, use build-time mode.",
          "pathText": "root.style["--ll-tracks"]",
          "phase": "allowlist",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_CONTAINER_MISSING when variant has no matching container", () => {
    expect(
      snapshotErrors({
        root: {
          className: "grid grid-cols-(--ll-cols) @max-md/layout:grid-cols-1",
          style: { "--ll-cols": "1fr 1fr" },
        },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_CONTAINER_MISSING",
          "hint": "Add input.container with className containing @container/<name> matching the variant's name.",
          "pathText": "root.className["@max-md/layout:grid-cols-1"]",
          "phase": "invariant",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_CONTAINER_PLACEMENT when @container/<name> is on root", () => {
    expect(
      snapshotErrors({
        root: { className: "@container/layout grid" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_CONTAINER_PLACEMENT",
          "hint": "Move @container/<name> to input.container.className. Root and regions must not declare a container.",
          "pathText": "root.className["@container/layout"]",
          "phase": "invariant",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_VAR_DANGLING_REF when no matching style entry", () => {
    expect(
      snapshotErrors({
        container: { className: "@container/layout" },
        root: { className: "grid grid-cols-(--ll-cols)" },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_VAR_DANGLING_REF",
          "hint": "Add the referenced variable to style on the same target, or remove the utility.",
          "pathText": "root.className["grid-cols-(--ll-cols)"]",
          "phase": "reachability",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_W_UNUSED_VAR is a warning with reachability phase", () => {
    expect(
      snapshotWarnings({
        container: { className: "@container/layout" },
        root: {
          className: "grid grid-cols-(--ll-cols)",
          style: { "--ll-cols": "1fr 1fr", "--ll-gap": "1rem" },
        },
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_W_UNUSED_VAR",
          "hint": "Remove the variable, or add a utility that consumes it.",
          "pathText": "root.style["--ll-gap"]",
          "phase": "reachability",
          "severity": "warning",
        },
      ]
    `);
  });
});

describe("diagnostic stability — shape errors", () => {
  it("LL_E_INPUT_SHAPE on null", () => {
    expect(snapshotErrors(null)).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_INPUT_SHAPE",
          "hint": "Top-level value must be an object with a 'root' field of shape { className: string, style?: Record<\`--…\`, string> }.",
          "pathText": "",
          "phase": "shape",
          "severity": "error",
        },
      ]
    `);
  });

  it("LL_E_CLASSNAME_NOT_STRING when className is a number", () => {
    expect(snapshotErrors({ root: { className: 42 } })).toMatchInlineSnapshot(`
      [
        {
          "code": "LL_E_CLASSNAME_NOT_STRING",
          "hint": "Set className to a single space-separated string of utility classes.",
          "pathText": "root.className",
          "phase": "shape",
          "severity": "error",
        },
      ]
    `);
  });
});
