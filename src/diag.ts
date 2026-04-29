/**
 * Diagnostic construction helpers. Centralizes the mapping from
 * (path, code, message, …) to a fully-formed Diagnostic.
 */

import { diagnosticCodes, type DiagnosticCode } from "./diagnostics.js";
import type { Diagnostic, DiagnosticRelated } from "./types.js";

export type MkDiagInput = {
  code: DiagnosticCode;
  path: (string | number)[];
  message: string;
  hint?: string;
  validValues?: readonly unknown[];
  related?: Array<{ path: (string | number)[]; label?: string }>;
};

export function mkDiag(input: MkDiagInput): Diagnostic {
  const spec = diagnosticCodes[input.code];
  const related: DiagnosticRelated[] | undefined = input.related?.map((r) => ({
    path: r.path,
    pathText: pathTextOf(r.path),
    ...(r.label !== undefined ? { label: r.label } : {}),
  }));

  return {
    code: input.code,
    severity: spec.severity,
    phase: spec.phase,
    path: input.path,
    pathText: pathTextOf(input.path),
    message: input.message,
    hint: input.hint ?? spec.defaultHint,
    ...(input.validValues !== undefined ? { validValues: input.validValues } : {}),
    ...(related !== undefined ? { related } : {}),
  };
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

export function pathTextOf(path: readonly (string | number)[]): string {
  let out = "";
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];
    if (typeof seg === "number") {
      out += `[${seg}]`;
      continue;
    }
    if (typeof seg !== "string") continue;
    if (i === 0 && IDENT_RE.test(seg)) {
      out += seg;
    } else if (IDENT_RE.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}
