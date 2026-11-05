import type { SourceRef } from '@/domain/curriculum/types';

/**
 * The AI Capability Map: a typed graph of capabilities a person may want to build (or choose not to build), each with
 * honest guidance about when it fits, when it does not, and what it costs in risk. Every node must lead somewhere real
 * (a lesson, a catalog entry, a playbook template or an AI Lab template) - there are no dead-end cards.
 */
export type CapabilityKind = 'practice' | 'mechanism' | 'integration' | 'framework' | 'evaluation' | 'safety' | 'domain';

export const RELATION_TYPES = ['requires', 'complements', 'alternative-to', 'often-confused-with', 'secures'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_LABELS: Record<RelationType, string> = {
  requires: 'Builds on',
  complements: 'Works well with',
  'alternative-to': 'Alternative to',
  'often-confused-with': 'Often confused with',
  secures: 'Makes it safer',
};

export interface CapabilityRelation {
  to: string;
  type: RelationType;
  /** One sentence saying why the two are related. */
  note: string;
}

export interface CapabilityNode {
  id: string;
  title: string;
  kind: CapabilityKind;
  /** Ids of OUTCOMES (goal-phrased) this capability helps with. */
  outcomes: string[];
  /** What it is, in plain words. */
  summary: string;
  /** The one question that decides whether this is the right choice. */
  judgment: string;
  useWhen: string[];
  avoidWhen: string[];
  risks: string[];
  /** ids from COMPETENCY_AREAS (profile areas) */
  areas: string[];
  lessons: string[];
  entries: string[];
  playbookTemplates: string[];
  labTemplates: string[];
  relations: CapabilityRelation[];
  sources: SourceRef[];
}

/** A goal-phrased reason to open the map ("I want my AI results to be more consistent"). */
export interface Outcome {
  id: string;
  title: string;
  description: string;
}

export type CapabilityStatus = 'learnable' | 'reference-only';

/** A capability is "learnable" if at least one lesson teaches it; otherwise it is reference material (catalog, templates). */
export function statusOf(n: CapabilityNode): CapabilityStatus {
  return n.lessons.length > 0 ? 'learnable' : 'reference-only';
}

export function hasDestination(n: CapabilityNode): boolean {
  return n.lessons.length + n.entries.length + n.playbookTemplates.length + n.labTemplates.length > 0;
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9.+#-]+/).filter(Boolean);
}

/** AND search over title, summary, judgment and guidance. Empty query returns everything. */
export function searchCapabilities(nodes: CapabilityNode[], query: string, outcomes: Outcome[] = []): CapabilityNode[] {
  const terms = words(query);
  if (terms.length === 0) return nodes;
  const outcomeText = new Map(outcomes.map((o) => [o.id, `${o.title} ${o.description}`]));
  const scored: { n: CapabilityNode; s: number }[] = [];
  for (const n of nodes) {
    const fields: [string, number][] = [
      [`${n.title} ${n.id}`, 6],
      [n.outcomes.map((o) => outcomeText.get(o) ?? '').join(' '), 4],
      [`${n.summary} ${n.judgment}`, 3],
      [`${n.useWhen.join(' ')} ${n.avoidWhen.join(' ')} ${n.risks.join(' ')}`, 1],
    ];
    let total = 0;
    let ok = true;
    for (const t of terms) {
      let best = 0;
      for (const [text, w] of fields) if (text.toLowerCase().includes(t)) best = Math.max(best, w);
      if (best === 0) { ok = false; break; }
      total += best;
    }
    if (ok) scored.push({ n, s: total });
  }
  return scored.sort((a, b) => b.s - a.s || a.n.title.localeCompare(b.n.title)).map((x) => x.n);
}

export function relatedNodes(nodes: CapabilityNode[], id: string): { node: CapabilityNode; relation: CapabilityRelation; direction: 'out' | 'in' }[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: { node: CapabilityNode; relation: CapabilityRelation; direction: 'out' | 'in' }[] = [];
  const self = byId.get(id);
  if (!self) return out;
  for (const r of self.relations) { const n = byId.get(r.to); if (n) out.push({ node: n, relation: r, direction: 'out' }); }
  for (const n of nodes) {
    if (n.id === id) continue;
    for (const r of n.relations) if (r.to === id) out.push({ node: n, relation: r, direction: 'in' });
  }
  return out;
}
