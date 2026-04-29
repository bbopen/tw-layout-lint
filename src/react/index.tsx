/**
 * React adapter for tw-layout-lint. Renders a two-layer wrapper
 * (container → root) with named regions resolved from JSON.
 *
 * Failure mode (configurable via `onError`):
 *   - development: throws (first error's pathText + message)
 *   - production:  console.error + fail-open `<div class="flex flex-col gap-4">`
 *
 * Peer dep: react@>=18. Zero other deps.
 */

import * as React from "react";

import { validate } from "../validate.js";
import type {
  Diagnostic,
  LayoutLintInput,
  ValidateOptions,
} from "../types.js";

type LayoutClassResolved = {
  className: string;
  style?: React.CSSProperties;
};

type ResolvedTargets = {
  container: LayoutClassResolved | null;
  root: LayoutClassResolved;
  regions: Record<string, LayoutClassResolved>;
  ok: true;
  warnings: Diagnostic[];
};

type ResolvedFailure = {
  ok: false;
  errors: Diagnostic[];
  warnings: Diagnostic[];
};

type ResolveResult = ResolvedTargets | ResolvedFailure;

const RegionContext = React.createContext<{
  regions: Record<string, LayoutClassResolved>;
} | null>(null);

export type SlotLayoutProps = {
  input: LayoutLintInput;
  options?: ValidateOptions;
  /** Host-owned className applied on the outermost wrapper. NOT validated. */
  className?: string;
  /** Hook for diagnostics; called once per resolved input. */
  onError?: (errors: Diagnostic[], warnings: Diagnostic[]) => void;
  /** Override development behavior; defaults to `process.env.NODE_ENV !== "production"`. */
  throwOnError?: boolean;
  children?: React.ReactNode;
};

function useResolved(
  input: LayoutLintInput,
  options: ValidateOptions | undefined,
): ResolveResult {
  return React.useMemo<ResolveResult>(() => {
    const result = validate(input, options);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors,
        warnings: result.warnings,
      };
    }
    const validated = result.input;
    const container: LayoutClassResolved | null = validated.container
      ? {
          className: validated.container.className,
          ...(validated.container.style !== undefined
            ? { style: validated.container.style as React.CSSProperties }
            : {}),
        }
      : null;
    const root: LayoutClassResolved = {
      className: validated.root.className,
      ...(validated.root.style !== undefined
        ? { style: validated.root.style as React.CSSProperties }
        : {}),
    };
    const regions: Record<string, LayoutClassResolved> = {};
    if (validated.regions) {
      for (const id of Object.keys(validated.regions)) {
        const r = validated.regions[id];
        if (!r) continue;
        regions[id] = {
          className: r.className,
          ...(r.style !== undefined ? { style: r.style as React.CSSProperties } : {}),
        };
      }
    }
    return {
      ok: true,
      container,
      root,
      regions,
      warnings: result.warnings,
    };
  }, [input, options]);
}

function isDev(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  return process.env["NODE_ENV"] !== "production";
}

function SlotLayoutImpl(props: SlotLayoutProps): React.ReactElement {
  const {
    input,
    options,
    className,
    onError,
    throwOnError = isDev(),
    children,
  } = props;
  const resolved = useResolved(input, options);
  const reported = React.useRef(false);

  React.useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    if (resolved.ok) {
      if (resolved.warnings.length > 0) onError?.([], resolved.warnings);
      return;
    }
    onError?.(resolved.errors, resolved.warnings);
    if (!throwOnError) {
      // eslint-disable-next-line no-console
      console.error(
        "[tw-layout-lint] validation failed",
        resolved.errors,
        resolved.warnings,
      );
    }
  }, [resolved, onError, throwOnError]);

  if (!resolved.ok) {
    if (throwOnError) {
      const first = resolved.errors[0];
      const summary = first
        ? `${first.code} at ${first.pathText}: ${first.message}`
        : "tw-layout-lint validation failed";
      throw new Error(summary);
    }
    return (
      <div className={joinClass("flex flex-col gap-4", className)}>{children}</div>
    );
  }

  // Two-layer wrapper. Outer carries host-owned className + container marker.
  const outerClass = joinClass(resolved.container?.className, className);
  const outerStyle = resolved.container?.style;
  const innerClass = resolved.root.className;
  const innerStyle = resolved.root.style;

  return (
    <RegionContext.Provider value={{ regions: resolved.regions }}>
      <div
        {...(outerClass !== undefined ? { className: outerClass } : {})}
        {...(outerStyle !== undefined ? { style: outerStyle } : {})}
      >
        <div
          {...(innerClass !== "" ? { className: innerClass } : {})}
          {...(innerStyle !== undefined ? { style: innerStyle } : {})}
        >
          {children}
        </div>
      </div>
    </RegionContext.Provider>
  );
}

export type RegionProps = {
  id: string;
  children?: React.ReactNode;
  /** Host-owned className applied on the region wrapper, joined with the layout class. */
  className?: string;
};

function Region(props: RegionProps): React.ReactElement {
  const ctx = React.useContext(RegionContext);
  const resolved = ctx?.regions[props.id];
  if (!resolved) {
    return <div {...(props.className ? { className: props.className } : {})}>{props.children}</div>;
  }
  const className = joinClass(resolved.className, props.className);
  return (
    <div
      {...(className !== "" ? { className } : {})}
      {...(resolved.style !== undefined ? { style: resolved.style } : {})}
    >
      {props.children}
    </div>
  );
}

export const SlotLayout = Object.assign(SlotLayoutImpl, { Region });

function joinClass(a: string | undefined, b: string | undefined): string {
  if (a && b) return `${a} ${b}`;
  return a ?? b ?? "";
}
