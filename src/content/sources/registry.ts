import { z } from 'zod';
import raw from './registry.json';

/**
 * The source registry: every external page Claude Forge's ecosystem knowledge rests on, with how it was checked.
 * It is data for humans and for the optional `scripts/check-sources.mjs` job. It never causes anything to be fetched
 * by the app itself, and nothing in it is executed.
 */
export const SourceRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  url: z.string().url().refine((u) => u.startsWith('https://'), 'must be https'),
  kind: z.enum(['docs', 'repo', 'article', 'spec', 'blog']),
  status: z.enum(['read', 'unreachable', 'lead']),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usedBy: z.array(z.string()),
  note: z.string(),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;

export const SOURCE_REGISTRY: SourceRecord[] = z.array(SourceRecordSchema).parse((raw as { sources: unknown }).sources);
export const sourceFor = (url: string): SourceRecord | undefined => SOURCE_REGISTRY.find((s) => s.url === url || url.startsWith(s.url));
