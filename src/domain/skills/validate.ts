import { parseDocument } from 'yaml';
import type { Resource, SkillContent } from './model';
import { generateSkillMd, normalizeText } from './generate';
import { isScriptPath, isValidSkillName, validateResourcePath } from './paths';
import {
  BODY_LINE_ADVICE,
  CLAUDE_CODE_FIELDS,
  COMPATIBILITY_MAX,
  KNOWN_FIELDS,
  LISTING_CAP,
  PORTABLE_DESCRIPTION_MAX,
} from './fields';

export type Severity = 'error' | 'warning' | 'info';
export type Area = 'structure' | 'metadata' | 'description' | 'resources' | 'safety' | 'portability' | 'design';

export interface Finding {
  id: string;
  severity: Severity;
  area: Area;
  message: string;
  fix?: string;
}

const f = (id: string, severity: Severity, area: Area, message: string, fix?: string): Finding => ({ id, severity, area, message, fix });

export interface ParsedSkillMd {
  frontmatter: Record<string, unknown> | null;
  frontmatterRaw: string | null;
  body: string;
  findings: Finding[];
}

/** Parse SKILL.md text without evaluating anything: YAML core schema, bounded aliases, unique keys. */
export function parseSkillMd(textIn: string): ParsedSkillMd {
  const findings: Finding[] = [];
  if (textIn.startsWith('\uFEFF')) findings.push(f('bom', 'warning', 'structure', 'File starts with a byte-order mark.', 'Save as UTF-8 without BOM.'));
  const text = normalizeText(textIn);
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!text.startsWith('---\n') && text.trim().startsWith('---')) {
    findings.push(f('fm-not-first-line', 'error', 'structure', 'The opening "---" must be on the very first line of SKILL.md.', 'Remove blank lines or text above the frontmatter.'));
    return { frontmatter: null, frontmatterRaw: null, body: text, findings };
  }
  if (!text.startsWith('---')) {
    findings.push(f('fm-missing', 'error', 'structure', 'SKILL.md has no YAML frontmatter.', 'Start the file with "---", then name/description, then a closing "---".'));
    return { frontmatter: null, frontmatterRaw: null, body: text, findings };
  }
  if (!m) {
    findings.push(f('fm-unterminated', 'error', 'structure', 'The frontmatter is never closed with a second "---" line.', 'Add a line containing only "---" after the metadata.'));
    return { frontmatter: null, frontmatterRaw: null, body: '', findings };
  }
  const raw = m[1] ?? '';
  const body = text.slice(m[0].length);
  const doc = parseDocument(raw, { schema: 'core', uniqueKeys: true, prettyErrors: true });
  if (doc.errors.length > 0) {
    for (const e of doc.errors) findings.push(f('fm-yaml-invalid', 'error', 'structure', `Invalid YAML in frontmatter: ${e.message.split('\n')[0]}`, 'Quote values that contain ":" or "#", and keep indentation consistent.'));
    return { frontmatter: null, frontmatterRaw: raw, body, findings };
  }
  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: 10 });
  } catch (e) {
    findings.push(f('fm-yaml-invalid', 'error', 'structure', `Frontmatter could not be read safely: ${(e as Error).message}`, 'Remove YAML anchors/aliases (&name / *name); Skills do not need them.'));
    return { frontmatter: null, frontmatterRaw: raw, body, findings };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    findings.push(f('fm-not-mapping', 'error', 'structure', 'Frontmatter must be a YAML mapping of "key: value" lines.'));
    return { frontmatter: null, frontmatterRaw: raw, body, findings };
  }
  return { frontmatter: data as Record<string, unknown>, frontmatterRaw: raw, body, findings };
}

