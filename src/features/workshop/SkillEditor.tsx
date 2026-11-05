import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, Icon, LinkButton, PageHeader, SafeLink, SelectField, Segmented, Spinner, TabPanel, Tabs, TextArea, TextInput, cx, useToast } from '@/components/ui';
import { getDb } from '@/persistence/db';
import { AdoptionPanel } from '@/features/arsenal/AdoptionPanel';
import { restoreRevision, saveSkill, snapshotRevision } from '@/persistence/repo';
import { contentOf, type Invocation, type LiveTest, type Resource, type Scenario, type SkillDraft } from '@/domain/skills/model';
import { designChecks, validateSkillContent, type Finding } from '@/domain/skills/validate';
import { buildSkillZip, buildTestPlan, ExportBlockedError } from '@/domain/skills/export';
import { validateResourcePath, isValidSkillName, slugifySkillName } from '@/domain/skills/paths';
import { predictActivation, triggerFingerprint } from '@/domain/skills/trigger';
import { LISTING_CAP, PORTABLE_DESCRIPTION_MAX } from '@/domain/skills/fields';
import { downloadBlob, downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { LoopBanner } from '@/features/loop/LoopBanner';
import { TuningPanel } from './TuningPanel';
import { QualityPanel } from './QualityPanel';
import { RevisionCompare } from './RevisionCompare';

type TabId = 'basics' | 'instructions' | 'resources' | 'scenarios' | 'tuning' | 'validate' | 'review' | 'preview' | 'test' | 'export';

const SEV_TONE = { error: 'bad', warning: 'warn', info: 'neutral' } as const;

function FindingList({ findings, empty }: { findings: Finding[]; empty: string }) {
  if (findings.length === 0) return <p className="text-sm text-ok" data-testid="no-findings">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm" data-testid="findings">
      {findings.map((f, i) => (
        <li key={`${f.id}-${i}`} className="flex gap-2 rounded-lg border border-line p-2" data-finding={f.id}>
          <Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>
          <span className="min-w-0"><span className="text-xs uppercase tracking-wide text-muted">{f.area}</span><span className="block">{f.message}</span>{f.fix && <span className="block text-muted">Fix: {f.fix}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

function LinesField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return <TextArea label={label} hint={hint ?? 'One per line.'} rows={4} value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={() => onChange(value.map((s) => s.trim()).filter(Boolean))} />;
}

export default function SkillEditor() {
  const { skillId = '' } = useParams();
  const [search] = useSearchParams();
  const loopId = search.get('loop');
  const toast = useToast();
  const [draft, setDraft] = useState<SkillDraft | null | undefined>(undefined);
  const [tab, setTab] = useState<TabId>('basics');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const latest = useRef<SkillDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void getDb().customSkills.get(skillId).then((d) => { if (alive) { setDraft(d ?? null); latest.current = d ?? null; } });
    return () => { alive = false; };
  }, [skillId]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (latest.current) { setSaveState('saving'); await saveSkill(latest.current); setSaveState('saved'); }
  }, []);
  useEffect(() => () => { void flush(); }, [flush]);

  const update = useCallback((patch: Partial<SkillDraft>) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      latest.current = next;
      return next;
    });
    setSaveState('unsaved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }, [flush]);

  const content = useMemo(() => (draft ? contentOf(draft) : null), [draft]);
  const validation = useMemo(() => (content ? validateSkillContent(content) : null), [content]);
  const design = useMemo(() => (content ? designChecks(content) : []), [content]);

  if (draft === undefined) return <Spinner label="Opening the Skill" />;
  if (draft === null || !content || !validation) return <EmptyState title="Skill not found" action={<LinkButton to="/workshop" variant="primary">Back to the Workshop</LinkButton>}>It may have been deleted.</EmptyState>;

  const nameOk = isValidSkillName(draft.name);

  return (
    <div>
      <PageHeader
        eyebrow="Skill Workshop"
        title={draft.name || 'Untitled Skill'}
        subtitle={<span aria-live="polite" data-testid="save-state">{saveState === 'saved' ? '✓ Saved on this device' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes…'}</span>}
        actions={<><Button onClick={() => { void flush().then(() => toast('Saved')); }} data-testid="save-skill">Save now</Button><LinkButton to="/workshop" variant="ghost">All Skills</LinkButton></>}
      />
      {loopId && <LoopBanner loopId={loopId} skillId={skillId} />}
      <div className="mb-3 flex flex-wrap gap-2" data-testid="validation-summary">
        <Badge tone={validation.errors === 0 ? 'ok' : 'bad'}>{validation.errors === 0 ? 'No validation errors' : `${validation.errors} error(s)`}</Badge>
        <Badge tone={validation.warnings === 0 ? 'neutral' : 'warn'}>{validation.warnings} warning(s)</Badge>
        <Badge>{draft.scenarios.length} scenario(s)</Badge>
        <Badge>{draft.liveTests.length} live test(s)</Badge>
      </div>

      <Tabs<TabId> label="Workshop sections" value={tab} onChange={setTab} tabs={[
        { id: 'basics', label: 'Basics' }, { id: 'instructions', label: 'Instructions' }, { id: 'resources', label: 'Resources', badge: draft.references.length ? <Badge>{draft.references.length}</Badge> : undefined },
        { id: 'scenarios', label: 'Scenarios & Dojo' }, { id: 'tuning', label: 'Trigger tuning' }, { id: 'validate', label: 'Validate', badge: validation.errors ? <Badge tone="bad">{validation.errors}</Badge> : undefined }, { id: 'review', label: 'Quality review' },
        { id: 'preview', label: 'Preview' }, { id: 'test', label: 'Live test' }, { id: 'export', label: 'Export & history' },
      ]} />

      {/* ------------------------------ BASICS ------------------------------ */}
      <TabPanel id="basics" active={tab === 'basics'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4">
            <div>
              <TextInput label="Name" value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={200} spellCheck={false} data-testid="skill-name" error={draft.name && !nameOk ? 'Use 1-64 lowercase letters/digits separated by single hyphens (no spaces, capitals or underscores).' : null} hint="Also the folder name. Example: merge-chain-debugger" />
              {draft.name && !nameOk && slugifySkillName(draft.name) && <Button size="sm" variant="ghost" onClick={() => update({ name: slugifySkillName(draft.name) })}>Use “{slugifySkillName(draft.name)}”</Button>}
            </div>
            <div>
              <TextArea label="Description - what it does AND when to use it" rows={5} value={draft.description} onChange={(e) => update({ description: e.target.value })} data-testid="skill-description" hint={`${draft.description.length} chars · portable limit ${PORTABLE_DESCRIPTION_MAX} · Claude Code truncates description + when_to_use at ${LISTING_CAP}. Include a "Use when…" trigger and a "Not for…" boundary.`} />
            </div>
            <TextArea label="when_to_use (optional extra trigger context - Claude Code only)" rows={2} value={draft.whenToUse} onChange={(e) => update({ whenToUse: e.target.value })} />
            <div>
              <p className="mb-1 text-sm font-semibold">Who can invoke it?</p>
              <Segmented<Invocation> label="Invocation" value={draft.invocation} onChange={(invocation) => update({ invocation })} options={[{ value: 'auto-and-manual', label: 'Claude or me' }, { value: 'manual-only', label: 'Only me (/name)' }, { value: 'auto-only', label: 'Only Claude' }]} />
              <p className="mt-1 text-xs text-muted">{draft.invocation === 'manual-only' ? 'Adds disable-model-invocation: true. The description will not be in context.' : draft.invocation === 'auto-only' ? 'Adds user-invocable: false. Hidden from your / menu; Claude can still use it.' : 'Default: both you (/name) and Claude (from the description).'}</p>
            </div>
          </Card>
          <Card className="space-y-4">
            <h2 className="font-semibold">Claude Code-specific fields <Badge tone="warn">rejected by claude.ai / API uploads</Badge></h2>
            <TextInput label="argument-hint" value={draft.argumentHint} onChange={(e) => update({ argumentHint: e.target.value })} placeholder="[seed]" />
            <TextInput label="allowed-tools (scope tightly)" value={draft.allowedTools} onChange={(e) => update({ allowedTools: e.target.value })} placeholder="Bash(npm test *)" hint="Pre-approves tools for the turn the Skill runs in. Unrestricted Bash is flagged." />
            <SelectField label="context" value={draft.context} onChange={(e) => update({ context: e.target.value as '' | 'fork' })}><option value="">default</option><option value="fork">fork (run in a subagent)</option></SelectField>
            <div className="grid gap-3 sm:grid-cols-2"><TextInput label="agent (with fork)" value={draft.agent} onChange={(e) => update({ agent: e.target.value })} /><TextInput label="model" value={draft.model} onChange={(e) => update({ model: e.target.value })} /></div>
            <TextInput label="paths (glob, optional)" value={draft.paths} onChange={(e) => update({ paths: e.target.value })} />
            <h2 className="pt-2 font-semibold">Portable fields</h2>
            <div className="grid gap-3 sm:grid-cols-2"><TextInput label="license" value={draft.license} onChange={(e) => update({ license: e.target.value })} placeholder="MIT" /><TextInput label="compatibility (≤500 chars)" value={draft.compatibility} onChange={(e) => update({ compatibility: e.target.value })} /></div>
            <fieldset><legend className="text-sm font-semibold">metadata (string values)</legend>
              {draft.metadata.map((m, i) => (
                <div key={i} className="mt-2 flex gap-2"><input aria-label={`Metadata key ${i + 1}`} className="min-h-11 w-1/3 rounded-lg border border-line bg-surface2 px-2" value={m.key} onChange={(e) => update({ metadata: draft.metadata.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} /><input aria-label={`Metadata value ${i + 1}`} className="min-h-11 flex-1 rounded-lg border border-line bg-surface2 px-2" value={m.value} onChange={(e) => update({ metadata: draft.metadata.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} /><Button size="sm" variant="ghost" aria-label={`Remove metadata ${i + 1}`} icon="x" onClick={() => update({ metadata: draft.metadata.filter((_, j) => j !== i) })} /></div>
              ))}
              <Button size="sm" variant="ghost" icon="plus" className="mt-2" onClick={() => update({ metadata: [...draft.metadata, { key: '', value: '' }] })}>Add metadata</Button>
            </fieldset>
          </Card>
        </div>
      </TabPanel>

      {/* ---------------------------- INSTRUCTIONS ---------------------------- */}
      <TabPanel id="instructions" active={tab === 'instructions'}>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <TextArea label="Instructions (Markdown body of SKILL.md)" rows={18} mono value={draft.instructions} onChange={(e) => update({ instructions: e.target.value })} data-testid="skill-instructions" hint="Imperative, numbered, verifiable steps. Link supporting files like [guide](references/guide.md). Keep under ~500 lines. Never include secrets." />
          <div className="space-y-4">
            <LinesField label="Use cases" value={draft.useCases} onChange={(useCases) => update({ useCases })} hint="One per line. Generated into a “When to use” section." />
            <LinesField label="Non-use cases" value={draft.nonUseCases} onChange={(nonUseCases) => update({ nonUseCases })} hint="One per line. Generated into “When not to use”." />
          </div>
        </div>
      </TabPanel>

      {/* ------------------------------ RESOURCES ------------------------------ */}
      <TabPanel id="resources" active={tab === 'resources'}>
        <Callout tone="info" title="Supporting files are exported as inert text">Allowed: .md .txt .json .yaml .yml .csv .toml .py .js .mjs .ts .sh, relative paths only (no <code>..</code>, absolute paths, hidden files or backslashes). Scripts are never run by Forge - and anyone installing the Skill should read them first.</Callout>
        <div className="mt-4 space-y-4" data-testid="resources">
          {draft.references.length === 0 && <EmptyState title="No supporting files" icon="book" action={<Button onClick={() => update({ references: [{ path: 'references/guide.md', content: '# Guide\n\n' }] })}>Add references/guide.md</Button>}>Move bulky reference material out of SKILL.md and link to it; Claude reads it only when needed.</EmptyState>}
          {draft.references.map((r, i) => {
            const chk = validateResourcePath(r.path);
            const set = (patch: Partial<Resource>) => update({ references: draft.references.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <Card key={i} className="space-y-2">
                <TextInput label={`File ${i + 1} path`} value={r.path} onChange={(e) => set({ path: e.target.value })} spellCheck={false} error={r.path && !chk.ok ? chk.reason : null} data-testid={`res-path-${i}`} />
                <TextArea label="Contents" rows={6} mono value={r.content} onChange={(e) => set({ content: e.target.value })} />
                <ConfirmButton label="Remove file" confirmLabel="Remove" onConfirm={() => update({ references: draft.references.filter((_, j) => j !== i) })} />
              </Card>
            );
          })}
          <Button icon="plus" onClick={() => update({ references: [...draft.references, { path: '', content: '' }] })} data-testid="add-resource">Add a supporting file</Button>
        </div>
      </TabPanel>

      {/* ----------------------------- SCENARIOS & DOJO ----------------------------- */}
      <TabPanel id="scenarios" active={tab === 'scenarios'}>
        <ScenariosTab draft={draft} update={update} />
      </TabPanel>

      {/* ------------------------------- VALIDATE ------------------------------- */}
      <TabPanel id="tuning" active={tab === 'tuning'}>
        <TuningPanel draft={draft} onGoLive={() => setTab('test')} />
      </TabPanel>

      <TabPanel id="review" active={tab === 'review'}>
        <QualityPanel draft={draft} />
      </TabPanel>

      <TabPanel id="validate" active={tab === 'validate'}>
        <div className="space-y-4">
          <Callout tone="warn" title="Checks are advisory">Validation looks at structure and patterns. It cannot prove a Skill is safe or that Claude will use it correctly. Errors block export; warnings do not.</Callout>
          <Card><h2 className="mb-2 font-semibold">Validation ({validation.errors} errors, {validation.warnings} warnings)</h2><FindingList findings={validation.findings} empty="No findings. (Still read your own Skill once as a stranger would.)" /></Card>
          <Card><h2 className="mb-2 font-semibold">Design readiness</h2><FindingList findings={design} empty="Scenario coverage looks complete: 2+ positive, 2+ negative, 1+ ambiguous." /></Card>
        </div>
      </TabPanel>

      {/* -------------------------------- PREVIEW -------------------------------- */}
      <TabPanel id="preview" active={tab === 'preview'}>
        <div className="space-y-3">
          <p className="text-sm text-muted">This is exactly what is written into <code>{draft.name || '<name>'}/SKILL.md</code>.</p>
          <pre tabIndex={0} className="code-scroll max-h-[32rem] rounded-lg border border-line bg-surface2 p-3 text-xs" data-testid="skill-preview"><code>{validation.markdown}</code></pre>
          <p className="text-sm text-muted">Files in the ZIP: <code>{draft.name || '<name>'}/SKILL.md</code>{draft.references.map((r) => <span key={r.path}>, <code>{draft.name || '<name>'}/{r.path}</code></span>)}</p>
        </div>
      </TabPanel>

      {/* ---------------------------------- TEST ---------------------------------- */}
      <TabPanel id="test" active={tab === 'test'}>
        <LiveTestTab draft={draft} update={update} />
      </TabPanel>

      {/* ------------------------------ EXPORT & HISTORY ------------------------------ */}
      <TabPanel id="export" active={tab === 'export'}>
        <ExportTab draft={draft} update={update} errors={validation.errors} findings={validation.findings.filter((f) => f.severity === 'error')} />
      </TabPanel>
    </div>
  );
}

/* =================================================================================== */

function ScenariosTab({ draft, update }: { draft: SkillDraft; update: (p: Partial<SkillDraft>) => void }) {
  const [prompt, setPrompt] = useState('');
  const [expected, setExpected] = useState<Scenario['expected']>('activate');
  const [note, setNote] = useState('');
  const [drill, setDrill] = useState<Record<string, Scenario['expected']>>({});
  const add = () => {
    if (!prompt.trim()) return;
    update({ scenarios: [...draft.scenarios, { id: newId('sc'), prompt: prompt.trim(), expected, note: note.trim() }] });
    setPrompt(''); setNote('');
  };
  const LABEL = { activate: 'Should activate', 'not-activate': 'Should not', ambiguous: 'Ambiguous' } as const;
  return (
    <div className="space-y-4">
      <Callout tone="warn" title="Trigger Dojo: design on paper, then test for real">The overlap meter below counts shared words between a prompt and your description. It cannot prove how Claude will behave. Predict first, compare, then run the live tests.</Callout>
      <Card>
        <h2 className="font-semibold">Add a scenario</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_12rem]">
          <TextInput label="A prompt a user might type" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={600} data-testid="scenario-prompt" />
          <SelectField label="You expect" value={expected} onChange={(e) => setExpected(e.target.value as Scenario['expected'])} data-testid="scenario-expected"><option value="activate">Should activate</option><option value="not-activate">Should not activate</option><option value="ambiguous">Ambiguous</option></SelectField>
        </div>
        <div className="mt-2"><TextInput label="Why (optional)" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <Button className="mt-3" variant="primary" icon="plus" onClick={add} disabled={!prompt.trim()} data-testid="add-scenario">Add scenario</Button>
      </Card>

      {draft.scenarios.length === 0 ? <EmptyState title="No scenarios yet" icon="target">Write at least 2 prompts that should activate, 2 that should not (include a near-miss), and 1 ambiguous.</EmptyState> : (
        <ul className="space-y-3" data-testid="scenario-list">
          {draft.scenarios.map((s) => {
            const p = predictActivation(draft.description, draft.whenToUse, s.prompt);
            const mine = drill[s.id];
            const agrees = (s.expected === 'activate' && p.verdict === 'likely') || (s.expected === 'not-activate' && p.verdict === 'unlikely') || (s.expected === 'ambiguous' && p.verdict === 'ambiguous');
            return (
              <Card as="li" key={s.id}>
                <p className="font-medium">&ldquo;{s.prompt}&rdquo;</p>
                {s.note && <p className="text-sm text-muted">{s.note}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="accent">You expect: {LABEL[s.expected]}</Badge>
                  <Badge tone={p.verdict === 'likely' ? 'ok' : p.verdict === 'ambiguous' ? 'warn' : 'neutral'}>Overlap {Math.round(p.score * 100)}% · {p.verdict === 'likely' ? 'strong' : p.verdict === 'ambiguous' ? 'partial' : 'little'}</Badge>
                  <Badge tone={agrees ? 'ok' : 'warn'}>{agrees ? 'wording agrees with your expectation' : 'wording and expectation differ - revisit the description'}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{p.explanation}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted">Drill - predict what the description alone implies:</span>
                  {(['activate', 'not-activate', 'ambiguous'] as const).map((v) => <Button key={v} size="sm" variant={mine === v ? 'primary' : 'ghost'} onClick={() => setDrill({ ...drill, [s.id]: v })}>{LABEL[v]}</Button>)}
                  {mine && <span className="text-xs" role="status">{mine === s.expected ? 'Matches your recorded expectation.' : `You recorded “${LABEL[s.expected]}”.`} Real behaviour: not tested yet.</span>}
                </div>
                <div className="mt-2"><ConfirmButton label="Remove" confirmLabel="Remove scenario" onConfirm={() => update({ scenarios: draft.scenarios.filter((x) => x.id !== s.id) })} /></div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =================================================================================== */

function LiveTestTab({ draft, update }: { draft: SkillDraft; update: (p: Partial<SkillDraft>) => void }) {
  const toast = useToast();
  const [scenarioId, setScenarioId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [observed, setObserved] = useState<LiveTest['observed']>('activated');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const pick = (id: string) => { setScenarioId(id); const s = draft.scenarios.find((x) => x.id === id); if (s) setPrompt(s.prompt); };
  const name = draft.name || '<skill-name>';
  return (
    <div className="space-y-4">
      <Callout tone="warn" title="Forge cannot run Claude, so it cannot test your Skill for you">Offline checks cover structure, metadata, references and scenarios. Real triggering only shows up in a real Claude Code session - what you record below is <strong>your own observation</strong>, shown as such.</Callout>
      <Card>
        <h2 className="font-semibold">How to run a live test (from the Claude Code docs, read 2026-11-05)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Export the ZIP, read the <code>SKILL.md</code> inside, and extract the <code>{name}/</code> folder into <code>~/.claude/skills/</code> (personal) or <code>.claude/skills/</code> (project).</li>
          <li>Start a <strong>new</strong> Claude Code session and run <code>/skills</code> to confirm it is listed. <code>/reload-skills</code> is only needed for a newly created top-level skills directory.</li>
          <li>For each scenario, type the prompt in a fresh conversation and check the transcript for a Skill call naming <code>{name}</code>.</li>
          <li>Try <code>/{name}</code> directly. If it is not recognized, run <code>claude --debug</code> and look for refused names or YAML errors, or <code>claude plugin validate &lt;skills-dir&gt;</code> (Claude Code v2.1.233+).</li>
          <li>Record what actually happened below.</li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2"><Button icon="download" onClick={() => downloadText(buildTestPlan(contentOf(draft), draft.liveTests), `${draft.name || 'skill'}-test-plan.md`, 'text/markdown')} data-testid="download-plan">Download test plan (.md)</Button></div>
      </Card>

      <Card>
        <h2 className="font-semibold">Record an observation</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <SelectField label="Scenario (optional)" value={scenarioId} onChange={(e) => pick(e.target.value)}><option value="">Custom prompt</option>{draft.scenarios.map((s) => <option key={s.id} value={s.id}>{s.prompt.slice(0, 60)}</option>)}</SelectField>
          <SelectField label="What happened?" value={observed} onChange={(e) => setObserved(e.target.value as LiveTest['observed'])} data-testid="live-observed"><option value="activated">Skill activated</option><option value="not-activated">Skill did not activate</option><option value="partial">Partly / only after rephrasing</option><option value="unknown">Not sure</option></SelectField>
        </div>
        <div className="mt-2"><TextInput label="Prompt you typed" value={prompt} onChange={(e) => setPrompt(e.target.value)} data-testid="live-prompt" /></div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2"><TextInput label="Claude Code version (optional)" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="from claude --version" /><TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button className="mt-3" variant="primary" disabled={!prompt.trim()} data-testid="add-live-test" onClick={() => { update({ liveTests: [...draft.liveTests, { id: newId('lt'), scenarioId: scenarioId || null, prompt: prompt.trim(), testedAt: nowIso(), descriptionFingerprint: triggerFingerprint(draft.description, draft.whenToUse), claudeCodeVersion: version.trim(), observed, notes: notes.trim() }] }); setPrompt(''); setNotes(''); setScenarioId(''); toast('Observation recorded (your own note)'); }}>Record observation</Button>
      </Card>

      <Card>
        <h2 className="font-semibold">Recorded observations</h2>
        {draft.liveTests.length === 0 ? <p className="mt-1 text-sm text-muted">None yet.</p> : (
          <ul className="mt-2 space-y-2 text-sm" data-testid="live-tests">
            {draft.liveTests.map((t) => {
              const sc = draft.scenarios.find((s) => s.id === t.scenarioId);
              const differs = sc && ((sc.expected === 'activate' && t.observed === 'not-activated') || (sc.expected === 'not-activate' && t.observed === 'activated'));
              return (
                <li key={t.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line p-2">
                  <span className="min-w-0">&ldquo;{t.prompt}&rdquo; <Badge tone={differs ? 'warn' : 'neutral'}>{t.observed}</Badge> <Badge tone="teal">user-entered</Badge>{differs && <span className="block text-warn">Differs from your expectation - revise the description and re-test.</span>}<span className="block text-xs text-muted">{t.testedAt.slice(0, 10)}{t.claudeCodeVersion && ` · Claude Code ${t.claudeCodeVersion}`}{t.notes && ` · ${t.notes}`}</span></span>
                  <ConfirmButton label="Delete" confirmLabel="Delete" onConfirm={() => update({ liveTests: draft.liveTests.filter((x) => x.id !== t.id) })} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* =================================================================================== */

function ExportTab({ draft, update, errors, findings }: { draft: SkillDraft; update: (p: Partial<SkillDraft>) => void; errors: number; findings: Finding[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const [label, setLabel] = useState('');
  const name = draft.name || '<skill-name>';

  const doExport = async () => {
    setBusy(true); setErr(''); setDone(null);
    try {
      const out = await buildSkillZip(contentOf(draft));
      downloadBlob(out.blob, out.filename);
      update({ lastExportedAt: nowIso(), lastExportedName: out.filename });
      setDone(out.entries);
      toast('ZIP exported');
    } catch (e) {
      setErr(e instanceof ExportBlockedError ? 'Export blocked: fix the validation errors first.' : (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold">Export an installable Skill folder</h2>
        <p className="mt-1 text-sm text-muted">A ZIP containing <code>{name}/SKILL.md</code> and your supporting files - plain UTF-8 text, no scripts executed, no absolute paths, no secrets. <strong>Forge never installs anything for you.</strong></p>
        {errors > 0 && <div className="mt-3"><Callout tone="bad" title={`Export is blocked by ${errors} validation error(s)`} role="alert"><ul className="list-disc pl-4">{findings.map((f, i) => <li key={i}>{f.message}</li>)}</ul></Callout></div>}
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" size="lg" icon="download" disabled={errors > 0 || busy} onClick={() => void doExport()} data-testid="export-zip">{busy ? 'Building…' : 'Export ZIP'}</Button></div>
        {err && <div className="mt-3"><Callout tone="bad" role="alert" title="Could not export">{err}</Callout></div>}
        {done && <div className="mt-3" data-testid="export-done"><Callout tone="ok" role="status" title="ZIP downloaded">Contains: {done.map((d) => <code key={d} className="mr-2">{d}</code>)}</Callout></div>}
        {draft.lastExportedAt && !done && <p className="mt-2 text-sm text-muted">Last exported {new Date(draft.lastExportedAt).toLocaleString()} as {draft.lastExportedName}.</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Install it yourself (commands from the Claude Code docs, read 2026-11-05)</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Open the ZIP and read <code>SKILL.md</code> and every other file.</li>
          <li>Extract the <code>{name}/</code> folder into <code>~/.claude/skills/</code> (all projects) or your project&apos;s <code>.claude/skills/</code> (commit to share). <code>~</code> is your home directory (on Windows typically <code>C:\Users\&lt;you&gt;</code>).</li>
          <li>Windows PowerShell example for the personal location (assumes <code>~</code> is your user profile):
            <pre tabIndex={0} className="code-scroll mt-1 rounded-lg border border-line bg-surface2 p-2 text-xs"><code>{`Expand-Archive .\\${draft.name || 'skill-name'}.zip -DestinationPath "$env:USERPROFILE\\.claude\\skills"`}</code></pre></li>
          <li>Start a new Claude Code session and run <code>/skills</code>. Use <code>/reload-skills</code> only if you created the top-level skills directory just now.</li>
          <li>Uploading to claude.ai or the Skills API? Those accept only portable fields (<code>name, description, license, compatibility, metadata, allowed-tools</code>); Claude Code-specific fields cause a hard upload error.</li>
        </ol>
      </Card>

      <Card>
        <h2 className="font-semibold">Revision history</h2>
        <p className="mt-1 text-sm text-muted">Snapshot before each significant change, so you can tell what changed when behaviour shifts.</p>
        <div className="mt-2 flex flex-wrap items-end gap-2"><TextInput label="Snapshot label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. added near-miss exclusion" data-testid="snapshot-label" /><Button icon="plus" onClick={() => { update({ revisions: [...draft.revisions, snapshotRevision(draft, label)] }); setLabel(''); toast('Snapshot saved'); }} data-testid="save-snapshot">Save snapshot</Button></div>
        {draft.revisions.length === 0 ? <p className="mt-2 text-sm text-muted">No snapshots yet.</p> : (
          <ul className="mt-3 space-y-2 text-sm" data-testid="revisions">
            {[...draft.revisions].reverse().map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2">
                <span><strong>v{draft.revisions.length - i}</strong> · {r.label} <span className="text-muted">· {new Date(r.savedAt).toLocaleString()} · description {r.snapshot.description.length} chars, {r.snapshot.scenarios.length} scenarios</span></span>
                <ConfirmButton label="Restore" confirmLabel="Restore this version" icon="clock" onConfirm={() => { update(restoreRevision(draft, r)); toast('Restored - the current version was not snapshotted, save one first next time'); }} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <RevisionCompare draft={draft} />
      <AdoptionPanel entryId={`custom:${draft.id}`} heading="Arsenal record for this Skill" local />

      <p className="text-xs text-muted"><Icon name="info" size={14} className="mr-1 inline" />Related: <Link className="underline" to="/academy/lesson/L05-first-custom-skill">Lesson 5</Link> · <SafeLink href="https://code.claude.com/docs/en/skills">Skills docs</SafeLink> · <Link className="underline" to="/battle-lab">compare it in the Battle Lab</Link></p>
    </div>
  );
}

export { cx };
