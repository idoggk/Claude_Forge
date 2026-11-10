import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, EmptyState, LinkButton, PageHeader, ProgressBar, Segmented, SelectField, TextInput } from '@/components/ui';
import { CARDS, CONTEXT_CHALLENGES, TASK, assessContext, emptyState, type ContextState, type Tone } from '@/domain/playgrounds/context';
import { PERM_CHALLENGES, PERM_TASKS, READ_LABELS, READ_SCOPES, WRITE_LABELS, WRITE_SCOPES, assessPermissions, defaultConfig, type PermConfig, type ReadScope, type WriteScope } from '@/domain/playgrounds/permissions';
import { QUESTIONS, RETRIEVAL_CHALLENGES, questionById, runRetrieval, type RetrievalState } from '@/domain/playgrounds/retrieval';

const TONE_BADGE: Record<Tone, 'ok' | 'warn' | 'bad' | 'neutral'> = { ok: 'ok', warn: 'warn', bad: 'bad', info: 'neutral' };
const TONE_WORD: Record<Tone, string> = { ok: 'Good', warn: 'Careful', bad: 'Problem', info: 'Note' };

function Banner({ simulated, notSimulated }: { simulated: string; notSimulated: string }) {
  return (
    <Callout tone="info" title="This is a simulation">
      <p data-testid="sim-banner"><strong>What is simulated:</strong> {simulated} <strong>What is not:</strong> {notSimulated}</p>
    </Callout>
  );
}

