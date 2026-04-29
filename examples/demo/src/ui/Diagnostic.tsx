import type { Diagnostic } from "tw-layout-lint";

export function DiagnosticView({
  diagnostic,
  testId,
}: {
  diagnostic: Diagnostic;
  testId?: string;
}) {
  const severityColor =
    diagnostic.severity === "error"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return (
    <div
      data-testid={testId}
      data-code={diagnostic.code}
      data-severity={diagnostic.severity}
      className="border border-slate-200 rounded-md bg-white"
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2 border-b border-slate-100">
        <code
          className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${severityColor} border`}
        >
          {diagnostic.code}
        </code>
        <code className="text-xs font-mono text-slate-500 truncate">
          {diagnostic.pathText}
        </code>
      </div>
      <div className="px-3 py-2 space-y-1">
        <p className="text-sm text-slate-800 leading-snug">
          {diagnostic.message}
        </p>
        {diagnostic.hint ? (
          <p className="text-xs text-slate-600 leading-snug">
            <span className="font-semibold text-slate-700">Hint:</span>{" "}
            {diagnostic.hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DiagnosticList({
  errors,
  warnings,
  testIdPrefix,
}: {
  errors?: ReadonlyArray<Diagnostic>;
  warnings?: ReadonlyArray<Diagnostic>;
  testIdPrefix?: string;
}) {
  if ((errors?.length ?? 0) === 0 && (warnings?.length ?? 0) === 0) {
    return (
      <div
        data-testid={testIdPrefix ? `${testIdPrefix}-empty` : undefined}
        className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
      >
        ✓ No diagnostics. Layout is clean.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {errors?.map((e, i) => (
        <DiagnosticView
          key={`${e.code}-${i}`}
          diagnostic={e}
          testId={
            testIdPrefix ? `${testIdPrefix}-error-${i}` : undefined
          }
        />
      ))}
      {warnings?.map((w, i) => (
        <DiagnosticView
          key={`${w.code}-${i}`}
          diagnostic={w}
          testId={
            testIdPrefix ? `${testIdPrefix}-warning-${i}` : undefined
          }
        />
      ))}
    </div>
  );
}
