import { describe, validate } from "tw-layout-lint";
import { SlotLayout } from "tw-layout-lint/react";
import { Card } from "../ui/Card.js";
import { CodeBlock } from "../ui/CodeBlock.js";
import {
  CANONICAL_EXAMPLES,
  type CanonicalExample,
} from "../layouts/canonical-examples.js";

export function Gallery() {
  return (
    <div className="space-y-8" data-testid="gallery-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Gallery</h1>
        <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
          Every documented Skill.md pattern, rendered live. Each card shows
          the JSON, the rendered layout, and the{" "}
          <code className="font-mono">describe()</code> round-trip text.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CANONICAL_EXAMPLES.map((example) => (
          <ExampleCard key={example.id} example={example} />
        ))}
      </div>
    </div>
  );
}

function ExampleCard({ example }: { example: CanonicalExample }) {
  const validation = validate(example.input);
  const description = describe(example.input);

  return (
    <Card
      title={example.title}
      subtitle={example.description}
      testId={`gallery-${example.id}`}
    >
      <div className="space-y-3">
        {/* Render */}
        <div
          data-testid={`gallery-${example.id}-render`}
          className="bg-slate-50 rounded-md p-3"
        >
          <SlotLayout
            input={example.input}
            className="rounded-md border border-slate-300 bg-white p-2"
            throwOnError={false}
          >
            {Object.keys(example.regions).map((id) => (
              <SlotLayout.Region
                key={id}
                id={id}
                className="border border-slate-300 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800"
              >
                {example.regions[id]}
              </SlotLayout.Region>
            ))}
          </SlotLayout>
        </div>

        {/* Status */}
        {validation.ok ? (
          <p
            data-testid={`gallery-${example.id}-status`}
            data-status="ok"
            className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
          >
            ✓ Validates clean. {validation.warnings.length} warning
            {validation.warnings.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p
            data-testid={`gallery-${example.id}-status`}
            data-status="error"
            className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1"
          >
            ✗ Failed validation: {validation.errors.length} error
            {validation.errors.length === 1 ? "" : "s"}.
          </p>
        )}

        {/* describe round-trip */}
        {description.ok ? (
          <p
            data-testid={`gallery-${example.id}-describe`}
            className="text-xs text-slate-600 italic leading-relaxed"
          >
            describe(): {description.description}
          </p>
        ) : null}

        <details className="text-xs">
          <summary className="cursor-pointer text-slate-600 font-medium">
            Show LayoutLintInput JSON
          </summary>
          <div className="mt-2">
            <CodeBlock
              code={JSON.stringify(example.input, null, 2)}
              testId={`gallery-${example.id}-json`}
            />
          </div>
        </details>
      </div>
    </Card>
  );
}
