import type { InterestTag, Lesson } from '../curriculum/types';
import { COMPETENCY_BY_ID } from '../curriculum/competencies';
import { INTEREST_LABELS } from '../curriculum/types';
import type { Attempt, LessonProgress, Profile, ReviewRecord } from '@/persistence/schemas';
import { compareKeys, daysBetweenKeys } from '@/lib/clock';
import { getMisconception } from '@/content/misconceptions';

/**
 * Mission Control's recommendation is a deterministic, explainable scoring
 * rule - it is not AI personalization. Every point in the score comes with a
 * human-readable reason, listed in the UI.
 *
 * Hard rule: due reviews outrank new material.
 * Soft factors for lessons: prerequisites met, a recent failed assessment,
 * concept weakness, the learner's chosen interests, and game-development relevance.
 */

export type LessonStatus = 'not-started' | 'in-progress' | 'attempted' | 'passed';

export interface Recommendation {
  kind: 'review' | 'lesson' | 'retry' | 'loop' | 'done';
  lessonId: string | null;
  title: string;
  score: number;
  reasons: string[];
  status?: LessonStatus;
}

export interface RecommendInput {
  lessons: Lesson[];
  attempts: Attempt[];
  progress: LessonProgress[];
  reviews: ReviewRecord[];
  profile: Pick<Profile, 'interests'> | null;
  today: string;
  /** Latest placement diagnostic, if any. A hint only: it can raise a lesson's priority, never mark anything passed. */
  diagnostic?: { gaps: string[]; solid: string[]; takenAt: string } | null;
  /** Misconceptions the learner recently fell for, with the lesson whose content they came from. */
  misconceptionHits?: { id: string; lessonId: string }[];
  /** Active learning goals, resolved to the lessons that teach the goal's capabilities. A goal steers priority; it is never evidence. */
  goalLessons?: { lessonId: string; goalTitle: string; capabilityTitle: string }[];
  /** Concepts missed in standalone practice (for example the Opportunity Finder), with a lesson that covers them. */
  practiceGaps?: { lessonId: string; label: string }[];
  /** Skill Improvement Loop: the lessons it builds on and how many loops exist. Offered once the prerequisites are passed. */
  loop?: { prerequisites: string[]; started: number } | null;
}

export function lessonStatus(lesson: Lesson, attempts: Attempt[], progress: LessonProgress[]): LessonStatus {
  const mine = attempts.filter((a) => a.lessonId === lesson.id && a.lessonVersion === lesson.version);
  if (mine.some((a) => a.stage === 'assessment' && a.passed)) return 'passed';
  if (mine.some((a) => a.stage === 'assessment')) return 'attempted';
  const p = progress.find((x) => x.lessonId === lesson.id && x.lessonVersion === lesson.version);
  if (p || mine.length > 0) return 'in-progress';
  return 'not-started';
}

export function prerequisitesMet(lesson: Lesson, lessons: Lesson[], attempts: Attempt[], progress: LessonProgress[]): { met: boolean; missing: Lesson[] } {
  const missing = lesson.prerequisites
    .map((id) => lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l))
    .filter((l) => lessonStatus(l, attempts, progress) !== 'passed');
  return { met: missing.length === 0, missing };
}

function weakConcepts(lesson: Lesson, attempts: Attempt[]): string[] {
  const latest = attempts
    .filter((a) => a.lessonId === lesson.id && a.lessonVersion === lesson.version && a.stage === 'assessment')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  if (!latest) return [];
  return Object.entries(latest.conceptResults)
    .filter(([, c]) => c.score < 0.7 || c.criticalFailed)
    .map(([id]) => COMPETENCY_BY_ID[id as keyof typeof COMPETENCY_BY_ID]?.title ?? id);
}

