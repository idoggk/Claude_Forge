import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Callout, SelectField, TextArea, TextInput, useToast } from '@/components/ui';
import { CONDITION_KIND_LABELS, ExperimentSchema, METRICS, type ConditionKind, type MetricId } from '@/domain/experiments/model';
import { FIXTURES, fixtureHash, getFixture } from '@/fixtures';
import { saveExperiment } from '@/persistence/repo';
import { useSkills } from '@/app/hooks';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

interface CondDraft { label: string; kind: ConditionKind; skillName: string; skillVersion: string; difference: string }

export function NewExperimentForm({ onCancel }: { onCancel: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const { data: skills } = useSkills();
  const [fixtureId, setFixtureId] = useState(FIXTURES[0]!.id as string);
  const fx = getFixture(fixtureId);
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [criteria, setCriteria] = useState((FIXTURES[0]!.successCriteria).join('\n'));
  const [prompt, setPrompt] = useState(FIXTURES[0]!.prompt);
  const [runs, setRuns] = useState(3);
  const [measures, setMeasures] = useState<MetricId[]>(FIXTURES[0]!.suggestedMeasures);
  const [env, setEnv] = useState({ claudeCodeVersion: '', model: '', settings: '', os: '', notes: '' });
  const [conds, setConds] = useState<CondDraft[]>([
    { label: 'A', kind: 'no-skill', skillName: '', skillVersion: '', difference: 'Baseline: no Skill available' },
    { label: 'B', kind: 'skill', skillName: '', skillVersion: '', difference: '' },
  ]);
  const [customLabel, setCustomLabel] = useState('');
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pickFixture = (id: string) => {
    setFixtureId(id);
    const f = getFixture(id);
    if (f) { setPrompt(f.prompt); setCriteria(f.successCriteria.join('\n')); setMeasures(f.suggestedMeasures); }
  };
  const setCond = (i: number, patch: Partial<CondDraft>) => setConds((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async () => {
    const problems: string[] = [];
    if (!title.trim()) problems.push('Give the experiment a title.');
    if (!hypothesis.trim()) problems.push('Write a hypothesis before any runs - what do you expect, and what would change your mind?');
    if (conds.length < 2) problems.push('Add at least two conditions.');
    conds.forEach((c) => { if (c.kind !== 'no-skill' && !c.difference.trim()) problems.push(`Condition ${c.label}: state exactly what differs from the baseline.`); if ((c.kind === 'skill' || c.kind === 'custom-revised' || c.kind === 'alternative') && !c.skillName.trim()) problems.push(`Condition ${c.label}: name the Skill or technique.`); });
    if (new Set(conds.map((c) => c.label.trim())).size !== conds.length) problems.push('Condition labels must be unique.');
    if (fixtureId === 'custom' && !customLabel.trim()) problems.push('Describe your custom fixture.');
    if (problems.length) { setErrs(problems); return; }
    setErrs([]);
    setBusy(true);
    try {
      const now = nowIso();
      const hash = fx ? await fixtureHash(fx.id) : null;
      const exp = ExperimentSchema.parse({
        id: newId('exp'), title: title.trim(), problem, hypothesis,
        fixture: fx ? { id: fx.id, label: fx.label, version: fx.version, hash } : { id: 'custom', label: customLabel.trim(), version: '', hash: null },
        successCriteria: criteria.split('\n').map((s) => s.trim()).filter(Boolean),
        prompt, environment: env, plannedMeasures: measures, plannedRuns: runs,
        conditions: conds.map((c) => ({ id: newId('cond'), label: c.label.trim(), kind: c.kind, skillName: c.skillName.trim(), skillVersion: c.skillVersion.trim(), difference: c.difference.trim() })),
        runs: [], status: 'draft', createdAt: now, updatedAt: now,
      });
      await saveExperiment(exp);
      toast('Experiment created');
      nav(`/battle-lab/${exp.id}`);
    } catch (e) {
      setErrs([(e as Error).message]);
    } finally { setBusy(false); }
  };

  return (
    <Card className="mb-6" aria-labelledby="new-exp-h">
      <h2 id="new-exp-h" className="text-xl font-semibold">New experiment</h2>
      <p className="mt-1 text-sm text-muted">Decide everything below <strong>before</strong> the first run. Forge locks the rubric when you record the first run.</p>
      <form className="mt-4 space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Does skill X help on the merge-cascade fixture?" data-testid="exp-title" />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Fixture" value={fixtureId} onChange={(e) => pickFixture(e.target.value)} hint={fx?.summary ?? 'Describe your own fixture below. Without a fixture hash you cannot show every condition used identical files.'} data-testid="exp-fixture">
            {FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            <option value="custom">My own fixture / task</option>
          </SelectField>
          {fixtureId === 'custom' && <TextInput label="Describe your fixture" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />}
          <TextArea label="Problem statement" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
          <TextArea label="Hypothesis (what you expect; what would change your mind)" rows={2} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} data-testid="exp-hypothesis" />
          <TextArea label="Success criteria (one per line)" rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          <TextArea label="Prompt - identical for every condition" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        {fx && <Callout tone="info" title="How to get objective results for this fixture">{fx.objectiveHow} Download the fixture pack from the experiment page; its hash is recorded automatically.</Callout>}

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">Conditions</legend>
          {conds.map((c, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-line p-3 md:grid-cols-2" data-testid={`cond-${i}`}>
              <TextInput label="Label" value={c.label} onChange={(e) => setCond(i, { label: e.target.value })} maxLength={40} />
              <SelectField label="Kind" value={c.kind} onChange={(e) => setCond(i, { kind: e.target.value as ConditionKind })}>{(Object.keys(CONDITION_KIND_LABELS) as ConditionKind[]).map((k) => <option key={k} value={k}>{CONDITION_KIND_LABELS[k]}</option>)}</SelectField>
              {c.kind !== 'no-skill' && (
                <>
                  <TextInput label="Skill / technique name" value={c.skillName} onChange={(e) => setCond(i, { skillName: e.target.value })} list="my-skills" data-testid={`cond-skill-${i}`} hint="Match your Workshop Skill's name to link it to the capstone." />
                  <TextInput label="Skill version / revision" value={c.skillVersion} onChange={(e) => setCond(i, { skillVersion: e.target.value })} placeholder="commit, release or snapshot label" />
                  <div className="md:col-span-2"><TextInput label="Exactly what differs from the baseline" value={c.difference} onChange={(e) => setCond(i, { difference: e.target.value })} data-testid={`cond-diff-${i}`} /></div>
                </>
              )}
              {conds.length > 2 && <div className="md:col-span-2"><Button size="sm" variant="ghost" onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))}>Remove condition</Button></div>}
            </div>
          ))}
          <datalist id="my-skills">{(skills ?? []).map((s) => <option key={s.id} value={s.name} />)}</datalist>
          {conds.length < 4 && <Button size="sm" onClick={() => setConds((cs) => [...cs, { label: String.fromCharCode(65 + cs.length), kind: 'alternative', skillName: '', skillVersion: '', difference: '' }])}>Add condition {String.fromCharCode(65 + conds.length)}</Button>}
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">Planned measurements</legend>
          <p className="text-sm text-muted">Anything you plan but cannot measure stays <em>unknown</em> - never zero.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{METRICS.map((m) => <label key={m.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={measures.includes(m.id)} onChange={() => setMeasures((cur) => cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id])} /><span><strong>{m.label}</strong><span className="block text-xs text-muted">{m.help}</span></span></label>)}</div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Runs per condition (plan)" value={String(runs)} onChange={(e) => setRuns(Number(e.target.value))} hint="3 is the minimum for a directional reading.">{[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</SelectField>
          <TextInput label="Claude Code version (if known)" value={env.claudeCodeVersion} onChange={(e) => setEnv({ ...env, claudeCodeVersion: e.target.value })} />
          <TextInput label="Model (if known)" value={env.model} onChange={(e) => setEnv({ ...env, model: e.target.value })} />
          <TextInput label="Settings that matter" value={env.settings} onChange={(e) => setEnv({ ...env, settings: e.target.value })} placeholder="effort, permission mode…" />
          <TextInput label="OS / execution environment" value={env.os} onChange={(e) => setEnv({ ...env, os: e.target.value })} placeholder="Windows 11, WSL…" />
          <TextInput label="Environment notes" value={env.notes} onChange={(e) => setEnv({ ...env, notes: e.target.value })} />
        </div>

        {errs.length > 0 && <Callout tone="bad" role="alert" title="Fix these first"><ul className="list-disc pl-4" data-testid="exp-errors">{errs.map((x) => <li key={x}>{x}</li>)}</ul></Callout>}
        <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary" size="lg" disabled={busy} data-testid="create-experiment">{busy ? 'Creating…' : 'Create experiment'}</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div>
      </form>
    </Card>
  );
}
