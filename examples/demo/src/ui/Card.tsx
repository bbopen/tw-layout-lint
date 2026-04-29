import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  tone = "default",
  testId,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  tone?: "default" | "error" | "success" | "muted";
  testId?: string;
}) {
  const toneClass = (
    tone === "error"
      ? "border-rose-200 bg-rose-50"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "muted"
          ? "border-slate-200 bg-slate-100"
          : "border-slate-200 bg-white"
  );
  return (
    <div
      data-testid={testId}
      className={`rounded-lg border ${toneClass} shadow-sm overflow-hidden`}
    >
      {title || subtitle ? (
        <div className="px-4 py-3 border-b border-slate-200">
          {title ? (
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          ) : null}
          {subtitle ? (
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  );
}
