import type { Evidence, Experiment } from '@/domain/experiments/model';
import { compareExperiment } from '@/domain/experiments/compare';
import { contentOf, type SkillContent } from '@/domain/skills/model';
import { diffSkills, diffSummary } from '@/domain/skills/diff';
import { generateSkillMd as renderSkillMd } from '@/domain/skills/generate';
import type { LoopBundle } from '@/persistence/loopRepo';
import { caseMatrix, matchStats, patternLabel, pct } from './engine';

export const LOOP_REPORT_FORMAT = 'claude-forge-skill-improvement-report';
export const LOOP_REPORT_VERSION = 1;

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function snapshotOf(b: LoopBundle, revisionId: string | undefined): SkillContent | null {
  const rev = b.skill?.revisions.find((r) => r.id === revisionId);
  return rev?.snapshot ?? null;
}

export interface LoopReportData {
  v1: SkillContent | null;
  v2: SkillContent | null;
  final: SkillContent | null;
}

export function loopSkills(b: LoopBundle): LoopReportData {
  return {
    v1: snapshotOf(b, b.loop.v1?.revisionId),
    v2: snapshotOf(b, b.loop.improvement?.v2RevisionId),
    final: b.skill ? contentOf(b.skill) : null,
  };
}

/** A plain-language reading of held-out results. Deliberately cautious; never a claim of general improvement. */
export function heldoutReading(b: LoopBundle): string[] {
  if (!b.loop.heldoutRevealedAt || !b.heldout) return ['Held-out ground truth has not been revealed yet, so there is no held-out result.'];
  const ids = b.mission.heldoutCases.map((c) => c.id);
  const stats = matchStats(b.heldout, ids);
  const v1 = stats.find((s) => s.conditionId === b.loop.heldoutConditionIds.v1);
  const v2 = stats.find((s) => s.conditionId === b.loop.heldoutConditionIds.v2);
  if (!v1 || !v2) return ['Held-out conditions are incomplete.'];
  const lines = [`Held-out ${b.mission.labels.answerNoun} match: Skill v1 ${pct(v1.matched, v1.graded)}, Skill v2 ${pct(v2.matched, v2.graded)}.`];
  if (v2.matched > v1.matched) lines.push(`v2 matched the ${b.mission.labels.truthShort} on ${v2.matched - v1.matched} more held-out case(s) than v1. With ${ids.length} cases and one run each this is a directional observation, not evidence of a general improvement.`);
  else if (v2.matched < v1.matched) lines.push(`v2 matched the ${b.mission.labels.truthShort} on ${v1.matched - v2.matched} FEWER held-out case(s) than v1. The revision did not transfer; this is a real result. Look at which failure pattern you changed and what the held-out cases needed instead.`);
  else lines.push('v1 and v2 matched the same number of held-out cases. The revision did not measurably change accuracy on these cases.');
  return lines;
}

