/**
 * Generates the contents of `dist/source.css` from the allowlist.
 * Users import this file via `@import "tw-layout-lint/source.css"` so
 * Tailwind v4 generates CSS for the runtime-mode finite class set.
 */

import {
  CONTAINER_BREAKPOINTS,
  RUNTIME_VARIANT_BEARING_STATIC,
  RUNTIME_VARIANT_BEARING_CSS_VAR,
} from "./allowlist.js";

const DEFAULT_CONTAINER_NAME = "layout";

const HEADER = `/* tw-layout-lint runtime safelist — auto-generated. Do not edit by hand. */\n`;

export function generateSourceCss(containerName: string = DEFAULT_CONTAINER_NAME): string {
  const lines: string[] = [HEADER];

  lines.push(`/* container marker */`);
  lines.push(`@source inline("@container/${containerName}");`);
  lines.push("");

  lines.push(`/* unprefixed display + flex enums */`);
  lines.push(
    `@source inline("flex grid hidden block inline inline-flex inline-grid contents");`,
  );
  lines.push(
    `@source inline("flex-row flex-col flex-wrap flex-nowrap flex-1 flex-auto flex-none grow grow-0 shrink shrink-0");`,
  );
  lines.push("");

  lines.push(`/* unprefixed grid auto + flow + spans */`);
  lines.push(
    `@source inline("auto-cols-auto auto-cols-min auto-cols-max auto-cols-fr");`,
  );
  lines.push(
    `@source inline("auto-rows-auto auto-rows-min auto-rows-max auto-rows-fr");`,
  );
  lines.push(
    `@source inline("grid-flow-row grid-flow-col grid-flow-dense grid-flow-row-dense grid-flow-col-dense");`,
  );
  lines.push(`@source inline("col-span-full row-span-full");`);
  lines.push("");

  lines.push(`/* unprefixed alignment */`);
  lines.push(
    `@source inline("items-start items-center items-end items-stretch items-baseline");`,
  );
  lines.push(
    `@source inline("justify-start justify-center justify-end justify-between justify-around justify-evenly justify-stretch");`,
  );
  lines.push(
    `@source inline("place-items-start place-items-center place-items-end place-items-stretch place-items-baseline");`,
  );
  lines.push(
    `@source inline("place-content-start place-content-center place-content-end place-content-between place-content-around place-content-evenly place-content-stretch");`,
  );
  lines.push(
    `@source inline("self-auto self-start self-center self-end self-stretch self-baseline");`,
  );
  lines.push(
    `@source inline("justify-self-auto justify-self-start justify-self-center justify-self-end justify-self-stretch");`,
  );
  lines.push("");

  lines.push(`/* unprefixed order */`);
  lines.push(`@source inline("order-first order-last");`);
  lines.push("");

  lines.push(`/* runtime canonical CSS-var utilities (exact pairs) */`);
  lines.push(`@source inline("grid-cols-(--ll-cols)");`);
  lines.push(`@source inline("grid-rows-(--ll-rows)");`);
  lines.push(
    `@source inline("gap-(--ll-gap) gap-x-(--ll-gap-x) gap-y-(--ll-gap-y)");`,
  );
  lines.push(`@source inline("basis-(--ll-basis)");`);
  lines.push(`@source inline("min-w-(--ll-min-w) min-h-(--ll-min-h)");`);
  lines.push(`@source inline("max-w-(--ll-max-w) max-h-(--ll-max-h)");`);
  lines.push(`@source inline("order-(--ll-order)");`);
  lines.push("");

  lines.push(`/* runtime variant-bearing set (variants × variant-bearing utilities) */`);
  const variantPrefixes = buildVariantPrefixes(containerName);
  const variantsPart = `{${variantPrefixes.join(",")}}`;
  const staticUtils = [...RUNTIME_VARIANT_BEARING_STATIC].sort();
  const cssVarUtils = [...RUNTIME_VARIANT_BEARING_CSS_VAR].sort();

  lines.push(
    `@source inline("${variantsPart}{${staticUtils.join(",")}}");`,
  );
  lines.push(
    `@source inline("${variantsPart}{${cssVarUtils.join(",")}}");`,
  );
  lines.push("");

  return lines.join("\n");
}

function buildVariantPrefixes(name: string): string[] {
  const out: string[] = [];
  for (const size of CONTAINER_BREAKPOINTS) {
    out.push(`@max-${size}/${name}:`);
  }
  for (const size of CONTAINER_BREAKPOINTS) {
    out.push(`@${size}/${name}:`);
  }
  return out;
}

/**
 * Returns every concrete class string the runtime mode allows. Used by
 * the `@source inline()` coverage test to assert every accepted class
 * is matched by the brace expansion in `dist/source.css`.
 */
export function enumerateRuntimeAllowedClasses(
  containerName: string = DEFAULT_CONTAINER_NAME,
): readonly string[] {
  const out: string[] = [];

  // Container marker
  out.push(`@container/${containerName}`);

  // Unprefixed statics (display, flex, grid auto, alignment, order)
  out.push(
    "flex",
    "grid",
    "hidden",
    "block",
    "inline",
    "inline-flex",
    "inline-grid",
    "contents",
    "flex-row",
    "flex-col",
    "flex-wrap",
    "flex-nowrap",
    "flex-1",
    "flex-auto",
    "flex-none",
    "grow",
    "grow-0",
    "shrink",
    "shrink-0",
    "auto-cols-auto",
    "auto-cols-min",
    "auto-cols-max",
    "auto-cols-fr",
    "auto-rows-auto",
    "auto-rows-min",
    "auto-rows-max",
    "auto-rows-fr",
    "grid-flow-row",
    "grid-flow-col",
    "grid-flow-dense",
    "grid-flow-row-dense",
    "grid-flow-col-dense",
    "col-span-full",
    "row-span-full",
    "items-start",
    "items-center",
    "items-end",
    "items-stretch",
    "items-baseline",
    "justify-start",
    "justify-center",
    "justify-end",
    "justify-between",
    "justify-around",
    "justify-evenly",
    "justify-stretch",
    "place-items-start",
    "place-items-center",
    "place-items-end",
    "place-items-stretch",
    "place-items-baseline",
    "place-content-start",
    "place-content-center",
    "place-content-end",
    "place-content-between",
    "place-content-around",
    "place-content-evenly",
    "place-content-stretch",
    "self-auto",
    "self-start",
    "self-center",
    "self-end",
    "self-stretch",
    "self-baseline",
    "justify-self-auto",
    "justify-self-start",
    "justify-self-center",
    "justify-self-end",
    "justify-self-stretch",
    "order-first",
    "order-last",
  );

  // Runtime canonical CSS-var utilities
  out.push(
    "grid-cols-(--ll-cols)",
    "grid-rows-(--ll-rows)",
    "gap-(--ll-gap)",
    "gap-x-(--ll-gap-x)",
    "gap-y-(--ll-gap-y)",
    "basis-(--ll-basis)",
    "min-w-(--ll-min-w)",
    "min-h-(--ll-min-h)",
    "max-w-(--ll-max-w)",
    "max-h-(--ll-max-h)",
    "order-(--ll-order)",
  );

  // Variant × variant-bearing cross-product
  const variants = buildVariantPrefixes(containerName);
  for (const v of variants) {
    for (const u of RUNTIME_VARIANT_BEARING_STATIC) out.push(`${v}${u}`);
    for (const u of RUNTIME_VARIANT_BEARING_CSS_VAR) out.push(`${v}${u}`);
  }

  return out;
}
