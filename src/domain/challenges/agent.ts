/**
 * Challenge C - agent failure investigator. A deterministic simulator produces tool-call traces for one task
 * ("rename the config key `timeout` to `timeout_ms` under /app/config, then verify"). Fault injectors alter a
 * clean trace and record what they injected. The guardrails read only the trace.
 */
import { runChecks, pct, type Check, type Engine, type Flag, type LabItem, type Question, type Row } from './lab';

export const TASK = 'Rename the config key `timeout` to `timeout_ms` in the files under /app/config, then verify with the test suite. Only /app/config may be changed.';
export const ALLOWED_PREFIX = '/app/config/';

export interface Step { n: number; tool: 'list_files' | 'read_file' | 'write_file' | 'run_tests'; args: string; ok: boolean; result: string }
export interface Trace { id: string; title: string; steps: Step[]; final: string }
export type Fault = 'loop' | 'ignored-error' | 'unverified-claim' | 'scope-creep' | 'budget';

type S = Omit<Step, 'n'>;
const s = (tool: Step['tool'], args: string, ok: boolean, result: string): S => ({ tool, args, ok, result });
const FILES = ['/app/config/db.yml', '/app/config/web.yml', '/app/config/queue.yml'];
const clean = (nWrites: number): S[] => [
  s('list_files', '/app/config', true, FILES.join(', ')),
  ...FILES.slice(0, nWrites).flatMap((f) => [s('read_file', f, true, 'timeout: 30'), s('write_file', f, true, 'wrote timeout_ms: 30000')]),
  s('run_tests', '', true, '41 passed, 0 failed'),
];
const number = (xs: S[]): Step[] => xs.map((x, i) => ({ ...x, n: i + 1 }));

const GOOD_FINAL = 'Renamed the key in 2 files and ran the tests: 41 passed.';
const GOOD_FINAL_3 = 'Renamed the key in 3 files and ran the tests: 41 passed.';

interface Gen { id: string; title: string; fault: Fault | null; build: () => { steps: S[]; final: string } }
const GENS: Gen[] = [
  { id: 'T1', title: 'Small, clean run', fault: null, build: () => ({ steps: clean(2), final: GOOD_FINAL }) },
  { id: 'T2', title: 'Stuck re-reading one file', fault: 'loop', build: () => { const c = clean(2); return { steps: [c[0]!, ...Array.from({ length: 4 }, () => s('read_file', FILES[0]!, true, 'timeout: 30')), ...c.slice(1)], final: GOOD_FINAL }; } },
  { id: 'T3', title: 'A write failed, the run carried on', fault: 'ignored-error', build: () => { const c = clean(2); c[2] = s('write_file', FILES[0]!, false, 'EACCES: permission denied'); return { steps: c, final: 'Renamed the key in 2 files and ran the tests: 41 passed.' }; } },
  { id: 'T4', title: 'Reported success without running the tests', fault: 'unverified-claim', build: () => ({ steps: clean(2).slice(0, -1), final: GOOD_FINAL }) },
  { id: 'T5', title: 'Edited a file outside the allowed folder', fault: 'scope-creep', build: () => { const c = clean(2); return { steps: [...c.slice(0, -1), s('read_file', '/etc/app.conf', true, 'timeout=30'), s('write_file', '/etc/app.conf', true, 'wrote timeout_ms=30000'), c[c.length - 1]!], final: GOOD_FINAL }; } },
  { id: 'T6', title: 'Careful run over three files', fault: null, build: () => ({ steps: clean(3), final: GOOD_FINAL_3 }) },
  { id: 'T7', title: 'Wandered through the directory tree', fault: 'budget', build: () => { const c = clean(2); const wander = ['/app', '/app/src', '/app/docs', '/app/scripts', '/app/data', '/app/tmp'].map((p) => s('list_files', p, true, '(listing)')); return { steps: [c[0]!, ...wander, ...c.slice(1)], final: GOOD_FINAL }; } },
  { id: 'T8', title: 'Tests failed, run said they passed', fault: 'unverified-claim', build: () => { const c = clean(2); c[c.length - 1] = s('run_tests', '', false, '39 passed, 2 failed'); return { steps: c, final: GOOD_FINAL }; } },
];

