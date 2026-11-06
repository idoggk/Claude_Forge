import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, TextArea, TextInput, useToast } from '@/components/ui';
import { useGoals } from '@/app/hooks';
import { deleteGoal, GoalLimitError, saveGoal, setGoalStatus } from '@/persistence/repo';
import { CAPABILITIES, CAPABILITY_BY_ID } from '@/content/capability/map';
import { MAX_ACTIVE_GOALS, type LearningGoal } from '@/domain/goals/model';

/** Create-a-goal form. Goals only steer recommendations; "achieved" is something you declare, with a note. */
export function GoalForm({ initialCapabilityIds = [], onDone }: { initialCapabilityIds?: string[]; onDone?: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [ids, setIds] = useState<string[]>(initialCapabilityIds);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return setErr('Give the goal a title.');
        if (ids.length === 0) return setErr('Pick at least one capability so the goal can steer your recommendations.');
        try {
          await saveGoal({ title, why, capabilityIds: ids });
          setErr(null);
          setTitle('');
          setWhy('');
          setIds([]);
          toast('Goal saved');
          onDone?.();
        } catch (x) {
          setErr(x instanceof GoalLimitError ? x.message : 'Could not save the goal.');
        }
      }}
    >
      <TextInput label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Hand a weekly report to a reliable workflow" data-testid="goal-title" />
      <TextArea label="Why it matters to you (optional)" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={500} />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Capabilities this goal needs (up to 6)</legend>
        <div className="flex flex-wrap gap-2">
          {CAPABILITIES.map((c) => {
            const on = ids.includes(c.id);
            const disabled = !on && ids.length >= 6;
            return (
              <label key={c.id} className={`transition-forge flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? 'border-accent bg-surface2 font-semibold' : 'border-line text-muted hover:bg-surface2'} ${disabled ? 'opacity-50' : ''}`}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={on} disabled={disabled} onChange={() => setIds(on ? ids.filter((x) => x !== c.id) : [...ids, c.id])} />
                {c.title}
              </label>
            );
          })}
        </div>
      </fieldset>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div><Button type="submit" variant="primary" data-testid="save-goal">Save goal</Button></div>
    </form>
  );
}

function GoalRow({ g }: { g: LearningGoal }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [declaring, setDeclaring] = useState(false);
  return (
    <li className="rounded-lg border border-line p-3" data-testid={`goal-${g.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{g.title}</h3>
        <Badge tone={g.status === 'active' ? 'accent' : g.status === 'achieved' ? 'ok' : 'neutral'}>{g.status === 'achieved' ? 'Declared achieved' : g.status}</Badge>
      </div>
      {g.why && <p className="mt-1 text-sm text-muted">{g.why}</p>}
      <p className="mt-1 text-sm">
        {g.capabilityIds.map((id, i) => {
          const c = CAPABILITY_BY_ID.get(id);
          return <span key={id}>{i > 0 && ' · '}{c ? <Link className="underline" to={`/explore/${id}`}>{c.title}</Link> : id}</span>;
        })}
      </p>
      {g.status === 'achieved' && g.achievedNote && <p className="mt-1 text-sm text-muted">In your words: {g.achievedNote}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {g.status === 'active' && !declaring && <Button size="sm" onClick={() => setDeclaring(true)}>I achieved this</Button>}
        {g.status === 'active' && <Button size="sm" variant="ghost" onClick={() => void setGoalStatus(g.id, 'archived').then(() => toast('Goal archived'))}>Archive</Button>}
        {g.status !== 'active' && <Button size="sm" onClick={() => void setGoalStatus(g.id, 'active').catch((e) => toast(e instanceof GoalLimitError ? e.message : 'Could not reactivate'))}>Make active again</Button>}
        <Button size="sm" variant="ghost" onClick={() => void deleteGoal(g.id).then(() => toast('Goal deleted'))}>Delete</Button>
      </div>
      {declaring && (
        <div className="mt-2 grid gap-2">
          <TextArea label="What did you do with this in a real project? (your words; Forge cannot verify it)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void setGoalStatus(g.id, 'achieved', note).then(() => { setDeclaring(false); toast('Recorded as your own declaration'); })}>Record</Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclaring(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function GoalsPanel() {
  const { data: goals } = useGoals();
  const [adding, setAdding] = useState(false);
  const active = (goals ?? []).filter((g) => g.status === 'active');
  const rest = (goals ?? []).filter((g) => g.status !== 'active');
  return (
    <Card aria-labelledby="goals-h" data-testid="goals-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="goals-h" className="text-lg font-semibold">My learning goals</h2>
        <Badge>{active.length} of {MAX_ACTIVE_GOALS} active</Badge>
        {!adding && <Button size="sm" className="ml-auto" onClick={() => setAdding(true)} data-testid="add-goal">Add a goal</Button>}
      </div>
      <p className="mt-1 text-sm text-muted">Goals tell Forge what to recommend next. They are your intentions, not evidence: only lessons, reviews and your own field notes show what you can do.</p>
      {adding && <div className="mt-3"><GoalForm onDone={() => setAdding(false)} /></div>}
      {goals && goals.length === 0 && !adding && <div className="mt-3"><EmptyState title="No goals yet" icon="target">Pick a capability you want to build and save it as a goal.</EmptyState></div>}
      {active.length > 0 && <ul className="mt-3 space-y-2">{active.map((g) => <GoalRow key={g.id} g={g} />)}</ul>}
      {rest.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Archived and achieved ({rest.length})</summary>
          <ul className="mt-2 space-y-2">{rest.map((g) => <GoalRow key={g.id} g={g} />)}</ul>
        </details>
      )}
    </Card>
  );
}
