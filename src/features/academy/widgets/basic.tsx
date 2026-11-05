import { useState } from 'react';
import type { Lesson } from '@/domain/curriculum/types';
import { Badge, Button, Callout, Card, CodeLines, LinkButton, Markdown, SafeLink, TabPanel, Tabs, TextArea, TextInput, cx } from '@/components/ui';
import { predictActivation, LIKELY_AT, AMBIGUOUS_AT } from '@/domain/skills/trigger';
import { lintSkillMd } from '@/domain/skills/validate';
import { SKILL_MD_LINES, SETUP_SH_LINES, REFERENCE_FILES } from '@/fixtures/skill-autopsy/sample';
import { DOJO_DESCRIPTION } from '@/content/lessons/l03';
import { BUILDER_SUMMARY, DIFF_LINES, DIFF_FILENAME, INTEGRATOR_CONTEXT, REVIEWER_NOTE } from '@/fixtures/review/handoff';
import { LiveChecklist } from './shared';
import { Link } from 'react-router-dom';

type W = { lesson: Lesson };

/* ------------------------------ Lesson 1 ------------------------------ */

const MECHANISMS = [
  { id: 'claude-md', name: 'CLAUDE.md', who: 'Loaded automatically at session start', guarantee: 'No - context, not enforcement', cost: 'Every line, every session', use: 'Short facts true for almost every task: "tests run with pnpm test".' },
  { id: 'skill', name: 'Skill', who: 'Claude (from the description) or you with /name', guarantee: 'No - guidance Claude may skip', cost: 'Description always; body only when used', use: 'A repeatable procedure: invariant-first merge-bug investigation.' },
  { id: 'subagent', name: 'Subagent', who: 'Claude delegates, or you ask', guarantee: 'No - but isolated context and tools', cost: 'Own context window; only a summary returns', use: 'Repo-wide searches or reviews whose output would flood the chat.' },
  { id: 'hook', name: 'Hook', who: 'The harness, at a lifecycle event', guarantee: 'Yes - runs every time the event fires', cost: 'None in context; runs a command', use: 'Block edits to generated files; run tsc after each edit.' },
  { id: 'mcp', name: 'MCP server', who: 'Claude calls its tools', guarantee: 'Tools exist; use is Claude\'s choice', cost: 'Tool descriptions (searchable at scale)', use: 'Drive a browser against your game build; read a database.' },
  { id: 'plugin', name: 'Plugin', who: 'Installed; components then work as above', guarantee: 'Depends on its components', cost: 'Names + descriptions of its Skills/agents, every turn', use: 'Ship your debugging Skill, reviewer agent and hooks as one install.' },
  { id: 'code', name: 'Regular code', who: 'You, CI, or a hook', guarantee: 'Yes - deterministic', cost: 'None in context', use: 'The 200-seed determinism simulation; a manifest hasher.' },
];

export function MechanismMap(_: W) {
  const [sel, setSel] = useState(MECHANISMS[1]!.id);
  const m = MECHANISMS.find((x) => x.id === sel)!;
  return (
    <Card>
      <h3 className="font-semibold">Mechanism map</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose a mechanism">
        {MECHANISMS.map((x) => (
          <button key={x.id} type="button" aria-pressed={sel === x.id} onClick={() => setSel(x.id)} className={cx('transition-forge min-h-11 rounded-lg border px-3 text-sm font-semibold', sel === x.id ? 'border-accent bg-surface2' : 'border-line text-muted hover:bg-surface2')}>{x.name}</button>
        ))}
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2" data-testid="mechanism-detail">
        <div><dt className="font-semibold text-muted">Who triggers it</dt><dd>{m.who}</dd></div>
        <div><dt className="font-semibold text-muted">Guaranteed to run?</dt><dd>{m.guarantee}</dd></div>
        <div><dt className="font-semibold text-muted">Context cost</dt><dd>{m.cost}</dd></div>
        <div><dt className="font-semibold text-muted">One More Merge example</dt><dd>{m.use}</dd></div>
      </dl>
    </Card>
  );
}

