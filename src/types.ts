import type { DiagnosticCode, DiagnosticPhase, DiagnosticSeverity } from "./diagnostics.js";

// ───────────────────────── public input shape ─────────────────────────

export type LayoutClassTarget = {
  className: string;
  style?: Record<`--${string}`, string>;
};

export type LayoutLintInput = {
  container?: LayoutClassTarget;
  root: LayoutClassTarget;
  regions?: Record<string, LayoutClassTarget>;
};

// ─────────────────────────── validate options ─────────────────────────

export type ValidateMode = "build-time" | "runtime";

export type ThemeOptions = {
  containerBreakpoints?: Record<string, string>;
};

/**
 * Runtime-mode options: cssVarPrefix and allowedContainerNames are FIXED
 * ("--ll-" and ["layout"] respectively) so the runtime safelist is finite.
 * To customize either, opt into build-time mode.
 */
export type RuntimeValidateOptions = {
  mode?: "runtime";
  theme?: ThemeOptions;
};

export type BuildTimeValidateOptions = {
  mode: "build-time";
  allowedContainerNames?: readonly string[];
  cssVarPrefix?: `--${string}`;
  theme?: ThemeOptions;
};

export type ValidateOptions = RuntimeValidateOptions | BuildTimeValidateOptions;

// Internal: fully-resolved options after defaults applied.
export type ResolvedOptions = {
  mode: ValidateMode;
  allowedContainerNames: readonly string[];
  cssVarPrefix: `--${string}`;
  theme: ThemeOptions;
};

// ───────────────────────────── diagnostics ─────────────────────────────

export type DiagnosticRelated = {
  path: (string | number)[];
  pathText: string;
  label?: string;
};

export type Diagnostic = {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  phase: DiagnosticPhase;
  path: (string | number)[];
  pathText: string;
  message: string;
  hint?: string;
  validValues?: readonly unknown[];
  related?: DiagnosticRelated[];
};

// ─────────────────────────────── results ───────────────────────────────

export type ValidationResult =
  | { ok: true; input: LayoutLintInput; warnings: Diagnostic[] }
  | { ok: false; errors: Diagnostic[]; warnings: Diagnostic[] };

export type DescribeResult =
  | { ok: true; input: LayoutLintInput; description: string; warnings: Diagnostic[] }
  | { ok: false; description: string; errors: Diagnostic[]; warnings: Diagnostic[] };

// ───────────────────────────── parser types ─────────────────────────────

export type ContainerBreakpoint =
  | "3xs"
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "7xl";

export type ParsedVariant = {
  kind: "container-min" | "container-max";
  size: ContainerBreakpoint;
  name: string;
  raw: string;
};

export type ParsedValue =
  | { kind: "static"; raw: string }
  | { kind: "css-var"; ref: `--${string}` }
  | { kind: "arbitrary"; raw: string }
  | { kind: "none" };

export type ParsedClass = {
  variants: ParsedVariant[];
  utility: string;
  value: ParsedValue;
  important: boolean;
  raw: string;
};

export type ParseError = {
  code: DiagnosticCode;
  raw: string;
  message?: string;
};

export type ParseResult =
  | { ok: true; parsed: ParsedClass }
  | { ok: false; error: ParseError };

// ────────────────────────── target identifiers ──────────────────────────

export type TargetRef =
  | { kind: "container" }
  | { kind: "root" }
  | { kind: "region"; id: string };
