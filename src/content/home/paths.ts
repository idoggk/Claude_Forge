import type { HomeArt } from '@/components/ui';

/**
 * The four learning paths shown on Home. A path is a view over the Academy's twelve tracks: every lesson belongs to exactly one
 * path through its track (checked by a unit test), so path counts are derived from the real lessons and never typed here.
 */
export interface HomePath {
  id: 'ai-engineering' | 'game-development' | 'agents-automation' | 'research-verification';
  title: string;
  tagline: string;
  art: HomeArt;
  trackIds: string[];
  /** Where the capability this path builds is practised beyond lessons. */
  extra?: { label: string; to: string };
}

export const HOME_PATHS: HomePath[] = [
  { id: 'ai-engineering', title: 'AI engineering', art: 'track-ai-engineering', tagline: 'Choosing the right approach, giving AI the context it needs, and building with Claude Code, tools and sound engineering habits.', trackIds: ['fundamentals', 'prompting', 'claude-code', 'mcp-tools', 'engineering', 'ecosystem', 'advanced'] },
  { id: 'game-development', title: 'Game development', art: 'track-game-development', tagline: 'Debugging merge chains and economies, then proving a Skill helps with a held-out test.', trackIds: ['game-dev'], extra: { label: 'Skill Improvement Loop', to: '/loop' } },
  { id: 'agents-automation', title: 'Agents and automation', art: 'track-agents-automation', tagline: 'Why agents fail, how to design a reliable workflow, and how to keep long-running work on track.', trackIds: ['agents', 'automation'], extra: { label: 'Workflow Playbooks', to: '/playbooks' } },
  { id: 'research-verification', title: 'Research and verification', art: 'track-research', tagline: 'Judging evidence, trusting sources, evaluating AI claims and treating untrusted content as data.', trackIds: ['research', 'safety-eval'], extra: { label: 'Practice: AI Lab', to: '/battle-lab' } },
];
