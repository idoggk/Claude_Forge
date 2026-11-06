/**
 * Typed content model for the Academy. Lessons are plain TypeScript data so
 * they are type-checked, unit-tested (see tests/unit/content.test.ts) and
 * versioned in git. Changing a lesson's assessment requires bumping `version`
 * so old attempts stay on record but stop counting toward current mastery.
 */

export type CompetencyId =
  | 'mechanism-selection'
  | 'skill-anatomy'
  | 'trigger-design'
  | 'skill-security'
  | 'skill-authoring'
  | 'systematic-debugging'
  | 'economy-analysis'
  | 'experiment-design'
  | 'multi-agent-review'
  | 'production-skills'
  // Round 3: broader AI mastery
  | 'approach-selection'
  | 'context-engineering'
  | 'agent-failure-analysis'
  | 'mcp-integration'
  | 'workflow-design'
  | 'efficient-ai-development'
  | 'tool-evaluation'
  // Round 4: advanced AI engineering
  | 'structured-tool-contracts'
  | 'few-shot-design'
  | 'prompt-injection-defense'
  | 'retrieval-design'
  | 'eval-harness-design'
  | 'long-running-context'
  // Round 6: permissions and deterministic gates
  | 'agent-permissions'
  | 'deterministic-gates';

/** The twelve learning tracks. Each lists the topics it will cover; only topics with a lesson are available. */
export type TrackId =
  | 'fundamentals'
  | 'prompting'
  | 'claude-code'
  | 'agents'
  | 'mcp-tools'
  | 'automation'
  | 'engineering'
  | 'game-dev'
  | 'research'
  | 'ecosystem'
  | 'safety-eval'
  | 'advanced';

export interface Competency {
  id: CompetencyId;
  title: string;
  summary: string;
  /** Which of the 12 thirty-day outcomes this supports (1-based, see docs/PRODUCT.md). */
  outcomes: number[];
  /** Safety-critical competencies must show a clean critical-item record to reach level 3. */
  safetyCritical: boolean;
  /** Advanced competencies are not part of the placement diagnostic (it only probes the foundations). */
  advanced?: boolean;
}

export interface TrackTopic {
  title: string;
  /** Present only when a lesson actually covers the topic. A topic without a lesson is PLANNED, never shown as available. */
  lessonId?: string;
}

export interface Track {
  id: TrackId;
  /** 1-based order shown in the Academy. */
  order: number;
  title: string;
  summary: string;
  /** What a learner can do after the track, in terms of judgment rather than tool names. */
  outcome: string;
  topics: TrackTopic[];
}

export interface SourceRef {
  label: string;
  url: string;
  /** What this source was used to support, so claims stay traceable. */
  supports: string;
}

export interface Segment {
  id: string;
  title: string;
  /** Markdown. Raw HTML is never rendered. */
  body: string;
  /**
   * Prediction before explanation: the learner commits to an answer first, then the explanation is revealed.
   * Never graded and never stored: it exists to make the learner think before reading.
   */
  prediction?: { prompt: string; options: Option[]; correct: string };
}

export interface Option {
  id: string;
  text: string;
  /** Why this option is right or wrong. Shown after grading, for every option. */
  why: string;
  /** Id in the misconception catalog: the mistaken belief this (wrong) option expresses. */
  misconception?: string;
}

interface BaseItem {
  id: string;
  prompt: string;
  concept: CompetencyId;
  /** Mandatory check: missing it blocks level 3 for this concept regardless of the overall score. */
  critical?: boolean;
  /** 1 = recall, 2 = apply, 3 = judge / transfer. Used to pace spaced reviews. Default 2. */
  difficulty?: 1 | 2 | 3;
  hints?: string[];
  /** General explanation shown after grading. */
  explanation: string;
  /** Relative weight in the attempt score. Default 1. */
  points?: number;
}

export interface SingleItem extends BaseItem {
  kind: 'single';
  options: Option[];
  correct: string;
}
export interface MultiItem extends BaseItem {
  kind: 'multi';
  options: Option[];
  correct: string[];
}
export interface ClassifyItem extends BaseItem {
  kind: 'classify';
  categories: { id: string; label: string }[];
  entries: { id: string; text: string; correct: string; why: string }[];
}
export interface OrderItem extends BaseItem {
  kind: 'order';
  /** Listed in the CORRECT order; the UI shuffles deterministically. */
  steps: { id: string; text: string; why?: string }[];
}
export interface NumericItem extends BaseItem {
  kind: 'numeric';
  /** A number, or a function that computes it from a trusted in-app fixture at grading time. */
  answer: number | (() => number);
  tolerance?: number;
  unit?: string;
  /** Optional targeted feedback for a typical wrong answer. */
  diagnose?: (value: number, expected: number) => string | null;
}
export interface KeywordsItem extends BaseItem {
  kind: 'keywords';
  /** Each group is satisfied when the answer contains ANY phrase of the group (case-insensitive). */
  groups: { label: string; anyOf: string[] }[];
  /** Number of groups that must be satisfied. Default: all. */
  minGroups?: number;
  placeholder?: string;
}
export interface FlagLinesItem extends BaseItem {
  kind: 'flaglines';
  filename: string;
  lines: string[];
  targets: { line: number; severity: 'critical' | 'major' | 'minor'; why: string }[];
}
/**
 * Structured written answer: several labelled fields, each checked deterministically for the ideas it must contain.
 * Used where the learner must IMPROVE something (for example a vague AI task) rather than choose an option.
 * Keyword checks are narrow by design; pair this item with a `reflect` rubric for the qualities they cannot judge.
 */
