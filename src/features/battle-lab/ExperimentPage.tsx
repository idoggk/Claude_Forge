import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, SafeLink, SelectField, Spinner, TabPanel, Tabs, TextArea, TextInput, useToast } from '@/components/ui';
import { DEMO_EXPERIMENT, DEMO_ID } from '@/domain/experiments/demo';
import { ATTEMPT_LABELS, ExperimentSchema, type Evidence, type Experiment, type Run } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { buildExperimentReport, exportExperimentJson } from '@/domain/experiments/report';
import { addEvidence, deleteEvidence, saveExperiment } from '@/persistence/repo';
import { getDb } from '@/persistence/db';
import { useLive } from '@/persistence/useLive';
import { buildFixturePack, getFixture } from '@/fixtures';
import { EXPERIMENT_TYPE_LABELS } from '@/domain/experiments/model';
import { downloadBlob, downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { ComparisonView } from './ComparisonView';
import { RunForm, type RunFormResult } from './RunForm';
import { PlaybookLinksCard } from './PlaybookLinksCard';

type TabId = 'setup' | 'record' | 'compare' | 'report';

export default function ExperimentPage() {
  const { experimentId = '' } = useParams();
  const isDemo = experimentId === DEMO_ID;
  const toast = useToast();
  const nav = useNavigate();
  const { data: stored, loading } = useLive<Experiment | undefined>(async () => (isDemo ? undefined : await getDb().experiments.get(experimentId)), [experimentId]);
  const { data: evidence } = useLive(() => getDb().evidence.where('experimentId').equals(experimentId).toArray(), [experimentId]);
  const exp: Experiment | undefined = isDemo ? DEMO_EXPERIMENT : stored;
  const [tab, setTab] = useState<TabId>(isDemo ? 'compare' : 'record');
  const [editing, setEditing] = useState<Run | null>(null);
  const [draft, setDraft] = useState<Experiment | null>(null);

  useEffect(() => { if (exp) setDraft(exp); }, [exp?.id, exp?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const seededTotal = useMemo(() => (exp ? getFixture(exp.fixture.id)?.checklist.length || null : null), [exp]);
  if (!isDemo && loading) return <Spinner label="Opening the experiment" />;
  if (!exp) return <EmptyState title="Experiment not found" action={<LinkButton to="/battle-lab" variant="primary">Back to the AI Lab</LinkButton>}>It may have been deleted.</EmptyState>;
  if (!draft) return <Spinner />;

  const readOnly = isDemo;
  const inLoop = Boolean(exp.loopId);
  const setupLocked = readOnly || inLoop;
  const fx = getFixture(exp.fixture.id);
  const comparison = compareExperiment(exp, seededTotal);
  const ev = evidence ?? [];

  const persist = async (next: Experiment) => { if (readOnly) return; await saveExperiment(next); };
  const patch = (p: Partial<Experiment>) => { const next = { ...draft, ...p }; setDraft(next); };

  const saveRun = async ({ run, evidence: evs }: RunFormResult) => {
    const others = exp.runs.filter((r) => r.id !== run.id);
    const next: Experiment = { ...exp, runs: [...others, run].sort((a, b) => a.conditionId.localeCompare(b.conditionId) || a.index - b.index), rubricLockedAt: exp.rubricLockedAt ?? nowIso(), status: exp.status === 'draft' ? 'recording' : exp.status };
    await persist(next);
    for (const e of evs) await addEvidence(e);
    setEditing(null);
    toast(editing ? 'Run updated' : 'Run saved');
  };

  const createFromDemo = async () => {
    const now = nowIso();
    const idMap = new Map(DEMO_EXPERIMENT.conditions.map((c) => [c.id, newId('cond')]));
    const e = ExperimentSchema.parse({ ...DEMO_EXPERIMENT, id: newId('exp'), title: 'My experiment (from the demo structure)', subject: '', synthetic: false, runs: [], rubricLockedAt: null, status: 'draft', observations: '', conclusion: '', limitations: '', hypothesis: '', fixture: { ...DEMO_EXPERIMENT.fixture, hash: null }, conditions: DEMO_EXPERIMENT.conditions.map((c) => ({ ...c, id: idMap.get(c.id)! })), createdAt: now, updatedAt: now });
    await saveExperiment(e);
    toast('Editable copy created - no runs or data were copied');
    nav(`/battle-lab/${e.id}`);
  };

  const exportJson = () => { downloadText(exportExperimentJson(exp, ev, seededTotal), `experiment-${exp.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'export'}.json`, 'application/json'); toast('Experiment exported (JSON)'); };
  const report = buildExperimentReport(exp, ev, comparison);

  return (
    <div>
      {exp.synthetic && (
        <div className="mb-4"><Callout tone="warn" title="SYNTHETIC DEMONSTRATION - no Claude execution occurred">Every number is invented to explain method. Use it to learn how to read results, then record your own.</Callout></div>
      )}
      {inLoop && (
        <div className="mb-4" data-testid="loop-experiment-banner"><Callout tone="info" title={`Part of a Skill Improvement Loop (${exp.phase === 'heldout' ? 'held-out set' : 'development set'})`}>Runs for this experiment are recorded in the loop, where each one is tied to a proposal and graded against the simulation. They cannot be edited here{exp.runsLockedAt ? ' - these runs are locked because the ground truth was revealed' : ''}. <LinkButton to={`/loop/${exp.loopId}`} size="sm" variant="primary" className="mt-2">Open the loop</LinkButton></Callout></div>
      )}
      <PageHeader
        eyebrow="AI Lab"
        title={exp.title}
        subtitle={<>{EXPERIMENT_TYPE_LABELS[exp.experimentType]}{exp.subject ? `: ${exp.subject}` : ''} · {exp.fixture.label} · {exp.conditions.length} conditions · {exp.runs.length} runs recorded</>}
        actions={readOnly ? <Button variant="primary" onClick={() => void createFromDemo()} data-testid="clone-demo">Create my own from this structure</Button> : <><Badge tone={exp.status === 'concluded' ? 'ok' : 'accent'}>{exp.status}</Badge><LinkButton to="/battle-lab" variant="ghost" size="sm">All experiments</LinkButton></>}
      />
      <Tabs<TabId> label="Experiment sections" value={tab} onChange={setTab} tabs={[{ id: 'setup', label: 'Setup' }, { id: 'record', label: 'Record runs', badge: <Badge>{exp.runs.length}</Badge> }, { id: 'compare', label: 'Compare' }, { id: 'report', label: 'Report & export' }]} />

      {/* ------------------------------- SETUP ------------------------------- */}
      <TabPanel id="setup" active={tab === 'setup'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <TextInput label="Title" value={draft.title} disabled={setupLocked} onChange={(e) => patch({ title: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} />
            <TextArea label="Problem statement" rows={2} value={draft.problem} disabled={setupLocked} onChange={(e) => patch({ problem: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} />
            <TextArea label="Hypothesis" rows={2} value={draft.hypothesis} disabled={setupLocked || exp.runs.length > 0} onChange={(e) => patch({ hypothesis: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} hint={exp.runs.length > 0 ? 'Locked once runs exist, so it cannot be bent to fit the results.' : undefined} />
            <TextArea label="Prompt (identical for all conditions)" rows={3} value={draft.prompt} disabled={setupLocked || exp.runs.length > 0} onChange={(e) => patch({ prompt: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} />
            <TextArea label="Success criteria (one per line)" rows={3} value={draft.successCriteria.join('\n')} disabled={setupLocked || exp.runs.length > 0} onChange={(e) => patch({ successCriteria: e.target.value.split('\n') })} onBlur={() => void persist({ ...exp, ...draft, successCriteria: draft.successCriteria.map((s) => s.trim()).filter(Boolean) })} />
          </Card>
          <div className="space-y-4">
            <Card>
              <h2 className="font-semibold">Fixture</h2>
              <p className="text-sm">{exp.fixture.label} · version {exp.fixture.version || 'unknown'}</p>
              <p className="break-all text-xs text-muted" data-testid="fixture-hash">SHA-256 of the pack manifest: {exp.fixture.hash ?? 'not recorded'}</p>
              {fx && !readOnly && <><p className="mt-2 text-sm text-muted">{fx.objectiveHow}</p><Button className="mt-2" size="sm" icon="download" onClick={async () => { const p = await buildFixturePack(fx.id); downloadBlob(p.blob, p.filename); }} data-testid="download-pack">Download fixture pack (ZIP)</Button></>}
              <p className="mt-2 text-xs text-muted">Rubric {exp.rubricLockedAt ? `locked ${new Date(exp.rubricLockedAt).toLocaleString()} (first run recorded)` : 'will lock when the first run is recorded'}.</p>
            </Card>
            {!readOnly && <PlaybookLinksCard exp={exp} seededTotal={seededTotal} />}
            <Card>
              <h2 className="font-semibold">Conditions</h2>
              <ul className="mt-2 space-y-2 text-sm">{exp.conditions.map((c) => <li key={c.id} className="rounded-lg border border-line p-2"><strong>{c.label}</strong> · {c.kind} {c.skillName && <>· {c.skillName} {c.skillVersion && `(${c.skillVersion})`}</>}<span className="block text-muted">Differs: {c.difference || 'baseline'}</span></li>)}</ul>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2"><div><dt className="text-muted">Model</dt><dd>{exp.environment.model || 'unknown'}</dd></div><div><dt className="text-muted">Claude Code</dt><dd>{exp.environment.claudeCodeVersion || 'unknown'}</dd></div><div><dt className="text-muted">OS</dt><dd>{exp.environment.os || 'unknown'}</dd></div><div><dt className="text-muted">Planned runs / condition</dt><dd>{exp.plannedRuns}</dd></div></dl>
            </Card>
          </div>
        </div>
      </TabPanel>

      {/* ------------------------------- RECORD ------------------------------- */}
      <TabPanel id="record" active={tab === 'record'}>
        {readOnly ? (
          <Callout tone="info" title="The demo is read-only">Open &ldquo;Create my own from this structure&rdquo; to get an editable experiment with no data in it.</Callout>
        ) : inLoop ? (
          <div className="space-y-3">
            <Callout tone="info" title="Record these runs in the Skill Improvement Loop">Each run belongs to a specific proposal, so it is entered there. This list is read-only.</Callout>
            <ul className="space-y-2" data-testid="run-list">
              {exp.runs.map((r) => {
                const c = exp.conditions.find((x) => x.id === r.conditionId);
                return <Card as="li" key={r.id}><p className="font-semibold">{c?.label} · {r.caseId ?? `run ${r.index}`}</p><p className="text-sm text-muted">Verdict: {r.verdict ?? 'unknown'} · Ground truth: {r.gradedTruth ?? 'not applied yet'} · Matched: {r.successMet === null ? 'not graded' : r.successMet ? 'yes' : 'no'}</p></Card>;
              })}
            </ul>
          </div>
        ) : (
          <div className="space-y-5">
            <RunForm key={editing?.id ?? 'new'} exp={exp} editing={editing} onSave={saveRun} onCancel={() => setEditing(null)} />
            <section aria-labelledby="runs-h">
              <h2 id="runs-h" className="mb-2 text-lg font-semibold">Recorded runs</h2>
              {exp.runs.length === 0 ? <EmptyState title="No runs yet" icon="flask">Record the same fixture and prompt for each condition, several times. Missing evidence is shown as unknown in the comparison.</EmptyState> : (
                <ul className="space-y-2" data-testid="run-list">
                  {exp.runs.map((r) => {
                    const c = exp.conditions.find((x) => x.id === r.conditionId);
                    const evs = ev.filter((x) => x.runId === r.id);
                    return (
                      <Card as="li" key={r.id}>
                        <p className="font-semibold">{c?.label} · run {r.index} {r.attempt !== 'completed' && <Badge tone="warn">{ATTEMPT_LABELS[r.attempt]}</Badge>}</p>
                        {(r.skillVersion || r.fixtureVersion || r.context) && <p className="text-xs text-muted">{[r.skillVersion && `version ${r.skillVersion}`, r.fixtureVersion && `fixture v${r.fixtureVersion}`, r.context && `context: ${r.context}`].filter(Boolean).join(' · ')}</p>}
                        <p className="text-sm text-muted">Tests: {r.testsPassed !== null && r.testsTotal !== null ? `${r.testsPassed}/${r.testsTotal} (${r.testsProvenance})` : 'unknown'} · Success: {r.successMet === null ? 'not assessed' : r.successMet ? 'yes' : 'no'} · Runtime: {r.metrics.runtimeSec?.value ?? 'unknown'} · Effort: {r.metrics.developerEffortMin?.value ?? 'unknown'} · Rubric assessed: {Object.values(r.rubric).filter((v) => v !== null && v !== undefined).length}/4</p>
                        {r.observations && <p className="mt-1 text-sm">{r.observations}</p>}
                        {evs.length > 0 && <ul className="mt-1 text-xs text-muted">{evs.map((e) => <li key={e.id} className="flex items-center gap-2"><Badge tone="teal">{e.kind}</Badge>{e.name} · {e.provenance} · {e.size} bytes <ConfirmButton label="Remove" confirmLabel="Remove evidence" onConfirm={() => deleteEvidence(e.id)} /></li>)}</ul>}
                        <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { setEditing(r); window.scrollTo({ top: 0 }); }}>Edit</Button><ConfirmButton label="Delete run" confirmLabel="Delete run" onConfirm={async () => { await persist({ ...exp, runs: exp.runs.filter((x) => x.id !== r.id) }); toast('Run deleted'); }} /></div>
                      </Card>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </TabPanel>

      {/* ------------------------------- COMPARE ------------------------------- */}
      <TabPanel id="compare" active={tab === 'compare'}>
        <div className="space-y-5">
          <ComparisonView experiment={exp} seededTotal={seededTotal} />
          <Card className="space-y-3">
            <h2 className="font-semibold">Write-up</h2>
            <p className="text-xs text-muted">Keep observations (what was recorded) apart from the conclusion (what you infer), and state the limitations.</p>
            <TextArea label="Observations" rows={3} value={draft.observations} disabled={readOnly} onChange={(e) => patch({ observations: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} data-testid="exp-observations" />
            <TextArea label="Conclusion (interpretation)" rows={3} value={draft.conclusion} disabled={readOnly} onChange={(e) => patch({ conclusion: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} data-testid="exp-conclusion" />
            <TextArea label="Limitations" rows={3} value={draft.limitations} disabled={readOnly} onChange={(e) => patch({ limitations: e.target.value })} onBlur={() => void persist({ ...exp, ...draft })} data-testid="exp-limitations" />
            {!setupLocked && <SelectField label="Status" value={exp.status} onChange={async (e) => { await persist({ ...exp, ...draft, status: e.target.value as Experiment['status'] }); toast('Status updated'); }}><option value="draft">Draft</option><option value="recording">Recording</option><option value="concluded">Concluded</option></SelectField>}
          </Card>
        </div>
      </TabPanel>

      {/* ------------------------------- REPORT ------------------------------- */}
      <TabPanel id="report" active={tab === 'report'}>
        <div className="space-y-4">
          <Callout tone="info" title="Exports contain exactly what you recorded">Every value keeps its provenance label, unknowns stay unknown, and the report states that Claude Forge did not run Claude. Evidence files you attached are included in the JSON export.</Callout>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="download" onClick={exportJson} data-testid="export-json">Export JSON record</Button>
            <Button icon="download" onClick={() => { downloadText(report, `experiment-report.md`, 'text/markdown'); toast('Report exported (Markdown)'); }} data-testid="export-report">Export Markdown report</Button>
          </div>
          <pre tabIndex={0} className="code-scroll max-h-[32rem] rounded-lg border border-line bg-surface2 p-3 text-xs" data-testid="report-preview"><code>{report}</code></pre>
          <p className="text-xs text-muted">Method background: <SafeLink href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents">Anthropic - Demystifying evals for AI agents</SafeLink>. For Skills specifically, the Claude Code Skills documentation also describes the skill-creator plugin's benchmark mode: <SafeLink href="https://code.claude.com/docs/en/skills">Claude Code docs - Skills</SafeLink>. Forge does not run any of them.</p>
        </div>
      </TabPanel>
    </div>
  );
}

export type { Evidence };
