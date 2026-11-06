import { z } from 'zod';
import { BlindedReviewSchema } from '../blinded/schema';

/** Metrics the AI Lab knows about. `direction` says which way is better. */
export const METRICS = [
  { id: 'testsPassedRatio', label: 'Tests passed (ratio)', unit: 'ratio', direction: 'higher', kind: 'objective', help: 'Derived from passed/total test counts you record or import. Self-reported unless imported from a test report file.' },
  { id: 'successRate', label: 'Success criterion met', unit: 'ratio', direction: 'higher', kind: 'objective', help: 'Share of runs where you judged the success criterion met (yes/no per run).' },
  { id: 'seededIssuesFound', label: 'Checklist items met (ratio)', unit: 'ratio', direction: 'higher', kind: 'objective', help: 'For checklist fixtures: how many fixed checklist items the output satisfied (seeded defects found, or review-quality criteria met), ticked by you against the fixture checklist.' },
  { id: 'reworkRounds', label: 'Rework rounds', unit: 'rounds', direction: 'lower', kind: 'measured', help: 'Follow-up prompts you had to send because the previous answer was wrong or incomplete. Count them; leave blank if you did not.' },
  { id: 'interventions', label: 'Developer interventions', unit: 'count', direction: 'lower', kind: 'measured', help: 'Times you had to run a command, supply data or edit something that Claude should have handled itself. Leave blank if you did not track it.' },
  { id: 'developerEffortMin', label: 'Developer effort (min)', unit: 'min', direction: 'lower', kind: 'measured', help: 'Minutes of your own attention (prompting, correcting, reviewing). Self-timed.' },
  { id: 'runtimeSec', label: 'Runtime (s)', unit: 's', direction: 'lower', kind: 'measured', help: 'Wall-clock seconds from prompt to finished result, if you timed it.' },
  { id: 'tokens', label: 'Tokens used', unit: 'tokens', direction: 'lower', kind: 'measured', help: 'Only record this if you read it from a real usage report. Never estimate.' },
] as const;
export type MetricId = (typeof METRICS)[number]['id'];
export const METRIC_IDS = METRICS.map((m) => m.id) as MetricId[];

export const RUBRIC_CRITERIA = [
  {
    id: 'correctness',
    label: 'Correctness',
    levels: [
      'Does not address the problem or introduces new defects.',
      'Partially fixes the problem; a reproducible failure remains.',
      'Fixes the problem; minor edge cases unverified.',
      'Fixes the problem and edge cases, backed by passing checks.',
    ],
  },
  {
    id: 'completeness',
    label: 'Completeness',
    levels: [
      'Most requested parts are missing.',
      'Some requested parts are missing.',
      'All requested parts present; minor gaps.',
      'All requested parts present and nothing material omitted.',
    ],
  },
  {
    id: 'maintainability',
    label: 'Maintainability',
    levels: [
      'Hard to follow; large unrelated changes.',
      'Works but is brittle or noisy.',
      'Readable, focused change.',
      'Readable, minimal, consistent with surrounding code.',
    ],
  },
  {
    id: 'testEvidence',
    label: 'Test evidence',
    levels: [
      'No verification offered; claims unsupported.',
      'Verification described but not run or not shown.',
      'Relevant checks run; results shown.',
      'Relevant checks run, results shown, and a regression test added.',
    ],
  },
] as const;
export type CriterionId = (typeof RUBRIC_CRITERIA)[number]['id'];
export const CRITERION_IDS = RUBRIC_CRITERIA.map((c) => c.id) as CriterionId[];

/**
 * What a condition is. The first four are the original Skill-centred kinds and are kept exactly as stored.
 * The rest generalise the Lab: a baseline need not be "no Skill", and a condition can be a prompt, a workflow,
 * an agent setup, a tool configuration or a model.
 */
export const ConditionKindSchema = z.enum(['no-skill', 'skill', 'alternative', 'custom-revised', 'baseline', 'prompt', 'workflow', 'agent', 'tool-config', 'model', 'other']);
export type ConditionKind = z.infer<typeof ConditionKindSchema>;

export const CONDITION_KIND_LABELS: Record<ConditionKind, string> = {
  'no-skill': 'Claude without a Skill (baseline)',
  skill: 'Claude with a selected Skill',
  alternative: 'Alternative Skill or technique',
  'custom-revised': 'Custom revised Skill',
  baseline: 'Baseline (the current way of doing it)',
  prompt: 'A prompt or specification',
  workflow: 'A workflow or playbook',
  agent: 'An agent setup',
  'tool-config': 'A tool or integration configuration',
  model: 'A model (results you provide)',
  other: 'Something else',
};

