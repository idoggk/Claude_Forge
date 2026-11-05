import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Item } from '@/domain/curriculum/types';
import type { AttemptGrade, ExternalResults } from '@/domain/assessment/grade';
import { gradeAttempt } from '@/domain/assessment/grade';
import { CONFIDENCE_LEVELS } from '@/domain/assessment/calibration';
import { evaluateExternal } from '@/domain/assessment/external';
import { Button, Callout, cx } from '@/components/ui';
import { newId } from '@/lib/ids';
import { useLive } from '@/persistence/useLive';
import { loadExternalInputs } from '@/persistence/repo';
import { ItemView, useInitialAnswers } from './ItemView';

export interface RunnerSubmit {
  attemptId: string;
  startedAt: string;
  answers: Record<string, unknown>;
  hintsUsed: number;
  confidence: number | null;
}

export interface RunnerProps {
  items: Item[];
  /** Used to make shuffles stable per exercise. */
  seed: string;
  mode: 'practice' | 'assessment' | 'review';
  /** Asks "How confident are you?" BEFORE the questions appear. */
  askConfidence: boolean;
  allowHints: boolean;
  submitLabel?: string;
  onSubmit: (s: RunnerSubmit) => Promise<{ grade: AttemptGrade; extra?: ReactNode } | null>;
  /** Called after a result is shown and the learner asks to try again. */
  onRetry?: () => void;
  intro?: ReactNode;
}

export function ExerciseRunner({ items, seed, mode, askConfidence, allowHints, submitLabel = 'Submit answers', onSubmit, onRetry, intro }: RunnerProps) {
  const [attemptId, setAttemptId] = useState(() => newId('att'));
  const startedAt = useRef(new Date().toISOString());
  const initial = useInitialAnswers(items, seed);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial);
  const [hints, setHints] = useState<Record<string, number>>({});
  const [confidence, setConfidence] = useState<number | null>(null);
  const [started, setStarted] = useState(!askConfidence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ grade: AttemptGrade; extra?: ReactNode } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const { data: ext } = useLive(async () => {
    const i = await loadExternalInputs();
    return evaluateExternal(i.skills, i.experiments, i.evidence);
  }, []);
  const external: ExternalResults = ext ?? {};

  const hintsUsed = Object.values(hints).reduce((a, b) => a + b, 0);
  const answerable = items.filter((i) => i.kind !== 'external' && i.kind !== 'reflect');
  const answeredCount = answerable.filter((i) => {
    const v = answers[i.id];
    if (v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
    return true;
  }).length;

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await onSubmit({ attemptId, startedAt: startedAt.current, answers, hintsUsed: allowHints ? hintsUsed : 0, confidence });
      if (r) setResult(r);
      else setError('This attempt was already recorded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this attempt.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setAttemptId(newId('att'));
    startedAt.current = new Date().toISOString();
    setAnswers(initial);
    setHints({});
    setResult(null);
    setError('');
    setConfidence(null);
    setStarted(!askConfidence);
    onRetry?.();
  };

  if (askConfidence && !started) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5" data-testid="confidence-panel">
        {intro}
        <h3 className="mt-3 text-lg font-semibold">How confident are you?</h3>
        <p className="mt-1 text-sm text-muted">Before you see the questions: how well do you expect to do? After you submit, Forge compares your prediction with the result. Overconfidence is useful information, not a penalty - and hints are not available in assessments.</p>
        <div role="radiogroup" aria-label="Confidence before the assessment" className="mt-3 grid gap-2 sm:grid-cols-5">
          {CONFIDENCE_LEVELS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={confidence === c.value}
              onClick={() => setConfidence(c.value)}
              data-testid={`confidence-${c.value}`}
              className={cx('transition-forge min-h-14 rounded-lg border p-2 text-sm font-semibold', confidence === c.value ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2')}
            >
              {c.label}
              <span className="block text-xs font-normal text-muted">~{c.predictedPct}% expected</span>
            </button>
          ))}
        </div>
        <Button className="mt-4" variant="primary" size="lg" disabled={confidence === null} onClick={() => setStarted(true)} data-testid="start-assessment">Start assessment</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!result && intro}
      {items.map((item, i) => (
        <ItemView
          key={item.id}
          item={item}
          index={i}
          value={answers[item.id]}
          onChange={(v) => setAnswers((a) => ({ ...a, [item.id]: v }))}
          disabled={Boolean(result) || busy}
          grade={result?.grade.results.find((r) => r.itemId === item.id)}
          hintsShown={hints[item.id] ?? 0}
          onHint={allowHints ? () => setHints((h) => ({ ...h, [item.id]: (h[item.id] ?? 0) + 1 })) : undefined}
          external={item.kind === 'external' ? external[item.check] : undefined}
          seed={seed}
          optionSeed={`${seed}:${attemptId}`}
        />
      ))}

      {!result && (
        <div className="sticky bottom-20 z-20 rounded-xl border border-line bg-surface/95 p-3 backdrop-blur lg:bottom-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => void submit()} disabled={busy} data-testid="submit-answers">{busy ? 'Saving…' : submitLabel}</Button>
            <p className="text-sm text-muted" aria-live="polite">{answeredCount} of {answerable.length} answered{allowHints && hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} used` : ''}</p>
          </div>
          {answeredCount < answerable.length && <p className="mt-1 text-xs text-muted">Unanswered questions score zero. You can still submit.</p>}
          {error && <div className="mt-2"><Callout tone="bad" role="alert" title="Could not save">{error}</Callout></div>}
        </div>
      )}

      {result && (
        <div ref={resultRef} tabIndex={-1} className="space-y-3 rounded-xl border border-accent bg-surface p-4 focus:outline-none sm:p-5" data-testid="results" aria-live="polite">
          <h3 className="text-xl font-semibold">
            Result: <span data-testid="result-score">{Math.round(result.grade.score * 100)}%</span>{' '}
            {mode !== 'practice' && (result.grade.passed ? <span className="text-ok">· Passed</span> : <span className="text-bad">· Not passed yet</span>)}
          </h3>
          {result.grade.criticalFailed.length > 0 && (
            <Callout tone="warn" title="A mandatory check was missed">A missed mandatory check caps your level for that concept at &ldquo;Guided application&rdquo;, however well you did elsewhere. It can be earned back through review.</Callout>
          )}
          {result.grade.selfAssessedCount > 0 && <p className="text-sm text-muted">Self-assessed items are recorded but never counted toward your score or mastery.</p>}
          {result.extra}
          <div className="flex flex-wrap gap-2">
            {mode === 'practice' && <Button onClick={reset} data-testid="try-again">Try again with a fresh attempt</Button>}
            {mode === 'assessment' && !result.grade.passed && <Button onClick={reset} data-testid="retake">Retake (counts as guided practice)</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

export { gradeAttempt };
