import { useState } from 'react';
import { Badge, Button, Callout, Card, LinkButton, useToast } from '@/components/ui';
import { generateSkillMd } from '@/domain/skills/generate';
import { freezeRequirements } from '@/domain/loop/engine';
import { createLoopSkill, freezeV1, revisionOf } from '@/persistence/loopRepo';
import { RequirementList, StepHeading, type StepProps } from './shared';

export function BuildStep({ bundle, goto }: StepProps) {
  const { loop, mission, skill, dev } = bundle;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqs = freezeRequirements(skill);
  const v1 = revisionOf(skill, loop.v1?.revisionId);

  // What YOUR baseline showed, per checklist item. Only runs where you assessed the checklist count.
  const base = dev?.runs.filter((r) => r.conditionId === loop.conditionIds.baseline && r.seededFound !== null) ?? [];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setErr(null);
    try { await fn(); toast(ok); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <StepHeading n={3} title="Build the Skill (v1)">Write the first version of your Skill from what your baseline showed. When it validates and has trigger scenarios on both sides, freeze it: v1 becomes the fixed starting point for the whole experiment.</StepHeading>

      <Card>
        <h3 className="font-semibold">What your baseline showed</h3>
        {base.length === 0 ? (
          <p className="mt-1 text-sm text-muted">You did not assess the checklist for any baseline run, so there is nothing to learn from yet. That is fine - you can still build v1 - but the next time, tick the checklist while you record.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm" data-testid="baseline-observations">
            {mission.checklist.map((c) => {
              const met = base.filter((r) => (r.seededFound ?? []).includes(c.id)).length;
              return <li key={c.id}>{c.text}: <strong>{met} of {base.length}</strong> baseline answers</li>;
            })}
          </ul>
        )}
      </Card>

      {!skill ? (
        <Card className="space-y-3">
          <p className="text-sm">{mission.starterNote}</p>
          <Button variant="primary" onClick={() => void run(() => createLoopSkill(loop.id), 'Draft created from the starter')} disabled={busy} data-testid="create-skill">Create my draft from the starter</Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-semibold">{skill.name}</p><p className="text-sm text-muted">{loop.v1 ? 'v1 is frozen. Edits to the draft no longer change v1.' : 'Your draft. Edit it in the Workshop, then come back here to freeze it.'}</p></div>
              <LinkButton to={`/workshop/${skill.id}?loop=${loop.id}`} variant={loop.v1 ? 'secondary' : 'primary'} icon="hammer" data-testid="open-workshop">{loop.v1 ? 'View in the Workshop' : 'Edit in the Skill Workshop'}</LinkButton>
            </div>
            <p className="text-sm text-muted">{mission.starterNote}</p>
          </Card>

          {!loop.v1 && (
            <Card className="space-y-3">
              <h3 className="font-semibold">Ready to freeze v1?</h3>
              <RequirementList items={reqs} label="Freeze requirements" />
              {err && <p role="alert" className="text-sm text-bad">{err}</p>}
              <Button variant="primary" disabled={busy || reqs.some((r) => !r.ok)} onClick={() => void run(() => freezeV1(loop.id), 'v1 frozen')} data-testid="freeze-v1">Freeze v1 and continue</Button>
              <p className="text-xs text-muted">Freezing snapshots the Skill so you cannot quietly change it between the test and the evaluation.</p>
            </Card>
          )}
        </>
      )}

      {loop.v1 && v1 && (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="ok">v1 frozen {loop.v1.frozenAt.slice(0, 10)}</Badge><Badge>{loop.v1.label}</Badge></div>
          <details><summary className="cursor-pointer text-sm font-semibold">View frozen SKILL.md</summary><pre tabIndex={0} className="code-scroll mt-2 max-h-96 text-xs">{generateSkillMd(v1.snapshot)}</pre></details>
          <Button variant="primary" icon="arrow" onClick={() => goto('test')} data-testid="goto-test">Test Skill v1</Button>
        </Card>
      )}
      {skill && !loop.v1 && <Callout tone="info" title="Keep it a hypothesis">Resist solving everything now. Write what you believe will help, freeze it, and let the recorded results tell you what to fix.</Callout>}
    </div>
  );
}