export function buildLoopReportMarkdown(b: LoopBundle): string {
  const { loop, mission } = b;
  const { v1, v2, final } = loopSkills(b);
  const L: string[] = [];
  L.push(`# Skill Improvement Report: ${mission.title}`, '');
  L.push('> Produced by Claude Forge from results you recorded by hand. Claude Forge did not run Claude. Answers are self-reported (read by you from Claude\'s output); Forge compared them with ground truth computed deterministically from the fixture. Unknown values are shown as "unknown", never as 0. This report documents an experiment, not proof that the Skill works in general.', '');
  L.push(`- Status: ${loop.status}${loop.graduatedAt ? ` (graduated ${loop.graduatedAt.slice(0, 10)})` : ''}`);
  L.push(`- Mission: ${mission.title} (id \`${mission.id}\`, version ${mission.version})`, '');

  L.push('## 1. The problem', '', mission.problem.trim(), '', `**Why it matters.** ${mission.whyItMatters}`, '', `**Target outcome.** ${mission.targetOutcome}`, '');

  L.push('## 2. Setup', '');
  if (b.dev) L.push(`- Development set: ${b.dev.fixture.label} (id \`${b.dev.fixture.id}\`, hash ${b.dev.fixture.hash ? '`' + b.dev.fixture.hash + '`' : 'not recorded'}), ${mission.devCases.length} ${mission.labels.caseNounPlural}`);
  if (b.heldout) L.push(`- Held-out set: ${b.heldout.fixture.label} (id \`${b.heldout.fixture.id}\`, hash ${b.heldout.fixture.hash ? '`' + b.heldout.fixture.hash + '`' : 'not recorded'}), ${mission.heldoutCases.length} ${mission.labels.caseNounPlural}, different from the development set`);
  L.push('- The task prompt was identical across conditions; the only difference was the Skill.', '');
  L.push('**Success criteria**', '');
  mission.successCriteria.forEach((c) => L.push(`- ${c}`));
  L.push('');

  L.push('## 3. Skill v1', '');
  if (v1) {
    L.push(`Frozen ${loop.v1?.frozenAt.slice(0, 10)} before any Skill test run.`, '', '```markdown', renderSkillMd(v1).trimEnd(), '```', '');
  } else L.push('_v1 was not frozen._', '');

  L.push('## 4. Development results', '');
  if (b.dev) {
    const cmp = compareExperiment(b.dev, mission.checklist.length);
    const stats = matchStats(b.dev, mission.devCases.map((c) => c.id));
    L.push(`| Condition | ${cap(mission.labels.answerNoun)} matched ground truth | Unclear |`, '|---|---|---|');
    for (const s of stats) L.push(`| ${cell(s.label)} | ${loop.devGradedAt ? pct(s.matched, s.graded) : 'not graded'} | ${s.unclear} |`);
    L.push('', `**Evidence sufficiency:** ${cmp.sufficiency.headline}`, '');
    const header = ['Measure', ...b.dev.conditions.map((c) => c.label)];
    L.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
    for (const row of cmp.rows) {
      if (row.perCondition.every((c) => c.stat.n === 0)) continue;
      const f = (s: (typeof row.perCondition)[number]['stat']) => (s.mean === null ? 'unknown' : `${row.unit === 'ratio' ? s.mean.toFixed(2) : Number(s.mean.toFixed(1))} (n=${s.n}${s.unknown ? `, ${s.unknown} missing` : ''})`);
      L.push(`| ${cell(row.label)} | ${row.perCondition.map((c) => cell(f(c.stat))).join(' | ')} |`);
    }
    L.push('');
    const rows = caseMatrix(b.dev, mission, mission.devCases, loop.devGradedAt !== null);
    L.push(`| ${cap(mission.labels.caseNoun)} | Ground truth | ` + b.dev.conditions.map((c) => cell(c.label)).join(' | ') + ' |', `|---|---|${b.dev.conditions.map(() => '---').join('|')}|`);
    for (const r of rows) L.push(`| ${cell(r.title)} | ${r.truth ?? 'hidden'} | ${r.byCondition.map((c) => (c.verdict ? `${c.verdict}${c.matched === null ? '' : c.matched ? ' ✓' : ' ✗'}` : 'not recorded')).join(' | ')} |`);
    L.push('');
  }

  L.push('## 5. Hypothesis and revision', '');
  if (loop.improvement) {
    L.push(`**Observed failure pattern(s):** ${loop.improvement.patternIds.map(patternLabel).join(', ')}`, '', `**Hypothesis.** ${loop.improvement.hypothesis}`, '', `**Expected measurable change.** ${loop.improvement.expectedChange}`, '');
    if (v1 && v2) {
      const d = diffSkills(v1, v2);
      L.push(`**What changed (v1 → v2).** ${diffSummary(d)}`, '');
      L.push('```diff');
      for (const m of d.metadata) L.push(`# frontmatter ${m.field}`, `- ${m.before}`, `+ ${m.after}`);
      for (const ln of d.body) if (ln.kind !== 'same') L.push(`${ln.kind === 'add' ? '+' : '-'} ${ln.text}`);
      for (const r of d.resources) L.push(`# resource ${r.path}: ${r.change}`);
      L.push('```', '');
      L.push('### Skill v2', '', '```markdown', renderSkillMd(v2).trimEnd(), '```', '');
    }
  } else L.push('_No revision was made._', '');

  L.push('## 6. Held-out test', '');
  if (loop.heldoutRevealedAt && b.heldout) {
    L.push(`Runs were recorded before the ground truth was revealed and locked on ${loop.heldoutRevealedAt.slice(0, 10)}.`, '');
    const stats = matchStats(b.heldout, mission.heldoutCases.map((c) => c.id));
    L.push('| Condition | Verdict matched ground truth | Unclear verdicts |', '|---|---|---|');
    for (const s of stats) L.push(`| ${cell(s.label)} | ${pct(s.matched, s.graded)} | ${s.unclear} |`);
    L.push('');
    const rows = caseMatrix(b.heldout, mission, mission.heldoutCases, true);
    L.push(`| ${cap(mission.labels.caseNoun)} | Ground truth | ` + b.heldout.conditions.map((c) => cell(c.label)).join(' | ') + ' |', `|---|---|${b.heldout.conditions.map(() => '---').join('|')}|`);
    for (const r of rows) L.push(`| ${cell(r.title)} | ${r.truth ?? 'hidden'} | ${r.byCondition.map((c) => (c.verdict ? `${c.verdict}${c.matched === null ? '' : c.matched ? ' ✓' : ' ✗'}` : 'not recorded')).join(' | ')} |`);
    L.push('');
    heldoutReading(b).forEach((l) => L.push(l, ''));
  } else L.push('_The held-out test was not completed._', '');

  L.push('## 7. Limitations', '');
  const lim = [
    `${mission.devCases.length} development and ${mission.heldoutCases.length} held-out ${mission.labels.caseNounPlural}, one run per ${mission.labels.caseNoun} and condition. LLM outputs vary run to run; this cannot establish an effect.`,
    `Answers, activation, rework and effort are self-reported. Forge does not verify what you typed; it only compares your recorded ${mission.labels.answerNoun} with the ${mission.labels.truthShort}.`,
    mission.labels.truthLimitation,
    'The Skill was tuned on the development set; the held-out set uses different levers but is still the same fictional game.',
    ...(b.dev ? compareExperiment(b.dev, mission.checklist.length).integrity.slice(0, 4) : []),
  ];
  lim.forEach((l) => L.push(`- ${l}`));
  L.push('');

  L.push('## 8. What I learned', '', loop.reflection.lessons.trim() || '_not written_', '', '## 9. How I will apply this to a real project', '', loop.reflection.application.trim() || '_not written_', '');

  L.push('## 10. Final Skill', '');
  if (final && v2 && !diffSkills(v2, final).identical) L.push(`> **The final Skill below differs from the tested v2** (${diffSummary(diffSkills(v2, final))}). The held-out result above applies to v2, not to this edited version.`, '');
  if (final) L.push('```markdown', renderSkillMd(final).trimEnd(), '```', '');
  L.push('A Skill graduated from this loop is **tested on a synthetic fixture only**. It is not "field-proven" until you record real project evidence.', '');
  return L.join('\n') + '\n';
}

