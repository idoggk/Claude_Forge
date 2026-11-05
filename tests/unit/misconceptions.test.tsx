// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LESSONS } from '@/content/lessons';
import { MISCONCEPTIONS, MISCONCEPTION_IDS } from '@/content/misconceptions';
import { COMPETENCIES } from '@/domain/curriculum/competencies';
import { pickedMisconceptions } from '@/domain/assessment/misconception';
import { gradeItem } from '@/domain/assessment/grade';
import type { Item } from '@/domain/curriculum/types';
import { ItemView } from '@/features/academy/ItemView';
import { MisconceptionCard } from '@/features/academy/MisconceptionCard';

afterEach(cleanup);

const allItems: Item[] = LESSONS.flatMap((l) => [...l.activity.items, ...l.assessment.items, ...l.reviewItems]);
const tagged = allItems.flatMap((it) => (it.kind === 'single' || it.kind === 'multi' ? it.options.filter((o) => o.misconception).map((o) => ({ item: it, option: o })) : []));

describe('misconception catalog integrity', () => {
  it('has a meaningful catalog covering several competencies', () => {
    expect(MISCONCEPTION_IDS.length).toBeGreaterThanOrEqual(14);
    const comps = new Set(Object.values(MISCONCEPTIONS).map((m) => m.competency));
    expect(comps.size).toBeGreaterThanOrEqual(8);
    const known = new Set(COMPETENCIES.map((c) => c.id));
    for (const m of Object.values(MISCONCEPTIONS)) expect(known.has(m.competency), m.id).toBe(true);
  });

  it('every entry is fully authored (belief, why plausible, why wrong, contrast, corrective question)', () => {
    for (const m of Object.values(MISCONCEPTIONS)) {
      for (const text of [m.belief, m.whyPlausible, m.whyWrong, m.contrast.wrong, m.contrast.right, m.contrast.note]) expect(text.length, m.id).toBeGreaterThan(15);
      expect(m.whyWrong.length, m.id).toBeGreaterThan(80);
      expect(m.belief, m.id).not.toMatch(/TODO|TBD|lorem/i);
    }
  });

  it('every corrective question is a gradeable single-choice item with one correct answer and a reason for every option', () => {
    const lessonIds = new Set(allItems.map((i) => i.id));
    for (const m of Object.values(MISCONCEPTIONS)) {
      const c = m.corrective;
      expect(c.kind, m.id).toBe('single');
      if (c.kind !== 'single') continue;
      expect(c.concept, m.id).toBe(m.competency);
      expect(c.options.filter((o) => o.id === c.correct), m.id).toHaveLength(1);
      expect(new Set(c.options.map((o) => o.id)).size, m.id).toBe(c.options.length);
      for (const o of c.options) expect(o.why.length, `${m.id}/${o.id}`).toBeGreaterThan(8);
      expect(lessonIds.has(c.id), `${m.id} corrective id collides with a lesson item`).toBe(false);
      expect(gradeItem(c, c.correct).correct, m.id).toBe(true);
      expect(gradeItem(c, c.options.find((o) => o.id !== c.correct)!.id).correct, m.id).toBe(false);
    }
  });

  it('every tagged option points at a catalog entry and is never the correct answer', () => {
    expect(tagged.length).toBeGreaterThanOrEqual(30);
    for (const { item, option } of tagged) {
      expect(MISCONCEPTIONS[option.misconception!], `${item.id}/${option.id}`).toBeDefined();
      const correct = item.kind === 'single' ? [item.correct] : item.kind === 'multi' ? item.correct : [];
      expect(correct.includes(option.id), `${item.id}/${option.id} is tagged but correct`).toBe(false);
    }
  });

  it('every catalog entry is exercised by at least one wrong option in the curriculum', () => {
    const used = new Set(tagged.map((t) => t.option.misconception));
    for (const id of MISCONCEPTION_IDS) expect(used.has(id), `${id} is never triggered`).toBe(true);
  });
});

