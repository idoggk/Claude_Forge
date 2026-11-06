import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const STATEMENTS = [
  { id: 'fact', label: 'A fact you can check' },
  { id: 'claim', label: 'A claim that needs evidence' },
  { id: 'signal', label: 'A popularity signal' },
  { id: 'own', label: 'Your own evidence' },
];

/** A fabricated tool pitch. The tool, domain and numbers are invented; nothing here is a real product. */
const PITCH_A = [
  '# TurboAgent - the 10x AI coding assistant',
  'Trusted by 50,000 developers. 14,000 stars!',
  'Install: curl -s https://get.turboagent.example/install.sh | bash',
  'Permissions: full disk access and your cloud credentials "so it works best".',
  'Benchmarks: 10x faster than every alternative (details on request).',
  'Pricing: free forever (for now).',
  'License: see our website.',
  'Maintenance: last commit three years ago.',
];
const PITCH_A_TARGETS = [
  { line: 2, severity: 'minor' as const, why: 'A user count and star count are attention, not evidence that it works for you or is safe.' },
  { line: 3, severity: 'critical' as const, why: 'Pipe-to-shell installs and runs unreviewed remote code at once. Read what it would fetch as text; do not run it.' },
  { line: 4, severity: 'critical' as const, why: 'Full disk and cloud credentials is far more access than a coding assistant needs. Ask for the narrowest scope the task requires.' },
  { line: 5, severity: 'major' as const, why: '"10x faster than every alternative" with details "on request" is an unsupported claim: no method, no baseline.' },
  { line: 6, severity: 'minor' as const, why: '"Free forever (for now)" is not a price commitment. Check the official pricing page and note the date.' },
  { line: 7, severity: 'minor' as const, why: 'An unreadable licence is a risk. The licence should be in the repository, in text you can read.' },
  { line: 8, severity: 'major' as const, why: 'Unmaintained for three years: no security fixes and likely incompatible with current tools.' },
];

const PITCH_B = [
  '# lintly-mcp - structured lint results for AI clients',
  'Source: github.example/acme/lintly-mcp (MIT licence, last release three weeks ago).',
  'Install: npm install lintly-mcp@2.1.0 (declares no install scripts).',
  'Permissions: reads files in the directory you pass; no network access.',
  'Claim: "catches 3x more issues than the alternative" - no method published.',
  'Stars: 41,000.',
  'Credentials: asks for your GitHub admin token "for telemetry".',
];
const PITCH_B_TARGETS = [
  { line: 5, severity: 'major' as const, why: 'A comparative claim with no method or baseline: treat it as unsupported.' },
  { line: 7, severity: 'critical' as const, why: 'An admin token requested for telemetry is a credential grab out of proportion to the purpose.' },
];

