import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getLesson, LESSONS } from '@/content/lessons';
import { unitForLesson } from '@/content/units/registry';
import { COMPETENCY_BY_ID, TRACKS } from '@/domain/curriculum/competencies';
import { LEVEL_NAMES } from '@/domain/mastery/competency';
import { prerequisitesMet } from '@/domain/mastery/recommend';
import { calibrationMessage } from '@/domain/assessment/calibration';
import { submitAttempt, touchLesson, type SubmitResult } from '@/persistence/repo';
import { Badge, Button, Callout, Card, EmptyState, LinkButton, Markdown, PageHeader, SafeLink, Spinner, TabPanel, Tabs, useToast } from '@/components/ui';
import { useLearning } from '@/app/hooks';
import { formatDateKey } from '@/lib/clock';
import { getDb } from '@/persistence/db';
import { ExerciseRunner } from './ExerciseRunner';
import { WIDGETS } from './widgets';
import { PredictionGate } from './PredictionGate';
import type { Lesson } from '@/domain/curriculum/types';

type Stage = 'learn' | 'practice' | 'assess' | 'apply';
const STAGES: { id: Stage; label: string }[] = [
  { id: 'learn', label: '1 · Learn' },
  { id: 'practice', label: '2 · Practice' },
  { id: 'assess', label: '3 · Assess' },
  { id: 'apply', label: '4 · Apply' },
];