export interface FieldsItem extends BaseItem {
  kind: 'fields';
  /** The material being improved, shown above the fields. Markdown. */
  brief: string;
  fields: { id: string; label: string; help: string; groups: { label: string; anyOf: string[] }[]; minGroups?: number; placeholder?: string }[];
}
export interface ReflectItem extends BaseItem {
  kind: 'reflect';
  /** Self-assessment checklist. Never counted toward the numeric score. */
  rubric: string[];
}
/**
 * A multi-part case: a realistic situation (a decision scenario) or a flawed artifact (an error diagnosis) followed by
 * several linked choices. Each part is graded by option id. Credit is partial per part; the item is correct only when
 * every part is. In a scenario the right option depends on the stated constraints, so pair a scenario with a sibling that
 * changes one constraint and flips an answer.
 */
export interface CasePart { id: string; label: string; options: Option[]; correct: string }
export interface CaseItem extends BaseItem {
  kind: 'case';
  format: 'scenario' | 'diagnosis';
  /** The situation or context. Markdown. */
  situation: string;
  /** Scenario constraints, shown as a list. The correct choices must depend on them. */
  constraints?: string[];
  /** Diagnosis: the flawed prompt, plan, workflow or tool result, shown line by line as inert text. */
  artifact?: string[];
  parts: CasePart[];
}
/** A deterministic structural check on a learner-built artifact. It must be a pure function of the text. */
export interface ConstructCheck { id: string; label: string; test: (draft: string) => boolean; why: string }
/**
 * Structured construction: the learner builds something small (a tool schema, a permission policy, a handoff contract).
 * The checks are objective and structural. They cannot judge whether the result is GOOD, only whether it has the required
 * parts, so a rubric is shown for the learner's own judgement and is never scored.
 */
export interface ConstructItem extends BaseItem {
  kind: 'construct';
  brief: string;
  format: 'json' | 'text';
  starter?: string;
  placeholder?: string;
  checks: ConstructCheck[];
  /** Honest self-evaluation prompts: qualities no structural check can verify. Not scored. */
  rubric: string[];
  /** One reference solution. It must pass every check (a test enforces that), and it is shown after grading as an example, not the only answer. */
  reference: string;
}
export type ExternalCheckId = 'workshop-first-skill' | 'workshop-capstone-skill' | 'battle-lab-experiment' | 'playbook-workflow' | 'lab-repeated-runs' | 'lab-evaluation-harness';
export interface ExternalItem extends BaseItem {
  kind: 'external';
  check: ExternalCheckId;
}

export type Item =
  | SingleItem
  | MultiItem
  | ClassifyItem
  | OrderItem
  | NumericItem
  | KeywordsItem
  | FieldsItem
  | FlagLinesItem
  | CaseItem
  | ConstructItem
  | ReflectItem
  | ExternalItem;

export type WidgetId =
  | 'mechanism-map'
  | 'skill-md-anatomy'
  | 'trigger-dojo'
  | 'skill-autopsy-files'
  | 'workshop-link'
  | 'merge-lab'
  | 'economy-lab'
  | 'experiment-demo'
  | 'review-board'
  | 'capstone-brief'
  | 'retrieval-lab';

export interface ActivitySpec {
  title: string;
  intro: string;
  widget?: WidgetId;
  items: Item[];
}

export interface AssessmentSpec {
  title: string;
  intro: string;
  /** Fraction of weighted points needed to pass (0..1). */
  passMark: number;
  items: Item[];
}

export interface Lesson {
  /** Stable ID. Never reuse or renumber. */
  id: string;
  version: number;
  track: TrackId;
  order: number;
  title: string;
  subtitle: string;
  prerequisites: string[];
  competencies: CompetencyId[];
  effortMinutes: number;
  /** Other tracks this lesson also belongs to (the primary one is `track`). */
  alsoIn?: TrackId[];
  /** 0 = general, 3 = directly about game development. Used by the recommender. */
  gameRelevance: 0 | 1 | 2 | 3;
  interestTags: InterestTag[];
  problem: string;
  whyItMatters: string;
  objectives: string[];
  segments: Segment[];
  activity: ActivitySpec;
  assessment: AssessmentSpec;
  failureModes: string[];
  application: { title: string; body: string; fieldPrompt: string };
  /** Separate pool used by spaced review (unseen items for level-3 evidence). At least 3. */
  reviewItems: Item[];
  sources: SourceRef[];
}

export type InterestTag = 'game-dev' | 'security' | 'authoring' | 'experiments' | 'orchestration' | 'foundations' | 'ai-judgment' | 'context' | 'automation';

export const INTEREST_LABELS: Record<InterestTag, string> = {
  foundations: 'Claude Code foundations',
  security: 'Security & trust',
  authoring: 'Writing my own Skills',
  experiments: 'Measuring what works',
  'game-dev': 'Game development workflows',
  orchestration: 'Multi-agent orchestration',
  'ai-judgment': 'Choosing the right AI approach',
  context: 'Context and prompt engineering',
  automation: 'Workflows and automation',
};
