import type { PlaybookContent, Step } from '@/domain/playbook/model';

/**
 * Seeded exemplar playbooks. They are DESIGNS written by Forge, not workflows anyone has run: every step starts as
 * "planned", and nothing is marked verified. They exist to show what a reliable design looks like (inputs, gates,
 * bounded failure handling, an approval before anything external or irreversible, observable completion).
 */
export interface PlaybookTemplate extends PlaybookContent {
  templateId: string;
  description: string;
  area: 'general' | 'game-dev';
}

const step = (id: string, title: string, instruction: string, verification: string, failureHandling: string, extra: Partial<Step> = {}): Step => ({
  id,
  title,
  instruction,
  links: [],
  prompt: '',
  verification,
  failureHandling,
  humanApproval: false,
  status: 'planned',
  verifiedNote: '',
  verifiedAt: null,
  verifiedFingerprint: null,
  ...extra,
});

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    templateId: 'seed-release-notes',
    area: 'general',
    description: 'Turn merged pull requests into reviewed, draft release notes. Shows a script gate, a bounded retry and approval before publishing.',
    title: 'Draft release notes from merged pull requests',
    goal: 'Produce a draft set of release notes that accounts for every pull request merged since the last tag, for a person to review before anything is published.',
    prerequisites: ['A tagged previous release', 'Read access to the repository'],
    inputs: ['Merged PR titles, numbers and labels since the last tag, as JSON validated against a schema'],
    outputs: ['A draft release-notes file, grouped by label, citing every PR number'],
    completionCriteria: 'The coverage check passed, a person approved the draft, and publication is logged with who approved it.',
    steps: [
      step('rn-1', 'List the merged pull requests', 'A script lists merged PRs since the last tag and writes them to a validated JSON file.', 'The file validates against the schema and contains at least one PR.', 'If the list is empty or invalid, stop and report; do not call the model.', { instruction: 'A script (not the model) lists merged PRs since the last tag and writes them to a validated JSON file.' }),
      step('rn-2', 'Draft the notes', 'Ask the model to group PRs by label and write one line each, citing the PR number.', 'Output is a markdown file in the defined format.', 'Re-run once with the validation error included; if it fails again, stop and ask a person.', { prompt: 'Group the following pull requests by label. Write one plain sentence per PR and cite its number. Do not add any PR that is not listed.' }),
      step('rn-3', 'Check coverage', 'A script checks that every PR number from step 1 appears exactly once.', 'Every PR number appears exactly once; the script reports any missing or invented numbers.', 'On failure, re-run step 2 once with the missing numbers, then stop and ask a person.'),
      step('rn-4', 'Human review', 'A person reads the draft and edits it.', 'The reviewer records approval or the changes they made.', 'If the reviewer rejects it, stop; nothing is published.', { humanApproval: true }),
      step('rn-5', 'Publish', 'A person publishes the approved notes and tags the release.', 'The published text matches the approved text.', 'If publication fails, stop and report; do not retry automatically.', { humanApproval: true }),
    ],
    notes: 'Design only. Nothing here has been run; mark a step verified only after you have seen it pass, with a note of how.',
    capabilityIds: ['reliable-workflows', 'guardrails-hooks', 'ci-automation'],
  },
  {
    templateId: 'seed-support-triage',
    area: 'general',
    description: 'A weekly summary of support tickets with a count gate and an approval before anything is sent.',
    title: 'Weekly support-ticket summary',
    goal: 'Summarise this week\'s support tickets for the team, accounting for every ticket, without sending anything unreviewed.',
    prerequisites: ['A ticket export for the week'],
    inputs: ['The weekly ticket export (CSV) with ids, titles and categories'],
    outputs: ['A one-page summary citing ticket ids', 'A log of inputs, counts and gate results'],
    completionCriteria: 'The id-coverage gate passed, a person approved the draft, and the send to the team list is logged.',
    steps: [
      step('st-1', 'Validate the export', 'A script checks the file has the expected columns and counts the tickets.', 'Columns match; the ticket count is recorded in the log.', 'If the file is truncated or malformed, stop and alert a person.'),
      step('st-2', 'Draft the summary', 'The model writes a summary grouped by category and cites ticket ids.', 'A file in the defined format.', 'Retry once with the validation error; then stop and ask a person.', { prompt: 'Summarise these tickets by category. Cite the ticket id for every statement. Do not mention any ticket that is not in the list.' }),
      step('st-3', 'Check coverage', 'A script confirms every ticket id from step 1 is cited at least once and no unknown ids appear.', 'Zero missing ids and zero unknown ids.', 'Re-run step 2 once with the missing ids; then stop and ask a person.'),
      step('st-4', 'Approve', 'A person reads the draft before anything is sent.', 'Approval or edits are recorded.', 'If rejected, stop.', { humanApproval: true }),
      step('st-5', 'Send to the team list only', 'Send the approved summary to the team list (not a wider list).', 'The send log shows the recipient list used.', 'If the send fails, stop and report; do not retry blindly.', { humanApproval: true }),
    ],
    notes: 'Design only. The recipient list is part of the gate: a send to the wrong audience cannot be undone.',
    capabilityIds: ['reliable-workflows', 'guardrails-hooks'],
  },
  {
    templateId: 'seed-skill-adoption-review',
    area: 'general',
    description: 'Review a third-party Skill, plugin or MCP server as text before anything runs.',
    title: 'Review a third-party Skill or plugin before adopting it',
    goal: 'Decide adopt, trial, watch or reject for a third-party Skill, plugin or server, based on what it contains and asks for, without running anything first.',
    prerequisites: ['A source link you can open', 'A throwaway environment for any later trial'],
    inputs: ['The source repository or listing', 'The task you want it for'],
    outputs: ['A decision with reasons', 'A note of what you verified and what you did not'],
    completionCriteria: 'A decision is written with its reasons and the date, and unverified items are listed.',
    steps: [
      step('sa-1', 'State the need and the simpler alternative', 'Write what task needs this and what you would do without it (a script, a built-in tool, nothing).', 'The note names a specific task and one alternative.', 'If you cannot name a task, stop: there is no need yet.'),
      step('sa-2', 'Check provenance', 'Record publisher, source link, licence text and last release from the source itself.', 'Each fact has the place and date you read it.', 'Mark anything you cannot confirm as unknown; do not estimate.'),
      step('sa-3', 'Read what it installs and executes, as text', 'Read the install instructions, scripts, hooks and requested access without running anything.', 'A list of everything it would run and every permission or credential it asks for.', 'If you cannot read it, stop and reject or wait.'),
      step('sa-4', 'Decide', 'Choose adopt, trial, watch or reject and write the reason.', 'The decision cites facts from steps 1-3.', 'If the evidence is thin, choose watch.', { humanApproval: true }),
      step('sa-5', 'Trial on one real task (if adopting)', 'In a throwaway environment, run one small task against your current way of working and record what happened.', 'Results are recorded including unknown values.', 'If the trial exposes a risk, stop and reject.'),
    ],
    notes: 'Design only. The decision step is a person\'s, never the model\'s.',
    capabilityIds: ['safe-adoption', 'tool-evaluation', 'agent-skills', 'plugins-distribution'],
  },
  {
    templateId: 'seed-ai-tool-evaluation',
    area: 'general',
    description: 'Evaluate a new AI tool: need, claims, security and a small comparison against a baseline.',
    title: 'Evaluate a new AI tool',
    goal: 'Turn a recommendation into a defensible decision about a new AI tool using the need, the evidence and a small trial.',
    prerequisites: ['A task the tool would help with'],
    inputs: ['The tool\'s page and source', 'One real task and your current way of doing it (the baseline)'],
    outputs: ['A decision note', 'An AI Lab experiment if you ran a trial'],
    completionCriteria: 'The decision is recorded with reasons, the experiment (if any) has at least two runs per condition, and unverified claims are listed.',
    steps: [
      step('te-1', 'Sort the claims', 'Sort what you read into facts you can check, claims that need evidence, popularity signals and your own evidence.', 'Each item is in one bucket; unsupported claims are marked.', 'If a claim has no method, record it as unsupported and move on.'),
      step('te-2', 'Review security', 'Read what it installs, what it executes and what access it requests.', 'A written list of installs, executed code and access requested.', 'If it asks for access out of proportion to the task, stop and reject.'),
      step('te-3', 'Plan the trial', 'In the AI Lab, write a hypothesis, a baseline, one stated difference and the measures before any run.', 'The experiment has a baseline and locked measures.', 'If you cannot define a baseline, do not run the trial.'),
      step('te-4', 'Run and record', 'Run each condition at least twice and record results, leaving unknown values unknown.', 'Every run is recorded with its measures or marked unknown.', 'If a run fails to produce data, record it as unknown; do not substitute a guess.'),
      step('te-5', 'Decide and record', 'Write adopt, trial, watch or reject, with the limits of the evidence.', 'The note states what the trial cannot show.', 'If ranges overlap, record "no evidence of a difference".', { humanApproval: true }),
    ],
    notes: 'Design only. The AI Lab never runs the tool for you; you supply the results.',
    capabilityIds: ['tool-evaluation', 'evaluation', 'agent-frameworks'],
  },
  {
    templateId: 'seed-bug-investigation',
    area: 'game-dev',
    description: 'Investigate an intermittent game bug: reproduce, state the invariant, isolate, fix and add a regression check.',
    title: 'Investigate an intermittent game bug',
    goal: 'Find and fix the root cause of an intermittent game-logic bug with a deterministic reproduction and a regression test.',
    prerequisites: ['The game or fixture builds and its existing tests run'],
    inputs: ['The bug report', 'The code and tests', 'A way to seed randomness (a fixed seed)'],
    outputs: ['A deterministic failing case', 'A fix', 'A regression test that failed before and passes after'],
    completionCriteria: 'The failing case reproduces, the fix makes it pass, the full suite passes and the regression test is committed.',
    steps: [
      step('bi-1', 'Reproduce deterministically', 'Find a seed or input that always triggers the bug.', 'Running the case fails every time.', 'If you cannot reproduce it, stop and gather more data; do not patch.'),
      step('bi-2', 'State the violated invariant', 'Write one sentence saying what should always be true and is not.', 'The sentence is checkable by code.', 'If you cannot state it, narrow the reproduction first.'),
      step('bi-3', 'Isolate', 'Ask the AI to find the smallest case and the first step where the invariant breaks, from the evidence.', 'The location is confirmed by a test or trace, not by the AI\'s say-so.', 'Retry once with the failing output; then investigate by hand.'),
      step('bi-4', 'Fix and add a regression test', 'Make the smallest fix and add a test that failed before it.', 'The new test fails before and passes after; the full suite passes.', 'If other tests fail, revert the change and re-isolate.'),
      step('bi-5', 'Review the diff', 'A person reads the diff.', 'The diff touches only what the fix needed.', 'If it touches unrelated code, split or revert.', { humanApproval: true }),
    ],
    notes: 'Mirrors the merge-chain debugging lesson. Design only.',
    capabilityIds: ['game-systems-debugging', 'efficient-development'],
  },
  {
    templateId: 'seed-balance-report',
    area: 'game-dev',
    description: 'Review a game economy simulation without mistaking a big balance for inflation.',
    title: 'Economy balance report from simulation data',
    goal: 'Decide from simulation data whether income is decoupling from upgrade prices, naming the cause rather than the symptom.',
    prerequisites: ['A simulation output with per-stage income, prices and sinks'],
    inputs: ['Simulation output (per stage: income, upgrade price, sinks)'],
    outputs: ['A report naming the trend, the suspected cause and a proposed change to re-simulate'],
    completionCriteria: 'The report cites the ratio over several stages, names a cause, and states the proposed change with how it will be re-simulated.',
    steps: [
      step('br-1', 'Validate the data', 'Check stages are contiguous and numeric.', 'No gaps or non-numeric values.', 'If data is missing, stop; do not interpolate.'),
      step('br-2', 'Compute ratios over stages', 'Compute income divided by the next upgrade\'s price per stage.', 'A table of the ratio across stages from a script.', 'If the script fails, fix the script; do not estimate by eye.'),
      step('br-3', 'Draft the interpretation', 'Ask the AI to describe the trend and a candidate cause, citing the table.', 'Every claim cites a row of the table.', 'Retry once with the table; then write it yourself.'),
      step('br-4', 'Propose a change and re-simulate', 'Propose the change that addresses the cause and re-run the simulation.', 'The new table shows the trend changed.', 'If the trend is unchanged, the cause was wrong; return to step 3.'),
      step('br-5', 'Designer sign-off', 'A designer reviews before anything ships.', 'Approval is recorded.', 'If rejected, stop.', { humanApproval: true }),
    ],
    notes: 'Mirrors the economy-inflation lesson. Design only.',
    capabilityIds: ['game-systems-debugging', 'evaluation'],
  },
];

export const getPlaybookTemplate = (id: string): PlaybookTemplate | undefined => PLAYBOOK_TEMPLATES.find((t) => t.templateId === id);
