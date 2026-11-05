import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';

export const L02_FLAWED_LINES = [
  '---',
  'name: Merge Debugger',
  'description: Debugs merges',
  'disable-model-invocation: true',
  'user-invocable: false',
  'argument_hint: [seed]',
  '---',
  '',
  '# Merge Debugger',
  'Always run the full simulation before reporting.',
  'Never run the full simulation; it is too slow.',
  'See references/invariants.md for the rules.',
];

export const L02: Lesson = {
  id: 'L02-inside-skill-md',
  version: 1,
  track: 'A',
  order: 2,
  title: 'Inside SKILL.md',
  subtitle: 'Portable structure, Claude Code extensions and progressive disclosure',
  prerequisites: ['L01-skill-or-tool'],
  competencies: ['skill-anatomy'],
  effortMinutes: 12,
  gameRelevance: 1,
  interestTags: ['foundations', 'authoring'],
  problem: 'A Skill that silently fails to load, loads when it should not, or works in Claude Code but is rejected on upload usually has a structural mistake you could have spotted by reading the frontmatter.',
  whyItMatters: 'Reading SKILL.md fluently is the base skill for inspecting third-party Skills (Lesson 4) and for writing your own (Lessons 5 and 10).',
  objectives: [
    'Name where Skills live and which scope wins on a name clash.',
    'Separate the portable Agent Skills fields from Claude Code-specific fields.',
    'Explain progressive disclosure: what is always in context, what loads on use, what loads on demand.',
  ],
  segments: [
    {
      id: 's1',
      title: 'A Skill is a folder',
      body: `A Skill is a directory whose entry point is \`SKILL.md\`: YAML frontmatter between \`---\` lines (the first \`---\` must be on the file's first line), then Markdown instructions.

| Scope | Path |
|---|---|
| Personal | \`~/.claude/skills/<skill-name>/SKILL.md\` |
| Project | \`.claude/skills/<skill-name>/SKILL.md\` (commit it to share) |
| Plugin | \`<plugin>/skills/<skill-name>/SKILL.md\`, invoked as \`/plugin-name:skill-name\` |

On a name clash, **enterprise beats personal, personal beats project**; plugin Skills are namespaced and never clash.`,
    },
    {
      id: 's2',
      title: 'Portable vs Claude Code-specific fields',
      body: `The open **Agent Skills** format defines a small set of fields: \`name\`, \`description\`, \`license\`, \`compatibility\`, \`metadata\`, and \`allowed-tools\`. Claude Code adds many more: \`when_to_use\`, \`argument-hint\`, \`arguments\`, \`disable-model-invocation\`, \`user-invocable\`, \`disallowed-tools\`, \`model\`, \`effort\`, \`context\`, \`agent\`, \`background\`, \`hooks\`, \`paths\` and \`shell\`.

Two consequences straight from the docs:
- In Claude Code, **unrecognized field names are ignored silently** - a typo like \`argument_hint\` never raises an error, it just does nothing.
- **Outside Claude Code** (claude.ai uploads, the Skills API) only the portable set is accepted; any other key, such as \`argument-hint\`, is a **hard upload error**.

\`name\` is optional in Claude Code (it defaults to the folder name); the portable format expects lowercase letters, digits and single hyphens (up to 64 characters). *Forge's name rules follow the portable format; the Agent Skills specification site could not be re-read when this lesson was written, so check it before relying on exact limits.*`,
    },
    {
      id: 's3',
      title: 'Progressive disclosure',
      body: `1. **Always in context:** each Skill's \`name\` + \`description\` (+ \`when_to_use\`), capped at **1,536 characters** per entry in the listing, unless \`disable-model-invocation: true\`.
2. **On use:** the full \`SKILL.md\` body is added to the conversation when the Skill is invoked.
3. **On demand:** supporting files (\`references/\`, \`scripts/\`) that the body links to - Claude reads them only if it needs them.

Keep \`SKILL.md\` under about **500 lines** and move bulk into linked files. Use \`\${CLAUDE_SKILL_DIR}\` to reference bundled files so paths work in any install location. Angle brackets in a description display as \`&lt;\`/\`&gt;\`, so use square brackets.`,
    },
    {
      id: 's4',
      title: 'Who can invoke it?',
      body: `| Frontmatter | You (\`/name\`) | Claude | Description in context |
|---|---|---|---|
| default | yes | yes | always |
| \`disable-model-invocation: true\` | yes | no | no |
| \`user-invocable: false\` | no | yes | always |

Setting **both** \`disable-model-invocation: true\` and \`user-invocable: false\` leaves nobody able to invoke the Skill.`,
    },
  ],
  activity: {
    title: 'Read an annotated SKILL.md, then find the faults',
    intro: 'Click through the annotated Skill, then sort fields and flag the problems in a deliberately flawed one.',
    widget: 'skill-md-anatomy',
    items: [
      {
        id: 'l02-p1',
        kind: 'classify',
        concept: 'skill-anatomy',
        prompt: 'Which fields are in the portable Agent Skills set, and which are Claude Code-specific?',
        categories: [
          { id: 'portable', label: 'Portable (works on claude.ai / API)' },
          { id: 'cc', label: 'Claude Code-specific' },
        ],
        entries: [
          { id: 'f1', text: 'name', correct: 'portable', why: 'Core Agent Skills field.' },
          { id: 'f2', text: 'description', correct: 'portable', why: 'Core Agent Skills field.' },
          { id: 'f3', text: 'allowed-tools', correct: 'portable', why: 'Accepted outside Claude Code per the docs.' },
          { id: 'f4', text: 'metadata', correct: 'portable', why: 'Free-form map; accepted outside Claude Code.' },
          { id: 'f5', text: 'disable-model-invocation', correct: 'cc', why: 'Claude Code invocation control; rejected by uploads.' },
          { id: 'f6', text: 'argument-hint', correct: 'cc', why: 'The docs name it explicitly as an upload error.' },
          { id: 'f7', text: 'context', correct: 'cc', why: '`context: fork` runs in a subagent - Claude Code only.' },
          { id: 'f8', text: 'paths', correct: 'cc', why: 'Glob-based auto-loading - Claude Code only.' },
        ],
        hints: ['The portable set has six fields: name, description, license, compatibility, metadata, allowed-tools.'],
        explanation: 'If you plan to upload a Skill to claude.ai or the API, keep to the portable set.',
      },
      {
        id: 'l02-p2',
        kind: 'flaglines',
        concept: 'skill-anatomy',
        filename: 'SKILL.md (flawed sample)',
        lines: L02_FLAWED_LINES,
        prompt: 'Click every line that contains a structural problem. Lines that are fine should stay unflagged.',
        targets: [
          { line: 2, severity: 'major', why: '"Merge Debugger" has a capital letter and a space. Use lowercase-hyphenated: merge-debugger.' },
          { line: 3, severity: 'major', why: 'Too short and no "use when…" trigger - Claude has almost nothing to match.' },
          { line: 4, severity: 'critical', why: 'Together with line 5, nobody can invoke this Skill.' },
          { line: 5, severity: 'critical', why: 'user-invocable: false plus disable-model-invocation: true makes the Skill unreachable.' },
          { line: 6, severity: 'major', why: 'argument_hint (underscore) is not a field; the real one is argument-hint. Claude Code ignores unknown fields silently.' },
          { line: 10, severity: 'major', why: 'Contradicts line 11.' },
          { line: 11, severity: 'major', why: 'Contradicts line 10 - Claude cannot satisfy both "always" and "never".' },
          { line: 12, severity: 'major', why: 'References references/invariants.md, but no supporting file exists.' },
        ],
        hints: ['There are 8 problem lines: name, description, two invocation flags, a misspelled field, two contradicting rules, and a missing file.'],
        explanation: 'Every one of these is caught by the Workshop validator, which you will use in Lesson 5.',
      },
      {
        id: 'l02-p3',
        kind: 'numeric',
        concept: 'skill-anatomy',
        prompt: 'A Skill has a 1,200-character description and a 600-character `when_to_use`. The listing cap is 1,536 characters. How many characters of that entry are cut?',
        answer: 264,
        unit: 'characters',
        hints: ['description + when_to_use is combined, then truncated.'],
        diagnose: (v) => (v === 0 ? 'The cap applies to the combined text: 1,200 + 600 = 1,800.' : v === 600 ? 'You subtracted only the cap from when_to_use. Compute 1,800 − 1,536.' : null),
        explanation: 'Put the key use case first, because the tail is what gets cut.',
      },
    ],
  },
  assessment: {
    title: 'SKILL.md anatomy check',
    intro: 'Unseen questions. No hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l02-a1',
        kind: 'single',
        concept: 'skill-anatomy',
        prompt: 'You write `argument_hint: [seed]` in a Skill used only in Claude Code. What happens?',
        options: [
          o('a', 'Claude Code refuses to load the Skill with an error', 'No - unrecognized fields are ignored.'),
          o('b', 'The field is ignored silently, so no hint appears', 'Correct per the docs.'),
          o('c', 'It is treated as argument-hint', 'No automatic normalisation.'),
          o('d', 'The Skill loads but is hidden', 'Not described.'),
        ],
        correct: 'b',
        explanation: 'Silent failure is why a linter helps.',
      },
      {
        id: 'l02-a2',
        kind: 'multi',
        concept: 'skill-anatomy',
        prompt: 'You want to upload a Skill to claude.ai. Which frontmatter fields may it contain? Select all.',
        options: [
          o('a', 'name', 'One of the six portable Agent Skills fields, so uploads accept it.'),
          o('b', 'allowed-tools', 'Accepted outside Claude Code per the docs.'),
          o('c', 'argument-hint', 'Causes a hard upload error.'),
          o('d', 'compatibility', 'One of the six portable Agent Skills fields, so uploads accept it.'),
          o('e', 'user-invocable', 'Claude Code-specific.'),
        ],
        correct: ['a', 'b', 'd'],
        explanation: 'Portable set: name, description, license, compatibility, metadata, allowed-tools.',
      },
      {
        id: 'l02-a3',
        kind: 'order',
        concept: 'skill-anatomy',
        prompt: 'Order these from "loaded earliest / always present" to "loaded only if needed".',
        steps: [
          { id: 'claude-md', text: 'CLAUDE.md content', why: 'Loaded at the start of every session.' },
          { id: 'description', text: 'A Skill\'s name and description', why: 'In the always-present listing.' },
          { id: 'body', text: 'The full SKILL.md body', why: 'Added when the Skill is invoked.' },
          { id: 'reference', text: 'A reference file linked from the body', why: 'Read only if Claude decides it needs it.' },
        ],
        explanation: 'Progressive disclosure keeps idle cost low.',
      },
      {
        id: 'l02-a4',
        kind: 'single',
        concept: 'skill-anatomy',
        prompt: 'A personal Skill and a project Skill have the same name. Which wins?',
        options: [o('a', 'The project Skill', 'The docs say personal beats project.'), o('b', 'The personal Skill', 'Correct: enterprise > personal > project.'), o('c', 'Whichever loads last', 'Not how precedence works.'), o('d', 'Both load, namespaced', 'Only plugin Skills are namespaced.')],
        correct: 'b',
        explanation: 'Plugin Skills never clash because they are namespaced.',
      },
      {
        id: 'l02-a5',
        kind: 'numeric',
        concept: 'skill-anatomy',
        prompt: 'A description is 1,400 characters and `when_to_use` is 400. How many characters survive in the listing (cap 1,536)?',
        answer: 1536,
        unit: 'characters',
        diagnose: (v) => (v === 1800 ? 'That is the combined length before truncation; the cap limits it to 1,536.' : null),
        explanation: 'Entries are capped, so anything past 1,536 is invisible to Claude\'s matching.',
      },
      {
        id: 'l02-a6',
        kind: 'single',
        concept: 'skill-anatomy',
        prompt: 'Which setting makes a Skill invocable by Claude only (hidden from your / menu)?',
        options: [o('a', 'disable-model-invocation: true', 'That blocks Claude, not you.'), o('b', 'user-invocable: false', 'Correct.'), o('c', 'context: fork', 'Runs in a subagent; does not hide it.'), o('d', 'paths: "**/*"', 'Controls auto-loading by file match.')],
        correct: 'b',
        explanation: 'user-invocable: false hides it from the menu and blocks /name; Claude can still invoke it.',
      },
    ],
  },
  failureModes: [
    'Typos in field names that fail silently.',
    'Using Claude Code-only fields and then failing an upload.',
    'A giant SKILL.md instead of linked references.',
    'Putting the key trigger words at the end of a long description, where they are truncated.',
  ],
  application: {
    title: 'Read three real Skills',
    body: 'Open the Discovery Hub and choose a Skill from the catalog with a source link. Read its SKILL.md frontmatter: which fields are portable, which are Claude Code-specific, and how large is the always-in-context part?',
    fieldPrompt: 'Log it under Growth → Field evidence if you audit the frontmatter of Skills you actually use.',
  },
  reviewItems: [
    {
      id: 'l02-r1',
      kind: 'single',
      concept: 'skill-anatomy',
      prompt: 'Where does a project-level Skill named `merge-debugger` live?',
      options: [o('a', '.claude/skills/merge-debugger/SKILL.md', 'Correct.'), o('b', '~/.claude/skills/merge-debugger.md', 'Personal scope, and not a folder with SKILL.md.'), o('c', '.claude/commands/merge-debugger/SKILL.md', 'Legacy commands directory uses single .md files.'), o('d', 'merge-debugger/README.md', 'Entry point must be SKILL.md.')],
      correct: 'a',
      explanation: 'Project scope: `.claude/skills/<name>/SKILL.md`.',
    },
    {
      id: 'l02-r2',
      kind: 'single',
      concept: 'skill-anatomy',
      prompt: 'Recommended maximum for SKILL.md length before moving detail to supporting files?',
      options: [o('a', 'About 50 lines', 'Too small to be the guidance.'), o('b', 'About 500 lines', 'Correct per the docs.'), o('c', 'About 5,000 lines', 'Far too large.'), o('d', 'No limit', 'The docs recommend keeping it concise.')],
      correct: 'b',
      explanation: 'Every loaded line is a recurring token cost.',
    },
    {
      id: 'l02-r3',
      kind: 'multi',
      concept: 'skill-anatomy',
      prompt: 'Select the Claude Code-specific fields.',
      options: [o('a', 'when_to_use', 'Claude Code field.'), o('b', 'license', 'A portable Agent Skills field, not Claude Code-specific.'), o('c', 'disallowed-tools', 'Claude Code field.'), o('d', 'metadata', 'A portable Agent Skills field, not Claude Code-specific.')],
      correct: ['a', 'c'],
      explanation: 'Portable: name, description, license, compatibility, metadata, allowed-tools.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'Locations, precedence, frontmatter reference, listing cap, 500-line guidance, upload restrictions.' }],
};
