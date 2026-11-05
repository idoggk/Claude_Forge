import type { SkillContent } from '@/domain/skills/model';
/** A verdict is one of the mission's own options (see `LoopMission.verdicts`), or 'unclear' for no usable answer. */
export type Verdict = string;

export interface CaseTruth {
  caseId: string;
  verdict: Verdict;
  /** Plain-language reason the ground truth is what it is, computed from the fixture's own output. */
  summary: string;
  /** Mission-specific supporting numbers (for display and tests). */
  numbers?: unknown;
}

export const LOOP_STEPS = ['mission', 'baseline', 'build', 'test', 'evaluate', 'improve', 'heldout', 'graduate'] as const;
export type LoopStepId = (typeof LOOP_STEPS)[number];

export const STEP_LABELS: Record<LoopStepId, { label: string; short: string }> = {
  mission: { label: 'Choose the mission', short: 'Mission' },
  baseline: { label: 'Baseline (no Skill)', short: 'Baseline' },
  build: { label: 'Build the Skill', short: 'Build' },
  test: { label: 'Test the Skill', short: 'Test' },
  evaluate: { label: 'Evaluate the difference', short: 'Evaluate' },
  improve: { label: 'Improve with a hypothesis', short: 'Improve' },
  heldout: { label: 'Held-out test', short: 'Held-out' },
  graduate: { label: 'Graduate and export', short: 'Graduate' },
};

export const FAILURE_PATTERNS = [
  { id: 'trigger-broad', label: 'Trigger too broad', signal: 'The Skill activated on requests it should not handle.', fix: 'Add a "Not for…" boundary and replace generic words with the concrete symptoms the Skill is for.' },
  { id: 'trigger-narrow', label: 'Trigger too narrow', signal: 'The Skill did not activate on requests it should handle.', fix: 'Add the words people actually type, include a paraphrase scenario, and put the key use case first.' },
  { id: 'missing-verification', label: 'Missing verification instructions', signal: 'Answers state conclusions without running the checks that would support them.', fix: 'Add a required verification step: the exact command to run and the output that must be quoted before any recommendation.' },
  { id: 'excess-detail', label: 'Excessive procedural detail', signal: 'The Skill buries the decision procedure under reference material, or the output drowns in steps.', fix: 'Move reference detail into a linked file and keep SKILL.md to the decision procedure.' },
  { id: 'overly-restrictive', label: 'Overly restrictive guidance', signal: 'The Skill blocks reasonable answers or forces steps that do not apply.', fix: 'Replace absolute rules with conditions ("when X, do Y") and state the exceptions.' },
  { id: 'weak-output-contract', label: 'Weak output contract', signal: 'Answers vary in structure, so the evidence you need is sometimes missing or hard to find.', fix: 'Define the exact output sections and require each claim to point at its evidence.' },
  { id: 'missing-safety-gates', label: 'Missing safety gates', signal: 'The Skill lets Claude take risky or irreversible steps, or accept unsupported claims, without a stop.', fix: 'Add an explicit stop condition: what must be true before recommending approval or taking an action.' },
  { id: 'inconsistent-results', label: 'Inconsistent results', signal: 'The same kind of task produces different quality from run to run, or needs repeated correction.', fix: 'Tighten ambiguous instructions, add one worked example, and measure again with more runs.' },
] as const;
export type FailurePatternId = (typeof FAILURE_PATTERNS)[number]['id'];

export interface ChecklistItem {
  id: string;
  text: string;
  /** Which failure pattern a missing item suggests. */
  patternId: FailurePatternId;
  /** Mission-specific advice shown when this item is often missed. */
  hint: string;
}

export interface MissionCase {
  id: string;
  title: string;
  change: string;
  rationale: string;
  /** The full prompt to paste into Claude Code (identical for every condition). */
  prompt: string;
}

export interface LoopMission {
  id: string;
  version: number;
  title: string;
  tagline: string;
  /** Markdown: what is broken or inefficient. */
  problem: string;
  whyItMatters: string;
  targetOutcome: string;
  skillConcept: string;
  prerequisites: string[];
  successCriteria: string[];
  designTargets: string;
  fixture: { devId: string; heldoutId: string; devLabel: string; heldoutLabel: string };
  devCases: MissionCase[];
  heldoutCases: MissionCase[];
  checklist: ChecklistItem[];
  /** Starter Skill. Intentionally decent but imperfect; the learner's data decides what to fix. */
  starter: () => SkillContent;
  starterNote: string;
  baselineHowTo: string[];
  skillHowTo: string[];
  evidenceHowTo: string[];
  heldoutWhy: string;
  transferPrompt: string;
  truth: (caseId: string) => CaseTruth | undefined;
  /** What the learner records for each case, and how Claude is told to write it in its final answer. */
  verdicts: { value: string; label: string }[];
  verdictFormat: string;
  labels: MissionLabels;
}

/** Mission-specific wording so the Loop UI and report read correctly for every mission. */
export interface MissionLabels {
  /** 'the Shardfall economy simulation' - used as "matched <truthSource>". */
  truthSource: string;
  /** One or two words: 'simulation', 'cost-model profiler', 'determinism harness', 'merge policy'. */
  truthShort: string;
  caseNoun: string;
  caseNounPlural: string;
  /** What is being recorded per case: 'verdict' or 'root cause'. */
  answerNoun: string;
  /** For the report's limitations section. */
  truthLimitation: string;
  fixtureBadge: string;
  estimate: string;
  packDescription: string;
  /** Mission-step paragraph explaining how ground truth works. */
  howTruthWorks: string;
}

export interface LoopSignal {
  patternId: FailurePatternId;
  /** Factual evidence from YOUR recorded data. */
  evidence: string;
  weight: number;
}
