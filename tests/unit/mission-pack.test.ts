import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureFiles, fixtureHash, fixtureManifest, getFixture } from '@/fixtures';
import { ALL_PROPOSALS, DEV_PROPOSALS, HELDOUT_PROPOSALS, LIVE_CONFIG, applyPatch } from '@/fixtures/economy/mission';
import { simulate } from '@/fixtures/economy/sim';

async function writePack(id: 'economy-balance-review' | 'economy-balance-heldout'): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), `forge-pack-${id}-`));
  for (const f of await fixtureFiles(id)) {
    mkdirSync(join(dir, f.path, '..'), { recursive: true });
    writeFileSync(join(dir, f.path), f.content);
  }
  return dir;
}

describe('economy mission fixture packs (what the learner runs in Claude Code)', () => {
  let logs: string[] = [];
  const origArgv = process.argv;
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = origArgv;
  });

  it('the pack CLI reproduces exactly what the in-app simulator computes, for every proposal', async () => {
    for (const [pack, list] of [['economy-balance-review', DEV_PROPOSALS], ['economy-balance-heldout', HELDOUT_PROPOSALS]] as const) {
      const dir = await writePack(pack);
      for (const p of list) {
        logs = [];
        process.argv = ['node', 'run.ts', p.id];
        await import(/* @vite-ignore */ pathToFileURL(join(dir, 'run.ts')).href + `?case=${p.id}`);
        const rows = simulate(applyPatch(LIVE_CONFIG, p.patch));
        expect(logs[0], p.id).toContain('affordability');
        expect(logs.length, p.id).toBe(rows.length + 1);
        const stage40 = logs[40]!.split(',');
        expect(Number(stage40[7]), `${p.id} affordability@40`).toBeCloseTo(rows[39]!.affordability, 5);
        expect(Number(stage40[3]), `${p.id} supply@40`).toBe(rows[39]!.supply);
      }
    }
  });

  it('packs never contain ground truth: no verdicts, no evaluation thresholds computed per case', async () => {
    for (const id of ['economy-balance-review', 'economy-balance-heldout'] as const) {
      const files = await fixtureFiles(id);
      const text = files.map((f) => f.content).join('\n');
      expect(text).not.toMatch(/"verdict"|truth|gradedTruth/i);
      const proposals = JSON.parse(files.find((f) => f.path === 'proposals.json')!.content) as Record<string, unknown>[];
      for (const p of proposals) expect(Object.keys(p).sort()).toEqual(['change', 'id', 'patch', 'rationale', 'title']);
      expect(files.some((f) => /reference/i.test(f.path))).toBe(false);
    }
  });

  it('the held-out pack holds only held-out proposals and the dev pack none of them (no leakage)', async () => {
    const dev = JSON.parse((await fixtureFiles('economy-balance-review')).find((f) => f.path === 'proposals.json')!.content) as { id: string }[];
    const held = JSON.parse((await fixtureFiles('economy-balance-heldout')).find((f) => f.path === 'proposals.json')!.content) as { id: string }[];
    expect(dev.map((p) => p.id)).toEqual(DEV_PROPOSALS.map((p) => p.id));
    expect(held.map((p) => p.id)).toEqual(HELDOUT_PROPOSALS.map((p) => p.id));
    expect(dev.some((p) => held.some((h) => h.id === p.id))).toBe(false);
    expect(ALL_PROPOSALS).toHaveLength(7);
  });

  it('manifests and hashes are stable and differ between the two packs; both fixtures are registered with a checklist', async () => {
    const a = await fixtureHash('economy-balance-review');
    const b = await fixtureHash('economy-balance-heldout');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await fixtureHash('economy-balance-review')).toBe(a);
    expect(await fixtureManifest('economy-balance-review')).toContain('proposals.json');
    expect(getFixture('economy-balance-review')!.checklist).toHaveLength(5);
    expect(getFixture('economy-balance-heldout')!.checklist).toHaveLength(5);
  });
});
