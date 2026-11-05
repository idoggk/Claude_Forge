import { Link } from 'react-router-dom';
import { LESSONS } from '@/content/lessons';
import { DIAGNOSTIC } from '@/content/diagnostic';
import { getMisconception } from '@/content/misconceptions';
import { COMPETENCY_BY_ID } from '@/domain/curriculum/competencies';
import { gradeAttempt } from '@/domain/assessment/grade';
import { lessonsFor } from '@/domain/mastery/diagnostic';
import { lessonStatus } from '@/domain/mastery/recommend';
import { submitDiagnostic } from '@/persistence/repo';
import { Badge, Callout, Card, LinkButton, PageHeader, Spinner } from '@/components/ui';
import { useLearning } from '@/app/hooks';
import type { DiagnosticRecord } from '@/persistence/schemas';
import { ExerciseRunner } from './ExerciseRunner';

function Result({ rec, attempts, progress }: { rec: DiagnosticRecord; attempts: Parameters<typeof lessonStatus>[1]; progress: Parameters<typeof lessonStatus>[2] }) {
  const gaps = rec.results.filter((r) => !r.correct);
  const solid = rec.results.filter((r) => r.correct);
  return (
    <div className="space-y-3 text-sm" data-testid="diagnostic-result">
      <Callout tone="info" title="This did not change your competency levels">
        The diagnostic is a hint about where to look first - one question per concept cannot establish mastery. Levels only rise from lessons, assessments and reviews.
      </Callout>
      <h3 className="text-lg font-semibold">Look at these first ({gaps.length})</h3>
      {gaps.length === 0 ? <p className="text-muted">You answered every question correctly. The assessments still decide your levels - a strong start means you can move quickly, not skip the evidence.</p> : (
        <ul className="space-y-2" data-testid="diagnostic-gaps">
          {gaps.map((g) => {
            const c = COMPETENCY_BY_ID[g.concept as keyof typeof COMPETENCY_BY_ID];
            const ls = lessonsFor(g.concept, LESSONS);
            return (
              <Card as="li" key={g.itemId}>
                <p className="font-semibold">{c?.title ?? g.concept} {!g.answered && <Badge>unanswered</Badge>}</p>
                <p className="text-muted">{c?.summary}</p>
                <p className="mt-1">{ls.length ? <>Start with: {ls.map((l, i) => <span key={l.id}>{i > 0 && ', '}<Link className="text-accent-text underline" to={`/academy/lesson/${l.id}`}>{l.title}</Link> <span className="text-muted">({lessonStatus(l, attempts, progress).replace('-', ' ')})</span></span>)}</> : 'No lesson covers this yet.'}</p>
              </Card>
            );
          })}
        </ul>
      )}
      {solid.length > 0 && (
        <>
          <h3 className="text-lg font-semibold">Solid starts ({solid.length})</h3>
          <p className="text-muted">{solid.map((s) => COMPETENCY_BY_ID[s.concept as keyof typeof COMPETENCY_BY_ID]?.title ?? s.concept).join(' · ')}</p>
        </>
      )}
      {rec.misconceptions.length > 0 && (
        <>
          <h3 className="text-lg font-semibold">Beliefs worth checking</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">{rec.misconceptions.map((m) => <li key={m}>“{getMisconception(m)?.belief ?? m}”</li>)}</ul>
          <p className="text-xs text-muted">These will be woven into your spaced reviews as questions that test them in a new setting.</p>
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-1"><LinkButton to="/" variant="primary">Back to Mission Control</LinkButton><LinkButton to="/academy">Open the Academy</LinkButton></div>
    </div>
  );
}

export default function DiagnosticPage() {
  const { data: l } = useLearning();
  if (!l) return <Spinner label="Loading the diagnostic" />;
  const history = l.diagnostics.filter((d) => d.diagnosticId === DIAGNOSTIC.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return (
    <div>
      <PageHeader eyebrow="Academy" title={DIAGNOSTIC.title} subtitle={DIAGNOSTIC.intro} actions={<LinkButton to="/academy" variant="ghost" size="sm">Back to the Academy</LinkButton>} />
      {history.length > 0 && (
        <Card className="mb-4" aria-labelledby="dg-hist">
          <h2 id="dg-hist" className="font-semibold">Your earlier results</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-muted" data-testid="diagnostic-history">
            {history.map((h) => <li key={h.id}>{new Date(h.takenAt).toLocaleString()} · {h.solid.length} solid, {h.gaps.length} to look at</li>)}
          </ul>
          <p className="mt-1 text-xs text-muted">Retaking is always allowed. Every result is kept; none of them changes a competency level.</p>
        </Card>
      )}
      <ExerciseRunner
        items={DIAGNOSTIC.items}
        seed="diagnostic"
        mode="practice"
        askConfidence={false}
        allowHints={false}
        submitLabel="See where to start"
        onSubmit={async (s) => {
          const { record } = await submitDiagnostic({ id: s.attemptId, answers: s.answers });
          const grade = gradeAttempt(DIAGNOSTIC.items, record.answers, { passMark: 0 });
          return { grade, extra: <Result rec={record} attempts={l.attempts} progress={l.progress} /> };
        }}
      />
    </div>
  );
}