/* ------------------------------ Lesson 2 ------------------------------ */

const ANATOMY_LINES = [
  '---',
  'name: merge-chain-debugger',
  'description: Debugs merge-board cascade failures. Use when pieces vanish after chain merges. Not for refactoring.',
  'argument-hint: [seed]',
  'allowed-tools: Bash(npm test *)',
  '---',
  '',
  '# Merge chain debugger',
  '',
  '1. Reproduce the failure with the seed in $ARGUMENTS.',
  '2. State the violated invariant in one sentence.',
  '3. Read [the invariants](references/invariants.md).',
];

const ANATOMY: Record<number, { title: string; kind: 'portable' | 'cc' | 'body'; text: string }> = {
  1: { title: '---', kind: 'portable', text: 'The opening line of frontmatter. It must be on the very first line of the file.' },
  2: { title: 'name', kind: 'portable', text: 'Portable Agent Skills field. Becomes the /name command in Claude Code; defaults to the folder name if omitted there. Lowercase letters, digits and single hyphens.' },
  3: { title: 'description', kind: 'portable', text: 'The only thing Claude uses to decide when to load the Skill. Always in context (capped at 1,536 characters with when_to_use). What it does, when to use it, and when not to.' },
  4: { title: 'argument-hint', kind: 'cc', text: 'Claude Code-only: the autocomplete hint after /merge-chain-debugger. Rejected by claude.ai / API uploads.' },
  5: { title: 'allowed-tools', kind: 'portable', text: 'Pre-approves tools for the turn the Skill runs in. Scope it tightly: Bash(npm test *) allows only test commands.' },
  6: { title: '---', kind: 'portable', text: 'Closes the frontmatter.' },
  8: { title: 'Body heading', kind: 'body', text: 'The body is loaded into the conversation only when the Skill is used (progressive disclosure).' },
  10: { title: '$ARGUMENTS', kind: 'cc', text: 'String substitution: whatever you type after /merge-chain-debugger is inserted here.' },
  11: { title: 'Verifiable step', kind: 'body', text: 'Good procedures name an observable outcome ("one sentence") that you can check.' },
  12: { title: 'Linked reference', kind: 'body', text: 'Supporting files load only if Claude follows the link. Keep SKILL.md under about 500 lines and push bulk here.' },
};

export function SkillMdAnatomy(_: W) {
  const [line, setLine] = useState(3);
  const a = ANATOMY[line];
  return (
    <Card>
      <h3 className="font-semibold">Annotated SKILL.md</h3>
      <p className="mb-2 text-sm text-muted">Tap a line to see what it does and whether it is portable.</p>
      <CodeLines label="Annotated SKILL.md" lines={ANATOMY_LINES} flagged={new Set([line])} onToggle={setLine} />
      <div className="mt-3 rounded-lg border border-line bg-surface2 p-3 text-sm" data-testid="anatomy-detail" aria-live="polite">
        {a ? (<><p className="flex items-center gap-2 font-semibold">{a.title} {a.kind === 'portable' ? <Badge tone="ok">portable</Badge> : a.kind === 'cc' ? <Badge tone="warn">Claude Code-specific</Badge> : <Badge tone="teal">body</Badge>}</p><p className="mt-1 text-muted">{a.text}</p></>) : <p className="text-muted">Line {line}: blank or plain content.</p>}
      </div>
    </Card>
  );
}

/* ------------------------------ Lesson 3 ------------------------------ */

const TRY = ['My merge cascade loses a piece after a chain of merges', 'Rename the variables in the board file to be clearer', 'Make the shop screen buttons larger on mobile', 'Pieces vanish when I drop a fourth piece next to a group', 'Something is wrong with the board'];

