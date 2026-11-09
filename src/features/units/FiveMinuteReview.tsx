import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Card, LinkButton, PageHeader, ProgressBar, Spinner, useToast } from '@/components/ui';
import { gradeItem } from '@/domain/assessment/grade';
import { formatDateKey, todayKey } from '@/lib/clock';
import { startFiveMinuteReview, submitFiveMinuteReview, type FiveMinuteSession } from '@/persistence/repo';
import { ItemView } from '@/features/academy/ItemView';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { useNextChallenge } from './useNextChallenge';

const REASON: Record<string, string> = { misconception: 'A belief you chose before', mistake: 'You missed this before', interleaved: 'Mixed in', progression: 'Right difficulty', rotation: 'A fresh question' };
type Saved = { lessonId: string; outcome: 'pass' | 'partial' | 'fail'; dueOn: string; score: number }[];

/**
 * A short spaced review. About five minutes is a target, not a timer: there is no countdown and nothing happens if you take
 * longer. One question at a time, immediate feedback, and a checked answer is final. It saves through the same review rules as
 * a full review, so hints stop a pass from advancing your schedule.
 */
export default function FiveMinuteReview() {
  const toast = useToast();
  const [session, setSession] = useState<FiveMinuteSession | null | undefined>(undefined);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hints, setHints] = useState<Record<string, number>>({});
  const [shown, setShown] = useState(0);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [startedAt] = useState(() => nowIso());
  const [seed] = useState(() => newId('rv'));
  const next = useNextChallenge({ ignoreDue: true });

  useEffect(() => { void startFiveMinuteReview(todayKey()).then(setSession); }, []);

  if (session === undefined) return <Spinner label="Choosing your questions" />;
  if (session === null) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="review5-empty">
        <PageHeader eyebrow="Review" title="Nothing is due" subtitle="Reviews appear after you pass an assessment, and come back on a schedule. Nothing to do right now." />
        <Card aria-labelledby="r5-alt"><h2 id="r5-alt" className="text-lg font-semibold">Something relevant instead</h2>
          {next ? <><p className="mt-1 text-sm">{next.challenge.title}</p><p className="text-sm text-muted">{next.challenge.why}</p><div className="mt-3"><LinkButton to={next.challenge.to} variant="primary">{next.challenge.label}</LinkButton></div></> : <Spinner label="Looking" />}
        </Card>
      </div>
    );
  }
  const items = session.items;
  const cur = items[i]!;
  const isChecked = checked.has(cur.item.id);
  const grade = isChecked ? gradeItem(cur.item, answers[cur.item.id]) : undefined;
  const has = answers[cur.item.id] !== undefined && !(Array.isArray(answers[cur.item.id]) && (answers[cur.item.id] as unknown[]).length === 0);

  const finish = async () => {
    const out = await submitFiveMinuteReview({ items, answers, hintsByLesson: hints, startedAt });
    setSaved(out);
    toast('Review saved');
  };

  if (saved) {
    const results = items.map((x) => ({ x, g: gradeItem(x.item, answers[x.item.id]) }));
    const right = results.filter((r) => r.g.correct).length;
    return (
      <div className="mx-auto max-w-3xl" data-testid="review5-summary">
        <PageHeader eyebrow="Review" title="Review done" subtitle={`${right} of ${items.length} right. A short review is a check on what you remember, not a measure of mastery.`} />
        <Card aria-labelledby="r5-res"><h2 id="r5-res" className="text-lg font-semibold">What happened</h2>
          <ul className="mt-2 space-y-2 text-sm">{results.map(({ x, g }) => <li key={x.item.id} className="flex flex-wrap items-baseline gap-2"><Badge tone={g.correct ? 'ok' : 'warn'}>{g.correct ? 'Right' : 'Not yet'}</Badge><span className="min-w-0 flex-1"><span className="text-muted">{x.lessonTitle}:</span> {x.item.prompt.slice(0, 110)}{x.item.prompt.length > 110 ? '…' : ''}{!g.correct && <span className="block text-muted">{x.item.explanation}</span>}</span></li>)}</ul>
        </Card>
        <Card aria-labelledby="r5-next" className="mt-4"><h2 id="r5-next" className="text-lg font-semibold">Next</h2>
          <ul className="mt-2 space-y-1 text-sm">{saved.map((s) => <li key={s.lessonId}>{items.find((x) => x.lessonId === s.lessonId)?.lessonTitle}: {s.outcome === 'pass' ? 'passed, so the gap before the next review grows' : s.outcome === 'partial' ? 'kept at the same interval' : 'back to a short interval'}. Next review {formatDateKey(s.dueOn)}.</li>)}</ul>
          {Object.values(hints).some((n) => n > 0) && <p className="mt-2 text-xs text-muted">You used hints, so a pass did not advance your schedule and this review is recorded as guided.</p>}
          <div className="mt-3 flex flex-wrap gap-2"><LinkButton to="/" variant="primary">Back to Mission Control</LinkButton>{session.remainingDue > 0 && <LinkButton to="/review5" onClick={() => window.location.reload()}>Another short review ({session.remainingDue} more due)</LinkButton>}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl" data-testid="review5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge tone="accent">Review</Badge><span className="text-muted">about 5 minutes, at your own pace</span><Link to="/" className="ml-auto text-muted underline">Leave</Link></div>
      <h1 className="text-2xl font-semibold">Review for 5 minutes</h1>
      <div className="mt-2 mb-4"><ProgressBar value={i + (isChecked ? 1 : 0)} max={items.length} label={`Question ${i + 1} of ${items.length}`} /><p className="mt-1 text-xs text-muted" data-testid="review5-progress">Question {i + 1} of {items.length} · <span title="why this was chosen">{REASON[cur.reason] ?? 'Chosen for you'}</span></p></div>
      <ItemView key={cur.item.id} item={{ ...cur.item, hints: isChecked ? undefined : cur.item.hints }} index={i} bare value={answers[cur.item.id]} onChange={(v) => setAnswers((a) => ({ ...a, [cur.item.id]: v }))} disabled={isChecked} grade={grade} hintsShown={shown} onHint={() => { setShown((n) => n + 1); setHints((h) => ({ ...h, [cur.lessonId]: (h[cur.lessonId] ?? 0) + 1 })); }} seed={seed} optionSeed={`${seed}:${cur.item.id}`} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isChecked ? <Button variant="primary" size="lg" disabled={!has} onClick={() => setChecked((c) => new Set(c).add(cur.item.id))} data-testid="review5-check">Check my answer</Button>
          : i < items.length - 1 ? <Button variant="primary" size="lg" onClick={() => { setI(i + 1); setShown(0); }} data-testid="review5-next">Next question</Button>
          : <Button variant="primary" size="lg" onClick={() => void finish()} data-testid="review5-finish">Finish and save</Button>}
      </div>
      <div className="mt-3"><Callout tone="info" title="Final once checked">A checked answer cannot change. Hints are allowed, but they mean this review is recorded as guided and a pass will not advance your schedule.</Callout></div>
    </div>
  );
}
