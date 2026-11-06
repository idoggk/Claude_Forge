import { z } from 'zod';

/**
 * Catalog entries are curated snapshots. Every fact carries its provenance, and anything
 * that could not be established is represented explicitly as unknown (null / 'unknown'),
 * never guessed. Repository-level facts do not prove an individual Skill is maintained.
 */

export const TIERS = ['official', 'community', 'candidate', 'custom'] as const;
export const TierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof TierSchema>;

export const TIER_LABELS: Record<Tier, { label: string; description: string }> = {
  official: { label: 'Official · verified source', description: 'Published by Anthropic or documented in Anthropic\'s official docs.' },
  community: { label: 'Community · verified source', description: 'Third-party publisher whose repository page was read at the verification date. Not endorsed by Anthropic.' },
  candidate: { label: 'Candidate · insufficiently evaluated', description: 'Exists, but too little was inspected to recommend it. Treat as a lead, not a resource.' },
  custom: { label: 'Custom · proposed', description: 'A Skill idea for you to author in the Workshop. There is no source to install.' },
};

/**
 * What kind of thing an entry is. Round 3 widened this from Claude Code components to the wider AI ecosystem.
 * `agent`, `hook`, `marketplace` and `other` are kept so records from earlier versions still validate.
 */
export const COMPONENT_TYPES = [
  'skill', 'plugin', 'mcp', 'agent-framework', 'ai-coding-tool', 'model', 'automation-tool', 'research-tool', 'technique', 'workflow-pattern', 'developer-integration',
  'agent', 'hook', 'marketplace', 'other',
] as const;
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'must be https');

export const InstallMethodSchema = z.object({
  label: z.string(),
  command: z.string(),
  /** Where this exact command was read. */
  verifiedFrom: httpsUrl,
  caveat: z.string().default(''),
});

export const CatalogEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    displayName: z.string(),
    publisher: z.string(),
    publisherKind: z.enum(['anthropic', 'vendor', 'open-source', 'self']),
    tier: TierSchema,
    componentTypes: z.array(ComponentTypeSchema).min(1),
    sourceUrl: httpsUrl.nullable(),
    purpose: z.string(),
    problemSolved: z.string(),
    whenToUse: z.array(z.string()),
    whenNotToUse: z.array(z.string()),
    howItWorks: z.string(),
    workflows: z.array(z.string()),
    practicalExample: z.string(),
    install: z.object({
      status: z.enum(['verified-from-source', 'unverified', 'not-applicable']),
      methods: z.array(InstallMethodSchema),
      note: z.string(),
    }),
    revision: z.object({ value: z.string().nullable(), note: z.string() }),
    verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    verificationMethod: z.string(),
    maintenance: z.object({
      lastCommit: z.string().nullable(),
      latestRelease: z.string().nullable(),
      evidence: z.string(),
    }),
    license: z.object({
      spdx: z.string().nullable(),
      status: z.enum(['stated-on-page', 'mixed', 'unknown', 'not-applicable']),
      evidence: z.string(),
    }),
    observedSignals: z.object({ stars: z.string().nullable(), asOf: z.string().nullable() }).default({ stars: null, asOf: null }),
    security: z.object({
      reviewStatus: z.enum(['not-reviewed', 'metadata-only', 'content-inspected']),
      concerns: z.array(z.string()),
      notes: z.string(),
    }),
    relevance: z.object({ gameDev: z.number().int().min(0).max(3), note: z.string() }),
    limitations: z.array(z.string()),
    missingChecks: z.array(z.string()),
    notableComponents: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
    alternatives: z.array(z.string()).default([]),
    /** Capability Map nodes this entry helps with (ids from src/content/capability/map.ts). */
    capabilityIds: z.array(z.string()).default([]),
    relatedLessons: z.array(z.string()).default([]),
    tags: z.array(z.string()),
    technologies: z.array(z.string()),
    evidenceStatus: z.enum(['official-docs-read', 'repo-page-read', 'insufficient', 'proposed']),
  })
  .refine((e) => e.tier === 'custom' || e.sourceUrl !== null, { message: 'non-custom entries need a canonical source URL', path: ['sourceUrl'] })
  .refine((e) => e.install.status !== 'verified-from-source' || e.install.methods.length > 0, { message: 'verified install needs at least one method', path: ['install'] })
  .refine((e) => e.tier === 'custom' || e.verifiedAt !== null, { message: 'sourced entries need a verification date', path: ['verifiedAt'] });

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export type Freshness = 'fresh' | 'aging' | 'stale' | 'not-applicable';

export function freshnessOf(verifiedAt: string | null, today: string): Freshness {
  if (!verifiedAt) return 'not-applicable';
  const [y1, m1, d1] = verifiedAt.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = today.split('-').map(Number) as [number, number, number];
  const days = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  if (days <= 30) return 'fresh';
  if (days <= 90) return 'aging';
  return 'stale';
}
