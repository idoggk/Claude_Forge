import type { CatalogEntry, ComponentType, Freshness, Tier } from './schema';
import { freshnessOf } from './schema';
import type { ArsenalStatus } from '@/persistence/schemas';

export interface CatalogFilters {
  query: string;
  tiers: Tier[];
  types: ComponentType[];
  /** Minimum game-development relevance (0 = any). */
  minGameRelevance: number;
  securityStatus: CatalogEntry['security']['reviewStatus'][];
  freshness: Freshness[];
  /** 'in' = in my Arsenal, 'out' = not in my Arsenal, 'any' */
  arsenal: 'any' | 'in' | 'out';
}

export const EMPTY_FILTERS: CatalogFilters = { query: '', tiers: [], types: [], minGameRelevance: 0, securityStatus: [], freshness: [], arsenal: 'any' };

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9.+#-]+/).filter(Boolean);
}

function haystacks(e: CatalogEntry): { field: string; weight: number; text: string }[] {
  return [
    { field: 'name', weight: 6, text: `${e.displayName} ${e.id}` },
    { field: 'outcome', weight: 4, text: `${e.problemSolved} ${e.purpose}` },
    { field: 'tags', weight: 4, text: `${e.tags.join(' ')} ${e.technologies.join(' ')}` },
    { field: 'type', weight: 3, text: `${e.componentTypes.join(' ')} ${e.tier} ${e.publisher}` },
    { field: 'workflows', weight: 2, text: `${e.workflows.join(' ')} ${e.whenToUse.join(' ')} ${e.relevance.note} ${e.notableComponents.map((c) => `${c.name} ${c.description}`).join(' ')}` },
    { field: 'details', weight: 1, text: `${e.howItWorks} ${e.practicalExample}` },
  ];
}

/** Returns a score > 0 when every query term matches somewhere (AND semantics), 0 otherwise. Empty query scores 1. */
export function scoreEntry(e: CatalogEntry, query: string): number {
  const terms = words(query);
  if (terms.length === 0) return 1;
  const hs = haystacks(e).map((h) => ({ ...h, text: h.text.toLowerCase() }));
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const h of hs) {
      if (h.text.includes(term)) best = Math.max(best, h.weight + (words(h.text).includes(term) ? 1 : 0));
    }
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function filterCatalog(
  entries: CatalogEntry[],
  filters: CatalogFilters,
  ctx: { today: string; arsenalStatus: Map<string, ArsenalStatus> },
): CatalogEntry[] {
  const scored: { e: CatalogEntry; s: number }[] = [];
  for (const e of entries) {
    const s = scoreEntry(e, filters.query);
    if (s === 0) continue;
    if (filters.tiers.length && !filters.tiers.includes(e.tier)) continue;
    if (filters.types.length && !e.componentTypes.some((t) => filters.types.includes(t))) continue;
    if (e.relevance.gameDev < filters.minGameRelevance) continue;
    if (filters.securityStatus.length && !filters.securityStatus.includes(e.security.reviewStatus)) continue;
    if (filters.freshness.length && !filters.freshness.includes(freshnessOf(e.verifiedAt, ctx.today))) continue;
    const inArsenal = ctx.arsenalStatus.has(e.id);
    if (filters.arsenal === 'in' && !inArsenal) continue;
    if (filters.arsenal === 'out' && inArsenal) continue;
    scored.push({ e, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.e.displayName.localeCompare(b.e.displayName)).map((x) => x.e);
}
