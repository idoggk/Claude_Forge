import { CORPUS, REFERENCE_DATE } from '@/content/fixtures/retrieval';
import { chunkCorpus, search, type Hit } from '@/domain/retrieval/search';

/**
 * Playground C: retrieval. It uses the app's deterministic lexical (BM25) search over a small fictional corpus. It does NOT
 * simulate embeddings, semantic similarity, reranking or any language model, and it generates no answers. What it shows is why
 * the passages a system retrieves decide whether a grounded answer is even possible.
 */
export type Label = 'current' | 'stale' | 'unverified' | 'irrelevant';
export interface Question { id: string; text: string; version: string; /** A phrase that states the answer. */ answerPhrase: string; current: string[]; stale: string[]; unverified: string[]; goodQuery: string; vagueQuery: string }

export const QUESTIONS: Question[] = [
  { id: 'q-timeout', text: 'What is the default timeout for the sync command in version 4.2?', version: '4.2', answerPhrase: 'default request timeout for sync is 60 seconds', current: ['ref-cli'], stale: ['changelog-3', 'internal-wiki', 'changelog-4'], unverified: ['forum-45'], goodQuery: 'default request timeout sync command', vagueQuery: 'timeout' },
  { id: 'q-auth', text: 'How do I authenticate the command line tool?', version: '4.2', answerPhrase: 'Set the QUILLBRIDGE_TOKEN environment variable', current: ['auth-guide'], stale: ['changelog-3'], unverified: [], goodQuery: 'authenticate CLI environment variable token', vagueQuery: 'login' },
  { id: 'q-retries', text: 'How many times is a failed request repeated by default?', version: '4.2', answerPhrase: 'default is 3', current: ['ref-config'], stale: [], unverified: ['blog-tuning'], goodQuery: 'retries setting failed request repeated default', vagueQuery: 'retry' },
];

export interface RetrievalState { questionId: string; query: string; topK: number; sentencesPerChunk: number }
export interface LabelledHit extends Hit { label: Label }
export interface RetrievalReading {
  hits: LabelledHit[];
  /** A retrieved passage states the answer and comes from a current source. */
  answerRetrieved: boolean;
  answerRank: number | null;
  conflicting: LabelledHit[];
  irrelevantShare: number;
  effects: { id: string; tone: 'ok' | 'warn' | 'bad' | 'info'; text: string }[];
  grounded: boolean;
}

export const questionById = (id: string): Question => QUESTIONS.find((q) => q.id === id) ?? QUESTIONS[0]!;

export function labelOf(q: Question, docId: string): Label {
  if (q.current.includes(docId)) return 'current';
  if (q.stale.includes(docId)) return 'stale';
  if (q.unverified.includes(docId)) return 'unverified';
  return 'irrelevant';
}

export function runRetrieval(s: RetrievalState): RetrievalReading {
  const q = questionById(s.questionId);
  const chunks = chunkCorpus(CORPUS, Math.max(1, Math.min(3, s.sentencesPerChunk)));
  const hits: LabelledHit[] = search(chunks, s.query, Math.max(1, Math.min(5, s.topK))).map((h) => ({ ...h, label: labelOf(q, h.docId) }));
  const answerHit = hits.find((h) => h.label === 'current' && h.text.includes(q.answerPhrase));
  const conflicting = hits.filter((h) => h.label === 'stale' || h.label === 'unverified');
  const irrelevant = hits.filter((h) => h.label === 'irrelevant');
  const irrelevantShare = hits.length ? irrelevant.length / hits.length : 0;
  const effects: RetrievalReading['effects'] = [];
  const e = (id: string, tone: 'ok' | 'warn' | 'bad' | 'info', text: string) => effects.push({ id, tone, text });
  if (hits.length === 0) e('none', 'bad', 'Nothing was retrieved: no passage shares a word with this query. With no passages there is nothing to ground an answer in. (A real semantic index might still find something; this one is word-based.)');
  if (hits.length > 0 && !answerHit) e('missing', 'bad', 'The passage that states the answer was not retrieved. A model answering from these would have to guess or fall back on what it remembers.');
  if (answerHit) e('found', 'ok', `The current source that states the answer is retrieved at rank ${answerHit.rank}.`);
  if (conflicting.length > 0) e('conflict', 'warn', `${conflicting.length} retrieved passage${conflicting.length === 1 ? '' : 's'} come from stale or unverified sources that may disagree. A grounded answer has to say which one applies and why.`);
  if (irrelevantShare >= 0.5) e('noise', 'warn', `${Math.round(irrelevantShare * 100)}% of what was retrieved is not about the question, which spends context and can mislead.`);
  if (answerHit && answerHit.rank > 1 && conflicting.some((c) => c.rank < answerHit.rank)) e('rank', 'info', 'A weaker source ranks above the current one. Rank is similarity to the query, not reliability.');
  const grounded = !!answerHit && conflicting.every((c) => c.rank > answerHit.rank) && irrelevantShare < 0.5;
  if (grounded) e('grounded', 'ok', 'A grounded answer is possible: the current source is retrieved first, nothing contradicting it outranks it, and the retrieved set is mostly on topic.');
  return { hits, answerRetrieved: !!answerHit, answerRank: answerHit?.rank ?? null, conflicting, irrelevantShare, effects, grounded };
}

export const REFERENCE = REFERENCE_DATE;

export interface RetrievalChallenge { id: string; title: string; goal: string; met: (s: RetrievalState) => boolean }
export const RETRIEVAL_CHALLENGES: RetrievalChallenge[] = [
  { id: 'r1', title: 'Find the current answer', goal: 'Ask about the sync timeout so that the current source that states the answer is retrieved.', met: (s) => s.questionId === 'q-timeout' && runRetrieval(s).answerRetrieved },
  { id: 'r2', title: 'Ground it', goal: 'Retrieve the current source for the timeout question with nothing stale or unverified ranking above it, using at most three passages and a query of at least three words.', met: (s) => s.questionId === 'q-timeout' && s.topK <= 3 && s.query.trim().split(/\s+/).length >= 3 && runRetrieval(s).grounded },
  { id: 'r3', title: 'Beat the trap', goal: 'Ask how many times a failed request is repeated, and retrieve the configuration reference with no blog post outranking it, using at most three passages and a query of at least three words.', met: (s) => s.questionId === 'q-retries' && s.topK <= 3 && s.query.trim().split(/\s+/).length >= 3 && runRetrieval(s).grounded },
];
