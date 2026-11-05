import { useState } from 'react';
import { Button, Callout, Card, useToast } from '@/components/ui';
import { ComparisonView } from '@/features/battle-lab/ComparisonView';
import { failureSignals, matchStats } from '@/domain/loop/engine';
import { FAILURE_PATTERNS } from '@/domain/loop/types';
import { gradeDevSet, toContext } from '@/persistence/loopRepo';
import { MatchSummary } from '../MatchSummary';
import { StepHeading, type StepProps } from './shared';

export function EvaluateStep({ bundle, goto }: StepProps) {
  const { loop, mission, dev } = bundle;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!dev) return null;
  const graded = loop.devGradedAt !== null;
  const stats = matchStats(dev, mission.devCases.map((c) => c.id));
  const base = stats.find((s) => s.conditionId === loop.conditionIds.baseline);
  const v1 = stats.find((s) => s.conditionId === loop.conditionIds.v1);
  const signals = graded ? failureSignals(toContext(bundle)) : [];

  let reading = '';
  if (graded && base && v1) {
    if (v1.matched > base.matched) reading = `With the Skill, ${v1.matched} of ${v1.graded} ${mission.labels.answerNoun}s matched the ${mission.labels.truthShort} against ${base.matched} of ${base.graded} for the baseline. With ${mission.devCases.length} proposals and one run each this is a directional observation, not proof.`;
    else if (v1.matched === base.matched) reading = `The Skill and the baseline matched the ${mission.labels.truthShort} equally often (${v1.matched} of ${v1.graded}). Verdict accuracy did not move on these proposals - the checklist and rework numbers below may still differ.`;
    else reading = `The baseline matched the ${mission.labels.truthShort} more often (${base.matched} of ${base.graded}) than the Skill (${v1.matched} of ${v1.graded}). That is a real result: the Skill may be making Claude worse. Look at the failure signals below.`;
  }

  return (
    <div className="space-y-4">
      <StepHeading n={5} title="Evaluate the difference">Forge compares each {mission.labels.answerNoun} you recorded with the {mission.labels.truthShort} ground truth. Nothing is graded until you ask.</StepHeading>
      {!graded ? (
        <Card className="space-y-3">
          <p className="text-sm">All development runs are recorded. When you grade, the {mission.labels.truthShort}&apos;s {mission.labels.answerNoun} for each {mission.labels.caseNoun} is revealed and compared with what you recorded. Corrections to a run afterwards are re-graded automatically.</p>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <Button variant="primary" disabled={busy} data-testid="grade-dev" onClick={async () => { setBusy(true); setErr(null); try { await gradeDevSet(loop.id); toast('Graded against the simulation'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not grade'); } finally { setBusy(false); } }}>Grade against ground truth</Button>
        </Card>
      ) : (
        <>
          <Callout tone="info" title="What the numbers say" role="status"><p data-testid="eval-reading">{reading}</p></Callout>
          <MatchSummary exp={dev} mission={mission} cases={mission.devCases} reveal showWhy />
          <section aria-labelledby="signals-h" className="space-y-2">
            <h3 id="signals-h" className="text-lg font-semibold">Failure signals from your own data</h3>
            {signals.length === 0 ? (
              <p className="text-sm text-muted">Your recorded data does not point at a specific failure pattern. That can mean the Skill works, or that you did not tick the checklist, record activation or count rework - signals only come from what you recorded. You can still pick a pattern yourself in the next step if you read something in the answers.</p>
            ) : (
              <ul className="space-y-2" data-testid="failure-signals">
                {signals.map((s) => {
                  const p = FAILURE_PATTERNS.find((x) => x.id === s.patternId)!;
                  return <Card as="li" key={s.patternId}><p className="font-semibold">{p.label}</p><p className="text-sm">{s.evidence}</p><p className="mt-1 text-sm text-muted">Possible fix: {p.fix}</p></Card>;
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="cmp-h" className="space-y-2">
            <h3 id="cmp-h" className="text-lg font-semibold">Full comparison</h3>
            <ComparisonView experiment={dev} seededTotal={mission.checklist.length} />
          </section>
          <Button variant="primary" icon="arrow" onClick={() => goto('improve')} data-testid="goto-improve">Improve the Skill</Button>
        </>
      )}
    </div>
  );
}
