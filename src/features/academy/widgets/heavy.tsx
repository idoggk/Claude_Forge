import { useMemo, useState } from 'react';
import type { Lesson } from '@/domain/curriculum/types';
import { Badge, Button, Callout, Card, TabPanel, Tabs, cx } from '@/components/ui';
import { CASES, BUGGY_RESOLVER, parseBoard, runCase, runSuite, scanSeeds, type Resolver, formatBoard } from '@/fixtures/merge-cascade/cases';
import { dropPiece as referenceDrop } from '@/fixtures/merge-cascade/board.reference';
import { CANDIDATES } from '@/fixtures/merge-cascade/candidates';
import { INVARIANTS } from '@/fixtures/merge-cascade/invariants';
import { BUGGY_CONFIG, HEALTH_BAND, simulate, type StageRow } from '@/fixtures/economy/sim';
import { REFERENCE_CONFIG } from '@/fixtures/economy/reference';
import { DEMO_EXPERIMENT } from '@/domain/experiments/demo';
import { ComparisonView } from '@/features/battle-lab/ComparisonView';
import { buildFixturePack } from '@/fixtures';
import { downloadBlob } from '@/lib/download';
import { BoardView } from './shared';

type W = { lesson: Lesson };

/* ------------------------------ Lesson 6: merge lab ------------------------------ */

const RESOLVERS: { id: string; label: string; fn: Resolver }[] = [
  { id: 'buggy', label: 'Buggy code (as shipped)', fn: BUGGY_RESOLVER },
  { id: 'reference', label: 'Reference fix', fn: referenceDrop },
  ...CANDIDATES.map((c) => ({ id: c.id, label: `Candidate: ${c.label}`, fn: c.resolver })),
];
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

