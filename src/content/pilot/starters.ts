import type { ConditionKind, ExperimentType, MetricId } from '@/domain/experiments/model';
import type { PilotStarterId } from '@/domain/pilot/pilot';

/**
 * Starting points for the guided first experiment. They contain instructions and prompts for thinking, never results and
 * never pre-filled answers: placeholders only, so an experiment cannot look complete because of text Forge wrote.
 */
export interface PilotStarter {
  id: PilotStarterId;
  title: string;
  blurb: string;
  experimentType: ExperimentType;
  baselineKind: ConditionKind;
  improvedKind: ConditionKind;
  baselineLabel: string;
  improvedLabel: string;
  measures: MetricId[];
  problemHint: string;
  criteriaHint: string;
  baselineHint: string;
  improvedHint: string;
  differenceHint: string;
  hypothesisHint: string;
  promptHint: string;
  techniqueLabel: string;
  techniqueHint: string;
  /** What must be identical in every run, so that a difference can be attributed to the one thing you changed. */
  keepConstant: string[];
  /** What to do for each run, per condition. */
  baselineRun: string[];
  improvedRun: string[];
  /** What to save from each run. */
  save: string[];
  /** Things this kind of experiment can never show. */
  cannotInfer: string[];
  relatedLessons: string[];
}

