import type { SourceDoc } from '@/domain/retrieval/search';

/**
 * Educational retrieval corpus for Lesson 22: documentation for an INVENTED command-line tool, "Quillbridge".
 * Everything here is fabricated for training. The corpus deliberately contains the four things retrieval systems
 * hit in practice: a stale document, a contradicting document, a lexically similar but irrelevant document, and
 * documents whose date or version is unknown. No real product, person or company is described.
 */
export const REFERENCE_DATE = '2026-11-05';

export const CORPUS: SourceDoc[] = [
  {
    id: 'ref-cli',
    title: 'Quillbridge CLI reference',
    source: 'Official reference manual',
    date: '2026-09-14',
    version: '4.2',
    text: 'The sync command copies a project to the remote workspace. The default request timeout for sync is 60 seconds. Use the --timeout flag to change it for one run. Set timeout_seconds in quillbridge.toml to change it for every run.',
  },
  {
    id: 'changelog-3',
    title: 'Quillbridge 3.0 release notes',
    source: 'Official changelog',
    date: '2022-03-02',
    version: '3.0',
    text: 'Version 3.0 introduces the sync command. The default request timeout for sync is 30 seconds. Large projects may need a higher value. Authentication uses a token file in the home directory.',
  },
  {
    id: 'changelog-4',
    title: 'Quillbridge 4.0 release notes',
    source: 'Official changelog',
    date: '2025-05-20',
    version: '4.0',
    text: 'Version 4.0 raises the default request timeout for sync from 30 seconds to 60 seconds. Authentication now uses an environment variable instead of a token file. The --timeout flag accepts values up to 600 seconds.',
  },
  {
    id: 'dash-session',
    title: 'Dashboard session settings',
    source: 'Official dashboard guide',
    date: '2026-08-01',
    version: '4.2',
    text: 'The web dashboard signs you out after 30 minutes of inactivity. This session timeout does not affect the command line. An administrator can change the dashboard session timeout in the organisation settings.',
  },
  {
    id: 'forum-45',
    title: 'Forum thread: sync keeps timing out',
    source: 'Community forum post (unverified)',
    date: '2025-11-11',
    version: null,
    text: 'I think the default timeout for sync is 45 seconds, at least that is what I saw on my laptop. Raising it to 120 fixed my large project. Not sure which version I was on.',
  },
  {
    id: 'blog-tuning',
    title: 'Blog: speeding up Quillbridge sync',
    source: 'Third-party blog',
    date: null,
    version: null,
    text: 'Compress assets before you sync and keep large binaries out of the project folder. Fewer files mean faster transfers. Retry logic matters more than any timeout value.',
  },
  {
    id: 'auth-guide',
    title: 'Authenticating the CLI',
    source: 'Official reference manual',
    date: '2026-09-14',
    version: '4.2',
    text: 'Set the QUILLBRIDGE_TOKEN environment variable before running any command. Never commit the token to source control. The token expires after 90 days and must be reissued from the dashboard.',
  },
  {
    id: 'ref-config',
    title: 'Configuration file reference',
    source: 'Official reference manual',
    date: '2026-09-14',
    version: '4.2',
    text: 'quillbridge.toml lives in the project root. The retries setting controls how many times a failed request is repeated; the default is 3. The timeout_seconds setting applies to every command that makes a network request.',
  },
  {
    id: 'internal-wiki',
    title: 'Team wiki: our Quillbridge setup',
    source: 'Internal team wiki',
    date: '2024-02-10',
    version: '3.5',
    text: 'Our build servers run Quillbridge 3.5, so the sync timeout there is still the old default of 30 seconds. We override it in the pipeline with --timeout 120.',
  },
  {
    id: 'ref-limits',
    title: 'Service limits',
    source: 'Official reference manual',
    date: '2026-09-14',
    version: '4.2',
    text: 'A single sync uploads at most 2 GB. Individual files larger than 100 MB are rejected. Rate limits apply per token, not per project.',
  },
];

/** A snippet judgement used by the challenges: what to do with a retrieved passage for one question. */
export type SnippetVerdict = 'use' | 'stale' | 'conflict' | 'irrelevant';

export const VERDICT_LABELS: { id: SnippetVerdict; label: string }[] = [
  { id: 'use', label: 'Use as evidence' },
  { id: 'stale', label: 'Reject: stale or for another version' },
  { id: 'conflict', label: 'Reject: unverified or contradicting' },
  { id: 'irrelevant', label: 'Reject: irrelevant to the question' },
];
