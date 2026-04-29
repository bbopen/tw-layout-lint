/**
 * describe() — produces a plain-English summary of a LayoutLintInput.
 * Three rendering tiers: static enum / CSS-var shorthand / arbitrary value.
 * Always returns a usable string, even on failure.
 */

import { parseClass, tokenize } from "./parse.js";
import { resolveOptions } from "./options.js";
import type {
  ContainerBreakpoint,
  DescribeResult,
  LayoutClassTarget,
  LayoutLintInput,
  ParsedClass,
  ResolvedOptions,
  ValidateOptions,
} from "./types.js";
import { validate } from "./validate.js";

export function describe(input: unknown, options?: ValidateOptions): DescribeResult {
  const result = validate(input, options);
  const { resolved } = resolveOptions(options);

  if (!result.ok) {
    const description = degraded(result.errors.length, result.warnings.length);
    return {
      ok: false,
      description,
      errors: result.errors,
      warnings: result.warnings,
    };
  }
  const description = describeInput(result.input, resolved);
  return {
    ok: true,
    input: result.input,
    description,
    warnings: result.warnings,
  };
}

function degraded(errorCount: number, warningCount: number): string {
  const parts: string[] = [];
  parts.push(
    `Invalid layout: ${errorCount} ${errorCount === 1 ? "error" : "errors"}`,
  );
  if (warningCount > 0) {
    parts.push(`${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`);
  }
  parts.push("see `errors` for details");
  return parts.join(" — ");
}

function describeInput(input: LayoutLintInput, opts: ResolvedOptions): string {
  const sections: string[] = [];

  // Container (if present)
  const containerNames = collectContainerNames(input.container);
  if (containerNames.length > 0) {
    const list = containerNames.map((n) => `'${n}'`).join(", ");
    sections.push(
      containerNames.length === 1
        ? `Container query scope '${containerNames[0]}'.`
        : `Container query scopes: ${list}.`,
    );
  }

  // Root layout
  sections.push(describeTarget("Root", input.root, opts));

  // Regions
  if (input.regions) {
    for (const id of Object.keys(input.regions)) {
      const target = input.regions[id];
      if (!target) continue;
      sections.push(describeTarget(`Region '${id}'`, target, opts));
    }
  }

  return sections.join(" ");
}

function collectContainerNames(target: LayoutClassTarget | undefined): string[] {
  if (!target) return [];
  const names: string[] = [];
  for (const tok of tokenize(target.className)) {
    const r = parseClass(tok);
    if (!r.ok) continue;
    if (r.parsed.utility.startsWith("@container/")) {
      names.push(r.parsed.utility.slice("@container/".length));
    }
  }
  return names;
}

function describeTarget(
  label: string,
  target: LayoutClassTarget,
  opts: ResolvedOptions,
): string {
  const tokens = tokenize(target.className);
  const parsed: ParsedClass[] = [];
  for (const tok of tokens) {
    const r = parseClass(tok);
    if (r.ok) parsed.push(r.parsed);
  }

  if (parsed.length === 0) {
    return `${label}: (no layout classes).`;
  }

  // Group by variant: classes with no variant describe the base layout;
  // classes under a variant describe responsive overrides.
  const base = parsed.filter((p) => p.variants.length === 0);
  const responsive = parsed.filter((p) => p.variants.length > 0);

  const fragments: string[] = [];
  fragments.push(describeBase(base, target, opts));
  for (const r of responsive) {
    fragments.push(describeResponsive(r, target, opts));
  }
  return `${label}: ${fragments.filter(Boolean).join(" ")}`;
}

function describeBase(
  parsed: ParsedClass[],
  target: LayoutClassTarget,
  _opts: ResolvedOptions,
): string {
  const phrases: string[] = [];
  const kind = detectLayoutKind(parsed);
  if (kind) phrases.push(kind);
  for (const p of parsed) {
    const phrase = describeBaseToken(p, target);
    if (phrase) phrases.push(phrase);
  }
  if (phrases.length === 0) return "(layout classes present).";
  return capitalize(phrases.join(", ")) + ".";
}

function describeBaseToken(
  p: ParsedClass,
  target: LayoutClassTarget,
): string | null {
  if (p.variants.length > 0) return null;
  switch (p.utility) {
    case "grid-cols":
      return describeAxisTrack(p, target, "column");
    case "grid-rows":
      return describeAxisTrack(p, target, "row");
    case "gap":
    case "gap-x":
    case "gap-y":
      return describeGap(p, target);
    case "min-w":
    case "min-h":
    case "max-w":
    case "max-h":
    case "basis":
      return describeSizing(p, target);
    case "order":
      return describeOrderValue(p, target);
    case "order-first":
      return "ordered first";
    case "order-last":
      return "ordered last";
    case "hidden":
      return "hidden";
    case "contents":
      return "display: contents";
    default:
      return null;
  }
}

