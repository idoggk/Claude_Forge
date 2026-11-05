import { useState } from 'react';
import { Badge, Button, Callout, Card, LinkButton, TextArea, useToast } from '@/components/ui';
import { graduationRequirements } from '@/domain/loop/engine';
import { buildLoopReportJson, buildLoopReportMarkdown, finalDiffersFromV2 } from '@/domain/loop/report';
import { contentOf } from '@/domain/skills/model';
import { graduateLoop, saveReflection, toContext } from '@/persistence/loopRepo';
import { downloadText } from '@/lib/download';
import { SkillZipButton } from '../SkillZipButton';
import { RequirementList, StepHeading, type StepProps } from './shared';

export function GraduateStep({ bundle }: StepProps) {
  const { loop, mission, skill } = bundle;
  const toast = useToast();
  const [lessons, setLessons] = useState(loop.reflection.lessons);
  const [application, setApplication] = useState(loop.reflection.application);
  const [err, setErr] = useState<string | null>(null);
  const graduated = loop.graduatedAt !== null;
  // State is initialised from the saved reflection once. Never re-synced from storage while typing: a save triggered
  // by leaving one field must not overwrite what is being typed in the other.

  const persistReflection = async () => { try { await saveReflection(loop.id, { lessons, application }); } catch { /* shown on graduate */ } };
  // Requirements are evaluated against what is typed, not only what has been saved.
  const ctx = toContext({ ...bundle, loop: { ...loop, reflection: { ...loop.reflection, lessons, application } } });
  const reqs = graduationRequirements(ctx);
  const md = buildLoopReportMarkdown(bundle);
  const slug = mission.id;

  return (
    <div className="space-y-4">
      <StepHeading n={8} title="Graduate and export">Write down what you learned, then export a report that someone else could audit.</StepHeading>

      {!graduated && (
        <Card className="space-y-3">
          <TextArea label="What did you learn about how this Skill behaves?" rows={4} value={lessons} onChange={(e) => setLessons(e.target.value)} onBlur={() => void persistReflection()} data-testid="reflection-lessons" hint="Which signal changed your mind? Did the revision help, and how sure are you?" />
          <TextArea label="How will you apply this to a real project?" rows={4} value={application} onChange={(e) => setApplication(e.target.value)} onBlur={() => void persistReflection()} data-testid="reflection-application" hint={mission.transferPrompt} />
          <RequirementList items={reqs} label="Graduation requirements" />
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <Button variant="primary" disabled={reqs.some((r) => !r.ok)} data-testid="graduate" onClick={async () => { setErr(null); try { await saveReflection(loop.id, { lessons, application }); await graduateLoop(loop.id); toast('Loop graduated'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not graduate'); } }}>Graduate this loop</Button>
        </Card>
      )}

      {graduated && (
        <Callout tone="ok" title="Loop graduated" role="status">
          Your Skill has been through a baseline, a measured v1, a hypothesis-driven v2 and a held-out test. That is a stronger record than most Skills ever get - and it is still a synthetic fixture. Graduating does not make the Skill &ldquo;field-proven&rdquo;; that needs evidence from a real project.
        </Callout>
      )}

      {finalDiffersFromV2(bundle) && <Callout tone="warn" title="Your Skill was edited after v2">The held-out result describes v2. The edited Skill has not been tested; the report says so.</Callout>}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Skill Improvement Report</h3><Badge tone={graduated ? 'ok' : 'warn'}>{graduated ? 'final' : 'draft - not final until you graduate'}</Badge></div>
        <div className="flex flex-wrap items-start gap-2">
          <Button variant="primary" icon="download" onClick={() => { downloadText(md, `skill-improvement-report-${slug}.md`, 'text/markdown'); toast('Report exported (Markdown)'); }} data-testid="export-loop-md">Export report (Markdown)</Button>
          <Button icon="download" onClick={() => { downloadText(buildLoopReportJson(bundle), `skill-improvement-report-${slug}.json`, 'application/json'); toast('Report exported (JSON)'); }} data-testid="export-loop-json">Export record (JSON)</Button>
          <SkillZipButton content={skill ? contentOf(skill) : null} label="Download final Skill (ZIP)" suffix="final" testId="download-final" />
        </div>
        <pre tabIndex={0} className="code-scroll max-h-[28rem] rounded-lg border border-line bg-surface2 p-3 text-xs" data-testid="loop-report-preview"><code>{md}</code></pre>
      </Card>

      {graduated && skill && (
        <Card className="space-y-2">
          <h3 className="font-semibold">Next: take it to a real project</h3>
          <p className="text-sm text-muted">{mission.transferPrompt}</p>
          <p className="text-sm text-muted">When you have used the Skill on real work, record what happened as field evidence in the Workshop (Export tab). Only that - not this loop - can take the Skill past &ldquo;tested on a fixture&rdquo;.</p>
          <div className="flex flex-wrap gap-2"><LinkButton to={`/workshop/${skill.id}?loop=${loop.id}`} icon="hammer">Open the Skill</LinkButton><LinkButton to="/loop">Back to the Loop hub</LinkButton></div>
        </Card>
      )}
    </div>
  );
}
