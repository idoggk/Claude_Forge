#!/usr/bin/env node
/**
 * Low-cost "living discovery" check. Run by a person (or the optional weekly workflow):
 *
 *   node scripts/check-sources.mjs            # report only
 *   node scripts/check-sources.mjs --write    # also update src/content/sources/last-check.json
 *
 * What it does: sends one GET request per source in src/content/sources/registry.json (one per second, 15 s timeout),
 * and records HTTP status, whether it redirected, and a SHA-256 of the first 2 MB of the response body.
 * What it never does: execute, install, clone, render or follow instructions found in any response; edit the catalog,
 * the registry or any lesson. It only writes status data, and a person reviews the resulting diff before anything
 * in the app changes. A page whose hash changed is a REASON TO RE-READ it, not a finding.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'src/content/sources/registry.json');
const lastPath = join(root, 'src/content/sources/last-check.json');
const write = process.argv.includes('--write');

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
let last = { checks: {} };
try { last = JSON.parse(await readFile(lastPath, 'utf8')); } catch { /* first run */ }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = {};
const changes = [];
for (const s of registry.sources) {
  const rec = { checkedAt: new Date().toISOString().slice(0, 10), httpStatus: null, redirectedTo: null, bodyHash: null, error: null };
  try {
    const res = await fetch(s.url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'claude-forge-source-check (read-only; see scripts/check-sources.mjs)' } });
    rec.httpStatus = res.status;
    if (res.url && res.url !== s.url) rec.redirectedTo = res.url;
    const buf = new Uint8Array(await res.arrayBuffer());
    rec.bodyHash = createHash('sha256').update(buf.subarray(0, 2 * 1024 * 1024)).digest('hex');
  } catch (e) {
    rec.error = String(e?.cause?.code ?? e?.name ?? e).slice(0, 80);
  }
  checks[s.id] = rec;
  const prev = last.checks?.[s.id];
  if (!prev) changes.push(`NEW      ${s.id}: ${rec.httpStatus ?? rec.error}`);
  else if (prev.httpStatus !== rec.httpStatus || prev.error !== rec.error) changes.push(`STATUS   ${s.id}: ${prev.httpStatus ?? prev.error} -> ${rec.httpStatus ?? rec.error}`);
  else if (prev.bodyHash && rec.bodyHash && prev.bodyHash !== rec.bodyHash) changes.push(`CHANGED  ${s.id}: page content differs from the last check - re-read it`);
  if (s.status === 'unreachable' && rec.httpStatus && rec.httpStatus < 400) changes.push(`NOW OK   ${s.id}: registry says unreachable but it answered ${rec.httpStatus} - read it and update the registry`);
  if (s.status === 'read' && (rec.error || (rec.httpStatus && rec.httpStatus >= 400))) changes.push(`BROKEN   ${s.id}: registry says read, but it now returns ${rec.httpStatus ?? rec.error}`);
  await sleep(1000);
}

console.log(changes.length ? changes.join('\n') : 'No changes since the last check.');
if (write) {
  await writeFile(lastPath, JSON.stringify({ format: 'claude-forge-source-check', version: 1, checks }, null, 2) + '\n');
  console.log(`Wrote ${lastPath}`);
}
