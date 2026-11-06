import type { Lesson } from '@/domain/curriculum/types';
import { o, ARTICLES, DOCS } from './helpers';
import { VERDICT_LABELS } from '@/content/fixtures/retrieval';

const VERDICTS = VERDICT_LABELS.map((v) => ({ id: v.id as string, label: v.label }));

const CAUSES = [
  { id: 'chunking', label: 'Chunking' },
  { id: 'ranking', label: 'Ranking and matching' },
  { id: 'staleness', label: 'Stale or wrong-version source' },
  { id: 'coverage', label: 'The answer is not in the corpus' },
];

/** A fabricated answer transcript from a retrieval-backed assistant. */
const ANSWER_LOG = [
  'Question: What is the default sync timeout in version 4.2?',
  'Retrieved 1: Release notes 3.0 (2022): "The default request timeout for sync is 30 seconds."',
  'Retrieved 2: Dashboard guide (2026): "The web dashboard signs you out after 30 minutes."',
  'Retrieved 3: Reference manual 4.2 (2026): "The default request timeout for sync is 60 seconds."',
  'Answer: The default is 30 seconds [Release notes 3.0].',
  'Confidence: high, because the answer cites a source.',
];
const ANSWER_LOG_TARGETS = [
  { line: 2, severity: 'major' as const, why: 'A source for version 3.0 is retrieved for a question about 4.2. Matching words says nothing about the version.' },
  { line: 3, severity: 'minor' as const, why: 'A different kind of "timeout" (dashboard sign-out). It is lexically close and irrelevant, which is what word-based search does.' },
  { line: 5, severity: 'critical' as const, why: 'The answer is built on the stale snippet even though the current reference manual was retrieved. The right evidence was available and rejected.' },
  { line: 6, severity: 'critical' as const, why: 'A citation shows where text came from, not that it is current or applies. "Cites a source" is not a confidence measure.' },
];

