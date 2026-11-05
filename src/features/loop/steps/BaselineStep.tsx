import { Callout, Markdown } from '@/components/ui';
import { CaseRunner } from '../CaseRunner';
import { PackDownload } from '../PackDownload';
import { StepHeading, type StepProps } from './shared';

export function BaselineStep({ bundle }: StepProps) {
  const m = bundle.mission;
  return (
    <div className="space-y-4">
      <StepHeading n={2} title="Baseline: Claude without your Skill">Before you build anything, measure how Claude does on its own. Without a baseline you cannot tell whether your Skill helped or the tasks were just easy.</StepHeading>
      <PackDownload fixtureId={m.fixture.devId} label={m.fixture.devLabel} description={m.labels.packDescription} />
      <ol className="list-decimal space-y-1 pl-5 text-sm">{m.baselineHowTo.map((s) => <li key={s}><Markdown className="inline">{s}</Markdown></li>)}</ol>
      <Callout tone="info" title="Record what happened, not what you hoped">If Claude forgets the answer line, record &ldquo;no usable {m.labels.answerNoun}&rdquo;. Unknown stays unknown, and a missing verdict never counts as a match.</Callout>
      <details className="rounded-lg border border-line p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How to read the evidence</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{m.evidenceHowTo.map((s) => <li key={s}><Markdown className="inline">{s}</Markdown></li>)}</ul>
      </details>
      <CaseRunner bundle={bundle} phase="dev" condition="baseline" conditionLabel="Baseline (no Skill)" cases={m.devCases} />
    </div>
  );
}
