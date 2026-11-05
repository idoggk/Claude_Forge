import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, useToast } from '@/components/ui';
import { IMPORT_LIMITS, importSkillZip, type ZipImportResult } from '@/domain/skills/importZip';
import { SkillDraftSchema } from '@/domain/skills/model';
import { saveSkill, snapshotRevision } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const DISPOSITION_TONE = { 'skill-md': 'ok', resource: 'neutral', script: 'warn', skipped: 'neutral', rejected: 'bad' } as const;

/**
 * Import a Skill ZIP as an INERT, editable draft. Nothing is executed, installed, fetched or written to disk; the
 * learner sees exactly what was kept and what was refused before anything is saved.
 */
export function ImportPanel() {
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ZipImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (file.size > IMPORT_LIMITS.zipBytes) {
      setResult({ ok: false, fatal: `The ZIP is ${(file.size / 1e6).toFixed(1)} MB; the limit is ${IMPORT_LIMITS.zipBytes / 1e6} MB. A Skill is a few text files.`, root: null, content: null, entries: [], findings: [], ignoredFields: [] });
      return;
    }
    setBusy(true);
    try {
      setResult(await importSkillZip(await file.arrayBuffer()));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!result?.content) return;
    const now = nowIso();
    const base = SkillDraftSchema.parse({ ...result.content, id: newId('skill'), createdAt: now, updatedAt: now });
    const draft = { ...base, revisions: [snapshotRevision(base, 'Imported from ZIP (inert copy)')] };
    await saveSkill(draft);
    toast('Draft created from the ZIP - nothing was run or installed');
    nav(`/workshop/${draft.id}`);
  };

  const blocking = result?.findings.filter((f) => f.severity === 'error') ?? [];
  return (
    <section className="mt-8" aria-labelledby="import-h" data-testid="import-panel">
      <h2 id="import-h" className="text-xl font-semibold">Import a Skill ZIP as an editable draft</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">Open a Skill someone gave you (or one you exported) to study, scan and edit it. The archive is read as data only: nothing is executed, installed, fetched or written to disk, scripts stay plain text, and unsafe or binary files are refused and listed.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" id="import-zip" aria-label="Choose a Skill ZIP to import" tabIndex={-1} data-testid="import-zip" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        <Button icon="upload" onClick={() => input.current?.click()} disabled={busy} data-testid="import-choose">{busy ? 'Reading…' : 'Choose a Skill ZIP'}</Button>
        {fileName && <span className="text-sm text-muted">{fileName}</span>}
      </div>

      {result && (
        <div className="mt-4 space-y-3" data-testid="import-report" aria-live="polite">
          {result.fatal ? (
            <Callout tone="bad" title="This ZIP cannot be imported" role="alert">{result.fatal}</Callout>
          ) : (
            <Callout tone={blocking.length ? 'warn' : 'info'} title={blocking.length ? 'Imported with serious findings - read them first' : 'Ready to import as a draft'}>
              {result.content ? <>Skill <code>{result.content.name || '(unnamed)'}</code> with {result.content.references.length} supporting file(s). A clean scan is not approval and a finding is not proof: read the files yourself.</> : 'See the findings below.'}
            </Callout>
          )}
          {result.findings.length > 0 && (
            <ul className="space-y-1 text-sm" data-testid="import-findings">
              {result.findings.map((f, i) => <li key={i} className="flex gap-2"><Badge tone={f.severity === 'error' ? 'bad' : f.severity === 'warning' ? 'warn' : 'neutral'}>{f.severity}</Badge><span>{f.message}{f.fix && <span className="block text-muted">Fix: {f.fix}</span>}</span></li>)}
            </ul>
          )}
          {result.entries.length > 0 && (
            <Card>
              <h3 className="font-semibold">Files in the archive</h3>
              <ul className="mt-2 space-y-1 text-sm" data-testid="import-entries">
                {result.entries.map((e) => <li key={e.path} className="flex flex-wrap items-center gap-2"><Badge tone={DISPOSITION_TONE[e.disposition]}>{e.disposition === 'skill-md' ? 'SKILL.md' : e.disposition}</Badge><code className="break-all text-xs">{e.path}</code><span className="text-muted">{e.reason}</span></li>)}
              </ul>
            </Card>
          )}
          {result.content && <Button variant="primary" onClick={() => void create()} data-testid="import-create">Create editable draft (nothing is run)</Button>}
        </div>
      )}
    </section>
  );
}
