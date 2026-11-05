import { useEffect, useState } from 'react';
import { Badge, Button, Callout, Card, ConfirmButton, PageHeader, SafeLink, Segmented, TextInput, useToast } from '@/components/ui';
import { useData } from '@/app/providers/DataProvider';
import { applyImport, exportAll, hasAnyUserData, parseBackup, serializeBackup, type ImportMode, type ParsedImport } from '@/persistence/backup';
import { getDb } from '@/persistence/db';
import { resetEverything } from '@/persistence/repo';
import { useLive } from '@/persistence/useLive';
import { downloadText } from '@/lib/download';
import { getClockOffsetDays, nowIso, setClockOffsetDays, todayKey } from '@/lib/clock';
import { CATALOG_SNAPSHOT_DATE } from '@/content/catalog/entries';

export const APP_VERSION = '0.1.0';
const dayStamp = () => nowIso().slice(0, 10);

function DataSection() {
  const toast = useToast();
  const { data: meta } = useLive(() => getDb().meta.get('lastBackupAt'));
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const doExport = async () => {
    const text = serializeBackup(await exportAll());
    downloadText(text, `claude-forge-backup-${dayStamp()}.json`, 'application/json');
    await getDb().meta.put({ key: 'lastBackupAt', value: nowIso() });
    toast('Backup downloaded');
  };

  const onFile = async (file: File | undefined) => {
    setDone(null);
    setParsed(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 25 * 1024 * 1024) { setParsed({ preview: { ok: false, fatal: 'File is larger than 25 MB.', version: null, exportedAt: null, counts: {} as never, invalid: [], invalidCount: 0, warnings: [] }, valid: null }); return; }
    setParsed(parseBackup(await file.text()));
  };

  const doImport = async () => {
    if (!parsed?.valid) return;
    setBusy(true);
    try {
      if (await hasAnyUserData()) {
        downloadText(serializeBackup(await exportAll()), `claude-forge-backup-before-import-${dayStamp()}.json`, 'application/json');
      }
      const { written } = await applyImport(parsed.valid, mode);
      const total = Object.values(written).reduce((a, b) => a + b, 0);
      setDone(`Imported ${total} record(s) (${mode}). A backup of your previous data was downloaded first.`);
      setParsed(null);
      toast('Import complete');
    } catch (e) {
      toast(`Import failed - nothing was changed. ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const p = parsed?.preview;
  const canImport = Boolean(parsed?.valid && p && !p.fatal && (p.ok || skipInvalid));

  return (
    <Card aria-labelledby="data-h">
      <h2 id="data-h" className="text-lg font-semibold">Your data</h2>
      <p className="mt-1 text-sm text-muted">Everything lives in this browser&apos;s IndexedDB. It does <strong>not</strong> sync between devices and there is no server copy. Export a backup to keep it safe or to move it to your iPhone or another computer.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" icon="download" onClick={() => void doExport()} data-testid="export-backup">Export backup (.json)</Button>
        <span className="text-sm text-muted">Last backup: {meta?.value ? new Date(String(meta.value)).toLocaleString() : 'never'}</span>
      </div>
      <div className="mt-2 text-sm text-muted">
        Storage persistence: {persisted === null ? 'unknown' : persisted ? 'granted' : 'not granted'}{' '}
        {persisted === false && <Button size="sm" variant="ghost" onClick={async () => setPersisted(Boolean(await navigator.storage?.persist?.()))}>Ask the browser to keep my data</Button>}
        <p className="text-xs">Some browsers - notably Safari on iPhone - may clear site data after long periods of non-use. Adding the app to your Home Screen and exporting backups regularly are the safe habits.</p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-semibold">Restore or import</h3>
        <p className="text-sm text-muted">The file is validated and previewed first. Nothing is written until you confirm, and the write is all-or-nothing.</p>
        <div className="mt-2">
          <label htmlFor="import-file" className="block text-sm font-semibold">Backup file</label>
          <input id="import-file" type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0])} className="mt-1 block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface2 file:px-4 file:font-semibold file:text-fg" data-testid="import-file" />
        </div>
        {p?.fatal && <div className="mt-3"><Callout tone="bad" title="This file cannot be imported" role="alert"><span data-testid="import-error">{p.fatal}</span> Your existing data was not touched.</Callout></div>}
        {p && !p.fatal && (
          <div className="mt-3 space-y-3" data-testid="import-preview">
            <Callout tone={p.ok ? 'ok' : 'warn'} title={`${fileName}: backup format v${p.version}${p.exportedAt ? `, exported ${new Date(p.exportedAt).toLocaleString()}` : ''}`}>
              {p.ok ? 'Every record passed validation.' : `${p.invalidCount} record(s) failed validation and cannot be imported as-is.`}
            </Callout>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">{Object.entries(p.counts).filter(([, n]) => n > 0).map(([k, n]) => <li key={k}><Badge>{n}</Badge> {k}</li>)}</ul>
            {p.invalid.length > 0 && <details open><summary className="cursor-pointer text-sm font-semibold">Invalid records ({p.invalidCount})</summary><ul className="mt-1 list-disc pl-5 text-sm text-muted" data-testid="invalid-list">{p.invalid.slice(0, 10).map((v, i) => <li key={i}>{v.store}[{v.index}]: {v.message}</li>)}</ul></details>}
            {p.warnings.map((w) => <p key={w} className="text-sm text-muted">{w}</p>)}
            {!p.ok && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} />Import only the valid records and skip the rest</label>}
            <div role="radiogroup" aria-label="Import mode" className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1 accent-[var(--accent)]" /><span><strong>Merge</strong> - keep what you have; add new records; newer records win; attempts are never overwritten.</span></label>
              <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1 accent-[var(--accent)]" /><span><strong>Replace</strong> - discard current data and use the file. A backup of the current data is downloaded first.</span></label>
            </div>
            {mode === 'replace' ? <ConfirmButton label="Import and replace" confirmLabel={busy ? 'Importing…' : 'Yes, replace my data'} icon="upload" size="md" onConfirm={doImport} /> : <Button variant="primary" icon="upload" disabled={!canImport || busy} onClick={() => void doImport()} data-testid="do-import">Import (merge)</Button>}
            {mode === 'replace' && !canImport && <p className="text-sm text-bad">Tick &ldquo;import only the valid records&rdquo; or fix the file first.</p>}
          </div>
        )}
        {done && <div className="mt-3"><Callout tone="ok" title="Done" role="status"><span data-testid="import-done">{done}</span></Callout></div>}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-semibold text-bad">Delete everything</h3>
        <p className="text-sm text-muted">Removes all progress, Skills, experiments and notes from this browser. Export a backup first.</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <TextInput label="Type DELETE to enable" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <Button variant="danger" disabled={confirmText !== 'DELETE'} onClick={async () => { await resetEverything(); setConfirmText(''); toast('All local data deleted'); window.location.hash = '#/onboarding'; }} data-testid="reset-all">Delete all my data</Button>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { prefs, setPrefs } = useData();
  const [offset, setOffset] = useState(getClockOffsetDays());
  const toast = useToast();
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title="Settings and data" subtitle="Appearance, backups, privacy and what this app does not do." />
      <Card aria-labelledby="look-h">
        <h2 id="look-h" className="text-lg font-semibold">Appearance</h2>
        <div className="mt-3 space-y-4">
          <div><p className="mb-1 text-sm font-semibold">Theme</p><Segmented label="Theme" value={prefs.theme} onChange={(theme) => void setPrefs({ theme })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Match system' }]} /></div>
          <div><p className="mb-1 text-sm font-semibold">Motion</p><Segmented label="Motion" value={prefs.motion} onChange={(motion) => void setPrefs({ motion })} options={[{ value: 'system', label: 'Match system' }, { value: 'reduce', label: 'Reduce' }, { value: 'full', label: 'Full' }]} /></div>
        </div>
      </Card>
      <DataSection />
      <Card aria-labelledby="priv-h">
        <h2 id="priv-h" className="text-lg font-semibold">Privacy</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>No accounts, no analytics, no tracking, no third-party requests at runtime. After the first load the app works offline.</li>
          <li>Claude Forge never asks for a Claude API key and never sends code, prompts or learning records anywhere.</li>
          <li>It never executes imported Skills, scripts or JavaScript, and never installs anything on your machine. Skill exports are ZIP files you download and place yourself.</li>
          <li>Catalog and lesson text is rendered as safe Markdown (raw HTML is not rendered, images are dropped, only https links are active).</li>
        </ul>
      </Card>
      <Card aria-labelledby="test-h">
        <h2 id="test-h" className="text-lg font-semibold">Testing tools</h2>
        <p className="mt-1 text-sm text-muted">Spaced review is scheduled by calendar day. To see a review become due without waiting, move this app&apos;s clock forward. It affects scheduling only, is stored on this device, and should be reset to 0 afterwards.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TextInput label="Clock offset (days)" type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value) || 0)} data-testid="clock-offset" />
          <Button onClick={() => { setClockOffsetDays(offset); toast(`Clock set ${offset >= 0 ? '+' : ''}${offset} day(s)`); }} data-testid="apply-offset">Apply</Button>
          <Button variant="ghost" onClick={() => { setOffset(0); setClockOffsetDays(0); toast('Clock reset'); }}>Reset</Button>
        </div>
        <p className="mt-2 text-sm">App &ldquo;today&rdquo;: <strong data-testid="app-today">{todayKey()}</strong></p>
      </Card>
      <Card aria-labelledby="about-h">
        <h2 id="about-h" className="text-lg font-semibold">About and limitations</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-muted">Version</dt><dd>{APP_VERSION}</dd></div>
          <div><dt className="font-semibold text-muted">Catalog snapshot</dt><dd>{CATALOG_SNAPSHOT_DATE} (committed; it does not update itself)</dd></div>
        </dl>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Claude Forge does not run Claude. Experiments are recorded by hand; every metric is self-reported or user-imported and unverified.</li>
          <li>Trigger checks are lexical heuristics, not predictions of Claude&apos;s behaviour. Only live tests in Claude Code show that.</li>
          <li>Catalog facts were read from the pages below through an automated fetch-and-summarize step on {CATALOG_SNAPSHOT_DATE}; nothing was cloned or executed. The Agent Skills specification site could not be reached during authoring, so name and length rules for the portable format follow the Claude Code docs and should be re-checked against the spec.</li>
          <li>Game fixtures are original, synthetic and educational. They are not telemetry or code from One More Merge.</li>
        </ul>
        <p className="mt-3 text-sm font-semibold">Primary sources</p>
        <ul className="mt-1 space-y-1 text-sm">
          {['https://code.claude.com/docs/en/skills', 'https://code.claude.com/docs/en/plugins', 'https://code.claude.com/docs/en/discover-plugins', 'https://code.claude.com/docs/en/plugin-marketplaces', 'https://github.com/anthropics/skills', 'https://github.com/obra/superpowers', 'https://github.com/getsentry/skills', 'https://github.com/vercel-labs/agent-skills', 'https://github.com/microsoft/playwright-mcp', 'https://github.com/modelcontextprotocol/servers'].map((u) => <li key={u}><SafeLink href={u}>{u}</SafeLink></li>)}
        </ul>
      </Card>
    </div>
  );
}
