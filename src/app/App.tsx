import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './providers/DataProvider';
import { Shell } from './shell/Shell';
import { ToastProvider, Spinner, EmptyState, LinkButton } from '@/components/ui';

// Feature areas are code-split so the first load stays small.
const MissionControl = lazy(() => import('@/features/mission/MissionControl'));
const Onboarding = lazy(() => import('@/features/onboarding/OnboardingPage'));
const Academy = lazy(() => import('@/features/academy/AcademyPage'));
const LessonPage = lazy(() => import('@/features/academy/LessonPage'));
const DiagnosticPage = lazy(() => import('@/features/academy/DiagnosticPage'));
const ReviewPage = lazy(() => import('@/features/academy/ReviewPage'));
const Discovery = lazy(() => import('@/features/discovery/DiscoveryPage'));
const EntryPage = lazy(() => import('@/features/discovery/EntryPage'));
const Workshop = lazy(() => import('@/features/workshop/WorkshopPage'));
const SkillEditor = lazy(() => import('@/features/workshop/SkillEditor'));
const BattleLab = lazy(() => import('@/features/battle-lab/BattleLabPage'));
const ExperimentPage = lazy(() => import('@/features/battle-lab/ExperimentPage'));
const LoopHub = lazy(() => import('@/features/loop/LoopHub'));
const LoopPage = lazy(() => import('@/features/loop/LoopPage'));
const Arsenal = lazy(() => import('@/features/arsenal/ArsenalPage'));
const Growth = lazy(() => import('@/features/growth/GrowthPage'));
const Settings = lazy(() => import('@/features/settings/SettingsPage'));
const Search = lazy(() => import('@/features/search/SearchPage'));
const More = lazy(() => import('@/features/more/MorePage'));
const OpportunityFinder = lazy(() => import('@/features/academy/OpportunityFinderPage'));
const Explore = lazy(() => import('@/features/explore/ExplorePage'));
const CapabilityPage = lazy(() => import('@/features/explore/CapabilityPage'));
const Playbooks = lazy(() => import('@/features/playbooks/PlaybooksPage'));
const PlaybookEditor = lazy(() => import('@/features/playbooks/PlaybookEditor'));
const Pilot = lazy(() => import('@/features/pilot/PilotPage'));
const PilotStart = lazy(() => import('@/features/pilot/PilotStart'));
const PilotGuide = lazy(() => import('@/features/pilot/PilotGuide'));
const Challenges = lazy(() => import('@/features/challenges/ChallengesPage'));
const Challenge = lazy(() => import('@/features/challenges/ChallengePage'));
const Library = lazy(() => import('@/features/library/LibraryPage'));
const TakeawayEditor = lazy(() => import('@/features/library/TakeawayEditor'));
const Pathways = lazy(() => import('@/features/pathways/PathwaysPage'));
const PathwayPage = lazy(() => import('@/features/pathways/PathwayPage'));
const Practice = lazy(() => import('@/features/practice/PracticePage'));
const MixedExercise = lazy(() => import('@/features/practice/MixedExercisePage'));
const Learn = lazy(() => import('@/features/units/LearnPage'));
const UnitPlayer = lazy(() => import('@/features/units/UnitPlayer'));
const PlaygroundsIndex = lazy(() => import('@/features/playgrounds/Playgrounds').then((m) => ({ default: m.PlaygroundsIndex })));
const PlaygroundPage = lazy(() => import('@/features/playgrounds/Playgrounds').then((m) => ({ default: m.PlaygroundPage })));
const Transfer = lazy(() => import('@/features/transfer/TransferPage'));
const TransferEditor = lazy(() => import('@/features/transfer/TransferEditor'));

function NotFound() {
  return (
    <EmptyState title="That page does not exist" action={<LinkButton to="/" variant="primary">Back to Mission Control</LinkButton>}>
      The link may be from an older version. Everything you saved is still on this device.
    </EmptyState>
  );
}

export function App() {
  return (
    <DataProvider>
      <ToastProvider>
        <HashRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<MissionControl />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="academy" element={<Academy />} />
                <Route path="academy/diagnostic" element={<DiagnosticPage />} />
                <Route path="academy/opportunity-finder" element={<OpportunityFinder />} />
                <Route path="academy/review/:lessonId" element={<ReviewPage />} />
                <Route path="academy/lesson/:lessonId" element={<LessonPage />} />
                <Route path="explore" element={<Explore />} />
                <Route path="explore/:capabilityId" element={<CapabilityPage />} />
                <Route path="playbooks" element={<Playbooks />} />
                <Route path="playbooks/:playbookId" element={<PlaybookEditor />} />
                <Route path="pilot" element={<Pilot />} />
                <Route path="pilot/new/:starterId" element={<PilotStart />} />
                <Route path="pilot/:experimentId" element={<PilotGuide />} />
                <Route path="challenges" element={<Challenges />} />
                <Route path="challenges/:challengeId" element={<Challenge />} />
                <Route path="library" element={<Library />} />
                <Route path="library/:takeawayId" element={<TakeawayEditor />} />
                <Route path="pathways" element={<Pathways />} />
                <Route path="pathways/:pathwayId" element={<PathwayPage />} />
                <Route path="practice" element={<Practice />} />
                <Route path="practice/:exerciseId" element={<MixedExercise />} />
                <Route path="learn" element={<Learn />} />
                <Route path="mission/:unitId" element={<UnitPlayer />} />
                <Route path="spark/:unitId" element={<UnitPlayer />} />
                <Route path="playgrounds" element={<PlaygroundsIndex />} />
                <Route path="playgrounds/:playgroundId" element={<PlaygroundPage />} />
                <Route path="transfer" element={<Transfer />} />
                <Route path="transfer/:taskId" element={<TransferEditor />} />
                <Route path="discovery" element={<Discovery />} />
                <Route path="discovery/:entryId" element={<EntryPage />} />
                <Route path="workshop" element={<Workshop />} />
                <Route path="workshop/:skillId" element={<SkillEditor />} />
                <Route path="battle-lab" element={<BattleLab />} />
                <Route path="battle-lab/:experimentId" element={<ExperimentPage />} />
                <Route path="loop" element={<LoopHub />} />
                <Route path="loop/:loopId" element={<LoopPage />} />
                <Route path="arsenal" element={<Arsenal />} />
                <Route path="growth" element={<Growth />} />
                <Route path="settings" element={<Settings />} />
                <Route path="search" element={<Search />} />
                <Route path="more" element={<More />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </ToastProvider>
    </DataProvider>
  );
}
