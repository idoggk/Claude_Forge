import { Link } from 'react-router-dom';
import { Badge, Callout, Card, EmptyState, LinkButton, PageHeader, Spinner } from '@/components/ui';
import { useExperiments } from '@/app/hooks';
import { PILOT_STARTERS } from '@/content/pilot/starters';
import { pilotComplete, pilotSteps } from '@/domain/pilot/pilot';

export default function PilotPage() {
  const { data: experiments } = useExperiments();
  if (!experiments) return <Spinner label="Loading" />;
  const mine = experiments.filter((e) => e.pilot);
  return (
    <div data-testid="pilot-page">
      <PageHeader
        art="battle-lab"
        eyebrow="AI Lab"
        title="Run Your First Real AI Experiment"
        subtitle="Compare two ways of doing a task you really do, using your own Claude Code. Forge writes the plan, tells you what to paste and keep constant, and keeps the record honest. It runs nothing."
      />
      <div className="mb-5"><Callout tone="info" title="How it works in eight small steps">Choose a problem → describe the baseline → describe the improved approach → run it in your own tools → record the evidence → evaluate → reflect → plan the next improvement. You only fill in what each step asks for. Statistics appear only when they help you read the result.</Callout></div>

      <section aria-labelledby="starters-h" className="mb-8">
        <h2 id="starters-h" className="mb-2 text-xl font-semibold">Pick what you want to test</h2>
        <ul className="grid gap-3 md:grid-cols-3" data-testid="pilot-starters">
          {PILOT_STARTERS.map((s) => (
            <Card as="li" key={s.id} className="flex flex-col gap-2" data-testid={`starter-${s.id}`}>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm text-muted">{s.blurb}</p>
              <p className="text-xs text-muted">Compares: <strong>{s.baselineLabel}</strong> and <strong>{s.improvedLabel}</strong>. Three runs each.</p>
              <div className="mt-auto pt-1"><LinkButton to={`/pilot/new/${s.id}`} variant="primary" data-testid={`start-${s.id}`}>Start this experiment</LinkButton></div>
            </Card>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mine-h" className="mb-8">
        <h2 id="mine-h" className="mb-2 text-xl font-semibold">Your guided experiments</h2>
        {mine.length === 0 ? (
          <EmptyState title="None yet" icon="flask">Your first one will appear here, with how far along it is.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="pilot-list">
            {mine.map((e) => {
              const steps = pilotSteps(e);
              const done = steps.filter((s) => s.done).length;
              return (
                <Card as="li" key={e.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-2"><Badge tone={pilotComplete(e) ? 'ok' : 'accent'}>{done} of 8 steps</Badge><Badge>{e.runs.length} run(s)</Badge></div>
                  <h3 className="text-lg font-semibold"><Link className="hover:underline" to={`/pilot/${e.id}`}>{e.title}</Link></h3>
                  <p className="text-sm text-muted">Next: {steps.find((s) => !s.done)?.title ?? 'complete'}</p>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <Card aria-labelledby="human-h">
        <h2 id="human-h" className="text-lg font-semibold">Before you start: a short checklist for you</h2>
        <p className="mt-1 text-sm text-muted">The pilot needs a real person and a real Claude Code session. Forge cannot do these for you, and nothing here has been done on your behalf.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Pick a task you could redo three times in about an hour, with a result you can check yourself.</li>
          <li>Decide your yes/no checks <strong>before</strong> the first run.</li>
          <li>Use a clean copy of your project for each run (for example a fresh git worktree). Never paste secrets into Forge.</li>
          <li>Run each condition three times, alternating the order. Record failed attempts too.</li>
          <li>Finish with a written next step, even if the answer is &ldquo;stop here&rdquo;.</li>
        </ul>
        <p className="mt-2 text-xs text-muted">The longer protocol, including what to collect for the Skill Improvement Loop and playbook evidence, is in <code>docs/REAL_WORLD_PILOT.md</code> in the repository.</p>
      </Card>
    </div>
  );
}