export function TriggerDojoWidget(_: W) {
  const [desc, setDesc] = useState(DOJO_DESCRIPTION);
  const [prompt, setPrompt] = useState(TRY[0]!);
  const r = predictActivation(desc, '', prompt);
  return (
    <Card>
      <h3 className="font-semibold">Lexical overlap meter</h3>
      <div className="mt-2"><Callout tone="warn" title="A drafting aid, not a prediction of Claude">It counts shared content words between a prompt and a description. Claude reads meaning, so it may activate when words differ - or not when they match. Only a live test shows real behaviour.</Callout></div>
      <div className="mt-3 grid gap-3">
        <TextArea label="Description under test (editable)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} hint={`${desc.length} characters · Claude Code truncates description + when_to_use at 1,536.`} />
        <TextInput label="A prompt to try" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="flex flex-wrap gap-2" aria-label="Example prompts">{TRY.map((t) => <Button key={t} size="sm" variant="ghost" onClick={() => setPrompt(t)}>{t.length > 34 ? t.slice(0, 33) + '…' : t}</Button>)}</div>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-surface2 p-3 text-sm" data-testid="dojo-result" aria-live="polite">
        <p className="flex flex-wrap items-center gap-2 font-semibold">Overlap {Math.round(r.score * 100)}% <Badge tone={r.verdict === 'likely' ? 'ok' : r.verdict === 'ambiguous' ? 'warn' : 'neutral'}>{r.verdict === 'likely' ? 'wording overlaps strongly' : r.verdict === 'ambiguous' ? 'partial overlap' : 'little overlap'}</Badge></p>
        <p className="text-xs text-muted">Thresholds: ≥{Math.round(LIKELY_AT * 100)}% strong · ≥{Math.round(AMBIGUOUS_AT * 100)}% partial. Not a probability.</p>
        <p className="mt-1">{r.explanation}</p>
        {r.excluded.length > 0 && <p className="text-muted">Words from the &ldquo;Not for…&rdquo; clause: {r.excluded.join(', ')}</p>}
      </div>
    </Card>
  );
}

/* ------------------------------ Lesson 4 ------------------------------ */

