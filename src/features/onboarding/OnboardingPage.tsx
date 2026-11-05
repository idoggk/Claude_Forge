import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { INTEREST_LABELS, type InterestTag } from '@/domain/curriculum/types';
import { Button, Callout, Card, Illustration, PageHeader, SelectField, TextInput, useToast } from '@/components/ui';
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

  const toggle = (t: InterestTag) => setInterests((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="mx-auto max-w-2xl">
      {!editing && <div className="mb-5" aria-hidden="true"><Illustration name="hero-forge" className="h-40 object-[center_45%] sm:h-64" /></div>}
      <PageHeader
        eyebrow={editing ? 'Your profile' : 'Welcome to Claude Forge'}
        title={editing ? 'Tune your learning plan' : 'Become genuinely good at using AI'}
        subtitle="A static, offline-capable academy. You learn by doing, we record what you can actually demonstrate, and nothing leaves your device."
      />
      {!editing && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            ['Discover → Understand → Practice', 'Short lessons, then exercises that grade your answers with feedback on every wrong option.'],
            ['Experiment → Apply → Measure', 'Compare workflows with an AI Lab that refuses to turn one lucky run into a conclusion.'],
            ['Evidence, not impressions', 'Mastery changes only when you pass unseen assessments and log real-world application.'],
          ].map(([t, d]) => (
            <Card key={t}><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></Card>
          ))}
        </div>
      )}
      <Card>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const saved = await saveProfile({ displayName: name.trim(), interests, dailyMinutes: minutes, onboardedAt: profile?.onboardedAt ?? nowIso() });
              setProfileOptimistic(saved);
              toast(editing ? 'Profile saved' : 'All set - welcome');
              nav('/');
            } finally {
              setBusy(false);
            }
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
