import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Segment } from '@/domain/curriculum/types';
import { seededOrder } from '@/domain/assessment/grade';
import { Button, Callout, cx } from '@/components/ui';

/**
 * Prediction before explanation. The learner commits to an answer, THEN sees the explanation. It is not graded and
 * nothing is stored: its only job is to make you think before reading. "Skip" is always available.
 */
export function PredictionGate({ prediction, segmentId, children }: { prediction: NonNullable<Segment['prediction']>; segmentId: string; children: ReactNode }) {
  const [pick, setPick] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const options = seededOrder(prediction.options, `predict:${segmentId}`);
  const right = pick === prediction.correct;
  const chosen = prediction.options.find((o) => o.id === pick);
  const correct = prediction.options.find((o) => o.id === prediction.correct);
  return (
    <div data-testid={`predict-${segmentId}`}>
      {!revealed ? (
        <fieldset className="space-y-3 rounded-lg border border-line bg-surface2 p-3">
          <legend className="px-1 text-sm font-semibold">Predict first</legend>
          <p className="text-sm">{prediction.prompt}</p>
          <div role="radiogroup" aria-label={prediction.prompt} className="space-y-2">
            {options.map((o) => (
              <label key={o.id} className={cx('transition-forge flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', pick === o.id ? 'border-accent bg-surface' : 'border-line hover:bg-surface')}>
                <input type="radio" name={`predict-${segmentId}`} className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={pick === o.id} onChange={() => setPick(o.id)} />
                <span>{o.text}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!pick} onClick={() => setRevealed(true)} data-testid={`predict-lock-${segmentId}`}>Lock in my prediction</Button>
            <Button variant="ghost" onClick={() => setRevealed(true)}>Skip the prediction</Button>
          </div>
          <p className="text-xs text-muted">Not graded and not saved. Committing to an answer first makes the explanation stick.</p>
        </fieldset>
      ) : (
        <div className="space-y-3">
          {pick && (
            <Callout tone={right ? 'ok' : 'info'} title={right ? 'Your prediction held up' : 'Your prediction differed - that is useful'} role="status">
              {right ? chosen?.why : <>You predicted: {chosen?.text}. {chosen?.why} The better answer: {correct?.text}. {correct?.why}</>}
            </Callout>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
