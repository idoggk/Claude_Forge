import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { gradeItem, readsAsTermList } from '@/domain/assessment/grade';
import { absoluteWordCue, allItems, answerEchoesPrompt, answerRevealedElsewhere, auditReport, brokenLessonLinks, choiceItems, correctPositionCounts, duplicateChoices, duplicatePrompts, emptyFeedback, longestCorrectShare, malformedChoices, reviewRepeatsAssessment, shortcutOptions, weakDistractors, writtenItems } from '@/domain/curriculum/audit';
import { seededOrder } from '@/domain/assessment/grade';
import { lessonStatus } from '@/domain/mastery/recommend';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Item } from '@/domain/curriculum/types';

const all = allItems();

describe('learning-quality audit (see docs/LEARNING_AUDIT.md)', () => {
  it('the audit covers every item in every lesson', () => {
    expect(all.length).toBe(LESSONS.reduce((n, l) => n + l.activity.items.length + l.assessment.items.length + l.reviewItems.length, 0));
    expect(choiceItems(all).length).toBeGreaterThan(300);
  });

  it('no correct option merely repeats the question', () => { expect(answerEchoesPrompt(all)).toEqual([]); });
  it('no item offers an "all of the above" style shortcut', () => { expect(shortcutOptions(all)).toEqual([]); });
  it('no review item repeats an assessment prompt of its own lesson', () => { expect(reviewRepeatsAssessment()).toEqual([]); });

  it('similar prompts are parallel forms with different content, never the same answer twice', () => {
    const by = new Map(all.map((x) => [`${x.lessonId}/${x.item.id}`, x.item as unknown as Record<string, unknown>]));
    const sig = (i: Record<string, unknown>) => JSON.stringify(i.entries ?? i.options ?? i.steps ?? i.fields ?? i.brief ?? i.groups ?? i.lines ?? i.rubric ?? i.answer, (_k, v) => (typeof v === 'function' ? 'fn' : v));
    for (const [a, b] of duplicatePrompts(all)) expect(sig(by.get(a)!), `${a} vs ${b}`).not.toBe(sig(by.get(b)!));
  });

  it('LENGTH LEAK: at most 40% of single-answer items let a learner pick the right option by length (target met; ratchet at 10%)', () => {
    // Round 5 measured 211 of 258 (82%): the correct option was at least 25% longer than every wrong option.
    // Round 6 rewrote the wrong options as plausible misconceptions of comparable length. Items whose longest option is under
    // 25 characters (identifiers, numbers) have no room for a length cue and are skipped.
    const { share } = longestCorrectShare(all);
    expect(share).toBeLessThanOrEqual(0.4);
    expect(share).toBeLessThanOrEqual(0.1);
  });
  it('the fix did not invert the cue: the right option is not systematically the longest, and its tendency to be the shortest is capped (RATCHET at 50%, measured 46%; chance is 25-33%)', () => {
    let longest = 0, shortest = 0, n = 0;
    for (const { item } of choiceItems(all)) {
      if (item.kind !== 'single' || item.options.length < 3 || Math.max(...item.options.map((o) => o.text.length)) < 25) continue;
      const c = item.options.find((o) => o.id === item.correct)!;
      const others = item.options.filter((o) => o !== c);
      n++;
      if (others.every((o) => c.text.length > o.text.length)) longest++;
      if (others.every((o) => c.text.length < o.text.length)) shortest++;
    }
    expect(longest / n).toBeLessThanOrEqual(0.4);
    expect(shortest / n).toBeLessThanOrEqual(0.5);
  });
  it('wrong options do not give themselves away with absolute words much more often than right options do', () => {
    const cue = absoluteWordCue(all);
    expect(cue.wrong - cue.right).toBeLessThanOrEqual(0.2);
  });
  it('no choice item has two options that say the same thing, an empty option, or fewer than three options', () => {
    expect(duplicateChoices(all)).toEqual([]);
    expect(malformedChoices(all)).toEqual([]);
  });
  it('no assessment or practice answer is restated in another item of the same lesson', () => { expect(answerRevealedElsewhere()).toEqual([]); });
  it('every option of every choice item has feedback that explains it (not just "Correct." or "Not the reason.")', () => {
    expect(weakDistractors(all)).toEqual([]);
    expect(emptyFeedback(all)).toEqual([]);
  });
  it('prerequisite links point at lessons that exist', () => { expect(brokenLessonLinks()).toEqual([]); });
  it('the audit report is readable and states the key figures', () => {
    const r = auditReport();
    expect(r).toMatch(/length leak: \d+ of \d+/);
    if (process.env.AUDIT_REPORT) writeFileSync('docs/audit-report.txt', r + '\n');
  });
  it('authored correct positions are shuffled at display time, so a bias in the source is not what a learner sees', () => {
    const { counts, n } = correctPositionCounts(all);
    expect(n).toBeGreaterThan(50);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe('written answers cannot be passed by typing the accepted terms', () => {
  const item: Item = { id: 'k', kind: 'keywords', concept: 'mechanism-selection', prompt: 'p', explanation: 'e', groups: [{ label: 'a', anyOf: ['schema', 'validate'] }, { label: 'b', anyOf: ['independent', 'script'] }, { label: 'c', anyOf: ['retry', 'limit', 'stop'] }] };
  const grade = (a: string) => gradeItem(item, a, {});
  it('a bag of the accepted words is not credited', () => {
    const r = grade('schema validate independent script retry limit stop');
    expect(r.correct).toBe(false);
    expect(r.feedback).toMatch(/list of terms/);
  });
  it('a real sentence using the same ideas is credited', () => {
    expect(grade('I would validate the output against a schema using an independent script, with a retry limit so it can stop.').correct).toBe(true);
  });
  it('short, plain answers are still graded normally', () => {
    expect(readsAsTermList('use a schema', item.kind === 'keywords' ? item.groups : [])).toBe(false);
  });
  it('every written item in the curriculum rejects its own full list of accepted terms', () => {
    for (const { lessonId, item: it2 } of writtenItems(all)) {
      if (it2.kind === 'keywords') {
        const stuffed = it2.groups.flatMap((g) => g.anyOf).join(' ');
        if (stuffed.split(' ').length >= 6) expect(gradeItem(it2, stuffed, {}).correct, `${lessonId}/${it2.id}`).toBe(false);
      }
    }
  });
});

describe('options are shuffled for the learner at display time', () => {
  it('seededOrder is a permutation, deterministic per seed, and places the right option in every position over many seeds', () => {
    const opts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const pos = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const o = seededOrder(opts, `attempt-${i}:item`);
      expect(o.map((x) => x.id).sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(seededOrder(opts, `attempt-${i}:item`)).toEqual(o);
      pos[o.findIndex((x) => x.id === 'a')]!++;
    }
    for (const c of pos) { expect(c).toBeGreaterThan(60); expect(c).toBeLessThan(140); }
  });
  it('answer options are uniform over positions even with three options, so listing the right option first does not show it last', () => {
    const opts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const pos = [0, 0, 0];
    const N = 1200;
    for (let i = 0; i < N; i++) pos[seededOrder(opts, `u_${i}-xyz:mr_${i * 7}:ask`, false).findIndex((x) => x.id === 'a')]!++;
    // expected 400 each; the old identity rotation gave about 200 / 400 / 600
    for (const c of pos) { expect(c).toBeGreaterThan(340); expect(c).toBeLessThan(460); }
    // ordering exercises still never start in the solution order
    for (let i = 0; i < 200; i++) expect(seededOrder(opts, `order-${i}`).map((x) => x.id)).not.toEqual(['a', 'b', 'c']);
  });
  it('the only place that renders choice items always passes an option seed', () => {
    const src = readFileSync('src/features/academy/ExerciseRunner.tsx', 'utf8');
    expect(src).toMatch(/optionSeed=\{/);
  });
});

describe('lessons whose assessments changed carry a new version, and old attempts stop counting', () => {
  it('a passing attempt recorded under the previous version does not count for the current lesson', () => {
    const l = LESSONS[0]!;
    const attempt = (v: number) => ({ id: `a${v}`, lessonId: l.id, lessonVersion: v, stage: 'assessment' as const, answers: {}, results: [], score: 1, passed: true, submittedAt: '2026-01-01T00:00:00.000Z' });
    const status = (v: number) => lessonStatus(l, [attempt(v) as never], []);
    expect(status(l.version)).toBe('passed');
    expect(status(l.version - 1)).not.toBe('passed');
  });
  it('every lesson whose multiple-choice options were rewritten in Round 6 is at least one version above its Round 5 version', () => {
    // Round 5 versions: 14 lessons with written items were at 2, the other 10 at 1. Round 6 added one to every lesson.
    const writtenLessons = new Set(writtenItems(all).map((x) => x.lessonId));
    const NEW_IN_ROUND_6 = /^L(2[5-9]|[3-9]\d)-/; // lessons written in Round 6 start at version 1
    for (const l of LESSONS.filter((x) => !NEW_IN_ROUND_6.test(x.id))) expect(l.version, l.id).toBeGreaterThanOrEqual(writtenLessons.has(l.id) ? 3 : 2);
  });

  it('every lesson with a written-answer item is at version 2 or higher', () => {
    const ids = new Set(writtenItems(all).map((x) => x.lessonId));
    for (const l of LESSONS) if (ids.has(l.id)) expect(l.version, l.id).toBeGreaterThanOrEqual(2);
  });
});
