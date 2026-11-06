import Dexie, { type Table } from 'dexie';
import type {
  ActivityRun,
  Annotation,
  ArsenalRecord,
  Attempt,
  CompetencyRecord,
  DiagnosticRecord,
  FieldEvidence,
  LessonProgress,
  MetaRecord,
  Preferences,
  Profile,
  ReviewRecord,
} from './schemas';
import type { SkillDraft } from '@/domain/skills/model';
import type { Evidence, Experiment } from '@/domain/experiments/model';
import type { LoopRun } from '@/domain/loop/model';
import type { LearningGoal } from '@/domain/goals/model';
import type { TransferTask } from '@/domain/transfer/model';
import { stepFingerprint } from '@/domain/playbook/evidence';
import type { Playbook } from '@/domain/playbook/model';

export const DB_NAME = 'claude-forge';
/** Bump when stores or record shapes change, and add a numbered `version()` block with an upgrade. */
export const DB_VERSION = 6;

/**
 * Stores (all local to this browser profile):
 *  profile · preferences · lessonProgress · attempts · competencies · reviews ·
 *  annotations (catalog notes) · arsenal · customSkills · experiments · evidence ·
 *  fieldEvidence (v2) · loops (v3) · diagnostics (v4) · goals, playbooks, activityRuns (v5) · transferTasks (v6) · meta
 */
export class ForgeDB extends Dexie {
  profile!: Table<Profile, string>;
  preferences!: Table<Preferences, string>;
  lessonProgress!: Table<LessonProgress, string>;
  attempts!: Table<Attempt, string>;
  competencies!: Table<CompetencyRecord, string>;
  reviews!: Table<ReviewRecord, string>;
  annotations!: Table<Annotation, string>;
  arsenal!: Table<ArsenalRecord, string>;
  customSkills!: Table<SkillDraft, string>;
  experiments!: Table<Experiment, string>;
  evidence!: Table<Evidence, string>;
  fieldEvidence!: Table<FieldEvidence, string>;
  loops!: Table<LoopRun, string>;
  diagnostics!: Table<DiagnosticRecord, string>;
  goals!: Table<LearningGoal, string>;
  playbooks!: Table<Playbook, string>;
  activityRuns!: Table<ActivityRun, string>;
  transferTasks!: Table<TransferTask, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    // v1 — initial schema.
    this.version(1).stores({
      profile: 'id',
      preferences: 'id',
      lessonProgress: 'lessonId',
      attempts: 'id, lessonId, stage, submittedAt, [lessonId+stage]',
      competencies: 'competencyId',
      reviews: 'lessonId, dueOn',
      annotations: 'entryId',
      arsenal: 'entryId, status',
      customSkills: 'id, updatedAt',
      experiments: 'id, updatedAt, status',
      evidence: 'id, experimentId',
      meta: 'key',
    });

    // v2 — adds fieldEvidence (real-work application records for level 4) and
    // backfills attempt fields that v1 did not record. No data is dropped.
    this.version(2)
      .stores({ fieldEvidence: 'id, date' })
      .upgrade(async (tx) => {
        await tx
          .table('attempts')
          .toCollection()
          .modify((a: Record<string, unknown>) => {
            if (typeof a.independent !== 'boolean') a.independent = Number(a.hintsUsed ?? 0) === 0;
            if (typeof a.unseen !== 'boolean') a.unseen = a.stage === 'assessment' && Number(a.attemptNumber ?? 1) === 1;
            if (typeof a.conceptResults !== 'object' || a.conceptResults === null) a.conceptResults = {};
          });
        await tx.table('meta').put({ key: 'migratedFrom', value: 1 });
      });

    // v3 - adds `loops` (Skill Improvement Loop runs). Existing experiments gain the optional loop fields
    // (null) so every record has the new shape; nothing is removed or rewritten otherwise.
    this.version(3)
      .stores({ loops: 'id, status, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('experiments')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            if (e.loopId === undefined) e.loopId = null;
            if (e.phase === undefined) e.phase = null;
            if (e.runsLockedAt === undefined) e.runsLockedAt = null;
            if (Array.isArray(e.runs)) {
              for (const r of e.runs as Record<string, unknown>[]) {
                if (r.caseId === undefined) r.caseId = null;
                if (r.verdict === undefined) r.verdict = null;
                if (r.gradedTruth === undefined) r.gradedTruth = null;
                if (r.skillActivated === undefined) r.skillActivated = null;
              }
            }
          });
        const prev = (await tx.table('meta').get('migratedFrom'))?.value;
        await tx.table('meta').put({ key: 'migratedFrom', value: typeof prev === 'number' ? prev : 2 });
      });

    // v4 - adds `diagnostics` (placement diagnostic results). Purely additive: no existing record changes, and
    // diagnostics never feed competency levels.
    this.version(4).stores({ diagnostics: 'id, takenAt' });

    // v5 - adds `goals` (learning goals), `playbooks` (AI workflow playbooks) and `activityRuns` (standalone practice
    // activities). Experiments gain `experimentType` ('skill' for every existing one) and `subject`. No record is
    // removed or rewritten otherwise, and every existing experiment keeps working as a Skill experiment.
    this.version(5)
      .stores({ goals: 'id, status, updatedAt', playbooks: 'id, updatedAt', activityRuns: 'id, activityId, takenAt' })
      .upgrade(async (tx) => {
        await tx
          .table('experiments')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            if (e.experimentType === undefined) e.experimentType = 'skill';
            if (e.subject === undefined) e.subject = '';
          });
      });

    // v6 (Round 4) - adds `transferTasks` (real-world application records). Playbooks gain `contentVersion`,
    // `evidenceLinks` and `evaluations`, and every step gains `verifiedFingerprint`. A step that was ALREADY marked
    // verified keeps that status: its fingerprint is set to its current wording, so only LATER edits invalidate it.
    // Nothing is removed or rewritten otherwise. The upgrade does no network or non-database work.
    this.version(6)
      .stores({ transferTasks: 'id, status, updatedAt' })
      .upgrade(async (tx) => {
        await tx
          .table('playbooks')
          .toCollection()
          .modify((pb: Record<string, unknown>) => {
            if (typeof pb.contentVersion !== 'number') pb.contentVersion = 1;
            if (!Array.isArray(pb.evidenceLinks)) pb.evidenceLinks = [];
            if (!Array.isArray(pb.evaluations)) pb.evaluations = [];
            if (Array.isArray(pb.steps)) {
              for (const s of pb.steps as Record<string, unknown>[]) {
                if (s.verifiedFingerprint === undefined) s.verifiedFingerprint = s.status === 'verified' ? stepFingerprint(s as never) : null;
              }
            }
          });
      });
  }
}

let instance: ForgeDB | null = null;

export function getDb(): ForgeDB {
  if (!instance) instance = new ForgeDB();
  return instance;
}

/** Test helper: swap the singleton for an isolated database. */
export function setDbForTesting(db: ForgeDB | null): void {
  instance = db;
}

export const ALL_STORES = [
  'profile',
  'preferences',
  'lessonProgress',
  'attempts',
  'competencies',
  'reviews',
  'annotations',
  'arsenal',
  'customSkills',
  'experiments',
  'evidence',
  'fieldEvidence',
  'loops',
  'diagnostics',
  'goals',
  'playbooks',
  'activityRuns',
  'transferTasks',
  'meta',
] as const;
export type StoreName = (typeof ALL_STORES)[number];
