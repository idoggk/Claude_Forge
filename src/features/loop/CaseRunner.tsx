import { useState } from 'react';
import { Badge, Button, Callout, Card, CopyButton, Markdown, Segmented, TextArea, TextInput, useToast } from '@/components/ui';
import type { Run } from '@/domain/experiments/model';
import { runFor } from '@/domain/loop/engine';
import type { MissionCase } from '@/domain/loop/types';
import { recordCaseRun, type ConditionKey, type LoopBundle } from '@/persistence/loopRepo';

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

interface FormProps {
  bundle: LoopBundle;
  phase: 'dev' | 'heldout';
  condition: ConditionKey;
  mission: MissionCase;
  existing: Run | undefined;
  locked: boolean;
  expectsSkill: boolean;
  evidencePreset: string;
  onDone: () => void;
}

function CaseForm({ bundle, phase, condition, mission, existing, locked, expectsSkill, evidencePreset, onDone }: FormProps) {
  const toast = useToast();
  const checklist = bundle.mission.checklist;
  const L = bundle.mission.labels;
  const options = [...bundle.mission.verdicts, { value: 'unclear', label: `no usable ${L.answerNoun}` }];
  const [verdict, setVerdict] = useState<Run['verdict']>(existing?.verdict ?? null);
  const [assessed, setAssessed] = useState<boolean>(existing ? existing.seededFound !== null : false);
  const [found, setFound] = useState<string[]>(existing?.seededFound ?? []);
  const [activated, setActivated] = useState<'yes' | 'no' | 'unknown'>(existing?.skillActivated === true ? 'yes' : existing?.skillActivated === false ? 'no' : 'unknown');
  const m = existing?.metrics ?? {};
  const [rework, setRework] = useState(m.reworkRounds?.value?.toString() ?? '');
  const [interventions, setInterventions] = useState(m.interventions?.value?.toString() ?? '');
  const [runtime, setRuntime] = useState(m.runtimeSec?.value?.toString() ?? '');
  const [tokens, setTokens] = useState(m.tokens?.value?.toString() ?? '');
  const [notes, setNotes] = useState(existing?.observations ?? '');
  const [answer, setAnswer] = useState(evidencePreset);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const caseId = mission.id;

  const save = async () => {
    if (!verdict) { setErr(`Choose the ${L.answerNoun} you read in Claude's answer (or "no usable ${L.answerNoun}").`); return; }
    setBusy(true);
    setErr(null);
    try {
      await recordCaseRun({
        loopId: bundle.loop.id, phase, condition, caseId, verdict,
        checklist: assessed ? found : null,
        skillActivated: expectsSkill ? (activated === 'yes' ? true : activated === 'no' ? false : null) : null,
        reworkRounds: numOrNull(rework), interventions: numOrNull(interventions), runtimeSec: numOrNull(runtime), tokens: numOrNull(tokens),
        observations: notes, evidenceText: answer,
      });
      toast('Run recorded');
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save this run');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-3 space-y-4 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={`Record result for ${mission.title}`}>
      <fieldset disabled={locked} className="space-y-4">
        <div>
          <p id={`v-${caseId}-${condition}`} className="text-sm font-semibold">The {L.answerNoun} in Claude&apos;s final answer <span className="font-normal text-muted">(<code>{bundle.mission.verdictFormat}</code>)</span></p>
          <div className="mt-1"><Segmented<string> label={`${L.answerNoun} for ${mission.title}`} value={verdict ?? ''} options={options} onChange={setVerdict} /></div>
          <p className="mt-1 text-xs text-muted">Read it yourself from Claude&apos;s answer. Forge does not see the answer; it compares what you record with the {L.truthShort} after you finish the set.</p>
        </div>

        <div>
          <p className="text-sm font-semibold">Review-quality checklist</p>
          <div className="mt-1"><Segmented<'no' | 'yes'> label="Checklist assessment" value={assessed ? 'yes' : 'no'} options={[{ value: 'no', label: 'Not assessed (unknown)' }, { value: 'yes', label: 'I checked the answer' }]} onChange={(v) => setAssessed(v === 'yes')} /></div>
          <ul className="mt-2 space-y-1">
            {checklist.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-9 items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4" disabled={!assessed} checked={found.includes(c.id)} onChange={(e) => setFound(e.target.checked ? [...found, c.id] : found.filter((x) => x !== c.id))} />
                  <span>{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Tick only what the answer actually contains. Leaving every box unticked after choosing &ldquo;I checked&rdquo; records that none were met.</p>
        </div>

        {expectsSkill && (
          <div>
            <p className="text-sm font-semibold">Did the Skill visibly activate?</p>
            <div className="mt-1"><Segmented<'yes' | 'no' | 'unknown'> label="Skill activated" value={activated} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not sure' }]} onChange={setActivated} /></div>
            <p className="mt-1 text-xs text-muted">Look for Claude loading it (for example a Skill tool call). &ldquo;Not sure&rdquo; stays unknown.</p>
          </div>
        )}

        <details>
          <summary className="min-h-9 cursor-pointer text-sm font-semibold">Optional measurements <span className="font-normal text-muted">(blank = unknown, never zero)</span></summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <TextInput label="Rework rounds" inputMode="numeric" value={rework} onChange={(e) => setRework(e.target.value)} hint="Follow-up prompts you had to send because the answer was wrong or incomplete." />
            <TextInput label="Developer interventions" inputMode="numeric" value={interventions} onChange={(e) => setInterventions(e.target.value)} hint="Times you ran something or supplied data Claude should have handled." />
            <TextInput label="Runtime (seconds)" inputMode="decimal" value={runtime} onChange={(e) => setRuntime(e.target.value)} hint="Only if you timed it." />
            <TextInput label="Tokens used" inputMode="numeric" value={tokens} onChange={(e) => setTokens(e.target.value)} hint="Only from a real usage report. Never estimate." />
          </div>
        </details>

        <TextArea label="Observations (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        <TextArea label="Paste Claude's final answer (optional evidence)" rows={4} mono value={answer} onChange={(e) => setAnswer(e.target.value)} hint="Stored locally so the record can be audited. Max about 500 KB." />
      </fieldset>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {locked ? (
        <Callout tone="info" title="Locked">These runs were locked when the ground truth was revealed, so the record cannot be edited afterwards.</Callout>
      ) : (
        <Button type="submit" variant="primary" disabled={busy} data-testid={`save-${caseId}-${condition}`}>{existing ? 'Update run' : 'Save run'}</Button>
      )}
    </form>
  );
}

export function CaseRunner({ bundle, phase, condition, conditionLabel, cases }: { bundle: LoopBundle; phase: 'dev' | 'heldout'; condition: ConditionKey; conditionLabel: string; cases: MissionCase[] }) {
  const exp = phase === 'dev' ? bundle.dev : bundle.heldout;
  const condId = phase === 'dev' ? bundle.loop.conditionIds[condition] : condition === 'v1' ? bundle.loop.heldoutConditionIds.v1 : condition === 'v2' ? bundle.loop.heldoutConditionIds.v2 : null;
  const [open, setOpen] = useState<string | null>(null);
  const locked = Boolean(exp?.runsLockedAt);
  const done = cases.filter((c) => runFor(exp, condId, c.id)?.verdict).length;

  return (
    <section aria-label={`${conditionLabel} runs`} data-testid={`runner-${phase}-${condition}`}>
      <h3 className="text-lg font-semibold">{conditionLabel} <span className="text-sm font-normal text-muted">· {done}/{cases.length} recorded</span></h3>
      <ul className="mt-2 space-y-2">
        {cases.map((c, i) => {
          const run = runFor(exp, condId, c.id);
          const ev = bundle.evidence.find((e) => e.runId === run?.id && e.kind === 'pasted-output');
          const isOpen = open === c.id;
          return (
            <Card as="li" key={c.id} data-testid={`case-${phase}-${condition}-${c.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{i + 1}. {c.title}</p>
                  <Markdown className="prose-forge text-sm text-muted">{c.change}</Markdown>
                </div>
                <div className="flex items-center gap-2">
                  {run?.verdict ? <Badge tone="ok">recorded: {run.verdict}</Badge> : <Badge>not recorded</Badge>}
                  <Button size="sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} data-testid={`open-${phase}-${condition}-${c.id}`}>{isOpen ? 'Close' : run ? 'Review / edit' : 'Run & record'}</Button>
                </div>
              </div>
              {isOpen && (
                <div>
                  <div className="mt-3 rounded-lg border border-line bg-surface2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Task prompt (paste unchanged into a fresh Claude Code session)</p>
                      <CopyButton text={c.prompt} what="the task prompt" />
                    </div>
                    <pre tabIndex={0} className="code-scroll mt-2 whitespace-pre-wrap text-xs">{c.prompt}</pre>
                  </div>
                  <CaseForm bundle={bundle} phase={phase} condition={condition} mission={c} existing={run} locked={locked} expectsSkill={condition !== 'baseline'} evidencePreset={ev?.text ?? ''} onDone={() => setOpen(null)} />
                </div>
              )}
            </Card>
          );
        })}
      </ul>
    </section>
  );
}
