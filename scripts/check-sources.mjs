#!/usr/bin/env node
/**
 * Low-cost "living discovery" check. Run by a person (or the optional weekly workflow):
 *
 *   node scripts/check-sources.mjs                         # report only
 *   node scripts/check-sources.mjs --write                 # also update src/content/sources/last-check.json
 *   node scripts/check-sources.mjs --validate <file>       # check that a last-check file has exactly the expected shape
 *
 * What it does: sends one GET request per curated source in src/content/sources/registry.json (one per second, 15 s
 * timeout, at most 100 sources), reads at most 2 MB of each response, and records HTTP status, whether it redirected, and
 * a SHA-256 of what it read.
 * What it never does: execute, install, clone, render or follow instructions found in any response; fetch anything that is
 * not in the registry; edit the catalog, the registry or any lesson. It only writes status data, and a person reviews the
 * resulting diff before anything in the app changes. A page whose hash changed is a REASON TO RE-READ it, not a finding.
 * A source never changes from "unreachable" to "read" by itself.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MIN_INTERVAL_MS, TIMEOUT_MS, classify, readCapped, sanitize, validateLastCheck, validateSources } from './source-check-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'src/content/sources/registry.json');
const lastPath = join(root, 'src/content/sources/last-check.json');
const write = process.argv.includes('--write');
const vIdx = process.argv.indexOf('--validate');

const registry = JSON.parse(await readFile(registryPath, 'utf8'));

if (vIdx !== -1) {
  const file = process.argv[vIdx + 1];
  if (!file) { console.error('--validate needs a file path.'); process.exit(2); }
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); } catch { console.error('Not valid JSON.'); process.exit(1); }
  const v = validateLastCheck(data, registry);
  if (!v.ok) { console.error(`Rejected:\n- ${v.problems.join('\n- ')}`); process.exit(1); }
  console.log('Shape is as expected.');
  process.exit(0);
}

const v = validateSources(registry);
if (!v.ok) { console.error(`The registry is not safe to check:\n- ${v.problems.join('\n- ')}`); process.exit(1); }

let last = { checks: {} };
try { last = JSON.parse(await readFile(lastPath, 'utf8')); } catch { /* first run */ }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = {};
const changes = [];
for (const s of v.sources) {
  const rec = { checkedAt: new Date().toISOString().slice(0, 10), httpStatus: null, redirectedTo: null, bodyHash: null, error: null };
  try {
    const res = await fetch(s.url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'claude-forge-source-check (read-only; see scripts/check-sources.mjs)' } });
    rec.httpStatus = res.status;
    if (res.url && res.url !== s.url) rec.redirectedTo = res.url.slice(0, 500);
    const buf = await readCapped(res);
    rec.bodyHash = createHash('sha256').update(buf).digest('hex');
  } catch (e) {
    rec.error = sanitize(e?.cause?.code ?? e?.name ?? e, 80);
  }
  checks[s.id] = rec;
  changes.push(...classify(s, last.checks?.[s.id], rec));
  await sleep(MIN_INTERVAL_MS);
}

console.log(changes.length ? changes.join('\n') : 'No changes since the last check.');
if (write) {
  await writeFile(lastPath, JSON.stringify({ format: 'claude-forge-source-check', version: 1, checks }, null, 2) + '\n');
  console.log(`Wrote ${lastPath}`);
}
