/**
 * Shared machinery for the computed challenges. An item (a draft claim, an agent trace) carries the flaws that
 * its generator injected; a check inspects the item without ever seeing that list. A flag counts as a catch only
 * when it names a real flaw of the same kind on the same item, and as a false alarm otherwise.
 */
export interface Flaw { itemId: string; kind: string }
export interface Flag { itemId: string; kind: string; message: string }
export interface Check<T> { id: string; label: string; what: string; flag: (item: T) => Flag[] }
export interface LabItem<T> { id: string; data: T; flaws: Flaw[] }

export interface OptionDef { id: string; label: string; what: string }
export interface Group { id: string; title: string; hint: string; exclusive?: boolean; options: OptionDef[] }
export interface Question { id: string; prompt: string; options: { id: string; label: string }[]; correct: string[]; explain: string }
export type Tone = 'ok' | 'warn' | 'bad' | 'info';
export interface Row { tone: Tone; label: string; detail: string }
export interface Stat { label: string; value: string }
export interface RunResult { passed: boolean; headline: string; stats: Stat[]; rows: Row[]; coverage: number; falseAlarms: number }
export interface Engine {
  groups: Group[];
  /** Maximum number of switched-on options in the first group, or null for no limit. */
  max: number | null;
  run: (selected: string[]) => RunResult;
  questions: () => Question[];
}

export interface CheckOutcome { caught: Flaw[]; missed: Flaw[]; falseAlarms: Flag[]; coverage: number; flags: Flag[] }

export function runChecks<T>(items: LabItem<T>[], checks: Check<T>[]): CheckOutcome {
  const flags = items.flatMap((it) => checks.flatMap((c) => c.flag(it.data)));
  const flaws = items.flatMap((it) => it.flaws);
  const has = (f: Flaw) => flags.some((g) => g.itemId === f.itemId && g.kind === f.kind);
  const caught = flaws.filter(has);
  const missed = flaws.filter((f) => !has(f));
  const seen = new Set<string>();
  const falseAlarms = flags.filter((g) => {
    if (flaws.some((f) => f.itemId === g.itemId && f.kind === g.kind)) return false;
    const key = `${g.itemId}|${g.kind}|${g.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { caught, missed, falseAlarms, coverage: flaws.length ? caught.length / flaws.length : 1, flags };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export interface EngineScore { score: number; passed: boolean; run: RunResult; answers: { id: string; correct: boolean }[] }
/** 60% the lab outcome (partial credit by coverage, reduced by false alarms), 40% the judgement questions. */
export function scoreEngine(engine: Engine, selected: string[], answers: Record<string, string>): EngineScore {
  const run = engine.run(selected);
  const qs = engine.questions();
  const graded = qs.map((q) => ({ id: q.id, correct: q.correct.includes(answers[q.id] ?? '') }));
  const lab = run.passed ? 1 : Math.max(0, run.coverage - (run.falseAlarms > 0 ? 0.25 : 0)) * 0.7;
  const qScore = qs.length ? graded.filter((g) => g.correct).length / qs.length : 0;
  return { score: Math.round((lab * 0.6 + qScore * 0.4) * 100) / 100, passed: run.passed, run, answers: graded };
}
