import { useState } from 'react';
import { Badge, Button, Callout, Card, LinkButton, TextArea, TextInput, useToast } from '@/components/ui';
import { SkillDiffView } from '@/features/workshop/SkillDiffView';
import { contentOf } from '@/domain/skills/model';
import { failureSignals, improvementRequirements, patternLabel } from '@/domain/loop/engine';
import { FAILURE_PATTERNS } from '@/domain/loop/types';
import { revisionOf, saveImprovement, toContext } from '@/persistence/loopRepo';
import { RequirementList, StepHeading, useSessionDraft, type StepProps } from './shared';

export function ImproveStep({ bundle, goto }: StepProps) {
  const { loop, skill } = bundle;
  const toast = useToast();
  const key = `forge-loop-improve-${loop.id}`;
  const [patternIds, setPatternIds] = useSessionDraft<string[]>(`${key}-patterns`, []);
  const [hypothesis, setHypothesis] = useSessionDraft<string>(`${key}-hyp`, '');
  const [expected, setExpected] = useSessionDraft<string>(`${key}-exp`, '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signals = failureSignals(toContext(bundle));
  const v1 = revisionOf(skill, loop.v1?.revisionId);
  const v2 = revisionOf(skill, loop.improvement?.v2RevisionId);

  if (loop.improvement && v1 && v2) {
    return (
      <div className="space-y-4">
        <StepHeading n={6} title="Improvement saved (v2)">v2 is frozen. The held-out test compares v1 with v2 on {bundle.mission.labels.caseNounPlural} you have not tuned against.</StepHeading>
        <Card className="space-y-2">
          <div className="flex flex-wrap gap-2">{loop.improvement.patternIds.map((p) => <Badge key={p} tone="accent">{patternLabel(p)}</Badge>)}</div>
          <p className="text-sm"><strong>Hypothesis.</strong> {loop.improvement.hypothesis}</p>
          <p className="text-sm"><strong>Expected change.</strong> {loop.improvement.expectedChange}</p>
        </Card>
        <SkillDiffView before={v1.snapshot} after={v2.snapshot} beforeLabel="v1" afterLabel="v2" />
        <Button variant="primary" icon="arrow" onClick={() => goto('heldout')} data-testid="goto-heldout">Run the held-out test</Button>
      </div>
    );
  }

  const input = { patternIds, hypothesis, expectedChange: expected };
  const reqs = improvementRequirements(loop, skill, input);
  const toggle = (id: string) => setPatternIds(patternIds.includes(id) ? patternIds.filter((x) => x !== id) : [...patternIds, id]);
  const signalIds = new Set(signals.map((s) => s.patternId));
  const ordered = [...FAILURE_PATTERNS].sort((a, b) => Number(signalIds.has(b.id)) - Number(signalIds.has(a.id)));

  return (
    <div className="space-y-4">
      <StepHeading n={6} title="Improve with a hypothesis">Change the Skill because of something you observed, say why you expect it to help, and say what you expect to change. A revision without a hypothesis is just a guess you cannot learn from.</StepHeading>

      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">1. What went wrong? <span className="text-sm font-normal text-muted">Pick the failure pattern(s) you observed.</span></legend>
        <ul className="grid gap-2 md:grid-cols-2">
          {ordered.map((p) => {
            const sig = signals.find((s) => s.patternId === p.id);
            const on = patternIds.includes(p.id);
            return (
              <li key={p.id} className={`rounded-lg border p-3 ${on ? 'border-accent bg-surface2' : 'border-line'}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={on} onChange={() => toggle(p.id)} data-testid={`pattern-${p.id}`} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.label} {sig && <Badge tone="warn" title="Your recorded data points at this pattern">in your data</Badge>}</span>
                    <span className="block text-sm text-muted">{sig ? sig.evidence : p.signal}</span>
                    {on && <span className="mt-1 block text-sm">Possible fix: {p.fix}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">2. Hypothesis and expected change</h3>
        <TextArea label="Hypothesis: what will you change, and why will it help?" rows={3} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Example: Claude only sometimes runs the simulation. Making the run a required step before any verdict should raise verdict accuracy and the share of answers quoting stage numbers." data-testid="hypothesis" />
        <TextInput label="What measurable change do you expect on the held-out set?" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Example: more held-out verdicts match the simulation; every answer cites stage numbers" data-testid="expected-change" />
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">3. Revise the Skill</h3>
        <p className="text-sm text-muted">Edit the Skill in the Workshop. Your hypothesis is kept while you are away. Come back here and the comparison with v1 below updates.</p>
        {skill && <LinkButton to={`/workshop/${skill.id}?loop=${loop.id}`} icon="hammer" variant="primary" data-testid="open-workshop">Edit in the Skill Workshop</LinkButton>}
        {skill && v1 && <SkillDiffView before={v1.snapshot} after={contentOf(skill)} beforeLabel="v1" afterLabel="your revision" />}
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">4. Save as v2</h3>
        <RequirementList items={reqs} label="Improvement requirements" />
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <Button variant="primary" disabled={busy || reqs.some((r) => !r.ok)} data-testid="save-improvement" onClick={async () => {
          setBusy(true); setErr(null);
          try { await saveImprovement(loop.id, input); toast('v2 saved; held-out test unlocked'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
        }}>Save v2 and unlock the held-out test</Button>
      </Card>
      <Callout tone="info" title="One change at a time teaches more">If you change five things and the result improves, you will not know which one mattered. The report records what you changed and what you expected.</Callout>
    </div>
  );
}
