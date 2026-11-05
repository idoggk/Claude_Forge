import type { ConditionKind, ExperimentType } from '@/domain/experiments/model';

/**
 * AI Lab starting points. A template pre-fills the structure of a fair comparison (baseline, one stated difference,
 * measures chosen in advance). It contains NO results: the Lab never runs anything and every value is yours.
 */
export interface LabTemplate {
  id: string;
  title: string;
  experimentType: ExperimentType;
  subject: string;
  problem: string;
  hypothesisHint: string;
  conditions: { label: string; kind: ConditionKind; difference: string }[];
  plannedMeasures: string[];
  plannedRuns: number;
  successCriteria: string[];
  limitationsHint: string;
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'lab-prompt-vs-prompt',
    title: 'Prompt A versus prompt B',
    experimentType: 'prompt',
    subject: 'Whether a rewritten prompt gives better results than the current one on the same task.',
    problem: 'You changed a prompt and want to know whether the new version is actually better, not just different.',
    hypothesisHint: 'e.g. "Adding explicit acceptance criteria raises the share of checklist items met."',
    conditions: [
      { label: 'Current prompt', kind: 'baseline', difference: '' },
      { label: 'Revised prompt', kind: 'prompt', difference: 'Only the wording of the prompt changes; same files, model and settings.' },
    ],
    plannedMeasures: ['seededIssuesFound', 'reworkRounds', 'developerEffortMin'],
    plannedRuns: 5,
    successCriteria: ['Checklist items met out of the fixed list', 'Rework rounds needed'],
    limitationsHint: 'One task type, one model, self-scored checklist.',
  },
  {
    id: 'lab-with-without-claude-md',
    title: 'With and without a CLAUDE.md',
    experimentType: 'prompt',
    subject: 'Whether project instructions in CLAUDE.md change how many corrections a task needs.',
    problem: 'You wrote persistent instructions and want to know whether they help on real tasks.',
    hypothesisHint: 'e.g. "Listing naming rules and the test command reduces rework rounds."',
    conditions: [
      { label: 'No CLAUDE.md', kind: 'baseline', difference: '' },
      { label: 'With CLAUDE.md', kind: 'prompt', difference: 'The only difference is the presence of the CLAUDE.md file.' },
    ],
    plannedMeasures: ['reworkRounds', 'interventions', 'successRate'],
    plannedRuns: 5,
    successCriteria: ['Rework rounds', 'Whether the success criterion was met'],
    limitationsHint: 'The instructions may help on this repository and not on another.',
  },
  {
    id: 'lab-tool-vs-tool',
    title: 'Tool or integration A versus B',
    experimentType: 'tool-config',
    subject: 'Whether a new tool or integration beats the way you do the task now.',
    problem: 'A tool is recommended and you want your own evidence before adopting it.',
    hypothesisHint: 'e.g. "Tool B needs fewer rework rounds than my current setup on the same small change."',
    conditions: [
      { label: 'Current setup', kind: 'baseline', difference: '' },
      { label: 'New tool', kind: 'tool-config', difference: 'Only the tool changes; same task, repository copy and model where possible.' },
    ],
    plannedMeasures: ['reworkRounds', 'developerEffortMin', 'successRate'],
    plannedRuns: 3,
    successCriteria: ['Success criterion met', 'Your own effort in minutes (self-timed)'],
    limitationsHint: 'Small sample; vendor and model differences may not be controllable.',
  },
  {
    id: 'lab-model-vs-model',
    title: 'Model A versus model B (results you supply)',
    experimentType: 'model',
    subject: 'Whether a cheaper or faster model meets your success criterion on your cases.',
    problem: 'You want to pick a model for a task using your own cases, not a comparison table.',
    hypothesisHint: 'e.g. "The faster model meets the success criterion on at least as many cases."',
    conditions: [
      { label: 'Current model', kind: 'baseline', difference: '' },
      { label: 'Other model', kind: 'model', difference: 'Only the model changes; same cases and prompt.' },
    ],
    plannedMeasures: ['successRate', 'runtimeSec', 'tokens'],
    plannedRuns: 5,
    successCriteria: ['Success criterion met', 'Runtime in seconds if you timed it'],
    limitationsHint: 'Record tokens only from a real usage report; leave blank otherwise.',
  },
  {
    id: 'lab-skill-vs-baseline',
    title: 'With a Skill versus without',
    experimentType: 'skill',
    subject: 'Whether a Skill improves results compared with Claude alone on the same task.',
    problem: 'You installed or wrote a Skill and want evidence that it helps.',
    hypothesisHint: 'e.g. "The Skill raises tests passed on the merge-chain fixture."',
    conditions: [
      { label: 'Claude alone', kind: 'no-skill', difference: '' },
      { label: 'With the Skill', kind: 'skill', difference: 'The only difference is that the Skill is installed.' },
    ],
    plannedMeasures: ['testsPassedRatio', 'successRate', 'reworkRounds'],
    plannedRuns: 3,
    successCriteria: ['Tests passed ratio', 'Success criterion met'],
    limitationsHint: 'One fixture; self-reported test counts unless imported from a report.',
  },
  {
    id: 'lab-workflow-vs-single-prompt',
    title: 'A workflow versus one big prompt',
    experimentType: 'workflow',
    subject: 'Whether splitting a task into checked steps beats asking for the whole thing at once.',
    problem: 'You designed a workflow with gates and want to know whether it earns its extra effort.',
    hypothesisHint: 'e.g. "The gated workflow misses fewer items than a single prompt, at the cost of more of my time."',
    conditions: [
      { label: 'Single prompt', kind: 'baseline', difference: '' },
      { label: 'Gated workflow', kind: 'workflow', difference: 'Same task and inputs; the task is split into steps with a check after each.' },
    ],
    plannedMeasures: ['seededIssuesFound', 'developerEffortMin', 'interventions'],
    plannedRuns: 3,
    successCriteria: ['Checklist items met', 'Your effort in minutes (self-timed)'],
    limitationsHint: 'You are the workflow\'s operator; effort measures include your own time.',
  },
];

export const getLabTemplate = (id: string): LabTemplate | undefined => LAB_TEMPLATES.find((t) => t.id === id);
