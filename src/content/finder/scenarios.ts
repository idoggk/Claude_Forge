/**
 * AI Opportunity Finder scenarios. Authored by Forge (invented situations; no real company or data). Each asks one
 * question: which approach fits - including conventional software, a person, or doing nothing. Answers are
 * judgments with reasons, not trivia; a second defensible answer is recognised where one genuinely exists.
 */
export const APPROACHES = [
  { id: 'prompt', label: 'One well-specified prompt' },
  { id: 'workflow', label: 'A fixed workflow with checks' },
  { id: 'skill', label: 'A Skill (reusable procedure)' },
  { id: 'agent', label: 'An autonomous agent' },
  { id: 'integration', label: 'A tool or MCP integration' },
  { id: 'guardrail', label: 'A hook or permission rule' },
  { id: 'software', label: 'Conventional software or a script' },
  { id: 'human', label: 'A person decides or does it' },
  { id: 'none', label: 'Do nothing yet' },
] as const;
export type ApproachId = (typeof APPROACHES)[number]['id'];

export interface Scenario {
  id: string;
  situation: string;
  /** Things that make the choice matter. */
  constraints: string[];
  correct: ApproachId;
  whyCorrect: string;
  /** A second answer that is defensible, with the caveat that makes it second-best. */
  defensible?: { id: ApproachId; note: string };
  /** Why specific tempting answers are wrong here. */
  traps: Partial<Record<ApproachId, string>>;
  /** A lesson that teaches the judgment (for recommendations). */
  lessonId: string;
  theme: string;
}

