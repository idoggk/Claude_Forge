import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_SOURCES, classify, readCapped, sanitize, validateLastCheck, validateSources } from '../../scripts/source-check-lib.mjs';
import { SOURCE_REGISTRY } from '@/content/sources/registry';

const reg = (urls: string[]) => ({ sources: urls.map((url, i) => ({ id: `s${i}`, url })) });

describe('the source checker only fetches curated, public https pages', () => {
  it('accepts the real registry', () => {
    expect(validateSources(JSON.parse(readFileSync('src/content/sources/registry.json', 'utf8'))).ok).toBe(true);
    expect(SOURCE_REGISTRY.length).toBeLessThanOrEqual(MAX_SOURCES);
  });

  it('refuses http, credentials, ports, addresses, private names and unparseable URLs', () => {
    for (const bad of ['http://example.com/', 'https://user:pw@example.com/', 'https://example.com:8443/', 'https://127.0.0.1/', 'https://169.254.169.254/latest/', 'https://localhost/', 'https://printer.local/', 'https://metadata.google.internal/', 'https://intranet/', 'https://[::1]/', 'not a url']) {
      const v = validateSources(reg([bad]));
      expect(v.ok, bad).toBe(false);
    }
    expect(validateSources(reg(['https://docs.example.com/page'])).ok).toBe(true);
  });

  it('refuses a registry larger than the cap and duplicate ids', () => {
    expect(validateSources(reg(Array.from({ length: MAX_SOURCES + 1 }, (_, i) => `https://e${i}.example.com/`))).ok).toBe(false);
    expect(validateSources({ sources: [{ id: 'a', url: 'https://a.example.com/' }, { id: 'a', url: 'https://b.example.com/' }] }).ok).toBe(false);
    expect(validateSources({}).ok).toBe(false);
  });
});

describe('a response is read with a cap and never trusted', () => {
  it('stops reading at the cap, even for an endless body', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { pulled += 1; c.enqueue(new Uint8Array(1024).fill(65)); } });
    const out = await readCapped(new Response(stream), 4096);
    expect(out.length).toBe(4096);
    expect(pulled).toBeLessThan(20);
  });

  it('returns a short body whole and an empty body as empty', async () => {
    expect((await readCapped(new Response('hello'), 1000)).length).toBe(5);
    expect((await readCapped(new Response(null), 1000)).length).toBe(0);
  });

  it('sanitises control characters and bidirectional overrides from anything that reaches a report', () => {
    // eslint-disable-next-line no-control-regex
    expect(sanitize('ok\u0000\u001b[31mred\u202Eevil\nline2')).not.toMatch(/[\u0000-\u001f\u202e]/);
    expect(sanitize('x'.repeat(500), 50).length).toBe(50);
  });
});

describe('status changes are reported for a person to review, never applied', () => {
  const ok = { checkedAt: '2026-11-05', httpStatus: 200, redirectedTo: null, bodyHash: 'a'.repeat(64), error: null };
  it('flags new, changed status, changed content, off-host redirects, newly reachable and newly broken sources', () => {
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, undefined, ok)[0]).toMatch(/^NEW/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, { ...ok, httpStatus: 404 }).join()).toMatch(/STATUS.*200 -> 404/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, { ...ok, bodyHash: 'b'.repeat(64) }).join()).toMatch(/CHANGED.*re-read/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, { ...ok, redirectedTo: 'https://other.example.net/x' }).join()).toMatch(/OFFHOST/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, { ...ok, redirectedTo: 'https://a.example.com/new' }).join()).not.toMatch(/OFFHOST/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'unreachable' }, ok, ok).join()).toMatch(/NOW OK.*read it and update the registry/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, { ...ok, httpStatus: null, bodyHash: null, error: 'ENOTFOUND' }).join()).toMatch(/BROKEN/);
    expect(classify({ id: 'a', url: 'https://a.example.com/', status: 'read' }, ok, ok)).toEqual([]);
  });

  it('the script itself never writes to the registry, the catalog or a lesson', () => {
    const src = readFileSync('scripts/check-sources.mjs', 'utf8');
    const writes = [...src.matchAll(/writeFile\(([^,]+),/g)].map((m) => m[1]!.trim());
    expect(writes).toEqual(['lastPath']);
    expect(src).not.toMatch(/registryPath\s*,\s*JSON/);
    expect(src).not.toMatch(/child_process|exec\(|spawn|eval\(|new Function/);
  });
});

describe('a file handed from the fetching job to the writing job is validated first', () => {
  const registry = { sources: [{ id: 'src-a' }, { id: 'src-b' }] };
  const good = { format: 'claude-forge-source-check', version: 1, checks: { 'src-a': { checkedAt: '2026-11-05', httpStatus: 200, redirectedTo: null, bodyHash: 'c'.repeat(64), error: null } } };
  it('accepts the expected shape', () => expect(validateLastCheck(good, registry).ok).toBe(true));
  it('rejects extra files-as-fields, unknown sources, bad hashes, bad dates and non-https redirects', () => {
    expect(validateLastCheck({ ...good, extra: 'x' }, registry).ok).toBe(false);
    expect(validateLastCheck({ ...good, checks: { 'src-zzz': good.checks['src-a'] } }, registry).ok).toBe(false);
    expect(validateLastCheck({ ...good, checks: { 'src-a': { ...good.checks['src-a'], bodyHash: 'xyz' } } }, registry).ok).toBe(false);
    expect(validateLastCheck({ ...good, checks: { 'src-a': { ...good.checks['src-a'], checkedAt: 'yesterday' } } }, registry).ok).toBe(false);
    expect(validateLastCheck({ ...good, checks: { 'src-a': { ...good.checks['src-a'], redirectedTo: 'javascript:alert(1)' } } }, registry).ok).toBe(false);
    expect(validateLastCheck({ ...good, checks: { 'src-a': { ...good.checks['src-a'], command: 'rm -rf /' } } }, registry).ok).toBe(false);
    expect(validateLastCheck({ format: 'other', version: 1, checks: {} }, registry).ok).toBe(false);
    expect(validateLastCheck(null, registry).ok).toBe(false);
  });
});

describe('the workflow keeps untrusted network content away from write permissions', () => {
  const wf = readFileSync('.github/workflows/source-check.yml', 'utf8');
  it('declares no default permissions, a read-only fetch job and a validated, draft-only proposal job', () => {
    expect(wf).toMatch(/^permissions: \{\}/m);
    const check = wf.slice(wf.indexOf('  check:'), wf.indexOf('  propose:'));
    expect(check).toMatch(/contents: read/);
    expect(check).not.toMatch(/contents: write|pull-requests: write/);
    expect(check).toMatch(/persist-credentials: false/);
    const propose = wf.slice(wf.indexOf('  propose:'));
    expect(propose).toMatch(/--validate out\/last-check\.json/);
    expect(propose).toMatch(/gh pr create --draft/);
    expect(propose.indexOf('--validate')).toBeLessThan(propose.indexOf('gh pr create'));
    expect(wf).not.toMatch(/pull_request_target/);
    expect(wf).not.toMatch(/auto-merge|--auto|gh pr merge/);
  });
});
