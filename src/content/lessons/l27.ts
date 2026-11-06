import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES, THIRD_PARTY } from './helpers';

/** Every source, report and number below is invented. Nothing here is a real finding. */
const parse = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const REVIEW_REFERENCE = JSON.stringify(
  {
    report: 'Tidewater cache summary',
    claims: [
      { id: 'c1', claim: 'Median cold build fell from 412 s to 268 s across 14 repositories.', source: 'S1', source_type: 'primary', quote: 'Median cold build fell from 412 s to 268 s', verdict: 'supported' },
      { id: 'c2', claim: 'Tidewater halves build times.', source: 'S3', source_type: 'vendor', quote: 'halves your build times', verdict: 'not supported: a vendor claim that the measured report contradicts' },
      { id: 'c3', claim: 'Tidewater speeds up builds on every platform.', source: 'S1', source_type: 'primary', quote: 'All runs were on Linux', verdict: 'overgeneral: the source covers Linux only' },
    ],
    conflicts: ['S3 says builds halve; S1 measured a fall of about 35%'],
    not_checked: ['Whether S1 was independently reproduced'],
  },
  null,
  2,
);

export const L27: Lesson = {
  id: 'L27-research-reliability',
  version: 1,
  track: 'research',
  alsoIn: ['safety-eval'],
  order: 27,
  title: 'Research Reliability: Sources, Evidence and Inference',
  subtitle: 'Check a technical report against its sources: provenance, strength, conflict, recency and unsupported inference',
  prerequisites: ['L22-retrieval-augmented-generation', 'L16-ai-evaluation'],
  competencies: ['research-reliability'],
  effortMinutes: 45,
  gameRelevance: 0,
  interestTags: ['ai-judgment', 'foundations'],
  problem: 'A research summary reads smoothly, cites six sources and states that a build tool "halves build times". Every citation is real. Two of the claims are not in the sources they cite, one number was changed on the way, and the strongest claim comes from the vendor\'s own marketing page.',
  whyItMatters: 'AI makes fluent summaries cheap, and fluency is not evidence. Being able to check a claim against its source, and to say how strong the evidence is, is what separates research from repetition.',
  objectives: [
    'Trace a claim to its source and check that the source says it, including its numbers and its scope.',
    'Rank evidence by how it was produced: measured, independent, reproducible, primary, or only asserted.',
    'Handle conflicting sources by finding out why they differ, rather than averaging or choosing the first.',
    'Recognise the limits of recency, citation counts and confident wording.',
    'Separate what a source supports, what a summary infers, and what nobody checked.',
  ],
  segments: [
    {
      id: 's1',
      title: 'A citation is where a claim came from, not whether it is true',
      prediction: {
        prompt: 'A summary cites a passage that appears to support its claim. What do you still need to check?',
        options: [
          o('a', 'That the source actually says it, with the same numbers and scope, and that nothing newer or stronger contradicts it', 'A citation shows attribution; it does not show agreement, currency or correctness.'),
          o('b', 'Nothing more, because a claim that has a citation next to it has been checked by whoever wrote the summary', 'Summaries, including AI-written ones, can cite a source that does not say what is claimed.'),
          o('c', 'Only whether the citation link still opens, since a working link shows that the source exists and is real', 'A working link shows nothing about whether the passage supports the claim.'),
        ],
        correct: 'a',
      },
      body: `A citation answers one question: where did this come from? It does not answer: is it true, is it still true, and does the source really say it?

Three things go wrong even when every citation is real:

- **The source does not say it.** The quotation is invented or paraphrased into something stronger.
- **The source says something nearby.** A number was altered, or a limit ("on Linux only") was dropped.
- **The source is the wrong kind of evidence** for the claim: a marketing page cited for a performance figure.

Checking is mechanical before it is clever: find the sentence, compare the numbers, compare the scope.`,
    },
    {
      id: 's2',
      title: 'How strong is this evidence?',
      body: `Evidence strength depends on how the claim was produced, not on how confident it sounds:

| Stronger | Weaker |
|---|---|
| Measured, with the method and the data shown | Asserted, with no method |
| Independent of whoever benefits from the answer | From the party that sells or promotes the thing |
| Primary: the benchmark, the specification, the advisory itself | Secondary: someone's account of it |
| Reproducible: another person could repeat it | A single anecdote |
| Stated with its scope ("14 repositories, Linux only") | Stated as universal |

A strong source can still be out of date, and a weak source can be right. The point is to say **how** strong the support is, not to pick a winner. A vendor page is perfectly good evidence of the vendor's own price.`,
    },
    {
      id: 's3',
      title: 'When sources disagree',
      body: `Disagreement is information. Before choosing, find out **why** the sources differ:

- **Different versions or dates.** The older figure may describe a release that no longer exists.
- **Different scope.** One measured Linux, another measured Windows.
- **Different method.** A median across projects and a best case on one project are not comparable.
- **Different interests.** One party stands to gain from the answer.

Averaging two figures invents a value no source states. Taking whichever ranked first mistakes similarity for reliability. The honest report states both, says why they differ, and says which one applies to the question being asked.`,
    },
    {
      id: 's4',
      title: 'Supported, inferred, unchecked',
      body: `A trustworthy research note separates three things:

1. **Supported.** The cited source says it, with the same numbers and scope.
2. **Inferred.** A reasonable conclusion that the sources do not state. Mark it as inference and show the step.
3. **Not checked.** What you did not verify: whether a benchmark was reproduced, whether a newer source exists.

Recency helps only when something newer exists on the same question. Citation counts and confident phrasing measure attention, not truth. And a summary that never says what it did not check is claiming a completeness it cannot have.`,
    },
  ],
  activity: {
    title: 'Check a summary against its sources',
    intro: 'Guided practice on a small invented corpus about a fictional build cache. Nothing here is a real finding.',
    items: [
      {
        id: 'l27-p1',
        kind: 'classify',
        concept: 'research-reliability',
        prompt: 'The corpus: S1 is a maintainers\' benchmark (2025-03): "Median cold build fell from 412 s to 268 s across 14 repositories. All runs were on Linux." S3 is the vendor\'s marketing page: "Tidewater halves your build times." Judge each claim in the draft.',
        categories: [
          { id: 'supported', label: 'Supported by its source' },
          { id: 'altered', label: 'Altered or overstated' },
          { id: 'weak', label: 'Weak kind of evidence' },
        ],
        entries: [
          { id: 'e1', text: 'Cold builds fell from 412 s to 268 s (cites S1)', correct: 'supported', why: 'The source says exactly this, with the same figures.' },
          { id: 'e2', text: 'Cold builds fell from 412 s to 168 s (cites S1)', correct: 'altered', why: 'The source says 268 s; the figure was changed.' },
          { id: 'e3', text: 'Tidewater speeds up builds on every platform (cites S1)', correct: 'altered', why: 'The source covers Linux only, so the claim is broader than the evidence.' },
          { id: 'e4', text: 'Tidewater halves build times (cites S3)', correct: 'weak', why: 'It rests on the vendor\'s own marketing page, which contradicts the measured figure.' },
          { id: 'e5', text: 'The benchmark covered 14 repositories (cites S1)', correct: 'supported', why: 'The source states this directly.' },
        ],
        explanation: 'Check the sentence, the numbers and the scope, then ask what kind of evidence the source is.',
      },
      {
        id: 'l27-p2',
        kind: 'single',
        concept: 'research-reliability',
        prompt: 'Two official pages disagree about a default setting. What is the sound handling?',
        options: [
          o('a', 'Find out why they differ, often a version change, prefer the one that applies to your question and say so', 'Disagreement has a cause; naming it tells the reader which statement to rely on.'),
          o('b', 'Report the average of the two values so that the answer sits between what the two pages state', 'An average is a value that neither page states.'),
          o('c', 'Use whichever page appeared first in the search results, since the ranking reflects how reliable it is', 'Rank measures similarity to the query, not correctness.'),
          o('d', 'Leave the setting out of the report entirely, since two sources that disagree cannot be used for anything', 'A disagreement is itself a finding that should be reported with its cause.'),
        ],
        correct: 'a',
        hints: ['Look for what differs between the two: version, date or scope.'],
        explanation: 'Explain the disagreement; do not average it away or choose by position.',
      },
      {
        id: 'l27-p3',
        kind: 'case',
        format: 'scenario',
        concept: 'research-reliability',
        prompt: 'Practise weighing evidence for a decision.',
        situation: 'You must say whether a build cache is worth trying. S1 is the maintainers\' benchmark (Linux, 14 repositories, method shown). S3 is the vendor\'s marketing page ("halves build times", no method).',
        constraints: [
          'Your team builds on Linux.',
          'S1 shows its method and data; S3 shows neither.',
          'The vendor sells the product.',
        ],
        parts: [
          {
            id: 'weight',
            label: 'Which source should carry more weight for the claim about speed?',
            options: [
              o('a', 'S1, because it shows a method and data, covers your platform and was not written to sell the product', 'Measured, transparent and on your platform beats an unmeasured claim from the seller.'),
              o('b', 'S3, because the vendor knows the product best and is the party that has run it the most', 'Knowing the product is not the same as having measured it, and the vendor gains from the result.'),
              o('c', 'Both equally, because two sources agreeing that the product is faster is stronger than either one alone', 'They do not agree on size, and one of them shows no measurement.'),
            ],
            correct: 'a',
            },
          {
            id: 'report',
            label: 'How should the note describe S3?',
            options: [
              o('a', 'As a vendor claim without a method, which is not a measurement and conflicts in size with S1', 'It states what kind of source it is and how it relates to the measured one.'),
              o('b', 'As independent confirmation of S1, because both sources say that the product makes builds faster', 'It is not independent, and it overstates what S1 measured.'),
              o('c', 'It should be left out entirely, because vendor pages are never usable as evidence of any kind in a report', 'It is usable as a statement of what the vendor claims.'),
            ],
            correct: 'a',
          },
        ],
        hints: ['Ask who produced each source and whether it shows how.'],
        explanation: 'Weight follows method, independence and fit to your question.',
      },
    ],
  },
  assessment: {
    title: 'Independent check: research reliability',
    intro: 'A new invented report and corpus. Decide from what the sources say.',
    passMark: 0.7,
    items: [
      {
        id: 'l27-a1',
        kind: 'case',
        format: 'diagnosis',
        concept: 'research-reliability',
        critical: true,
        points: 2,
        prompt: 'Diagnose this research summary.',
        situation: 'An assistant summarised a fictional library, Marlin, from three sources. The sources and the summary are shown as inert text. All names and figures are invented.',
        artifact: [
          'SOURCE M1 (maintainers\' benchmark, 2025-02): "Median parse time fell from 80 ms to 52 ms on 6 projects. Tested on macOS only."',
          'SOURCE M2 (independent blog, 2025-04): "On our Linux CI the speedup was 12 to 15%."',
          'SOURCE M3 (Marlin website, 2025-06): "Marlin makes parsing twice as fast, everywhere."',
          'SUMMARY: "Marlin makes parsing twice as fast on every platform [M3], with parse time falling from 80 ms to 52 ms [M1]."',
        ],
        parts: [
          {
            id: 'failure',
            label: 'What is the main problem with the summary?',
            options: [
              o('a', 'Its headline claim rests on the vendor\'s own page and overstates both the size and the scope that the measurements show', 'M3 is a marketing claim; M1 shows about 35% on macOS and M2 shows 12 to 15% on Linux.'),
              o('b', 'It cites too few sources, so a fourth source would be enough to settle whether the claims are correct', 'The number of sources is not the problem; their kind and what they say is.'),
              o('c', 'It uses figures from different months, which means that none of the figures can be compared with the others', 'Dates matter here less than the scope and the kind of source.'),
            ],
            correct: 'a',
          },
          {
            id: 'conflict',
            label: 'How should the conflict between M1, M2 and M3 be handled?',
            options: [
              o('a', 'Report each figure with its scope and method, say that M3 is an unmeasured vendor claim, and say which platform the reader\'s question concerns', 'The differences have causes: platform, method and interest.'),
              o('b', 'Report the average of the three speedups, since an average reflects all the evidence that is available', 'An average invents a number that no source states and mixes measurements with an assertion.'),
              o('c', 'Report only the largest speedup, since it shows what the library can achieve at its best on the right inputs', 'Choosing the most flattering figure is selection, not synthesis.'),
            ],
            correct: 'a',
          },
          {
            id: 'unsupported',
            label: 'Which part of the summary is not supported by any source?',
            options: [
              o('a', 'That the speedup holds on every platform: the measurements cover macOS and Linux only, and only the vendor says everywhere', 'The scope was widened beyond all measured evidence.'),
              o('b', 'That parse time fell from 80 ms to 52 ms: no source states those figures for any project that was tested', 'M1 states exactly those figures, so this part is supported.'),
              o('c', 'That the library was tested at all, because none of the sources describes any measurement being carried out', 'M1 and M2 both describe measurements.'),
            ],
            correct: 'a',
          },
          {
            id: 'fix',
            label: 'What is the safest correction?',
            options: [
              o('a', 'State what was measured, on which platform and by whom; label the vendor claim as unmeasured; list what was not checked', 'It separates supported, asserted and unchecked, which is what a reader needs.'),
              o('b', 'Delete the vendor page from the summary and present the macOS figure as the result for all users of the library', 'Removing the weakest source does not fix the over-general scope.'),
              o('c', 'Keep the sentence but add a footnote saying that figures may vary and that readers should check for themselves', 'A vague footnote leaves the overstated claim in the headline.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'Three checks found everything: what kind of source, what scope and what it actually says. Report the disagreement and say what was not checked.',
      },
      {
        id: 'l27-a2',
        kind: 'case',
        format: 'scenario',
        concept: 'research-reliability',
        points: 2,
        prompt: 'Decide how to treat the evidence.',
        situation: 'You are preparing a one-page recommendation on whether to adopt Marlin for your team\'s CI, using the three sources above plus one new one.',
        constraints: [
          'Your team builds on Linux CI only.',
          'M2 is the only independent measurement, and it covers your platform.',
          'A new source, M4 (maintainers, 2025-05), reports "a 30% speedup on Linux" with no method or data.',
          'The recommendation will be read by people who will not open the sources.',
        ],
        parts: [
          {
            id: 'weight',
            label: 'Which figure should carry most weight for your decision?',
            options: [
              o('a', 'M2, the independent Linux measurement, with M1 and M4 noted as consistent in direction but not on your platform or without a method', 'It is independent, measured and on your platform.'),
              o('b', 'M4, because it is the most recent source and is also on Linux, which is your platform', 'Recency does not help when the source gives no method or data.'),
              o('c', 'M3, because the vendor knows the library best and has the strongest reason to measure it carefully', 'The vendor has a stake in the answer, and its page shows no measurement.'),
            ],
            correct: 'a',
          },
          {
            id: 'wording',
            label: 'How should the recommendation word the expected benefit?',
            options: [
              o('a', 'About 12 to 15% on Linux CI in one independent measurement; vendor figures are higher but unmeasured; not reproduced on your own builds', 'It gives the figure, its scope, its source type and what is unchecked.'),
              o('b', 'Expect builds to be twice as fast, as the project states, with a possible gain of a third on Linux builds', 'It repeats the unmeasured vendor claim as the expectation.'),
              o('c', 'Builds will definitely improve, because every source agrees that the library is faster than the alternatives', 'The sources agree on direction, not on size, and "definitely" claims more than any source does.'),
            ],
            correct: 'a',
          },
          {
            id: 'next',
            label: 'What is the best next step before adopting?',
            options: [
              o('a', 'Measure a few of your own builds with and without it, since your repositories may differ from every tested one', 'Your own measurement is the strongest evidence for your own decision.'),
              o('b', 'Ask the assistant to search for more articles until the number of sources agreeing with the vendor reaches ten', 'Counting agreeing sources measures repetition, not truth.'),
              o('c', 'Adopt it at once, since the independent source showed an improvement and the cost of trying it is low', 'A small independent gain is a reason to test, and a decision still needs your own numbers.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'With a different constraint set (your platform, one independent source, one unmeasured newer source) the weight moves to M2 and the report says what is unchecked.',
      },
      {
        id: 'l27-a2b',
        kind: 'case',
        format: 'scenario',
        concept: 'research-reliability',
        points: 2,
        prompt: 'The same decision, a different team.',
        situation: 'A different team builds on Windows CI and is reading the same four sources about Marlin.',
        constraints: [
          'Their builds run on Windows only.',
          'No source in the corpus measured Windows.',
          'M2 (independent) measured Linux; M1 (maintainers) measured macOS; M3 and M4 are unmeasured vendor and maintainer claims.',
          'They need a recommendation they can defend to colleagues who will not open the sources.',
        ],
        parts: [
          {
            id: 'weight',
            label: 'What can the evidence say about their platform?',
            options: [
              o('a', 'Nothing measured: every figure is for another platform, so a gain on Windows would be an inference', 'None of the measurements covers their platform.'),
              o('b', 'The independent Linux figure applies directly, because the library is the same on every operating system', 'That is an assumption; platform differences are exactly what the measurements do not cover.'),
              o('c', 'The vendor\'s "everywhere" claim applies, because it is the only statement that mentions every platform', 'It is the only claim that covers their platform, and it is the unmeasured one.'),
            ],
            correct: 'a',
          },
          {
            id: 'wording',
            label: 'How should the recommendation be worded?',
            options: [
              o('a', 'No measurement exists for Windows; Linux and macOS figures suggest a gain, which is an inference; test your own builds before relying on it', 'It separates supported, inferred and unchecked, and says what to do next.'),
              o('b', 'Expect a 12 to 15% gain, as measured independently, since that is the most reliable figure in the corpus', 'It applies a Linux figure to Windows without saying that this is an inference.'),
              o('c', 'Do not adopt it, because the evidence does not cover Windows and so the library must not work there', 'Absence of measurement is not evidence of absence of benefit.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'With a different platform the same sources support a different statement: here, honest uncertainty and a test.',
      },
      {
        id: 'l27-a3',
        kind: 'construct',
        format: 'json',
        concept: 'research-reliability',
        points: 2,
        prompt: 'Write a claim-by-claim review.',
        brief: `Review three claims from a draft against this mini-corpus, as JSON.

- **S1** (primary, 2025-03): "Median cold build fell from 412 s to 268 s across 14 repositories. All runs were on Linux."
- **S3** (vendor, 2025-06): "Tidewater halves your build times."

Claims to review: **c1** "Median cold build fell from 412 s to 268 s" (cites S1); **c2** "Tidewater halves build times" (cites S3); **c3** "Tidewater speeds up builds on every platform" (cites S1).

Produce an object with a \`claims\` list where each entry has an \`id\`, the \`source\`, a \`source_type\`, a \`quote\` copied from the source, and a \`verdict\`. Also include a \`conflicts\` list and a \`not_checked\` list.`,
        placeholder: '{\n  "claims": []\n}',
        checks: [
          { id: 'json', label: 'It is valid JSON with a claims list of three entries', why: 'Provide a "claims" array with one entry for each of c1, c2 and c3.', test: (d) => arr(parse(d)?.claims).length === 3 },
          { id: 'fields', label: 'Every claim has an id, source, source_type, quote and verdict', why: 'Each claim needs id, source, source_type, quote and verdict so that it can be checked.', test: (d) => arr(parse(d)?.claims).every((c) => ['id', 'source', 'source_type', 'quote', 'verdict'].every((k) => str(c[k]).length > 1)) },
          { id: 'quotes', label: 'Every quote really appears in its source', why: 'Copy the quote from the source text; a quote that is not in the source is the first thing a reviewer checks.', test: (d) => { const S: Record<string, string> = { S1: 'Median cold build fell from 412 s to 268 s across 14 repositories. All runs were on Linux.', S3: 'Tidewater halves your build times.' }; const cs = arr(parse(d)?.claims); return cs.length > 0 && cs.every((c) => !!S[str(c.source)] && S[str(c.source)]!.toLowerCase().includes(str(c.quote).toLowerCase())); } },
          { id: 'vendor', label: 'The vendor claim is marked as a vendor source and not simply supported', why: 'c2 cites the vendor page: give it the source type "vendor" and a verdict that does not call it supported.', test: (d) => { const c2 = arr(parse(d)?.claims).find((c) => str(c.id) === 'c2'); return !!c2 && /vendor/i.test(str(c2.source_type)) && !/^supported/i.test(str(c2.verdict).trim()); } },
          { id: 'scope', label: 'The "every platform" claim is flagged for scope', why: 'c3 says every platform but S1 covers Linux only: the verdict should say overgeneral or Linux only.', test: (d) => { const c3 = arr(parse(d)?.claims).find((c) => str(c.id) === 'c3'); return !!c3 && /overgeneral|over-general|linux|scope|too broad/i.test(str(c3.verdict)); } },
          { id: 'conflict', label: 'It records the conflict between the sources', why: 'S3 and S1 disagree about the size of the gain; list that conflict in "conflicts".', test: (d) => Array.isArray(parse(d)?.conflicts) && (parse(d)!.conflicts as unknown[]).length >= 1 },
          { id: 'unchecked', label: 'It lists at least one thing that was not checked', why: 'Say what you did not verify, for example whether S1 was independently reproduced, in "not_checked".', test: (d) => Array.isArray(parse(d)?.not_checked) && (parse(d)!.not_checked as unknown[]).length >= 1 },
        ],
        rubric: [
          'Would a reader who has not seen the sources understand why each verdict was given?',
          'Did you check the numbers and the scope, not only whether the source exists?',
          'Is anything in your review an inference you have not marked as one?',
          'What would you do next to make the weakest verdict stronger?',
        ],
        reference: REVIEW_REFERENCE,
        explanation: 'A review is useful when each claim is tied to a quoted sentence, a kind of source and a verdict, and when disagreement and gaps are written down.',
      },
      {
        id: 'l27-a4',
        kind: 'multi',
        concept: 'research-reliability',
        prompt: 'Select the checks that test whether a cited claim is actually supported.',
        options: [
          o('a', 'Find the sentence in the source and compare its numbers and its scope with the claim', 'This is the mechanical core of checking a claim.'),
          o('b', 'Ask the assistant that wrote the summary whether it is confident that each claim is correct', 'The same author vouching for itself is not an independent check.'),
          o('c', 'Check whether the source is a measurement, who produced it and whether they gain from the answer', 'The kind of evidence decides how much weight the claim deserves.'),
          o('d', 'Count how many other pages repeat the claim, and treat a larger count as stronger support for it', 'Repetition measures how widely a claim spreads, not whether anyone checked it.'),
          o('e', 'Look for a newer source on the same question that could replace or contradict the one that was cited', 'Recency matters when something newer actually exists.'),
        ],
        correct: ['a', 'c', 'e'],
        explanation: 'Check the sentence, the kind of source and whether something newer exists. Confidence and repetition are not evidence.',
      },
      {
        id: 'l27-a5',
        kind: 'single',
        concept: 'research-reliability',
        prompt: 'A report uses a source dated 14 months ago for a claim about current behaviour, and nothing newer is known. How should it be treated?',
        options: [
          o('a', 'As the best available evidence, stated with its date, and noted as possibly out of date because nothing newer was found', 'Age matters only when something newer exists; say the date and what was not found.'),
          o('b', 'As unusable, because any source older than a year should be rejected whatever else is known about the question', 'A fixed age limit discards sound evidence and treats age as if it meant error.'),
          o('c', 'As current, because a source that has not been contradicted is by definition still correct today', 'Absence of contradiction does not show currency; it is a gap to be reported.'),
          o('d', 'As equal to a source from last week, since the date of a source is metadata and not part of its content', 'Dates are evidence about whether behaviour may have changed.'),
        ],
        correct: 'a',
        explanation: 'Report the date, say what you did and did not find, and do not apply a blanket age rule.',
      },
      {
        id: 'l27-a6',
        kind: 'classify',
        concept: 'research-reliability',
        prompt: 'Place each statement in a research note.',
        categories: [
          { id: 'supported', label: 'Supported (say so)' },
          { id: 'inferred', label: 'Inferred (mark it)' },
          { id: 'unchecked', label: 'Not checked (list it)' },
        ],
        entries: [
          { id: 'e1', text: 'The maintainers\' benchmark reports a median fall from 412 s to 268 s', correct: 'supported', why: 'The source states this directly.' },
          { id: 'e2', text: 'Because the benchmark was Linux only, results on Windows are probably smaller', correct: 'inferred', why: 'A reasonable guess that no source states, so mark it as inference.' },
          { id: 'e3', text: 'Whether anyone outside the maintainers reproduced the benchmark', correct: 'unchecked', why: 'Nobody looked, so say so rather than imply it was confirmed.' },
          { id: 'e4', text: 'The vendor\'s page claims that build times are halved', correct: 'supported', why: 'It is supported as a statement the vendor made, not as a measured fact.' },
          { id: 'e5', text: 'Whether a newer benchmark exists than the one cited', correct: 'unchecked', why: 'Recency can only be judged if you looked for something newer.' },
        ],
        explanation: 'Separate what the sources say, what you conclude and what you did not verify.',
      },
    ],
  },
  failureModes: [
    'Trusting a citation because it is real, without checking that the source says the claim.',
    'Letting a number or a scope change between the source and the summary.',
    'Using a vendor or marketing page for a performance claim.',
    'Averaging or position-picking between sources that disagree.',
    'Treating age, citation count or confident wording as evidence of truth or falsehood.',
    'Presenting a summary as complete without saying what was not checked.',
  ],
  application: {
    title: 'Check one AI-written summary against its sources',
    body: 'Take a summary an assistant wrote for you with citations. For five claims, find the sentence in the source, compare numbers and scope, name the kind of source and write a verdict. List what you did not check, then correct the summary.',
    fieldPrompt: 'Log it under Growth → Field evidence when checking a real summary found a claim that its source did not support.',
  },
  reviewItems: [
    { id: 'l27-r1', kind: 'single', concept: 'research-reliability', difficulty: 1, prompt: 'What does a citation next to a claim show?', options: [o('a', 'Where the claim came from, not whether the source says it or whether it is true', 'Attribution is separate from agreement and from truth.'), o('b', 'That the claim has been checked against the source by whoever wrote the text that contains it', 'A summary can cite a source that does not say what it claims.'), o('c', 'That the claim is correct, because sources are only cited when their content has been confirmed first', 'Sources are cited for many reasons; nothing guarantees they were confirmed.'), o('d', 'That the claim is current, because a cited source is assumed to be the most recent one on the subject', 'A citation says nothing about whether something newer exists.')], correct: 'a', explanation: 'Check the source; the citation only points to it.' },
    { id: 'l27-r2', kind: 'single', concept: 'research-reliability', difficulty: 1, prompt: 'Which source is the strongest evidence for a performance figure?', options: [o('a', 'A measurement with its method and data shown, from a party that does not gain from the result', 'Measured, transparent and independent is the strongest combination.'), o('b', 'A confident statement from the product\'s own page, because the authors know their software better than anyone', 'The authors have a stake in the answer, and a statement is not a measurement.'), o('c', 'A widely shared post that repeats the figure and has been quoted by many other writers and newsletters', 'Repetition measures spread, not whether anyone checked the figure.'), o('d', 'The figure that appears first in a search, since search rankings put the most reliable pages at the top', 'Rank measures similarity to the query, not reliability.')], correct: 'a', explanation: 'Method, data and independence decide strength.' },
    { id: 'l27-r3', kind: 'single', concept: 'research-reliability', difficulty: 2, prompt: 'A summary says "on every platform" but the cited benchmark ran only on Linux. What is the problem?', options: [o('a', 'The claim is broader than the evidence: the scope was widened beyond what was measured', 'Dropping a limit is one of the commonest ways a summary overstates.'), o('b', 'The benchmark is invalid, because a result measured on one platform cannot be used as evidence for anything', 'It is valid for the platform it covers; the summary overreached.'), o('c', 'The summary should have used a longer quotation, since short quotations always lose the meaning of a source', 'The length of the quotation is not the issue; the scope is.'), o('d', 'Nothing is wrong, because a result on one platform is likely to hold on others without any further test', 'That is an inference and must be marked as one, not stated as supported.')], correct: 'a', explanation: 'Compare scope as well as numbers.' },
    { id: 'l27-r4', kind: 'single', concept: 'research-reliability', difficulty: 2, prompt: 'Two sources give different figures for the same thing. What should you do first?', options: [o('a', 'Find why they differ: version, date, scope, method or who produced them', 'Disagreement usually has a cause that decides which figure applies.'), o('b', 'Average them, so that the figure you report sits halfway between the two values that were published', 'An average is a number that neither source states.'), o('c', 'Choose the figure from the source with the higher search rank, since it is likely to be the more reliable', 'Rank is similarity to the query, not correctness.'), o('d', 'Drop both, since two sources that disagree show that nothing about the question can be known at all', 'The disagreement is itself a finding to report, with its cause.')], correct: 'a', explanation: 'Explain the difference before choosing.' },
    { id: 'l27-r5', kind: 'multi', concept: 'research-reliability', difficulty: 2, prompt: 'Select the things that belong under "not checked" in a research note.', options: [o('a', 'Whether the benchmark was independently reproduced by anyone outside its authors', 'If nobody looked, the note must say so.'), o('b', 'Whether a newer source exists on the same question than the one that was cited', 'Recency cannot be judged unless you searched for something newer.'), o('c', 'The exact sentence in the source that supports the first claim, which you read and compared', 'You did check this, so it belongs under supported.'), o('d', 'Whether the results hold on a platform that none of the sources tested', 'That is outside the evidence and should be listed as a gap.')], correct: ['a', 'b', 'd'], explanation: 'List what you did not verify; do not imply completeness.' },
    { id: 'l27-r6', kind: 'single', concept: 'research-reliability', difficulty: 2, prompt: 'When is a vendor page good evidence?', options: [o('a', 'For facts about the vendor itself, such as its own price or the platforms it says that it supports', 'The vendor is the authority on its own offer, but not on how well it performs.'), o('b', 'For any performance claim, since the vendor ran the product more often than anyone else has ever done', 'The vendor gains from favourable results, so performance claims need independent measurement.'), o('c', 'Never, since information from a seller cannot be relied on for any purpose whatsoever in a report', 'Vendor pages are reliable for some facts, such as prices and documented behaviour.'), o('d', 'Only when the page quotes a customer, since a customer\'s words are more reliable than the vendor\'s own', 'Selected quotations are chosen by the vendor, which does not make them independent.')], correct: 'a', explanation: 'Match the kind of claim to the kind of source.' },
    { id: 'l27-r7', kind: 'single', concept: 'research-reliability', difficulty: 3, prompt: 'Which statement should be marked as an inference in a research note?', options: [o('a', '"Because the benchmark ran only on Linux, results on Windows are probably smaller."', 'No source states it; it is a reasoned guess and must be labelled.'), o('b', '"The benchmark reports a median fall from 412 s to 268 s across 14 repositories."', 'The source states this directly, so it is supported.'), o('c', '"The maintainers published the benchmark in March 2025, according to the page\'s own date."', 'A dated fact taken directly from the source.'), o('d', '"The vendor\'s page says that build times are halved, and that wording appears in its main heading."', 'It is a statement the vendor made and can be reported as such.')], correct: 'a', explanation: 'Mark any step that the sources do not state.' },
    { id: 'l27-r8', kind: 'single', concept: 'research-reliability', difficulty: 3, prompt: 'A report is 14 months old and nothing newer is known. How should a note treat it?', options: [o('a', 'Use it with its date, and say that nothing newer was found and that it may be out of date', 'Age matters when something newer exists; state the date and the search you did.'), o('b', 'Reject it automatically, since an age limit of twelve months is a sound rule for every technical source', 'A fixed limit discards the best available evidence.'), o('c', 'Treat it as current, since no source has contradicted it and so it must still describe how things work', 'Absence of contradiction is not confirmation.'), o('d', 'Ignore its date, because the date of a document says nothing about whether its content is still accurate', 'A date is evidence about whether behaviour may have changed.')], correct: 'a', explanation: 'State the date and what you did and did not find.' },
  ],
  sources: [
    { ...ARTICLES.evals, supports: 'Judging output against a standard decided in advance, and why a score needs its method.' },
    { ...ARTICLES.contextualRetrieval, supports: 'Retrieved passages losing their context, and how a chunk without its source can mislead.' },
    { ...ARTICLES.multiAgent, supports: 'Research systems that gather evidence from several sources and the need to check what they return.' },
    { ...THIRD_PARTY.owaspLlm01, supports: 'Retrieved content as an untrusted input that can carry instructions.' },
    { ...DOCS.developTests, supports: 'Building empirical evaluations with clear success criteria.' },
  ],
};
