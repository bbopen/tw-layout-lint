#!/usr/bin/env bash
# Release-gate: build the package as a tarball, install into a fresh
# Vite + React + Tailwind v4 consumer project, build, and verify
# the production output contains the runtime safelist classes.
#
# Run before `npm publish`. Exits 0 on success, non-zero on any failure.
#
# This is the strongest end-to-end check short of an actual npm publish:
# - Validates the tarball contents (via `npm pack` and the `files` field)
# - Validates the package.json `exports` map by importing both subpaths
# - Validates the .d.ts declarations via `tsc --noEmit`
# - Validates the @import "tw-layout-lint/source.css" path through the
#   Vite + Tailwind v4 build pipeline
# - Validates that the resulting CSS bundle includes the runtime safelist

set -euo pipefail

PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_VERSION="$(node -p "require('${PKG_ROOT}/package.json').version")"
TARBALL="tw-layout-lint-${PKG_VERSION}.tgz"
CONSUMER_DIR="${TMPDIR:-/tmp}/tw-lint-consumer-$$"

cleanup() { rm -rf "${CONSUMER_DIR}" "${PKG_ROOT}/${TARBALL}"; }
trap cleanup EXIT

cd "${PKG_ROOT}"
echo "==> Building package"
npm run build >/dev/null

echo "==> Packing tarball"
npm pack >/dev/null
[ -f "${TARBALL}" ] || { echo "tarball not produced"; exit 1; }

echo "==> Creating fresh consumer at ${CONSUMER_DIR}"
mkdir -p "${CONSUMER_DIR}/src"
cd "${CONSUMER_DIR}"

cat > package.json <<EOF
{
  "name": "consumer-probe",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": { "build": "vite build" },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tw-layout-lint": "file:${PKG_ROOT}/${TARBALL}"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.4",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "tailwindcss": "^4.2.4",
    "typescript": "^6.0.0",
    "vite": "^8.0.0"
  }
}
EOF

cat > vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()] });
EOF

cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext", "moduleResolution": "Bundler", "jsx": "react-jsx",
    "strict": true, "skipLibCheck": true, "esModuleInterop": true,
    "isolatedModules": true, "noEmit": true
  },
  "include": ["src/**/*"]
}
EOF

cat > index.html <<'EOF'
<!doctype html>
<html><head><meta charset="UTF-8"><title>consumer-probe</title></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
EOF

cat > src/main.tsx <<'EOF'
import { createRoot } from "react-dom/client";
import { validate, describe, validateOrThrow, LayoutLintError } from "tw-layout-lint";
import { SlotLayout } from "tw-layout-lint/react";
import "./index.css";
const r = validate({ root: { className: "flex" } });
if (!r.ok) throw new Error("validate failed");
const d = describe({ root: { className: "flex" } });
if (!d.ok || !d.description) throw new Error("describe failed");
try { validateOrThrow({ root: { className: "bg-blue-500" } }); throw new Error("expected throw"); }
catch (e) { if (!(e instanceof LayoutLintError)) throw new Error("wrong class"); }
createRoot(document.getElementById("root")!).render(
  <SlotLayout
    input={{
      container: { className: "@container/layout" },
      root: {
        className: "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
        style: { "--ll-cols": "minmax(0, 1fr) 240px", "--ll-gap": "1rem" },
      },
      regions: { main: { className: "" }, aside: { className: "@max-md/layout:hidden" } },
    }}
  >
    <SlotLayout.Region id="main">main</SlotLayout.Region>
    <SlotLayout.Region id="aside">aside</SlotLayout.Region>
  </SlotLayout>
);
EOF

cat > src/index.css <<'EOF'
@import "tailwindcss";
@import "tw-layout-lint/source.css";
EOF

cat > src/vite-env.d.ts <<'EOF'
/// <reference types="vite/client" />
EOF

echo "==> Installing"
npm install --silent --no-audit --no-fund 2>/dev/null

echo "==> Type-checking"
npx tsc --noEmit

echo "==> Building"
npx vite build 2>&1 | tail -3

echo "==> Asserting safelist classes are in the production CSS"
CSS_FILE="$(ls dist/assets/index-*.css | head -1)"
[ -f "${CSS_FILE}" ] || { echo "no CSS bundle found"; exit 1; }

REQUIRED=(
  '\.\\@container\\/layout'
  'grid-cols-\\(--ll-cols\\)'
  '\\@max-md\\/layout\\:hidden'
  '\\@max-md\\/layout\\:grid-cols-1'
  '\.flex'
  'gap-\\(--ll-gap\\)'
)
missing=0
for needle in "${REQUIRED[@]}"; do
  if ! grep -q "${needle}" "${CSS_FILE}"; then
    echo "MISSING in ${CSS_FILE}: ${needle}"
    missing=$((missing+1))
  fi
done

if [ "${missing}" -gt 0 ]; then
  echo "==> FAILED — ${missing} required class(es) missing from production CSS"
  exit 1
fi

echo "==> SUCCESS — consumer build is healthy:"
echo "    tarball: $(du -k "${PKG_ROOT}/${TARBALL}" | awk '{print $1}')KB"
echo "    consumer CSS: $(du -k "${CSS_FILE}" | awk '{print $1}')KB ($(basename "${CSS_FILE}"))"
echo "    consumer JS:  $(du -k dist/assets/index-*.js | head -1 | awk '{print $1}')KB"
