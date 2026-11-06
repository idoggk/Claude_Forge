import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Callout, Card, ConfirmButton, EmptyState, LinkButton, PageHeader, SelectField, Spinner, TextInput, useToast } from '@/components/ui';
import { usePlaybooks, useSkills, useTransferTasks } from '@/app/hooks';
import { LESSONS } from '@/content/lessons';
import { TRANSFER_KINDS, TRANSFER_KIND_LABELS, newTransferTask, transferTaskToMarkdown, type TransferKind } from '@/domain/transfer/model';
import { deleteTransferTask, saveTransferTask } from '@/persistence/repo';
import { downloadText } from '@/lib/download';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'transfer-task';
const STATUS_TONE = { planned: 'neutral', 'in-progress': 'accent', completed: 'ok', abandoned: 'warn' } as const;

export default function TransferPage() {
  const { data: tasks } = useTransferTasks();
  const { data: playbooks } = usePlaybooks();
  const { data: skills } = useSkills();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TransferKind>('prompt-technique');
  const [sourceKind, setSourceKind] = useState<'none' | 'lesson' | 'playbook' | 'skill'>((params.get('source') as 'lesson' | 'playbook' | 'skill' | null) ?? 'none');
  const [sourceId, setSourceId] = useState(params.get('id') ?? '');
  if (!tasks || !playbooks || !skills) return <Spinner label="Loading transfer tasks" />;

  const sources = sourceKind === 'lesson' ? LESSONS.map((l) => ({ id: l.id, label: `Lesson ${l.order}: ${l.title}` })) : sourceKind === 'playbook' ? playbooks.map((p) => ({ id: p.id, label: p.title })) : sourceKind === 'skill' ? skills.map((s) => ({ id: s.id, label: s.name })) : [];
  const sourceLabel = sources.find((x) => x.id === sourceId)?.label ?? '';

  const create = async () => {
    const t = newTransferTask(newId('tt'), nowIso(), { title: title.trim() || `${TRANSFER_KIND_LABELS[kind]} on real work`, kind, source: sourceKind === 'none' || !sourceId ? { kind: 'none', id: null, label: '' } : { kind: sourceKind, id: sourceId, label: sourceLabel } });
    await saveTransferTask(t);
    nav(`/transfer/${t.id}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Build"
        title="Real-world transfer"
        subtitle="Take one thing you learned to real work, with a plan, a check you can run, what actually happened and what you would change. A plan alone is never a result."
      />
      <div className="mb-5"><Callout tone="info" title="What this is and is not">A transfer task is a record you write. Claude Forge does not read your project, does not run anything, and cannot verify what you report. It is never marked complete because a plan exists, and finishing one does not change your competency levels: Level 4 evidence is logged separately, in Growth, in your own words.</Callout></div>

      <Card className="mb-6" aria-labelledby="new-tt-h">
        <h2 id="new-tt-h" className="text-xl font-semibold">Start a transfer task</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <TextInput label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Few-shot examples for my commit-message prompt" data-testid="tt-title" />
          <SelectField label="What are you taking to real work?" value={kind} onChange={(e) => setKind(e.target.value as TransferKind)} data-testid="tt-kind">{TRANSFER_KINDS.map((k) => <option key={k} value={k}>{TRANSFER_KIND_LABELS[k]}</option>)}</SelectField>
          <SelectField label="It comes from (optional)" value={sourceKind} onChange={(e) => { setSourceKind(e.target.value as typeof sourceKind); setSourceId(''); }} data-testid="tt-source-kind"><option value="none">Nothing in particular</option><option value="lesson">A lesson</option><option value="playbook">One of my playbooks</option><option value="skill">One of my Skills</option></SelectField>
          {sourceKind !== 'none' && <SelectField label="Which one" value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="tt-source-id"><option value="">Choose…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</SelectField>}
          <div className="md:col-span-2"><Button type="submit" variant="primary" icon="plus" data-testid="tt-create">Create transfer task</Button></div>
        </form>
      </Card>

      <section aria-labelledby="tt-list-h">
        <h2 id="tt-list-h" className="mb-2 text-xl font-semibold">Your transfer tasks</h2>
        {tasks.length === 0 ? (
          <EmptyState title="No transfer tasks yet" icon="target">Pick something small you have learned (one prompt technique, one Skill, one playbook step) and decide how you would check that it helps on a real task.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="tt-list">
            {tasks.map((t) => (
              <Card as="li" key={t.id} className="flex flex-col gap-2" data-testid={`tt-${t.id}`}>
                <div className="flex flex-wrap gap-2"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge><Badge>{TRANSFER_KIND_LABELS[t.kind]}</Badge>{t.status === 'completed' && <Badge tone="teal">self-declared</Badge>}</div>
                <h3 className="text-lg font-semibold"><Link className="underline-offset-2 hover:underline" to={`/transfer/${t.id}`}>{t.title}</Link></h3>
                <p className="text-sm text-muted">{t.targetProject ? `Target: ${t.targetProject}` : 'No target project named yet.'}{t.evidence.length ? ` · ${t.evidence.length} evidence note(s)` : ''}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <LinkButton size="sm" to={`/transfer/${t.id}`}>Open</LinkButton>
                  <Button size="sm" icon="download" onClick={() => downloadText(transferTaskToMarkdown(t), `${slug(t.title)}.md`, 'text/markdown')}>Markdown</Button>
                  <ConfirmButton label="Delete" confirmLabel="Really delete" onConfirm={async () => { await deleteTransferTask(t.id); toast('Deleted'); }} />
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