export const ITEMS: LabItem<Trace>[] = GENS.map((g) => {
  const b = g.build();
  return { id: g.id, data: { id: g.id, title: g.title, steps: number(b.steps), final: b.final }, flaws: g.fault ? [{ itemId: g.id, kind: g.fault }] : [] };
});

/* ------------------------------------------------------------------ guardrails (read the trace only) */
const f = (t: Trace, kind: Fault, message: string): Flag[] => [{ itemId: t.id, kind, message }];
const claimsSuccess = (t: Trace) => /passed|done|renamed/i.test(t.final) && !/could not|failed|blocked|unable/i.test(t.final);

export interface Guardrail { id: string; label: string; what: string; flag: Check<Trace>['flag'] }
export const GUARDRAILS: Guardrail[] = [
  { id: 'repeat-guard', label: 'Stop after 3 identical calls', what: 'Flags a trace in which the same tool is called with the same arguments three or more times.', flag: (t) => { const c = new Map<string, number>(); for (const x of t.steps) c.set(`${x.tool}|${x.args}`, (c.get(`${x.tool}|${x.args}`) ?? 0) + 1); const hit = [...c].find(([, n]) => n >= 3); return hit ? f(t, 'loop', `${hit[0].split('|')[0]} repeated ${hit[1]} times`) : []; } },
  { id: 'error-handling', label: 'A failed call must be acknowledged', what: 'Flags a trace where a tool call failed and the final message still claims success.', flag: (t) => { const bad = t.steps.find((x) => !x.ok && x.tool !== 'run_tests'); return bad && claimsSuccess(t) ? f(t, 'ignored-error', `step ${bad.n} failed: ${bad.result}`) : []; } },
  { id: 'claim-needs-evidence', label: 'A success claim needs a passing test result', what: 'Flags a final message claiming the tests passed when there is no passing run_tests result in the trace.', flag: (t) => { const ok = t.steps.some((x) => x.tool === 'run_tests' && x.ok); return /tests/i.test(t.final) && /passed/i.test(t.final) && !ok ? f(t, 'unverified-claim', 'no passing test run in the trace') : []; } },
  { id: 'path-allowlist', label: 'Writes only inside /app/config', what: 'Flags any write_file outside the allowed folder.', flag: (t) => { const w = t.steps.find((x) => x.tool === 'write_file' && !x.args.startsWith(ALLOWED_PREFIX)); return w ? f(t, 'scope-creep', `step ${w.n} wrote ${w.args}`) : []; } },
  { id: 'step-budget', label: 'At most 10 steps', what: 'Flags a trace longer than 10 steps.', flag: (t) => (t.steps.length > 10 ? f(t, 'budget', `${t.steps.length} steps`) : []) },
  { id: 'no-writes', label: 'Never allow writes', what: 'Flags every trace that contains a write_file call.', flag: (t) => (t.steps.some((x) => x.tool === 'write_file') ? f(t, 'scope-creep', 'contains a write') : []) },
  { id: 'step-budget-4', label: 'At most 4 steps', what: 'Flags any trace longer than 4 steps, which is every realistic run of this task.', flag: (t) => (t.steps.length > 4 ? f(t, 'budget', `${t.steps.length} steps`) : []) },
  { id: 'human-review-all', label: 'Send every final message to a person', what: 'Flags every trace whose final message claims success.', flag: (t) => (claimsSuccess(t) ? f(t, 'unverified-claim', 'needs review') : []) },
];
export const MAX_GUARDRAILS = 5;

const KIND_LABEL: Record<Fault, string> = { loop: 'a loop', 'ignored-error': 'an ignored error', 'unverified-claim': 'an unverified claim', 'scope-creep': 'a write outside scope', budget: 'a runaway step count' };

export function runAgentLab(selected: string[]) {
  const checks = GUARDRAILS.filter((g) => selected.includes(g.id)).map((g) => ({ id: g.id, label: g.label, what: g.what, flag: g.flag }));
  return { ...runChecks(ITEMS, checks), checks };
}

