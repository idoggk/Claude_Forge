import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { INTEREST_LABELS, type InterestTag } from '@/domain/curriculum/types';
import { Button, Callout, Card, PageHeader, SelectField, TextInput, useToast } from '@/components/ui';
import { HomeHero } from '@/features/mission/HomeHero';
import { LearningPaths } from '@/features/mission/LearningPaths';
import { LESSONS } from '@/content/lessons';
import { MISSIONS } from '@/content/missions';
import { TRACKS } from '@/domain/curriculum/competencies';
import { saveProfile } from '@/persistence/repo';
import { useData } from '@/app/providers/DataProvider';
import { nowIso } from '@/lib/clock';

export default function OnboardingPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { profile, setProfileOptimistic } = useData();
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [minutes, setMinutes] = useState(20);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(profile?.onboardedAt);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName);
      setInterests(profile.interests);
      setMinutes(profile.dailyMinutes);
    }
  }, [profile]);

  const finish = async (to: string) => {
    setBusy(true);
    try {
      const saved = await saveProfile({ displayName: name.trim(), interests, dailyMinutes: minutes, onboardedAt: profile?.onboardedAt ?? nowIso() });
      setProfileOptimistic(saved);
      toast(editing ? 'Profile saved' : 'All set - welcome');
      nav(to);
    } finally {
      setBusy(false);
    }
  };
  const planned = TRACKS.reduce((a, t) => a + t.topics.filter((x) => !x.lessonId).length, 0);

  const toggle = (t: InterestTag) => setInterests((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className={editing ? 'mx-auto max-w-2xl' : 'mx-auto max-w-5xl'}>
      {!editing ? (
        <>
          <HomeHero
            eyebrow="Welcome to Claude Forge"
            title="Become genuinely good at using AI"
            actions={
              <>
                <Button variant="primary" size="lg" disabled={busy} onClick={() => void finish('/academy/diagnostic')} data-testid="onboard-diagnostic">Take the 5-minute diagnostic</Button>
                <Button size="lg" disabled={busy} onClick={() => void finish('/')} data-testid="onboard-start">Start without it</Button>
              </>
            }
          >
            <p>A personal academy, offline-capable and private to this device. You learn by doing, Claude Forge records what you can actually demonstrate, and your levels change only when you pass unseen assessments or log real work. {LESSONS.length} lessons exist today across {TRACKS.length} tracks; {planned} more topics are planned and marked as planned.</p>
          </HomeHero>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Discover → Understand → Practice', 'Short lessons, then exercises that grade your answers with feedback on every wrong option.'],
              ['Experiment → Apply → Measure', 'Compare workflows with an AI Lab that refuses to turn one lucky run into a conclusion.'],
              ['Evidence, not impressions', 'Mastery changes only when you pass unseen assessments and log real-world application.'],
            ].map(([t, d]) => (
              <Card key={t}><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></Card>
            ))}
          </div>
          <div className="mb-6"><LearningPaths returning={false} links={false} lessons={LESSONS} attempts={[]} progress={[]} missionCount={MISSIONS.length} /></div>
          <h2 className="mb-2 text-xl font-semibold">Optional: tune your plan</h2>
        </>
      ) : (
        <PageHeader eyebrow="Your profile" title="Tune your learning plan" subtitle="Your name, interests and daily time. Stored only on this device." />
      )}
      <Card className={editing ? '' : 'mx-auto max-w-2xl'}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void finish('/');
          }}
        >
          <TextInput label="What should we call you? (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="nickname" hint="Stored only on this device." />
          <fieldset>
            <legend className="text-sm font-semibold">What do you most want to get better at?</legend>
            <p className="text-xs text-muted">This nudges the order of recommendations. It never locks anything.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(INTEREST_LABELS) as InterestTag[]).map((t) => (
                <label key={t} className={`transition-forge flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${interests.includes(t) ? 'border-accent bg-surface2' : 'border-line hover:bg-surface2'}`}>
                  <input type="checkbox" checked={interests.includes(t)} onChange={() => toggle(t)} className="h-4 w-4 accent-[var(--accent)]" />
                  {INTEREST_LABELS[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <SelectField label="Time you can give per day" value={String(minutes)} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[10, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </SelectField>
          <Callout tone="info" title="Privacy and limits, in plain words">
            <ul className="list-disc space-y-1 pl-4">
              <li>Progress is stored in this browser (IndexedDB). It does <strong>not</strong> sync between devices - use Settings → Export to move it.</li>
              <li>No account, no analytics, no API key. Claude Forge never calls Claude and never sees your code.</li>
              <li>Catalog entries are snapshots read on a stated date; each one shows what is still unknown.</li>
            </ul>
          </Callout>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="lg" disabled={busy} data-testid="finish-onboarding">{editing ? 'Save profile' : 'Start learning'}</Button>
            {!editing && <Link to="/settings" className="text-sm text-accent-text underline">I have a backup to restore</Link>}
          </div>
        </form>
      </Card>
    </div>
  );
}
