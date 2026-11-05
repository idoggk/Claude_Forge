import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { usePlaybooks } from '@/app/hooks';
import { PLAYBOOK_TEMPLATES } from '@/content/playbook/seeds';
import { counts, duplicatePlaybook, exportPlaybookJson, exportPlaybookMarkdown, fromTemplate, newPlaybook, parsePlaybookJson } from '@/domain/playbook/ops';
import { deletePlaybook, savePlaybook } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { downloadText } from '@/lib/download';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'playbook';

export default function PlaybooksPage() {
  const { data: playbooks } = usePlaybooks();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ tone: 'ok' | 'bad' | 'warn'; text: string } | null>(null);
  const highlight = params.get('template');
  if (!playbooks) return <Spinner label="Loading playbooks" />;

  const create = async (templateId?: string) => {
    const id = newId('pb');
    const t = templateId ? PLAYBOOK_TEMPLATES.find((x) => x.templateId === templateId) : undefined;
    const pb = t ? fromTemplate(id, t, () => newId('st')) : newPlaybook(id);
    await savePlaybook(pb);
    nav(`/playbooks/${id}`);
  };

  return (
    <div>
      <PageHeader
        art="workflows"
        eyebrow="Build"
        title="AI Workflow Playbooks"
        subtitle="Write down a repeatable AI workflow: inputs, steps, a gate after each step, what happens on failure, and where a person decides. A playbook is a design. Claude Forge never runs it, and a step is only 'verified' when you write what verified it."
        actions={<><Button variant="primary" icon="plus" onClick={() => void create()} data-testid="new-playbook">New playbook</Button><Button icon="upload" onClick={() => fileRef.current?.click()} data-testid="import-playbook">Import JSON</Button></>}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import a playbook JSON file"
        data-testid="import-playbook-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const r = parsePlaybookJson(await f.text(), newId('pb'), () => newId('st'));
          if (!r.ok) return setImportMsg({ tone: 'bad', text: r.error });
          await savePlaybook(r.playbook);
          setImportMsg({ tone: r.warnings.length ? 'warn' : 'ok', text: `Imported "${r.playbook.title}". ${r.warnings.join(' ')}` });
          toast('Playbook imported');
        }}
      />
      {importMsg && <div className="mb-4"><Callout tone={importMsg.tone} title={importMsg.tone === 'bad' ? 'Could not import' : 'Imported'} role={importMsg.tone === 'bad' ? 'alert' : 'status'}>{importMsg.text}</Callout></div>}

      <section aria-labelledby="mine-h" className="mb-8">
        <h2 id="mine-h" className="mb-2 text-xl font-semibold">Your playbooks</h2>
        {playbooks.length === 0 ? (
          <EmptyState title="No playbooks yet" icon="flag">Start from one of the seeded designs below, or create a blank playbook for a task you repeat.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="playbook-list">
            {playbooks.map((p) => {
              const c = counts(p);
              return (
                <Card as="li" key={p.id} className="flex flex-col gap-2" data-testid={`playbook-${p.id}`}>
                  <div className="flex flex-wrap gap-2"><Badge>{c.total} step{c.total === 1 ? '' : 's'}</Badge><Badge tone={c.verified ? 'ok' : 'neutral'}>{c.verified} verified</Badge>{p.origin.kind !== 'blank' && <Badge tone="teal">{p.origin.kind}</Badge>}</div>
                  <h3 className="text-lg font-semibold"><Link className="underline-offset-2 hover:underline" to={`/playbooks/${p.id}`}>{p.title}</Link></h3>
                  <p className="text-sm text-muted">{p.goal || 'No goal written yet.'}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <LinkButton to={`/playbooks/${p.id}`} size="sm">Open</LinkButton>
                    <Button size="sm" icon="copy" onClick={async () => { const d = duplicatePlaybook(p, newId('pb'), () => newId('st')); await savePlaybook(d); toast('Duplicated (steps reset to planned)'); }}>Duplicate</Button>
                    <Button size="sm" icon="download" onClick={() => downloadText(exportPlaybookMarkdown(p), `${slug(p.title)}.md`, 'text/markdown')}>Markdown</Button>
                    <Button size="sm" icon="download" onClick={() => downloadText(exportPlaybookJson(p), `${slug(p.title)}.json`, 'application/json')}>JSON</Button>
                    <ConfirmButton label="Delete" confirmLabel="Really delete" onConfirm={() => void deletePlaybook(p.id)} />
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="seed-h">
        <h2 id="seed-h" className="mb-1 text-xl font-semibold">Seeded designs</h2>
        <p className="mb-3 text-sm text-muted">Exemplars written by Forge to show what a reliable design looks like. They are designs, not tested workflows: every step starts as planned.</p>
        <ul className="grid gap-3 md:grid-cols-2" data-testid="playbook-templates">
          {PLAYBOOK_TEMPLATES.map((t) => (
            <Card as="li" key={t.templateId} className={`flex flex-col gap-2 ${highlight === t.templateId ? 'ring-2 ring-accent' : ''}`} data-testid={`template-${t.templateId}`}>
              <div className="flex flex-wrap gap-2"><Badge tone="teal">{t.area === 'game-dev' ? 'Game dev' : 'General'}</Badge><Badge>{t.steps.length} steps</Badge></div>
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p className="text-sm text-muted">{t.description}</p>
              <div className="mt-auto pt-1"><Button size="sm" variant="primary" onClick={() => void create(t.templateId)} data-testid={`use-${t.templateId}`}>Copy to my playbooks</Button></div>
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}
