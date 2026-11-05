import JSZip from 'jszip';
import { SkillContentSchema, type SkillContent } from './model';
import { isScriptPath, validateResourcePath } from './paths';
import { lintSkillMd, parseSkillMd, scanText, type Finding } from './validate';

/**
 * Safe, INERT import of a Skill ZIP.
 *
 * "Inert" means: the archive is read as data, every entry is validated, text is stored as text, and NOTHING is ever
 * executed, installed, fetched or written to disk. The result is an editable DRAFT inside this browser, and a report
 * saying what was imported and what was refused and why. Scripts are kept as plain-text resources that Forge never runs.
 */
export const IMPORT_LIMITS = {
  zipBytes: 3_000_000,
  entries: 300,
  /** Matches the largest supporting file a draft can hold. */
  fileBytes: 200_000,
  totalBytes: 1_500_000,
  /** A text file that decompresses to more than this many times its compressed size is treated as a zip bomb. */
  maxRatio: 100,
  maxResources: 30,
} as const;

export type Disposition = 'skill-md' | 'resource' | 'script' | 'skipped' | 'rejected';

export interface ImportEntry {
  path: string;
  bytes: number;
  disposition: Disposition;
  reason: string;
}

export interface ZipImportResult {
  ok: boolean;
  fatal: string | null;
  /** Folder prefix that held SKILL.md ('' when SKILL.md is at the archive root). */
  root: string | null;
  content: SkillContent | null;
  entries: ImportEntry[];
  findings: Finding[];
  /** Frontmatter keys Forge does not model; they are NOT carried over. */
  ignoredFields: string[];
}

const f = (id: string, severity: Finding['severity'], area: Finding['area'], message: string, fix?: string): Finding => ({ id, severity, area, message, fix });
const fail = (fatal: string, entries: ImportEntry[] = []): ZipImportResult => ({ ok: false, fatal, root: null, content: null, entries, findings: [], ignoredFields: [] });

const OS_JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;

interface InternalFile { _data?: { uncompressedSize?: number; compressedSize?: number } }
const sizesOf = (file: JSZip.JSZipObject): { raw: number | null; packed: number | null } => {
  const d = (file as unknown as InternalFile)._data;
  return { raw: typeof d?.uncompressedSize === 'number' ? d.uncompressedSize : null, packed: typeof d?.compressedSize === 'number' ? d.compressedSize : null };
};

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : Array.isArray(v) ? v.map(String).join(' ') : '');

const KNOWN = new Set(['name', 'description', 'when_to_use', 'argument-hint', 'disable-model-invocation', 'user-invocable', 'allowed-tools', 'context', 'agent', 'model', 'paths', 'license', 'compatibility', 'metadata']);

