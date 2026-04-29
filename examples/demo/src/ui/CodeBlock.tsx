export function CodeBlock({
  code,
  language = "json",
  testId,
}: {
  code: string;
  language?: "json" | "css" | "tsx" | "text";
  testId?: string;
}) {
  return (
    <pre
      data-testid={testId}
      data-lang={language}
      className="text-xs font-mono leading-relaxed bg-slate-900 text-slate-100 rounded-md p-3 overflow-auto max-h-96 whitespace-pre"
    >
      <code>{code}</code>
    </pre>
  );
}
