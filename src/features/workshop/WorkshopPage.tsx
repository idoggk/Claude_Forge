import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, PageHeader, Spinner, TextArea, useToast } from '@/components/ui';
import { useSkills } from '@/app/hooks';
import { SkillDraftSchema, contentOf, emptyContent } from '@/domain/skills/model';
import { lintSkillMd, validateSkillContent } from '@/domain/skills/validate';
import { deleteSkill, saveSkill } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';
import { starterContent } from './starter';
import { ImportPanel } from './ImportPanel';

export default function WorkshopPage() {
  const { data: skills } = useSkills();
  const nav = useNavigate();
  const toast = useToast();
  const [paste, setPaste] = useState('');
  const [linted, setLinted] = useState<ReturnType<typeof lintSkillMd> | null>(null);

  const create = async (starter: boolean) => {
    const now = nowIso();
    const draft = SkillDraftSchema.parse({ ...(starter ? starterContent() : emptyContent()), id: newId('skill'), createdAt: now, updatedAt: now });
    await saveSkill(draft);
    toast('Skill draft created');
    nav(`/workshop/${draft.id}`);
  };

  if (!skills) return <Spinner label="Loading the Workshop" />;
  return (
    <div>
      <PageHeader eyebrow="Custom Skill Workshop" title="Build a Skill you can trust" subtitle="Author, validate, design-check, live-test and export a real Skill. Nothing is installed or executed for you." actions={<><Button variant="primary" icon="plus" onClick={() => void create(false)} data-testid="new-skill">New Skill</Button><Button onClick={() => void create(true)} data-testid="new-starter">Start from the example</Button></>} />

      {skills.length === 0 ? (
        <EmptyState title="No Skills yet" icon="hammer" action={<><Button variant="primary" onClick={() => void create(false)}>Create a blank Skill</Button><Button onClick={() => void create(true)}>Start from the example</Button></>}>
          A Skill is a folder with a <code>SKILL.md</code>. The Workshop generates it, validates it, and exports a ZIP you install yourself.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="skill-list">
          {skills.map((s) => {
            const v = validateSkillContent(contentOf(s));
            return (
              <Card as="li" key={s.id} data-testid={`skill-${s.name || s.id}`}>
                <h2 className="text-lg font-semibold"><Link className="hover:underline" to={`/workshop/${s.id}`}>{s.name || '(unnamed Skill)'}</Link></h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description || 'No description yet.'}</p>
                <p className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={v.errors === 0 ? 'ok' : 'bad'}>{v.errors === 0 ? 'valid' : `${v.errors} error(s)`}</Badge>
                  <Badge tone={v.warnings === 0 ? 'neutral' : 'warn'}>{v.warnings} warning(s)</Badge>
                  <Badge>{s.scenarios.length} scenario(s)</Badge>
                  <Badge>{s.liveTests.length} live test(s)</Badge>
                  <Badge tone={s.lastExportedAt ? 'ok' : 'neutral'}>{s.lastExportedAt ? 'exported' : 'not exported'}</Badge>
                </p>
                <div className="mt-3 flex flex-wrap gap-2"><Link to={`/workshop/${s.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg">Open</Link><ConfirmButton label="Delete" confirmLabel="Delete Skill" onConfirm={async () => { await deleteSkill(s.id); toast('Skill deleted'); }} /></div>
              </Card>
            );
          })}
        </ul>
      )}

      <ImportPanel />

      <section className="mt-8" aria-labelledby="lint-h">
        <h2 id="lint-h" className="text-xl font-semibold">Check an existing SKILL.md</h2>
        <p className="mt-1 text-sm text-muted">Paste any SKILL.md (yours or a third party&apos;s) for an advisory scan. The text is parsed as data only - never executed, fetched or saved.</p>
        <div className="mt-3 space-y-3">
          <TextArea label="SKILL.md contents" rows={7} mono value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'---\nname: my-skill\ndescription: …\n---\n\nInstructions…'} data-testid="lint-input" />
          <Button onClick={() => setLinted(lintSkillMd(paste))} disabled={!paste.trim()} data-testid="lint-run">Scan</Button>
          {linted && (
            <div data-testid="lint-output">
              <Callout tone="warn" title="Advisory only">A clean scan is not approval and a finding is not proof. Read the files yourself (Lesson 4).</Callout>
              {linted.findings.length === 0 ? <p className="mt-2 text-sm text-ok">No findings from the scanner.</p> : (
                <ul className="mt-2 space-y-2 text-sm">{linted.findings.map((f, i) => <li key={i} className="flex gap-2"><Badge tone={f.severity === 'error' ? 'bad' : f.severity === 'warning' ? 'warn' : 'neutral'}>{f.severity}</Badge><span>{f.message}{f.fix && <span className="block text-muted">Fix: {f.fix}</span>}</span></li>)}</ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
