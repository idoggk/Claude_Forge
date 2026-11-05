import { describe, expect, it } from 'vitest';
import { fixtureFiles, fixtureHash, getFixture } from '@/fixtures';
import { ALL_PACKETS, DEV_PACKETS, HELDOUT_PACKETS, POLICY_RULES, taskPrompt, truthFor } from '@/fixtures/integration/mission';
import { audit } from '@/fixtures/integration/policy';
import { INTEGRATION_AUDITOR_MISSION as M } from '@/content/missions/integration-auditor';
import { freezeRequirements } from '@/domain/loop/engine';
import { contentOf, SkillDraftSchema } from '@/domain/skills/model';
import { validateSkillContent } from '@/domain/skills/validate';

describe('Multi-Agent Integration Auditor: ground truth', () => {
  it('applies the published policy to each packet', () => {
    const expected: Record<string, [string, string[]]> = {
      'int-1': ['merge', []],
      'int-2': ['block', ['B1-required-gate']],
      'int-3': ['block', ['B2-stale-overlap']],
      'int-4': ['revise', ['R1-lint', 'R2-open-minor', 'R3-changelog']],
      'int-5': ['block', ['B3-unsupported-perf-claim']],
      'int-6': ['merge', []],
      'int-7': ['block', ['B4-replay-missing']],
    };
    for (const p of ALL_PACKETS) {
      const a = audit(p);
      const [verdict, rules] = expected[p.id]!;
      expect(a.decision, p.id).toBe(verdict);
      expect(a.findings.map((f) => f.rule), p.id).toEqual(rules);
      for (const f of a.findings) expect(POLICY_RULES[f.rule], f.rule).toBeDefined();
      expect(truthFor(p.id)!.verdict).toBe(verdict);
    }
  });

  it('the set is spread: dev covers all three outcomes; held-out has rules dev never used and a false alarm', () => {
    expect(new Set(DEV_PACKETS.map((p) => audit(p).decision))).toEqual(new Set(['merge', 'revise', 'block']));
    const rules = (list: typeof DEV_PACKETS) => new Set(list.flatMap((p) => audit(p).findings.map((f) => f.rule)));
    const heldOnly = [...rules(HELDOUT_PACKETS)].filter((r) => !rules(DEV_PACKETS).has(r));
    expect(heldOnly.length).toBeGreaterThanOrEqual(2);
    // false alarm: behind main, no overlapping files -> merge
    const fa = HELDOUT_PACKETS.find((p) => p.id === 'int-6')!;
    expect(fa.branch.builtOn).not.toBe(fa.branch.mainHead);
    expect(fa.branch.changed.filter((f) => fa.branch.mainChangedSince.includes(f))).toEqual([]);
    expect(audit(fa).decision).toBe('merge');
  });

  it('traps are real: green-but-stale, skipped-not-failed, "all green" with zero tests run, unsupported perf claim', () => {
    const by = (id: string) => ALL_PACKETS.find((p) => p.id === id)!;
    expect(by('int-3').gates.tests.status).toBe('passed'); // CI is green yet it blocks
    expect(by('int-2').gates.tests.status).toBe('skipped');
    expect(by('int-2').gates.tests.ran).toBe(0);
    expect(by('int-5').claims[0]!.evidence).toBe('none');
    expect(by('int-6').claims[0]!.evidence).toBe('benchmark');
  });
});

