import type { SkillContent } from '@/domain/skills/model';
import { collapseContext, diffSkills, diffSummary } from '@/domain/skills/diff';
import { Badge, Callout, cx } from '@/components/ui';

/**
 * Side-by-side-free diff of two Skill versions: metadata, instructions (line diff), supporting files.
 * Added/removed lines carry a text marker and screen-reader text, never colour alone.
 */
export function SkillDiffView({ before, after, beforeLabel, afterLabel }: { before: SkillContent; after: SkillContent; beforeLabel: string; afterLabel: string }) {
  const d = diffSkills(before, after);
  if (d.identical) {
    return <Callout tone="info" title="No difference" role="status">{afterLabel} is identical to {beforeLabel}: the generated SKILL.md and supporting files are the same.</Callout>;
  }
  const lines = collapseContext(d.body, 2);
  return (
    <div className="space-y-3" data-testid="skill-diff">
      <p className="text-sm"><strong>{beforeLabel}</strong> → <strong>{afterLabel}</strong>: <span data-testid="diff-summary">{diffSummary(d)}</span></p>
      {d.triggerChanged && <Callout tone="warn" title="The trigger text changed">Changing the description or when_to_use changes when Claude loads this Skill. Re-run your trigger scenarios and live tests.</Callout>}
      {d.metadata.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Metadata</h4>
          <ul className="mt-1 space-y-2">
            {d.metadata.map((m) => (
              <li key={m.field} className="rounded-lg border border-line p-2 text-sm">
                <p className="font-mono text-xs text-muted">{m.field}</p>
                <p className="whitespace-pre-wrap break-words"><span className="font-semibold text-bad">− <span className="sr-only">removed: </span></span>{m.before || <em className="text-muted">(not set)</em>}</p>
                <p className="whitespace-pre-wrap break-words"><span className="font-semibold text-ok">+ <span className="sr-only">added: </span></span>{m.after || <em className="text-muted">(not set)</em>}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(d.bodyAdded > 0 || d.bodyRemoved > 0) && (
        <div>
          <h4 className="text-sm font-semibold">Instructions <span className="font-normal text-muted">(+{d.bodyAdded} / −{d.bodyRemoved} lines)</span></h4>
          <div role="group" aria-label="Instruction diff" tabIndex={0} className="code-scroll mt-1 rounded-lg border border-line bg-surface2 py-1 font-mono text-[0.8rem] leading-6">
            {lines.map((l, i) =>
              l.kind === 'gap' ? (
                <div key={`g${i}`} className="px-3 text-xs text-muted">… {l.hidden} unchanged line(s) …</div>
              ) : (
                <div key={`${i}`} className={cx('flex min-w-max border-l-4', l.kind === 'add' ? 'border-l-ok bg-surface3' : l.kind === 'remove' ? 'border-l-bad bg-surface3' : 'border-l-transparent')}>
                  <span className="w-5 shrink-0 select-none text-center font-semibold" aria-hidden="true">{l.kind === 'add' ? '+' : l.kind === 'remove' ? '−' : ' '}</span>
                  <span className="whitespace-pre pr-3">{l.kind !== 'same' && <span className="sr-only">{l.kind === 'add' ? 'added: ' : 'removed: '}</span>}{l.text || ' '}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}
      {d.resources.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Supporting files</h4>
          <ul className="mt-1 flex flex-wrap gap-2">{d.resources.map((r) => <li key={r.path}><Badge tone={r.change === 'removed' ? 'bad' : r.change === 'added' ? 'ok' : 'warn'}>{r.change}</Badge> <code className="text-xs">{r.path}</code></li>)}</ul>
        </div>
      )}
      {(d.scenarios.added > 0 || d.scenarios.removed > 0) && <p className="text-sm text-muted">Trigger scenarios: +{d.scenarios.added} / −{d.scenarios.removed}</p>}
    </div>
  );
}
