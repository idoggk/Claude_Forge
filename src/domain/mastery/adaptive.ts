import type { CompetencyId, Lesson } from '../curriculum/types';
import { COMPETENCY_BY_ID } from '../curriculum/competencies';
import type { Attempt } from '@/persistence/schemas';
import { getMisconception } from '@/content/misconceptions';
import { MIXED_EXERCISES } from '@/content/interleaved';

/**
 * Evidence-aware next practice. It looks at HOW a learner performed, not only whether they passed: confidence against
 * result, hints, independence, repeated misconceptions and assessment version. Every suggestion carries the four things
 * a learner is owed: why it was chosen, what it trains, the evidence behind it, and what would count as improvement.
 *
 * It never raises a competency level and never counts clicking through a lesson as evidence. Difficulty goes up only on
 * independent, unseen, hint-free performance, repeated.
 */
export type Tier = 'foundation' | 'standard' | 'harder' | 'cross-topic' | 'transfer';
export const TIER_LABELS: Record<Tier, string> = {
  foundation: 'Foundation review',
  standard: 'Standard practice',
  harder: 'Harder scenario',
  'cross-topic': 'Cross-topic challenge',
  transfer: 'Practical transfer',
};

export interface CompetencyEvidence {
  competencyId: CompetencyId;
  /** Assessment and review attempts on the CURRENT version of a lesson that teaches it. */
  current: number;
  /** Attempts recorded only on superseded lesson versions. */
  staleOnly: boolean;
  independentPasses: number;
  guidedAttempts: number;
  bestIndependentScore: number;
  /** Attempts with confidence 4 or 5 whose result for this competency was below 60%. */
  highConfidenceMisses: { attemptId: string; confidence: number; score: number; lessonId: string }[];
}

export interface AdaptiveSuggestion {
  tier: Tier;
  title: string;
  to: string;
  competencies: CompetencyId[];
  /** Why this was chosen, in plain words. */
  why: string;
  /** The facts from the learner's own records. */
  evidence: string[];
  /** What would count as improvement. */
  improvement: string;
}

export interface AdaptiveInput {
  lessons: Lesson[];
  attempts: Attempt[];
  misconceptionHits: { id: string; lessonId: string }[];
  /** Number of transfer tasks the learner has completed, and competencies they relate to are not tracked: a coarse check. */
  completedTransfers: number;
}

const lessonFor = (lessons: Lesson[], c: CompetencyId) => lessons.filter((l) => l.competencies.includes(c)).sort((a, b) => a.order - b.order);

