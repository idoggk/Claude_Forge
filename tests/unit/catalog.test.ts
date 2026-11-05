import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_SNAPSHOT_DATE } from '@/content/catalog/entries';
import { filterCatalog, EMPTY_FILTERS, scoreEntry } from '@/domain/catalog/search';
import { freshnessOf, CatalogEntrySchema } from '@/domain/catalog/schema';
import { isSafeExternalUrl } from '@/lib/safeUrl';
import { LESSONS } from '@/content/lessons';

const ctx = { today: '2026-11-10', arsenalStatus: new Map<string, never>() };

describe('catalog integrity', () => {
  it('has at least six real, source-backed entries (not counting proposals or candidates)', () => {
    const real = CATALOG.filter((e) => e.tier === 'official' || e.tier === 'community');
    expect(real.length).toBeGreaterThanOrEqual(6);
  });

  it('every non-custom entry links to a canonical https source and has a verification date', () => {
    for (const e of CATALOG.filter((x) => x.tier !== 'custom')) {
      expect(isSafeExternalUrl(e.sourceUrl), e.id).toBe(true);
      expect(e.verifiedAt, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.verificationMethod.length, e.id).toBeGreaterThan(20);
    }
  });

  it('custom entries never pretend to have a source or an install command', () => {
    for (const e of CATALOG.filter((x) => x.tier === 'custom')) {
      expect(e.sourceUrl).toBeNull();
      expect(e.install.methods).toEqual([]);
      expect(e.install.status).toBe('not-applicable');
      expect(e.evidenceStatus).toBe('proposed');
    }
  });

  it('every install command is traceable to a source URL; unknown evidence stays null', () => {
    for (const e of CATALOG) {
      for (const m of e.install.methods) {
        expect(isSafeExternalUrl(m.verifiedFrom), `${e.id}: ${m.command}`).toBe(true);
        expect(m.command.length).toBeGreaterThan(5);
      }
      if (e.install.status === 'verified-from-source') expect(e.install.methods.length).toBeGreaterThan(0);
      // We never read commit dates or releases from the pages, so these must remain unknown.
      expect(e.maintenance.lastCommit, e.id).toBeNull();
      expect(e.maintenance.latestRelease, e.id).toBeNull();
    }
  });

  it('unclear licences are not guessed', () => {
    const cc = CATALOG.find((e) => e.id === 'anthropics-claude-code-repo')!;
    expect(cc.license.spdx).toBeNull();
    expect(cc.license.status).toBe('unknown');
    const skills = CATALOG.find((e) => e.id === 'anthropics-skills')!;
    expect(skills.license.spdx).toBeNull();
    expect(skills.license.status).toBe('mixed');
  });

  it('IDs are unique and related lessons / alternatives resolve', () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    expect(ids.size).toBe(CATALOG.length);
    const lessonIds = new Set(LESSONS.map((l) => l.id));
    for (const e of CATALOG) {
      for (const a of e.alternatives) expect(ids.has(a), `${e.id} alt ${a}`).toBe(true);
      for (const l of e.relatedLessons) expect(lessonIds.has(l), `${e.id} lesson ${l}`).toBe(true);
    }
  });

  it('schema rejects a sourced entry without a URL or a verified install without methods', () => {
    const base = CATALOG[0]!;
    expect(CatalogEntrySchema.safeParse({ ...base, sourceUrl: null }).success).toBe(false);
    expect(CatalogEntrySchema.safeParse({ ...base, install: { ...base.install, methods: [] } }).success).toBe(false);
    expect(CatalogEntrySchema.safeParse({ ...base, sourceUrl: 'http://insecure.example' }).success).toBe(false);
  });
});

describe('catalog search and filters', () => {
  it('finds entries by name, outcome, technology and component type', () => {
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: 'superpowers' }, ctx).map((e) => e.id)).toContain('obra-superpowers');
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: 'debugging' }, ctx).map((e) => e.id)).toEqual(expect.arrayContaining(['obra-superpowers', 'custom-merge-chain-debugger']));
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: 'playwright browser' }, ctx).map((e) => e.id)).toEqual(['playwright-mcp']);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: 'react' }, ctx).map((e) => e.id)).toContain('vercel-agent-skills');
  });

  it('uses AND semantics and returns nothing for nonsense', () => {
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, query: 'playwright zzzzqqq' }, ctx)).toEqual([]);
    expect(scoreEntry(CATALOG[0]!, '')).toBe(1);
  });

  it('filters by component type, tier, game relevance, security status and freshness', () => {
    const mcp = filterCatalog(CATALOG, { ...EMPTY_FILTERS, types: ['mcp'] }, ctx).map((e) => e.id).sort();
    expect(mcp).toEqual(['mcp-reference-servers', 'playwright-mcp']);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, tiers: ['custom'] }, ctx).length).toBe(3);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, tiers: ['official'] }, ctx).map((e) => e.id).sort()).toEqual(['anthropics-skills', 'skill-creator-plugin']);
    for (const e of filterCatalog(CATALOG, { ...EMPTY_FILTERS, minGameRelevance: 3 }, ctx)) expect(e.relevance.gameDev).toBe(3);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, securityStatus: ['not-reviewed'] }, ctx).length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, freshness: ['fresh'] }, ctx).length).toBe(CATALOG.filter((e) => e.verifiedAt).length);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, freshness: ['stale'] }, { ...ctx, today: '2027-06-01' }).length).toBe(CATALOG.filter((e) => e.verifiedAt).length);
  });

  it('filters by Arsenal membership', () => {
    const inArsenal = { today: ctx.today, arsenalStatus: new Map([['playwright-mcp', 'evaluating' as const]]) };
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, arsenal: 'in' }, inArsenal as never).map((e) => e.id)).toEqual(['playwright-mcp']);
    expect(filterCatalog(CATALOG, { ...EMPTY_FILTERS, arsenal: 'out' }, inArsenal as never).map((e) => e.id)).not.toContain('playwright-mcp');
  });

  it('freshness buckets', () => {
    expect(freshnessOf(CATALOG_SNAPSHOT_DATE, '2026-11-20')).toBe('fresh');
    expect(freshnessOf(CATALOG_SNAPSHOT_DATE, '2027-01-15')).toBe('aging');
    expect(freshnessOf(CATALOG_SNAPSHOT_DATE, '2027-06-01')).toBe('stale');
    expect(freshnessOf(null, '2027-06-01')).toBe('not-applicable');
  });
});
