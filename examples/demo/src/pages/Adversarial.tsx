import { describe, validate } from "tw-layout-lint";
import { SlotLayout } from "tw-layout-lint/react";
import { Card } from "../ui/Card.js";
import { CodeBlock } from "../ui/CodeBlock.js";
import { DiagnosticList } from "../ui/Diagnostic.js";
import {
  ADVERSARIAL_SCENARIOS,
  type AdversarialScenario,
} from "../layouts/adversarial-examples.js";

export function Adversarial() {
  return (
    <div className="space-y-8" data-testid="adversarial-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Adversarial showcase
        </h1>
        <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
          Each row tells the same story: an LLM emits a structurally-tempting
          but broken layout, the validator returns a stable diagnostic code
          and an actionable hint, and the agent applies a single mechanical
          repair to converge on a working layout — usually in one shot.
        </p>
        <p className="text-xs text-slate-500 max-w-3xl">
          Every diagnostic shown here is generated live by{" "}
          <code className="font-mono">validate()</code>. Every "after" panel
          is rendered by the production{" "}
          <code className="font-mono">&lt;SlotLayout&gt;</code> React adapter
          against a real Tailwind v4 build.
        </p>
      </header>

      <div className="space-y-12">
        {ADVERSARIAL_SCENARIOS.map((scenario) => (
          <ScenarioRow key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}

function ScenarioRow({ scenario }: { scenario: AdversarialScenario }) {
  const beforeResult = validate(scenario.before);
  const afterResult = validate(scenario.after);
  const afterDescription = describe(scenario.after);

  return (
    <section
      data-testid={`scenario-${scenario.id}`}
      className="space-y-4"
    >
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">
            {scenario.id}
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            {scenario.title}
          </h2>
        </div>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">Intent:</span>{" "}
          {scenario.intent}
        </p>
        <p className="text-sm text-slate-600 max-w-3xl">
          <span className="font-medium text-slate-700">Why an LLM gets this wrong:</span>{" "}
          {scenario.llmFault}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BEFORE */}
        <Card
          title="Before — broken attempt"
          subtitle="What the LLM emitted"
          tone="error"
          testId={`scenario-${scenario.id}-before`}
        >
          <div className="space-y-3">
            <CodeBlock
              code={JSON.stringify(scenario.before, null, 2)}
              testId={`scenario-${scenario.id}-before-input`}
            />
            <DiagnosticList
              errors={beforeResult.ok ? [] : beforeResult.errors}
              warnings={
                beforeResult.ok ? beforeResult.warnings : beforeResult.warnings
              }
              testIdPrefix={`scenario-${scenario.id}-before-diag`}
            />
          </div>
        </Card>

        {/* AFTER */}
        <Card
          title="After — repaired"
          subtitle="What the agent emitted on retry"
          tone="success"
          testId={`scenario-${scenario.id}-after`}
        >
          <div className="space-y-3">
            <CodeBlock
              code={JSON.stringify(scenario.after, null, 2)}
              testId={`scenario-${scenario.id}-after-input`}
            />
            {afterResult.ok ? (
              <p
                data-testid={`scenario-${scenario.id}-after-ok`}
                className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
              >
                ✓ Validates clean. {afterResult.warnings.length} warning
                {afterResult.warnings.length === 1 ? "" : "s"}.
              </p>
            ) : (
              <DiagnosticList
                errors={afterResult.errors}
                warnings={afterResult.warnings}
                testIdPrefix={`scenario-${scenario.id}-after-diag`}
              />
            )}
            <RenderPreview scenario={scenario} />
            {afterDescription.ok ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-600 font-medium">
                  describe() round-trip
                </summary>
                <p className="mt-2 text-slate-700 italic leading-relaxed">
                  {afterDescription.description}
                </p>
              </details>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}

function RenderPreview({ scenario }: { scenario: AdversarialScenario }) {
  const regionContent = scenario.regions ?? {};
  const regionIds = Object.keys(scenario.after.regions ?? {});
  return (
    <div
      data-testid={`scenario-${scenario.id}-preview`}
      className="border border-slate-200 rounded-md p-3 bg-slate-50"
    >
      <p className="text-xs font-mono text-slate-500 mb-2">Rendered output:</p>
      <SlotLayout
        input={scenario.after}
        className="rounded-md border border-slate-300 bg-white p-2"
        throwOnError={false}
      >
        {regionIds.length === 0 ? (
          <p className="text-sm text-slate-700">
            (single root layout — no regions)
          </p>
        ) : (
          regionIds.map((id) => (
            <SlotLayout.Region
              key={id}
              id={id}
              className="border border-slate-300 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800"
            >
              {regionContent[id] ?? id}
            </SlotLayout.Region>
          ))
        )}
      </SlotLayout>
    </div>
  );
}
