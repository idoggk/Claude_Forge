import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, ConfirmButton, EmptyState, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { activeStep, computeSteps } from '@/domain/loop/engine';
import type { LoopStepId } from '@/domain/loop/types';
import { deleteLoop, toContext } from '@/persistence/loopRepo';
import { Stepper } from './Stepper';
import { useLoopBundle } from './useLoop';
import { MissionStep } from './steps/MissionStep';
import { BaselineStep } from './steps/BaselineStep';
import { BuildStep } from './steps/BuildStep';
import { TestStep } from './steps/TestStep';
import { EvaluateStep } from './steps/EvaluateStep';
import { ImproveStep } from './steps/ImproveStep';
import { HeldoutStep } from './steps/HeldoutStep';
import { GraduateStep } from './steps/GraduateStep';

const AUTO_ADVANCE = new Set<LoopStepId>(['baseline', 'build', 'test']);

export default function LoopPage() {
  const { loopId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: bundle, loading } = useLoopBundle(loopId);
  // null until the first data arrives; then the step on screen.
  const [viewed, setViewed] = useState<LoopStepId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => (bundle ? computeSteps(toContext(bundle)) : []), [bundle]);
  const active = steps.length ? activeStep(steps) : 'mission';

  // A brand-new loop opens on the mission briefing. After that the page moves on by itself ONLY when you finish a
  // recording step (baseline, build, test). Steps that end in results you need to read (evaluate, improve, held-out)
  // stay put until you press their "continue" button.
  const prevActive = useRef<LoopStepId | null>(null);
  useEffect(() => {
    if (!bundle) return;
    const prev = prevActive.current;
    prevActive.current = active;
    if (prev === null) {
      setViewed((bundle.dev?.runs.length ?? 0) === 0 && !bundle.loop.skillId ? 'mission' : active);
      return;
    }
    if (prev !== active) setViewed((v) => (v === prev && AUTO_ADVANCE.has(prev) ? active : v));
  }, [active, bundle]);
  const shown: LoopStepId = viewed ?? active;

  // Move focus to the step heading when the step changes, so keyboard and screen-reader users land on the new content.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    panelRef.current?.querySelector<HTMLElement>('[data-testid="step-title"]')?.focus({ preventScroll: false });
  }, [shown]);

  if (loading) return <Spinner label="Opening the loop" />;
  if (!bundle) return <EmptyState title="Loop not found" action={<LinkButton to="/loop" variant="primary">Back to the Loop hub</LinkButton>}>It may have been deleted.</EmptyState>;

  const goto = (s: LoopStepId) => setViewed(s);
  const status = steps.find((s) => s.id === shown);
  const props = { bundle, goto };
  const body = {
    mission: <MissionStep {...props} />,
    baseline: <BaselineStep {...props} />,
    build: <BuildStep {...props} />,
    test: <TestStep {...props} />,
    evaluate: <EvaluateStep {...props} />,
    improve: <ImproveStep {...props} />,
    heldout: <HeldoutStep {...props} />,
    graduate: <GraduateStep {...props} />,
  }[shown];

  return (
    <div>
      <PageHeader
        eyebrow="Skill Improvement Loop"
        title={bundle.mission.title}
        subtitle={bundle.mission.tagline}
        actions={
          <>
            <Badge tone={bundle.loop.status === 'graduated' ? 'ok' : bundle.loop.status === 'abandoned' ? 'neutral' : 'accent'}>{bundle.loop.status}</Badge>
            <LinkButton to="/loop" variant="ghost" size="sm">All loops</LinkButton>
            <ConfirmButton label="Delete loop" confirmLabel="Delete loop and its experiments" onConfirm={async () => { await deleteLoop(bundle.loop.id); toast('Loop deleted (your Skill draft was kept)'); nav('/loop'); }} />
          </>
        }
      />
      <Stepper steps={steps} shown={shown} onSelect={(id) => goto(id)} />
      {status && <p className="mt-2 text-sm text-muted" data-testid="step-summary">{status.summary}{shown !== active ? <> · <button type="button" className="text-accent-text underline" onClick={() => setViewed(active)}>go to the next step</button></> : null}</p>}
      <div className="mt-5" ref={panelRef} data-testid={`panel-${shown}`}>{body}</div>
    </div>
  );
}