describe('pickedMisconceptions', () => {
  const item = tagged.find((t) => t.item.kind === 'single')!.item as Extract<Item, { kind: 'single' }>;
  const wrongTagged = item.options.find((o) => o.misconception)!;

  it('returns the misconception of a selected wrong option', () => {
    expect(pickedMisconceptions(item, wrongTagged.id)).toEqual([wrongTagged.misconception]);
  });
  it('returns nothing for the correct answer, a missing answer, or non-choice items', () => {
    expect(pickedMisconceptions(item, item.correct)).toEqual([]);
    expect(pickedMisconceptions(item, undefined)).toEqual([]);
    const numeric = allItems.find((i) => i.kind === 'numeric')!;
    expect(pickedMisconceptions(numeric, 5)).toEqual([]);
  });
  it('handles multi-select, ignores untagged wrong options and de-duplicates', () => {
    const multi = tagged.find((t) => t.item.kind === 'multi')!.item as Extract<Item, { kind: 'multi' }>;
    const wrong = multi.options.filter((o) => !multi.correct.includes(o.id));
    const ids = pickedMisconceptions(multi, wrong.map((o) => o.id));
    expect(ids.length).toBe(new Set(ids).size);
    expect(ids).toEqual([...new Set(wrong.filter((o) => o.misconception).map((o) => o.misconception!))]);
  });
});

describe('feedback UI', () => {
  it('shows the misconception card after a wrong tagged answer, and not after a correct one', () => {
    const item = tagged.find((t) => t.item.kind === 'single')!.item as Extract<Item, { kind: 'single' }>;
    const wrong = item.options.find((o) => o.misconception)!;
    const noop = () => undefined;
    const { rerender } = render(<ItemView item={item} index={0} value={wrong.id} onChange={noop} disabled grade={gradeItem(item, wrong.id)} hintsShown={0} seed="s" />);
    expect(screen.getByTestId(`misconception-${wrong.misconception}`)).toBeTruthy();
    expect(screen.getByText(/Common misconception/)).toBeTruthy();
    rerender(<ItemView item={item} index={0} value={item.correct} onChange={noop} disabled grade={gradeItem(item, item.correct)} hintsShown={0} seed="s" />);
    expect(screen.queryByTestId(`misconception-${wrong.misconception}`)).toBeNull();
  });

  it('the corrective question is practice: wrong then right gives honest feedback and never throws', () => {
    const m = MISCONCEPTIONS['more-keywords']!;
    render(<MisconceptionCard m={m} />);
    expect(screen.queryByTestId('corrective-more-keywords')).toBeNull();
    fireEvent.click(screen.getByTestId('try-more-keywords'));
    expect(screen.getByText(/does not count toward mastery/)).toBeTruthy();
    const c = m.corrective as Extract<Item, { kind: 'single' }>;
    const wrong = c.options.find((o) => o.id !== c.correct)!;
    fireEvent.click(screen.getByLabelText(new RegExp(wrong.text.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('corrective-result-more-keywords').textContent).toContain('Not quite');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const right = c.options.find((o) => o.id === c.correct)!;
    fireEvent.click(screen.getByLabelText(new RegExp(right.text.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('corrective-result-more-keywords').textContent).toContain('Correct');
  });

  it('options are shown in a per-attempt order but grading is by id, never by position', () => {
    const item = allItems.find((i) => i.kind === 'single' && i.options.length === 4)! as Extract<Item, { kind: 'single' }>;
    const order = (seed: string) => {
      const { container, unmount } = render(<ItemView item={item} index={0} value={undefined} onChange={() => undefined} disabled={false} hintsShown={0} seed="s" optionSeed={seed} />);
      const texts = [...container.querySelectorAll('label span')].map((s) => s.textContent);
      unmount();
      return texts.join('|');
    };
    expect(order('a:1')).toBe(order('a:1'));
    const seen = new Set(['a:1', 'a:2', 'a:3', 'a:4', 'a:5', 'a:6'].map(order));
    expect(seen.size).toBeGreaterThan(1);
    // grading ignores display order
    expect(gradeItem(item, item.correct).correct).toBe(true);
  });
});
