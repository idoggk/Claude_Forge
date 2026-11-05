import Dexie, { type Table } from 'dexie';
import type {
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

export const DB_NAME = 'claude-forge';
/** Bump when stores or record shapes change, and add a numbered `version()` block with an upgrade. */
export const DB_VERSION = 4;

/**
 * Stores (all local to this browser profile):
 *  profile · preferences · lessonProgress · attempts · competencies · reviews ·
 *  annotations (catalog notes) · arsenal · customSkills · experiments · evidence ·
 *  fieldEvidence (v2) · loops (v3) · diagnostics (v4) · meta
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
  'meta',
] as const;
export type StoreName = (typeof ALL_STORES)[number];