export const OPPORTUNITY_SCENARIOS: Scenario[] = [
  {
    id: 'of-rename', theme: 'A fixed rule over many files', lessonId: 'L11-choose-ai-approach',
    situation: 'Your art team has 400 sprite files that must be renamed from "hero_idle_01.png" style to "hero/idle/01.png" using a fixed, documented pattern.',
    constraints: ['The rule never changes', 'A wrong rename breaks the build', 'You can check the result with a diff'],
    correct: 'software',
    whyCorrect: 'The rule is fixed and the result is checkable, so a short script is cheaper, faster and exactly repeatable. Using a model adds cost and a chance of a creative mistake.',
    traps: { agent: 'An agent decides its own steps, which is the opposite of what a fixed mapping needs.', prompt: 'A model may be inconsistent across 400 files, and you would still have to verify every one.' },
  },
  {
    id: 'of-interviews', theme: 'Judgment over messy language', lessonId: 'L11-choose-ai-approach',
    situation: 'You have 30 player-interview transcripts and want a first pass at recurring themes to guide what you read closely.',
    constraints: ['One-off task', 'Themes are a starting point, not a decision', 'You will read the sources for anything important'],
    correct: 'prompt',
    whyCorrect: 'Finding themes in messy language is what models do well, it is a one-off, and you remain the verifier. A single clear prompt with the transcripts is enough.',
    defensible: { id: 'workflow', note: 'A workflow would add checks you do not need for a one-off, low-stakes first pass.' },
    traps: { agent: 'Nothing here needs model-directed steps; autonomy only adds cost.', skill: 'A Skill pays off for a procedure you will repeat, not a one-off.' },
  },
  {
    id: 'of-friday', theme: 'A repeatable task with known steps', lessonId: 'L15-reliable-ai-workflow',
    situation: 'Every Friday you turn a ticket export into a one-page summary for the team. The steps are always the same.',
    constraints: ['Repeated weekly', 'Omitting tickets would mislead the team', 'The summary goes to a shared channel'],
    correct: 'workflow',
    whyCorrect: 'The steps are known, so make them a workflow: validate the input, draft, check every ticket is cited with a script, and have a person approve before it is sent.',
    traps: { agent: 'The path is known in advance, so autonomy buys nothing and removes your gates.', prompt: 'A single prompt has no gate that catches silently omitted tickets.' },
  },
  {
    id: 'of-never-main', theme: 'A rule that must always hold', lessonId: 'L01-skill-or-tool',
    situation: 'Your team agrees Claude must never push directly to the main branch, whatever it is asked.',
    constraints: ['It is a guarantee, not a preference', 'Long sessions drift', 'A mistake affects everyone'],
    correct: 'guardrail',
    whyCorrect: 'A guarantee needs enforcement in code. A hook or permission rule blocks the command regardless of what the model decides; an instruction can be ignored in a long session.',
    traps: { skill: 'A Skill is guidance loaded when relevant; it does not enforce anything.', prompt: 'Asking nicely is a preference, not a guarantee.' },
  },
  {
    id: 'of-crash', theme: 'Open-ended investigation', lessonId: 'L13-why-agents-fail',
    situation: 'An intermittent crash appears somewhere across an unfamiliar codebase. You do not know which modules are involved or what to look at first.',
    constraints: ['The steps cannot be known in advance', 'You can run the test suite and read the results', 'Changes land on a branch for your review'],
    correct: 'agent',
    whyCorrect: 'When the path genuinely cannot be known in advance and results are checkable, model-directed steps can earn their cost - with a branch, a test run as the gate and your review before merge.',
    defensible: { id: 'prompt', note: 'A prompt with logs may find it, but exploration across unknown modules is what an agent loop is for.' },
    traps: { software: 'There is no fixed rule to script: you do not yet know what the rule is.' },
  },
  {
    id: 'of-tracker', theme: 'Reusable access to a system', lessonId: 'L14-mcp-or-not',
    situation: 'Claude and two other AI clients should all query your issue tracker and deploy status through one consistent interface, read-only.',
    constraints: ['Several clients', 'Read-only access is enough', 'Credentials must stay out of prompts and config files'],
    correct: 'integration',
    whyCorrect: 'A shared interface to a system used by several clients is the case an MCP server exists for. Keep it read-only, pin its version and supply the token from the environment.',
    traps: { software: 'A one-off script would serve one client; this is about reuse across clients.', prompt: 'A prompt cannot give a model access to a live system.' },
  },
  {
    id: 'of-ban', theme: 'A consequential decision', lessonId: 'L11-choose-ai-approach',
    situation: 'A moderation tool flags a player as a suspected cheater. Someone proposes letting an AI decide whether to ban the account.',
    constraints: ['A ban is hard to undo', 'The player may appeal', 'Mistakes harm real people and need accountability'],
    correct: 'human',
    whyCorrect: 'The AI can help triage the evidence, but a consequential, hard-to-reverse decision about a person needs a person who is accountable for it.',
    defensible: { id: 'workflow', note: 'A workflow that gathers evidence and routes it to a person for the decision is a good supporting design - but the decision itself stays human.' },
    traps: { agent: 'Autonomy plus an irreversible action is exactly the combination to avoid.' },
  },
  {
    id: 'of-xp', theme: 'A formula with a right answer', lessonId: 'L11-choose-ai-approach',
    situation: 'You need an XP-per-level table for levels 1-100 from a formula the designers already agreed.',
    constraints: ['The formula is exact', 'Numbers will be copied into game data', 'You can check any row by hand'],
    correct: 'software',
    whyCorrect: 'A deterministic formula over a range is a few lines of code with exactly reproducible output. A model might approximate or slip on a row.',
    defensible: { id: 'prompt', note: 'A model can write that script for you - the right use of AI here is to produce the code, not the numbers.' },
    traps: { agent: 'No judgment is needed, so there is nothing for an agent to decide.' },
  },
  {
    id: 'of-fun', theme: 'No way to tell if it worked', lessonId: 'L11-choose-ai-approach',
    situation: 'A stakeholder asks for "an AI to make the game more fun". There is no definition of fun, no metric and no playtest plan.',
    constraints: ['No success criterion', 'No way to check an answer', 'No data to start from'],
    correct: 'none',
    whyCorrect: 'Nothing can be built or evaluated without a definable outcome. Do nothing with AI yet: first write what "better" would look like and how you would observe it.',
    defensible: { id: 'human', note: 'A person (a designer) defining the question is the right next step - it is the work that must happen before any AI approach.' },
    traps: { agent: 'An agent with no goal to check against will produce confident output you cannot evaluate.', prompt: 'A prompt gives you text, not a way to know whether the game got more fun.' },
  },
  {
    id: 'of-review', theme: 'A procedure repeated the same way', lessonId: 'L02-inside-skill-md',
    situation: 'Your team reviews merge requests with the same seven-point checklist every time and wants Claude to follow it consistently when asked.',
    constraints: ['Repeated often', 'Claude can do each step', 'It is guidance, not a hard guarantee'],
    correct: 'skill',
    whyCorrect: 'A repeatable procedure Claude can follow, loaded when the request matches, is what a Skill is for. Test its trigger and compare with and without it before you trust it.',
    traps: { guardrail: 'A hook enforces a rule; it does not teach Claude a seven-point review procedure.', agent: 'The procedure is known, so a fixed procedure beats open-ended autonomy.' },
  },
  {
    id: 'of-regex', theme: 'A small one-off', lessonId: 'L11-choose-ai-approach',
    situation: 'You want a regular expression explained so you understand what an old line in the build script does.',
    constraints: ['One-off', 'Low stakes', 'You can test the explanation on a sample string'],
    correct: 'prompt',
    whyCorrect: 'A one-off, low-stakes explanation you can check yourself needs one prompt. Anything heavier costs more than the question is worth.',
    traps: { workflow: 'A workflow with gates is overkill for a throwaway question.', skill: 'A Skill is for repeated procedures, not a single question.' },
  },
  {
    id: 'of-db', theme: 'Access no task needs', lessonId: 'L14-mcp-or-not',
    situation: 'A colleague suggests connecting Claude to the production database "just in case it is useful someday".',
    constraints: ['No task needs it today', 'The credentials are admin-level', 'Production data includes player details'],
    correct: 'none',
    whyCorrect: 'Access that no task needs is pure risk. If a task later needs data, add a read-only view of a non-production copy for that task.',
    traps: { integration: 'An integration is a standing trust decision; there is no requirement it satisfies.', guardrail: 'Permission rules limit damage, but the access should not exist at all.' },
  },
];
