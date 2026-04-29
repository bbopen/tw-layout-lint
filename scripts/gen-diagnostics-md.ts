#!/usr/bin/env tsx
/**
 * Build script: regenerates docs/diagnostics.md from src/diagnostics.ts.
 * CI fails if the generated content differs from the committed copy.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { diagnosticCodes, type DiagnosticPhase } from "../src/diagnostics.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "docs", "diagnostics.md");

const PHASE_ORDER: readonly DiagnosticPhase[] = [
  "shape",
  "parse",
  "allowlist",
  "reachability",
  "invariant",
  "describe",
];

const PHASE_TITLES: Record<DiagnosticPhase, string> = {
  shape: "Shape diagnostics (top-level input)",
  parse: "Parse diagnostics (token grammar)",
  allowlist: "Allowlist diagnostics (utility / variant / value form)",
  reachability: "Reachability diagnostics (CSS-var ↔ utility)",
  invariant: "Invariant diagnostics (structural rules)",
  describe: "Describe diagnostics",
};

function render(): string {
  const lines: string[] = [];
  lines.push(`# tw-layout-lint diagnostics`);
  lines.push("");
  lines.push(`Auto-generated from \`src/diagnostics.ts\`. Do not edit by hand.`);
  lines.push("");
  lines.push(
    `Diagnostic codes are stable starting at 0.1.0: never reused, never removed. Codes that no longer fire are marked deprecated rather than removed.`,
  );
  lines.push("");

  for (const phase of PHASE_ORDER) {
    const entries = Object.entries(diagnosticCodes).filter(
      ([, spec]) => spec.phase === phase,
    );
    if (entries.length === 0) continue;
    lines.push(`## ${PHASE_TITLES[phase]}`);
    lines.push("");
    for (const [code, spec] of entries) {
      lines.push(`### \`${code}\``);
      lines.push("");
      lines.push(`- **Severity:** ${spec.severity}`);
      lines.push(`- **Status:** ${spec.status}`);
      lines.push(`- **Title:** ${spec.title}`);
      lines.push(`- **Default hint:** ${spec.defaultHint}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, render(), "utf8");
console.log(`wrote ${out}`);