export function competencyEvidence(lessons: Lesson[], attempts: Attempt[]): Record<string, CompetencyEvidence> {
  const out: Record<string, CompetencyEvidence> = {};
  const versionOf = new Map(lessons.map((l) => [l.id, l.version]));
  const comps = new Set(lessons.flatMap((l) => l.competencies));
  for (const c of comps) {
    const ls = new Set(lessonFor(lessons, c).map((l) => l.id));
    const mine = attempts.filter((a) => ls.has(a.lessonId) && (a.stage === 'assessment' || a.stage === 'review'));
    const current = mine.filter((a) => versionOf.get(a.lessonId) === a.lessonVersion);
    const scoreOf = (a: Attempt) => a.conceptResults[c]?.score ?? null;
    const independent = current.filter((a) => a.independent && a.unseen && (scoreOf(a) ?? 0) >= 0.7);
    out[c] = {
      competencyId: c,
      current: current.length,
      staleOnly: mine.length > 0 && current.length === 0,
      independentPasses: independent.length,
      guidedAttempts: current.filter((a) => !a.independent).length,
      bestIndependentScore: independent.reduce((m, a) => Math.max(m, scoreOf(a) ?? 0), 0),
      highConfidenceMisses: current.filter((a) => (a.confidence ?? 0) >= 4 && scoreOf(a) !== null && (scoreOf(a) ?? 1) < 0.6).map((a) => ({ attemptId: a.id, confidence: a.confidence ?? 0, score: scoreOf(a) ?? 0, lessonId: a.lessonId })),
    };
  }
  return out;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const title = (c: CompetencyId) => COMPETENCY_BY_ID[c]?.title ?? c;

export function adaptiveSuggestions(input: AdaptiveInput): AdaptiveSuggestion[] {
  const { lessons, attempts, misconceptionHits } = input;
  const ev = competencyEvidence(lessons, attempts);
  const out: AdaptiveSuggestion[] = [];

  // 1. Foundation review: confident and wrong (calibration), or the same belief chosen repeatedly.
  for (const e of Object.values(ev)) {
    if (e.highConfidenceMisses.length === 0) continue;
    const worst = [...e.highConfidenceMisses].sort((a, b) => a.score - b.score)[0]!;
    const lesson = lessons.find((l) => l.id === worst.lessonId)!;
    out.push({
      tier: 'foundation',
      title: `Review: ${lesson.title}`,
      to: `/academy/lesson/${lesson.id}`,
      competencies: [e.competencyId],
      why: 'Being confident and wrong is the most useful thing to find out about, because it is the gap you would not look for yourself.',
      evidence: [`You rated your confidence ${worst.confidence} of 5 and scored ${pct(worst.score)} on ${title(e.competencyId)}${e.highConfidenceMisses.length > 1 ? ` (${e.highConfidenceMisses.length} such attempts)` : ''}.`],
      improvement: `A later, independent assessment of ${title(e.competencyId)} where your confidence and your result agree (for example confidence 3 and a pass, or a high-confidence pass).`,
    });
  }
  const counts = new Map<string, number>();
  for (const h of misconceptionHits) counts.set(h.id, (counts.get(h.id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n < 2) continue;
    const m = getMisconception(id);
    if (!m) continue;
    const lesson = lessonFor(lessons, m.competency)[0];
    if (!lesson) continue;
    out.push({
      tier: 'foundation',
      title: `Review: ${lesson.title}`,
      to: `/academy/lesson/${lesson.id}`,
      competencies: [m.competency],
      why: 'The same mistaken belief appeared more than once, which suggests a pattern rather than a slip.',
      evidence: [`You chose an answer reflecting “${m.belief}” ${n} times.`],
      improvement: `Passing the independent assessment for ${title(m.competency)} without choosing an option that reflects that belief.`,
    });
  }

  // 2. Standard practice: only guided evidence so far.
  for (const e of Object.values(ev)) {
    if (e.current === 0 || e.independentPasses > 0 || e.highConfidenceMisses.length > 0) continue;
    const lesson = lessonFor(lessons, e.competencyId)[0]!;
    out.push({
      tier: 'standard',
      title: `Independent assessment: ${lesson.title}`,
      to: `/academy/lesson/${lesson.id}`,
      competencies: [e.competencyId],
      why: 'So far your record for this competency is guided or not yet passed. Only independent, unseen, hint-free work counts towards a level.',
      evidence: [`${e.guidedAttempts} guided or unpassed attempt${e.guidedAttempts === 1 ? '' : 's'} and no independent pass on ${title(e.competencyId)}.`],
      improvement: 'An assessment passed without hints on questions you have not seen before.',
    });
  }

  // 3. Harder scenario: strong, repeated, independent performance and no calibration problem.
  for (const e of Object.values(ev)) {
    if (e.independentPasses < 2 || e.bestIndependentScore < 0.85 || e.highConfidenceMisses.length > 0) continue;
    const ex = MIXED_EXERCISES.find((m) => m.competencies.includes(e.competencyId));
    out.push({
      tier: 'harder',
      title: ex ? `Harder scenario: ${ex.title}` : `Harder scenario on ${title(e.competencyId)}`,
      to: ex ? `/practice/${ex.id}` : '/challenges',
      competencies: [e.competencyId],
      why: 'You have passed this competency independently more than once, so more of the same would teach little. A scenario with trade-offs asks for judgment instead of recall.',
      evidence: [`${e.independentPasses} independent, unseen passes on ${title(e.competencyId)}; best ${pct(e.bestIndependentScore)}.`],
      improvement: 'Getting every part of the scenario right, including the part that depends on a constraint you were not told to look for.',
    });
  }

  // 4. Cross-topic: two competencies that an exercise combines, at least one independently passed.
  for (const ex of MIXED_EXERCISES) {
    const strong = ex.competencies.filter((c) => (ev[c]?.independentPasses ?? 0) >= 1);
    if (strong.length === 0) continue;
    if (ex.competencies.some((c) => (ev[c]?.highConfidenceMisses.length ?? 0) > 0)) continue;
    out.push({
      tier: 'cross-topic',
      title: ex.title,
      to: `/practice/${ex.id}`,
      competencies: ex.competencies,
      why: 'Real problems mix topics. This exercise needs judgment from several at once, which is different from knowing each separately.',
      evidence: [`You have an independent pass on ${strong.map(title).join(' and ')}.`],
      improvement: 'Answering each part correctly, then explaining which constraint decided it.',
    });
  }

  // 5. Practical transfer: strong evidence and nothing yet applied to real work.
  const strongest = Object.values(ev).filter((e) => e.independentPasses >= 1 && e.bestIndependentScore >= 0.85 && e.highConfidenceMisses.length === 0).sort((a, b) => b.independentPasses - a.independentPasses)[0];
  if (strongest && input.completedTransfers === 0) {
    out.push({
      tier: 'transfer',
      title: 'Apply it to a real task',
      to: '/transfer',
      competencies: [strongest.competencyId],
      why: 'You have solid assessed evidence but nothing recorded from real work, which is where a level can become field-proven.',
      evidence: [`An independent pass on ${title(strongest.competencyId)} (best ${pct(strongest.bestIndependentScore)}) and no completed transfer task.`],
      improvement: 'A completed transfer task with your own observations and reflection. It is self-reported, so it supports a takeaway but does not raise a level by itself.',
    });
  }

  // Order: calibration and repeated beliefs first, then gaps in independence, then stretch.
  const rank: Record<Tier, number> = { foundation: 0, standard: 1, transfer: 2, harder: 3, 'cross-topic': 4 };
  const seen = new Set<string>();
  return out
    .sort((a, b) => rank[a.tier] - rank[b.tier])
    .filter((s) => { const k = `${s.tier}|${s.to}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