/** Map parsed frontmatter + body to a SkillContent. The inverse of generateSkillMd for the fields Forge models. */
export function contentFromSkillMd(markdown: string): { content: SkillContent | null; ignored: string[]; findings: Finding[] } {
  const parsed = parseSkillMd(markdown);
  const fm = parsed.frontmatter;
  if (!fm) return { content: null, ignored: [], findings: parsed.findings };
  const findings = [...parsed.findings];
  // identity and trigger fields must be plain text; a list, mapping or self-referencing alias is refused, not coerced
  for (const k of ['name', 'description', 'when_to_use']) {
    const v = fm[k];
    if (v !== undefined && typeof v !== 'string' && typeof v !== 'number') {
      findings.push(f('import-field-type', 'error', 'structure', `Frontmatter "${k}" must be plain text, not a list or mapping.`, 'Write it as a single line of text.'));
      return { content: null, ignored: [], findings };
    }
  }
  if (parsed.frontmatterRaw && /(^|[\s:[,{-])[&*][A-Za-z_]/m.test(parsed.frontmatterRaw)) findings.push(f('import-yaml-alias', 'warning', 'structure', 'The frontmatter uses YAML anchors or aliases. Skills do not need them and Forge does not expand them beyond a safe limit.'));
  const invocation = fm['disable-model-invocation'] === true ? 'manual-only' : fm['user-invocable'] === false ? 'auto-only' : 'auto-and-manual';
  const meta = fm.metadata && typeof fm.metadata === 'object' && !Array.isArray(fm.metadata) ? Object.entries(fm.metadata as Record<string, unknown>).map(([key, value]) => ({ key, value: str(value) })) : [];
  const candidate = {
    name: str(fm.name),
    description: str(fm.description),
    whenToUse: str(fm.when_to_use),
    instructions: parsed.body.trim(),
    invocation,
    allowedTools: str(fm['allowed-tools']),
    argumentHint: str(fm['argument-hint']),
    context: fm.context === 'fork' ? 'fork' : '',
    agent: str(fm.agent),
    model: str(fm.model),
    paths: str(fm.paths),
    license: str(fm.license),
    compatibility: str(fm.compatibility),
    metadata: meta,
  };
  const r = SkillContentSchema.safeParse(candidate);
  if (!r.success) {
    findings.push(f('import-too-large', 'error', 'structure', `A field exceeds what a draft can hold: ${r.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}. Nothing was truncated.`));
    return { content: null, ignored: [], findings };
  }
  return { content: r.data, ignored: Object.keys(fm).filter((k) => !KNOWN.has(k)), findings };
}

export async function importSkillZip(data: ArrayBuffer | Uint8Array): Promise<ZipImportResult> {
  const size = data.byteLength;
  if (size === 0) return fail('The file is empty.');
  if (size > IMPORT_LIMITS.zipBytes) return fail(`The ZIP is ${(size / 1e6).toFixed(1)} MB; the limit is ${IMPORT_LIMITS.zipBytes / 1e6} MB. A Skill is a few text files.`);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: true });
  } catch {
    return fail('This is not a readable ZIP archive (or it is corrupt).');
  }
  const all = Object.values(zip.files);
  if (all.length > IMPORT_LIMITS.entries) return fail(`The archive has ${all.length} entries; the limit is ${IMPORT_LIMITS.entries}.`);

  const entries: ImportEntry[] = [];
  const note = (path: string, bytes: number, disposition: Disposition, reason: string) => entries.push({ path, bytes, disposition, reason });

  // 1. find SKILL.md (root, or one folder deep)
  const files = all.filter((e) => !e.dir);
  const skillMds = files.filter((e) => /^(?:[^/]+\/)?SKILL\.md$/.test(e.name));
  if (skillMds.length === 0) return fail('No SKILL.md found at the top of the archive or inside one top-level folder.');
  if (skillMds.length > 1) return fail(`The archive contains ${skillMds.length} Skills (${skillMds.map((s) => s.name).join(', ')}). Import one Skill per ZIP.`);
  const skillFile = skillMds[0]!;
  const root = skillFile.name.slice(0, skillFile.name.length - 'SKILL.md'.length);

  // 2. classify every entry BEFORE decompressing anything
  let declaredTotal = 0;
  const textual: { entry: JSZip.JSZipObject; rel: string }[] = [];
  for (const e of files) {
    const { raw, packed } = sizesOf(e);
    const bytes = raw ?? 0;
    if (OS_JUNK.test(e.name)) { note(e.name, bytes, 'skipped', 'Operating-system metadata'); continue; }
    if (e === skillFile) {
      if (raw !== null && raw > IMPORT_LIMITS.fileBytes) return fail(`SKILL.md is ${raw} bytes; the limit is ${IMPORT_LIMITS.fileBytes}.`, entries);
      declaredTotal += bytes;
      continue;
    }
    const perm = (e as unknown as { unixPermissions?: number | string | null }).unixPermissions;
    if (typeof perm === 'number' && (perm & 0o170000) === 0o120000) { note(e.name, bytes, 'rejected', 'Symbolic link: links are never followed or created'); continue; }
    if (!e.name.startsWith(root)) { note(e.name, bytes, 'rejected', 'Outside the Skill folder'); continue; }
    const rel = e.name.slice(root.length);
    const pc = validateResourcePath(rel);
    if (!pc.ok) {
      // unsupported extensions are skipped (not an error); everything else about the path is rejected
      note(e.name, bytes, /Only text files are supported/.test(pc.reason ?? '') ? 'skipped' : 'rejected', pc.reason ?? 'Unsafe path');
      continue;
    }
    if (raw === null) { note(e.name, 0, 'rejected', 'The archive does not declare this file\'s size'); continue; }
    if (raw > IMPORT_LIMITS.fileBytes) { note(e.name, raw, 'rejected', `Larger than ${IMPORT_LIMITS.fileBytes} bytes`); continue; }
    if (packed !== null && packed > 0 && raw / packed > IMPORT_LIMITS.maxRatio) { note(e.name, raw, 'rejected', 'Suspicious compression ratio (possible zip bomb)'); continue; }
    declaredTotal += raw;
    textual.push({ entry: e, rel });
  }
  if (declaredTotal > IMPORT_LIMITS.totalBytes) return fail(`The files add up to ${(declaredTotal / 1e6).toFixed(1)} MB uncompressed; the limit is ${IMPORT_LIMITS.totalBytes / 1e6} MB.`, entries);

  // 3. decode as strict UTF-8 text (never as code)
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const decode = async (e: JSZip.JSZipObject): Promise<string | null> => {
    try {
      const text = decoder.decode(await e.async('uint8array'));
      return text.includes('\u0000') ? null : text;
    } catch {
      return null;
    }
  };
  const skillText = await decode(skillFile);
  if (skillText === null) return fail('SKILL.md is not valid UTF-8 text.', entries);
  note(skillFile.name, sizesOf(skillFile).raw ?? skillText.length, 'skill-md', 'Parsed as data (YAML core schema, no anchors)');

  const resources: { path: string; content: string }[] = [];
  const findings: Finding[] = [];
  for (const { entry, rel } of textual) {
    const text = await decode(entry);
    const bytes = sizesOf(entry).raw ?? 0;
    if (text === null) { note(entry.name, bytes, 'skipped', 'Not valid UTF-8 text (binary files are never imported)'); continue; }
    if (resources.length >= IMPORT_LIMITS.maxResources) { note(entry.name, bytes, 'skipped', `More than ${IMPORT_LIMITS.maxResources} supporting files`); continue; }
    const script = isScriptPath(rel);
    resources.push({ path: rel, content: text });
    note(entry.name, bytes, script ? 'script' : 'resource', script ? 'Script kept as plain text. Forge never runs it.' : 'Supporting text file');
    findings.push(...scanText(rel, text));
    if (script) findings.push(f('import-script', 'info', 'safety', `${rel} is a script. It was imported as inert text; read it before you ever run it yourself.`));
  }

  // 4. SKILL.md -> draft content, with the same lint every pasted SKILL.md gets
  const { content, ignored, findings: mapFindings } = contentFromSkillMd(skillText);
  findings.unshift(...lintSkillMd(skillText).findings.filter((x) => !mapFindings.some((m) => m.id === x.id && m.message === x.message)), ...mapFindings);
  if (!content) return { ok: false, fatal: 'SKILL.md could not be turned into a draft (see the findings).', root, content: null, entries, findings: dedupe(findings), ignoredFields: [] };
  if (ignored.length) findings.push(f('import-ignored-fields', 'warning', 'portability', `Frontmatter fields Forge does not model were NOT carried over: ${ignored.join(', ')}.`, 'They are not lost from your ZIP - add them by hand after export if you need them.'));
  const rejected = entries.filter((e) => e.disposition === 'rejected').length;
  if (rejected) findings.push(f('import-rejected', 'warning', 'safety', `${rejected} file(s) were refused for safety reasons and are not in the draft (see the file list).`));
  const withResources = SkillContentSchema.safeParse({ ...content, references: resources });
  if (!withResources.success) return fail('The supporting files could not be stored in a draft.', entries);
  return { ok: true, fatal: null, root, content: withResources.data, entries, findings: dedupe(findings), ignoredFields: ignored };
}

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((x) => { const k = `${x.id}|${x.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