/* ----------------------------- safety patterns ----------------------------- */

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, label: 'an Anthropic API key' },
  { re: /\bghp_[A-Za-z0-9]{30,}/, label: 'a GitHub personal access token' },
  { re: /\bgithub_pat_[A-Za-z0-9_]{30,}/, label: 'a GitHub fine-grained token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'an AWS access key ID' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, label: 'a Slack token' },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, label: 'a private key' },
  { re: /\b(?:api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["']?[A-Za-z0-9_\-/+]{16,}/i, label: 'a hard-coded credential' },
];

const SUSPICIOUS: { re: RegExp; id: string; message: string }[] = [
  { re: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/i, id: 'safety-pipe-shell', message: 'Downloads and pipes a remote script straight into a shell.' },
  { re: /\brm\s+-[a-z]*r[a-z]*f?\b|\brm\s+-rf\b/i, id: 'safety-destructive', message: 'Contains a recursive delete (rm -rf).' },
  { re: /\bgit\s+push\b[^\n]*--force|\bgit\s+reset\s+--hard\b|\bdrop\s+table\b|\bchmod\s+(?:-R\s+)?777\b/i, id: 'safety-destructive', message: 'Contains a destructive or permission-widening command.' },
  { re: /\bsudo\b/i, id: 'safety-sudo', message: 'Uses sudo (privilege escalation).' },
  { re: /\bbase64\s+(?:-d|--decode)\b|\beval\s*\(|\bexec\s*\(|\bFunction\s*\(\s*["'`]/i, id: 'safety-eval', message: 'Decodes or evaluates dynamic code (base64 -d / eval / exec).' },
  { re: /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+(?:instructions|rules|messages)|disregard\s+(?:the\s+)?(?:system|previous)\s+(?:prompt|instructions)/i, id: 'safety-injection', message: 'Contains an instruction-override phrase typical of prompt injection.' },
  { re: /(?:do\s+not|don'?t|never)\s+(?:tell|inform|mention|show|reveal)\s+(?:this\s+to\s+)?the\s+user|without\s+(?:asking|telling|informing|confirmation)|\bsilently\b|\bhide\s+(?:this|the)\b/i, id: 'safety-secrecy', message: 'Asks Claude to act without the user\'s knowledge or approval.' },
  { re: /~\/\.ssh|\.aws\/credentials|\.env\b|\.npmrc|\.netrc|\.pypirc|\.git-credentials|\bprintenv\b|\bid_rsa\b|\/etc\/passwd|keychain/i, id: 'safety-credential-paths', message: 'Reads credential-like locations (ssh keys, .env, .npmrc, cloud credentials).' },
  { re: /<!--[\s\S]{0,400}?(?:\brun\b|execute|curl|wget|ignore|\balso\b|\bsend\b|upload|assistant|claude)[\s\S]{0,400}?-->/i, id: 'safety-hidden-comment', message: 'An HTML comment contains instructions - invisible in rendered Markdown but readable by Claude.' },
  { re: /\b(?:curl|wget|Invoke-WebRequest|fetch)\b[^\n]*(?:-d\s|--data|--upload-file|-F\s|POST)/i, id: 'safety-exfil', message: 'Sends data to a remote endpoint.' },
];

// zero-width, bidi controls and tag characters: used to hide text from human reviewers.
const HIDDEN_UNICODE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\uDB40[\uDC00-\uDC7F]/;

export function scanText(label: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const s of SECRET_PATTERNS) {
    if (s.re.test(text)) out.push(f('safety-secret', 'error', 'safety', `${label}: looks like it contains ${s.label}.`, 'Remove it and rotate the credential. Skills are shared as plain text.'));
  }
  const seen = new Set<string>();
  for (const s of SUSPICIOUS) {
    if (s.re.test(text) && !seen.has(s.id + s.message)) {
      seen.add(s.id + s.message);
      out.push(f(s.id, 'warning', 'safety', `${label}: ${s.message}`, 'Advisory only. Confirm this is intentional and explain it in the instructions.'));
    }
  }
  if (HIDDEN_UNICODE.test(text)) out.push(f('safety-hidden-unicode', 'warning', 'safety', `${label}: contains invisible or bidirectional Unicode characters.`, 'Remove them; they can hide instructions from reviewers.'));
  return out;
}

/* ------------------------------ description checks ------------------------------ */

const VAGUE = /\b(?:helps?|various|stuff|things?|etc\.?|misc(?:ellaneous)?|general(?:ly)?|useful|handles?)\b/i;
const TRIGGER_CUE = /\b(?:use\s+(?:this\s+)?(?:skill\s+)?(?:when|for|to)|when\s+(?:the\s+user|you|asked|someone)|trigger(?:s|ed)?\s+(?:on|when)|invoke\s+when|use\s+if|for\s+(?:requests|tasks)\s+(?:like|about))\b/i;
const NEGATIVE_CUE = /\b(?:do\s+not\s+use|don'?t\s+use|not\s+for|not\s+intended\s+for|skip\s+(?:this|when)|avoid\s+for|use\s+(?:something\s+else|another))\b/i;
const FIRST_SECOND_PERSON = /\b(?:I\s+(?:can|will|help)|I'm|my\s|you\s+can|you\s+will|your\s)\b/i;

function descriptionFindings(description: string, whenToUse: string, fm: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  const d = description.trim();
  const combined = `${d} ${whenToUse}`.trim();
  if (d.length > 0 && d.length < 50) out.push(f('desc-short', 'warning', 'description', `Description is only ${d.length} characters; Claude has little to match against.`, 'Say what the Skill does AND when to use it, with the words a user would really type.'));
  if (d.length > 0 && !TRIGGER_CUE.test(combined)) out.push(f('desc-no-trigger', 'warning', 'description', 'No "use when…" trigger phrase found. Claude decides whether to load a Skill from its description.', 'Add a sentence such as "Use when the user asks to … or mentions …".'));
  // Judge vagueness on what the Skill claims to do, not on the "Not for …" exclusion clause.
  const claim = d.split(/\b(?:do\s+not\s+use|don'?t\s+use|not\s+for|not\s+intended\s+for)\b/i)[0] ?? d;
  if (VAGUE.test(claim)) out.push(f('desc-vague', 'warning', 'description', 'Description contains vague words (helps, various, stuff, handles…).', 'Replace them with concrete verbs, file types and symptoms.'));
  if (FIRST_SECOND_PERSON.test(d)) out.push(f('desc-person', 'warning', 'description', 'Description uses first or second person ("I can", "you can").', 'Write it in the third person: "Debugs …. Use when …".'));
  if (d.length > 0 && !NEGATIVE_CUE.test(combined)) out.push(f('desc-no-negative', 'info', 'description', 'No "do not use for…" boundary. Skills that overlap with other tasks tend to over-trigger.', 'Add a short exclusion, e.g. "Not for general refactoring."'));
  if (/[<>]/.test(d)) out.push(f('desc-angle-brackets', 'warning', 'description', 'Angle brackets in the description are displayed as &lt; and &gt; by Claude Code.', 'Use [square brackets] for placeholders.'));
  if (fm['disable-model-invocation'] === true && /\b(?:automatically|proactively|whenever)\b/i.test(d)) out.push(f('desc-contradicts-invocation', 'warning', 'description', 'Description promises automatic use, but model invocation is disabled.', 'Either allow model invocation or describe it as a manual /command.'));
  return out;
}

/* ------------------------------- contradictions ------------------------------- */

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'any', 'all', 'it', 'this', 'that', 'is', 'be', 'you', 'your', 'when', 'before', 'after']);

function contentTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t) && t.length > 2);
}

export function findContradictions(body: string): { always: string; never: string }[] {
  const always: string[] = [];
  const never: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.replace(/^[\s>*\-\d.]+/, '').trim();
    const a = /\b(?:always|must)\s+(?!not\b)(.{6,80}?)(?:[.;:!]|$)/i.exec(line);
    if (a?.[1]) always.push(a[1]);
    const n = /\b(?:never|must\s+not|do\s+not|don'?t)\s+(.{6,80}?)(?:[.;:!]|$)/i.exec(line);
    if (n?.[1]) never.push(n[1]);
  }
  const out: { always: string; never: string }[] = [];
  for (const a of always) {
    const ta = new Set(contentTokens(a));
    if (ta.size < 2) continue;
    for (const n of never) {
      const tn = contentTokens(n);
      if (tn.length < 2) continue;
      const overlap = tn.filter((t) => ta.has(t)).length;
      if (overlap >= Math.min(2, tn.length) && overlap / Math.max(ta.size, tn.length) >= 0.5) out.push({ always: a.trim(), never: n.trim() });
    }
  }
  return out.slice(0, 3);
}

/* ------------------------------ resource references ------------------------------ */

const EXT = 'md|txt|json|yaml|yml|csv|toml|py|js|mjs|ts|sh';
const LINK_RE = /\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
const TOKEN_RE = new RegExp(`(?:\\$\\{CLAUDE_SKILL_DIR\\}/)?((?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\\.(?:${EXT}))\\b`, 'g');

export interface RefInfo {
  path: string;
  explicit: boolean;
}

export function extractReferences(body: string): RefInfo[] {
  const refs = new Map<string, RefInfo>();
  for (const m of body.matchAll(LINK_RE)) {
    const target = m[1] ?? '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const clean = target.replace(/^\.\//, '').replace(/^\$\{CLAUDE_SKILL_DIR\}\//, '');
    if (new RegExp(`\\.(?:${EXT})$`, 'i').test(clean)) refs.set(clean, { path: clean, explicit: true });
  }
  for (const m of body.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([A-Za-z0-9_./-]+)/g)) {
    const p = m[1] ?? '';
    if (p) refs.set(p, { path: p, explicit: true });
  }
  for (const m of body.matchAll(TOKEN_RE)) {
    const p = m[1] ?? '';
    if (!p || /^https?:/i.test(p) || refs.has(p)) continue;
    if (/^(?:skill|readme|package|tsconfig|claude|agents)\.(?:md|json)$/i.test(p)) continue;
    // plain mentions only count when they live in a skill-looking subfolder
    if (/^(?:references?|scripts?|assets?|examples?|templates?|docs?)\//i.test(p)) refs.set(p, { path: p, explicit: false });
  }
  refs.delete('SKILL.md');
  return [...refs.values()];
}

/* ------------------------------------ lint ------------------------------------ */

export interface LintOptions {
  resources?: Resource[];
}

export function lintSkillMd(markdown: string, opts: LintOptions = {}): { findings: Finding[]; parsed: ParsedSkillMd } {
  const resources = opts.resources ?? [];
  const parsed = parseSkillMd(markdown);
  const out: Finding[] = [...parsed.findings];
  const fm = parsed.frontmatter;

  if (fm) {
    const name = fm.name;
    if (name === undefined || name === null || String(name).trim() === '') {
      out.push(f('name-missing', 'error', 'metadata', 'Missing "name". Claude Code falls back to the folder name, but the portable Agent Skills format requires it.', 'Add a lowercase-hyphenated name such as "merge-chain-debugger".'));
    } else if (typeof name !== 'string' || !isValidSkillName(name)) {
      out.push(f('name-format', 'error', 'metadata', `Name "${String(name)}" is invalid. Use 1-64 lowercase letters/digits separated by single hyphens (no spaces, capitals, underscores, leading/trailing/double hyphens).`, 'Try: ' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)));
    } else if (/anthropic|claude/i.test(name)) {
      out.push(f('name-reserved', 'warning', 'metadata', 'Names containing "anthropic" or "claude" are reserved on some surfaces (claude.ai / API authoring guidance). Claude Code docs reserve the "anthropic-skills" prefix.', 'Pick a name that does not include those words.'));
    }

    const desc = fm.description;
    const descStr = typeof desc === 'string' ? desc : '';
    if (desc === undefined || desc === null || descStr.trim() === '') {
      out.push(f('description-missing', 'error', 'metadata', 'Missing "description". It is how Claude decides when to load the Skill.', 'Write one or two sentences: what it does and when to use it.'));
    } else if (typeof desc !== 'string') {
      out.push(f('description-type', 'error', 'metadata', 'Description must be a string.'));
    }
    const whenToUse = typeof fm.when_to_use === 'string' ? fm.when_to_use : '';
    if (descStr.length > PORTABLE_DESCRIPTION_MAX && descStr.length + whenToUse.length <= LISTING_CAP)
      out.push(f('desc-over-portable', 'warning', 'portability', `Description is ${descStr.length} characters; the portable Agent Skills limit is ${PORTABLE_DESCRIPTION_MAX} (fine for Claude Code only).`, 'Shorten it if you plan to upload to claude.ai or the API.'));
    if (descStr.length + whenToUse.length > LISTING_CAP)
      out.push(f('desc-over-listing', 'error', 'metadata', `description + when_to_use is ${descStr.length + whenToUse.length} characters; Claude Code truncates the skill listing at ${LISTING_CAP}.`, 'Put the key use case first and trim the rest into the body.'));
    out.push(...descriptionFindings(descStr, whenToUse, fm));

    if (typeof fm.compatibility === 'string' && fm.compatibility.length > COMPATIBILITY_MAX)
      out.push(f('compat-too-long', 'error', 'metadata', `"compatibility" is ${fm.compatibility.length} characters; the limit is ${COMPATIBILITY_MAX}.`));
    if (fm.metadata !== undefined) {
      const md = fm.metadata;
      if (md === null || typeof md !== 'object' || Array.isArray(md) || Object.values(md as object).some((v) => typeof v !== 'string'))
        out.push(f('metadata-shape', 'warning', 'metadata', '"metadata" should be a map of string keys to string values.', 'Quote numbers, e.g. version: "1.0".'));
    }
    for (const bf of ['disable-model-invocation', 'user-invocable', 'background']) {
      const v = fm[bf];
      if (v !== undefined && typeof v !== 'boolean') out.push(f('bool-field-type', 'info', 'metadata', `"${bf}" is not a YAML boolean (${JSON.stringify(v)}). Claude Code accepts yes/no/on/off/1/0, but other tools may not.`, 'Use true or false.'));
    }
    if (fm['disable-model-invocation'] === true && fm['user-invocable'] === false)
      out.push(f('invocation-unreachable', 'error', 'metadata', 'Both disable-model-invocation: true and user-invocable: false are set. Nobody - neither Claude nor you - can invoke this Skill.', 'Remove one of the two.'));
    const tools = typeof fm['allowed-tools'] === 'string' ? fm['allowed-tools'] : Array.isArray(fm['allowed-tools']) ? (fm['allowed-tools'] as unknown[]).join(' ') : '';
    if (/Bash\(\s*(?:curl|wget|nc|ncat|ssh|scp|sftp|ftp)\b/i.test(tools)) out.push(f('allowed-tools-network', 'warning', 'safety', 'allowed-tools pre-approves a network or remote-access command (curl, wget, ssh, ...).', 'Remove it unless the Skill genuinely needs the network, and scope the pattern tightly.'));
    if (/(?:^|[\s,])Bash(?:\(\*\))?(?:$|[\s,])/.test(tools)) out.push(f('allowed-tools-broad', 'warning', 'safety', 'allowed-tools grants unrestricted Bash. Scope it, e.g. Bash(git status *).', 'List only the commands this Skill needs.'));

    const keys = Object.keys(fm);
    const unknown = keys.filter((k) => !KNOWN_FIELDS.includes(k));
    if (unknown.length) out.push(f('unknown-field', 'warning', 'portability', `Unrecognized field(s): ${unknown.join(', ')}. Claude Code ignores unrecognized fields silently, and claude.ai / API uploads reject them.`, 'Check spelling against the frontmatter reference, or move custom data under "metadata".'));
    const cc = keys.filter((k) => (CLAUDE_CODE_FIELDS as readonly string[]).includes(k));
    if (cc.length) out.push(f('claude-code-fields', 'info', 'portability', `Claude Code-specific field(s) used: ${cc.join(', ')}. These work in Claude Code but are rejected by claude.ai uploads and the Skills API.`));
  }

  const body = parsed.body;
  if (parsed.frontmatter && body.trim().length === 0) out.push(f('body-empty', 'error', 'structure', 'The Skill has no instructions after the frontmatter.', 'Add the steps Claude should follow.'));
  const lines = body.split('\n').length;
  if (lines > BODY_LINE_ADVICE) out.push(f('body-long', 'warning', 'structure', `Body is ${lines} lines. Docs recommend keeping SKILL.md under ${BODY_LINE_ADVICE} lines and moving detail into supporting files.`, 'Split reference material into references/*.md and link to it.'));
  for (const c of findContradictions(body)) out.push(f('contra-always-never', 'warning', 'structure', `Possible contradiction: "always/must ${c.always}" vs "never/do not ${c.never}".`, 'Pick one rule or state the exception explicitly.'));

  // resources
  const seenLower = new Map<string, string>();
  for (const r of resources) {
    const check = validateResourcePath(r.path);
    if (!check.ok) out.push(f('res-path-invalid', 'error', 'resources', `Supporting file "${r.path}": ${check.reason}`, 'Rename it to a simple relative path like references/guide.md.'));
    const lower = r.path.toLowerCase();
    if (seenLower.has(lower)) out.push(f('res-duplicate', 'error', 'resources', `Two supporting files resolve to the same path: "${r.path}".`));
    seenLower.set(lower, r.path);
    if (check.ok && isScriptPath(r.path)) out.push(f('res-script-present', 'warning', 'safety', `"${r.path}" is an executable script. Forge exports it as inert text and never runs it; anyone installing the Skill should read it first.`, 'Prefer instructions over scripts unless a script is essential.'));
    out.push(...scanText(`Supporting file "${r.path}"`, r.content));
    if (!r.content.trim()) out.push(f('res-empty', 'warning', 'resources', `Supporting file "${r.path}" is empty.`));
  }
  const have = new Set(resources.map((r) => r.path));
  const refs = extractReferences(body);
  for (const ref of refs) {
    if (ref.path.split('/').includes('..') || ref.path.startsWith('/')) {
      out.push(f('ref-traversal', 'error', 'resources', `The instructions reference "${ref.path}", which points outside the Skill folder.`, 'Reference only files inside the Skill directory.'));
    } else if (!have.has(ref.path)) {
      out.push(f('ref-missing', ref.explicit ? 'error' : 'warning', 'resources', `The instructions reference "${ref.path}" but no such supporting file is included.`, 'Add the file in the Resources tab or remove the reference.'));
    }
  }
  const referenced = new Set(refs.map((r) => r.path));
  for (const r of resources) {
    if (!referenced.has(r.path) && !body.includes(r.path)) out.push(f('ref-unused', 'warning', 'resources', `"${r.path}" is included but never mentioned in the instructions, so Claude will not know it exists.`, 'Link to it from SKILL.md.'));
  }

  out.push(...scanText('SKILL.md', markdown));
  return { findings: dedupe(out), parsed };
}

function dedupe(list: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const x of list) {
    const k = `${x.id}|${x.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function validateSkillContent(c: SkillContent): { findings: Finding[]; markdown: string; errors: number; warnings: number } {
  const markdown = generateSkillMd(c);
  const { findings } = lintSkillMd(markdown, { resources: c.references });
  const extra: Finding[] = [];
  if (!c.name.trim()) extra.push(f('name-missing', 'error', 'metadata', 'Give the Skill a name.'));
  if (!c.instructions.trim()) extra.push(f('instructions-empty', 'error', 'structure', 'Write the instructions Claude should follow.'));
  const all = dedupe([...findings, ...extra]);
  return { findings: all, markdown, errors: all.filter((x) => x.severity === 'error').length, warnings: all.filter((x) => x.severity === 'warning').length };
}

/** Design-readiness checks (scenario completeness etc.). Advisory, kept separate from hard validation. */
export function designChecks(c: SkillContent): Finding[] {
  const out: Finding[] = [];
  const pos = c.scenarios.filter((s) => s.expected === 'activate').length;
  const neg = c.scenarios.filter((s) => s.expected === 'not-activate').length;
  const amb = c.scenarios.filter((s) => s.expected === 'ambiguous').length;
  if (pos < 2) out.push(f('design-pos', 'warning', 'design', `Only ${pos} positive scenario(s). Add at least 2 prompts that SHOULD load this Skill.`));
  if (neg < 2) out.push(f('design-neg', 'warning', 'design', `Only ${neg} negative scenario(s). Add at least 2 prompts that should NOT load it (near-misses are the most useful).`));
  if (amb < 1) out.push(f('design-amb', 'info', 'design', 'No ambiguous scenario. Add one prompt where the right behaviour is debatable, and decide what you want.'));
  if (c.useCases.filter((u) => u.trim()).length < 2) out.push(f('design-use', 'info', 'design', 'List at least 2 concrete use cases.'));
  if (c.nonUseCases.filter((u) => u.trim()).length < 1) out.push(f('design-nonuse', 'info', 'design', 'List at least 1 non-use case.'));
  return out;
}
