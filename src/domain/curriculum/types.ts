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
  | 'production-skills';

export type TrackId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Competency {
  id: CompetencyId;
  title: string;
  summary: string;
  /** Which of the 12 thirty-day outcomes this supports (1-based, see docs/PRODUCT.md). */
  outcomes: number[];
  /** Safety-critical competencies must show a clean critical-item record to reach level 3. */
  safetyCritical: boolean;
}

export interface Track {
  id: TrackId;
  title: string;
  summary: string;
  /** Topics planned for later releases. They are listed for transparency and are NOT available. */
  plannedTopics: string[];
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
export interface ReflectItem extends BaseItem {
  kind: 'reflect';
  /** Self-assessment checklist. Never counted toward the numeric score. */
  rubric: string[];
}
export type ExternalCheckId = 'workshop-first-skill' | 'workshop-capstone-skill' | 'battle-lab-experiment';
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
  | FlagLinesItem
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
  | 'capstone-brief';

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

export type InterestTag = 'game-dev' | 'security' | 'authoring' | 'experiments' | 'orchestration' | 'foundations';

export const INTEREST_LABELS: Record<InterestTag, string> = {
  foundations: 'Claude Code foundations',
  security: 'Security & trust',
  authoring: 'Writing my own Skills',
  experiments: 'Measuring what works',
  'game-dev': 'Game development workflows',
  orchestration: 'Multi-agent orchestration',
};
