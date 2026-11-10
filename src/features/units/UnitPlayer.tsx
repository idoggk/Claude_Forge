import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, EmptyState, LinkButton, Markdown, ProgressBar, Spinner, useToast } from '@/components/ui';
import { getUnit } from '@/content/units/registry';
import { advance, canAdvance, checkStep, chooseBranch, currentStep, isCurrent, isFrozen, markResumed, newRun, progressOf, runSummary, setAnswer, type MoveResult } from '@/domain/missions/engine';
import { PHASE_LABELS, type ItemStep, type Mission, type MissionRun } from '@/domain/missions/model';
import { gradeItem } from '@/domain/assessment/grade';
import { activeMissionRun, saveMissionRun } from '@/persistence/repo';
import { ItemView } from '@/features/academy/ItemView';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

/**
 * One screen, one action. The player holds the run in state and saves it after every move, so a refresh resumes exactly where
 * the learner was. Everything graded goes through the Academy's own grader. Finishing is practice, never mastery.
 */
export default function UnitPlayer() {
  const { unitId = '' } = useParams();
  const unit = getUnit(unitId);
  const toast = useToast();
  const [run, setRun] = useState<MissionRun | null | undefined>(undefined);
  const [hints, setHints] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [choseNow, setChoseNow] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!unit) return;
    void activeMissionRun(unit.id).then(async (existing) => {
      if (!alive) return;
      if (existing && isCurrent(existing, unit)) {
        const resumed = existing.path.length > 1 || Object.keys(existing.answers).length > 0 ? markResumed(existing, nowIso()) : existing;
        if (resumed !== existing) await saveMissionRun(resumed);
        setRun(resumed);
      } else if (existing) {
        setRun(null); // content changed: tell the learner instead of moving their old run onto different content
      } else {
        const fresh = newRun(unit, newId('mr'), nowIso());
        await saveMissionRun(fresh);
        setRun(fresh);
      }
    });
    return () => { alive = false; };
  }, [unit]);

  useEffect(() => { setHints(0); heading.current?.focus({ preventScroll: false }); }, [run?.stepId, run?.status]);

  const apply = useCallback(async (r: MoveResult) => {
    if (!r.ok) { toast(r.error); return; }
    setRun(r.run);
    const saved = await saveMissionRun(r.run);
    // Storage already holds a newer or frozen state (another tab got there first): show what is stored, not this tab's copy.
    if (saved.frozen.length !== r.run.frozen.length || saved.stepId !== r.run.stepId || saved.status !== r.run.status) {
      setRun(saved);
      toast('This was already answered in another tab. Showing the saved answer.');
    }
  }, [toast]);

  if (!unit) return <EmptyState title="No such learning unit" action={<LinkButton to="/learn">Back to learning</LinkButton>}>That mission or Quick Spark does not exist.</EmptyState>;
  if (run === undefined) return <Spinner label="Opening" />;
  if (run === null) {
    return (
      <EmptyState title="This one was updated" action={<Button variant="primary" onClick={async () => { const fresh = newRun(unit, newId('mr'), nowIso()); await saveMissionRun(fresh); setRun(fresh); }}>Start the updated version</Button>}>
        The content changed since you started. Your earlier progress is kept in your history and has not been altered.
      </EmptyState>
    );
  }
  const now = () => nowIso();
  const step = currentStep(run, unit);
  const prog = progressOf(run, unit);

  if (run.status === 'completed') return <Finished unit={unit} run={run} onAgain={async () => { const fresh = newRun(unit, newId('mr'), now()); await saveMissionRun(fresh); setRun(fresh); }} />;
  if (!step) return <EmptyState title="That step is missing" action={<LinkButton to="/learn">Back to learning</LinkButton>}>The content changed in a way this run cannot follow.</EmptyState>;

  const kindLabel = unit.kind === 'spark' ? 'Quick Spark' : 'Guided mission';
  const last = canAdvance(run, unit) && step.id === unit.steps[unit.steps.length - 1]!.id;

  return (
    <div data-testid={`unit-${unit.id}`} className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="accent">{kindLabel}</Badge>
        <span className="text-muted">about {unit.minutes} min (an estimate)</span>
        <Link to="/learn" className="ml-auto text-muted underline">Leave (your place is saved)</Link>
      </div>
      <h1 className="text-2xl font-semibold" data-testid="unit-title">{unit.title}</h1>
      <div className="mt-2 mb-4"><ProgressBar value={prog.done} max={prog.total} label={`Step ${Math.min(prog.done + 1, prog.total)} of about ${prog.total}`} /><p className="mt-1 text-xs text-muted" data-testid="unit-progress">{PHASE_LABELS[step.phase]} · step {Math.min(prog.done + 1, prog.total)} of about {prog.total}</p></div>

      <div key={step.id} className="step-enter" data-testid={`step-${step.id}`}>
        {step.type === 'read' && (
          <Card aria-labelledby="step-h">
            <h2 id="step-h" ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{step.title}</h2>
            <div className="mt-2"><Markdown>{step.body}</Markdown></div>
            <div className="mt-4"><Button variant="primary" size="lg" onClick={() => void apply(advance(run, unit, now()))} data-testid="step-continue">{step.cta ?? (last ? 'Finish' : 'Continue')}</Button></div>
          </Card>
        )}
        {step.type === 'item' && <ItemScreen unit={unit} run={run} step={step} hints={hints} setHints={setHints} seed={run.id} heading={heading} onAnswer={(v) => void apply(setAnswer(run, unit, step.id, v, now()))} onCheck={() => void apply(checkStep(run, unit, step.id, hints, now()))} onContinue={() => void apply(advance(run, unit, now()))} last={last} />}
        {step.type === 'branch' && (
          <Card aria-labelledby="step-h">
            <h2 id="step-h" ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{step.prompt}</h2>
            {!run.branches[step.id] ? (
              <ul className="mt-3 space-y-2" data-testid="branch-options">{step.options.map((o) => <li key={o.id}><Button className="w-full justify-start text-left" onClick={() => { setChoseNow(step.id); void apply(chooseBranch(run, unit, step.id, o.id, now())); }} data-testid={`branch-${o.id}`}>{o.text}</Button></li>)}</ul>
            ) : (
              <div className="mt-3" role="status" data-testid="branch-consequence" tabIndex={-1} ref={(el) => { if (el && choseNow === step.id) { el.focus(); setChoseNow(null); } }}>
                <p className="rounded-lg border border-line bg-surface2 p-3 text-sm"><strong>You chose: </strong>{step.options.find((o) => o.id === run.branches[step.id])!.text}</p>
                <p className="mt-2 text-sm">{step.options.find((o) => o.id === run.branches[step.id])!.consequence}</p>
                <div className="mt-4"><Button variant="primary" size="lg" onClick={() => void apply(advance(run, unit, now()))} data-testid="step-continue">Continue</Button></div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ItemScreen({ unit, run, step, hints, setHints, seed, heading, onAnswer, onCheck, onContinue, last }: { unit: Mission; run: MissionRun; step: ItemStep; hints: number; setHints: (n: number) => void; seed: string; heading: React.RefObject<HTMLHeadingElement | null>; onAnswer: (v: unknown) => void; onCheck: () => void; onContinue: () => void; last: boolean }) {
  const frozen = isFrozen(run, step.id);
  const answer = run.answers[step.id];
  const grade = frozen ? gradeItem(step.item, answer) : undefined;
  const hasAnswer = answer !== undefined && !(Array.isArray(answer) && answer.length === 0) && !(typeof answer === 'object' && !Array.isArray(answer) && answer !== null && Object.keys(answer).length === 0);
  const hintsAllowed = !step.frozenOnAnswer && !frozen;
  void unit;
  // After "Check my answer" the button disappears; without this, keyboard and screen-reader focus falls back to the page top
  // and, on a phone, the feedback and Continue sit below the fold. Move focus to the feedback, but only when this screen was
  // checked just now, never when a run is resumed already checked.
  const wasFrozen = useRef(frozen);
  useEffect(() => {
    if (frozen && !wasFrozen.current) {
      const el = document.querySelector<HTMLElement>(`[data-testid="feedback-${step.item.id}"]`);
      if (el) { el.tabIndex = -1; el.focus(); }
    }
    wasFrozen.current = frozen;
  }, [frozen, step.item.id]);
  return (
    <div>
      <h2 ref={heading} tabIndex={-1} className="sr-only">{PHASE_LABELS[step.phase]}: {step.item.prompt}</h2>
      {step.frozenOnAnswer && !frozen && <Callout tone="info" title="Independent challenge">No hints here. Your answer is final once you check it, and it is saved as practice. It does not change your competency level.</Callout>}
      <div className={step.frozenOnAnswer && !frozen ? 'mt-3' : ''}>
        <ItemView item={{ ...step.item, hints: hintsAllowed ? step.item.hints : undefined }} index={0} bare value={answer} onChange={onAnswer} disabled={frozen} grade={grade} hintsShown={hints} onHint={hintsAllowed ? () => setHints(hints + 1) : undefined} seed={seed} optionSeed={seed} />
      </div>
      {!frozen && <div className="mt-4"><Button variant="primary" size="lg" disabled={!hasAnswer} onClick={onCheck} data-testid="step-check">Check my answer</Button></div>}
      {frozen && (
        <div className="mt-4 space-y-3">
          {step.reveal && <Callout tone={grade?.correct ? 'ok' : 'info'} title="The idea to keep"><span data-testid="step-reveal">{step.reveal}</span></Callout>}
          <Button variant="primary" size="lg" onClick={onContinue} data-testid="step-continue">{last ? 'Finish' : 'Continue'}</Button>
        </div>
      )}
    </div>
  );
}

function Finished({ unit, run, onAgain }: { unit: Mission; run: MissionRun; onAgain: () => void }) {
  const s = runSummary(run, unit);
  const lesson = unit.lessonId;
  return (
    <div className="mx-auto max-w-3xl" data-testid="unit-finished">
      <h1 className="text-2xl font-semibold">{unit.title}: done</h1>
      <Card aria-labelledby="fin-h" className="mt-4">
        <h2 id="fin-h" className="text-lg font-semibold">What you did</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li data-testid="unit-score">{s.correct} of {s.total} decisions right{s.hintsUsed > 0 ? `, with ${s.hintsUsed} hint${s.hintsUsed === 1 ? '' : 's'}` : ''}.</li>
          {s.predictions.length > 0 && <li data-testid="unit-predictions">Your prediction{s.predictions.length === 1 ? '' : 's'}: {s.predictions.filter((p) => p.result?.correct).length} of {s.predictions.length} right. A wrong prediction is useful: it is what the rest of the mission was for.</li>}
          {s.challenge.map((c) => <li key={c.stepId}>Independent challenge: <strong>{c.result ? (c.result.correct ? 'right' : 'not yet') : 'not answered'}</strong>.</li>)}
          {s.branches.length > 0 && <li>{s.branches.filter((b) => b.better).length} of {s.branches.length} choices were the stronger option.</li>}
        </ul>
        <p className="mt-3 text-sm text-muted">This is practice and it is saved on this device. Finishing quickly does not show understanding, and it does not change your competency level{lesson ? '. That comes only from the lesson\'s own independent assessment' : ''}.</p>
      </Card>
      <Card aria-labelledby="nx-h" className="mt-4">
        <h2 id="nx-h" className="text-lg font-semibold">Where next</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {unit.next.map((n) => <li key={n.to}><Link className="font-semibold text-accent-text underline" to={n.to}>{n.label}</Link></li>)}
          <li><Link className="text-accent-text underline" to="/learn">More to learn</Link></li>
          <li><Link className="text-accent-text underline" to={`/library/new?ref=${lesson ? 'lesson' : 'competency'}&refId=${encodeURIComponent(lesson ?? unit.competencies[0]!)}&label=${encodeURIComponent(unit.title)}`}>Save a takeaway</Link></li>
        </ul>
        <div className="mt-3"><Button size="sm" onClick={onAgain} data-testid="unit-again">Try it again</Button></div>
      </Card>
    </div>
  );
}
