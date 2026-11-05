import { useState } from 'react';
import { Badge, Button, Callout, Card, ConfirmButton, useToast } from '@/components/ui';
import { ComparisonView } from '@/features/battle-lab/ComparisonView';
import { coverage, heldoutReady } from '@/domain/loop/engine';
import { heldoutReading } from '@/domain/loop/report';
import { revealHeldout, revisionOf, toContext } from '@/persistence/loopRepo';
import { CaseRunner } from '../CaseRunner';
import { MatchSummary } from '../MatchSummary';
import { PackDownload } from '../PackDownload';
import { SkillZipButton } from '../SkillZipButton';
import { StepHeading, type StepProps } from './shared';

export function HeldoutStep({ bundle, goto }: StepProps) {
  const { loop, mission, skill, heldout } = bundle;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v1 = revisionOf(skill, loop.v1?.revisionId);
  const v2 = revisionOf(skill, loop.improvement?.v2RevisionId);
  if (!heldout) return null;
  const ready = heldoutReady(toContext(bundle));
  const ids = mission.heldoutCases.map((c) => c.id);
  const revealed = loop.heldoutRevealedAt !== null;
  const c1 = coverage(heldout, loop.heldoutConditionIds.v1, ids);
  const c2 = coverage(heldout, loop.heldoutConditionIds.v2, ids);

  return (
    <div className="space-y-4">
      <StepHeading n={7} title={`Held-out test: does it hold up on ${mission.labels.caseNounPlural} you did not tune against?`}>{revealed ? 'The ground truth is revealed and these runs are locked.' : 'Ground truth for these proposals stays hidden until every run is recorded.'}</StepHeading>

      {!revealed && (
        <>
          <Callout tone="warn" title="Why a held-out set matters">{mission.heldoutWhy}</Callout>
          <div className="flex flex-wrap items-start gap-3">
            <SkillZipButton content={v1?.snapshot} label="Download Skill v1 (ZIP)" suffix="v1" testId="download-v1-heldout" />
            <SkillZipButton content={v2?.snapshot} label="Download Skill v2 (ZIP)" suffix="v2" testId="download-v2" />
          </div>
          <PackDownload fixtureId={mission.fixture.heldoutId} label={mission.fixture.heldoutLabel} description={mission.labels.packDescription} />
          <Callout tone="info" title="Keep the conditions clean">Use a fresh copy of the held-out fixture for each condition, with only that version of the Skill installed. Do not run v1 and v2 in the same folder - the second would see the first&apos;s files.</Callout>
          <CaseRunner bundle={bundle} phase="heldout" condition="v1" conditionLabel="Skill v1" cases={mission.heldoutCases} />
          <CaseRunner bundle={bundle} phase="heldout" condition="v2" conditionLabel="Skill v2" cases={mission.heldoutCases} />
          <Card className="space-y-3">
            <h3 className="font-semibold">Reveal the ground truth</h3>
            <p className="text-sm text-muted">Revealing grades every held-out run against the {mission.labels.truthShort} and <strong>locks</strong> them. After that you cannot change a recorded run - that is what makes the result trustworthy.</p>
            <p className="text-sm" data-testid="heldout-progress">v1: {c1.recorded.length}/{ids.length} recorded · v2: {c2.recorded.length}/{ids.length} recorded</p>
            {!ready.ready && <ul className="list-disc pl-5 text-sm text-muted">{ready.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <ConfirmButton label="Reveal ground truth and lock runs" confirmLabel="Yes, reveal and lock" icon="lock" size="md" onConfirm={async () => { if (!ready.ready) { setErr(ready.missing.join('; ')); return; } setBusy(true); setErr(null); try { await revealHeldout(loop.id); toast('Revealed and locked'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not reveal'); } finally { setBusy(false); } }} />
            {busy && <span className="text-sm text-muted">Grading…</span>}
          </Card>
        </>
      )}

      {revealed && (
        <>
          <Badge tone="ok">revealed {loop.heldoutRevealedAt!.slice(0, 10)}</Badge>
          <Callout tone="info" title="Reading the result honestly" role="status">
            {heldoutReading(bundle).map((l) => <p key={l} data-testid="heldout-reading">{l}</p>)}
          </Callout>
          <MatchSummary exp={heldout} mission={mission} cases={mission.heldoutCases} reveal showWhy />
          <ComparisonView experiment={heldout} seededTotal={mission.checklist.length} />
          <Button variant="primary" icon="arrow" onClick={() => goto('graduate')} data-testid="goto-graduate">Write up and graduate</Button>
        </>
      )}
    </div>
  );
}