export function MergeLab(_: W) {
  const [tab, setTab] = useState<'cases' | 'seeds' | 'patches'>('cases');
  const [rid, setRid] = useState('buggy');
  const [caseId, setCaseId] = useState('group-of-four');
  const [seedPick, setSeedPick] = useState<number | null>(null);
  const [cand, setCand] = useState(CANDIDATES[1]!.id);
  const resolver = RESOLVERS.find((r) => r.id === rid)!.fn;
  const suite = useMemo(() => runSuite(resolver), [resolver]);
  const seedScan = useMemo(() => scanSeeds(resolver, SEEDS), [resolver]);
  const tc = CASES.find((c) => c.id === caseId)!;
  const res = useMemo(() => runCase(resolver, tc), [resolver, tc]);
  const candidate = CANDIDATES.find((c) => c.id === cand)!;
  const candSuite = useMemo(() => runSuite(candidate.resolver), [candidate]);
  const candSeeds = useMemo(() => scanSeeds(candidate.resolver, SEEDS), [candidate]);
  const seedFail = seedScan.find((s) => s.seed === seedPick);

  return (
    <Card>
      <h3 className="font-semibold">Merge lab <Badge tone="warn">educational fixture · original code</Badge></h3>
      <p className="mt-1 text-sm text-muted">5×5 merge-3 board. Value of a piece = 3^rank. <strong>Everything here runs the app&apos;s own trusted fixture code - nothing you type is evaluated.</strong></p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">Invariants the fixture checks</summary><ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{INVARIANTS.map((i) => <li key={i.id}>{i.text}</li>)}</ul></details>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 max-w-full flex-1 basis-64">
          <label htmlFor="ml-impl" className="block text-sm font-semibold">Implementation under test</label>
          <select id="ml-impl" value={rid} onChange={(e) => setRid(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface2 px-2">{RESOLVERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        </div>
        <p className="text-sm" data-testid="suite-summary"><Badge tone={suite.failed === 0 ? 'ok' : 'bad'}>{suite.passed}/{CASES.length} cases pass</Badge> <Badge tone={seedScan.length === 0 ? 'ok' : 'bad'}>{seedScan.length} of {SEEDS.length} seeds violate</Badge></p>
        <Button size="sm" variant="ghost" icon="download" onClick={async () => { const p = await buildFixturePack('merge-cascade'); downloadBlob(p.blob, p.filename); }}>Download runnable fixture pack (ZIP)</Button>
      </div>
      <div className="mt-3"><Tabs idPrefix="mlab-" label="Merge lab views" value={tab} onChange={setTab} tabs={[{ id: 'cases', label: 'Cases' }, { id: 'seeds', label: 'Seeded playthroughs' }, { id: 'patches', label: 'Candidate patches' }]} /></div>

      <TabPanel idPrefix="mlab-" id="cases" active={tab === 'cases'}>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <ul className="space-y-1" aria-label="Cases">
            {CASES.map((c) => {
              const r = suite.results.find((x) => x.id === c.id)!;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setCaseId(c.id)} aria-pressed={caseId === c.id} data-testid={`case-${c.id}`} className={cx('transition-forge flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm', caseId === c.id ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2')}>
                    <Badge tone={r.pass ? 'ok' : 'bad'}>{r.pass ? 'pass' : 'FAIL'}</Badge><span>{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 text-sm" data-testid="case-detail">
            <p className="text-muted">{tc.why}</p>
            <p className="font-semibold">Before, then drop rank {tc.drop.rank} at ({tc.drop.r},{tc.drop.c})</p>
            <div className="flex flex-wrap items-center gap-3"><BoardView rows={tc.board} label="Board before" highlight={{ r: tc.drop.r, c: tc.drop.c }} />{res.finalBoard && <><span aria-hidden="true">→</span><BoardView rows={res.finalBoard} label="Board after" /></>}</div>
            {tc.expect && <details><summary className="cursor-pointer">Expected board (hand-derived)</summary><BoardView rows={tc.expect} label="Expected board" /></details>}
            {res.failures.length > 0 ? <Callout tone="bad" title="Failures">{res.failures.map((f) => <p key={f}>{f}</p>)}</Callout> : <Callout tone="ok" title="All checks pass for this case" />}
          </div>
        </div>
      </TabPanel>

      <TabPanel idPrefix="mlab-" id="seeds" active={tab === 'seeds'}>
        <div className="space-y-3 text-sm" data-testid="seed-scan">
          <p>Scanning seeds 1-40 with random drops until the board fills. <strong>{seedScan.length}</strong> playthrough(s) violate an invariant{seedScan.length ? '; the lowest failing seed is ' + seedScan[0]!.seed : ''}.</p>
          {seedScan.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Failing seeds">
              {seedScan.slice(0, 12).map((s) => <Button key={s.seed} size="sm" variant={seedPick === s.seed ? 'primary' : 'secondary'} onClick={() => setSeedPick(s.seed)}>Seed {s.seed}</Button>)}
              {seedScan.length > 12 && <span className="self-center text-muted">…and {seedScan.length - 12} more</span>}
            </div>
          )}
          {seedFail && (
            <div className="space-y-2 rounded-lg border border-line bg-surface2 p-3" data-testid="seed-detail">
              <p className="font-semibold">Seed {seedFail.seed}: first violation on drop #{seedFail.dropNumber} (rank {seedFail.rank} at ({seedFail.at.r},{seedFail.at.c}))</p>
              <BoardView rows={seedFail.boardBefore} label="Board before the failing drop" highlight={seedFail.at} />
              <ul className="list-disc pl-5 text-muted">{seedFail.messages.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel idPrefix="mlab-" id="patches" active={tab === 'patches'}>
        <div className="space-y-3 text-sm" data-testid="patch-lab">
          <div role="radiogroup" aria-label="Candidate patch" className="grid gap-2 sm:grid-cols-2">
            {CANDIDATES.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={cand === c.id} onClick={() => setCand(c.id)} className={cx('transition-forge min-h-11 rounded-lg border p-2 text-left font-semibold', cand === c.id ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2')}>{c.label}</button>
            ))}
          </div>
          <pre tabIndex={0} className="code-scroll rounded-lg border border-line bg-surface2 p-3 text-xs">{candidate.patch}</pre>
          <p><Badge tone={candSuite.failed === 0 ? 'ok' : 'bad'}>{candSuite.passed}/{CASES.length} cases</Badge> <Badge tone={candSeeds.length === 0 ? 'ok' : 'bad'}>{candSeeds.length} failing seeds of {SEEDS.length}</Badge></p>
          <ul className="space-y-1">{candSuite.results.filter((r) => !r.pass).map((r) => <li key={r.id} className="text-muted"><strong>{r.title}</strong>: {r.failures[0]}</li>)}</ul>
          <p className="text-muted">Judge by the suite, not by how plausible the patch sounds.</p>
        </div>
      </TabPanel>
    </Card>
  );
}

/* ------------------------------ Lesson 7: economy lab ------------------------------ */

function Chart({ a, b, label }: { a: StageRow[]; b: StageRow[]; label: string }) {
  const W = 560, H = 180, P = 28;
  const maxX = a.length;
  const maxY = Math.max(...a.map((r) => r.affordability), ...b.map((r) => r.affordability), 1);
  const x = (stage: number) => P + ((stage - 1) / (maxX - 1)) * (W - P * 1.5);
  const y = (v: number) => H - P - (v / maxY) * (H - P * 1.6);
  const path = (rows: StageRow[]) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.stage).toFixed(1)},${y(r.affordability).toFixed(1)}`).join(' ');
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full max-w-xl">
        <line x1={P} y1={H - P} x2={W - P / 2} y2={H - P} stroke="var(--line)" />
        <line x1={P} y1={P / 2} x2={P} y2={H - P} stroke="var(--line)" />
        <line x1={P} x2={W - P / 2} y1={y(HEALTH_BAND.affordability[1])} y2={y(HEALTH_BAND.affordability[1])} stroke="var(--teal)" strokeDasharray="4 4" opacity="0.7" />
        <text x={W - P / 2} y={y(HEALTH_BAND.affordability[1]) - 4} fontSize="10" textAnchor="end" fill="var(--teal)">healthy band ≤ {HEALTH_BAND.affordability[1]}</text>
        <path d={path(b)} fill="none" stroke="var(--teal)" strokeWidth="2.5" />
        <path d={path(a)} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <text x={P} y={H - 8} fontSize="10" fill="var(--muted)">stage 1</text>
        <text x={W - P / 2} y={H - 8} fontSize="10" textAnchor="end" fill="var(--muted)">stage {maxX}</text>
        <text x={P + 4} y={P / 2 + 8} fontSize="10" fill="var(--muted)">affordability {maxY.toFixed(1)}</text>
      </svg>
      <figcaption className="text-xs text-muted"><span className="text-accent-text">■</span> selected configuration · <span className="text-teal">■</span> comparison configuration · affordability = income ÷ next upgrade price</figcaption>
    </figure>
  );
}

export function EconomyLab(_: W) {
  const [which, setWhich] = useState<'buggy' | 'ref'>('buggy');
  const buggy = useMemo(() => simulate(BUGGY_CONFIG), []);
  const fixed = useMemo(() => simulate(REFERENCE_CONFIG), []);
  const rows = which === 'buggy' ? buggy : fixed;
  const cfg = which === 'buggy' ? BUGGY_CONFIG : REFERENCE_CONFIG;
  const shown = rows.filter((r) => r.stage <= 8 || r.stage % 4 === 0);
  return (
    <Card>
      <h3 className="font-semibold">Economy lab <Badge tone="warn">synthetic · fictional economy &ldquo;Shardfall&rdquo;</Badge></h3>
      <p className="mt-1 text-sm text-muted">Deterministic simulation (seeded). Not telemetry from any real game.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Configuration">
        <button type="button" role="radio" aria-checked={which === 'buggy'} onClick={() => setWhich('buggy')} data-testid="econ-buggy" className={cx('min-h-11 rounded-lg border px-3 text-sm font-semibold', which === 'buggy' ? 'border-accent bg-surface2' : 'border-line')}>As shipped</button>
        <button type="button" role="radio" aria-checked={which === 'ref'} onClick={() => setWhich('ref')} data-testid="econ-ref" className={cx('min-h-11 rounded-lg border px-3 text-sm font-semibold', which === 'ref' ? 'border-accent bg-surface2' : 'border-line')}>Reference fix</button>
      </div>
      <p className="mt-2 text-xs text-muted">Config: base reward {cfg.baseReward} × {cfg.rewardGrowth}/stage · repair tax {Math.round(cfg.repairRate * 100)}% · upgrade cost {cfg.upgradeBaseCost} × {cfg.upgradeCostGrowth}/level · gate: level ≤ {cfg.gateBaseLevel} + stage/{cfg.gateStagesPerLevel} · power coupling {cfg.coupling.mode} {cfg.coupling.k}</p>
      <div className="mt-3"><Chart a={rows} b={which === 'buggy' ? fixed : buggy} label="Affordability by stage: as-shipped versus reference fix" /></div>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Simulation results table" data-testid="econ-table">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Simulation results by stage</caption>
          <thead><tr className="text-left">{['Stage', 'Level / max', 'Supply', 'Next price', 'Balance', 'Affordability', 'Hoard ratio', 'Gated'].map((h) => <th key={h} scope="col" className="border-b border-line p-2">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.stage}>
                <th scope="row" className="border-b border-line p-2 text-left">{r.stage}</th>
                <td className="border-b border-line p-2">{r.level} / {r.maxLevel}</td>
                <td className="border-b border-line p-2">{r.supply.toLocaleString()}</td>
                <td className="border-b border-line p-2">{r.nextCost.toLocaleString()}</td>
                <td className="border-b border-line p-2">{r.balance.toLocaleString()}</td>
                <td className="border-b border-line p-2">{r.affordability.toFixed(2)}</td>
                <td className="border-b border-line p-2">{r.hoardRatio.toFixed(2)}</td>
                <td className="border-b border-line p-2">{r.gated ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Showing stages 1-8, then every 4th. Affordability = income ÷ price of the next upgrade. Hoard ratio = balance ÷ price. Gated = the player can afford the next upgrade but the stage gate forbids it.</p>
    </Card>
  );
}

/* ------------------------------ Lesson 8: experiment demo ------------------------------ */

export function ExperimentDemo(_: W) {
  return (
    <Card>
      <h3 className="font-semibold">Synthetic demonstration <Badge tone="warn">invented data · no Claude execution occurred</Badge></h3>
      <p className="mt-1 text-sm text-muted">{DEMO_EXPERIMENT.problem}</p>
      <div className="mt-2 text-sm"><strong>Hypothesis (written first):</strong> {DEMO_EXPERIMENT.hypothesis}</div>
      <div className="mt-3"><ComparisonView experiment={DEMO_EXPERIMENT} /></div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-line p-3"><p className="font-semibold">Observations</p><p className="text-muted">{DEMO_EXPERIMENT.observations}</p></div>
        <div className="rounded-lg border border-line p-3"><p className="font-semibold">Conclusion &amp; limitations</p><p className="text-muted">{DEMO_EXPERIMENT.conclusion} {DEMO_EXPERIMENT.limitations}</p></div>
      </div>
    </Card>
  );
}

export { parseBoard, formatBoard };
