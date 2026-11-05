import { describe, expect, it } from 'vitest';
import { CORPUS, REFERENCE_DATE } from '@/content/fixtures/retrieval';
import { ageDays, chunkCorpus, chunkDoc, search, tokenize } from '@/domain/retrieval/search';

describe('retrieval fixture engine (deterministic, lexical, no network)', () => {
  it('tokenizes predictably: lowercases, drops stop words, strips one plural s', () => {
    expect(tokenize('The default Timeouts for SYNC!')).toEqual(['default', 'timeout', 'sync']);
    expect(tokenize('')).toEqual([]);
  });

  it('chunking is deterministic, loses nothing, and chunk size changes how many chunks exist', () => {
    const doc = CORPUS[0]!;
    const c1 = chunkDoc(doc, 1);
    const c2 = chunkDoc(doc, 2);
    expect(c1.length).toBeGreaterThan(c2.length);
    expect(c1.map((c) => c.text).join(' ')).toBe(doc.text);
    expect(c2.map((c) => c.text).join(' ')).toBe(doc.text);
    expect(new Set(c1.map((c) => c.chunkId)).size).toBe(c1.length);
    expect(chunkDoc(doc, 0).length).toBe(c1.length); // size floors at one sentence
  });

  it('ranking is reproducible and ties break by chunk id', () => {
    const chunks = chunkCorpus(CORPUS, 2);
    const a = search(chunks, 'default timeout for sync', 5);
    const b = search(chunks, 'default timeout for sync', 5);
    expect(a).toEqual(b);
    expect(a.map((h) => h.rank)).toEqual([1, 2, 3, 4, 5].slice(0, a.length));
    for (let i = 1; i < a.length; i++) expect(a[i - 1]!.score).toBeGreaterThanOrEqual(a[i]!.score);
  });

  it('retrieval returns what is SIMILAR, not what is current or true: stale and unverified passages rank among the top hits', () => {
    const hits = search(chunkCorpus(CORPUS, 2), 'what is the default timeout for sync', 6);
    const docs = hits.map((h) => h.docId);
    expect(docs).toContain('ref-cli'); // the right, current answer is retrievable
    expect(docs).toContain('changelog-3'); // so is the superseded one
    expect(docs.some((d) => d === 'forum-45' || d === 'internal-wiki')).toBe(true); // and unverified or version-specific ones
  });

  it('a lexically similar but irrelevant document is retrieved too (the "session timeout" trap)', () => {
    const hits = search(chunkCorpus(CORPUS, 2), 'timeout', 8).map((h) => h.docId);
    expect(hits).toContain('dash-session');
  });

  it('a query with no shared words returns nothing: this fixture has no semantic search', () => {
    expect(search(chunkCorpus(CORPUS, 2), 'how patient is the program when connections stall')).toEqual([]);
    expect(search(chunkCorpus(CORPUS, 2), '   ')).toEqual([]);
    expect(search([], 'timeout')).toEqual([]);
  });

  it('metadata is carried through untouched and unknown stays unknown', () => {
    const hit = search(chunkCorpus(CORPUS, 2), 'compress assets', 1)[0]!;
    expect(hit.docId).toBe('blog-tuning');
    expect(hit.date).toBeNull();
    expect(hit.version).toBeNull();
    expect(ageDays(hit.date, REFERENCE_DATE)).toBeNull();
    expect(ageDays('2026-11-04', '2026-11-05')).toBe(1);
    expect(ageDays('not a date', '2026-11-05')).toBeNull();
  });

  it('the corpus is fabricated: no real product, URL or credential', () => {
    const text = JSON.stringify(CORPUS);
    expect(text).not.toMatch(/https?:\/\/|@[a-z0-9-]+\.(com|org)|sk-[a-z0-9]{6,}/i);
    expect(new Set(CORPUS.map((d) => d.id)).size).toBe(CORPUS.length);
  });
});