function Effects({ effects }: { effects: { id: string; tone: Tone; text: string }[] }) {
  return (
    <div role="status" aria-live="polite" data-testid="pg-effects">
      <ul className="space-y-2">
        {effects.map((e) => <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-sm"><Badge tone={TONE_BADGE[e.tone]}>{TONE_WORD[e.tone]}</Badge><span>{e.text}</span></li>)}
      </ul>
    </div>
  );
}

function Challenges({ items }: { items: { id: string; title: string; goal: string; met: boolean }[] }) {
  return (
    <Card aria-labelledby="pg-ch" data-testid="pg-challenges">
      <h2 id="pg-ch" className="text-lg font-semibold">Small challenges</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((c) => <li key={c.id} data-testid={`challenge-${c.id}`} className="flex flex-wrap items-baseline gap-2"><Badge tone={c.met ? 'ok' : 'neutral'}>{c.met ? 'Met' : 'Not yet'}</Badge><span><strong>{c.title}.</strong> {c.goal}</span></li>)}
      </ul>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------- A: context */
function ContextPlayground() {
  const [s, setS] = useState<ContextState>(emptyState());
  const r = assessContext(s);
  const toggle = (id: string) => setS((x) => ({ ...x, included: x.included.includes(id) ? x.included.filter((i) => i !== id) : [...x.included, id] }));
  return (
    <div className="space-y-4">
      <Banner simulated="a rule-based reading of what is in your brief: missing pieces, noise, a contradicting source, a buried constraint and a budget. Token counts are estimates against a fictional budget." notSimulated="any model. There are no accuracy figures because nothing here measures accuracy, and a real model may behave differently." />
      <Card aria-labelledby="pg-task"><h2 id="pg-task" className="text-lg font-semibold">The task</h2><p className="mt-1 text-sm">{TASK.brief}</p></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="pg-cards">
          <h2 id="pg-cards" className="text-lg font-semibold">Build the brief</h2>
          <p className="text-sm text-muted">Tick what you would include.</p>
          <ul className="mt-2 space-y-2">{CARDS.map((c) => (
            <li key={c.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={s.included.includes(c.id)} onChange={() => toggle(c.id)} data-testid={`card-${c.id}`} /><span><span className="font-semibold">{c.title}</span> <span className="text-muted">(about {c.tokens} tokens)</span><span className="block text-muted">{c.detail}</span></span></label></li>
          ))}</ul>
          <div className="mt-3"><Segmented label="Where the constraint sits" value={s.constraintPlacement} onChange={(v) => setS({ ...s, constraintPlacement: v })} options={[{ value: 'first', label: 'First' }, { value: 'last', label: 'After everything else' }]} /></div>
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setS(emptyState())} data-testid="pg-reset">Clear</Button><Button size="sm" onClick={() => setS({ included: CARDS.map((c) => c.id), constraintPlacement: 'last' })} data-testid="pg-all">Paste everything</Button></div>
        </Card>
        <Card aria-labelledby="pg-read">
          <h2 id="pg-read" className="text-lg font-semibold">What this does</h2>
          <div className="mt-2"><ProgressBar value={Math.min(r.tokens, r.budget)} max={r.budget} label={`Brief size: about ${r.tokens} of ${r.budget} (estimate)`} tone={r.overBudget ? 'accent' : 'teal'} /><p className="mt-1 text-xs text-muted" data-testid="pg-meter">About {r.tokens} of {r.budget} tokens (an estimate against a fictional budget).</p></div>
          <div className="mt-3"><Effects effects={r.effects} /></div>
        </Card>
      </div>
      <Challenges items={CONTEXT_CHALLENGES.map((c) => ({ id: c.id, title: c.title, goal: c.goal, met: c.met(s) }))} />
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- B: permissions */
function PermissionsPlayground() {
  const [taskId, setTaskId] = useState(PERM_TASKS[0]!.id);
  const [cfg, setCfg] = useState<PermConfig>(defaultConfig());
  const task = PERM_TASKS.find((t) => t.id === taskId)!;
  const r = assessPermissions(task, cfg);
  const set = (p: Partial<PermConfig>) => setCfg((c) => ({ ...c, ...p }));
  return (
    <div className="space-y-4">
      <Banner simulated="explicit rules that compare what you grant with what the task needs and with its constraints." notSimulated="an agent, your real settings or Claude Code's permission system. Real permission syntax is in the Claude Code documentation." />
      <Card aria-labelledby="pg-task">
        <h2 id="pg-task" className="text-lg font-semibold">The task</h2>
        <div className="mt-2"><Segmented label="Task" value={taskId} onChange={(v) => { setTaskId(v); setCfg(defaultConfig()); }} options={PERM_TASKS.map((t) => ({ value: t.id, label: t.title }))} /></div>
        <p className="mt-2 text-sm" data-testid="pg-task-desc">{task.description}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">{task.constraints.map((k) => <li key={k.text}>{k.text}</li>)}</ul>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="pg-grant">
          <h2 id="pg-grant" className="text-lg font-semibold">What you grant</h2>
          <div className="mt-2 grid gap-3">
            <SelectField label="Read" value={cfg.read} onChange={(e) => set({ read: e.target.value as ReadScope })} data-testid="perm-read">{READ_SCOPES.map((x) => <option key={x} value={x}>{READ_LABELS[x]}</option>)}</SelectField>
            <SelectField label="Write" value={cfg.write} onChange={(e) => set({ write: e.target.value as WriteScope })} data-testid="perm-write">{WRITE_SCOPES.map((x) => <option key={x} value={x}>{WRITE_LABELS[x]}</option>)}</SelectField>
            {([['del', 'Delete files'], ['network', 'Network access'], ['approveDeletes', 'A person approves each delete first'], ['approveOutside', 'A person approves writes outside the output folder']] as const).map(([k, label]) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={cfg[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<PermConfig>)} data-testid={`perm-${k}`} />{label}</label>
            ))}
          </div>
          <div className="mt-3"><Button size="sm" onClick={() => setCfg(defaultConfig())}>Reset</Button></div>
        </Card>
        <Card aria-labelledby="pg-verdict">
          <h2 id="pg-verdict" className="text-lg font-semibold">The verdict</h2>
          <p className="mt-2" data-testid="perm-verdict"><Badge tone={r.verdict === 'Least privilege' ? 'ok' : r.verdict.startsWith('Works') || r.verdict.startsWith('Needs') ? 'warn' : 'bad'}>{r.verdict}</Badge></p>
          <div className="mt-3"><Effects effects={r.findings.map((f) => ({ id: f.id, tone: f.tone, text: f.text }))} /></div>
        </Card>
      </div>
      <Challenges items={PERM_CHALLENGES.map((c) => ({ id: c.id, title: c.title, goal: c.goal, met: c.met({ ...cfg }) && c.taskId === taskId }))} />
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- C: retrieval */
function RetrievalPlayground() {
  const [s, setS] = useState<RetrievalState>({ questionId: QUESTIONS[0]!.id, query: 'timeout', topK: 3, sentencesPerChunk: 2 });
  const q = questionById(s.questionId);
  const r = runRetrieval(s);
  return (
    <div className="space-y-4">
      <Banner simulated="word-based (BM25) search over a small invented corpus, with each passage labelled current, stale, unverified or off-topic." notSimulated="embeddings or semantic search (a real semantic index may find passages this one cannot), reranking, or any language model. No answer is generated." />
      <Card aria-labelledby="pg-q">
        <h2 id="pg-q" className="text-lg font-semibold">The question</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <SelectField label="Question" value={s.questionId} onChange={(e) => { const nq = questionById(e.target.value); setS({ ...s, questionId: nq.id, query: nq.vagueQuery }); }} data-testid="rag-question">{QUESTIONS.map((x) => <option key={x.id} value={x.id}>{x.text}</option>)}</SelectField>
          <TextInput label="Search query" value={s.query} onChange={(e) => setS({ ...s, query: e.target.value })} data-testid="rag-query" />
          <label className="block text-sm font-semibold" htmlFor="rag-k">Passages to retrieve (K): <span data-testid="rag-k-value">{s.topK}</span></label>
          <input id="rag-k" type="range" min={1} max={5} value={s.topK} onChange={(e) => setS({ ...s, topK: Number(e.target.value) })} className="w-full" data-testid="rag-k" />
          <SelectField label="Passage size" value={String(s.sentencesPerChunk)} onChange={(e) => setS({ ...s, sentencesPerChunk: Number(e.target.value) })} data-testid="rag-chunk"><option value="1">1 sentence</option><option value="2">2 sentences</option><option value="3">3 sentences</option></SelectField>
        </div></Card>
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setS({ ...s, query: q.vagueQuery })} data-testid="rag-vague">Try a vague query</Button><Button size="sm" onClick={() => setS({ ...s, query: q.goodQuery })} data-testid="rag-good">Try a precise query</Button></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-labelledby="pg-hits">
          <h2 id="pg-hits" className="text-lg font-semibold">What is retrieved</h2>
          {r.hits.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing.</p> : (
            <ol className="mt-2 space-y-2" data-testid="rag-hits">{r.hits.map((h) => (
              <li key={h.chunkId} className="rounded-lg border border-line p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge>#{h.rank}</Badge><Badge tone={h.label === 'current' ? 'ok' : h.label === 'irrelevant' ? 'neutral' : 'warn'}>{h.label === 'current' ? 'Current source' : h.label === 'stale' ? 'Out of date' : h.label === 'unverified' ? 'Unverified' : 'Off topic'}</Badge><span className="font-semibold">{h.title}</span></div><p className="mt-1 text-muted">{h.source}{h.version ? ` · v${h.version}` : ''}{h.date ? ` · ${h.date}` : ' · no date'}</p><p className="mt-1">{h.text}</p><p className="mt-1 text-xs text-muted">Matched: {h.matched.join(', ')} · score {h.score}</p></li>
            ))}</ol>
          )}
        </Card>
        <Card aria-labelledby="pg-read2">
          <h2 id="pg-read2" className="text-lg font-semibold">What this means</h2>
          <div className="mt-2"><Effects effects={r.effects} /></div>
        </Card>
      </div>
      <Challenges items={RETRIEVAL_CHALLENGES.map((c) => ({ id: c.id, title: c.title, goal: c.goal, met: c.met(s) }))} />
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- pages */
const PLAYGROUNDS: { id: string; title: string; blurb: string; lesson: string; render: () => ReactNode }[] = [
  { id: 'context', title: 'Context engineering', blurb: 'Build a brief and see what missing, noisy or contradicting context does.', lesson: 'L12-context-engineering', render: () => <ContextPlayground /> },
  { id: 'permissions', title: 'Agent permissions', blurb: 'Grant read, write, delete, network and approvals, and see what is too little, too much or against the rules.', lesson: 'L25-agent-permissions-least-privilege', render: () => <PermissionsPlayground /> },
  { id: 'retrieval', title: 'Retrieval', blurb: 'Change the query, K and passage size and see how retrieval decides whether a grounded answer is possible.', lesson: 'L22-retrieval-augmented-generation', render: () => <RetrievalPlayground /> },
];

export function PlaygroundsIndex() {
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Playgrounds" subtitle="Interactive demonstrations of ideas that are hard to see in text. Every one says what is simulated and what is not. None of them runs a model, and they never change a competency level." />
      <ul className="grid gap-3 md:grid-cols-3" data-testid="playground-list">
        {PLAYGROUNDS.map((p) => <li key={p.id}><Card aria-labelledby={`pgc-${p.id}`} className="h-full"><h2 id={`pgc-${p.id}`} className="text-base font-semibold">{p.title}</h2><p className="mt-1 text-sm text-muted">{p.blurb}</p><p className="mt-2"><Link className="font-semibold text-accent-text underline" to={`/playgrounds/${p.id}`} data-testid={`playground-open-${p.id}`}>Open</Link></p></Card></li>)}
      </ul>
    </div>
  );
}

export function PlaygroundPage() {
  const { playgroundId } = useParams();
  const p = PLAYGROUNDS.find((x) => x.id === playgroundId);
  if (!p) return <EmptyState title="No such playground" action={<LinkButton to="/playgrounds">All playgrounds</LinkButton>}>That playground does not exist.</EmptyState>;
  return (
    <div data-testid={`playground-${p.id}`}>
      <PageHeader eyebrow="Playground" title={p.title} subtitle={p.blurb} actions={<><LinkButton to="/playgrounds" variant="ghost" size="sm">All playgrounds</LinkButton><LinkButton to={`/academy/lesson/${p.lesson}`} size="sm">The lesson</LinkButton></>} />
      {p.render()}
    </div>
  );
}
