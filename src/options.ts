/**
 * Option resolution. Applies defaults; in runtime mode, fixes
 * cssVarPrefix and allowedContainerNames. Build-time mode allows
 * customization but emits LL_W_BUILDTIME_CUSTOM_NAMES once when used.
 */

import type {
  ResolvedOptions,
  ValidateOptions,
  ValidateMode,
  Diagnostic,
} from "./types.js";
import { mkDiag } from "./diag.js";

const DEFAULT_RUNTIME_PREFIX: `--${string}` = "--ll-";
const DEFAULT_CONTAINER_NAMES: readonly string[] = ["layout"] as const;

export type ResolveOptionsResult = {
  resolved: ResolvedOptions;
  warnings: Diagnostic[];
};

export function resolveOptions(opts: ValidateOptions | undefined): ResolveOptionsResult {
  const mode: ValidateMode = opts?.mode ?? "runtime";
  const warnings: Diagnostic[] = [];

  if (mode === "runtime") {
    return {
      resolved: {
        mode,
        allowedContainerNames: DEFAULT_CONTAINER_NAMES,
        cssVarPrefix: DEFAULT_RUNTIME_PREFIX,
        theme: opts?.theme ?? {},
      },
      warnings,
    };
  }

  // build-time
  const allowedContainerNames =
    opts && opts.mode === "build-time" && opts.allowedContainerNames
      ? opts.allowedContainerNames
      : DEFAULT_CONTAINER_NAMES;
  const cssVarPrefix =
    opts && opts.mode === "build-time" && opts.cssVarPrefix
      ? opts.cssVarPrefix
      : DEFAULT_RUNTIME_PREFIX;

  const usedCustomNames =
    !arraysEqual(allowedContainerNames, DEFAULT_CONTAINER_NAMES) ||
    cssVarPrefix !== DEFAULT_RUNTIME_PREFIX;

  if (usedCustomNames) {
    warnings.push(
      mkDiag({
        code: "LL_W_BUILDTIME_CUSTOM_NAMES",
        path: [],
        message:
          "Build-time mode is using custom container names or cssVarPrefix; ensure your Tailwind source coverage includes the resulting classes.",
      }),
    );
  }

  return {
    resolved: {
      mode,
      allowedContainerNames,
      cssVarPrefix,
      theme: opts?.theme ?? {},
    },
    warnings,
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
