import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Callout, EmptyState, LinkButton, PageHeader, useToast } from '@/components/ui';
import { MIXED_EXERCISES } from '@/content/interleaved';
import { gradeItem } from '@/domain/assessment/grade';
import { ItemView } from '@/features/academy/ItemView';
import { recordActivityRun } from '@/persistence/repo';
import { newId } from '@/lib/ids';

export default function MixedExercisePage() {
  const { exerciseId } = useParams();
  const ex = MIXED_EXERCISES.find((m) => m.id === exerciseId);
  const toast = useToast();
  const [value, setValue] = useState<unknown>(undefined);
  const [seed] = useState(() => newId('mx'));
  const [graded, setGraded] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!ex) return <EmptyState title="No such exercise" action={<LinkButton to="/practice">All practice</LinkButton>}>That exercise does not exist.</EmptyState>;
  const grade = graded ? gradeItem(ex.item, value) : undefined;
  const save = async () => {
    if (!grade || saved) return;
    await recordActivityRun({ id: newId('run'), activityId: `interleaved:${ex.id}`, activityVersion: 1, answers: (value ?? {}) as Record<string, unknown>, results: ex.competencies.map((c) => ({ itemId: ex.id, concept: c, correct: grade.correct, score: grade.score })), score: grade.score });
    setSaved(true);
    toast('Run saved as practice');
  };
  return (
    <div data-testid={`mixed-page-${ex.id}`}>
      <PageHeader eyebrow="Mixed-topic practice" title={ex.title} subtitle={ex.teaches} actions={<LinkButton to="/practice" variant="secondary" size="sm">All practice</LinkButton>} />
      <ItemView item={ex.item} index={0} value={value} onChange={setValue} disabled={graded} grade={grade} hintsShown={0} seed={seed} optionSeed={seed} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!graded ? <Button variant="primary" onClick={() => setGraded(true)} data-testid="mixed-submit">Check my answers</Button> : <Button onClick={save} disabled={saved} data-testid="mixed-save">{saved ? 'Saved' : 'Save this run'}</Button>}
      </div>
      {graded && <div className="mt-3"><Callout tone="info" title="This is practice">It is saved on this device only and never changes a competency level. Independent, unseen assessments do that.</Callout></div>}
    </div>
  );
}
