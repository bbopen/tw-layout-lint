/**
 * tw-layout-lint — public API.
 *
 * A layout-only class validator for Tailwind CSS agent output, with
 * stable diagnostic codes and a finite runtime safelist. For Tailwind v4.
 *
 * @see docs/superpowers/specs/2026-04-27-tw-layout-lint-design.md
 */

import { validate } from "./validate.js";
import { describe } from "./describe.js";
import type { LayoutLintInput, ValidateOptions } from "./types.js";

export { validate, describe };
export { diagnosticCodes } from "./diagnostics.js";
export {
  generateSourceCss,
  enumerateRuntimeAllowedClasses,
} from "./source-css.js";

export type {
  LayoutLintInput,
  LayoutClassTarget,
  Diagnostic,
  DiagnosticRelated,
  ValidationResult,
  DescribeResult,
  ValidateMode,
  ValidateOptions,
  RuntimeValidateOptions,
  BuildTimeValidateOptions,
  ContainerBreakpoint,
  ParsedClass,
  ParsedVariant,
  ParsedValue,
  ThemeOptions,
} from "./types.js";

export type {
  DiagnosticCode,
  DiagnosticPhase,
  DiagnosticSeverity,
  DiagnosticStatus,
  DiagnosticSpec,
} from "./diagnostics.js";

/**
 * Convenience for non-agent users: validate the input and either return
 * the typed `LayoutLintInput`, or throw a `LayoutLintError` carrying the
 * diagnostics. Prefer `validate()` for agent loops where retry-on-error
 * is the desired behavior.
 */
export function validateOrThrow(
  input: unknown,
  options?: ValidateOptions,
): LayoutLintInput {
  const result = validate(input, options);
  if (result.ok) return result.input;
  throw new LayoutLintError(result.errors, result.warnings);
}

export class LayoutLintError extends Error {
  readonly errors: ReadonlyArray<import("./types.js").Diagnostic>;
  readonly warnings: ReadonlyArray<import("./types.js").Diagnostic>;
  constructor(
    errors: ReadonlyArray<import("./types.js").Diagnostic>,
    warnings: ReadonlyArray<import("./types.js").Diagnostic>,
  ) {
    const first = errors[0];
    const summary = first
      ? `${first.code} at ${first.pathText}: ${first.message}`
      : "tw-layout-lint validation failed";
    const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : "";
    super(`${summary}${more}`);
    this.name = "LayoutLintError";
    // Freeze the array contracts so callers cannot mutate the diagnostic
    // record after the error is thrown. The TypeScript ReadonlyArray<>
    // type only protects compile-time call sites; freezing protects at
    // runtime against `error.errors.push(...)` or `.splice(...)`.
    this.errors = Object.freeze([...errors]);
    this.warnings = Object.freeze([...warnings]);
  }
}
