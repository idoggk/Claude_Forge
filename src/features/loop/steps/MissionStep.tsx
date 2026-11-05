import { Link } from 'react-router-dom';
import { Button, Callout, Card, Markdown } from '@/components/ui';
import { getLesson } from '@/content/lessons';
import { LOOP_STEPS, STEP_LABELS } from '@/domain/loop/types';
import { StepHeading, type StepProps } from './shared';

export function MissionStep({ bundle, goto }: StepProps) {
  const m = bundle.mission;
  return (
    <div className="space-y-4">
      <StepHeading n={1} title={m.title}>{m.tagline}</StepHeading>

      <Card>
        <h3 className="font-semibold">The loop you are about to run</h3>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {LOOP_STEPS.map((s, i) => <li key={s}><span className="font-semibold">{i + 1}. {STEP_LABELS[s].label}</span></li>)}
        </ol>
        <p className="mt-2 text-sm text-muted">Skills are hypotheses. You will measure Claude with and without your Skill on the same tasks, change one thing because of what you saw, then test the change on tasks the Skill was not tuned for. Claude Forge does not run Claude: you run the tasks in your own Claude Code and record what happened. Forge keeps the method honest and checks what you record against ground truth computed deterministically from the fixture.</p>
      </Card>

      <Card>
        <h3 className="font-semibold">The problem</h3>
        <Markdown className="prose-forge mt-2">{m.problem}</Markdown>
        <Markdown className="prose-forge mt-2 text-sm">{`**Why it matters.** ${m.whyItMatters}`}</Markdown>
        <Markdown className="prose-forge mt-2 text-sm">{`**Target outcome.** ${m.targetOutcome}`}</Markdown>
        <Markdown className="prose-forge mt-2 text-sm">{`**Skill concept.** ${m.skillConcept}`}</Markdown>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Success criteria</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{m.successCriteria.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="mt-2 text-xs text-muted">Written before any run. They cannot be edited after you start recording.</p>
        </Card>
        <Card>
          <h3 className="font-semibold">Recommended first</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {m.prerequisites.map((id) => {
              const l = getLesson(id);
              return <li key={id}>{l ? <Link className="text-accent-text underline" to={`/academy/lesson/${l.id}`}>{l.title}</Link> : id}</li>;
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Not enforced. You can run the loop first and come back.</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold">How ground truth works</h3>
        <p className="mt-1 text-sm text-muted">{m.labels.howTruthWorks}</p>
        <Markdown className="prose-forge mt-2">{m.designTargets}</Markdown>
      </Card>

      <Callout tone="info" title="What you need">Claude Code on your machine, Node 22+, and about 40–90 minutes. Everything you record stays on this device.</Callout>
      <Button variant="primary" size="lg" icon="arrow" onClick={() => goto('baseline')} data-testid="goto-baseline">Start with the baseline</Button>
    </div>
  );
}
