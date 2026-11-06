import { describe, expect, it } from 'vitest';
import { CAPABILITIES, CAPABILITY_BY_ID, OUTCOMES, OUTCOME_IDS } from '@/content/capability/map';
import { RELATION_TYPES, hasDestination, relatedNodes, searchCapabilities, statusOf } from '@/domain/capability/model';
import { LESSONS } from '@/content/lessons';
import { CATALOG } from '@/content/catalog/entries';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { LAB_TEMPLATES } from '@/content/lab/templates';
import { COMPETENCY_AREAS } from '@/domain/curriculum/competencies';
import { isSafeExternalUrl } from '@/lib/safeUrl';
import { goalLessons } from '@/content/capability/goals';
import type { LearningGoal } from '@/domain/goals/model';

const lessonIds = new Set(LESSONS.map((l) => l.id));
const entryIds = new Set(CATALOG.map((e) => e.id));
const areaIds = new Set(COMPETENCY_AREAS.map((a) => a.id));
const playbookIds = new Set(PLAYBOOK_TEMPLATES.map((t) => t.templateId));
const labIds = new Set(LAB_TEMPLATES.map((t) => t.id));

describe('capability map integrity', () => {
  it('has unique ids and every node is well-formed', () => {
    expect(new Set(CAPABILITIES.map((c) => c.id)).size).toBe(CAPABILITIES.length);
    for (const n of CAPABILITIES) {
      expect(n.title.length, n.id).toBeGreaterThan(3);
      expect(n.summary.length, n.id).toBeGreaterThan(60);
      expect(n.judgment.endsWith('?'), `${n.id} judgment is a question`).toBe(true);
      expect(n.useWhen.length, n.id).toBeGreaterThan(0);
      expect(n.risks.length, n.id).toBeGreaterThan(0);
      expect(n.outcomes.length, n.id).toBeGreaterThan(0);
    }
  });

  it('has no dead-end cards: every node leads to at least one real destination', () => {
    for (const n of CAPABILITIES) expect(hasDestination(n), n.id).toBe(true);
  });

  it('every reference resolves: outcomes, areas, lessons, catalog entries, templates and related nodes', () => {
    for (const n of CAPABILITIES) {
      for (const o of n.outcomes) expect(OUTCOME_IDS.has(o), `${n.id} outcome ${o}`).toBe(true);
      for (const a of n.areas) expect(areaIds.has(a), `${n.id} area ${a}`).toBe(true);
      for (const l of n.lessons) expect(lessonIds.has(l), `${n.id} lesson ${l}`).toBe(true);
      for (const e of n.entries) expect(entryIds.has(e), `${n.id} entry ${e}`).toBe(true);
      for (const p of n.playbookTemplates) expect(playbookIds.has(p), `${n.id} playbook ${p}`).toBe(true);
      for (const t of n.labTemplates) expect(labIds.has(t), `${n.id} lab ${t}`).toBe(true);
      for (const r of n.relations) {
        expect(CAPABILITY_BY_ID.has(r.to), `${n.id} -> ${r.to}`).toBe(true);
        expect(r.to).not.toBe(n.id);
        expect(RELATION_TYPES).toContain(r.type);
        expect(r.note.length).toBeGreaterThan(10);
      }
      for (const s of n.sources) { expect(isSafeExternalUrl(s.url), `${n.id} ${s.url}`).toBe(true); expect(s.supports.length).toBeGreaterThan(10); }
    }
  });

  it('every outcome has at least one capability, and every catalog entry that names a capability is listed on that card or links back', () => {
    for (const o of OUTCOMES) expect(CAPABILITIES.some((c) => c.outcomes.includes(o.id)), o.id).toBe(true);
    for (const e of CATALOG) for (const id of e.capabilityIds) expect(CAPABILITY_BY_ID.has(id), `${e.id} -> ${id}`).toBe(true);
  });

  it('every available lesson is reachable from the map', () => {
    const reachable = new Set(CAPABILITIES.flatMap((c) => c.lessons));
    for (const l of LESSONS) expect(reachable.has(l.id), `${l.id} is not on any capability card`).toBe(true);
  });

  it('status is learnable only when a lesson teaches it', () => {
    for (const n of CAPABILITIES) expect(statusOf(n)).toBe(n.lessons.length > 0 ? 'learnable' : 'reference-only');
  });

  it('never ranks by popularity or invents numbers', () => {
    const text = JSON.stringify(CAPABILITIES);
    expect(text).not.toMatch(/most popular|top rated|\d+(\.\d+)?k stars/i);
  });
});

describe('capability search and graph', () => {
  it('searches by outcome, decision and risk with AND semantics', () => {
    expect(searchCapabilities(CAPABILITIES, 'secrets', OUTCOMES).map((n) => n.id)).toContain('tool-integration');
    expect(searchCapabilities(CAPABILITIES, 'parallel', OUTCOMES).map((n) => n.id)).toContain('efficient-development');
    expect(searchCapabilities(CAPABILITIES, 'automate repeatable', OUTCOMES).map((n) => n.id)).toContain('reliable-workflows');
    expect(searchCapabilities(CAPABILITIES, 'zzzzqqq xxxx', OUTCOMES)).toEqual([]);
    expect(searchCapabilities(CAPABILITIES, '', OUTCOMES)).toHaveLength(CAPABILITIES.length);
  });

  it('relatedNodes returns both directions', () => {
    const r = relatedNodes(CAPABILITIES, 'safe-adoption');
    expect(r.some((x) => x.direction === 'in' && x.node.id === 'agent-skills')).toBe(true);
    expect(relatedNodes(CAPABILITIES, 'nope')).toEqual([]);
  });

  it('goals resolve to lessons for the recommender, only while active', () => {
    const mk = (status: LearningGoal['status']): LearningGoal => ({ id: 'g', schemaVersion: 1, title: 'Automate Friday', why: '', capabilityIds: ['reliable-workflows'], status, achievedNote: '', achievedAt: null, createdAt: 't', updatedAt: 't' });
    expect(goalLessons([mk('active')]).map((g) => g.lessonId)).toContain('L15-reliable-ai-workflow');
    expect(goalLessons([mk('archived')])).toEqual([]);
    expect(goalLessons([mk('achieved')])).toEqual([]);
  });
});
