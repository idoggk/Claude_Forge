/**
 * Secret-pattern warnings for text a learner is about to store. This is a safety net, not a guarantee: it looks for the
 * shapes of common credentials and cannot know what is secret to you. Scanning is line based with a capped line length and
 * no nested quantifiers, so hostile input cannot make it slow.
 */
export interface SecretFinding {
  kind: string;
  label: string;
  /** 1-based line number. */
  line: number;
  /** A masked preview: at most the first four characters, never the secret. */
  preview: string;
}

const LINE_CAP = 4000;
const MAX_FINDINGS = 200;
const MAX_KEY_BLOCK_LINES = 120;

interface Pattern { kind: string; label: string; re: RegExp }

// Each regex is global, anchored on a literal prefix and uses bounded repetition.
const PATTERNS: Pattern[] = [
  { kind: 'aws-key', label: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'github-token', label: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g },
  { kind: 'github-token', label: 'GitHub token', re: /\bgithub_pat_[A-Za-z0-9_]{40,255}\b/g },
  { kind: 'api-key', label: 'API key (sk- prefix)', re: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,255}/g },
  { kind: 'slack-token', label: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,255}/g },
  { kind: 'google-key', label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'jwt', label: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{8,500}\.[A-Za-z0-9_-]{8,500}\.[A-Za-z0-9_-]{8,500}/g },
  { kind: 'bearer', label: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,500}=*/g },
  { kind: 'url-credentials', label: 'Credentials inside a URL', re: /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@/]{1,64}:[^\s@/]{3,128}@[^\s/]{1,200}/gi },
  { kind: 'assignment', label: 'A password, secret or token being assigned', re: /(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)["']?\s{0,3}[:=]\s{0,3}["']?[^\s"',;]{8,200}/gi },
];

const KEY_HEADER = /-----BEGIN (?:[A-Z]{2,12} ){0,3}PRIVATE KEY-----/;
const KEY_FOOTER = /-----END (?:[A-Z]{2,12} ){0,3}PRIVATE KEY-----/;

const mask = (s: string) => `${s.slice(0, Math.min(4, Math.max(0, s.length - 8)))}…(${s.length} characters)`;

/** Find likely secrets. Returns at most 200 findings and never includes a full secret. */
export function scanSecrets(text: string): SecretFinding[] {
  const out: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  let inKey = 0;
  for (let i = 0; i < lines.length && out.length < MAX_FINDINGS; i++) {
    const line = lines[i]!.slice(0, LINE_CAP);
    if (inKey > 0) {
      inKey--;
      if (KEY_FOOTER.test(line)) inKey = 0;
      continue;
    }
    if (KEY_HEADER.test(line)) {
      out.push({ kind: 'private-key', label: 'Private key block', line: i + 1, preview: '-----BEGIN … PRIVATE KEY-----' });
      inKey = MAX_KEY_BLOCK_LINES;
      continue;
    }
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      let guard = 0;
      while ((m = p.re.exec(line)) && guard++ < 20) {
        out.push({ kind: p.kind, label: p.label, line: i + 1, preview: mask(m[0]) });
        if (m[0].length === 0) p.re.lastIndex++;
      }
    }
  }
  return out;
}

/** Replace every finding with a marker. Same scanning rules as scanSecrets. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  const lines = text.split(/\r?\n/);
  let inKey = 0;
  const out = lines.map((raw) => {
    if (inKey > 0) {
      inKey--;
      if (KEY_FOOTER.test(raw)) inKey = 0;
      return '[REDACTED:private-key]';
    }
    if (KEY_HEADER.test(raw)) { count++; inKey = MAX_KEY_BLOCK_LINES; return '[REDACTED:private-key]'; }
    let line = raw.length > LINE_CAP ? raw.slice(0, LINE_CAP) + ` [line cut at ${LINE_CAP} characters]` : raw;
    for (const p of PATTERNS) {
      p.re.lastIndex = 0;
      line = line.replace(p.re, () => { count++; return `[REDACTED:${p.kind}]`; });
    }
    return line;
  });
  return { text: out.join('\n'), count };
}
