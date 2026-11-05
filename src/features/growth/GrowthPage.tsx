import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES, COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { LEVEL_NAMES, evaluateCompetencies } from '@/domain/mastery/competency';
import { dueReviews } from '@/domain/mastery/review';
import { summarizeCalibration, calibrationVerdict } from '@/domain/assessment/calibration';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, ProgressBar, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { useExperiments, useLearning } from '@/app/hooks';
import { addFieldEvidence, deleteFieldEvidence } from '@/persistence/repo';
import { formatDateKey, formatIso, todayKey } from '@/lib/clock';
import { ArsenalNav } from '@/features/arsenal/ArsenalPage';

function FieldForm() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [date, setDate] = useState(todayKey());
  const [desc, setDesc] = useState('');
  const [outcome, setOutcome] = useState('');
  const [artifact, setArtifact] = useState('');
  const [comps, setComps] = useState<string[]>([]);
  const [err, setErr] = useState('');
  return (
    <Card>
      <h3 className="font-semibold">Log real-work application</h3>
      <p className="mt-1 text-sm text-muted">The only route to <strong>Field-proven</strong>. It is <strong>self-reported</strong> - Claude Forge cannot verify it - and it only counts for competencies where you already hold Independent application.</p>
      <form className="mt-3 grid gap-3" onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !desc.trim()) return setErr('Add a title and describe what you did.');
        if (comps.length === 0) return setErr('Tag at least one competency.');
        setErr('');
        await addFieldEvidence({ competencyIds: comps, title: title.trim(), project: project.trim(), date, description: desc.trim(), outcome: outcome.trim(), artifactNote: artifact.trim() });
        toast('Field evidence saved');
        setTitle(''); setDesc(''); setOutcome(''); setArtifact(''); setComps([]);
      }}>
        <TextInput label="What did you do?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} data-testid="field-title" />
        <div className="grid gap-3 sm:grid-cols-2"><TextInput label="Project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="One More Merge" /><TextInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <TextArea label="How you applied it" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} data-testid="field-desc" />
        <TextArea label="Outcome (what changed or what you learned)" value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} />
        <TextInput label="Where the evidence lives (commit, PR, file - a note, not an upload)" value={artifact} onChange={(e) => setArtifact(e.target.value)} />
        <fieldset><legend className="text-sm font-semibold">Competencies this demonstrates</legend><div className="mt-1 flex flex-wrap gap-2">{COMPETENCIES.map((c) => <label key={c.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${comps.includes(c.id) ? 'border-accent bg-surface2' : 'border-line'}`}><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={comps.includes(c.id)} onChange={() => setComps((cur) => cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id])} />{c.title}</label>)}</div></fieldset>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <div><Button type="submit" variant="primary" data-testid="save-field">Save field evidence</Button></div>
      </form>
    </Card>
  );
}

export default function GrowthPage() {
  const { data: l } = useLearning();
  const { data: experiments } = useExperiments();
  if (!l || !experiments) return <Spinner label="Loading your growth data" />;
  const today = todayKey();
  const evals = evaluateCompetencies(l.attempts, LESSONS, l.field, l.progress);
  const stored = new Map(l.competencies.map((c) => [c.competencyId, c]));
  const due = dueReviews(l.reviews, today);
  const upcoming = l.reviews.filter((r) => !due.includes(r)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const attempts = [...l.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const cal = summarizeCalibration(l.attempts);
  const concluded = experiments.filter((e) => e.status === 'concluded' && !e.synthetic);
  const lessonTitle = (id: string) => LESSONS.find((x) => x.id === id)?.title ?? id;

  return (
    <div>
      <PageHeader eyebrow="Arsenal & Growth" title="Growth" subtitle="What you have actually demonstrated - with the evidence behind every level." />
      <ArsenalNav active="growth" />

      <section aria-labelledby="comp-h" className="mb-8">
        <h2 id="comp-h" className="mb-3 text-xl font-semibold">Competency levels</h2>
        <ul className="grid gap-3 md:grid-cols-2" data-testid="competency-list">
          {COMPETENCIES.map((c) => {
            const e = evals.find((x) => x.competencyId === c.id)!;
            const rec = stored.get(c.id);
            return (
              <Card as="li" key={c.id} data-testid={`comp-${c.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{c.title}</h3><Badge tone={e.level >= 3 ? 'ok' : e.level >= 1 ? 'accent' : 'neutral'}>{e.level} · {LEVEL_NAMES[e.level]}</Badge></div>
                <p className="text-sm text-muted">{c.summary}</p>
                <div className="my-2"><ProgressBar value={e.level} max={4} label={`${c.title}: level ${e.level} of 4`} tone={e.level >= 3 ? 'ok' : 'accent'} /></div>
                {e.blockedReason && <p className="text-sm text-warn">{e.blockedReason}</p>}
                {e.staleLevel > e.level && <p className="text-xs text-muted">Earlier lesson versions showed level {e.staleLevel}; the content has since changed, so it does not count as current-version mastery.</p>}
                {e.evidence.length > 0 ? <ul className="mt-1 list-disc pl-5 text-xs text-muted">{e.evidence.slice(-3).map((x) => <li key={x.attemptId}>{lessonTitle(x.lessonId)} · {x.stage} · {Math.round(x.score * 100)}% - {x.note}</li>)}</ul> : <p className="text-xs text-muted">No qualifying evidence yet.</p>}
                {e.level >= 3 && e.fieldEvidenceIds.length === 0 && <p className="mt-1 text-xs text-teal">Next: log real-work application below to reach Field-proven.</p>}
                {rec && rec.history.length > 0 && <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Level history</summary><ul className="mt-1 space-y-0.5">{rec.history.map((h, i) => <li key={i}>{formatIso(h.at)}: {LEVEL_NAMES[h.from]} → {LEVEL_NAMES[h.to]} ({h.reason})</li>)}</ul></details>}
              </Card>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="rev-h" className="mb-8">
        <h2 id="rev-h" className="mb-3 text-xl font-semibold">Review queue</h2>
        {l.reviews.length === 0 ? <EmptyState title="No reviews scheduled yet" icon="clock">Submit a lesson assessment and its first review is scheduled for the next day (then 3, 7 and 14 days).</EmptyState> : (
          <ul className="space-y-2" data-testid="review-queue">
            {[...due, ...upcoming].map((r) => (
              <Card as="li" key={r.lessonId} className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold">{lessonTitle(r.lessonId)}</p><p className="text-sm text-muted">{due.includes(r) ? <Badge tone="warn">due</Badge> : <Badge>scheduled</Badge>} {formatDateKey(r.dueOn)} · box {r.box + 1}/4 · {r.lapses} lapse(s){r.lastOutcome ? ` · last: ${r.lastOutcome}` : ''}</p></div>
                {due.includes(r) && <LinkButton to={`/academy/review/${r.lessonId}`} variant="primary" size="sm">Start review</LinkButton>}
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cal-h" className="mb-8">
        <h2 id="cal-h" className="mb-3 text-xl font-semibold">Calibration history</h2>
        {cal.count === 0 ? <EmptyState title="No predictions yet" icon="target">Before each assessment you say how confident you are; here you will see how that compares with results over time.</EmptyState> : (
          <Card data-testid="calibration-summary">
            <p><strong>{cal.count}</strong> predictions · mean gap <strong>{cal.meanGap! > 0 ? '+' : ''}{cal.meanGap}</strong> points (positive = more confident than your result) · {cal.overconfident} overconfident · {cal.calibrated} calibrated · {cal.underconfident} underconfident</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">{cal.byConfidence.map((b) => <li key={b.confidence}>When you said confidence {b.confidence}/5 ({b.attempts} time{b.attempts === 1 ? '' : 's'}), you averaged {b.meanActualPct}%.</li>)}</ul>
            <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Prediction history table"><table className="w-full min-w-[26rem] text-sm"><caption className="sr-only">Prediction versus result by attempt</caption><thead><tr className="text-left"><th scope="col" className="p-1.5">When</th><th scope="col" className="p-1.5">Lesson</th><th scope="col" className="p-1.5">Predicted</th><th scope="col" className="p-1.5">Actual</th><th scope="col" className="p-1.5">Reading</th></tr></thead>
              <tbody>{attempts.filter((a) => a.predictedPct !== null && a.stage !== 'practice').slice(0, 12).map((a) => { const v = calibrationVerdict(a.predictedPct!, a.score * 100); return <tr key={a.id}><td className="p-1.5">{new Date(a.submittedAt).toLocaleDateString()}</td><td className="p-1.5">{lessonTitle(a.lessonId)}</td><td className="p-1.5">{a.predictedPct}%</td><td className="p-1.5">{Math.round(a.score * 100)}%</td><td className="p-1.5"><Badge tone={v.verdict === 'calibrated' ? 'ok' : 'warn'}>{v.verdict}</Badge></td></tr>; })}</tbody></table></div>
          </Card>
        )}
      </section>

      <section aria-labelledby="hist-h" className="mb-8">
        <h2 id="hist-h" className="mb-3 text-xl font-semibold">Assessment history</h2>
        {attempts.length === 0 ? <EmptyState title="No attempts yet" icon="book" action={<LinkButton to="/academy" variant="primary">Open the Academy</LinkButton>}>Every attempt - including failures - is kept here.</EmptyState> : (
          <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Attempt history table"><table className="w-full min-w-[34rem] text-sm" data-testid="attempt-history"><caption className="sr-only">All attempts</caption><thead><tr className="bg-surface2 text-left"><th scope="col" className="p-2">When</th><th scope="col" className="p-2">Lesson</th><th scope="col" className="p-2">Kind</th><th scope="col" className="p-2">Score</th><th scope="col" className="p-2">Result</th><th scope="col" className="p-2">Notes</th></tr></thead>
            <tbody>{attempts.slice(0, 40).map((a) => { const cur = LESSONS.find((x) => x.id === a.lessonId)?.version === a.lessonVersion; return <tr key={a.id} className="border-t border-line"><td className="p-2">{formatIso(a.submittedAt)}</td><td className="p-2"><Link className="underline" to={`/academy/lesson/${a.lessonId}`}>{lessonTitle(a.lessonId)}</Link></td><td className="p-2">{a.stage}{a.attemptNumber > 1 && a.stage === 'assessment' ? ` #${a.attemptNumber}` : ''}</td><td className="p-2">{Math.round(a.score * 100)}%</td><td className="p-2">{a.stage === 'practice' ? <Badge>guided</Badge> : a.passed ? <Badge tone="ok">passed</Badge> : <Badge tone="bad">not passed</Badge>}</td><td className="p-2 text-xs text-muted">{a.hintsUsed > 0 ? `${a.hintsUsed} hint(s) · ` : ''}{a.criticalFailed.length ? 'mandatory check missed · ' : ''}{!cur ? 'older lesson version' : ''}</td></tr>; })}</tbody></table></div>
        )}
      </section>

      <section aria-labelledby="exp-h2" className="mb-8">
        <h2 id="exp-h2" className="mb-3 text-xl font-semibold">Completed experiments</h2>
        {concluded.length === 0 ? <EmptyState title="No concluded experiments" icon="flask" action={<LinkButton to="/battle-lab" variant="primary">Open the Battle Lab</LinkButton>}>Experiments you mark as concluded appear here with their limitations.</EmptyState> : <ul className="space-y-2">{concluded.map((e) => <Card as="li" key={e.id}><Link className="font-semibold underline" to={`/battle-lab/${e.id}`}>{e.title}</Link><p className="text-sm text-muted">{e.runs.length} runs · {e.conditions.length} conditions</p></Card>)}</ul>}
      </section>

      <section aria-labelledby="field-h" className="mb-8">
        <h2 id="field-h" className="mb-3 text-xl font-semibold">Evidence of independent application</h2>
        <div className="space-y-3">
          {l.field.length === 0 && <Callout tone="info" title="None logged yet">Level 4 (Field-proven) needs a record of real work, such as moving a rule into a hook or catching a defect with a review gate. Using something once does not count.</Callout>}
          {[...l.field].sort((a, b) => b.date.localeCompare(a.date)).map((f) => (
            <Card key={f.id} data-testid="field-entry">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{f.title}</h3><Badge tone="teal">self-reported</Badge></div>
              <p className="text-sm text-muted">{f.date}{f.project && ` · ${f.project}`} · {f.competencyIds.map((c) => COMPETENCY_BY_ID[c as keyof typeof COMPETENCY_BY_ID]?.title ?? c).join(', ')}</p>
              <p className="mt-1 text-sm">{f.description}</p>
              {f.outcome && <p className="text-sm text-muted">Outcome: {f.outcome}</p>}
              <div className="mt-2"><ConfirmButton label="Delete" onConfirm={() => deleteFieldEvidence(f.id)} /></div>
            </Card>
          ))}
          <FieldForm />
        </div>
      </section>
    </div>
  );
}
