import { Link } from 'react-router-dom';
import { Icon, PageHeader, type IconName } from '@/components/ui';

const ITEMS: { to: string; icon: IconName; title: string; text: string; id: string }[] = [
  { to: '/discovery', icon: 'compass', title: 'Discovery Hub', text: 'Find Skills, plugins and MCP servers, with trust and risk shown', id: 'more-discovery' },
  { to: '/workshop', icon: 'hammer', title: 'Skill Workshop', text: 'Build, validate, test and export a custom Skill', id: 'more-workshop' },
  { to: '/arsenal', icon: 'shield', title: 'Arsenal', text: 'Your relationship with each Skill: evaluating, using, rejected', id: 'more-arsenal' },
  { to: '/growth', icon: 'chart', title: 'Growth', text: 'Competency levels, reviews, calibration and field evidence', id: 'more-growth' },
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
