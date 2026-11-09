import { Badge, Callout, Card, PageHeader, Spinner } from '@/components/ui';
import { useLearning, useMissionRuns } from '@/app/hooks';
import { LESSONS } from '@/content/lessons';
import { UNITS } from '@/content/units/registry';
import { MIN_SAMPLE, STALE_DAYS, qualityReport, type Stat } from '@/domain/missions/quality';
import { todayKey } from '@/lib/clock';

const fmt = (s: Stat) => (s.value === null ? 'no data' : `${Math.round(s.value * 100)}% of ${s.n}${s.enough ? '' : ' (too few to say)'}`);

/**
 * A small internal report about the learning experience, computed here from your own records. Nothing leaves this device, there
 * is no time-on-screen measurement, and the figures are descriptive only. Engagement is not mastery.
 */
export default function QualityPage() {
  const { data: l } = useLearning();
  const { data: runs } = useMissionRuns();
  if (!l || !runs) return <Spinner label="Reading your records" />;
  const r = qualityReport({ units: UNITS, runs, attempts: l.attempts, lessons: LESSONS, today: todayKey() });
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Learning experience report" subtitle="Computed on this device from your own records. Nothing is sent anywhere. These figures describe how you used the missions; they do not show how much you learned." />
      <Callout tone="info" title="How to read this">Finishing quickly is not proof of understanding, and a small number of runs says little: anything under {MIN_SAMPLE} observations is marked "too few to say". Missions unfinished for {STALE_DAYS} days or more are counted as set aside. There is no timing, because time on screen cannot be measured reliably here.</Callout>
      <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="quality-totals">
        <Card aria-label="Runs"><p className="text-2xl font-semibold">{r.totals.runs}</p><p className="text-sm text-muted">mission and spark runs</p></Card>
        <Card aria-label="Completed"><p className="text-2xl font-semibold">{r.totals.completed}</p><p className="text-sm text-muted">completed</p></Card>
        <Card aria-label="Returns"><p className="text-2xl font-semibold">{r.returnsAfterBreak}</p><p className="text-sm text-muted">returns after a break of 3 days or more</p></Card>
      </div>
      <Card className="mt-4" aria-labelledby="q-units"><h2 id="q-units" className="text-lg font-semibold">By mission and spark</h2>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm" data-testid="quality-units"><thead><tr className="text-muted"><th className="py-1 pr-3 font-semibold">Unit</th><th className="py-1 pr-3 font-semibold">Started</th><th className="py-1 pr-3 font-semibold">Completed</th><th className="py-1 pr-3 font-semibold">Set aside</th><th className="py-1 pr-3 font-semibold">Resumed</th><th className="py-1 pr-3 font-semibold">Used hints</th></tr></thead>
          <tbody>{r.units.filter((u) => u.started > 0).map((u) => <tr key={u.unitId} className="border-t border-line"><td className="py-1 pr-3">{u.title} <Badge>{u.kind === 'spark' ? 'Spark' : 'Mission'}</Badge></td><td className="pr-3">{u.started}</td><td className="pr-3">{fmt(u.completionRate)}</td><td className="pr-3">{u.abandoned}</td><td className="pr-3">{u.resumed}</td><td className="pr-3">{fmt(u.hintRuns)}</td></tr>)}</tbody></table>
          {r.units.every((u) => u.started === 0) && <p className="text-sm text-muted">No runs yet.</p>}
        </div>
      </Card>
      <Card className="mt-4" aria-labelledby="q-flags"><h2 id="q-flags" className="text-lg font-semibold">Things worth a look</h2>
        <ul className="mt-2 space-y-1 text-sm" data-testid="quality-flags">
          {r.units.flatMap((u) => u.stuckAt.map((s) => <li key={`${u.unitId}-${s.stepId}`}>Unfinished runs of <strong>{u.title}</strong> sit at step "{s.stepId}" ({s.count}). A step where people stop may be confusing.</li>))}
          {r.units.flatMap((u) => u.confusingSteps.map((c) => <li key={`${u.unitId}-${c.stepId}-c`}>Step "{c.stepId}" in <strong>{u.title}</strong> was answered right {fmt(c.correct)}. It may be unclear or too hard.</li>))}
          {r.repeatedMisconceptions.map((m) => <li key={m.id}>You chose an answer reflecting "{m.belief}" {m.times} times.</li>)}
          {r.weakAssessmentItems.map((w) => <li key={`${w.lessonId}-${w.itemId}`}>Assessment item {w.itemId} ({w.lessonId}) was missed {fmt(w.missed)}. It may be weak or the lesson may not prepare for it.</li>)}
          {r.units.every((u) => u.stuckAt.length === 0 && u.confusingSteps.length === 0) && r.repeatedMisconceptions.length === 0 && r.weakAssessmentItems.length === 0 && <li className="text-muted">Nothing stands out. With few runs that mostly means there is not enough data yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
