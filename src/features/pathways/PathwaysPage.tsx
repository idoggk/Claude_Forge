import { Link } from 'react-router-dom';
import { Badge, Card, PageHeader, ProgressBar, Spinner } from '@/components/ui';
import { PATHWAYS } from '@/content/pathways';
import { pathwayProgress } from '@/domain/mastery/pathways';
import { usePathwayEvidence } from './usePathwayEvidence';

export default function PathwaysPage() {
  const ev = usePathwayEvidence();
  if (!ev) return <Spinner label="Loading pathways" />;
  return (
    <div>
      <PageHeader eyebrow="Practise" title="Capability pathways" subtitle="Seven short routes from an idea to something you have saved: learn it, practise it on a computed fixture, test it for real, apply it, and write down what you found. A step shows as done only when the matching record is on this device. Doing a step never proves you have the skill." />
      <ul className="grid gap-4 md:grid-cols-2" data-testid="pathway-list">
        {PATHWAYS.map((p) => {
          const pr = pathwayProgress(p, ev);
          return (
            <li key={p.id}>
              <Card aria-labelledby={`pw-${p.id}`} className="h-full" data-testid={`pathway-card-${p.id}`}>
                <h2 id={`pw-${p.id}`} className="text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm">{p.outcome}</p>
                <p className="mt-1 text-xs text-muted">For: {p.whoFor}</p>
                <div className="mt-3"><ProgressBar value={pr.done} max={pr.total} label={`${p.title}: ${pr.done} of ${pr.total} steps have a record`} /></div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={pr.done === pr.total ? 'ok' : 'neutral'}>{pr.done} of {pr.total} steps have a record</Badge><Link className="font-semibold text-accent-text underline" to={`/pathways/${p.id}`} data-testid={`pathway-open-${p.id}`}>Open pathway</Link></div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
