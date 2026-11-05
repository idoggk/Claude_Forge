import { useState } from 'react';
import { Card, SelectField } from '@/components/ui';
import { contentOf, type SkillContent, type SkillDraft } from '@/domain/skills/model';
import { SkillDiffView } from './SkillDiffView';

/** Compare any two saved versions (or the current draft) of a Skill. Read-only; nothing is changed. */
export function RevisionCompare({ draft }: { draft: SkillDraft }) {
  const revs = draft.revisions;
  const [baseId, setBaseId] = useState<string>(revs.length ? revs[revs.length - 1]!.id : 'current');
  const [targetId, setTargetId] = useState<string>('current');
  if (revs.length === 0) return null;
  const labelOf = (id: string) => (id === 'current' ? 'Current draft' : `v${revs.findIndex((r) => r.id === id) + 1} · ${revs.find((r) => r.id === id)?.label ?? ''}`);
  const pick = (id: string): SkillContent => (id === 'current' ? contentOf(draft) : revs.find((r) => r.id === id)!.snapshot);
  const options = [...revs.map((r, i) => ({ id: r.id, label: `v${i + 1} · ${r.label}` })), { id: 'current', label: 'Current draft' }];
  return (
    <Card aria-labelledby="cmp-rev-h" data-testid="revision-compare">
      <h2 id="cmp-rev-h" className="font-semibold">Compare versions</h2>
      <p className="mt-1 text-sm text-muted">See exactly what changed between two snapshots: instructions line by line, trigger wording, metadata and supporting files.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <SelectField label="From" value={baseId} onChange={(e) => setBaseId(e.target.value)} data-testid="compare-from">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField>
        <SelectField label="To" value={targetId} onChange={(e) => setTargetId(e.target.value)} data-testid="compare-to">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</SelectField>
      </div>
      <div className="mt-3"><SkillDiffView before={pick(baseId)} after={pick(targetId)} beforeLabel={labelOf(baseId)} afterLabel={labelOf(targetId)} /></div>
    </Card>
  );
}
