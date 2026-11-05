/**
 * Pure helpers for scripts/check-sources.mjs, kept separate so they can be unit-tested without any network access.
 * Nothing in this file performs I/O.
 */

export const MAX_SOURCES = 100;
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const MIN_INTERVAL_MS = 1000;
export const TIMEOUT_MS = 15000;

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Only curated, public https pages may be fetched. A registry entry that points at an address, a private name, a URL with
 * credentials or a custom port is a mistake or an attack on the checker, not a source.
 */
export function validateSources(registry) {
  const problems = [];
  const sources = Array.isArray(registry?.sources) ? registry.sources : [];
  if (!Array.isArray(registry?.sources)) problems.push('The registry has no sources list.');
  if (sources.length > MAX_SOURCES) problems.push(`The registry lists ${sources.length} sources; the checker refuses more than ${MAX_SOURCES} so a single run stays small and polite.`);
  const seen = new Set();
  for (const s of sources.slice(0, MAX_SOURCES)) {
    const id = String(s?.id ?? '(no id)');
    if (seen.has(id)) problems.push(`${id}: duplicate id.`);
    seen.add(id);
    let u;
    try { u = new URL(String(s?.url)); } catch { problems.push(`${id}: not a valid URL.`); continue; }
    if (u.protocol !== 'https:') problems.push(`${id}: must be https.`);
    if (u.username || u.password) problems.push(`${id}: URL must not contain credentials.`);
    if (u.port) problems.push(`${id}: custom ports are not allowed.`);
    if (IPV4.test(u.hostname) || u.hostname.includes(':') || PRIVATE_HOST.test(u.hostname) || !u.hostname.includes('.')) problems.push(`${id}: host must be a public DNS name.`);
  }
  return { ok: problems.length === 0, problems, sources: sources.slice(0, MAX_SOURCES) };
}

/** Strip control characters and cap length so nothing from the network can shape the report or the pull-request text. */
export function sanitize(value, max = 120) {
  // eslint-disable-next-line no-control-regex
  return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Read at most maxBytes of a fetch Response body, then stop reading. Never buffers an unbounded response. */
export async function readCapped(response, maxBytes = MAX_BODY_BYTES) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - total;
    const part = value.length > room ? value.subarray(0, room) : value;
    chunks.push(part);
    total += part.length;
  }
  try { await reader.cancel(); } catch { /* already closed */ }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

/**
 * Decide what, if anything, a person should look at. Returns report lines. It never changes a status: a source
 * moves from unreachable to read only when a person reads it and edits the registry.
 */
export function classify(source, prev, rec) {
  const out = [];
  const now = rec.httpStatus ?? rec.error;
  if (!prev) out.push(`NEW      ${source.id}: ${now}`);
  else if (prev.httpStatus !== rec.httpStatus || prev.error !== rec.error) out.push(`STATUS   ${source.id}: ${prev.httpStatus ?? prev.error} -> ${now}`);
  else if (prev.bodyHash && rec.bodyHash && prev.bodyHash !== rec.bodyHash) out.push(`CHANGED  ${source.id}: page content differs from the last check - re-read it`);
  if (rec.redirectedTo && hostOf(rec.redirectedTo) !== hostOf(source.url)) out.push(`OFFHOST  ${source.id}: redirects to a different host (${sanitize(hostOf(rec.redirectedTo), 80)}) - decide whether to trust and allow it`);
  if (source.status === 'unreachable' && rec.httpStatus && rec.httpStatus < 400) out.push(`NOW OK   ${source.id}: registry says unreachable but it answered ${rec.httpStatus} - read it and update the registry`);
  if (source.status === 'read' && (rec.error || (rec.httpStatus && rec.httpStatus >= 400))) out.push(`BROKEN   ${source.id}: registry says read, but it now returns ${now}`);
  return out;
}

/** A downloaded last-check file is only accepted if it has exactly the expected shape: it came from another job. */
export function validateLastCheck(data, registry) {
  const problems = [];
  if (!data || typeof data !== 'object' || data.format !== 'claude-forge-source-check' || data.version !== 1) return { ok: false, problems: ['Unexpected format.'] };
  const ids = new Set((registry?.sources ?? []).map((s) => s.id));
  const keys = Object.keys(data).filter((k) => !['format', 'version', 'checks'].includes(k));
  if (keys.length) problems.push(`Unexpected top-level keys: ${keys.join(', ')}.`);
  if (!data.checks || typeof data.checks !== 'object' || Array.isArray(data.checks)) return { ok: false, problems: [...problems, 'No checks object.'] };
  for (const [id, c] of Object.entries(data.checks)) {
    if (!ids.has(id)) problems.push(`${sanitize(id, 40)}: not a registry source.`);
    const extra = Object.keys(c ?? {}).filter((k) => !['checkedAt', 'httpStatus', 'redirectedTo', 'bodyHash', 'error'].includes(k));
    if (extra.length) problems.push(`${sanitize(id, 40)}: unexpected fields ${extra.join(', ')}.`);
    if (c?.httpStatus != null && !(Number.isInteger(c.httpStatus) && c.httpStatus >= 100 && c.httpStatus <= 599)) problems.push(`${sanitize(id, 40)}: bad status.`);
    if (c?.bodyHash != null && !/^[0-9a-f]{64}$/.test(c.bodyHash)) problems.push(`${sanitize(id, 40)}: bad hash.`);
    if (typeof c?.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt)) problems.push(`${sanitize(id, 40)}: bad date.`);
    if (c?.redirectedTo != null && (typeof c.redirectedTo !== 'string' || !c.redirectedTo.startsWith('https://') || c.redirectedTo.length > 500)) problems.push(`${sanitize(id, 40)}: bad redirect.`);
  }
  return { ok: problems.length === 0, problems };
}
