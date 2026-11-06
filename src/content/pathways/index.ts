/**
 * Capability pathways: a short, ordered route from one idea to something you have saved. Every step points at a page
 * that exists today. A pathway never claims you have a skill: a step shows as done only when the matching record is on
 * this device (a passed lesson, a saved challenge run, an experiment with a recorded run, a completed transfer task, a takeaway).
 */
export type Stage = 'learn' | 'practice' | 'experiment' | 'apply' | 'save';
export const STAGE_LABELS: Record<Stage, string> = { learn: 'Learn', practice: 'Practise', experiment: 'Experiment', apply: 'Apply', save: 'Save' };

export type StepTarget =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'challenge'; challengeId: 'extraction' | 'research' | 'agent' | 'context' }
  | { kind: 'page'; to: '/pilot' | '/battle-lab' | '/loop' | '/playbooks' | '/transfer' | '/library/new' | '/academy/opportunity-finder' | '/discovery' | '/workshop' };

export interface PathwayStep { stage: Stage; title: string; why: string; target: StepTarget }
export interface Pathway { id: string; title: string; outcome: string; whoFor: string; steps: PathwayStep[] }

const lesson = (stage: Stage, title: string, why: string, lessonId: string): PathwayStep => ({ stage, title, why, target: { kind: 'lesson', lessonId } });
const challenge = (title: string, why: string, challengeId: 'extraction' | 'research' | 'agent' | 'context'): PathwayStep => ({ stage: 'practice', title, why, target: { kind: 'challenge', challengeId } });
const page = (stage: Stage, title: string, why: string, to: Extract<StepTarget, { kind: 'page' }>['to']): PathwayStep => ({ stage, title, why, target: { kind: 'page', to } });
const SAVE = page('save', 'Write down what you learned', 'Capture one takeaway with the evidence behind it, labelled honestly.', '/library/new');

