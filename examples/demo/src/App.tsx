import { useEffect, useState } from "react";
import { Adversarial } from "./pages/Adversarial.js";
import { Gallery } from "./pages/Gallery.js";
import { Playground } from "./pages/Playground.js";

type Page = "adversarial" | "playground" | "gallery";

const KNOWN_PAGES = new Set<Page>(["adversarial", "playground", "gallery"]);

function readPage(): Page {
  const hash = window.location.hash.replace(/^#\/?/u, "");
  if (KNOWN_PAGES.has(hash as Page)) return hash as Page;
  return "adversarial";
}

/**
 * If the URL hash doesn't match the canonical hash for `page`, rewrite
 * it via history.replaceState so URL and rendered content stay in sync.
 * Used on mount (covers initial unknown routes like `#/whatever`) and
 * on every hashchange (covers user-typed unknown hashes).
 */
function normalizeHash(page: Page): void {
  const expected = `#/${page}`;
  if (window.location.hash !== expected) {
    window.history.replaceState(null, "", expected);
  }
}

export function App() {
  const [page, setPage] = useState<Page>(readPage);

  useEffect(() => {
    // Normalize on mount in case the user landed on an unknown route.
    normalizeHash(readPage());
    const onHash = () => {
      const next = readPage();
      setPage(next);
      normalizeHash(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <a href="#/adversarial" className="font-mono text-sm font-semibold text-slate-900">
              tw-layout-lint
            </a>
            <span className="ml-3 text-xs text-slate-500">
              layout-only Tailwind v4 validator for agent output
            </span>
          </div>
          <nav className="flex gap-1 text-sm">
            <NavLink current={page} target="adversarial" label="Adversarial" />
            <NavLink current={page} target="playground" label="Playground" />
            <NavLink current={page} target="gallery" label="Gallery" />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {page === "adversarial" ? <Adversarial /> : null}
          {page === "playground" ? <Playground /> : null}
          {page === "gallery" ? <Gallery /> : null}
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 text-xs text-slate-500">
          Every page on this demo uses the production tw-layout-lint package
          and a real Tailwind v4 build. No mocks. Diagnostic codes shown are
          the same ones the validator emits.
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  current,
  target,
  label,
}: {
  current: Page;
  target: Page;
  label: string;
}) {
  const active = current === target;
  return (
    <a
      href={`#/${target}`}
      data-testid={`nav-${target}`}
      className={
        "px-3 py-1.5 rounded-md transition-colors " +
        (active
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100")
      }
    >
      {label}
    </a>
  );
}
