import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Callout, Card, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { useActivityRuns } from '@/app/hooks';
import { APPROACHES, OPPORTUNITY_SCENARIOS, type Scenario } from '@/content/finder/scenarios';
import { FINDER_ACTIVITY_ID, FINDER_VERSION, pickScenarios, scoreRun, scoreScenario } from '@/domain/finder/score';
import { recordActivityRun } from '@/persistence/repo';
import { newId } from '@/lib/ids';

const label = (id: string) => APPROACHES.find((a) => a.id === id)?.label ?? id;

function Question({ s, n, total, onDone }: { s: Scenario; n: number; total: number; onDone: (chosen: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const res = scoreScenario(s, chosen);
  return (
    <Card aria-labelledby={`q-${s.id}`} data-testid={`finder-q-${n}`}>
      <p className="text-xs text-muted">Scenario {n} of {total}</p>
      <h2 id={`q-${s.id}`} className="mt-1 text-lg font-semibold">{s.situation}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{s.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
      <fieldset className="mt-4" disabled={checked}>
        <legend className="mb-2 text-sm font-semibold">Which approach fits best? Commit to an answer before you see the reasoning.</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {APPROACHES.map((a) => (
            <label key={a.id} className={`transition-forge flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${chosen === a.id ? 'border-accent bg-surface2 font-semibold' : 'border-line hover:bg-surface2'}`}>
              <input type="radio" name={`ap-${s.id}`} className="h-4 w-4 accent-[var(--accent)]" checked={chosen === a.id} onChange={() => setChosen(a.id)} data-testid={`approach-${a.id}`} />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      {!checked ? (
        <div className="mt-4"><Button variant="primary" disabled={!chosen} onClick={() => setChecked(true)} data-testid="finder-check">Check my answer</Button></div>
      ) : (
        <div className="mt-4 space-y-3" role="status" data-testid="finder-feedback">
          <Callout tone={res.verdict === 'best' ? 'ok' : res.verdict === 'defensible' ? 'info' : 'warn'} title={res.verdict === 'best' ? 'Best fit' : res.verdict === 'defensible' ? 'Defensible, with a caveat' : 'Not the best fit'}>
            <p><strong>Best answer: {label(s.correct)}.</strong> {s.whyCorrect}</p>
            {res.verdict === 'defensible' && s.defensible && <p className="mt-1">{s.defensible.note}</p>}
            {res.verdict === 'missed' && chosen && <p className="mt-1">{s.traps[chosen as keyof typeof s.traps] ?? `${label(chosen)} is not the simplest approach that works here - see the reasoning above.`}</p>}
          </Callout>
          {s.defensible && res.verdict !== 'defensible' && <p className="text-sm text-muted"><strong>Also defensible: {label(s.defensible.id)}.</strong> {s.defensible.note}</p>}
          <Button variant="primary" onClick={() => onDone(chosen!)} data-testid="finder-next">{n === total ? 'See my results' : 'Next scenario'}</Button>
        </div>
      )}
    </Card>
  );
}

export default function OpportunityFinderPage() {
  const { data: runs } = useActivityRuns();
  const toast = useToast();
  // The run's scenarios are fixed when the run STARTS. Saving the run adds to the history, which must not re-pick them.
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const history = (runs ?? []).filter((r) => r.activityId === FINDER_ACTIVITY_ID);
  useEffect(() => {
    if (runs && !scenarios) setScenarios(pickScenarios(runs.filter((r) => r.activityId === FINDER_ACTIVITY_ID)));
  }, [runs, scenarios]);
  if (!runs || !scenarios) return <Spinner label="Loading the Opportunity Finder" />;
  const finished = index >= scenarios.length;
  const summary = finished ? scoreRun(scenarios, answers) : null;

  const save = async () => {
    if (!summary || saved) return;
    await recordActivityRun({
      id: newId('run'),
      activityId: FINDER_ACTIVITY_ID,
      activityVersion: FINDER_VERSION,
      answers,
      results: summary.results.map((r) => ({ itemId: r.scenarioId, concept: 'approach-selection', correct: r.score === 1, score: r.score })),
      score: summary.score,
    });
    setSaved(true);
    toast('Run saved');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Learn"
        title="AI Opportunity Finder"
        subtitle={`Practice the first judgment in AI engineering: which approach fits - including conventional software, a person, or doing nothing. ${OPPORTUNITY_SCENARIOS.length} invented scenarios; each run draws ${Math.min(6, OPPORTUNITY_SCENARIOS.length)}. Practice runs shape your recommendations but never raise a competency level.`}
        actions={<LinkButton to="/academy/lesson/L11-choose-ai-approach" variant="secondary" size="sm">Lesson 11: Choose the right approach</LinkButton>}
      />
      {history.length > 0 && !finished && index === 0 && <p className="mb-3 text-sm text-muted" data-testid="finder-history">{history.length} earlier run{history.length === 1 ? '' : 's'} on this device. Last score: {Math.round((history[0]?.score ?? 0) * 100)}%.</p>}
      {!finished ? (
        <Question key={scenarios[index]!.id} s={scenarios[index]!} n={index + 1} total={scenarios.length} onDone={(c) => { setAnswers((a) => ({ ...a, [scenarios[index]!.id]: c })); setIndex(index + 1); }} />
      ) : (
        <Card aria-labelledby="fin-h" data-testid="finder-summary">
          <h2 id="fin-h" className="text-xl font-semibold">Your run: {Math.round(summary!.score * 100)}%</h2>
          <p className="text-sm text-muted">Best fit scores 1, a defensible alternative 0.5. With {scenarios.length} scenarios this is a rough picture, not a measurement.</p>
          <ul className="mt-3 space-y-2">
            {scenarios.map((s, i) => {
              const r = summary!.results[i]!;
              return (
                <li key={s.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={r.verdict === 'best' ? 'ok' : r.verdict === 'defensible' ? 'accent' : 'warn'}>{r.verdict === 'best' ? 'Best fit' : r.verdict === 'defensible' ? 'Defensible' : 'Missed'}</Badge><span className="font-semibold">{s.theme}</span></div>
                  <p className="mt-1 text-muted">You chose {r.chosen ? label(r.chosen) : 'nothing'}; best fit: {label(s.correct)}. {r.verdict === 'missed' && <Link className="underline" to={`/academy/lesson/${s.lessonId}`}>Review the lesson</Link>}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={saved} data-testid="finder-save">{saved ? 'Saved' : 'Save this run'}</Button>
            <Button onClick={() => { setScenarios(pickScenarios(history)); setIndex(0); setAnswers({}); setSaved(false); }} data-testid="finder-again">Run again</Button>
            <LinkButton to="/explore/approach-selection">Capability: choosing an approach</LinkButton>
          </div>
        </Card>
      )}
    </div>
  );
}