export const PATHWAYS: Pathway[] = [
  { id: 'choose-approach', title: 'Choose the right approach', outcome: 'Decide quickly whether a task wants AI, ordinary software, a person, or nothing.', whoFor: 'Anyone who reaches for AI first.', steps: [
    lesson('learn', 'Lesson: choose the right approach', 'The judgement everything else depends on.', 'L11-choose-ai-approach'),
    page('practice', 'Opportunity Finder', 'Invented scenarios where the best answer is often not AI.', '/academy/opportunity-finder'),
    page('experiment', 'Run your first real AI experiment', 'Test one choice on a task you really do.', '/pilot'),
    page('apply', 'Take it to real work', 'Plan, observe and reflect on a real task.', '/transfer'),
    SAVE,
  ] },
  { id: 'reliable-structured-output', title: 'Reliable structured output', outcome: 'Get data from a model that is not only valid, but faithful to the source.', whoFor: 'Anyone extracting records, JSON or fields from text.', steps: [
    lesson('learn', 'Lesson: structured outputs and tool calling', 'Why valid JSON is not the same as correct JSON.', 'L19-structured-outputs-tool-calling'),
    lesson('learn', 'Lesson: few-shot prompting', 'Examples as a way to fix the format, and their limits.', 'L20-few-shot-prompting'),
    challenge('Challenge: faithful extraction', 'Choose validators that catch invented and mis-normalised values.', 'extraction'),
    page('experiment', 'Test it on your own prompt', 'Compare your current prompt with a changed one on real runs.', '/pilot'),
    page('apply', 'Write it into a playbook', 'Record the workflow, its checks and what you verified.', '/playbooks'),
    SAVE,
  ] },
  { id: 'trustworthy-research', title: 'Trustworthy AI-assisted research', outcome: 'Check a summary against its sources, not its tone.', whoFor: 'Anyone who uses AI to read, summarise or compare sources.', steps: [
    lesson('learn', 'Lesson: retrieval-augmented generation', 'What a grounded answer needs, and how it still fails.', 'L22-retrieval-augmented-generation'),
    lesson('learn', 'Lesson: AI evaluation', 'Judging output against a standard you set in advance.', 'L16-ai-evaluation'),
    challenge('Challenge: research reliability', 'Catch invented quotes, altered numbers and stale sources.', 'research'),
    page('experiment', 'Compare two approaches in the Lab', 'Run both on the same cases and judge the results.', '/battle-lab'),
    page('apply', 'Apply it to a real task', 'Use the checks on a summary you actually need.', '/transfer'),
    SAVE,
  ] },
  { id: 'agents-that-do-not-fool-you', title: 'Agents that do not fool you', outcome: 'Read an agent run for failure, and add guardrails that stop it.', whoFor: 'Anyone letting an agent act on files, tools or data.', steps: [
    lesson('learn', 'Lesson: why agents fail', 'The failure patterns behind most bad runs.', 'L13-why-agents-fail'),
    lesson('learn', 'Lesson: long-running agent context', 'What breaks as a task gets long.', 'L24-long-running-agent-context'),
    challenge('Challenge: agent failure investigator', 'Choose guardrails that contain faults without blocking good runs.', 'agent'),
    page('experiment', 'Improve a Skill in the loop', 'Change one thing, re-test, keep what helps.', '/loop'),
    page('apply', 'Design the workflow as a playbook', 'Steps, checks and what is verified, in writing.', '/playbooks'),
    SAVE,
  ] },
  { id: 'context-and-prompts', title: 'Context and prompts that hold up', outcome: 'Give a model the smallest, current, consistent context, and let it say it does not know.', whoFor: 'Anyone whose prompts grow by accretion.', steps: [
    lesson('learn', 'Lesson: context engineering', 'What to include, what to leave out, and in which order.', 'L12-context-engineering'),
    lesson('learn', 'Lesson: few-shot prompting', 'When examples help and when they mislead.', 'L20-few-shot-prompting'),
    challenge('Challenge: prompt and context optimisation', 'Fit a budget, drop conflicts, handle untrusted text.', 'context'),
    page('experiment', 'Test your prompt on real runs', 'A toy score proves nothing about a real model; measure it.', '/pilot'),
    page('apply', 'Apply it to real work', 'Use the improved prompt on a task and write down what happened.', '/transfer'),
    SAVE,
  ] },
  { id: 'safe-integrations', title: 'Safe tool integrations', outcome: 'Connect tools and data without giving untrusted text the power to give orders.', whoFor: 'Anyone adding tools, MCP servers or automations.', steps: [
    lesson('learn', 'Lesson: prompt injection and trust boundaries', 'Where instructions can sneak in.', 'L21-prompt-injection-trust-boundaries'),
    lesson('learn', 'Lesson: MCP or not', 'When an integration earns its risk.', 'L14-mcp-or-not'),
    challenge('Challenge: agent failure investigator', 'Practise scope and evidence guardrails on recorded runs.', 'agent'),
    page('experiment', 'Evaluate a tool before you adopt it', 'Inspect it in Discovery and test it in the Lab.', '/discovery'),
    page('apply', 'Write the safe workflow as a playbook', 'Permissions, checks and a rollback.', '/playbooks'),
    SAVE,
  ] },
  { id: 'evaluate-before-trust', title: 'Evaluate before you trust', outcome: 'Decide whether a change really helped, from evidence you gathered fairly.', whoFor: 'Anyone about to switch prompts, models or tools.', steps: [
    lesson('learn', 'Lesson: evaluation harnesses', 'A fixed set of cases and a fixed way of judging them.', 'L23-evaluation-harnesses'),
    lesson('learn', 'Lesson: AI evaluation', 'What a score does and does not show.', 'L16-ai-evaluation'),
    challenge('Challenge: faithful extraction', 'See how a clever-looking check can reward the wrong thing.', 'extraction'),
    page('experiment', 'Run a blinded comparison', 'Judge outputs before you know which condition made them.', '/pilot'),
    page('apply', 'Take the result to real work', 'Plan and record the change on a real task.', '/transfer'),
    SAVE,
  ] },
];
export const PATHWAY_BY_ID = new Map(PATHWAYS.map((p) => [p.id, p]));