export function SkillAutopsyFiles(_: W) {
  const [tab, setTab] = useState<'skill' | 'script'>('skill');
  const [scanned, setScanned] = useState(false);
  const lint = scanned ? lintSkillMd(SKILL_MD_LINES.join('\n'), { resources: REFERENCE_FILES }).findings.concat(lintSkillMd('---\nname: x\ndescription: x\n---\n' + SETUP_SH_LINES.join('\n')).findings.filter((f) => f.id.startsWith('safety-'))) : [];
  return (
    <Card>
      <h3 className="font-semibold">Training sample: quick-deploy-helper</h3>
      <div className="mt-2"><Callout tone="warn" title="Fictional and inert">Shown as text only. Claude Forge never executes, installs or fetches anything from this sample. Its hostname uses the reserved &ldquo;.invalid&rdquo; domain, which cannot resolve.</Callout></div>
      <div className="mt-3"><Tabs idPrefix="autopsy-" label="Sample files" value={tab} onChange={setTab} tabs={[{ id: 'skill', label: 'SKILL.md' }, { id: 'script', label: 'scripts/setup.sh' }]} /></div>
      <TabPanel idPrefix="autopsy-" id="skill" active={tab === 'skill'}><CodeLines label="SKILL.md sample" lines={SKILL_MD_LINES} /></TabPanel>
      <TabPanel idPrefix="autopsy-" id="script" active={tab === 'script'}><CodeLines label="setup.sh sample" lines={SETUP_SH_LINES} /></TabPanel>
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={() => setScanned(true)} data-testid="run-linter">Run Forge&apos;s advisory scan on this sample</Button>
        {scanned && (
          <div className="mt-2 text-sm" data-testid="linter-output">
            <p className="font-semibold">{lint.length} advisory findings</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{lint.slice(0, 12).map((f, i) => <li key={i}><Badge tone={f.severity === 'error' ? 'bad' : 'warn'}>{f.severity}</Badge> {f.message}</li>)}</ul>
            <p className="mt-2 text-muted">A scanner finds patterns, not intent. A clean scan is never approval - and this one will not catch everything. Do the autopsy yourself.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ Lessons 5 and 10 ------------------------------ */

export function WorkshopLink(_: W) {
  return (
    <div className="space-y-3">
      <LiveChecklist check="workshop-first-skill" title="Your first Skill - verified from the Workshop" />
      <div className="flex flex-wrap gap-2">
        <LinkButton to="/workshop" variant="primary" icon="hammer" data-testid="open-workshop">Open the Workshop</LinkButton>
        <p className="self-center text-sm text-muted">Create a Skill, add scenarios, fix validation errors, export the ZIP. This list updates as you save.</p>
      </div>
    </div>
  );
}

export function CapstoneBrief(_: W) {
  return (
    <div className="space-y-3">
      <Card>
        <h3 className="font-semibold">Pick a target, then build to the checklist</h3>
        <p className="mt-1 text-sm text-muted">Proposed targets (not installable - you author them): <Link className="underline" to="/discovery/custom-merge-chain-debugger">merge-chain-debugger</Link>, <Link className="underline" to="/discovery/custom-economy-sim-reviewer">economy-sim-reviewer</Link>, <Link className="underline" to="/discovery/custom-handoff-gatekeeper">handoff-gatekeeper</Link>. The experiment must have a condition whose &ldquo;Skill name&rdquo; matches your Skill&apos;s name.</p>
        <div className="mt-2 flex flex-wrap gap-2"><LinkButton to="/workshop" icon="hammer">Workshop</LinkButton><LinkButton to="/battle-lab" icon="flask">Battle Lab</LinkButton></div>
      </Card>
      <LiveChecklist check="workshop-capstone-skill" title="Production checklist - verified from your saved data" />
    </div>
  );
}

/* ------------------------------ Lesson 9 ------------------------------ */

export function ReviewBoard(_: W) {
  const [tab, setTab] = useState<'summary' | 'diff' | 'review' | 'ci'>('summary');
  return (
    <Card>
      <h3 className="font-semibold">Handoff RB-17 <Badge tone="warn">fabricated for training</Badge></h3>
      <div className="mt-2"><Tabs idPrefix="handoff-" label="Handoff documents" value={tab} onChange={setTab} tabs={[{ id: 'summary', label: 'Builder summary' }, { id: 'diff', label: 'Diff' }, { id: 'review', label: 'Reviewer note' }, { id: 'ci', label: 'CI & main' }]} /></div>
      <div data-testid="handoff-doc">
        <TabPanel idPrefix="handoff-" id="summary" active={tab === 'summary'}><Markdown>{BUILDER_SUMMARY}</Markdown></TabPanel>
        <TabPanel idPrefix="handoff-" id="diff" active={tab === 'diff'}><p className="mb-2 text-sm text-muted">{DIFF_FILENAME} (excerpt)</p><CodeLines label="Diff excerpt" lines={DIFF_LINES} /></TabPanel>
        <TabPanel idPrefix="handoff-" id="review" active={tab === 'review'}><Markdown>{REVIEWER_NOTE}</Markdown></TabPanel>
        <TabPanel idPrefix="handoff-" id="ci" active={tab === 'ci'}><Markdown>{INTEGRATOR_CONTEXT}</Markdown></TabPanel>
      </div>
      <p className="mt-3 text-xs text-muted">Roles: Builder (produces), Reviewer (verifies independently), Integrator (owns the merge decision). Nothing here is real output; see <SafeLink href="https://code.claude.com/docs/en/sub-agents">the sub-agents docs</SafeLink> for the real mechanism.</p>
    </Card>
  );
}