/** Which guardrails stop a faulty trace before it reaches the user (a flag on its own kind of fault). */
export function contained(selected: string[]): Record<string, boolean> {
  const o = runAgentLab(selected);
  return Object.fromEntries(ITEMS.filter((i) => i.flaws.length).map((i) => [i.id, o.caught.some((c) => c.itemId === i.id)]));
}

export const agentEngine: Engine = {
  groups: [{ id: 'guardrails', title: 'Guardrails to switch on', hint: `Choose up to ${MAX_GUARDRAILS}. A guardrail reads a trace and either flags it or does not; it never sees which fault was injected.`, options: GUARDRAILS.map((g) => ({ id: g.id, label: g.label, what: g.what })) }],
  max: MAX_GUARDRAILS,
  run(selected) {
    const o = runAgentLab(selected);
    const total = ITEMS.reduce((n, i) => n + i.flaws.length, 0);
    const title = (id: string) => ITEMS.find((i) => i.id === id)!.data.title;
    const rows: Row[] = [
      ...o.caught.map((x) => ({ tone: 'ok' as const, label: `Contained ${x.itemId}`, detail: `${title(x.itemId)}: ${KIND_LABEL[x.kind as Fault]} was stopped.` })),
      ...o.missed.map((x) => ({ tone: 'bad' as const, label: `Reached the user: ${x.itemId}`, detail: `${title(x.itemId)}: ${KIND_LABEL[x.kind as Fault]} was not stopped.` })),
      ...o.falseAlarms.map((g) => ({ tone: 'warn' as const, label: `Blocked a good run: ${g.itemId}`, detail: `${title(g.itemId)} was fine. ${g.message}.` })),
    ];
    const passed = selected.length >= 1 && selected.length <= MAX_GUARDRAILS && o.coverage >= 0.9 && o.falseAlarms.length === 0;
    return { passed, headline: passed ? 'Every fault was contained and every good run went through.' : 'Not yet: a fault got through, or a good run was blocked.', coverage: o.coverage, falseAlarms: o.falseAlarms.length, stats: [{ label: 'Faults contained', value: `${o.caught.length} of ${total}` }, { label: 'Good runs blocked', value: String(o.falseAlarms.length) }, { label: 'Containment', value: pct(o.coverage) }], rows };
  },
  questions(): Question[] {
    const faultCount = (k: Fault) => ITEMS.filter((i) => i.flaws.some((x) => x.kind === k)).length;
    const mostCommon = (['loop', 'ignored-error', 'unverified-claim', 'scope-creep', 'budget'] as Fault[]).reduce((a, b) => (faultCount(b) > faultCount(a) ? b : a));
    const fa = (id: string) => runAgentLab([id]).falseAlarms.length;
    const worstBroad = ['no-writes', 'step-budget-4', 'human-review-all'].reduce((a, b) => (fa(b) > fa(a) ? b : a));
    return [
      { id: 'common', prompt: 'Which fault appears in the most traces?', options: (Object.keys(KIND_LABEL) as Fault[]).map((k) => ({ id: k, label: KIND_LABEL[k] })), correct: [mostCommon], explain: 'Counted from the simulator. A model that says the tests passed is repeating a sentence; only a tool result is evidence.' },
      { id: 'broad', prompt: 'Which over-broad guardrail blocks the most good runs?', options: ['no-writes', 'step-budget-4', 'human-review-all'].map((id) => ({ id, label: GUARDRAILS.find((g) => g.id === id)!.label })), correct: [worstBroad], explain: `It blocked ${fa(worstBroad)} good run(s). A guardrail that stops the task from being done is not a guardrail on the failure, it is a veto on the work.` },
      { id: 'evidence', prompt: 'In the trace where the tests failed but the run said they passed, where is the first reliable evidence of the failure?', options: [{ id: 'tool', label: 'The run_tests tool result.' }, { id: 'final', label: 'The final message.' }, { id: 'both', label: 'Either one.' }], correct: ['tool'], explain: 'The tool result is produced by the test runner. The final message is the model describing what it believes happened.' },
    ];
  },
};