export const L18: Lesson = {
  id: 'L18-evaluate-an-ai-tool',
  version: 1,
  track: 'ecosystem',
  alsoIn: ['research', 'safety-eval'],
  order: 18,
  title: 'Discover and Evaluate an AI Tool',
  subtitle: 'From a recommendation to a defensible decision: need, provenance, claims, security and a small trial',
  prerequisites: ['L11-choose-ai-approach', 'L16-ai-evaluation'],
  competencies: ['tool-evaluation'],
  effortMinutes: 35,
  gameRelevance: 1,
  interestTags: ['security', 'ai-judgment', 'experiments'],
  problem: 'A newsletter calls a new tool "the 10x coding assistant". It has 14,000 stars, a one-line installer and a confident benchmark chart. Half your team has already installed it.',
  whyItMatters: 'New AI tools appear weekly and every one comes with a story. A repeatable way to turn a recommendation into a decision - adopt, trial, watch or reject, with reasons - protects your time, your credentials and your judgment.',
  objectives: [
    'Separate verifiable facts, claims that need evidence, popularity signals and your own evidence.',
    'Check provenance: who publishes it, where the source is, the licence, and how recently it was maintained.',
    'Review what a tool would execute and what access it asks for before it ever runs.',
    'Decide with a small trial and record the outcome honestly, including what you did not verify.',
  ],
  segments: [
    {
      id: 's1',
      title: 'A recommendation is a lead, not a decision',
      prediction: {
        prompt: 'A README says "10x faster than alternatives" with no benchmark, method or link. How should you treat the claim?',
        options: [
          o('a', 'As an unsupported claim: note it, and look for a method or run your own small test', 'A specific number is not the same as a supported one.'),
          o('b', 'As fact, because it is specific', 'Specific is not supported.', 'vendor-claim-is-evidence'),
          o('c', 'As proof, because the project has many stars', 'Stars are attention, not measurement.', 'vendor-claim-is-evidence'),
        ],
        correct: 'a',
      },
      body: `The AI ecosystem moves fast and is full of enthusiastic recommendations. Treat each one as **a lead**: a reason to look, not a reason to install. The aim is a decision you can defend in a sentence: *we adopted X because Y, evidenced by Z, with these risks accepted*.

This lesson gives you a short routine. It does not tell you which tools are good - that changes weekly - it tells you how to find out.`,
    },
    {
      id: 's2',
      title: 'Four kinds of statement',
      body: `Sort everything you read about a tool into four buckets:

| Kind | Example | What to do with it |
|---|---|---|
| **A fact you can check** | "MIT licence", "last release three weeks ago" | Check it yourself in the source; note the date you checked |
| **A claim that needs evidence** | "10x faster", "catches 3x more bugs" | Ask for the method and baseline; otherwise it is unsupported |
| **A popularity signal** | Stars, download counts, "trusted by 50,000" | Attention, not quality or safety |
| **Your own evidence** | "In my runs it found 4 of 6 seeded defects, baseline 3 of 6" | The most relevant, if the design was fair (see the evaluation lesson) |

Popularity and safety are different questions. A trending project can still ship an install script that does something you would never approve.`,
    },
    {
      id: 's3',
      title: 'Provenance: who, where, how recent',
      body: `Before anything runs, answer from the source:

- **Who publishes it?** An organisation you can identify, or an anonymous account?
- **Where is the source?** Can you read what it does, or only a website?
- **What licence?** Read the licence file; "see our website" is not a licence.
- **How is it maintained?** Last release, open issues, whether security reports get answers.
- **What does the official documentation say?** For plugins and MCP servers, Claude Code's own docs tell you to verify you trust what you connect.

When you record what you found, record **where and when** you checked it. Unknown stays unknown: a price you could not confirm is "unknown", not an estimate.`,
    },
    {
      id: 's4',
      title: 'Security review before first run',
      body: `Read first, run later - and read as text:

1. **What does installing do?** An install script, a postinstall hook, a pipe-to-shell command. Read it; do not run it to find out.
2. **What does it execute?** A Skill's scripts, a plugin's hooks, an MCP server's command.
3. **What access does it ask for?** Folders, network, credentials. Compare against what the task needs; prefer read-only and narrowly scoped.
4. **Where does its input come from?** If it reads web pages or tickets, that content is untrusted.
5. **Can it be pinned?** Prefer an exact version you reviewed over "latest".

If you cannot read it, you cannot review it. That alone is a reason to wait.`,
    },
    {
      id: 's5',
      title: 'Trial it small, decide, and record honestly',
      body: `A small trial beats a big opinion: pick one real task, compare against the way you do it now (the baseline), run it a few times, record what happened - including what you did not measure.

Then decide, and write the reason:
- **Adopt** - it earned its place on a real task, risks accepted.
- **Trial** - promising; keep testing on one more task.
- **Watch** - interesting, not needed now.
- **Reject** - not needed, unsafe or unsupported. Rejection with a reason is a good outcome.

Forge's Arsenal is built for this: statuses are *your declarations*, not verified facts, and reading about a tool never earns a status beyond "interested".`,
    },
    {
      id: 's6',
      title: 'Worked example: from pitch to decision',
      body: `*A newsletter praises "QuestForge", an MCP server that "generates quests 5x faster" (3,000 stars, one npx command to install).* Applying the routine:

1. **Need:** you write about ten quest descriptions a month. The simplest alternative - keep writing them with a prompt - already costs little. The bar for adopting anything is therefore high.
2. **Claims:** "5x faster" has no method or baseline: *unsupported*. The 3,000 stars are a popularity signal, not evidence.
3. **Provenance:** you cannot name the publisher from the listing and have not opened the source: *unknown*, recorded as such.
4. **Security:** a server runs as a process with your privileges. You would read its package scripts and the access it asks for before it ever starts. You have not, so it does not start.
5. **Trial:** none yet - no need justifies it.
6. **Decision: Watch.** The note records *why* (low need, unsupported claim, unread source), the date, and what would change your mind (a real need and a readable, pinned source).

Notice what did not happen: nothing was installed, and the answer was neither "yes" nor "never".`,
    },
  ],
  activity: {
    title: 'Sort the claims, then audit a pitch',
    intro: 'Guided practice. The tool, domain and numbers are fabricated: nothing here is a real product.',
    items: [
      {
        id: 'l18-p1',
        kind: 'classify',
        concept: 'tool-evaluation',
        prompt: 'What kind of statement is each of these?',
        categories: STATEMENTS,
        entries: [
          { id: 'e1', text: 'The repository\'s LICENSE file contains the MIT licence text', correct: 'fact', why: 'You can read and verify it.' },
          { id: 'e2', text: '"Saves 80% of your time"', correct: 'claim', why: 'Needs a method and a baseline.' },
          { id: 'e3', text: '"14,000 stars and trusted by 50,000 developers"', correct: 'signal', why: 'Attention, not evidence of quality or safety.' },
          { id: 'e4', text: 'In five runs per condition on the same six files, it found 4 of 6 seeded defects against 3 of 6 for the baseline', correct: 'own', why: 'Your recorded evidence, with its limits.' },
        ],
        explanation: 'Treat each kind differently.',
      },
      {
        id: 'l18-p2',
        kind: 'flaglines',
        concept: 'tool-evaluation',
        filename: 'turboagent-pitch.txt',
        lines: PITCH_A,
        prompt: 'Flag the lines of this fabricated pitch that are red flags for adoption.',
        targets: PITCH_A_TARGETS,
        hints: ['Look at the installer, the access requested, the benchmark claim, and the maintenance and licence details.'],
        explanation: 'The pipe-to-shell installer and the credential access are critical; the unsupported benchmark and the abandonment are major.',
      },
      {
        id: 'l18-p3',
        kind: 'order',
        concept: 'tool-evaluation',
        prompt: 'Order the evaluation routine.',
        steps: [
          { id: 'o1', text: 'State the need and the simplest alternative (including doing nothing)', why: 'The tool must beat that.' },
          { id: 'o2', text: 'Check provenance: publisher, source, licence, maintenance', why: 'Who stands behind it.' },
          { id: 'o3', text: 'Separate facts, claims, popularity and your own evidence', why: 'Weigh each correctly.' },
          { id: 'o4', text: 'Read what it installs and executes, and the access it asks for, as text', why: 'Before anything runs.' },
          { id: 'o5', text: 'Trial it on one real task against a baseline, in a safe place', why: 'Evidence from your work.' },
          { id: 'o6', text: 'Decide (adopt, trial, watch or reject) and record the reason and what is unverified', why: 'A decision you can defend.' },
        ],
        explanation: 'Need, provenance, claims, security, trial, decision.',
      },
      {
        id: 'l18-p4',
        kind: 'single',
        concept: 'tool-evaluation',
        prompt: 'You have read a tool\'s documentation but never run it. Which Arsenal status is honest?',
        options: [
          o('a', 'Interested (Evaluating once you start testing)', 'Correct: nothing has been demonstrated.'),
          o('b', 'Using', 'You have not used it.', 'marking-is-mastery'),
          o('c', 'Mastered', 'Marking is not mastery.', 'marking-is-mastery'),
        ],
        correct: 'a',
        explanation: 'Statuses are declarations; keep them honest.',
      },
    ],
  },
  assessment: {
    title: 'Evaluate a tool',
    intro: 'A new pitch, no hints. The unsupported-claim and popularity-versus-safety questions are mandatory checks.',
    passMark: 0.8,
    items: [
      {
        id: 'l18-a1',
        kind: 'fields',
        concept: 'tool-evaluation',
        points: 3,
        prompt: 'Plan how you would evaluate this tool before adopting it. Answer each part concretely.',
        brief: `**Pitch:** A newsletter recommends "QuestForge", an MCP server that "generates game quests 5x faster". It has 3,000 stars and installs with one \`npx\` command.`,
        fields: [
          {
            id: 'need',
            label: 'The need and the simpler alternative',
            help: 'What problem does it solve for you, and what would you do without it?',
            groups: [
              { label: 'a specific need', anyOf: ['need', 'problem', 'task', 'pain', 'use case', 'i would use it'] },
              { label: 'a simpler alternative or doing nothing', anyOf: ['without it', 'alternative', 'script', 'by hand', 'do nothing', 'current way', 'built-in', 'existing', 'baseline'] },
            ],
            placeholder: 'e.g. I need ... ; today I ...',
          },
          {
            id: 'claims',
            label: 'What you would ask of the "5x faster" claim',
            help: 'What evidence would make it believable?',
            groups: [
              { label: 'a method or baseline', anyOf: ['method', 'baseline', 'how it was measured', 'benchmark', 'compared against', 'compared to', 'measured'] },
              { label: 'treat as unsupported until then', anyOf: ['unsupported', 'unverified', 'claim', 'not evidence', 'not proof', 'no evidence', 'until'] },
            ],
            placeholder: 'e.g. I would ask for ...',
          },
          {
            id: 'security',
            label: 'What you would read before it runs',
            help: 'Think about install and execution, and access.',
            groups: [
              { label: 'what it installs or executes', anyOf: ['install script', 'package', 'source', 'source code', 'postinstall', 'what it runs', 'execute', 'command', 'scripts'] },
              { label: 'access, versions or isolation', anyOf: ['permission', 'permissions', 'credentials', 'access', 'pin', 'pinned', 'version', 'sandbox', 'read-only', 'scope'] },
            ],
            placeholder: 'e.g. I would read ...',
          },
          {
            id: 'trial',
            label: 'A small trial',
            help: 'How you would test it fairly on your own work.',
            groups: [
              { label: 'compare against a baseline on a real task', anyOf: ['baseline', 'compare', 'same task', 'real task', 'against my current', 'against the current', 'without it'] },
              { label: 'repeat and record', anyOf: ['several runs', 'multiple runs', 'repeat', 'three runs', '3 runs', 'five runs', 'record', 'log the results', 'write down'] },
            ],
            placeholder: 'e.g. I would run the same task ...',
          },
        ],
        explanation: 'Start from the need, demand a method for claims, read before you run, and trial it against a baseline.',
      },
      {
        id: 'l18-a2',
        kind: 'flaglines',
        concept: 'tool-evaluation',
        filename: 'lintly-mcp-listing.txt',
        lines: PITCH_B,
        prompt: 'Flag only the lines that carry a real concern. Several lines are normal or good.',
        targets: PITCH_B_TARGETS,
        explanation: 'A pinned version, a readable licence, recent maintenance and narrow read-only access are good; the unsupported comparison and the admin-token request are the concerns. Stars are a popularity signal, not a problem.',
      },
      {
        id: 'l18-a3',
        kind: 'single',
        concept: 'tool-evaluation',
        critical: true,
        points: 2,
        prompt: 'A product page says "reduces bugs by 70%" with no method, baseline or link. How should you record the claim?',
        options: [
          o('a', 'As an unsupported vendor claim, with a note of where and when you saw it; test it yourself if it matters', 'Correct: evidence has a method.'),
          o('b', 'As a verified fact, because the number is specific', 'Specific is not supported.', 'vendor-claim-is-evidence'),
          o('c', 'As verified if the product is popular', 'Popularity is not measurement.', 'vendor-claim-is-evidence'),
          o('d', 'As verified because other newsletters repeat it', 'Repetition is not evidence.', 'vendor-claim-is-evidence'),
        ],
        correct: 'a',
        explanation: 'Unsupported claims are noted, not believed.',
      },
      {
        id: 'l18-a4',
        kind: 'single',
        concept: 'tool-evaluation',
        critical: true,
        points: 2,
        prompt: 'A trending Skill with 20,000 stars bundles an install script. What is the right first step?',
        options: [
          o('a', 'Read the script and the Skill as text before anything runs', 'Correct: read, do not run.'),
          o('b', 'Run it once in a real project to see', 'Running it is the risk.', 'popular-is-safe'),
          o('c', 'Trust it because so many people starred it', 'Stars are not review.', 'popular-is-safe'),
          o('d', 'Run it with broad permissions so it cannot fail', 'Strictly worse.', 'popular-is-safe'),
        ],
        correct: 'a',
        explanation: 'Popularity is not safety.',
      },
      {
        id: 'l18-a5',
        kind: 'single',
        concept: 'tool-evaluation',
        prompt: 'You could not confirm what a tool costs. How should your notes record the price?',
        options: [
          o('a', 'As unknown, with a note to check the official pricing page and the date you looked', 'Correct: do not invent figures.'),
          o('b', 'As an estimate based on similar tools', 'That invents data.', 'unknown-is-zero'),
          o('c', 'As free', 'That invents data.', 'unknown-is-zero'),
        ],
        correct: 'a',
        explanation: 'Unknown stays unknown.',
      },
      {
        id: 'l18-a6',
        kind: 'multi',
        concept: 'tool-evaluation',
        prompt: 'Which of these belong in an honest note about a tool you looked at? Select all.',
        options: [
          o('a', 'The publisher and the source link you actually opened', 'Provenance: who publishes it and where the source can be read.'),
          o('b', 'The date you checked, and what you did not verify', 'Dated and honest about gaps.'),
          o('c', 'The licence you read in the repository', 'A checkable fact.'),
          o('d', 'A star count presented as a quality rating', 'Popularity is not quality.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Sources, dates, checkable facts and acknowledged gaps.',
      },
      {
        id: 'l18-a7',
        kind: 'single',
        concept: 'tool-evaluation',
        prompt: 'After a small trial the tool helped on one of three tasks and cost more review time on the others. What is the honest decision?',
        options: [
          o('a', 'Watch or keep trialling it on a narrower task, and record the mixed result and its limits', 'Correct: report what happened.'),
          o('b', 'Adopt it team-wide because it helped once', 'One success is an anecdote.', 'one-run-proof'),
          o('c', 'Delete the notes because the result was unclear', 'An unclear result is still a result.'),
        ],
        correct: 'a',
        explanation: 'Mixed results are results.',
      },
      {
        id: 'l18-a8',
        kind: 'reflect',
        concept: 'tool-evaluation',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can sort what I read about a tool into fact, claim, popularity and my own evidence',
          'I read what a tool installs and executes before running it',
          'I record where and when I checked something, and what I did not verify',
        ],
        explanation: 'A decision you can defend.',
      },
    ],
  },
  failureModes: [
    'Installing because it is trending.',
    'Reading a star count as quality or safety.',
    'Believing a benchmark with no method.',
    'Running an installer to find out what it does.',
    'Granting broad access for convenience.',
    'Recording a guess as a fact (a price, a licence, a version).',
  ],
  application: {
    title: 'Evaluate one tool you have been meaning to try',
    body: 'Pick a tool you have heard good things about. Write the need and the simplest alternative, check provenance from the source, sort the claims, read what it would install and execute, and run one small trial against your current way of working. Record a decision with a reason. Practical takeaway: put it in the Arsenal with an honest status and a dated note of what you verified and what you did not.',
    fieldPrompt: 'Log it under Growth → Field evidence when an evaluation led you to reject, narrow or safely adopt a tool you would otherwise have installed on impulse.',
  },
  reviewItems: [
    { id: 'l18-r1', kind: 'single', concept: 'tool-evaluation', difficulty: 1, prompt: 'What does a GitHub star count tell you?', options: [o('a', 'That the project has attention - not that it works for you or is safe', 'Correct: it matches the practice taught in this lesson.'), o('b', 'That it is secure', 'Stars are not review.', 'popular-is-safe'), o('c', 'That the claims are verified', 'Stars say nothing about whether any claim was verified.', 'vendor-claim-is-evidence')], correct: 'a', explanation: 'Popularity is attention.' },
    { id: 'l18-r2', kind: 'single', concept: 'tool-evaluation', difficulty: 1, prompt: 'Where should you read what a tool\'s installer does?', options: [o('a', 'As text in the source, before running it', 'Correct: it matches the practice taught in this lesson.'), o('b', 'By running it once', 'That is the risk.', 'run-to-inspect'), o('c', 'On the tool\'s marketing page', 'Marketing is not the script.')], correct: 'a', explanation: 'Read, do not run.' },
    { id: 'l18-r3', kind: 'single', concept: 'tool-evaluation', difficulty: 2, prompt: 'A claim has no method or baseline. It is best recorded as:', options: [o('a', 'Unsupported', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Verified', 'Nothing was verified.', 'vendor-claim-is-evidence'), o('c', 'False', 'Unsupported is not the same as false.')], correct: 'a', explanation: 'Unsupported, not disproved.' },
    { id: 'l18-r4', kind: 'multi', concept: 'tool-evaluation', difficulty: 2, prompt: 'Select the provenance questions to answer before adopting a tool.', options: [o('a', 'Who publishes it?', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Where is the source and licence?', 'Correct: it matches the practice taught in this lesson.'), o('c', 'When was it last maintained?', 'Correct: it matches the practice taught in this lesson.'), o('d', 'How many people shared it?', 'Popularity, not provenance.')], correct: ['a', 'b', 'c'], explanation: 'Publisher, source, maintenance.' },
    { id: 'l18-r5', kind: 'single', concept: 'tool-evaluation', difficulty: 2, prompt: 'A tool asks for your cloud credentials to "work best". The sound reaction is:', options: [o('a', 'Ask what task needs them; prefer the narrowest scope, and decline if you cannot justify it', 'Correct: least privilege.'), o('b', 'Grant them; it is popular', 'Popularity is not safety.', 'popular-is-safe'), o('c', 'Paste them into the prompt', 'Prompts leave your machine.', 'secrets-in-config')], correct: 'a', explanation: 'Access must match the need.' },
    { id: 'l18-r6', kind: 'single', concept: 'tool-evaluation', difficulty: 3, prompt: 'Which is the strongest basis for adopting a tool?', options: [o('a', 'A small, fair trial on your own task against a baseline, with the results recorded', 'Correct: it matches the practice taught in this lesson.'), o('b', 'A vendor benchmark chart', 'A vendor chart is a claim until a method is shown.', 'vendor-claim-is-evidence'), o('c', 'A friend\'s enthusiasm', 'An anecdote.')], correct: 'a', explanation: 'Your evidence on your task.' },
    { id: 'l18-r7', kind: 'single', concept: 'tool-evaluation', difficulty: 3, prompt: 'You read a tool\'s docs but never tried it. Which Arsenal status is honest?', options: [o('a', 'Interested', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Mastered', 'Not demonstrated.', 'marking-is-mastery'), o('c', 'Using', 'You have not used it yet, so this would be untrue.', 'marking-is-mastery')], correct: 'a', explanation: 'Statuses are declarations.' },
    { id: 'l18-r8', kind: 'single', concept: 'tool-evaluation', difficulty: 3, prompt: 'The best answer to "should we adopt it?" is sometimes:', options: [o('a', 'No - a script or a built-in tool already meets the need', 'Correct: the simplest approach wins.'), o('b', 'Yes, always, because it is new', 'Novelty is not a reason.', 'agents-always-better'), o('c', 'Only if it has the most stars', 'Not a criterion.', 'popular-is-safe')], correct: 'a', explanation: 'Reject when the need is already met.' },
  ],
  sources: [
    { ...DOCS.mcp, supports: 'The documentation\'s warning to verify you trust each server before connecting it.' },
    { ...DOCS.installPlugins, supports: 'Plugin installation and the guidance to trust plugins before installing them.' },
    { ...ARTICLES.evals, supports: 'Evaluating with your own tasks, graders and repeated trials rather than relying on claims.' },
  ],
};
