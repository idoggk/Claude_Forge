import type { Engine } from '@/domain/challenges/lab';
import { extractionEngine } from '@/domain/challenges/extractionEngine';
import { researchEngine } from '@/domain/challenges/research';
import { agentEngine } from '@/domain/challenges/agent';
import { contextEngine } from '@/domain/challenges/context';

export interface ChallengeDef {
  id: 'extraction' | 'research' | 'agent' | 'context';
  version: number;
  title: string;
  tagline: string;
  concept: string;
  problem: string;
  objective: string;
  fixture: string;
  guided: { title: string; steps: string[] };
  task: string;
  hints: string[];
  reference: { selected: string[]; explanation: string };
  rubric: { criterion: string; evidence: string }[];
  commonMistakes: string[];
  transfer: { lessonId: string; lessonLabel: string; labTo: string; labLabel: string };
  honesty: string;
  engine: Engine;
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'extraction', version: 1, title: 'Faithful structured extraction', tagline: 'Valid JSON is not faithful JSON.', concept: 'structured-outputs',
    problem: 'Three extractors read the same eight invoices and return structured records. Their errors are different in kind: one invents values, one copies surface text without normalising, one is faithful. You must choose the validators that stop wrong records without rejecting right ones.',
    objective: 'Select at most six validators so that at least 90% of every extractor\'s seeded errors are caught and no correct record is rejected.',
    fixture: 'Eight invented invoices, rendered from seeds. The expected record for each is computed from the seed; the three extractors are small deterministic programs; the errors are found by diffing their output against the computed record. Nothing here is a model.',
    guided: { title: 'Worked example: the invented purchase order', steps: ['Open Extractor 1\'s record for the invoice with no purchase order: it holds "PO-0000".', 'A type check passes it: it is a string.', 'A "quote must appear in the source" check fails it: that text is not in the document.', 'A "no placeholder values" check also fails it. Either one catches this error with no false alarm.'] },
    task: 'Now work out which checks catch the date, total and quantity errors that the first two checks cannot see, then choose your set.',
    hints: ['Start with a check that every value can be found in the document.', 'Arithmetic can be re-derived from line items: a stated total is only a claim.', 'A date written 03/04/2026 is ambiguous. What should a faithful extractor do?', 'One tempting check ("every field must be filled") rewards guessing.'],
    reference: { selected: ['schema-types', 'quote-in-source', 'sum-check', 'ambiguous-date-guard', 'rederive-quantities', 'date-iso'], explanation: 'Type and shape, presence in the source, arithmetic, an ambiguity guard, quantity re-derivation and date normalisation together cover every seeded error class with no false alarm. It is one valid answer, not the only one.' },
    rubric: [{ criterion: 'Coverage', evidence: 'At least 90% of each extractor\'s errors caught (the lowest extractor counts).' }, { criterion: 'No false alarms', evidence: 'No correct value flagged.' }, { criterion: 'Economy', evidence: 'Six checks or fewer.' }, { criterion: 'Judgement', evidence: 'The three questions below, answers computed from the same data.' }],
    commonMistakes: ['Trusting a schema check to mean the content is right.', 'Requiring every field, which forces invention.', 'Switching on everything and calling it thorough.'],
    transfer: { lessonId: 'L19-structured-outputs-tool-calling', lessonLabel: 'Lesson 19: Structured outputs and tool calling', labTo: '/pilot', labLabel: 'Try it on your own prompt' },
    honesty: 'The extractors and documents are synthetic. A real model\'s errors will differ; use the idea, then measure your real extraction.',
    engine: extractionEngine,
  },
  {
    id: 'research', version: 1, title: 'Research reliability', tagline: 'Check the claim against the source, not the tone.', concept: 'evaluation',
    problem: 'A closed corpus of eight invented sources about a fictional build cache and three draft summaries written from it. Some claims are sound and some contain a flaw: an invented quote, an altered number, a superseded source, vendor-only evidence, or wording stronger than the source.',
    objective: 'Switch on at most five checks so that every flaw is caught and no sound claim is rejected.',
    fixture: 'Eight sources with dates and reliability tiers; 21 draft claims generated from seven base claims, with each injected flaw recorded by the generator. The checks never see that record.',
    guided: { title: 'Worked example: the altered number', steps: ['Draft A claims warm builds fell 81%. Its quote ("Warm builds fell 61%") is genuine, so a quote check passes.', 'The number 81 does not appear in the cited source; 61 does.', 'A number check flags it. This is why a claim and its quote are checked separately.'] },
    task: 'Find the checks that catch the superseded source, the vendor-only claim and the over-general wording without also rejecting claims that are simply old or from a vendor page about its own price.',
    hints: ['A source is out of date only if something newer exists on the same topic.', 'A vendor page is fine for a vendor\'s own price, not for a performance claim.', '"Every", "all" and "always" are claims too.', 'A rule that needs two sources for every claim will reject most of the report.'],
    reference: { selected: ['quote-in-source', 'numbers-match', 'newer-source-exists', 'vendor-only-performance', 'scope-words'], explanation: 'Each check targets one flaw kind and reads only the claim and the corpus. The broader rules (age limit, no vendors, two sources) look careful but reject sound evidence.' },
    rubric: [{ criterion: 'Flaws caught', evidence: 'All injected flaws flagged.' }, { criterion: 'Sound claims kept', evidence: 'No false alarms.' }, { criterion: 'Economy', evidence: 'Five checks or fewer.' }, { criterion: 'Reasoning', evidence: 'The three questions below, with answers computed from the generator.' }],
    commonMistakes: ['Treating "old" as "wrong".', 'Treating a vendor as never usable.', 'Trusting a quotation to mean the surrounding claim is right.'],
    transfer: { lessonId: 'L22-retrieval-augmented-generation', lessonLabel: 'Lesson 22: Retrieval-augmented generation', labTo: '/transfer', labLabel: 'Apply it to a real task' },
    honesty: 'The corpus is invented and tiny. Real research needs real sources; this practises the checks, not the topic.',
    engine: researchEngine,
  },
  {
    id: 'agent', version: 1, title: 'Agent failure investigator', tagline: 'Read the tool results, not the final message.', concept: 'agent-reliability',
    problem: 'Eight recorded agent runs of the same task. Some are fine. Others loop, ignore a failed call, claim success without evidence, write outside the allowed folder, or wander. You choose guardrails to contain the faults.',
    objective: 'Switch on at most five guardrails so every faulty run is stopped and no good run is blocked.',
    fixture: 'A deterministic simulator builds each trace from a clean run and injects at most one fault, recording which. Guardrails read the trace only. No model, no network, no real files.',
    guided: { title: 'Worked example: the run that said the tests passed', steps: ['Trace T4 ends "41 passed", but there is no run_tests call in the trace.', 'The final message is the model\'s own account. The tool result is the evidence.', 'A guardrail "a success claim needs a passing test result" flags it and does not touch T1, which ran the tests.'] },
    task: 'Find the guardrails for the other faults, and notice which tempting ones block good runs.',
    hints: ['Repetition of the exact same call is cheap to detect.', 'A failed tool call followed by a success claim is the pattern to look for.', '"Never allow writes" stops the task, not the fault.', 'A step limit must sit above what a good run needs.'],
    reference: { selected: ['repeat-guard', 'error-handling', 'claim-needs-evidence', 'path-allowlist', 'step-budget'], explanation: 'One guardrail per fault kind, each reading evidence in the trace. The three broad guardrails block good work.' },
    rubric: [{ criterion: 'Containment', evidence: 'Every faulty run flagged by a guardrail for its own fault.' }, { criterion: 'Good runs kept', evidence: 'No good run blocked.' }, { criterion: 'Economy', evidence: 'Five guardrails or fewer.' }, { criterion: 'Reasoning', evidence: 'The three questions below.' }],
    commonMistakes: ['Believing the final message.', 'Blocking the capability instead of the failure.', 'Setting a budget so low it fails good runs.'],
    transfer: { lessonId: 'L13-why-agents-fail', lessonLabel: 'Lesson 13: Why agents fail', labTo: '/loop', labLabel: 'Take it to the Skill Improvement Loop' },
    honesty: 'Simulated traces. A real agent\'s failures are messier; this practises reading evidence in a trace.',
    engine: agentEngine,
  },
  {
    id: 'context', version: 1, title: 'Prompt and context optimisation', tagline: 'Less, current, consistent, and allowed to say "I do not know".', concept: 'context-engineering',
    problem: 'Four customer questions and eight possible context chunks, two of which conflict, one of which is an untrusted pasted note that tries to give orders, and several that are irrelevant. There is a token budget.',
    objective: 'Choose chunks, order and instructions so the stand-in reader answers all four questions correctly within budget.',
    fixture: 'Authored chunks and questions with known answers; a transparent rule-based reader (first usable chunk on a topic wins). It is not a language model and does not predict one.',
    guided: { title: 'Worked example: the superseded policy', steps: ['Include both annual-plan policies with the old one first: the reader answers "14 days".', 'Reordering newest-first fixes it, but a real model may not follow order that way.', 'The robust fix is to leave the superseded chunk out.'] },
    task: 'Cover all four questions, including the one with no answer in the context, without exceeding the budget or including text that could give orders.',
    hints: ['Which chunks answer a question, and which only cost tokens?', 'What should happen when no chunk answers the question?', 'Which chunk is not trusted, and what is the safest way to deal with it?'],
    reference: { selected: ['c-annual-new', 'c-monthly', 'c-process', 'say-unknown', 'order:newest-first'], explanation: 'Current, consistent, relevant chunks only; permission to say unknown; the untrusted note left out. A good prompt is the smallest one that holds what the task needs.' },
    rubric: [{ criterion: 'Correct answers', evidence: 'All four correct, including "unknown" for the unanswerable one.' }, { criterion: 'Budget', evidence: 'Total estimated tokens within the limit.' }, { criterion: 'Safety', evidence: 'The untrusted note is excluded or neutralised.' }, { criterion: 'Honesty', evidence: 'The last question: a toy score does not prove a real prompt is good.' }],
    commonMistakes: ['Including everything "to be safe".', 'Leaving a superseded version in.', 'Not allowing the assistant to say it does not know.', 'Treating a keyword or toy score as proof of quality.'],
    transfer: { lessonId: 'L12-context-engineering', lessonLabel: 'Lesson 12: Context engineering', labTo: '/pilot', labLabel: 'Test your prompt on real runs' },
    honesty: 'The reader is a rule, not a model. Use this to spot missing, conflicting or untrusted context, then run a real experiment.',
    engine: contextEngine,
  },
];
export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
export const challengeActivityId = (id: string) => `challenge:${id}`;
