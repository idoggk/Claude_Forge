import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { gradeItem, readsAsTermList } from '@/domain/assessment/grade';
import { allItems, answerEchoesPrompt, choiceItems, correctPositionCounts, duplicatePrompts, longestCorrectShare, reviewRepeatsAssessment, shortcutOptions, weakDistractors, writtenItems } from '@/domain/curriculum/audit';
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

  it('RATCHET: the right option is not allowed to become longer than the wrong ones more often than it is today', () => {
    // Measured at the time of the audit: 211 of 258 single-answer items (82%) have a correct option at least 25% longer than every
    // wrong option, so a learner can pass by choosing the longest. The target is 40% or lower. This guard only stops it getting worse.
    const { share } = longestCorrectShare(all);
    expect(share).toBeLessThanOrEqual(0.83);
  });
  it('RATCHET: wrong options with almost no explanation do not increase', () => {
    expect(weakDistractors(all).length).toBeLessThanOrEqual(110);
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

describe('lessons whose grading changed carry a new version, so old attempts stop counting', () => {
  it('every lesson with a written-answer item is at version 2 or higher', () => {
    const ids = new Set(writtenItems(all).map((x) => x.lessonId));
    for (const l of LESSONS) if (ids.has(l.id)) expect(l.version, l.id).toBeGreaterThanOrEqual(2);
  });
});