export function recommend(input: RecommendInput): { primary: Recommendation; alternatives: Recommendation[] } {
  const { lessons, attempts, progress, reviews, profile, today } = input;
  const candidates: Recommendation[] = [];

  const due = reviews.filter((r) => compareKeys(r.dueOn, today) <= 0).sort((a, b) => compareKeys(a.dueOn, b.dueOn));
  if (due.length > 0) {
    const first = due[0]!;
    const lesson = lessons.find((l) => l.id === first.lessonId);
    const overdueDays = Math.max(0, daysBetweenKeys(first.dueOn, today));
    const reasons = [
      `${due.length} review${due.length === 1 ? ' is' : 's are'} due${overdueDays > 0 ? ` (oldest is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue)` : ' today'}.`,
      'Retrieval practice on fresh questions is what turns a passed assessment into durable skill - it comes before new material.',
    ];
    if (first.lapses > 0) reasons.push(`You lapsed on "${lesson?.title ?? first.lessonId}" ${first.lapses} time${first.lapses === 1 ? '' : 's'}, so it is scheduled more often.`);
    candidates.push({ kind: 'review', lessonId: first.lessonId, title: `Review: ${lesson?.title ?? first.lessonId}`, score: 1000 + overdueDays, reasons });
  }

  const interests = new Set<InterestTag>(profile?.interests ?? []);
  for (const lesson of lessons) {
    const status = lessonStatus(lesson, attempts, progress);
    if (status === 'passed') continue;
    const pre = prerequisitesMet(lesson, lessons, attempts, progress);
    const reasons: string[] = [];
    let score = 100 - lesson.order * 2; // gentle default: follow curriculum order
    let kind: Recommendation['kind'] = 'lesson';

    if (!pre.met) {
      score -= 200;
      reasons.push(`Best after: ${pre.missing.map((m) => m.title).join(', ')}.`);
    } else if (lesson.prerequisites.length > 0) {
      reasons.push('Your prerequisites are complete.');
    } else {
      reasons.push('No prerequisites - a good place to start.');
    }

    if (status === 'attempted') {
      kind = 'retry';
      score += 60;
      const weak = weakConcepts(lesson, attempts);
      reasons.unshift(
        weak.length
          ? `Recommended because your last assessment missed: ${weak.join(', ')}. Retrying now, while it is fresh, is the fastest way to close the gap.`
          : 'You attempted the assessment but have not passed it yet.',
      );
    } else if (status === 'in-progress') {
      score += 25;
      reasons.unshift('You already started this lesson - finishing it keeps momentum.');
    }

    // A failed prerequisite concept raises the priority of lessons that depend on it.
    const dependents = lessons.filter((l) => l.prerequisites.includes(lesson.id) && lessonStatus(l, attempts, progress) !== 'passed');
    if (dependents.length > 0) {
      score += 6 * dependents.length;
      reasons.push(`It is required before: ${dependents.map((d) => d.title).join(', ')}.`);
    }

    const matched = lesson.interestTags.filter((t) => interests.has(t));
    if (matched.length > 0) {
      score += 12 * matched.length;
      reasons.push(`Matches your interest in ${matched.map((m) => INTEREST_LABELS[m]).join(' and ')}.`);
    }
    if (lesson.gameRelevance >= 2) {
      score += lesson.gameRelevance * 4;
      reasons.push(`Directly relevant to game development (relevance ${lesson.gameRelevance}/3).`);
    }

    // Placement diagnostic (a hint, never mastery).
    const gapsHere = lesson.competencies.filter((c) => input.diagnostic?.gaps.includes(c));
    if (gapsHere.length > 0) {
      score += 14 * gapsHere.length;
      reasons.push(`Your placement diagnostic flagged ${gapsHere.map((c) => COMPETENCY_BY_ID[c]?.title ?? c).join(' and ')} - one question per concept, so a hint rather than a measurement.`);
    } else if (input.diagnostic && lesson.competencies.every((c) => input.diagnostic!.solid.includes(c))) {
      reasons.push('Your diagnostic answers here were correct; the assessment will confirm it.');
    }
    // Recent misconceptions from this lesson's own content.
    const mine = (input.misconceptionHits ?? []).filter((h) => h.lessonId === lesson.id);
    if (mine.length > 0) {
      score += 10;
      const m = getMisconception(mine[0]!.id);
      if (m) reasons.push(`You recently chose an answer reflecting “${m.belief}” - this lesson addresses it.`);
    }

    // Learning goals (the learner's own stated intention).
    const goals = (input.goalLessons ?? []).filter((g) => g.lessonId === lesson.id);
    if (goals.length > 0) {
      const titles = [...new Set(goals.map((g) => g.goalTitle))];
      score += 30 * Math.min(2, titles.length);
      reasons.push(`Supports your goal ${titles.map((t) => `"${t}"`).join(' and ')} (capability: ${[...new Set(goals.map((g) => g.capabilityTitle))].join(', ')}). A goal raises priority; only your assessments and field notes show what you can do.`);
    }
    const gaps = (input.practiceGaps ?? []).filter((g) => g.lessonId === lesson.id);
    if (gaps.length > 0) {
      score += 10;
      reasons.push(`Your recent practice run missed: ${[...new Set(gaps.map((g) => g.label))].slice(0, 3).join('; ')}. This lesson covers it. Practice runs never change your levels.`);
    }

    candidates.push({ kind, lessonId: lesson.id, title: lesson.title, score, reasons, status });
  }

  // The Skill Improvement Loop becomes the most direct next step once its prerequisites are passed and none is started.
  if (input.loop && input.loop.started === 0) {
    const need = input.loop.prerequisites.map((id) => lessons.find((l) => l.id === id)).filter((l): l is Lesson => Boolean(l));
    if (need.length > 0 && need.every((l) => lessonStatus(l, attempts, progress) === 'passed')) {
      candidates.push({
        kind: 'loop',
        lessonId: null,
        title: 'Run the Skill Improvement Loop',
        score: 140,
        reasons: [
          `You have passed ${need.map((l) => l.title).join(' and ')}, so you can now turn what you know into measured evidence.`,
          'The loop is the fastest way to find out whether your own Skill actually changes what Claude does - and whether an improvement survives tasks you did not tune it on.',
        ],
      });
    }
  }

  if (candidates.length === 0) {
    return {
      primary: {
        kind: 'done',
        lessonId: null,
        title: 'All current lessons passed',
        score: 0,
        reasons: ['You have passed every lesson in this release. Run an experiment in the AI Lab or log real-work evidence in Growth to reach Field-proven.'],
      },
      alternatives: [],
    };
  }
  candidates.sort((a, b) => b.score - a.score || (a.lessonId ?? '').localeCompare(b.lessonId ?? ''));
  return { primary: candidates[0]!, alternatives: candidates.slice(1, 4) };
}
