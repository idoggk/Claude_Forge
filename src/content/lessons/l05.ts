import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS } from './helpers';

export const L05: Lesson = {
  id: 'L05-first-custom-skill',
  version: 1,
  track: 'C',
  order: 5,
  title: 'Your First Custom Skill',
  subtitle: 'Author, validate, export and test a real Skill',
  prerequisites: ['L03-trigger-dojo', 'L04-skill-autopsy'],
  competencies: ['skill-authoring'],
  effortMinutes: 20,
  gameRelevance: 2,
  interestTags: ['authoring', 'game-dev'],
  problem: 'You can describe your debugging process in a paragraph - but not yet as a Skill that loads at the right moment, follows a repeatable procedure, installs correctly and survives a real test.',
  whyItMatters: 'This is the lesson where reading becomes doing. The assessment is verified against the Skill you save in the Workshop.',
  objectives: [
    'Build a Skill in the Workshop that passes validation.',
    'Write scenarios (positive, negative, ambiguous) before exporting.',
    'Export a ZIP and know exactly how to install and live-test it.',
  ],
  segments: [
    {
      id: 's1',
      title: 'One job, one trigger, a procedure, a check',
      body: `A strong first Skill is small:
1. **One job** - "debug merge-cascade failures", not "help with the game".
2. **A trigger-rich description** (Lesson 3).
3. **A numbered procedure** in imperative voice: reproduce → name the violated invariant → locate the cause → minimal fix → verify.
4. **A verification step** that says how to know it worked (run the suite, show output).
5. **Boundaries:** when *not* to use it.

Put deep reference material (invariants, examples) in \`references/*.md\` and link to it; SKILL.md stays short.`,
    },
    {
      id: 's2',
      title: 'Never put secrets or live credentials in a Skill',
      body: `A Skill is plain text that gets copied, committed and shared. If it needs an API key, say *where the user supplies it* (an environment variable) - never the key itself. Forge blocks export when it finds key-shaped strings, but that check is advisory: you are the control.

Also keep scripts out unless essential. If you bundle one, expect every user to (rightly) read it first - Lesson 4.`,
    },
    {
      id: 's3',
      title: 'Validate → export → install → test',
      body: `1. **Validate** in the Workshop: required metadata, name format, description quality, YAML, file paths, contradictions, missing references, suspicious patterns.
2. **Export** the ZIP: \`<name>/SKILL.md\` plus supporting files. Forge never installs anything for you.
3. **Install** by copying the folder to \`~/.claude/skills/<name>/\` (personal) or \`.claude/skills/<name>/\` (project). \`~\` is your home directory (on Windows typically \`C:\\Users\\<you>\`).
4. **Check it loaded:** start a new Claude Code session and run \`/skills\`. \`/reload-skills\` is only needed to pick up a *newly created top-level skills directory*; other edits are detected live.
5. **Live-test** your scenarios and record what actually happened.
6. **Debug a failed load:** \`claude --debug\`, or \`claude plugin validate <skills-dir>\`.`,
    },
    {
      id: 's4',
      title: 'Version and revise',
      body: `Save a **revision snapshot** before each significant change so you can see what you changed when behaviour shifts. Change one thing at a time and re-run the same scenarios - that is the seed of the controlled experiments in Lesson 8.`,
    },
  ],
  activity: {
    title: 'Learn the rules, then build in the Workshop',
    intro: 'Answer the knowledge checks, then open the Workshop and create your Skill. The checklist below updates from what you actually save.',
    widget: 'workshop-link',
    items: [
      {
        id: 'l05-p1',
        kind: 'classify',
        concept: 'skill-authoring',
        prompt: 'Which Skill names are valid under the portable naming rules (lowercase letters/digits, single hyphens, up to 64 characters)?',
        categories: [
          { id: 'valid', label: 'Valid' },
          { id: 'invalid', label: 'Invalid' },
        ],
        entries: [
          { id: 'n1', text: 'merge-chain-debugger', correct: 'valid', why: 'Lowercase words separated by single hyphens.' },
          { id: 'n2', text: 'Merge_Debugger', correct: 'invalid', why: 'Capital letter and underscore.' },
          { id: 'n3', text: 'economy-sim-reviewer', correct: 'valid', why: 'Lowercase words separated by single hyphens.' },
          { id: 'n4', text: 'my skill', correct: 'invalid', why: 'Contains a space.' },
          { id: 'n5', text: 'review--gate', correct: 'invalid', why: 'Consecutive hyphens.' },
          { id: 'n6', text: 'deploy<prod>', correct: 'invalid', why: 'Angle brackets: Claude Code refuses names containing < or >.' },
        ],
        hints: ['Allowed: a-z, 0-9 and single hyphens between words.'],
        explanation: 'The Workshop validator checks the same rule before it lets you export.',
      },
      {
        id: 'l05-p2',
        kind: 'order',
        concept: 'skill-authoring',
        prompt: 'Put the publishing workflow in order.',
        steps: [
          { id: 'w1', text: 'Write the description, procedure and scenarios' },
          { id: 'w2', text: 'Fix every validation error' },
          { id: 'w3', text: 'Export the ZIP and read the SKILL.md inside it' },
          { id: 'w4', text: 'Copy the folder to ~/.claude/skills/ or .claude/skills/' },
          { id: 'w5', text: 'Start a new session and run /skills to confirm it is listed' },
          { id: 'w6', text: 'Live-test each scenario and record the observation' },
        ],
        hints: ['You cannot test what is not installed, and you should not export what does not validate.'],
        explanation: 'Reading the exported file before installing applies the Lesson 4 habit to your own work.',
      },
      {
        id: 'l05-p3',
        kind: 'single',
        concept: 'skill-authoring',
        prompt: 'Where do you put a Skill that every teammate should get when they clone the repository?',
        options: [
          o('a', '~/.claude/skills/<name>/', 'Personal scope - only your machine.'),
          o('b', '.claude/skills/<name>/ in the repository, committed', 'Correct - project scope.'),
          o('c', 'In CLAUDE.md', 'That is instructions, not a Skill.'),
          o('d', 'In a hook', 'Different mechanism.'),
        ],
        correct: 'b',
        explanation: 'Project Skills are committed with the repository.',
      },
    ],
  },
  assessment: {
    title: 'Authoring check (verified against your saved Skill)',
    intro: 'The first item is verified automatically from the Skill you saved in the Workshop. No hints.',
    passMark: 0.75,
    items: [
      {
        id: 'l05-a1',
        kind: 'external',
        concept: 'skill-authoring',
        check: 'workshop-first-skill',
        points: 4,
        prompt: 'Verified from your saved work: a Skill with no validation errors, a trigger phrase in its description, scenarios, and at least one export.',
        explanation: 'This item reads your Workshop data. Nothing is self-reported.',
      },
      {
        id: 'l05-a2',
        kind: 'single',
        concept: 'skill-authoring',
        critical: true,
        points: 2,
        prompt: 'Your Skill calls a service that needs an API key. What do you write in SKILL.md?',
        options: [
          o('a', 'The key, so Claude can use it directly', 'Skills are shared as plain text; a key in a Skill is a leaked key.'),
          o('b', 'An instruction to read the key from an environment variable the user sets, and never print it', 'Correct.'),
          o('c', 'The key, base64-encoded', 'Encoding is not protection.'),
          o('d', 'The key inside an HTML comment so it is hidden', 'Hidden text is still text - and a red flag in Lesson 4.'),
        ],
        correct: 'b',
        explanation: 'Never embed secrets.',
      },
      {
        id: 'l05-a3',
        kind: 'multi',
        concept: 'skill-authoring',
        prompt: 'Which content belongs in `references/` rather than SKILL.md? Select all.',
        options: [
          o('a', 'A long catalogue of invariants with examples', 'Yes - loaded only when needed.'),
          o('b', 'The five-step procedure Claude must always follow', 'No - keep the core procedure in SKILL.md.'),
          o('c', 'Detailed worked examples', 'Worked examples are bulky and only sometimes needed, so link them instead of loading them every time.'),
          o('d', 'The trigger description', 'No - it must be in the frontmatter.'),
        ],
        correct: ['a', 'c'],
        explanation: 'Progressive disclosure: core in SKILL.md, detail on demand.',
      },
      {
        id: 'l05-a4',
        kind: 'single',
        concept: 'skill-authoring',
        prompt: 'You edited an existing Skill\'s SKILL.md in ~/.claude/skills/. Do you need /reload-skills?',
        options: [
          o('a', 'Yes, always', 'Not for ordinary edits.'),
          o('b', 'No - edits are detected live; /reload-skills is for a newly created top-level skills directory', 'Correct per the docs.'),
          o('c', 'Yes, but only on Windows', 'Not platform-specific.'),
          o('d', 'You must restart the machine', 'Skill edits are picked up live; a machine restart has nothing to do with it.'),
        ],
        correct: 'b',
        explanation: 'Live edits, with one documented exception.',
      },
      {
        id: 'l05-a5',
        kind: 'single',
        concept: 'skill-authoring',
        prompt: 'Which procedure line is written best for Claude?',
        options: [
          o('a', 'It might be a good idea to maybe look at invariants.', 'Vague and hedged.'),
          o('b', 'State the violated invariant in one sentence before editing any code.', 'Correct: imperative, specific, checkable.'),
          o('c', 'Debugging is important.', 'Not an instruction.'),
          o('d', 'Be careful.', 'Claude cannot tell what to do, and you cannot verify that it did it.'),
        ],
        correct: 'b',
        explanation: 'Write steps Claude can follow and you can verify.',
      },
    ],
  },
  failureModes: [
    'A procedure with no verification step - Claude "finishes" without evidence.',
    'Skipping scenarios, so triggering is a surprise in production.',
    'Bundling scripts for convenience and shipping a hidden risk.',
    'Editing several things at once, then not knowing what changed behaviour.',
  ],
  application: {
    title: 'Install and use your Skill for real',
    body: 'Install the exported folder into a real project\'s .claude/skills/, start a fresh session, run /skills, and give it a real task. Record what happened in the Workshop\'s live-test log.',
    fieldPrompt: 'Log it under Growth → Field evidence once you have used your own Skill on real work.',
  },
  reviewItems: [
    {
      id: 'l05-r1',
      kind: 'single',
      concept: 'skill-authoring',
      prompt: 'Which command lists the Skills Claude Code has loaded?',
      options: [o('a', '/skills', 'Correct per the docs.'), o('b', '/memory', 'CLAUDE.md files.'), o('c', '/plugin marketplace list', 'That lists plugin marketplaces, not the Skills Claude Code has loaded.'), o('d', '/hooks', '/hooks shows hook configuration, not Skills.')],
      correct: 'a',
      explanation: '`/skills` lists available Skills.',
    },
    {
      id: 'l05-r2',
      kind: 'single',
      concept: 'skill-authoring',
      prompt: 'What does Forge\'s ZIP export contain?',
      options: [o('a', '<name>/SKILL.md plus your supporting files, nothing else', 'Correct.'), o('b', 'An installer script', 'Forge never ships executables.'), o('c', 'Your whole local database', 'The export contains only the Skill folder, never your app data.'), o('d', 'A Claude API key', 'Forge has no API key and never writes one into an export. are shared as plain text, so a key in one is a leaked key.')],
      correct: 'a',
      explanation: 'Inert text files only.',
    },
    {
      id: 'l05-r3',
      kind: 'multi',
      concept: 'skill-authoring',
      prompt: 'Select the things a good SKILL.md procedure includes.',
      options: [o('a', 'A verification step', 'Without a check, "done" is a claim rather than a result.'), o('b', 'Boundaries (when not to use)', 'Boundaries stop the Skill firing on neighbouring tasks.'), o('c', 'The author\'s API key', 'Skills are shared as plain text, so a key in one is a leaked key.'), o('d', 'Imperative, numbered steps', 'Numbered imperative steps are easy for Claude to follow and for you to verify.')],
      correct: ['a', 'b', 'd'],
      explanation: 'Verifiable, bounded, imperative.',
    },
  ],
  sources: [{ ...DOCS.skills, supports: 'Locations, /skills, /reload-skills, claude --debug, claude plugin validate, supporting files and 500-line guidance.' }],
};
