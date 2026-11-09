import { Link } from 'react-router-dom';
import { Icon, PageHeader, type IconName } from '@/components/ui';

const ITEMS: { to: string; icon: IconName; title: string; text: string; id: string }[] = [
  { to: '/loop', icon: 'target', title: 'Improvement Loop', text: 'Improve a Skill with dev cases, then test it on held-out cases', id: 'more-loop' },
  { to: '/playbooks', icon: 'flag', title: 'Workflow Playbooks', text: 'Design repeatable AI workflows with gates and approvals', id: 'more-playbooks' },
  { to: '/learn', icon: 'target', title: 'Start learning', text: 'Quick Sparks, guided missions, playgrounds, Deep Lab and a five-minute review', id: 'more-learn' },
  { to: '/practice', icon: 'target', title: 'Practice that fits you', text: 'Evidence-aware suggestions and mixed-topic exercises', id: 'more-practice' },
  { to: '/pathways', icon: 'target', title: 'Capability pathways', text: 'Seven routes from an idea to something you have saved: learn, practise, test, apply, save', id: 'more-pathways' },
  { to: '/library', icon: 'book', title: 'My AI library', text: 'Takeaways you have learned, each labelled by how far its evidence goes', id: 'more-library' },
  { to: '/challenges', icon: 'flask', title: 'Challenges', text: 'Four non-game practice problems with computed fixtures: extraction, research, agent traces, context', id: 'more-challenges' },
  { to: '/pilot', icon: 'flask', title: 'Run your first real AI experiment', text: 'A guided, eight-step experiment on a task you really do', id: 'more-pilot' },
  { to: '/transfer', icon: 'target', title: 'Real-world transfer', text: 'Take one thing you learned to real work, with a check you can run and what actually happened', id: 'more-transfer' },
  { to: '/academy/opportunity-finder', icon: 'search', title: 'AI Opportunity Finder', text: 'Practice judging where AI fits - and where it does not', id: 'more-finder' },
  { to: '/discovery', icon: 'compass', title: 'Discovery Hub', text: 'Skills, tools, frameworks and techniques, with provenance shown', id: 'more-discovery' },
  { to: '/workshop', icon: 'hammer', title: 'Skill Workshop', text: 'Build, validate, test and export a custom Skill', id: 'more-workshop' },
  { to: '/arsenal', icon: 'shield', title: 'Arsenal', text: 'Your relationship with each Skill: evaluating, using, rejected', id: 'more-arsenal' },
  { to: '/growth', icon: 'chart', title: 'Growth and mastery profile', text: 'Mastery across 13 areas, reviews, calibration and field evidence', id: 'more-growth' },
  { to: '/search', icon: 'search', title: 'Search', text: 'Lessons, catalog and your own Skills', id: 'more-search' },
  { to: '/settings', icon: 'cog', title: 'Settings & data', text: 'Theme, backup and restore, privacy, about', id: 'more-settings' },
  { to: '/onboarding', icon: 'target', title: 'Profile', text: 'Interests and daily time', id: 'more-profile' },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" subtitle="Everything else in Claude Forge." />
      <ul className="space-y-2">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} data-testid={i.id} className="transition-forge flex min-h-16 items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:bg-surface2">
              <Icon name={i.icon} size={24} className="text-accent-text" />
              <span><span className="block font-semibold">{i.title}</span><span className="text-sm text-muted">{i.text}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
