import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getLesson } from '@/content/lessons';
import { startReview, submitReview, type ReviewSession } from '@/persistence/repo';
import { gradeAttempt } from '@/domain/assessment/grade';
import { formatDateKey } from '@/lib/clock';
import { Badge, EmptyState, LinkButton, PageHeader, Spinner, useToast } from '@/components/ui';
import { getDb } from '@/persistence/db';
import { ExerciseRunner } from './ExerciseRunner';

const REASON_LABEL = { misconception: 'Misconception', mistake: 'Missed before', interleaved: 'Mixed in', progression: 'Right difficulty', rotation: 'Fresh question' } as const;

export default function ReviewPage() {
  const { lessonId } = useParams();
  const lesson = getLesson(lessonId ?? '');
  const toast = useToast();
  const [session, setSession] = useState<ReviewSession | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (lesson) void startReview(lesson.id).then((s) => alive && setSession(s));
    return () => { alive = false; };
  }, [lesson]);

  if (!lesson) return <EmptyState title="Lesson not found" action={<LinkButton to="/academy">Academy</LinkButton>} />;
  if (session === undefined) return <Spinner label="Preparing your review" />;
  if (session === null) {
    return (
      <EmptyState title="Nothing to review yet" action={<LinkButton to={`/academy/lesson/${lesson.id}`} variant="primary">Open the lesson</LinkButton>}>
        Reviews are scheduled after you submit this lesson&apos;s assessment.
      </EmptyState>
    );
  }
  return (
    <div>
      <PageHeader eyebrow="Spaced review" title={`Review: ${lesson.title}`} subtitle="Fresh questions from this lesson's separate review pool. Hints are allowed but stop a pass from advancing your schedule." actions={<Badge tone="teal">Round {session.cycle + 1}</Badge>} />
      <details className="mb-4 rounded-lg border border-line bg-surface p-3 text-sm" data-testid="review-plan">
        <summary className="cursor-pointer font-semibold">Why these {session.items.length} questions?</summary>
        <ul className="mt-2 space-y-1.5">
          {session.plan.map((p, i) => (
            <li key={p.item.id} className="flex flex-wrap items-start gap-2">
              <span className="text-muted">{i + 1}.</span>
              <Badge tone={p.reason === 'mistake' || p.reason === 'misconception' ? 'warn' : p.reason === 'interleaved' ? 'teal' : 'neutral'}>{REASON_LABEL[p.reason]}</Badge>
              <span className="min-w-0 flex-1 text-muted">{p.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">A fixed rule chose these - mistakes first, difficulty by schedule box, a rotating pool, and one question mixed in from another lesson you have passed. No AI personalization.</p>
      </details>
      <ExerciseRunner
        items={session.items}
        seed={`${lesson.id}:review:${session.cycle}`}
        mode="review"
        askConfidence={false}
        allowHints
        submitLabel="Submit review"
        onSubmit={async (s) => {
          const res = await submitReview({ ...s, lessonId: lesson.id, itemIds: session.items.map((i) => i.id) });
          if (!res) return null;
          const items = session.items;
          const grade = gradeAttempt(items, res.attempt.answers, { passMark: 0.8 });
          const rec = await getDb().reviews.get(lesson.id);
          toast(res.outcome === 'pass' ? 'Review passed - interval extended' : res.outcome === 'partial' ? 'Review saved - same interval' : 'Review saved - back to 1 day');
          return {
            grade,
            extra: (
              <div className="text-sm" data-testid="review-outcome">
                <p>Outcome: <Badge tone={res.outcome === 'pass' ? 'ok' : res.outcome === 'partial' ? 'warn' : 'bad'}>{res.outcome}</Badge> {res.outcome === 'partial' && s.hintsUsed > 0 ? '(hints were used, so the schedule did not advance)' : ''}</p>
                {rec && <p className="mt-1 text-muted">Next review: <strong>{formatDateKey(rec.dueOn)}</strong> (box {rec.box + 1} of 4).</p>}
                <div className="mt-3"><LinkButton to="/" variant="primary">Back to Mission Control</LinkButton></div>
              </div>
            ),
          };
        }}
      />
    </div>
  );
}
