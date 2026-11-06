import { useState } from 'react';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, TextArea, TextInput, useToast } from '@/components/ui';
import type { Evidence, Experiment } from '@/domain/experiments/model';
import {
  DEFAULT_CRITERIA, blindingCheck, createReview, customCriterion, disagreements, displayText, identityOf, lockEvaluation, lockProblems, newSeed, outputCandidates, recordGuess, reveal, revealedScores,
  reviewJson, reviewMarkdown, setBlindingNote, setMasking, setReasoning, setScore, startScoring, type Result,
} from '@/domain/blinded/review';
import type { BlindedReview, RubricCriterion } from '@/domain/blinded/schema';
import { saveExperiment } from '@/persistence/repo';
import { downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const STATE_LABEL: Record<BlindedReview['state'], string> = { setup: 'Setting up', scoring: 'Scoring', locked: 'Scores locked', revealed: 'Revealed' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'blinded-review';

/**
 * Score outputs without seeing which condition produced them. The rubric is fixed first, the order is shuffled and the labels are
 * anonymous; identities appear only after the scores are locked and you have said which condition you think made each output.
 */
export function BlindedReviewPanel({ exp, evidence }: { exp: Experiment; evidence: Evidence[] }) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const candidates = outputCandidates(exp, evidence);
  const reviews = exp.blindedReviews;
  const open = reviews.find((r) => r.id === openId) ?? null;

  const persist = async (next: BlindedReview) => { await saveExperiment({ ...exp, blindedReviews: reviews.map((r) => (r.id === next.id ? next : r)) }); };
  const apply = async (r: Result<BlindedReview>) => { if (r.ok) await persist(r.value); else toast(r.reason, 'bad'); };

  if (creating) return <NewReview exp={exp} candidates={candidates} onCancel={() => setCreating(false)} onCreate={async (r) => { await saveExperiment({ ...exp, blindedReviews: [...reviews, r] }); setCreating(false); setOpenId(r.id); }} />;
  if (open) return <ReviewView exp={exp} r={open} apply={apply} onBack={() => setOpenId(null)} onDelete={async () => { await saveExperiment({ ...exp, blindedReviews: reviews.filter((x) => x.id !== open.id) }); setOpenId(null); toast('Review deleted'); }} />;

  const conds = new Set(candidates.map((c) => c.conditionId)).size;
  return (
    <div className="space-y-4" data-testid="blinded-panel">
      <Callout tone="info" title="Score outputs without knowing which condition made them">Blinding reduces the pull of what you hope to find. You fix the rubric first, read shuffled outputs under anonymous labels, lock your scores, say which condition you think made each one, and only then see the answer. The scores stay your own subjective judgement, never a measurement.</Callout>
      {candidates.length < 2 || conds < 2 ? (
        <EmptyState title="Nothing to review yet" icon="flask">A blinded review compares the text outputs you attached to runs. Attach an output (paste it, or import a transcript) to runs of at least two conditions first. Your own notes about a run are not used, because they would reveal the source.</EmptyState>
      ) : (
        <Button variant="primary" onClick={() => setCreating(true)} data-testid="new-blinded">New blinded review ({candidates.length} outputs available)</Button>
      )}
      {reviews.length > 0 && (
        <ul className="space-y-2" data-testid="blinded-list">
          {reviews.map((r) => <Card as="li" key={r.id}><div className="flex flex-wrap items-center gap-2"><Badge tone={r.state === 'revealed' ? 'ok' : 'accent'}>{STATE_LABEL[r.state]}</Badge><strong>{r.title || 'Blinded review'}</strong><span className="text-sm text-muted">{r.items.length} outputs · {r.createdAt.slice(0, 10)}</span><Button size="sm" className="ml-auto" onClick={() => setOpenId(r.id)} data-testid={`open-blinded-${r.id}`}>Open</Button></div></Card>)}
        </ul>
      )}
    </div>
  );
}

function NewReview({ exp, candidates, onCreate, onCancel }: { exp: Experiment; candidates: ReturnType<typeof outputCandidates>; onCreate: (r: BlindedReview) => Promise<void>; onCancel: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<string[]>(candidates.map((c) => c.evidenceId));
  const [crit, setCrit] = useState<string[]>(DEFAULT_CRITERIA.map((c) => c.id));
  const [custom, setCustom] = useState<RubricCriterion[]>([]);
  const [cl, setCl] = useState({ label: '', worst: '', best: '' });
  const [err, setErr] = useState('');
  const byCond = exp.conditions.map((c) => ({ c, list: candidates.filter((x) => x.conditionId === c.id) })).filter((x) => x.list.length);

  const addCustom = () => { const r = customCriterion(newId('crit'), cl.label, cl.worst, cl.best); if (!r.ok) return setErr(r.reason); if (custom.length >= 3) return setErr('At most three task-specific criteria.'); setErr(''); setCustom([...custom, r.value]); setCl({ label: '', worst: '', best: '' }); };
  const create = async () => {
    const criteria = [...DEFAULT_CRITERIA.filter((c) => crit.includes(c.id)), ...custom];
    const r = createReview(exp, { id: newId('br'), title, chosen: candidates.filter((c) => chosen.includes(c.evidenceId)), criteria, seed: newSeed(), now: nowIso() });
    if (!r.ok) return setErr(r.reason);
    await onCreate(r.value);
    toast('Review created. Check the rubric, then start scoring.');
  };

  return (
    <Card aria-labelledby="nb-h" className="space-y-4" data-testid="new-blinded-form">
      <h2 id="nb-h" className="text-xl font-semibold">New blinded review</h2>
      <Callout tone="info" title="What you will and will not see">Choosing outputs below shows which condition each came from. That is unavoidable, and it is the last time you will see it until you reveal. Scoring uses shuffled, anonymously labelled outputs.</Callout>
      <TextInput label="Title (optional)" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} data-testid="nb-title" />
      <fieldset>
        <legend className="text-sm font-semibold">Outputs to compare</legend>
        {byCond.map(({ c, list }) => <div key={c.id} className="mt-2"><p className="text-sm font-semibold">{c.label} ({list.length})</p><ul>{list.map((o) => <li key={o.evidenceId}><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={chosen.includes(o.evidenceId)} onChange={() => setChosen((s) => (s.includes(o.evidenceId) ? s.filter((x) => x !== o.evidenceId) : [...s, o.evidenceId]))} />run {o.runIndex}: {o.name}</label></li>)}</ul></div>)}
        <p className="mt-1 text-xs text-muted">Choose a balanced set. {chosen.length} selected.</p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Rubric (fixed before you see any output)</legend>
        <ul className="mt-1 space-y-1">{DEFAULT_CRITERIA.map((c) => <li key={c.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={crit.includes(c.id)} onChange={() => setCrit((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} /><span><strong>{c.label}</strong><span className="block text-xs text-muted">0 = {c.anchors[0]} · 3 = {c.anchors[3]}</span></span></label></li>)}</ul>
        {custom.map((c) => <p key={c.id} className="text-sm"><strong>{c.label}</strong> <span className="text-muted">0 = {c.anchors[0]} · 3 = {c.anchors[3]}</span> <button type="button" className="underline" onClick={() => setCustom(custom.filter((x) => x.id !== c.id))}>remove</button></p>)}
        <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Add a task-specific criterion</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3"><TextInput label="Name" value={cl.label} onChange={(e) => setCl({ ...cl, label: e.target.value })} data-testid="nb-c-label" /><TextInput label="What a 0 looks like" value={cl.worst} onChange={(e) => setCl({ ...cl, worst: e.target.value })} data-testid="nb-c-worst" /><TextInput label="What a 3 looks like" value={cl.best} onChange={(e) => setCl({ ...cl, best: e.target.value })} data-testid="nb-c-best" /></div>
          <Button size="sm" className="mt-2" onClick={addCustom} data-testid="nb-c-add">Add criterion</Button>
        </details>
      </fieldset>
      {err && <Callout tone="bad" role="alert" title="Check this">{err}</Callout>}
      <div className="flex gap-2"><Button variant="primary" onClick={() => void create()} disabled={chosen.length < 2 || crit.length + custom.length < 1} data-testid="nb-create">Create the review</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div>
    </Card>
  );
}

function ReviewView({ exp, r, apply, onBack, onDelete }: { exp: Experiment; r: BlindedReview; apply: (x: Result<BlindedReview>) => Promise<void>; onBack: () => void; onDelete: () => Promise<void> }) {
  const [note, setNote] = useState(r.blindingNote);
  const now = nowIso;
  const items = [...r.items].sort((a, b) => a.order - b.order);
  const problems = lockProblems(r);
  const scored = items.filter((i) => r.rubric.criteria.every((c) => r.scores[i.key]?.[c.id] !== undefined) && (r.reasoning[i.key] ?? '').trim().length >= 10).length;
  const label = (id: string) => exp.conditions.find((c) => c.id === id)?.label ?? '?';

  return (
    <div className="space-y-4" data-testid="blinded-review" data-state={r.state}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>All reviews</Button>
        <Badge tone={r.state === 'revealed' ? 'ok' : 'accent'}>{STATE_LABEL[r.state]}</Badge>
        <h2 className="text-xl font-semibold">{r.title || 'Blinded review'}</h2>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" icon="download" onClick={() => downloadText(reviewMarkdown(r, exp), `${slug(r.title || exp.title)}-blinded.md`, 'text/markdown')} data-testid="blinded-md">Markdown</Button>
          <Button size="sm" icon="download" onClick={() => downloadText(reviewJson(r), `${slug(r.title || exp.title)}-blinded.json`, 'application/json')} data-testid="blinded-json">JSON</Button>
          <ConfirmButton label="Delete" confirmLabel="Delete this review" onConfirm={onDelete} />
        </span>
      </div>

      {r.exceptions.length > 0 && <Callout tone="warn" title="Where the blinding may leak" role="status"><ul className="list-disc pl-4" data-testid="blinded-exceptions">{r.exceptions.map((e) => <li key={e}>{e}</li>)}</ul></Callout>}

      {r.state === 'setup' && (
        <Card className="space-y-3" data-testid="stage-setup">
          <h3 className="text-lg font-semibold">The rubric</h3>
          <ul className="space-y-1 text-sm">{r.rubric.criteria.map((c) => <li key={c.id}><strong>{c.label}</strong> <span className="text-muted">0 = {c.anchors[0]} · 3 = {c.anchors[3]}</span></li>)}</ul>
          {r.items.some((i) => i.leakTerms.length) && <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={r.maskLeaks} onChange={(e) => void apply(setMasking(r, e.target.checked, now()))} data-testid="blinded-mask" />Hide words that would reveal the source (display only; the original text is kept)</label>}
          <p className="text-sm text-muted">Starting to score locks this rubric for good, so it cannot be bent to fit the outputs you read.</p>
          <Button variant="primary" onClick={() => void apply(startScoring(r, now()))} data-testid="blinded-start">Lock the rubric and start scoring</Button>
        </Card>
      )}

      {r.state === 'scoring' && (
        <div className="space-y-3" data-testid="stage-scoring">
          <p className="text-sm text-muted" data-testid="blinded-progress">{scored} of {items.length} outputs scored. Condition labels are hidden and the order is shuffled.</p>
          {items.map((it) => (
            <Card as="article" key={it.key} aria-labelledby={`h-${it.key}`} data-testid={`item-${it.key}`}>
              <h3 id={`h-${it.key}`} className="text-lg font-semibold">{it.key}</h3>
              <pre className="code-scroll mt-1 max-h-64 whitespace-pre-wrap break-words text-sm" tabIndex={0}><code>{displayText(r, it)}</code></pre>
              <div className="mt-3 space-y-3">
                {r.rubric.criteria.map((c) => {
                  const v = r.scores[it.key]?.[c.id];
                  return (
                    <div key={c.id}>
                      <p className="text-sm font-semibold">{c.label}</p>
                      <div role="radiogroup" aria-label={`${it.key} ${c.label}`} className="mt-1 flex flex-wrap gap-2">
                        {[0, 1, 2, 3, null].map((n) => <button key={String(n)} type="button" role="radio" aria-checked={v === n} data-testid={`score-${it.key.replace(' ', '-')}-${c.id}-${n === null ? 'na' : n}`} onClick={() => void apply(setScore(r, it.key, c.id, n, now()))} className={`transition-forge min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold ${v === n ? 'border-accent bg-surface2' : 'border-line text-muted hover:bg-surface2'}`}>{n === null ? 'Not assessed' : n}</button>)}
                      </div>
                      <p className="mt-1 text-xs text-muted">{typeof v === 'number' ? `${v}: ${c.anchors[v]}` : v === null ? 'Not assessed: excluded, never scored as 0.' : `0 = ${c.anchors[0]} · 3 = ${c.anchors[3]}`}</p>
                    </div>
                  );
                })}
                <ReasoningBox value={r.reasoning[it.key] ?? ''} label={`Your reasoning for ${it.key}`} testId={`reason-${it.key.replace(' ', '-')}`} onSave={(t) => void apply(setReasoning(r, it.key, t, now()))} />
              </div>
            </Card>
          ))}
          {problems.length > 0 && <details className="text-sm"><summary className="min-h-11 cursor-pointer font-semibold">What is left before you can lock ({problems.length})</summary><ul className="list-disc pl-5 text-muted">{problems.slice(0, 12).map((p) => <li key={p}>{p}</li>)}</ul></details>}
          <Button variant="primary" disabled={problems.length > 0} onClick={() => void apply(lockEvaluation(r, now()))} data-testid="blinded-lock">Lock the evaluation</Button>
          <p className="text-xs text-muted">Locking is final: scores and reasoning cannot be changed afterwards.</p>
        </div>
      )}

      {r.state === 'locked' && (
        <Card className="space-y-3" data-testid="stage-locked">
          <h3 className="text-lg font-semibold">Before the reveal: which condition made each output?</h3>
          <p className="text-sm text-muted">Your scores are locked, so this cannot change them. Guessing tells you whether the blinding held. &ldquo;Can&rsquo;t tell&rdquo; is a fine answer.</p>
          <ul className="space-y-2">{items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-center gap-3"><span className="w-24 font-semibold">{it.key}</span>
              <select aria-label={`Guess for ${it.key}`} className="min-h-11 rounded-lg border border-line bg-surface2 px-2" value={r.guesses[it.key] ?? ''} onChange={(e) => e.target.value && void apply(recordGuess(r, it.key, e.target.value, now()))} data-testid={`guess-${it.key.replace(' ', '-')}`}>
                <option value="">Choose…</option>{exp.conditions.filter((c) => r.items.some((i) => i.conditionId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}<option value="unsure">Can&rsquo;t tell</option>
              </select></li>
          ))}</ul>
          <TextArea label="Did anything in the outputs give the source away? (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => void apply(setBlindingNote(r, note, now()))} data-testid="blinded-note" />
          <Button variant="primary" onClick={() => void apply(reveal(r, now()))} data-testid="blinded-reveal">Reveal the conditions</Button>
        </Card>
      )}

      {r.state === 'revealed' && <Revealed exp={exp} r={r} label={label} />}
    </div>
  );
}

function ReasoningBox({ value, label, testId, onSave }: { value: string; label: string; testId: string; onSave: (t: string) => void }) {
  const [v, setV] = useState(value);
  return <TextArea label={label} rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }} data-testid={testId} />;
}

function Revealed({ exp, r, label }: { exp: Experiment; r: BlindedReview; label: (id: string) => string }) {
  const sc = revealedScores(r, exp) ?? [];
  const bc = blindingCheck(r);
  const dis = disagreements(r, exp);
  return (
    <div className="space-y-4" data-testid="stage-revealed">
      <Card>
        <h3 className="text-lg font-semibold">Scores by condition</h3>
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Scores by condition table">
          <table className="w-full min-w-[28rem] border-collapse text-sm" data-testid="blinded-table">
            <thead><tr className="text-left"><th scope="col" className="border-b border-line p-2">Condition</th><th scope="col" className="border-b border-line p-2">Outputs</th>{r.rubric.criteria.map((c) => <th scope="col" key={c.id} className="border-b border-line p-2">{c.label}</th>)}</tr></thead>
            <tbody>{sc.map((s) => <tr key={s.conditionId}><th scope="row" className="border-b border-line p-2 text-left">{s.label}</th><td className="border-b border-line p-2">{s.outputs}</td>{s.perCriterion.map((p) => <td key={p.criterionId} className="border-b border-line p-2">{p.mean === null ? 'unknown' : `${p.mean.toFixed(2)} [${p.min}–${p.max}] n=${p.n}`}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Mean [min–max] n = outputs scored. These are your own subjective scores on a 0 to 3 scale. A handful of outputs supports a direction at most.</p>
      </Card>
      {bc && <Callout tone={bc.verdict === 'likely-failed' ? 'warn' : 'info'} title="Did the blinding hold?"><span data-testid="blinding-verdict">You named a condition for {bc.made} of {r.items.length} outputs ({bc.unsure} marked can&rsquo;t tell) and were right for {bc.correct}; chance alone would give about {bc.chance.toFixed(1)}. {bc.verdict === 'likely-failed' ? 'The outputs probably revealed their source, so treat these scores with extra caution.' : bc.verdict === 'held-up' ? 'Your guesses were close to chance, which is consistent with the blinding holding, though it cannot prove it.' : 'With this few outputs the guesses cannot tell whether the blinding held.'}</span></Callout>}
      {dis.length > 0 && <Callout tone="warn" title="Blinded scores and recorded measurements disagree"><ul className="list-disc pl-4" data-testid="blinded-disagree">{dis.map((d) => <li key={d}>{d}</li>)}</ul></Callout>}
      <Card>
        <h3 className="text-lg font-semibold">Each output, now identified</h3>
        <ul className="mt-2 space-y-2 text-sm">{[...r.items].sort((a, b) => a.order - b.order).map((it) => <li key={it.key} className="rounded-lg border border-line p-2"><strong>{it.key}</strong> <Badge tone="teal">{label(identityOf(r, it.key) ?? '')}</Badge> <span className="text-muted">you guessed: {r.guesses[it.key] === 'unsure' ? 'can\'t tell' : label(r.guesses[it.key] ?? '')}</span>{r.reasoning[it.key] && <p className="text-muted">{r.reasoning[it.key]}</p>}</li>)}</ul>
      </Card>
    </div>
  );
}
