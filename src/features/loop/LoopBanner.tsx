import { Callout, LinkButton } from '@/components/ui';
import { useLoopBundle } from './useLoop';

/** Shown in the Workshop when a Skill is opened from the Skill Improvement Loop (?loop=<id>). */
export function LoopBanner({ loopId, skillId }: { loopId: string; skillId: string }) {
  const { data: b } = useLoopBundle(loopId);
  if (!b || b.loop.skillId !== skillId) return null;
  const { loop } = b;
  let text: string;
  if (!loop.v1) text = 'You are building v1. When it passes validation and has at least two positive and two negative trigger scenarios, go back and freeze it.';
  else if (!loop.improvement) text = 'v1 is frozen as a snapshot. What you change here becomes your revision (v2). Go back to the loop to name the failure pattern, state your hypothesis and save v2.';
  else text = 'v2 is saved and the held-out test uses v1 and v2 as frozen. Edits made now do not change those results; the report will flag that the final Skill differs from v2.';
  return (
    <div className="mb-4" data-testid="loop-banner">
      <Callout tone="info" title={`Part of your Skill Improvement Loop: ${b.mission.title}`}>
        <p>{text}</p>
        <p className="mt-2"><LinkButton to={`/loop/${loop.id}`} size="sm" variant="primary" data-testid="back-to-loop">Back to the loop</LinkButton></p>
      </Callout>
    </div>
  );
}
