import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, Icon, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { MISSIONS } from '@/content/missions';
import { LOOP_STEPS, STEP_LABELS } from '@/domain/loop/types';
import { deleteLoop, startLoop } from '@/persistence/loopRepo';
import { useLoops } from './useLoop';

export default function LoopHub() {
  const { data: loops } = useLoops();
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!loops) return <Spinner label="Loading the Skill Improvement Loop" />;
  const active = loops.filter((l) => l.status === 'active');
  const done = loops.filter((l) => l.status !== 'active');

  const start = async (id: string) => {
    setBusy(true);
    setErr(null);
    try { const l = await startLoop(id); nav(`/loop/${l.id}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Skill Improvement Loop"
        title="Measure it. Improve it. Prove it held up."
        subtitle="The core Claude Forge exercise: build a Skill for a real game-dev problem, measure it against no Skill, revise it because of what you saw, then test the revision on tasks it was not tuned for."
      />

      <Card className="mb-5" aria-labelledby="how-h">
        <h2 id="how-h" className="text-lg font-semibold">How the loop works</h2>
        <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4" data-testid="loop-steps-overview">
          {LOOP_STEPS.map((s, i) => <li key={s}><span className="font-semibold">{i + 1}. {STEP_LABELS[s].label}</span></li>)}
        </ol>
        <p className="mt-3 text-sm text-muted">You run the tasks in your own Claude Code. Forge supplies the fixtures and the ground truth (computed deterministically from the fixture), keeps your records, hides the held-out answers until you are done, and writes the report. It never runs Claude and never invents a result.</p>
      </Card>

      <h2 className="mb-2 text-lg font-semibold">Missions</h2>
      <ul className="mb-6 grid gap-3 md:grid-cols-2">
        {MISSIONS.map((m) => (
          <Card as="li" key={m.id} data-testid={`mission-${m.id}`}>
            <div className="flex flex-wrap gap-2">{m.id === 'economy-balance-reviewer' && <Badge tone="accent">Flagship</Badge>}<Badge>{m.labels.fixtureBadge}</Badge><Badge>{m.labels.estimate}</Badge></div>
            <h3 className="mt-1 text-xl font-semibold">{m.title}</h3>
            <p className="text-sm text-muted">{m.tagline}</p>
            <p className="mt-2 text-sm">{m.targetOutcome}</p>
            {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" icon="arrow" disabled={busy} onClick={() => void start(m.id)} data-testid={`start-${m.id}`}>{active.some((l) => l.missionId === m.id) ? 'Start another run' : 'Start this mission'}</Button>
            </div>
          </Card>
        ))}
      </ul>

      <h2 className="mb-2 text-lg font-semibold">Your loops</h2>
      {loops.length === 0 ? (
        <EmptyState title="No loops yet" icon="flask">Pick a mission above to begin. Your baseline, runs and revisions are saved here as you go, so you can stop and resume.</EmptyState>
      ) : (
        <ul className="space-y-2" data-testid="loop-list">
          {[...active, ...done].map((l) => {
            const m = MISSIONS.find((x) => x.id === l.missionId);
            return (
              <Card as="li" key={l.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold"><Link className="hover:underline" to={`/loop/${l.id}`}>{m?.title ?? l.missionId}</Link></p>
                  <p className="text-sm text-muted">Started {new Date(l.createdAt).toLocaleDateString()} · updated {new Date(l.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={l.status === 'graduated' ? 'ok' : l.status === 'abandoned' ? 'neutral' : 'accent'}>{l.status}</Badge>
                  <LinkButton size="sm" variant="primary" to={`/loop/${l.id}`}>{l.status === 'active' ? 'Continue' : 'Open'}</LinkButton>
                  <ConfirmButton label="Delete" confirmLabel="Delete loop" onConfirm={async () => { await deleteLoop(l.id); toast('Loop deleted (your Skill draft was kept)'); }} />
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      <div className="mt-6"><Callout tone="info" title="Why this is more than a lesson"><Icon name="flask" size={14} className="mr-1 inline" />Passing a quiz shows you understand a Skill. Running the loop shows whether <em>your</em> Skill changes what Claude does, how sure you can be, and whether the improvement survives tasks you did not tune it on.</Callout></div>
    </div>
  );
}
