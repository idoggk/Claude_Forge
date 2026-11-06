import type { TransferKind } from '@/domain/transfer/model';

/**
 * Prompts for thinking, shown as PLACEHOLDERS (never pre-filled), so a transfer task cannot look complete because of
 * text Forge wrote. Each kind gets questions that fit what is being brought to real work.
 */
export interface TransferPrompts {
  problem: string;
  current: string;
  proposed: string;
  benefit: string;
  criteria: string;
  risks: string;
  observations: string;
}

export const TRANSFER_PROMPTS: Record<TransferKind, TransferPrompts> = {
  'prompt-technique': {
    problem: 'Which recurring task gives you inconsistent or wrong answers? Name one real example you could rerun.',
    current: 'How do you prompt for it today? Paste or describe the exact wording.',
    proposed: 'Which technique (for example few-shot examples or a structured output) will you add, and what exactly changes in the prompt?',
    benefit: 'What should improve, for example fewer rework rounds or fewer malformed outputs?',
    criteria: 'State a check you can run: for example "8 of 10 past cases give valid output with no retry", with the cases listed in advance.',
    risks: 'Could the technique overfit to your examples, leak sensitive data into the prompt, or make outputs look right while being wrong?',
    observations: 'What happened on the real cases, case by case? Include the ones where it did not help.',
  },
  skill: {
    problem: 'Which repeated task do you want a Skill to handle, in which real project?',
    current: 'How do you handle that task today, without the Skill?',
    proposed: 'Which Skill (yours or one you inspected) will you use, and what exact trigger and instructions does it add?',
    benefit: 'What should be faster, safer or more consistent?',
    criteria: 'How will you compare with and without the Skill? Consider an AI Lab experiment and link it here.',
    risks: 'What can the Skill read, write or run? Who reviewed it? What happens if it triggers when it should not?',
    observations: 'When did it trigger, when did it not, and what did it change?',
  },
  automation: {
    problem: 'Which manual step do you want to automate, and how often does it happen?',
    current: 'Describe today\'s manual steps and how long they take.',
    proposed: 'Which parts become automatic, which keep a human decision, and where does a gate check the output?',
    benefit: 'What time, errors or risk should drop?',
    criteria: 'What will you check before trusting it: a dry run, a diff, a count that must match?',
    risks: 'What is the worst thing it could do unattended? What stops it, and who is told when it fails?',
    observations: 'What ran, what you checked, and what surprised you.',
  },
  'agent-workflow': {
    problem: 'Which multi-step task do you want an agent to carry, in which real project?',
    current: 'How is the task done today, and where does it usually go wrong?',
    proposed: 'List the steps, the tools each may use, where a person approves, and where state is saved.',
    benefit: 'What should the agent save you, and what must it never do?',
    criteria: 'Define done in checkable terms, for example "all tests pass in my own run and the diff touches only these files".',
    risks: 'What permissions does it need? What if it loops, drifts from the goal, or acts on injected text in a file it reads?',
    observations: 'What did the agent actually do? Note interventions, retries, and any step you had to take over.',
  },
  'research-procedure': {
    problem: 'Which question will you research, and what decision depends on the answer?',
    current: 'How do you research this today, and where do you doubt the results?',
    proposed: 'Which sources, in what order, with what evidence standard, and how will you record what is unknown?',
    benefit: 'What should be more complete or better sourced?',
    criteria: 'How will you check claims: each needs a source you opened and read yourself?',
    risks: 'Stale pages, a model summarising what it did not read, and sources that all repeat one origin.',
    observations: 'Which claims survived checking, which did not, and what stayed unknown.',
  },
  'game-dev-workflow': {
    problem: 'Which game-development task do you want to improve (balance, debugging, tooling, content), in which project?',
    current: 'How do you do it now, and what does it cost in time or rework?',
    proposed: 'Which workflow, Skill or prompt will you use, and what stays in your hands (design decisions, final numbers)?',
    benefit: 'What should be faster or more reliable, and how would you notice?',
    criteria: 'Name a check that does not depend on the model saying so: a replay, a deterministic sim, a test.',
    risks: 'Changes that break determinism, balance tweaks that look right on one seed, and design decisions made by default.',
    observations: 'What happened in the project, including what you reverted.',
  },
  other: {
    problem: 'What real problem are you trying to solve, and where?',
    current: 'How is it done today?',
    proposed: 'What exactly will you change?',
    benefit: 'What should get better?',
    criteria: 'How will you know, in a way someone else could check?',
    risks: 'What could go wrong?',
    observations: 'What happened, including what did not work?',
  },
};
