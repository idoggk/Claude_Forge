import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, useToast } from '@/components/ui';
import { IMPORT_LABEL_MEANING, previewExperimentImport, type ExperimentImportResult, type ImportLabel } from '@/domain/experiments/importer';
import { addEvidence, saveExperiment } from '@/persistence/repo';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/clock';

const TONE: Record<ImportLabel, 'teal' | 'neutral' | 'warn' | 'bad'> = { parsed: 'teal', 'user-supplied': 'neutral', inferred: 'warn', unknown: 'bad' };
const LABEL: Record<ImportLabel, string> = { parsed: 'Parsed', 'user-supplied': 'User-supplied', inferred: 'Inferred', unknown: 'Unknown' };

/** Import a previously exported experiment record: parsed as data, previewed in full, and only saved after an explicit confirmation. */
export function ImportExperimentPanel({ file, onClose }: { file: File; onClose: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [result, setResult] = useState<ExperimentImportResult | null>(null);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!started) {
    setStarted(true);
    void file.text().then((t) => setResult(previewExperimentImport(t, newId, nowIso())));
  }
  if (!result) return <Card><p role="status" className="text-sm text-muted">Reading the file as data…</p></Card>;
  if (!result.ok) return <div className="mb-4"><Callout tone="bad" role="alert" title="Could not import that file">{result.error}<div className="mt-2"><Button size="sm" onClick={onClose}>Close</Button></div></Callout></div>;
  const { preview, experiment, evidence } = result;
  const confirm = async () => {
    setBusy(true);
    try {
      await saveExperiment(experiment);
      for (const e of evidence) await addEvidence({ ...e, experimentId: experiment.id });
      toast('Imported as a new experiment');
      nav(`/battle-lab/${experiment.id}`);
    } finally { setBusy(false); }
  };
  return (
    <Card className="mb-6" aria-labelledby="imp-h" data-testid="import-preview">
      <h2 id="imp-h" className="text-xl font-semibold">Preview before importing</h2>
      <p className="mt-1 text-sm text-muted">Nothing has been saved. Importing creates a <strong>new</strong> experiment; it never overwrites an existing one and never runs anything in the file.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {preview.fields.map((f) => (
          <div key={f.field} className="rounded-lg border border-line p-2 text-sm"><dt className="flex flex-wrap items-center gap-2 font-semibold">{f.field}<Badge tone={TONE[f.label]}>{LABEL[f.label]}</Badge></dt><dd className="break-words text-muted">{f.value}</dd></div>
        ))}
      </dl>
      <details className="mt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">What the labels mean</summary><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{(Object.keys(IMPORT_LABEL_MEANING) as ImportLabel[]).map((k) => <li key={k}>{IMPORT_LABEL_MEANING[k]}</li>)}</ul></details>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" data-testid="import-warnings">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="primary" onClick={() => void confirm()} disabled={busy} data-testid="confirm-import-experiment">Import as a new experiment</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
    </Card>
  );
}