export const PILOT_STARTERS: PilotStarter[] = [
  {
    id: 'skill',
    title: 'Evaluate a Claude Code Skill',
    blurb: 'Does a Skill you use (or are considering) change the result on a task you really do? You run it with and without the Skill; Forge keeps the record straight.',
    experimentType: 'skill',
    baselineKind: 'no-skill',
    improvedKind: 'skill',
    baselineLabel: 'Without the Skill',
    improvedLabel: 'With the Skill',
    measures: ['successRate', 'reworkRounds', 'developerEffortMin'],
    problemHint: 'Describe one real task you repeat, in one or two sentences. For example: "Fix a failing unit test in my service without touching unrelated files."',
    criteriaHint: 'One check per line that you can answer yes or no after each run. For example: "The target test passes when I run it myself."',
    baselineHint: 'Claude Code with the Skill not available. Say how you make sure it is not available.',
    improvedHint: 'Claude Code with the Skill available. Name it and the version or commit you are using.',
    differenceHint: 'Exactly one difference. For example: "The Skill folder is present in .claude/skills; nothing else changes."',
    hypothesisHint: 'What you expect and what result would change your mind. For example: "With the Skill I need fewer corrections. If the ranges overlap I will not adopt it."',
    promptHint: 'The exact task prompt you will paste into every run. It must be identical for both conditions.',
    techniqueLabel: 'Skill name',
    techniqueHint: 'The Skill you are evaluating (Forge never installs or runs it).',
    keepConstant: [
      'The same task prompt, copied exactly',
      'The same starting state: a clean checkout or a fresh git worktree for every run',
      'The same model and settings, noted in the setup',
      'A fresh Claude Code session for every run (no carried-over context)',
      'You, scoring each run by the same checks you wrote before running',
    ],
    baselineRun: ['Make sure the Skill is not available in this session.', 'Start from the clean state, open a fresh session, paste the task prompt.', 'Let it finish or stop it; note which happened.'],
    improvedRun: ['Make the Skill available (you do this yourself).', 'Start from the clean state, open a fresh session, paste the same task prompt.', 'Let it finish or stop it; note which happened.'],
    save: ['The final answer (copy it)', 'The test or check output you ran yourself', 'The session transcript or an /export of it, if you want it as evidence', 'How many corrections you had to send'],
    cannotInfer: [
      'That the Skill is better in general: this is one task, one repository and one model.',
      'That the Skill was used: a Skill name in the text does not prove it was invoked.',
      'Anything about runs you did not record, including attempts you threw away.',
    ],
    relatedLessons: ['L16-ai-evaluation', 'L23-evaluation-harnesses'],
  },
  {
    id: 'workflow',
    title: 'Evaluate a reusable AI workflow',
    blurb: 'Does a multi-step workflow (with checks between steps) beat the way you do the task today? Optionally ties the result to a step of one of your playbooks.',
    experimentType: 'workflow',
    baselineKind: 'baseline',
    improvedKind: 'workflow',
    baselineLabel: 'Current way',
    improvedLabel: 'The workflow',
    measures: ['successRate', 'reworkRounds', 'interventions'],
    problemHint: 'Describe the task the workflow is for and who relies on the output. For example: "Turn merged pull requests into draft release notes."',
    criteriaHint: 'One check per line, answerable yes or no. For example: "Every merged PR number appears exactly once."',
    baselineHint: 'How you do it today: one big prompt, a manual process, or whatever you really do.',
    improvedHint: 'The workflow: its steps, and the check after each step.',
    differenceHint: 'The one thing that differs. For example: "The task is split into three steps with a script check after each."',
    hypothesisHint: 'What you expect, and what would change your mind. For example: "The gated workflow needs fewer corrections; if not, it is not worth the extra steps."',
    promptHint: 'The starting input or request you give in both conditions (the workflow may add steps after it).',
    techniqueLabel: 'Workflow name',
    techniqueHint: 'A short name for the workflow, for example "Gated release notes".',
    keepConstant: ['The same input data and starting request', 'The same model and settings', 'A fresh session per run', 'The same success checks, written before the first run', 'No extra help in one condition (for example, extra hints you would not give in the other)'],
    baselineRun: ['Do the task the way you do it today.', 'Run the checks you wrote.', 'Count corrections and manual interventions.'],
    improvedRun: ['Run the workflow exactly as written, including its checks.', 'Run the checks you wrote.', 'Count corrections and manual interventions (a step you had to do by hand counts).'],
    save: ['The final output', 'Each step\'s output if the workflow has several', 'The results of the checks', 'Corrections and interventions'],
    cannotInfer: [
      'That the workflow works on other tasks or inputs.',
      'That each step is needed: you changed several things at once, so you cannot say which one helped.',
      'That a workflow with more steps is better: cost and effort belong in the comparison.',
    ],
    relatedLessons: ['L15-reliable-ai-workflow', 'L16-ai-evaluation'],
  },
  {
    id: 'prompts',
    title: 'Compare two prompting techniques',
    blurb: 'Does adding a technique (examples, a stated format, acceptance criteria, trimmed context) beat your current prompt on the same inputs?',
    experimentType: 'prompt',
    baselineKind: 'baseline',
    improvedKind: 'prompt',
    baselineLabel: 'Current prompt',
    improvedLabel: 'Revised prompt',
    measures: ['successRate', 'reworkRounds'],
    problemHint: 'Describe the task the prompt does. For example: "Write a commit message in my team\'s style from a diff."',
    criteriaHint: 'One check per line you can answer yes or no. For example: "The message follows the house format and is accurate."',
    baselineHint: 'Your current prompt, pasted exactly.',
    improvedHint: 'Your revised prompt, pasted exactly.',
    differenceHint: 'The one technique you changed. For example: "Three worked examples added; nothing else changes."',
    hypothesisHint: 'What you expect, and what would change your mind. For example: "Examples raise the share of outputs in the house style; if they copy the examples literally I will drop them."',
    promptHint: 'The input you give both prompts (for example the diff). Use the same inputs, in the same order, for both.',
    techniqueLabel: 'Technique',
    techniqueHint: 'For example few-shot examples, a required output format, acceptance criteria, or removing unneeded context.',
    keepConstant: ['The same inputs for both prompts (ideally several different ones, used in both)', 'The same model and settings', 'A fresh session for every run', 'The same success checks, written before the first run'],
    baselineRun: ['Paste the current prompt and the input into a fresh session.', 'Score the output against your checks.', 'Count corrections.'],
    improvedRun: ['Paste the revised prompt and the same input into a fresh session.', 'Score the output against your checks.', 'Count corrections.'],
    save: ['The output', 'Your yes/no scoring and why', 'The number of corrections'],
    cannotInfer: [
      'That the technique helps on other inputs, models or tasks.',
      'That the revised prompt is "better" in a way your checks do not cover.',
      'Anything from one input: if you reuse one input, the prompt may simply be fitted to it.',
    ],
    relatedLessons: ['L20-few-shot-prompting', 'L19-structured-outputs-tool-calling', 'L12-context-engineering'],
  },
];

export const getPilotStarter = (id: string): PilotStarter | undefined => PILOT_STARTERS.find((s) => s.id === id);