export const L22: Lesson = {
  id: 'L22-retrieval-augmented-generation',
  version: 2,
  track: 'advanced',
  alsoIn: ['research', 'prompting'],
  order: 22,
  title: 'Retrieval-Augmented Generation (RAG)',
  subtitle: 'How retrieval works, how it fails, and how to choose evidence - on a deterministic fixture with no API or database',
  prerequisites: ['L12-context-engineering'],
  competencies: ['retrieval-design'],
  effortMinutes: 45,
  gameRelevance: 0,
  interestTags: ['context', 'ai-judgment', 'foundations'],
  problem: 'A documentation assistant answers "What is the default sync timeout?" with confidence and a citation. The citation is to release notes from 2022. The current reference manual, which says something different, was retrieved too - one rank lower - and the assistant never used it.',
  whyItMatters: 'Retrieval is how models get your private, current or very large knowledge. It is also where answers quietly go wrong: the right passage is not found, the wrong one is found first, or a confident answer is built on something stale. Understanding the pipeline lets you debug it and evaluate it.',
  objectives: [
    'Explain the difference between what a model knows and what retrieval supplies at question time.',
    'Describe the pipeline: chunking, indexing, lexical and semantic search, selection, answer and attribution.',
    'Diagnose retrieval failures: no match, wrong match, stale, contradictory, split or oversized context.',
    'Choose evidence for a question by judging relevance, authority, currency and agreement - and reject the rest.',
    'Say plainly what a simplified fixture does and does not demonstrate.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Similar is not current',
      prediction: {
        prompt: 'A search over your documentation returns an outdated release note as result #1 and the current reference manual as result #3 for the question you asked. Which statement is true?',
        options: [
          o('a', 'Ranking measures similarity to the query, not currency or authority, so the best answer can sit below a stale one', 'Search ranks what matches the words or meaning, not what is true now.'),
          o('b', 'Result #1 must be the best answer, or the search would not have ranked it first', 'Rank reflects similarity, not correctness.', 'retrieved-means-true'),
          o('c', 'The model will always pick the right passage anyway', 'It may not, and an answer built on the wrong one will look equally confident.', 'retrieved-means-true'),
        ],
        correct: 'a',
      },
      body: `A language model's parameters hold general patterns learned in training. They do not hold **your** documents, anything that changed after training, or a precise copy of a long source. **Retrieval-augmented generation (RAG)** adds a step: at question time, find relevant passages in a collection, place them in the model's context, and ask the model to answer *from them*.

That buys you **current and private knowledge**, **attribution** (here is the passage), and the ability to work with a collection far larger than the context window. It costs you a new set of failure modes - and a new attack surface, because retrieved text is untrusted data (see the prompt-injection lesson).

Throughout this lesson you will use a small fixture: a retrieval system over invented documentation. It is deliberately simple so you can see every step; its limits are listed at the end.`,
    },
    {
      id: 's2',
      title: 'The pipeline',
      body: `1. **Chunk.** Split documents into pieces small enough to retrieve and read. Too large and a chunk carries a lot of irrelevant text (and uses context); too small and a chunk loses the context that made it meaningful. Anthropic's article on contextual retrieval gives the classic example: a chunk saying revenue "grew by 3% over the previous quarter" no longer says which company or which quarter.
2. **Index.** Store chunks so they can be searched, together with **metadata**: source, date, version, authority. Metadata is what lets you judge a hit later.
3. **Search.** Two families, often combined:
   - **Lexical** (for example BM25): matches the words. Excellent for exact identifiers, error codes and technical terms; blind to paraphrase.
   - **Semantic** (embeddings): matches meaning. Finds related passages with different words; can miss an exact term.
   Production systems often **fuse** both rankings and then **rerank** the top candidates with a dedicated model.
4. **Select.** Decide which hits to use. This is the step people skip.
5. **Answer with attribution.** The model answers from the selected evidence and says where it came from, or says it could not find support.

Anthropic describes **contextual retrieval**: prepend a short, chunk-specific explanation of where the chunk sits in its document before indexing, so each chunk carries the context it lost. Their reported results show fewer retrieval failures with contextual embeddings, more with BM25 added, and more again with reranking - the article gives the exact conditions and numbers, which you should read before quoting them.`,
    },
    {
      id: 's3',
      title: 'How retrieval fails',
      body: `| Failure | What you see | Typical fix |
|---|---|---|
| **No match** | Nothing relevant returned, or the answer is simply not in the corpus | Better coverage; rewrite the query; say "not found" rather than guess |
| **Wrong match** | A passage with the right words and the wrong meaning ("session timeout" for a request timeout) | Metadata filters; query rewriting; semantic search; reranking |
| **Stale** | An old document outranks the current one | Dates and versions in metadata; filter or prefer the current; retire superseded documents |
| **Contradiction** | Two sources disagree | Prefer the more authoritative and current; surface the conflict instead of averaging |
| **Split answer** | The answer needs two chunks; only one is retrieved | Overlap or larger chunks; retrieve more and merge |
| **Overload** | Too many chunks crowd the context; the key one is buried | Retrieve fewer, rerank, summarise; respect the context budget |
| **Injection** | A retrieved passage contains instructions | Treat retrieved text as untrusted data |

Most of these are visible in the **retrieval itself**, before any model is involved. That is why retrieval should be evaluated separately from answer generation.`,
    },
    {
      id: 's4',
      title: 'Selecting evidence',
      body: `For each retrieved snippet, ask five questions in this order:

1. **Relevant?** Does it actually answer *this* question, or just share words with it?
2. **Current and applicable?** Does its date and version fit what was asked? A statement about version 3.0 does not answer a question about 4.2.
3. **Authoritative?** An official reference outranks a forum guess; an unverified post is a lead, not evidence.
4. **Corroborated or contradicted?** Do other good sources agree? If two disagree, find out why (a version change is the usual reason) before choosing.
5. **Specific enough?** A passage that says "retry logic matters more than any timeout" is advice, not the value you asked for.

A snippet that fails question 1 is **irrelevant**; question 2, **stale**; questions 3 or 4, **unverified or conflicting**. What survives is your evidence, and a good answer **cites it with its date and version** and states any unresolved conflict. If nothing survives, the correct answer is "I could not find a reliable source".`,
    },
    {
      id: 's5',
      title: 'Evaluating retrieval',
      body: `Evaluate the retrieval step on its own, then the whole pipeline:

- Build a **labelled question set**: each question with the passage(s) that really answer it. Keep part of it **held out** so you do not tune only to what you can see.
- Measure **whether the right passage appears in the top k** results (a hit rate), per question type. Read the misses: which failure from the table above?
- Separately measure **answer faithfulness** (is the answer supported by the passages it used?) and **end-to-end correctness**.
- Re-run the set whenever the corpus, chunking or index changes: retrieval regressions are silent otherwise.
- Report counts and provenance, as in the evaluation lessons.

Anthropic's evaluation guidance applies unchanged: mirror your real question distribution, include edge cases, and automate grading where you can.`,
    },
    {
      id: 's6',
      title: 'What this lesson\'s fixture is - and is not',
      body: `The **retrieval lab** below is a real, working lexical (BM25) search over ten invented documents, with a chunk-size control and metadata shown for every hit. It is deterministic, offline and free: no embedding API, no vector database, no model.

It **does not simulate**: embeddings or semantic similarity (a query with no shared words finds nothing here), rank fusion, reranking, contextual augmentation, real scale or noise, or any language model. So the rankings you see describe this tiny corpus only, and nothing here shows how well a production system would do. What it *does* show faithfully is the part that does not depend on those things: chunking changes what can be found, ranking measures similarity, metadata is what lets you reject a stale hit, and **selection is a judgment you must make**.`,
    },
    {
      id: 's7',
      title: 'Worked example: the timeout question',
      body: `*Question: "What is the default sync timeout in Quillbridge 4.2?"* The lab returns several chunks; judge them:

- **Reference manual, v4.2, 2026-09-14:** "The default request timeout for sync is 60 seconds." - official, current, answers it. **Use.**
- **4.0 release notes, 2025-05-20:** raises the default from 30 to 60 seconds. - official, explains *why* older text differs. **Use as corroboration.**
- **3.0 release notes, 2022:** 30 seconds. - official, but for a superseded version. **Stale.**
- **Team wiki, v3.5, 2024:** the build servers still use 30 seconds. - true for *their* version, not 4.2. **Stale for this question.**
- **Forum post, no version:** "I think it is 45 seconds." - unverified, and it contradicts the official sources. **Reject as unverified.**
- **Dashboard guide:** sign-out after 30 minutes. - a different timeout. **Irrelevant.**

**Answer:** "60 seconds in 4.2 (reference manual, 2026-09-14); it was 30 seconds before 4.0." Two supporting sources, one explained conflict, and the rejected snippets noted.`,
    },
  ],
  activity: {
    title: 'Search, then choose your evidence',
    intro: 'Use the lab, then judge snippets for one question. The corpus is invented; nothing leaves your device.',
    widget: 'retrieval-lab',
    items: [
      {
        id: 'l22-p1',
        kind: 'classify',
        concept: 'retrieval-design',
        prompt: 'Question: "What is the default sync timeout in Quillbridge 4.2?" Judge each retrieved snippet (today is 2026-11-05).',
        categories: VERDICTS,
        entries: [
          { id: 'e1', text: 'Reference manual, v4.2, 2026-09-14: "The default request timeout for sync is 60 seconds."', correct: 'use', why: 'Official, current, applies to 4.2 and answers the question.' },
          { id: 'e2', text: 'Release notes 4.0, 2025-05-20: "raises the default request timeout for sync from 30 seconds to 60 seconds."', correct: 'use', why: 'Official and it corroborates the current value while explaining the older one.' },
          { id: 'e3', text: 'Release notes 3.0, 2022-03-02: "The default request timeout for sync is 30 seconds."', correct: 'stale', why: 'Official but for a superseded version.' },
          { id: 'e4', text: 'Forum post, 2025-11-11, version unknown: "I think the default timeout for sync is 45 seconds."', correct: 'conflict', why: 'Unverified, hedged and contradicted by official sources.' },
          { id: 'e5', text: 'Dashboard guide, v4.2: "The web dashboard signs you out after 30 minutes of inactivity."', correct: 'irrelevant', why: 'A different kind of timeout, retrieved because it shares a word.' },
          { id: 'e6', text: 'Team wiki, v3.5, 2024-02-10: "Our build servers run Quillbridge 3.5, so the sync timeout there is still the old default of 30 seconds."', correct: 'stale', why: 'True for version 3.5, not for 4.2.' },
        ],
        explanation: 'Two sources survive; the rest are stale, unverified or irrelevant.',
      },
      {
        id: 'l22-p2',
        kind: 'classify',
        concept: 'retrieval-design',
        prompt: 'Which stage of the pipeline is the most likely cause of each problem?',
        categories: CAUSES,
        entries: [
          { id: 'f1', text: 'A passage says "it grew by 3%" and the retrieved chunk does not say what grew', correct: 'chunking', why: 'The chunk lost the context that made it meaningful.' },
          { id: 'f2', text: 'The top results are about dashboard sign-out for a question about request timeouts', correct: 'ranking', why: 'Word overlap without matching meaning.' },
          { id: 'f3', text: 'The best-ranked passage describes version 3.0 and the user asked about 4.2', correct: 'staleness', why: 'Metadata (version, date) was not used to prefer or filter.' },
          { id: 'f4', text: 'No passage in the collection mentions the feature the user asked about', correct: 'coverage', why: 'Retrieval cannot return what is not there; the honest answer is "not found".' },
        ],
        explanation: 'Locate the failure before changing anything.',
      },
      {
        id: 'l22-p3',
        kind: 'numeric',
        concept: 'retrieval-design',
        prompt: 'You retrieve the top 8 chunks of about 300 tokens each. Your context budget for retrieved text is 1,500 tokens. How many whole chunks fit?',
        answer: 5,
        tolerance: 0,
        unit: 'chunks',
        hints: ['Divide the budget by the chunk size and round down.'],
        explanation: '1,500 / 300 = 5. Retrieving 8 and using 5 means rank order and reranking decide which three are dropped.',
      },
      {
        id: 'l22-p4',
        kind: 'multi',
        concept: 'retrieval-design',
        prompt: 'Which of these does the retrieval lab NOT simulate? Select all.',
        options: [
          o('a', 'Embeddings and semantic similarity', 'It matches words only.'),
          o('b', 'Reranking with a dedicated model', 'There is no reranker.'),
          o('c', 'A language model reading the chunks and answering', 'No model is involved.'),
          o('d', 'Splitting documents into chunks and ranking them by word overlap', 'It does simulate exactly this.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Knowing what a fixture leaves out is part of using it honestly.',
      },
    ],
  },
  assessment: {
    title: 'Choose evidence and diagnose retrieval',
    intro: 'A new question and new snippets, no hints. The evidence-selection question is a mandatory check.',
    passMark: 0.8,
    items: [
      {
        id: 'l22-a1',
        kind: 'classify',
        concept: 'retrieval-design',
        critical: true,
        points: 3,
        prompt: 'Question: "How does the Quillbridge CLI authenticate in version 4.2?" Judge each snippet (today is 2026-11-05).',
        categories: VERDICTS,
        entries: [
          { id: 'b1', text: 'Reference manual, v4.2, 2026-09-14: "Set the QUILLBRIDGE_TOKEN environment variable before running any command."', correct: 'use', why: 'Official, current and answers the question directly.' },
          { id: 'b2', text: 'Release notes 4.0, 2025-05-20: "Authentication now uses an environment variable instead of a token file."', correct: 'use', why: 'Official and it corroborates the current method.' },
          { id: 'b3', text: 'Release notes 3.0, 2022-03-02: "Authentication uses a token file in the home directory."', correct: 'stale', why: 'Official, but describes a superseded version.' },
          { id: 'b4', text: 'Forum post, version unknown: "I just put my password in quillbridge.toml and it works for me."', correct: 'conflict', why: 'Unverified, contradicts the official method, and describes an insecure practice.' },
          { id: 'b5', text: 'Service limits, v4.2: "Rate limits apply per token, not per project."', correct: 'irrelevant', why: 'It mentions tokens but does not say how authentication works.' },
          { id: 'b6', text: 'Dashboard guide, v4.2: "The web dashboard signs you out after 30 minutes of inactivity."', correct: 'irrelevant', why: 'Dashboard sessions are not CLI authentication.' },
        ],
        explanation: 'Two official, current sources survive. The old method is stale, the forum post is unverified, and two snippets only share vocabulary.',
      },
      {
        id: 'l22-a2',
        kind: 'fields',
        concept: 'retrieval-design',
        points: 3,
        prompt: 'Plan the retrieval for an assistant that answers questions about a software product\'s documentation. Answer each part concretely.',
        brief: `**Corpus:** reference manuals for several product versions, release notes back several years, a community forum export and a few internal wiki pages. Questions include error codes ("E4021") and plain-language questions ("why does my upload stop?").`,
        fields: [
          {
            id: 'chunking',
            label: 'How you chunk the documents',
            help: 'Size, boundaries and what each chunk must keep.',
            groups: [
              { label: 'boundaries that respect structure', anyOf: ['section', 'heading', 'paragraph', 'sentence', 'sentences', 'structure', 'boundar'] },
              { label: 'keeping context with the chunk', anyOf: ['title', 'context', 'metadata', 'overlap', 'document name', 'prepend', 'carry'] },
            ],
            placeholder: 'e.g. split by section, keeping ...',
          },
          {
            id: 'metadata',
            label: 'The metadata you store and how you use it',
            help: 'What lets you judge a hit.',
            groups: [
              { label: 'source, date and version', anyOf: ['version', 'date', 'source', 'author', 'publisher', 'authority', 'official'] },
              { label: 'used to filter or prefer', anyOf: ['filter', 'prefer', 'rank', 'boost', 'restrict', 'exclude', 'prioriti'] },
            ],
            placeholder: 'e.g. store ... and use it to ...',
          },
          {
            id: 'search',
            label: 'Your search approach',
            help: 'Think about error codes versus plain-language questions.',
            groups: [
              { label: 'lexical matching for exact terms', anyOf: ['bm25', 'lexical', 'keyword', 'exact match', 'exact term', 'error code', 'identifier'] },
              { label: 'semantic search for paraphrase, or a combination', anyOf: ['semantic', 'embedding', 'hybrid', 'combine', 'both', 'paraphrase', 'meaning', 'rerank'] },
            ],
            placeholder: 'e.g. use ... for error codes and ... for ...',
          },
          {
            id: 'answer',
            label: 'How the answer treats evidence',
            help: 'Attribution and what to do when evidence is weak or conflicting.',
            groups: [
              { label: 'cites source, date and version', anyOf: ['cite', 'citation', 'attribut', 'link to', 'show the source', 'date and version'] },
              { label: 'says so when evidence is missing or conflicting', anyOf: ['not found', 'cannot find', "can't find", 'no reliable', 'conflict', 'disagree', 'uncertain', 'say so', 'flag'] },
            ],
            placeholder: 'e.g. answers cite ... and when ... the assistant says ...',
          },
        ],
        explanation: 'Structure-aware chunks that keep their context, metadata used to filter or prefer, lexical plus semantic search, and answers that cite and admit gaps.',
      },
      {
        id: 'l22-a3',
        kind: 'flaglines',
        concept: 'retrieval-design',
        filename: 'assistant-answer.log (fabricated)',
        lines: ANSWER_LOG,
        prompt: 'Flag the lines where retrieval or evidence selection went wrong. Some lines are neutral.',
        targets: ANSWER_LOG_TARGETS,
        explanation: 'A wrong-version source, an irrelevant-but-similar hit, an answer built on the stale snippet although the current one was retrieved, and a confidence claim that rests on a citation.',
      },
      {
        id: 'l22-a4',
        kind: 'single',
        concept: 'retrieval-design',
        prompt: 'An assistant answers with a citation to a passage that was retrieved and that supports the answer exactly. What do you still need to check?',
        options: [
          o('a', 'Whether the passage is current and applies to the question\'s version and context, and whether any other source contradicts it', 'Correct: attribution shows where the text came from, not that it is right today.'),
          o('b', 'Nothing: a supporting citation proves the answer', 'A citation can point at a stale, superseded or unverified source.', 'retrieved-means-true'),
          o('c', 'Only that the citation link opens', 'A working link says nothing about correctness.', 'retrieved-means-true'),
        ],
        correct: 'a',
        explanation: 'Attribution is not validation.',
      },
      {
        id: 'l22-a5',
        kind: 'classify',
        concept: 'retrieval-design',
        prompt: 'Which stage of the pipeline is the most likely cause of each problem?',
        categories: CAUSES,
        entries: [
          { id: 'c1', text: 'The answer spans two paragraphs and only the second was retrieved', correct: 'chunking', why: 'The answer was split across chunk boundaries.' },
          { id: 'c2', text: 'A search for error code "E4021" returns pages about error handling in general', correct: 'ranking', why: 'Exact identifiers need lexical matching; a purely semantic search can drift.' },
          { id: 'c3', text: 'The top result is a 2021 workaround that was fixed two releases ago', correct: 'staleness', why: 'Currency metadata was not used.' },
          { id: 'c4', text: 'The product feature in the question was added last week and no document describes it yet', correct: 'coverage', why: 'The corpus cannot support an answer; the right response is to say so.' },
        ],
        explanation: 'Name the stage first, then fix it.',
      },
      {
        id: 'l22-a6',
        kind: 'numeric',
        concept: 'retrieval-design',
        prompt: 'You retrieve the top 10 chunks of about 200 tokens each, with a context budget of 1,200 tokens for retrieved text. How many whole chunks fit?',
        answer: 6,
        tolerance: 0,
        unit: 'chunks',
        explanation: '1,200 / 200 = 6. Reranking decides which six.',
      },
      {
        id: 'l22-a7',
        kind: 'multi',
        concept: 'retrieval-design',
        prompt: 'Which measurements evaluate the RETRIEVAL step itself, separately from the model\'s answer? Select all.',
        options: [
          o('a', 'For a set of labelled questions, how often the passage that really answers each one appears in the top k results', 'A retrieval hit rate.'),
          o('b', 'A breakdown of the misses by failure type (stale, wrong match, split, missing)', 'It tells you what to fix.'),
          o('c', 'Re-running the same question set after the corpus or chunking changes', 'Catches silent regressions.'),
          o('d', 'The average length of the model\'s answers', 'That is about the answer, not about retrieval.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Evaluate retrieval on labelled questions, and keep re-running them.',
      },
      {
        id: 'l22-a8',
        kind: 'single',
        concept: 'retrieval-design',
        prompt: 'When is adding retrieval probably NOT the right tool?',
        options: [
          o('a', 'When the whole knowledge base is small enough to include in the prompt and changes rarely', 'Correct: simply including it avoids a new failure surface.'),
          o('b', 'When answers must be current', 'Currency is a reason to use retrieval.'),
          o('c', 'When the documents are private', 'Private data is a classic reason to retrieve at question time.'),
        ],
        correct: 'a',
        explanation: 'Retrieval adds failure modes; use it when its benefits are needed.',
      },
      {
        id: 'l22-a9',
        kind: 'reflect',
        concept: 'retrieval-design',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I judge retrieved snippets for relevance, currency, authority and agreement before using them',
          'I can name the stage that caused a retrieval failure',
          'I can say what a simplified retrieval fixture does and does not show',
        ],
        explanation: 'Selection is a judgment.',
      },
    ],
  },
  failureModes: [
    'Using the top-ranked hit without reading its date, version and authority.',
    'Treating a citation as proof of correctness.',
    'Chunks that lose the context that made them meaningful.',
    'Averaging or silently choosing between contradicting sources.',
    'Crowding the context with more chunks than it can use.',
    'Evaluating only the final answer, never the retrieval step.',
  ],
  application: {
    title: 'Find one stale-answer risk in a real knowledge source',
    body: 'Take a documentation set or knowledge base you rely on (or a folder of notes). Choose five questions whose answers you know. For each, search and record the top three results with their dates, and mark each snippet use, stale, unverified or irrelevant. Count how often the right passage is in the top three. Practical takeaway: keep the question set and re-run it when the content or the search setup changes.',
    fieldPrompt: 'Log it under Growth → Field evidence when a labelled-question check catches a stale or missing answer in a real knowledge source.',
  },
  reviewItems: [
    { id: 'l22-r1', kind: 'single', concept: 'retrieval-design', difficulty: 1, prompt: 'What does retrieval-augmented generation add to a model\'s answer?', options: [o('a', 'Relevant passages found at question time and placed in context for the model to answer from', 'Correct: it matches the practice taught in this lesson.'), o('b', 'New facts permanently stored in the model', 'Retrieval supplies context per question; it does not retrain the model.'), o('c', 'A guarantee that the answer is true', 'Retrieved text can be stale or wrong.', 'retrieved-means-true')], correct: 'a', explanation: 'Context at question time.' },
    { id: 'l22-r2', kind: 'single', concept: 'retrieval-design', difficulty: 1, prompt: 'Which search type is strongest for exact identifiers such as error codes?', options: [o('a', 'Lexical search (for example BM25)', 'Correct: it matches the exact terms.'), o('b', 'Semantic search alone', 'Embeddings capture meaning and can miss an exact term.'), o('c', 'Neither can find them', 'Lexical search finds exact terms well.')], correct: 'a', explanation: 'Lexical for exact terms.' },
    { id: 'l22-r3', kind: 'single', concept: 'retrieval-design', difficulty: 2, prompt: 'What does the rank of a retrieved passage measure?', options: [o('a', 'Similarity to the query, not currency, authority or correctness', 'Correct: it matches the practice taught in this lesson.'), o('b', 'How true the passage is', 'Rank does not measure truth.', 'retrieved-means-true'), o('c', 'How recent the passage is', 'Dates are metadata, not part of similarity.', 'retrieved-means-true')], correct: 'a', explanation: 'Similarity only.' },
    { id: 'l22-r4', kind: 'multi', concept: 'retrieval-design', difficulty: 2, prompt: 'Select the questions to ask of a retrieved snippet.', options: [o('a', 'Does it answer this question?', 'This is the relevance check.'), o('b', 'Does its date and version fit?', 'This is the currency check.'), o('c', 'Is the source authoritative?', 'This is the authority check.'), o('d', 'Is it the longest snippet?', 'Length is not a quality signal.')], correct: ['a', 'b', 'c'], explanation: 'Relevance, currency, authority, agreement.' },
    { id: 'l22-r5', kind: 'single', concept: 'retrieval-design', difficulty: 2, prompt: 'Two official sources disagree about a default value. What is the sound handling?', options: [o('a', 'Find out why (often a version change), prefer the one that applies to the question, and say so', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Average the two values', 'That invents a value no source states.', 'retrieved-means-true'), o('c', 'Use whichever ranked higher', 'Rank is similarity, not correctness.', 'retrieved-means-true')], correct: 'a', explanation: 'Explain conflicts.' },
    { id: 'l22-r6', kind: 'single', concept: 'retrieval-design', difficulty: 3, prompt: 'Why does retrieved text count as untrusted data?', options: [o('a', 'Its author may be anyone, and it can contain instructions aimed at the assistant', 'Correct: retrieved text is a prompt-injection surface.'), o('b', 'Because retrieval is unreliable', 'Reliability is a separate issue from trust.'), o('c', 'It is not untrusted; it came from your own index', 'The index may contain content written by outsiders.', 'tell-it-to-ignore-injection')], correct: 'a', explanation: 'Retrieved passages are data.' },
    { id: 'l22-r7', kind: 'single', concept: 'retrieval-design', difficulty: 3, prompt: 'A chunk says "revenue grew 3% over the previous quarter" with no company or period. What is the problem and a remedy?', options: [o('a', 'It lost its context; prepend a short description of where the chunk comes from before indexing', 'Correct: this is the problem contextual retrieval addresses.'), o('b', 'It is too long; make it longer', 'The issue is missing context, not length.'), o('c', 'Nothing: the model will infer the rest', 'It may infer wrongly.')], correct: 'a', explanation: 'Keep context with the chunk.' },
    { id: 'l22-r8', kind: 'single', concept: 'retrieval-design', difficulty: 3, prompt: 'Which single change most improves your ability to find retrieval regressions?', options: [o('a', 'A labelled question set you re-run whenever the corpus, chunking or index changes', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Reading a few answers by eye now and then', 'Occasional spot checks miss silent regressions.'), o('c', 'Increasing the number of chunks retrieved', 'It changes behaviour but does not measure it.')], correct: 'a', explanation: 'Regression tests for retrieval.' },
  ],
  sources: [
    { ...ARTICLES.contextualRetrieval, supports: 'Why chunks lose context, lexical (BM25) versus embedding search, rank fusion, reranking, and the reported effect on retrieval failures.' },
    { ...DOCS.developTests, supports: 'Designing evaluations that mirror the real task distribution and include edge cases.' },
    { ...DOCS.mitigateInjection, supports: 'Retrieved and tool-returned content as untrusted data.' },
    { ...ARTICLES.contextEngineering, supports: 'Context as a finite resource and keeping only high-signal information.' },
  ],
};