/** What the experiment compares. Existing experiments are all 'skill'. */
export const EXPERIMENT_TYPES = ['skill', 'prompt', 'workflow', 'agent', 'tool-config', 'model', 'other'] as const;
export const ExperimentTypeSchema = z.enum(EXPERIMENT_TYPES);
export type ExperimentType = z.infer<typeof ExperimentTypeSchema>;
export const EXPERIMENT_TYPE_LABELS: Record<ExperimentType, string> = {
  skill: 'Skills',
  prompt: 'Prompts or specifications',
  workflow: 'Workflows',
  agent: 'Agents',
  'tool-config': 'Tool or integration configurations',
  model: 'Models (you supply the results)',
  other: 'Something else',
};

/** True for the conditions that serve as a baseline. */
export const isBaselineKind = (k: ConditionKind): boolean => k === 'no-skill' || k === 'baseline';

export const ConditionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  kind: ConditionKindSchema,
  skillName: z.string().max(120).default(''),
  skillVersion: z.string().max(120).default(''),
  /** Exactly what differs from the baseline condition. */
  difference: z.string().max(1000).default(''),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const ProvenanceSchema = z.enum(['self-reported', 'user-imported']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const MetricValueSchema = z.object({
  /** null = unknown / not measured. NEVER treated as zero. */
  value: z.number().nullable(),
  provenance: ProvenanceSchema.default('self-reported'),
});
export type MetricValue = z.infer<typeof MetricValueSchema>;

export const RunSchema = z.object({
  id: z.string().min(1),
  conditionId: z.string().min(1),
  index: z.number().int().min(1),
  recordedAt: z.string(),
  testsPassed: z.number().int().min(0).nullable().default(null),
  testsTotal: z.number().int().min(0).nullable().default(null),
  testsProvenance: ProvenanceSchema.default('self-reported'),
  successMet: z.boolean().nullable().default(null),
  seededFound: z.array(z.string()).nullable().default(null),
  /** Skill Improvement Loop: which seeded evaluation case this run answers. */
  caseId: z.string().max(60).nullable().default(null),
  /** The answer you read in Claude's output (self-reported); one of the mission's options. 'unclear' = no usable answer. */
  verdict: z.string().min(1).max(40).nullable().default(null),
  /** Ground truth this run was graded against, set by Forge when grading (null = not graded yet). */
  gradedTruth: z.string().min(1).max(40).nullable().default(null),
  /** Did the Skill visibly activate in this session? (self-reported) */
  skillActivated: z.boolean().nullable().default(null),
  metrics: z.record(z.string(), MetricValueSchema).default({}),
  /** Rubric level 0..3 per criterion, null = not assessed. Subjective, self-assessed. */
  rubric: z.record(z.string(), z.number().int().min(0).max(3).nullable()).default({}),
  observations: z.string().max(4000).default(''),
  /**
   * How this attempt ended. Failed and abandoned attempts are KEPT and counted: dropping them would make a condition look
   * more reliable than it was. Their measurements stay unknown unless the learner recorded them.
   */
  attempt: z.enum(['completed', 'failed', 'abandoned']).default('completed'),
  /** Workflow / Skill version actually used in THIS run (may differ from the condition's stated version). */
  skillVersion: z.string().max(120).default(''),
  /** Fixture version actually used in THIS run. */
  fixtureVersion: z.string().max(40).default(''),
  /** Execution context for THIS run: model, session, settings, or anything that differed. Free text. */
  context: z.string().max(300).default(''),
});
export type Run = z.infer<typeof RunSchema>;
export const ATTEMPT_LABELS = { completed: 'Completed', failed: 'Failed (kept)', abandoned: 'Abandoned (kept)' } as const;

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  runId: z.string().nullable(),
  kind: z.enum(['pasted-output', 'file', 'test-report', 'note', 'prompt', 'model-output', 'tool-result', 'tool-call', 'metadata']),
  name: z.string().max(200),
  mime: z.string().max(100).default('text/plain'),
  size: z.number().int().min(0),
  text: z.string().max(600_000),
  provenance: ProvenanceSchema,
  /** How Forge came to hold this: set by the transcript importer; null for evidence added the older ways. */
  classification: z.enum(['parsed-tool-result', 'parsed-tool-call', 'parsed-model-output', 'parsed-prompt', 'parsed-metadata', 'user-observation', 'inferred', 'unknown']).nullable().default(null),
  /** Where it came from inside the import (format, tool name, turn). Small, plain strings only. */
  meta: z.record(z.string().max(40), z.string().max(300)).default({}),
  addedAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FixtureRefSchema = z.object({
  id: z.string().max(80),
  label: z.string().max(200),
  version: z.string().max(40).default(''),
  hash: z.string().max(100).nullable().default(null),
});
export type FixtureRef = z.infer<typeof FixtureRefSchema>;

/** Marks an experiment that was started from the guided "first experiment" flow. It adds guidance state only: the data is an ordinary experiment. */
export const PILOT_STARTERS = ['skill', 'workflow', 'prompts'] as const;
/**
 * The learner's own feedback on the guided flow itself. It is opinion about the product and about what changed in their
 * judgment. It is stored with the experiment, is never sent anywhere and is never performance evidence.
 */
export const PilotFeedbackSchema = z.object({
  confusing: z.string().max(1500).default(''),
  unnecessaryEffort: z.string().max(1500).default(''),
  judgmentChanged: z.enum(['yes', 'somewhat', 'no', 'unsure']).default('unsure'),
  improve: z.string().max(1500).default(''),
  wouldRepeat: z.enum(['yes', 'maybe', 'no']).default('maybe'),
  savedAt: z.string(),
});
export type PilotFeedback = z.infer<typeof PilotFeedbackSchema>;

export const PilotMetaSchema = z.object({
  starter: z.enum(PILOT_STARTERS),
  /** The Skill, workflow or technique being tried, in the learner's words. */
  technique: z.string().max(200).default(''),
  /** What to change next, written after the evaluation. */
  nextImprovement: z.string().max(2000).default(''),
  /** Optional: the playbook step this experiment was started to evidence. */
  playbookId: z.string().max(100).nullable().default(null),
  stepId: z.string().max(100).nullable().default(null),
  startedAt: z.string(),
  /** Optional, written after the experiment. Subjective: not evidence of performance. */
  feedback: PilotFeedbackSchema.nullable().default(null),
});
export type PilotMeta = z.infer<typeof PilotMetaSchema>;

export const ExperimentSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  title: z.string().min(1).max(200),
  /** What is being compared. Every experiment from before Round 3 is a 'skill' experiment. */
  experimentType: ExperimentTypeSchema.default('skill'),
  /** One sentence: the thing being compared and the question it answers. */
  subject: z.string().max(400).default(''),
  problem: z.string().max(3000).default(''),
  hypothesis: z.string().max(3000).default(''),
  fixture: FixtureRefSchema,
  successCriteria: z.array(z.string().max(500)).max(20).default([]),
  prompt: z.string().max(6000).default(''),
  environment: z
    .object({
      claudeCodeVersion: z.string().max(60).default(''),
      model: z.string().max(100).default(''),
      settings: z.string().max(500).default(''),
      os: z.string().max(100).default(''),
      notes: z.string().max(1000).default(''),
    })
    .default({ claudeCodeVersion: '', model: '', settings: '', os: '', notes: '' }),
  plannedMeasures: z.array(z.string()).default([]),
  plannedRuns: z.number().int().min(1).max(30).default(3),
  rubricLockedAt: z.string().nullable().default(null),
  conditions: z.array(ConditionSchema).max(6),
  runs: z.array(RunSchema).max(300).default([]),
  observations: z.string().max(6000).default(''),
  conclusion: z.string().max(6000).default(''),
  limitations: z.string().max(6000).default(''),
  status: z.enum(['draft', 'recording', 'concluded']).default('draft'),
  /** True only for the built-in synthetic demonstration. */
  synthetic: z.boolean().default(false),
  skillLinks: z.array(z.string()).default([]),
  /** Set when this experiment belongs to a Skill Improvement Loop. */
  loopId: z.string().nullable().default(null),
  phase: z.enum(['dev', 'heldout']).nullable().default(null),
  /** Blinded reviews of this experiment's outputs. Kept with the experiment so they travel with it in a backup. */
  blindedReviews: z.array(BlindedReviewSchema).max(20).default([]),
  /** Present only for experiments created by the guided first-experiment flow. */
  pilot: PilotMetaSchema.nullable().default(null),
  /** Held-out runs are locked when the ground truth is revealed, so results cannot be edited afterwards. */
  runsLockedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;