export function buildLoopReportJson(b: LoopBundle, evidence: Evidence[] = b.evidence): string {
  const { v1, v2, final } = loopSkills(b);
  const exps = [b.dev, b.heldout].filter((e): e is Experiment => Boolean(e));
  return (
    JSON.stringify(
      {
        format: LOOP_REPORT_FORMAT,
        version: LOOP_REPORT_VERSION,
        exportedAt: new Date().toISOString(),
        notice: 'Recorded by the user in Claude Forge. Claude Forge does not run Claude; answers and metrics are self-reported, graded against ground truth computed deterministically from the fixture.',
        mission: { id: b.mission.id, version: b.mission.version, title: b.mission.title },
        loop: b.loop,
        skills: { v1, v2, final },
        diff: v1 && v2 ? diffSkills(v1, v2) : null,
        experiments: exps.map((e) => ({ experiment: e, comparison: compareExperiment(e, b.mission.checklist.length) })),
        evidence: evidence.map((e) => ({ id: e.id, experimentId: e.experimentId, runId: e.runId, name: e.name, kind: e.kind, provenance: e.provenance, size: e.size })),
      },
      null,
      2,
    ) + '\n'
  );
}

/** True when the working copy was edited after v2 was saved, so the held-out result no longer describes the final Skill. */
export function finalDiffersFromV2(b: LoopBundle): boolean {
  const { v2, final } = loopSkills(b);
  return Boolean(v2 && final && !diffSkills(v2, final).identical);
}