describe('Multi-Agent Integration Auditor: packs', () => {
  it('render natural text per packet with no structured fields, verdicts or rule ids', async () => {
    for (const id of ['integration-dev', 'integration-heldout'] as const) {
      const files = await fixtureFiles(id);
      const text = files.map((f) => f.content).join('\n');
      expect(text).not.toMatch(/"verdict"|"decision"|gradedTruth|B[1-5]-|R[1-3]-/);
      for (const p of id === 'integration-dev' ? DEV_PACKETS : HELDOUT_PACKETS) {
        for (const f of ['01-builder-summary.md', '02-diff-stat.txt', '03-reviewer-note.md', '04-ci-log.txt', '05-main-state.md']) expect(files.some((x) => x.path === `packet-${p.id}/${f}`), `${p.id}/${f}`).toBe(true);
      }
      expect(text).toContain('Fabricated for Claude Forge');
      expect(files.find((f) => f.path === 'README.md')!.content).toContain('zero tests run is not a pass');
    }
  });

  it('the CI log shows what really happened (zero tests run for the skipped packet; stale base visible in main state)', async () => {
    const dev = await fixtureFiles('integration-dev');
    expect(dev.find((f) => f.path === 'packet-int-2/04-ci-log.txt')!.content).toMatch(/tests\s+0 run, 0 failed, --skip-slow/);
    expect(dev.find((f) => f.path === 'packet-int-3/05-main-state.md')!.content).toContain('The branch is BEHIND main.');
    expect(dev.find((f) => f.path === 'packet-int-3/05-main-state.md')!.content).toContain('- sim/merge.ts');
    const held = await fixtureFiles('integration-heldout');
    expect(held.find((f) => f.path === 'packet-int-7/04-ci-log.txt')!.content).not.toContain('replay');
    expect(held.some((f) => f.path === 'packet-int-6/bench/lookups.txt')).toBe(true);
    expect(held.some((f) => f.path === 'packet-int-5/bench/lookups.txt')).toBe(false);
  });

  it('makes no FPS or timing claim anywhere (counts only)', async () => {
    for (const id of ['integration-dev', 'integration-heldout'] as const) {
      const text = (await fixtureFiles(id)).map((f) => f.content).join('\n');
      // the only mention allowed is the disclaimer itself
      for (const line of text.split('\n').filter((l) => /\bfps\b|\d+\s?ms\b|milliseconds/i.test(l))) expect(line).toMatch(/never FPS or timing/);
      expect(text).not.toMatch(/\d+\s?ms\b/);
    }
  });

  it('dev and held-out packs are disjoint, hashed and registered with a checklist', async () => {
    const dev = (await fixtureFiles('integration-dev')).map((f) => f.path).filter((p) => p.startsWith('packet-'));
    const held = (await fixtureFiles('integration-heldout')).map((f) => f.path).filter((p) => p.startsWith('packet-'));
    expect(dev.some((p) => held.includes(p))).toBe(false);
    expect(await fixtureHash('integration-dev')).not.toBe(await fixtureHash('integration-heldout'));
    expect(getFixture('integration-dev')!.checklist).toHaveLength(5);
  });
});

describe('Multi-Agent Integration Auditor: mission definition', () => {
  it('is complete: prompts carry the answer format, packet id and policy', () => {
    expect(M.devCases).toHaveLength(4);
    expect(M.heldoutCases).toHaveLength(3);
    for (const c of [...M.devCases, ...M.heldoutCases]) {
      expect(c.prompt).toContain('DECISION: merge | revise | block');
      expect(c.prompt).toContain(`packet-${c.id}/`);
      expect(M.truth(c.id)).toBeDefined();
    }
    expect(taskPrompt(DEV_PACKETS[0]!)).toBe(M.devCases[0]!.prompt);
    expect(M.designTargets).toContain('behind main');
    expect(M.verdicts.map((v) => v.value)).toEqual(['merge', 'revise', 'block']);
  });

  it('the starter is valid but deliberately imperfect', () => {
    const draft = SkillDraftSchema.parse({ ...M.starter(), id: 'x', createdAt: 't', updatedAt: 't' });
    expect(freezeRequirements(draft).every((r) => r.ok)).toBe(true);
    expect(validateSkillContent(contentOf(draft)).errors).toBe(0);
    expect(contentOf(draft).description.toLowerCase()).not.toContain('not for');
    expect(contentOf(draft).instructions).not.toMatch(/zero tests|rebase|benchmark/i);
  });

  it('visible text never reveals a packet\'s decision', () => {
    const visible = JSON.stringify([M.devCases, M.heldoutCases]).split(M.verdictFormat).join('');
    expect(visible).not.toMatch(/DECISION: (merge|revise|block)/);
  });
});
