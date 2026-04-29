#!/usr/bin/env tsx
/**
 * Build script: writes dist/source.css from the runtime allowlist.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateSourceCss } from "../src/source-css.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "dist", "source.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, generateSourceCss(), "utf8");
console.log(`wrote ${out}`);