function LevelChanges({ lesson, res }: { lesson: Lesson; res: SubmitResult }) {
  const rows = lesson.competencies.map((c) => ({ id: c, before: res.levelsBefore[c] ?? 0, after: res.levelsAfter[c] ?? 0 }));
  return (
    <div data-testid="level-changes" className="rounded-lg border border-line bg-surface2 p-3 text-sm">
      <p className="font-semibold">Competency evidence</p>
      <ul className="mt-1 space-y-1">
        {rows.map((r) => (
          <li key={r.id}>
            {COMPETENCY_BY_ID[r.id].title}: <strong>{LEVEL_NAMES[r.after]}</strong>
            {r.after > r.before ? <span className="text-ok"> ↑ from {LEVEL_NAMES[r.before]}</span> : r.after < r.before ? <span className="text-bad"> ↓ from {LEVEL_NAMES[r.before]}</span> : <span className="text-muted"> (unchanged)</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Levels change only when the evidence rules are met - marking something as read or used never raises them.</p>
    </div>
  );
}

export default function LessonPage() {
  const { lessonId } = useParams();
  const lesson = getLesson(lessonId ?? '');
  const { data: learning } = useLearning();
  const toast = useToast();
  const [stage, setStage] = useState<Stage | null>(null);
  const [note, setNote] = useState('');
  const [noteLoaded, setNoteLoaded] = useState(false);

  // Create (or refresh) the progress row as soon as the lesson is opened, so "continue" works after a reload.
  useEffect(() => {
    if (lesson) void touchLesson(lesson);
  }, [lesson]);

  const progress = learning?.progress.find((p) => p.lessonId === lesson?.id && p.lessonVersion === lesson?.version);
  useEffect(() => {
    if (!lesson || !learning || stage !== null) return;
    setStage(progress?.stage ?? 'learn');
  }, [lesson, learning, progress, stage]);
  useEffect(() => {
    if (progress && !noteLoaded) {
      setNote(progress.appliedNote);
      setNoteLoaded(true);
    }
  }, [progress, noteLoaded]);

  const mine = useMemo(() => (learning && lesson ? learning.attempts.filter((a) => a.lessonId === lesson.id && a.lessonVersion === lesson.version) : []), [learning, lesson]);

  if (!lesson) return <EmptyState title="Lesson not found" action={<LinkButton to="/academy" variant="primary">Back to the Academy</LinkButton>}>This lesson ID does not exist in this version of the app.</EmptyState>;
  if (!learning || stage === null) return <Spinner label="Loading lesson" />;

  const track = TRACKS.find((t) => t.id === lesson.track)!;
  const pre = prerequisitesMet(lesson, LESSONS, learning.attempts, learning.progress);
  const Widget = lesson.activity.widget ? WIDGETS[lesson.activity.widget] : null;
  const assessments = mine.filter((a) => a.stage === 'assessment').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const older = learning.attempts.filter((a) => a.lessonId === lesson.id && a.lessonVersion !== lesson.version).length;
  const go = (s: Stage) => { setStage(s); void touchLesson(lesson, { stage: s }); };

  return (
    <article>
      <PageHeader
        eyebrow={`Track ${track.order} · ${track.title}`}
        title={lesson.title}
        subtitle={lesson.subtitle}
        actions={<><Badge>{lesson.effortMinutes} min</Badge><Badge tone="teal">v{lesson.version}</Badge></>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {lesson.competencies.map((c) => <Badge key={c} tone="accent" title={COMPETENCY_BY_ID[c].summary}>{COMPETENCY_BY_ID[c].title}</Badge>)}
        {lesson.gameRelevance >= 2 && <Badge tone="ok">Game-dev relevance {lesson.gameRelevance}/3</Badge>}
      </div>
      {!pre.met && (
        <div className="mb-4">
          <Callout tone="warn" title="Recommended after">
            <p>
              {pre.missing.map((m, i) => (<span key={m.id}>{i > 0 && ', '}<Link className="underline" to={`/academy/lesson/${m.id}`}>{m.title}</Link></span>))}.
              You can still read this lesson - prerequisites guide the recommendations, they do not lock anything.
            </p>
          </Callout>
        </div>
      )}
      {older > 0 && <div className="mb-4"><Callout tone="info" title="This lesson was updated">You have {older} attempt(s) from an earlier version. They are kept in your history but do not count toward current mastery.</Callout></div>}

      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="lesson-progress">
        <span>Your progress:</span>
        <Badge tone={progress && progress.segmentsSeen.length >= lesson.segments.length ? 'ok' : 'neutral'}>read {progress?.segmentsSeen.length ?? 0}/{lesson.segments.length}</Badge>
        <Badge tone={mine.some((a) => a.stage === 'practice') ? 'accent' : 'neutral'}>{mine.filter((a) => a.stage === 'practice').length} practice attempt(s)</Badge>
        <Badge tone={assessments.some((a) => a.passed) ? 'ok' : assessments.length ? 'warn' : 'neutral'}>{assessments.some((a) => a.passed) ? 'assessment passed' : assessments.length ? 'assessment not passed' : 'assessment not taken'}</Badge>
      </p>
      {unitForLesson(lesson.id) && (
        <p className="mb-3 text-sm text-muted" data-testid="lesson-mission-link">
          Want a shorter way in? Try the <Link className="font-semibold text-accent-text underline" to={`/mission/${unitForLesson(lesson.id)!.id}`}>{unitForLesson(lesson.id)!.minutes}-minute guided mission</Link> first. It is practice only: this lesson's own assessment is what counts.
        </p>
      )}
      <Tabs label="Lesson stages" tabs={STAGES.map((s) => ({ ...s }))} value={stage} onChange={go} />

      <TabPanel id="learn" active={stage === 'learn'}>
        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold">The developer problem</h2>
            <p className="mt-1 text-muted">{lesson.problem}</p>
            <h2 className="mt-4 text-lg font-semibold">Why it matters</h2>
            <p className="mt-1 text-muted">{lesson.whyItMatters}</p>
            <h2 className="mt-4 text-lg font-semibold">You will be able to</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </Card>
          {lesson.segments.map((s, i) => (
            <Card key={s.id}>
              <h2 className="mb-2 text-lg font-semibold"><span className="mr-2 text-accent-text">{i + 1}.</span>{s.title}</h2>
              {s.prediction ? <PredictionGate prediction={s.prediction} segmentId={s.id}><Markdown>{s.body}</Markdown></PredictionGate> : <Markdown>{s.body}</Markdown>}
            </Card>
          ))}
          <Card>
            <h2 className="text-lg font-semibold">Common failure modes</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{lesson.failureModes.map((f) => <li key={f}>{f}</li>)}</ul>
            {lesson.sources.length > 0 && (
              <>
                <h2 className="mt-4 text-lg font-semibold">Sources</h2>
                <ul className="mt-1 space-y-1 text-sm">{lesson.sources.map((s) => <li key={s.url}><SafeLink href={s.url}>{s.label}</SafeLink> <span className="text-muted">- {s.supports}</span></li>)}</ul>
              </>
            )}
          </Card>
          <Button variant="primary" size="lg" icon="arrow" data-testid="to-practice" onClick={async () => { for (const s of lesson.segments) await touchLesson(lesson, { segmentSeen: s.id }); go('practice'); }}>
            I have read this - go to practice
          </Button>
        </div>
      </TabPanel>

      <TabPanel id="practice" active={stage === 'practice'}>
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold">{lesson.activity.title}</h2>
            <p className="mt-1 text-muted">{lesson.activity.intro}</p>
            <p className="mt-2 text-xs text-muted">Practice is <strong>guided</strong>: hints are allowed and recorded, and you can retry freely. It builds toward &ldquo;Guided application&rdquo;; independent mastery comes from the assessment.</p>
          </Card>
          {Widget && <Widget lesson={lesson} />}
          <ExerciseRunner
            key={`${lesson.id}-practice`}
            items={lesson.activity.items}
            seed={`${lesson.id}:practice`}
            mode="practice"
            askConfidence={false}
            allowHints
            submitLabel="Check my answers"
            onSubmit={async (s) => {
              const res = await submitAttempt({ ...s, lesson, stage: 'practice' });
              if (!res.grade) return null;
              return { grade: res.grade, extra: <LevelChanges lesson={lesson} res={res} /> };
            }}
          />
          <Button variant="secondary" icon="arrow" onClick={() => go('assess')} data-testid="to-assess">Continue to the assessment</Button>
        </div>
      </TabPanel>

      <TabPanel id="assess" active={stage === 'assess'}>
        <div className="space-y-4">
          {assessments.length > 0 && (
            <Card>
              <h2 className="text-lg font-semibold">Assessment history</h2>
              <ul className="mt-2 space-y-1 text-sm" data-testid="assessment-history">
                {assessments.map((a) => (
                  <li key={a.id}>Attempt {a.attemptNumber} · {new Date(a.submittedAt).toLocaleDateString()} · <strong>{Math.round(a.score * 100)}%</strong> {a.passed ? <Badge tone="ok">passed</Badge> : <Badge tone="bad">not passed</Badge>} {!a.unseen && <Badge>retake · guided</Badge>}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Only the first attempt on unseen questions can earn &ldquo;Independent application&rdquo;. Retakes count as guided practice; fresh review questions can earn it back later.</p>
            </Card>
          )}
          <ExerciseRunner
            key={`${lesson.id}-assess`}
            items={lesson.assessment.items}
            seed={`${lesson.id}:assess`}
            mode="assessment"
            askConfidence
            allowHints={false}
            submitLabel="Submit assessment"
            intro={<><h2 className="text-lg font-semibold">{lesson.assessment.title}</h2><div className="mt-1 text-muted"><Markdown>{lesson.assessment.intro}</Markdown></div><p className="mt-1 text-sm text-muted">Pass mark: {Math.round(lesson.assessment.passMark * 100)}% and every mandatory check.</p></>}
            onSubmit={async (s) => {
              const res = await submitAttempt({ ...s, lesson, stage: 'assessment' });
              if (!res.grade) return null;
              const weakest = Object.entries(res.attempt.conceptResults).sort((a, b) => a[1].score - b[1].score)[0];
              const review = await getDb().reviews.get(lesson.id);
              toast(res.attempt.passed ? 'Assessment passed - saved' : 'Assessment saved');
              return {
                grade: res.grade,
                extra: (
                  <div className="space-y-3">
                    {res.calibration && res.attempt.predictedPct !== null && (
                      <div className="rounded-lg border border-line bg-surface2 p-3 text-sm" data-testid="calibration">
                        <p className="font-semibold">Confidence check</p>
                        <p>You predicted ~{res.attempt.predictedPct}%. You scored {Math.round(res.grade.score * 100)}%. <Badge tone={res.calibration.verdict === 'calibrated' ? 'ok' : 'warn'}>{res.calibration.verdict}</Badge></p>
                        <p className="mt-1 text-muted">{calibrationMessage(res.calibration.verdict, res.calibration.gap)}</p>
                        {weakest && !res.attempt.passed && <p className="mt-1">Relevant concept to revisit: <strong>{COMPETENCY_BY_ID[weakest[0] as keyof typeof COMPETENCY_BY_ID]?.title ?? weakest[0]}</strong>. Recommended practice: re-run the practice stage, then retake.</p>}
                      </div>
                    )}
                    <LevelChanges lesson={lesson} res={res} />
                    {review && <p className="text-sm text-muted" data-testid="review-scheduled">Spaced review scheduled for <strong>{formatDateKey(review.dueOn)}</strong> (rule: 1 → 3 → 7 → 14 days; failures reset to 1 day).</p>}
                    <Button variant="secondary" onClick={() => go('apply')} icon="arrow">Go to Apply</Button>
                  </div>
                ),
              };
            }}
          />
        </div>
      </TabPanel>

      <TabPanel id="apply" active={stage === 'apply'}>
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold">{lesson.application.title}</h2>
            <Markdown className="mt-2">{lesson.application.body}</Markdown>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Your notes</h2>
            <label htmlFor="apply-note" className="sr-only">Notes on applying this lesson</label>
            <textarea id="apply-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What will you try on a real project? What happened?" className="mt-2 w-full rounded-lg border border-line bg-surface2 p-3 focus:border-accent" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button onClick={async () => { await touchLesson(lesson, { appliedNote: note }); toast('Notes saved'); }}>Save notes</Button>
              <LinkButton to={`/transfer?source=lesson&id=${encodeURIComponent(lesson.id)}`} variant="primary" data-testid="lesson-transfer">Plan a real-world transfer task</LinkButton>
              <LinkButton to="/growth" variant="ghost">Log field evidence in Growth</LinkButton>
            </div>
            <p className="mt-3 text-sm text-muted">{lesson.application.fieldPrompt}</p>
            <p className="mt-1 text-xs text-muted">Reaching &ldquo;Field-proven&rdquo; needs a self-reported record of real work - it cannot be earned inside the app.</p>
          </Card>
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/academy" variant="primary">Back to the Academy</LinkButton>
            <LinkButton to="/">Mission Control</LinkButton>
          </div>
        </div>
      </TabPanel>
    </article>
  );
}
