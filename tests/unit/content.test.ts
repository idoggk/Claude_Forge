import { describe, expect, it } from 'vitest';
import { LESSONS } from '@/content/lessons';
import { COMPETENCIES, TRACKS } from '@/domain/curriculum/competencies';
import type { Item, Lesson } from '@/domain/curriculum/types';
import { gradeItem } from '@/domain/assessment/grade';
import { isSafeExternalUrl } from '@/lib/safeUrl';
import { lintSkillMd } from '@/domain/skills/validate';
import { L02_FLAWED_LINES } from '@/content/lessons/l02';
import { SAMPLE_B_LINES } from '@/content/lessons/l04';
import { DOJO_DESCRIPTION } from '@/content/lessons/l03';
import { predictActivation } from '@/domain/skills/trigger';
import { BUGGY_CONFIG, simulate } from '@/fixtures/economy/sim';
import { REFERENCE_CONFIG } from '@/fixtures/economy/reference';

const compIds = new Set(COMPETENCIES.map((c) => c.id));
const trackIds = new Set(TRACKS.map((t) => t.id));

/** A content signature, so two items that merely share a generic prompt ("Classify each observation") are not mistaken for duplicates. */
function signature(i: Item): string {
  switch (i.kind) {
    case 'single': case 'multi': return i.prompt + '|' + i.options.map((o) => o.text).join('|');
    case 'classify': return i.prompt + '|' + i.entries.map((e) => e.text).join('|');
    case 'order': return i.prompt + '|' + i.steps.map((s) => s.text).join('|');
    case 'flaglines': return i.prompt + '|' + i.lines.join('|');
    default: return i.prompt;
  }
}

function allItems(l: Lesson): { stage: string; item: Item }[] {
  return [
    ...l.activity.items.map((item) => ({ stage: 'practice', item })),
    ...l.assessment.items.map((item) => ({ stage: 'assessment', item })),
    ...l.reviewItems.map((item) => ({ stage: 'review', item })),
  ];
}

/** Produces the answer a perfect learner would give, so we can prove every item is gradable as correct. */
function perfectAnswer(item: Item): unknown {
  switch (item.kind) {
    case 'single': return item.correct;
    case 'multi': return item.correct;
    case 'classify': return Object.fromEntries(item.entries.map((e) => [e.id, e.correct]));
    case 'order': return item.steps.map((s) => s.id);
    case 'numeric': return typeof item.answer === 'function' ? item.answer() : item.answer;
    case 'keywords': return item.groups.map((g) => g.anyOf[0]).join(' and ');
    case 'fields': return Object.fromEntries(item.fields.map((f) => [f.id, f.groups.map((g) => g.anyOf[0]).join(' ')]));
    case 'flaglines': return item.targets.map((t) => t.line);
    case 'reflect': return Object.fromEntries(item.rubric.map((_, i) => [String(i), true]));
    case 'external': return undefined;
  }
}

