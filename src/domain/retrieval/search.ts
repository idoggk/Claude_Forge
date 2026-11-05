/**
 * A deliberately small, deterministic retrieval engine for teaching. It implements lexical search (BM25) over chunks
 * of text, so the principles of chunking, scoring, ranking, metadata and attribution can be seen and tested.
 *
 * What it does NOT simulate (and the lesson says so): embeddings and semantic similarity (so a query that shares no
 * words with the right passage finds nothing here, where a real semantic index might), rank fusion, reranking models,
 * contextual chunk augmentation, approximate nearest-neighbour search, or any language model. It has no network access.
 */
export interface SourceDoc {
  id: string;
  title: string;
  /** Where the text came from, as a reader would cite it. */
  source: string;
  /** ISO date the document states for itself, or null when unknown. Never inferred. */
  date: string | null;
  /** Product or document version the text applies to, or null when unknown. */
  version: string | null;
  text: string;
}

export interface Chunk {
  chunkId: string;
  docId: string;
  title: string;
  source: string;
  date: string | null;
  version: string | null;
  text: string;
}

export interface Hit extends Chunk {
  score: number;
  matched: string[];
  rank: number;
}

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'were', 'be', 'it', 'its', 'and', 'or', 'by', 'with', 'as', 'at', 'this', 'that', 'what', 'which', 'how', 'do', 'does', 'i', 'my', 'you', 'your', 'can', 'if', 'from', 'when']);

/** Lowercase, split on non-alphanumerics, drop stop words, and strip one trailing "s" so "timeouts" matches "timeout". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 0 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

/** Split into sentences, then group `sentencesPerChunk` consecutive sentences into one chunk. Deterministic. */
export function chunkDoc(doc: SourceDoc, sentencesPerChunk: number): Chunk[] {
  const n = Math.max(1, Math.floor(sentencesPerChunk));
  const sentences = doc.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: Chunk[] = [];
  for (let i = 0; i < sentences.length; i += n) {
    out.push({ chunkId: `${doc.id}#${out.length + 1}`, docId: doc.id, title: doc.title, source: doc.source, date: doc.date, version: doc.version, text: sentences.slice(i, i + n).join(' ') });
  }
  return out;
}

export function chunkCorpus(corpus: SourceDoc[], sentencesPerChunk: number): Chunk[] {
  return corpus.flatMap((d) => chunkDoc(d, sentencesPerChunk));
}

/** BM25 with k1 = 1.5 and b = 0.75 over the supplied chunks. Chunks that share no query term are not returned. */
export function search(chunks: Chunk[], query: string, topK = 5): Hit[] {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0 || chunks.length === 0) return [];
  const docs = chunks.map((c) => ({ c, tokens: tokenize(`${c.title} ${c.text}`) }));
  const avg = docs.reduce((a, d) => a + d.tokens.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const t of q) df.set(t, docs.filter((d) => d.tokens.includes(t)).length);
  const k1 = 1.5;
  const b = 0.75;
  const N = docs.length;
  const scored = docs.map((d) => {
    let score = 0;
    const matched: string[] = [];
    for (const t of q) {
      const tf = d.tokens.filter((x) => x === t).length;
      if (tf === 0) continue;
      matched.push(t);
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.tokens.length) / avg)));
    }
    return { c: d.c, score, matched };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, z) => z.score - a.score || a.c.chunkId.localeCompare(z.c.chunkId))
    .slice(0, topK)
    .map((s, i) => ({ ...s.c, score: Math.round(s.score * 1000) / 1000, matched: s.matched, rank: i + 1 }));
}

/** Days between two ISO dates (YYYY-MM-DD), or null if either is missing. */
export function ageDays(from: string | null, to: string): number | null {
  if (!from) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
