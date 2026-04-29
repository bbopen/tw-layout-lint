import { useMemo, useState } from "react";
import { describe, validate } from "tw-layout-lint";
import { SlotLayout } from "tw-layout-lint/react";
import { Card } from "../ui/Card.js";
import { DiagnosticList } from "../ui/Diagnostic.js";

const STARTER = `{
  "container": { "className": "@container/layout" },
  "root": {
    "className": "grid grid-cols-(--ll-cols) gap-(--ll-gap) @max-md/layout:grid-cols-1",
    "style": {
      "--ll-cols": "minmax(320px, 1fr) 240px",
      "--ll-gap": "1rem"
    }
  },
  "regions": {
    "main":  { "className": "" },
    "aside": { "className": "@max-md/layout:hidden" }
  }
}`;

type ParseState =
  | { kind: "ok"; value: unknown }
  | { kind: "error"; reason: string };

function parseJson(text: string): ParseState {
  try {
    return { kind: "ok", value: JSON.parse(text) };
  } catch (e) {
    return { kind: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}

export function Playground() {
  const [text, setText] = useState(STARTER);
  const parsed = useMemo(() => parseJson(text), [text]);

  return (
    <div className="space-y-6" data-testid="playground-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Playground</h1>
        <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
          Paste a <code className="font-mono">LayoutLintInput</code> JSON
          object below. Diagnostics, the <code className="font-mono">describe()</code>{" "}
          round-trip, and the rendered output update live.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Input" testId="playground-input-card">
          <textarea
            data-testid="playground-input-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="w-full h-96 font-mono text-xs leading-relaxed border border-slate-300 rounded-md bg-slate-900 text-slate-100 p-3 resize-y focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </Card>

        <Card title="Diagnostics" testId="playground-diag-card">
          {parsed.kind === "error" ? (
            <div
              data-testid="playground-json-error"
              className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2"
            >
              <span className="font-semibold">JSON parse error:</span>{" "}
              {parsed.reason}
            </div>
          ) : (
            <PlaygroundResults value={parsed.value} />
          )}
        </Card>
      </div>

      {parsed.kind === "ok" ? (
        <Card title="Rendered output" testId="playground-render-card">
          <PlaygroundRender value={parsed.value} />
        </Card>
      ) : null}
    </div>
  );
}

function PlaygroundResults({ value }: { value: unknown }) {
  const result = validate(value);
  const desc = describe(value);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          data-testid="playground-status"
          data-status={result.ok ? "ok" : "error"}
          className={
            "text-xs font-mono px-2 py-0.5 rounded " +
            (result.ok
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : "bg-rose-100 text-rose-800 border border-rose-200")
          }
        >
          {result.ok ? "ok" : `${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`}
        </span>
        <span className="text-xs text-slate-600">
          {result.warnings.length} warning
          {result.warnings.length === 1 ? "" : "s"}
        </span>
      </div>
      <DiagnosticList
        errors={result.ok ? [] : result.errors}
        warnings={result.warnings}
        testIdPrefix="playground-diag"
      />
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-600 font-medium">
          describe() output
        </summary>
        <p
          data-testid="playground-description"
          className="mt-2 text-slate-700 italic leading-relaxed"
        >
          {desc.description}
        </p>
      </details>
    </div>
  );
}

function PlaygroundRender({ value }: { value: unknown }) {
  const result = validate(value);
  if (!result.ok) {
    return (
      <p
        data-testid="playground-render-blocked"
        className="text-sm text-slate-600"
      >
        Fix the errors to render. The validator only renders fully-valid
        inputs in this playground (the React adapter would render a fail-open
        fallback in a real app).
      </p>
    );
  }
  const validated = result.input;
  const regionIds = Object.keys(validated.regions ?? {});
  return (
    <div data-testid="playground-render" className="bg-slate-50 rounded-md p-3">
      <SlotLayout
        input={validated}
        className="rounded-md border border-slate-300 bg-white p-2"
        throwOnError={false}
      >
        {regionIds.length === 0 ? (
          <p className="text-sm text-slate-600 px-2 py-1">
            (no regions declared — root only)
          </p>
        ) : (
          regionIds.map((id) => (
            <SlotLayout.Region
              key={id}
              id={id}
              className="border border-slate-300 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800"
            >
              {id}
            </SlotLayout.Region>
          ))
        )}
      </SlotLayout>
    </div>
  );
}
