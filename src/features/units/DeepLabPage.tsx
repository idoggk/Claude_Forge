import { Link } from 'react-router-dom';
import { Badge, Callout, Card, PageHeader, Spinner } from '@/components/ui';
import { useExperiments, useTransferTasks } from '@/app/hooks';
import { useLive } from '@/persistence/useLive';
import { getDb } from '@/persistence/db';

interface Lab { id: string; title: string; minutes: string; what: string; need: string; to: string; cta: string; resume?: { label: string; to: string } | null }

/**
 * Deep Labs are real work: your own Claude Code, a controlled comparison, evidence you collect, and transfer to a task of yours.
 * This page is only a guided doorway into tools that already exist. It runs nothing and measures nothing; times are editorial
 * estimates and you can stop and come back at any point.
 */
export default function DeepLabPage() {
  const { data: experiments } = useExperiments();
  const { data: transfers } = useTransferTasks();
  const { data: loops } = useLive(() => getDb().loops.toArray());
  if (!experiments || !transfers || !loops) return <Spinner label="Loading" />;
  const pilot = experiments.find((e) => e.pilot && e.status !== 'concluded');
  const loop = loops.find((x) => x.status === 'active');
  const transfer = transfers.find((t) => t.status === 'in-progress' || t.status === 'planned');
  const labs: Lab[] = [
    { id: 'experiment', title: 'Run your first real AI experiment', minutes: '25 to 45', what: 'Compare how you work today with one change, three runs each, on a task you really do. Forge tells you what to copy and what to keep constant, and what the result can and cannot show.', need: 'Your own Claude Code (or another tool), and a task you have already done.', to: '/pilot', cta: pilot ? 'Open the guided experiment' : 'Start', resume: pilot ? { label: `Continue: ${pilot.title}`, to: `/pilot/${pilot.id}` } : null },
    { id: 'skill-loop', title: 'Improve a Skill with the loop', minutes: '20 to 40', what: 'Take a Skill through a measured improvement loop on a fixture, and test whether the improvement survives tasks you did not tune on.', need: 'A Skill you wrote or are willing to try. Nothing is run for you.', to: '/loop', cta: 'Open the loop', resume: loop ? { label: 'Continue your loop', to: `/loop/${loop.id}` } : null },
    { id: 'challenge', title: 'A practical challenge', minutes: '15 to 30', what: 'Four non-game problems with computed fixtures: structured extraction, research reliability, agent failure investigation and context optimisation.', need: 'Nothing. Everything runs in the page.', to: '/challenges', cta: 'Choose a challenge' },
    { id: 'playbook', title: 'Design a workflow playbook', minutes: '20 to 40', what: 'Write a repeatable AI workflow as steps with checks, then link experiments as evidence for each step.', need: 'A workflow you actually run.', to: '/playbooks', cta: 'Open playbooks' },
    { id: 'transfer', title: 'Take it to real work', minutes: '20 to 45', what: 'Plan, do and reflect on applying what you learned to a real task, in your own words.', need: 'A real task.', to: '/transfer', cta: 'Open transfer tasks', resume: transfer ? { label: `Continue: ${transfer.title}`, to: `/transfer/${transfer.id}` } : null },
  ];
  return (
    <div>
      <PageHeader eyebrow="Learn" title="Deep Lab" subtitle="Real problems, real tools, real evidence. These take longer, and you can leave and come back. Forge guides and records; you run things in your own tools, and nothing here runs automatically." />
      <Callout tone="info" title="What counts here">The times are estimates. What you record is self-reported evidence unless you import it, and it supports a takeaway but never raises a competency level by itself.</Callout>
      <ul className="mt-4 grid gap-4 md:grid-cols-2" data-testid="deep-lab-list">
        {labs.map((l) => (
          <li key={l.id}>
            <Card aria-labelledby={`dl-${l.id}`} className="h-full" data-testid={`deep-lab-${l.id}`}>
              <div className="flex flex-wrap items-center gap-2"><h2 id={`dl-${l.id}`} className="text-lg font-semibold">{l.title}</h2><Badge>{l.minutes} min (estimate)</Badge></div>
              <p className="mt-1 text-sm">{l.what}</p>
              <p className="mt-1 text-sm text-muted"><strong>You need:</strong> {l.need}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {l.resume && <Link className="font-semibold text-accent-text underline" to={l.resume.to} data-testid={`deep-lab-resume-${l.id}`}>{l.resume.label}</Link>}
                <Link className="font-semibold text-accent-text underline" to={l.to}>{l.cta}</Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
