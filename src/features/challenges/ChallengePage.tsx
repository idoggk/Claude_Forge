import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, EmptyState, LinkButton, PageHeader, useToast } from '@/components/ui';
import { CHALLENGE_BY_ID, challengeActivityId } from '@/content/challenges';
import { FIXTURE_VIEWS } from '@/content/challenges/fixtures';
import { scoreEngine } from '@/domain/challenges/lab';
import { useActivityRuns } from '@/app/hooks';
import { recordActivityRun } from '@/persistence/repo';
import { newId } from '@/lib/ids';

const TONE = { ok: 'ok', warn: 'warn', bad: 'bad', info: 'neutral' } as const;

export default function ChallengePage() {
  const { challengeId } = useParams();
  const def = challengeId ? CHALLENGE_BY_ID.get(challengeId as never) : undefined;
  const toast = useToast();
  const { data: runs } = useActivityRuns();
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hints, setHints] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!def) return <EmptyState title="No such challenge" action={<LinkButton to="/challenges">All challenges</LinkButton>}>That challenge does not exist.</EmptyState>;

  const { engine } = def;
  const first = engine.groups[0]!;
  const toggle = (groupId: string, optId: string, exclusive?: boolean) => {
    setSubmitted(false); setSaved(false);
    setSelected((s) => {
      const group = engine.groups.find((g) => g.id === groupId)!;
      if (exclusive) return [...s.filter((x) => !group.options.some((o) => o.id === x)), optId];
      return s.includes(optId) ? s.filter((x) => x !== optId) : [...s, optId];
    });
  };
  const overMax = engine.max !== null && selected.filter((s) => first.options.some((o) => o.id === s)).length > engine.max;
  const result = submitted ? scoreEngine(engine, selected, answers) : null;
  const questions = engine.questions();
  const fixture = FIXTURE_VIEWS[def.id]?.() ?? [];
  const history = (runs ?? []).filter((r) => r.activityId === challengeActivityId(def.id));

  const save = async () => {
    if (!result || saved) return;
    await recordActivityRun({ id: newId('run'), activityId: challengeActivityId(def.id), activityVersion: def.version, answers: { selected: selected.join(','), ...answers }, results: result.answers.map((a) => ({ itemId: a.id, concept: def.concept, correct: a.correct, score: a.correct ? 1 : 0 })), score: result.score });
    setSaved(true);
    toast('Run saved');
  };

  return (
    <div data-testid={`challenge-${def.id}`}>
      <PageHeader eyebrow="Challenge" title={def.title} subtitle={def.tagline} actions={<LinkButton to="/challenges" variant="secondary" size="sm">All challenges</LinkButton>} />
      <div className="space-y-4">
        <Card aria-labelledby="c-problem"><h2 id="c-problem" className="text-lg font-semibold">The problem</h2><p className="mt-1 text-sm">{def.problem}</p><p className="mt-2 text-sm"><strong>Objective.</strong> {def.objective}</p><p className="mt-2 text-sm text-muted"><strong>Fixture.</strong> {def.fixture}</p></Card>

        <Card aria-labelledby="c-guided"><h2 id="c-guided" className="text-lg font-semibold">Worked example: {def.guided.title}</h2><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{def.guided.steps.map((s) => <li key={s}>{s}</li>)}</ol><p className="mt-3 text-sm"><strong>Your turn.</strong> {def.task}</p></Card>

        <details className="rounded-xl border border-line p-4" data-testid="challenge-fixture">
          <summary className="cursor-pointer font-semibold">Inspect the fixture</summary>
          <div className="mt-3 space-y-3 text-sm">{fixture.map((f) => <div key={f.title}><p className="font-semibold">{f.title}</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 font-mono text-xs">{f.lines.join('\n')}</pre></div>)}</div>
        </details>

        <Card aria-labelledby="c-work">
          <h2 id="c-work" className="text-lg font-semibold">Your attempt</h2>
          {engine.groups.map((g) => (
            <fieldset key={g.id} className="mt-3" data-testid={`group-${g.id}`}>
              <legend className="font-semibold">{g.title}</legend>
              <p className="text-sm text-muted">{g.hint}</p>
              <ul className="mt-2 space-y-2">
                {g.options.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type={g.exclusive ? 'radio' : 'checkbox'} name={g.id} className="mt-1" checked={selected.includes(o.id)} onChange={() => toggle(g.id, o.id, g.exclusive)} data-testid={`opt-${o.id}`} />
                      <span><span className="font-semibold">{o.label}</span><span className="block text-muted">{o.what}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          {overMax && <Callout tone="warn" title="Too many selected">Choose at most {engine.max} in the first list.</Callout>}

          <h3 className="mt-5 font-semibold">Judgement questions</h3>
          <div className="mt-2 space-y-3">
            {questions.map((q) => (
              <fieldset key={q.id} data-testid={`question-${q.id}`}>
                <legend className="text-sm font-medium">{q.prompt}</legend>
                <div className="mt-1 space-y-1">{q.options.map((o) => <label key={o.id} className="flex cursor-pointer items-start gap-2 text-sm"><input type="radio" name={`q-${q.id}`} className="mt-1" checked={answers[q.id] === o.id} onChange={() => { setAnswers((a) => ({ ...a, [q.id]: o.id })); setSubmitted(false); setSaved(false); }} data-testid={`ans-${q.id}-${o.id}`} /><span>{o.label}</span></label>)}</div>
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setSubmitted(true)} disabled={overMax} data-testid="challenge-submit">Run the checks and score me</Button>
            {history.length > 0 && <span className="text-sm text-muted" data-testid="challenge-history">{history.length} earlier run{history.length === 1 ? '' : 's'} on this device. Best {Math.round(Math.max(...history.map((h) => h.score)) * 100)}%.</span>}
          </div>
        </Card>

        {result && (
          <Card aria-labelledby="c-result" data-testid="challenge-result" className={result.passed ? 'border-ok' : ''}>
            <h2 id="c-result" className="text-lg font-semibold">Result: {Math.round(result.score * 100)}%</h2>
            <p className="text-sm" role="status">{result.run.headline}</p>
            <ul className="mt-2 flex flex-wrap gap-2" data-testid="challenge-stats">{result.run.stats.map((s) => <li key={s.label}><Badge tone="accent">{s.label}: {s.value}</Badge></li>)}</ul>
            <ul className="mt-3 space-y-1 text-sm" data-testid="challenge-rows">{result.run.rows.map((r, i) => <li key={`${r.label}-${i}`} className="flex flex-wrap items-baseline gap-2"><Badge tone={TONE[r.tone]}>{r.tone === 'ok' ? 'good' : r.tone === 'bad' ? 'problem' : r.tone === 'warn' ? 'cost' : 'note'}</Badge><span><span className="font-semibold">{r.label}.</span> {r.detail}</span></li>)}</ul>
            <h3 className="mt-4 font-semibold">Questions</h3>
            <ul className="mt-1 space-y-2 text-sm">{questions.map((q) => { const g = result.answers.find((a) => a.id === q.id)!; return <li key={q.id}><Badge tone={g.correct ? 'ok' : 'warn'}>{g.correct ? 'Correct' : 'Not quite'}</Badge> {q.explain}</li>; })}</ul>
            <p className="mt-3 text-sm text-muted">This is practice. It is saved only on this device and never changes a competency level.</p>
            <div className="mt-2"><Button size="sm" onClick={save} disabled={saved} data-testid="challenge-save">{saved ? 'Saved' : 'Save this run'}</Button></div>
          </Card>
        )}

        <Card aria-labelledby="c-help">
          <h2 id="c-help" className="text-lg font-semibold">Stuck?</h2>
          <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => setHints((h) => Math.min(def.hints.length, h + 1))} disabled={hints >= def.hints.length} data-testid="challenge-hint">{hints === 0 ? 'Show a hint' : 'Show another hint'}</Button><Button size="sm" variant="ghost" onClick={() => setShowRef((v) => !v)} aria-expanded={showRef} data-testid="challenge-reference-toggle">{showRef ? 'Hide' : 'Show'} the reference solution</Button></div>
          {hints > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm" data-testid="challenge-hints">{def.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ol>}
          {showRef && <div className="mt-3 rounded-lg border border-line p-3 text-sm" data-testid="challenge-reference"><p className="font-semibold">One reference solution</p><p className="mt-1">{def.reference.explanation}</p><ul className="mt-1 list-disc pl-5">{def.reference.selected.map((id) => { const o = engine.groups.flatMap((g) => g.options).find((x) => x.id === id); return <li key={id}>{o?.label ?? id}</li>; })}</ul></div>}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card aria-labelledby="c-rubric"><h2 id="c-rubric" className="text-lg font-semibold">Rubric</h2><ul className="mt-2 space-y-1 text-sm">{def.rubric.map((r) => <li key={r.criterion}><span className="font-semibold">{r.criterion}.</span> {r.evidence}</li>)}</ul></Card>
          <Card aria-labelledby="c-mistakes"><h2 id="c-mistakes" className="text-lg font-semibold">Common mistakes</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{def.commonMistakes.map((m) => <li key={m}>{m}</li>)}</ul></Card>
        </div>

        <Card aria-labelledby="c-transfer"><h2 id="c-transfer" className="text-lg font-semibold">Take it further</h2><p className="mt-1 text-sm">{def.honesty}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm"><li><Link className="text-accent-text underline" to={`/academy/lesson/${def.transfer.lessonId}`}>{def.transfer.lessonLabel}</Link></li><li><Link className="text-accent-text underline" to={def.transfer.labTo}>{def.transfer.labLabel}</Link></li></ul></Card>
      </div>
    </div>
  );
}
