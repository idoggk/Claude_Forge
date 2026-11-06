import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Callout, Card, EmptyState, LinkButton, PageHeader, SelectField, Spinner, TextArea, TextInput, useToast } from '@/components/ui';
import { usePlaybooks } from '@/app/hooks';
import { getPilotStarter } from '@/content/pilot/starters';
import { buildPilotExperiment, pilotInputProblems, type PilotInput } from '@/domain/pilot/pilot';
import { linkExperimentToStep, saveExperiment } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

/** Steps 1 to 3 of the guided experiment: the plan. Hints are placeholders; nothing is pre-filled. */
export default function PilotStart() {
  const { starterId = '' } = useParams();
  const st = getPilotStarter(starterId);
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: playbooks } = usePlaybooks();
  const [f, setF] = useState({ title: '', problem: '', criteria: '', baseline: '', improved: '', difference: '', hypothesis: '', prompt: '', technique: '', skillVersion: '', model: '', claudeCodeVersion: '' });
  const [pbId, setPbId] = useState(params.get('playbook') ?? '');
  const [stepId, setStepId] = useState(params.get('step') ?? '');
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!st) return <EmptyState title="Unknown starter" action={<LinkButton to="/pilot" variant="primary">Back to the first experiment</LinkButton>}>Pick one of the three starters.</EmptyState>;
  if (!playbooks) return <Spinner label="Loading" />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const pb = playbooks.find((p) => p.id === pbId);

  const input = (): PilotInput => ({
    starter: st.id, title: f.title, problem: f.problem, criteria: f.criteria.split('\n'), baseline: f.baseline, improved: f.improved, difference: f.difference, hypothesis: f.hypothesis, prompt: f.prompt,
    technique: f.technique, skillVersion: f.skillVersion, playbookId: pb && stepId ? pb.id : null, stepId: pb && stepId ? stepId : null, env: { model: f.model, claudeCodeVersion: f.claudeCodeVersion },
  });

  const create = async () => {
    const problems = pilotInputProblems(input());
    if (problems.length) { setErrs(problems); return; }
    setErrs([]);
    setBusy(true);
    try {
      const r = buildPilotExperiment(input(), newId('exp'), newId, nowIso());
      if (!r.ok) { setErrs(r.problems); return; }
      await saveExperiment(r.experiment);
      if (pb && stepId) {
        const l = await linkExperimentToStep(pb.id, stepId, r.experiment.id);
        toast(l.ok ? 'Created, and linked to the playbook step (not yet judged)' : `Created. ${l.reason}`);
      } else toast('Experiment created');
      nav(`/pilot/${r.experiment.id}`);
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="pilot-start">
      <PageHeader eyebrow="First experiment · steps 1 to 3 of 8" title={st.title} subtitle="Write the plan before any run. Everything you enter here is yours: Forge adds nothing and runs nothing." actions={<LinkButton to="/pilot" variant="ghost" size="sm">All starters</LinkButton>} />
      <form className="grid gap-4 lg:grid-cols-[1fr_18rem]" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <div className="space-y-4">
          <Card aria-labelledby="s1-h" className="space-y-3">
            <h2 id="s1-h" className="text-lg font-semibold">1 · Choose the problem</h2>
            <TextInput label="A short title" value={f.title} maxLength={200} onChange={set('title')} data-testid="p-title" />
            <TextArea label="The task, in one or two sentences" rows={3} value={f.problem} placeholder={st.problemHint} maxLength={3000} onChange={set('problem')} data-testid="p-problem" />
            <TextArea label="Your yes/no checks (one per line), written before any run" rows={3} value={f.criteria} placeholder={st.criteriaHint} maxLength={3000} onChange={set('criteria')} data-testid="p-criteria" hint="If a check needs your judgement, say what you will look at. Vague checks (&ldquo;looks good&rdquo;) make the result hard to trust." />
          </Card>
          <Card aria-labelledby="s2-h" className="space-y-3">
            <h2 id="s2-h" className="text-lg font-semibold">2 · The baseline: {st.baselineLabel}</h2>
            <TextArea label="What it is" rows={3} value={f.baseline} placeholder={st.baselineHint} maxLength={1000} onChange={set('baseline')} data-testid="p-baseline" />
          </Card>
          <Card aria-labelledby="s3-h" className="space-y-3">
            <h2 id="s3-h" className="text-lg font-semibold">3 · The improved approach: {st.improvedLabel}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput label={st.techniqueLabel} value={f.technique} maxLength={200} onChange={set('technique')} hint={st.techniqueHint} data-testid="p-technique" />
              {st.id === 'skill' && <TextInput label="Version or commit (if you know it)" value={f.skillVersion} maxLength={120} onChange={set('skillVersion')} />}
            </div>
            <TextArea label="What it is" rows={3} value={f.improved} placeholder={st.improvedHint} maxLength={1000} onChange={set('improved')} data-testid="p-improved" />
            <TextArea label="The one thing that differs from the baseline" rows={2} value={f.difference} placeholder={st.differenceHint} maxLength={1000} onChange={set('difference')} data-testid="p-difference" hint="If you change two things, you cannot tell which one mattered." />
            <TextArea label="The exact prompt or input you will use in every run" rows={4} mono value={f.prompt} placeholder={st.promptHint} maxLength={6000} onChange={set('prompt')} data-testid="p-prompt" />
            <TextArea label="What you expect, and what would change your mind" rows={2} value={f.hypothesis} placeholder={st.hypothesisHint} maxLength={3000} onChange={set('hypothesis')} data-testid="p-hypothesis" />
          </Card>
          {errs.length > 0 && <Callout tone="bad" role="alert" title="Finish the plan first"><ul className="list-disc pl-4" data-testid="p-errors">{errs.map((x) => <li key={x}>{x}</li>)}</ul></Callout>}
          <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary" size="lg" disabled={busy} data-testid="p-create">{busy ? 'Creating…' : 'Create the experiment and get the run sheet'}</Button></div>
        </div>

        <aside className="space-y-4" aria-label="Optional details">
          <Card>
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">Setup details (optional)</summary>
              <div className="mt-2 grid gap-3"><TextInput label="Model, if you know it" value={f.model} maxLength={100} onChange={set('model')} /><TextInput label="Claude Code version, if you know it" value={f.claudeCodeVersion} maxLength={60} onChange={set('claudeCodeVersion')} /></div>
              <p className="mt-2 text-xs text-muted">Blank means unknown. It is never filled in for you.</p>
            </details>
          </Card>
          {playbooks.length > 0 && (
            <Card>
              <details open={Boolean(pbId)}>
                <summary className="min-h-11 cursor-pointer text-sm font-semibold">Link to a playbook step (optional)</summary>
                <div className="mt-2 grid gap-3">
                  <SelectField label="Playbook" value={pbId} onChange={(e) => { setPbId(e.target.value); setStepId(''); }} data-testid="p-playbook"><option value="">None</option>{playbooks.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</SelectField>
                  {pb && <SelectField label="Step" value={stepId} onChange={(e) => setStepId(e.target.value)}><option value="">Choose…</option>{pb.steps.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>)}</SelectField>}
                </div>
                <p className="mt-2 text-xs text-muted">Linking records the experiment as evidence for that step. It does not verify the step.</p>
              </details>
            </Card>
          )}
          <Card><h2 className="text-sm font-semibold">Why a baseline and one difference?</h2><p className="mt-1 text-sm text-muted">Without a baseline you cannot say what changed anything. With two differences you cannot say which one mattered.</p></Card>
        </aside>
      </form>
    </div>
  );
}