function describeAxisTrack(
  p: ParsedClass,
  target: LayoutClassTarget,
  axis: "column" | "row",
): string | null {
  const plural = axis === "column" ? "columns" : "rows";
  if (p.value.kind === "css-var") {
    const value = target.style?.[p.value.ref];
    return value
      ? `${plural} via \`${p.value.ref}\` (\`${value}\`)`
      : `${plural} via \`${p.value.ref}\``;
  }
  if (p.value.kind === "static") return `${p.value.raw} ${plural}`;
  if (p.value.kind === "arbitrary") return describeArbitraryTracks(p.value.raw, axis);
  return null;
}

function describeGap(p: ParsedClass, target: LayoutClassTarget): string | null {
  if (p.value.kind === "css-var") {
    const value = target.style?.[p.value.ref];
    return value ? `gap \`${value}\`` : `gap via \`${p.value.ref}\``;
  }
  if (p.value.kind === "static") return `gap ${p.value.raw}`;
  if (p.value.kind === "arbitrary") return `gap \`${p.value.raw}\``;
  return null;
}

function describeSizing(p: ParsedClass, target: LayoutClassTarget): string | null {
  if (p.value.kind !== "css-var") return null;
  const value = target.style?.[p.value.ref];
  return value
    ? `${p.utility} \`${value}\``
    : `${p.utility} via \`${p.value.ref}\``;
}

function describeOrderValue(p: ParsedClass, target: LayoutClassTarget): string | null {
  if (p.value.kind === "css-var") {
    const value = target.style?.[p.value.ref];
    return value ? `order ${value}` : `order via \`${p.value.ref}\``;
  }
  if (p.value.kind === "static") return `order ${p.value.raw}`;
  return null;
}

function describeResponsive(
  p: ParsedClass,
  _target: LayoutClassTarget,
  opts: ResolvedOptions,
): string {
  const variant = p.variants[0];
  if (!variant) return "";
  const breakpointPhrase = breakpointDescription(variant.size, variant.kind, opts);
  let action = `'${p.utility}'`;

  if (p.utility === "hidden") action = "hides";
  else if (p.utility === "block") action = "shows as block";
  else if (p.utility === "flex") action = "becomes a flex container";
  else if (p.utility === "grid") action = "becomes a grid container";
  else if (p.utility === "grid-cols-1") action = "collapses to a single column";
  else if (p.utility === "grid-rows-1") action = "collapses to a single row";
  else if (p.utility === "flex-col") action = "stacks vertically";
  else if (p.utility === "flex-row") action = "lays out horizontally";

  return `${breakpointPhrase}, ${action}.`;
}

function breakpointDescription(
  size: ContainerBreakpoint,
  kind: "container-min" | "container-max",
  opts: ResolvedOptions,
): string {
  const themeValue = opts.theme.containerBreakpoints?.[size];
  const direction = kind === "container-max" ? "below" : "at or above";
  return themeValue
    ? `${capitalize(direction)} the ${size} container breakpoint (${themeValue})`
    : `${capitalize(direction)} the ${size} container breakpoint`;
}

function detectLayoutKind(parsed: ParsedClass[]): string | null {
  const hasFlex = parsed.some((p) => p.utility === "flex");
  const hasGrid = parsed.some((p) => p.utility === "grid");
  const hasFlexCol = parsed.some((p) => p.utility === "flex-col");
  const hasFlexRow = parsed.some((p) => p.utility === "flex-row");

  if (hasGrid) return "grid layout";
  if (hasFlex && hasFlexCol) return "vertical flex stack";
  if (hasFlex && hasFlexRow) return "horizontal flex row";
  if (hasFlex) return "flex layout";
  return null;
}

function describeArbitraryTracks(raw: string, axis: "column" | "row"): string {
  // Best-effort: count whitespace-separated top-level tokens for a count.
  const count = countTopLevelTokens(raw);
  if (count === null) return `custom ${axis} template (\`${raw}\`)`;
  return `${count}-${axis} custom template (\`${raw}\`)`;
}

function countTopLevelTokens(s: string): number | null {
  let depth = 0;
  let count = 0;
  let inToken = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? "";
    if (ch === "(") {
      depth++;
      if (!inToken) {
        inToken = true;
        count++;
      }
      continue;
    }
    if (ch === ")") {
      depth--;
      if (depth < 0) return null;
      continue;
    }
    if (depth === 0) {
      if (/\s/u.test(ch)) {
        inToken = false;
      } else if (!inToken) {
        inToken = true;
        count++;
      }
    }
  }
  return depth === 0 ? count : null;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return (s[0]?.toUpperCase() ?? "") + s.slice(1);
}
