import { z } from 'zod';
import { ALL_STORES, getDb, type StoreName } from './db';
import {
  AnnotationSchema, ArsenalSchema, AttemptSchema, CompetencyRecordSchema, FieldEvidenceSchema, LessonProgressSchema,
  MetaSchema, PreferencesSchema, ProfileSchema, ReviewRecordSchema, SkillDraftSchema, ExperimentSchema, EvidenceSchema, DiagnosticRecordSchema, ActivityRunSchema,
} from './schemas';
import { LoopRunSchema } from '@/domain/loop/model';
import { LearningGoalSchema } from '@/domain/goals/model';
import { PlaybookSchema } from '@/domain/playbook/model';
import { TransferTaskSchema } from '@/domain/transfer/model';
import { TakeawaySchema } from '@/domain/library/model';
import { MissionRunSchema } from '@/domain/missions/model';
import { nowIso } from '@/lib/clock';
import { recomputeCompetencies } from './repo';

export const BACKUP_FORMAT = 'claude-forge-backup';
export const BACKUP_VERSION = 1;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const SCHEMAS: Record<StoreName, z.ZodType> = {
  profile: ProfileSchema,
  preferences: PreferencesSchema,
  lessonProgress: LessonProgressSchema,
  attempts: AttemptSchema,
  competencies: CompetencyRecordSchema,
  reviews: ReviewRecordSchema,
  annotations: AnnotationSchema,
  arsenal: ArsenalSchema,
  customSkills: SkillDraftSchema,
  experiments: ExperimentSchema,
  evidence: EvidenceSchema,
  fieldEvidence: FieldEvidenceSchema,
  loops: LoopRunSchema,
  diagnostics: DiagnosticRecordSchema,
  goals: LearningGoalSchema,
  playbooks: PlaybookSchema,
  activityRuns: ActivityRunSchema,
  transferTasks: TransferTaskSchema,
  takeaways: TakeawaySchema,
  missionRuns: MissionRunSchema,
  meta: MetaSchema,
};

export type BackupData = Record<StoreName, unknown[]>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: string;
  notice: string;
  data: BackupData;
}

const EMPTY = (): BackupData => Object.fromEntries(ALL_STORES.map((s) => [s, []])) as unknown as BackupData;

export async function exportAll(): Promise<BackupFile> {
  const db = getDb();
  const data = EMPTY();
  for (const name of ALL_STORES) data[name] = await db.table(name).toArray();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    app: 'claude-forge',
    notice: 'Your Claude Forge learning data, stored only on your device. Progress does not sync between devices: import this file on another device to move it.',
    data,
  };
}

export function serializeBackup(b: BackupFile): string {
  return JSON.stringify(b, null, 2) + '\n';
}

export interface ImportPreview {
  ok: boolean;
  fatal: string | null;
  version: number | null;
  exportedAt: string | null;
  counts: Record<StoreName, number>;
  invalid: { store: StoreName; index: number; message: string }[];
  invalidCount: number;
  warnings: string[];
}

export interface ParsedImport {
  preview: ImportPreview;
  /** Only records that passed validation. Present when the envelope itself was valid. */
  valid: BackupData | null;
}

const zeroCounts = () => Object.fromEntries(ALL_STORES.map((s) => [s, 0])) as Record<StoreName, number>;

function fatal(msg: string): ParsedImport {
  return { preview: { ok: false, fatal: msg, version: null, exportedAt: null, counts: zeroCounts(), invalid: [], invalidCount: 0, warnings: [] }, valid: null };
}

/**
 * Parse and validate a backup WITHOUT touching the database. Nothing is written until applyImport().
 * The file is treated as untrusted data: JSON.parse only, size-capped, every record schema-checked.
 */
export function parseBackup(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) return fatal(`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fatal('This is not valid JSON.');
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fatal('The file is not a Claude Forge backup (expected a JSON object).');
  const env = raw as Record<string, unknown>;
  if (env.format !== BACKUP_FORMAT) return fatal(`Not a Claude Forge backup (format "${String(env.format ?? 'missing')}").`);
  if (typeof env.version !== 'number' || !Number.isInteger(env.version) || env.version < 1) return fatal('The backup has no valid version number.');
  if (env.version > BACKUP_VERSION) return fatal(`This backup is version ${env.version}; this app understands up to version ${BACKUP_VERSION}. Update the app before importing.`);
  if (env.data === null || typeof env.data !== 'object' || Array.isArray(env.data)) return fatal('The backup has no "data" section.');
  const data = env.data as Record<string, unknown>;

  const counts = zeroCounts();
  const invalid: ImportPreview['invalid'] = [];
  const valid = EMPTY();
  const warnings: string[] = [];
  for (const store of ALL_STORES) {
    const rows = data[store];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) { invalid.push({ store, index: -1, message: 'Section is not a list.' }); continue; }
    rows.forEach((row, index) => {
      const parsed = SCHEMAS[store].safeParse(row);
      if (parsed.success) { valid[store].push(parsed.data); counts[store]++; }
      else if (invalid.length < 200) invalid.push({ store, index, message: parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(record)'}: ${i.message}`).join('; ') });
    });
  }
  const unknown = Object.keys(data).filter((k) => !(ALL_STORES as readonly string[]).includes(k));
  if (unknown.length) warnings.push(`Ignored unknown section(s): ${unknown.join(', ')}.`);
  const invalidCount = invalid.length;
  return {
    preview: { ok: invalidCount === 0, fatal: null, version: env.version, exportedAt: typeof env.exportedAt === 'string' ? env.exportedAt : null, counts, invalid, invalidCount, warnings },
    valid,
  };
}

export type ImportMode = 'merge' | 'replace';

const timeOf = (row: Record<string, unknown>): string => String(row.updatedAt ?? row.submittedAt ?? row.takenAt ?? row.createdAt ?? row.at ?? '');

/**
 * Write validated records in ONE transaction: either everything is applied or nothing is.
 * 'replace' clears each store first. 'merge' never overwrites newer local records, never drops local
 * attempts, and keeps local profile/preferences.
 */
export async function applyImport(valid: BackupData, mode: ImportMode): Promise<{ written: Record<StoreName, number> }> {
  const db = getDb();
  const written = zeroCounts();
  await db.transaction('rw', db.tables, async () => {
    for (const store of ALL_STORES) {
      const table = db.table(store);
      const rows = valid[store] as Record<string, unknown>[];
      if (mode === 'replace') {
        await table.clear();
        if (rows.length) await table.bulkPut(rows);
        written[store] = rows.length;
        continue;
      }
      const keyPath = table.schema.primKey.keyPath as string;
      for (const row of rows) {
        const existing = (await table.get(row[keyPath] as never)) as Record<string, unknown> | undefined;
        if (!existing) { await table.put(row); written[store]++; continue; }
        if (store === 'attempts' || store === 'profile' || store === 'preferences' || store === 'meta') continue;
        if (timeOf(row) > timeOf(existing)) { await table.put(row); written[store]++; }
      }
    }
  });
  await recomputeCompetencies('Import');
  return { written };
}

export async function hasAnyUserData(): Promise<boolean> {
  const db = getDb();
  const counts = await Promise.all(['attempts', 'customSkills', 'experiments', 'arsenal', 'fieldEvidence', 'annotations', 'loops', 'diagnostics', 'goals', 'playbooks', 'activityRuns'].map((t) => db.table(t).count()));
  return counts.some((c) => c > 0);
}
