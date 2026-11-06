import { useMemo, useState } from 'react';
import type { Lesson } from '@/domain/curriculum/types';
import { Badge, Button, Callout, Card, SelectField, TextInput } from '@/components/ui';
import { CORPUS, REFERENCE_DATE } from '@/content/fixtures/retrieval';
import { ageDays, chunkCorpus, search, tokenize } from '@/domain/retrieval/search';

type W = { lesson: Lesson };

const EXAMPLES = ['what is the default timeout for sync', 'timeout', 'how do I authenticate the CLI', 'upload size limit', 'how patient is the program when connections stall'];

/** Words of `text` that matched the query, shown in bold. Plain text rendering only. */
function Highlighted({ text, terms }: { text: string; terms: Set<string> }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) => {
        const t = tokenize(p)[0];
        return t && terms.has(t) ? <mark key={i} className="rounded bg-accent/25 px-0.5 text-fg">{p}</mark> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

/**
 * Lesson 22 widget: explore a tiny retrieval system. It is a lexical (BM25) search over an invented corpus. It never
 * calls a model or the network, and it says plainly what it does not simulate.
 */
export function RetrievalLab(_: W) {
  const [query, setQuery] = useState(EXAMPLES[0]!);
  const [submitted, setSubmitted] = useState(EXAMPLES[0]!);
  const [size, setSize] = useState('2');
  const chunks = useMemo(() => chunkCorpus(CORPUS, Number(size)), [size]);
  const hits = useMemo(() => search(chunks, submitted, 6), [chunks, submitted]);
  const terms = useMemo(() => new Set(tokenize(submitted)), [submitted]);

  return (
    <Card aria-labelledby="rl-h" data-testid="retrieval-lab">
      <h3 id="rl-h" className="font-semibold">Retrieval lab: an invented tool’s documentation</h3>
      <p className="mt-1 text-sm text-muted">{CORPUS.length} short documents about an invented command-line tool, split into chunks and ranked by word overlap (BM25). Today in this fixture is {REFERENCE_DATE}.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setSubmitted(query); }}>
        <TextInput label="Question or search words" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="rl-query" />
        <SelectField label="Chunk size" value={size} onChange={(e) => setSize(e.target.value)} data-testid="rl-size">
          <option value="1">1 sentence</option><option value="2">2 sentences</option><option value="3">3 sentences</option>
        </SelectField>
        <Button type="submit" variant="primary" data-testid="rl-search">Search</Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Example searches">
        {EXAMPLES.map((x) => <Button key={x} size="sm" variant="ghost" onClick={() => { setQuery(x); setSubmitted(x); }}>{x}</Button>)}
      </div>
      <p className="mt-3 text-sm text-muted" role="status" data-testid="rl-count">{hits.length === 0 ? 'No chunk shares a word with this query.' : `${hits.length} chunk${hits.length === 1 ? '' : 's'} returned, best first.`} {chunks.length} chunks in the index.</p>
      {hits.length === 0 && submitted.trim() && <Callout tone="info" title="Nothing found is itself a lesson">This index matches words only. A semantic (embedding) index might still have found a related passage; this fixture cannot show that.</Callout>}
      <ol className="mt-3 space-y-2" data-testid="rl-results">
        {hits.map((h) => {
          const age = ageDays(h.date, REFERENCE_DATE);
          return (
            <li key={h.chunkId} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">#{h.rank} · score {h.score}</Badge>
                <span className="font-semibold">{h.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Source: {h.source} · date: {h.date ?? 'unknown'}{age !== null ? ` (${age} days before today)` : ''} · version: {h.version ?? 'unknown'} · chunk {h.chunkId}</p>
              <p className="mt-1"><Highlighted text={h.text} terms={terms} /></p>
              <p className="mt-1 text-xs text-muted">Matched words: {h.matched.join(', ')}</p>
            </li>
          );
        })}
      </ol>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">What this fixture does not simulate</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          <li>Embeddings and semantic similarity: a query with no shared words finds nothing here.</li>
          <li>Reranking, rank fusion and contextual chunk augmentation, as used in production retrieval systems.</li>
          <li>Any language model: nothing here reads the chunks or writes an answer.</li>
          <li>Real-world scale, noise and latency. Rank order and scores here describe this tiny corpus only.</li>
        </ul>
      </details>
    </Card>
  );
}