describe('curriculum structure', () => {
  it('has the eighteen lessons with stable, unique IDs in the required order (R1-R2 original ten, then the eight R3 lessons)', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'L01-skill-or-tool', 'L02-inside-skill-md', 'L03-trigger-dojo', 'L04-skill-autopsy', 'L05-first-custom-skill',
      'L06-merge-chain-failure', 'L07-economy-inflation', 'L08-battle-lab', 'L09-reviewer-vs-builder', 'L10-forge-production-skill',
      'L11-choose-ai-approach', 'L12-context-engineering', 'L13-why-agents-fail', 'L14-mcp-or-not',
      'L15-reliable-ai-workflow', 'L16-ai-evaluation', 'L17-efficient-ai-development', 'L18-evaluate-an-ai-tool',
    ]);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(18);
  });

  it('every lesson has the required parts with real content (no placeholders)', () => {
    for (const l of LESSONS) {
      expect(l.version, l.id).toBeGreaterThanOrEqual(1);
      expect(trackIds.has(l.track), l.id).toBe(true);
      expect(l.competencies.length, l.id).toBeGreaterThan(0);
      for (const c of l.competencies) expect(compIds.has(c), `${l.id} ${c}`).toBe(true);
      expect(l.objectives.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.segments.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.problem.length, l.id).toBeGreaterThan(80);
      expect(l.whyItMatters.length, l.id).toBeGreaterThan(60);
      expect(l.failureModes.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.application.body.length, l.id).toBeGreaterThan(60);
      expect(l.activity.items.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.assessment.items.length, l.id).toBeGreaterThanOrEqual(5);
      expect(l.reviewItems.length, l.id).toBeGreaterThanOrEqual(5);
      expect(l.effortMinutes, l.id).toBeGreaterThan(5);
      for (const s of l.segments) expect(s.body.length, `${l.id}/${s.id}`).toBeGreaterThan(120);
      for (const text of [l.problem, l.whyItMatters, ...l.segments.map((s) => s.body), l.application.body]) {
        expect(text, l.id).not.toMatch(/lorem ipsum|TODO|TBD|placeholder/i);
      }
    }
  });

  it('prerequisites exist and form an acyclic graph', () => {
    const ids = new Set(LESSONS.map((l) => l.id));
    for (const l of LESSONS) for (const p of l.prerequisites) expect(ids.has(p), `${l.id} -> ${p}`).toBe(true);
    const seen = new Set<string>();
    const visit = (id: string, stack: string[]) => {
      expect(stack.includes(id), `cycle via ${[...stack, id].join('>')}`).toBe(false);
      if (seen.has(id)) return;
      for (const p of LESSONS.find((l) => l.id === id)!.prerequisites) visit(p, [...stack, id]);
      seen.add(id);
    };
    LESSONS.forEach((l) => visit(l.id, []));
  });

  it('every competency is taught by at least one lesson', () => {
    const taught = new Set(LESSONS.flatMap((l) => l.competencies));
    for (const c of COMPETENCIES) expect(taught.has(c.id), c.id).toBe(true);
  });

  it('sources are https links', () => {
    for (const l of LESSONS) for (const s of l.sources) expect(isSafeExternalUrl(s.url), `${l.id} ${s.url}`).toBe(true);
  });

  it('safety-critical competencies are protected by at least one critical assessment item', () => {
    for (const l of LESSONS) {
      for (const comp of l.competencies.filter((c) => COMPETENCIES.find((x) => x.id === c)!.safetyCritical)) {
        const crit = l.assessment.items.filter((i) => i.critical && i.concept === comp);
        expect(crit.length, `${l.id}/${comp}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('item integrity', () => {
  it('item IDs are unique across the whole curriculum', () => {
    const ids = LESSONS.flatMap((l) => allItems(l).map((x) => x.item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item is well-formed: correct answers exist, every option explains itself', () => {
    for (const l of LESSONS) {
      for (const { item, stage } of allItems(l)) {
        const where = `${l.id}/${stage}/${item.id}`;
        expect(item.explanation.length, where).toBeGreaterThan(10);
        expect(compIds.has(item.concept), where).toBe(true);
        switch (item.kind) {
          case 'single': {
            expect(item.options.map((o) => o.id), where).toContain(item.correct);
            expect(item.options.length, where).toBeGreaterThanOrEqual(3);
            item.options.forEach((o) => expect(o.why.length, `${where}/${o.id}`).toBeGreaterThanOrEqual(8));
            expect(new Set(item.options.map((o) => o.id)).size, where).toBe(item.options.length);
            break;
          }
          case 'multi': {
            const ids = item.options.map((o) => o.id);
            item.correct.forEach((c) => expect(ids, where).toContain(c));
            expect(item.correct.length, where).toBeGreaterThan(0);
            expect(item.correct.length, where).toBeLessThan(item.options.length);
            item.options.forEach((o) => expect(o.why.length, `${where}/${o.id}`).toBeGreaterThanOrEqual(8));
            break;
          }
          case 'classify': {
            const cats = new Set(item.categories.map((c) => c.id));
            item.entries.forEach((e) => { expect(cats.has(e.correct), `${where}/${e.id}`).toBe(true); expect(e.why.length).toBeGreaterThan(3); });
            expect(item.entries.length, where).toBeGreaterThanOrEqual(4);
            break;
          }
          case 'order': expect(item.steps.length, where).toBeGreaterThanOrEqual(4); break;
          case 'flaglines': {
            item.targets.forEach((t) => expect(t.line >= 1 && t.line <= item.lines.length, `${where} line ${t.line}`).toBe(true));
            expect(item.targets.length, where).toBeLessThan(item.lines.length);
            break;
          }
          case 'keywords': expect(item.groups.length, where).toBeGreaterThanOrEqual(2); break;
          default: break;
        }
      }
    }
  });

  it('a perfect answer to every non-external item is graded fully correct (graders agree with content)', () => {
    for (const l of LESSONS) {
      for (const { item, stage } of allItems(l)) {
        if (item.kind === 'external') continue;
        const g = gradeItem(item, perfectAnswer(item));
        expect(g.correct, `${l.id}/${stage}/${item.id}: ${g.feedback}`).toBe(true);
        expect(g.score, `${l.id}/${stage}/${item.id}`).toBe(1);
      }
    }
  });

  it('a blank answer is never graded correct', () => {
    for (const l of LESSONS) {
      for (const { item } of allItems(l)) {
        if (item.kind === 'external' || item.kind === 'reflect') continue;
        const g = gradeItem(item, undefined);
        expect(g.correct, `${l.id}/${item.id}`).toBe(false);
        expect(g.answered, `${l.id}/${item.id}`).toBe(false);
      }
    }
  });

  it('assessment items are distinct from practice items (assessment is unseen), and review items are distinct again', () => {
    for (const l of LESSONS) {
      const practice = new Set(l.activity.items.map(signature));
      for (const a of l.assessment.items) if (a.kind !== 'external') expect(practice.has(signature(a)), `${l.id}/${a.id}`).toBe(false);
      const seen = new Set([...practice, ...l.assessment.items.map(signature)]);
      for (const r of l.reviewItems) expect(seen.has(signature(r)), `${l.id}/${r.id}`).toBe(false);
    }
  });

  it('random multi-select shortcuts do not pass (selecting everything or the first option is wrong)', () => {
    for (const l of LESSONS) {
      for (const { item } of allItems(l)) {
        if (item.kind === 'multi') {
          expect(gradeItem(item, item.options.map((o) => o.id)).correct).toBe(false);
        }
        if (item.kind === 'single') {
          const wrong = item.options.find((o) => o.id !== item.correct)!;
          expect(gradeItem(item, wrong.id).correct).toBe(false);
        }
      }
    }
  });
});

describe('lesson claims agree with the tooling and fixtures', () => {
  it('the flawed SKILL.md in Lesson 2 trips exactly the validator rules the lesson describes', () => {
    const ids = lintSkillMd(L02_FLAWED_LINES.join('\n')).findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['name-format', 'desc-short', 'desc-no-trigger', 'invocation-unreachable', 'unknown-field', 'contra-always-never', 'ref-missing']));
  });

  it('assessment sample B in Lesson 4 is flagged by the linter for the hidden exfiltration and network permission', () => {
    const ids = lintSkillMd(SAMPLE_B_LINES.join('\n')).findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['allowed-tools-network', 'safety-hidden-comment', 'safety-exfil', 'safety-credential-paths']));
  });

  it('the dojo description is well formed and the heuristic agrees with the clear-cut labels', () => {
    const labelled: [string, 'likely' | 'unlikely'][] = [
      ['My merge cascade loses a piece after a chain of merges', 'likely'],
      ['Seed 7 diverges from the expected score after chain merges', 'likely'],
      ['Make the shop screen buttons larger on mobile', 'unlikely'],
    ];
    for (const [prompt, want] of labelled) expect(predictActivation(DOJO_DESCRIPTION, '', prompt).verdict, prompt).toBe(want);
    // The near-miss shares the noun "board" with the description: a lexical meter cannot tell refactoring from debugging.
    // That is a deliberate teaching point, so we assert only that it is NOT a confident "likely"... and document it.
    expect(predictActivation(DOJO_DESCRIPTION, '', 'Rename the variables in the board file to be clearer').verdict).not.toBe('likely');
    const ids = lintSkillMd(`---\nname: dojo-sample\ndescription: ${DOJO_DESCRIPTION}\n---\nBody`).findings.map((f) => f.id);
    expect(ids).not.toContain('desc-no-trigger');
    expect(ids).not.toContain('desc-no-negative');
  });

  it('Lesson 7 statements about the two economies are literally true', () => {
    const b = simulate(BUGGY_CONFIG);
    const f = simulate(REFERENCE_CONFIG);
    expect(b[29]!.level).toBe(f[29]!.level); // "same upgrade level at stage 30"
    const ratio = b[59]!.supply / f[59]!.supply;
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(5);
    expect(b[59]!.affordability / b[9]!.affordability).toBeGreaterThan(3);
    for (const r of f.filter((x) => x.stage >= 10)) expect(r.affordability).toBeGreaterThanOrEqual(0.45);
    for (const r of f.filter((x) => x.stage >= 10)) expect(r.affordability).toBeLessThanOrEqual(0.65);
  });
});
