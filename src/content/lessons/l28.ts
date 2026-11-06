import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

/** The workflows, teams and numbers below are invented. Nothing here runs. */
const parse = (s: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

const DESIGN_REFERENCE = JSON.stringify(
  {
    workflow: 'nightly email triage',
    success_criteria: ['Every email gets exactly one tag from the fixed list of eight', '95% of tags match a hand-checked sample of 50 each month'],
    steps: [
      { id: 's1', name: 'Fetch the new emails', kind: 'code', checkpoint: true },
      { id: 's2', name: 'Tag each email and write a one-line summary', kind: 'model', check: 'Schema validation: the tag must be one of the eight' },
      { id: 's3', name: 'Route low-confidence or invalid items to a person', kind: 'human', approval: true },
      { id: 's4', name: 'Create the tickets', kind: 'code', checkpoint: true, retries: 2 },
    ],
    on_failure: 'Stop, keep completed work, report what remains and retry at most twice',
    monitoring: 'A morning report with counts of tagged, routed to a person and failed, and an alert when failures exceed 5%',
    cost_limit: 'Stop the run if model spend exceeds a fixed daily budget',
    maintenance: 'Re-check the tag list and the sample accuracy each month; owner: support lead',
  },
  null,
  2,
);

export const L28: Lesson = {
  id: 'L28-ai-workflow-architecture',
  version: 1,
  track: 'automation',
  alsoIn: ['engineering', 'agents'],
  order: 28,
  title: 'Real-World AI Workflow Architecture',
  subtitle: 'Break a task into steps, choose the plainest design that works, and add checkpoints, retries, approvals, monitoring and an owner',
  prerequisites: ['L15-reliable-ai-workflow', 'L11-choose-ai-approach'],
  competencies: ['workflow-architecture'],
  effortMinutes: 50,
  gameRelevance: 1,
  interestTags: ['automation', 'ai-judgment', 'orchestration'],
  problem: 'A team automates support-email triage by giving one agent the whole job. It works in the demo. In the first month it costs three times the estimate, silently drops emails after a crash, retries one failing call forever, mislabels a few percent and nobody owns it when the tag list changes.',
  whyItMatters: 'Most AI projects that fail in practice do not fail on the model. They fail on the design around it: unclear success criteria, no checkpoints, unbounded retries, no monitoring and no owner. Architecture is where reliability is decided.',
  objectives: [
    'Break a task into steps and decide for each whether it needs a model, ordinary code or a person.',
    'Choose the simplest design that meets the need, and justify adding autonomy only where it pays.',
    'Place checkpoints, bounded retries and approvals where failure costs the most.',
    'Define success criteria and monitoring before building, and say what would make you stop.',
    'Account for cost and maintenance: who owns it, what drifts, and what it costs to keep running.',
  ],
  segments: [
    {
      id: 's1',
      title: 'Start from the task, not the model',
      prediction: {
        prompt: 'A nightly job must tag 200 emails from a fixed list of eight and create tickets. Which design is the best starting point?',
        options: [
          o('a', 'A fixed pipeline: fetch, one model call per email for the tag, validate in code, then create tickets', 'The steps are known and the output is checkable, so fixed steps beat autonomy.'),
          o('b', 'One autonomous agent that decides each night how to read, tag and file every email on its own', 'Autonomy adds cost and variance to a job whose steps are already known.', 'agents-always-better'),
          o('c', 'A team of three specialised agents that discuss each email and agree on a tag before anything is filed', 'More moving parts for a task that is one classification, and more places to fail.', 'agents-always-better'),
        ],
        correct: 'a',
      },
      body: `Design starts with the task. Write down, in order, what has to happen to get from the input to the outcome. Then ask of each step:

- Is it **deterministic**? Use code. Fetching, parsing, validating and filing rarely need a model.
- Does it need **language understanding**? Use a model, with a check on its output.
- Does it need **judgment about a consequential or ambiguous case**? Use a person.

Anthropic's agent guidance recommends finding the simplest solution that works and adding complexity only when it demonstrably improves outcomes. A workflow with predefined steps is easier to test, cheaper and more predictable than an agent that chooses its own path. Use an agent when the steps genuinely cannot be known in advance.`,
    },
    {
      id: 's2',
      title: 'Success criteria and what would make you stop',
      body: `Before building, write down how you will know it works:

- **A measurable criterion**: "95% of tags match a hand-checked sample of 50 each month", not "the tags look good".
- **The cost of failure**: a wrong tag routes a ticket to the wrong team. How bad is that, and how often is acceptable?
- **A stop condition**: the level of failure or cost at which you pause the workflow and look.

Without these, "it works" means "nobody has complained yet", and a drifting system looks identical to a healthy one until it is expensive.`,
    },
    {
      id: 's3',
      title: 'Checkpoints, retries and approvals',
      body: `Reliability comes from a few deliberate controls:

- **Checkpoints.** Save progress after each meaningful step so a failure at step seven resumes there instead of restarting or losing work.
- **Bounded retries.** Retry transient failures a small, fixed number of times, then stop and report. An unbounded retry turns one failure into cost and noise.
- **Checks where a model's output enters code.** Validate the shape and the allowed values, and prefer a deterministic check to asking the model if it is sure.
- **Human approval where it matters.** Before an irreversible or external action, or for the uncertain few. Route low-confidence items to a person instead of guessing.
- **Idempotence.** If a step runs twice, it must not create two tickets.

Each control costs something. Put them where a failure is expensive, not everywhere.`,
    },
    {
      id: 's4',
      title: 'Monitoring, cost and maintenance',
      body: `A workflow that nobody watches is a risk with a schedule.

- **Monitoring.** Count what happened: processed, routed to a person, failed. Alert on a threshold, not on silence.
- **Cost.** Estimate cost per run and set a limit that stops the run. Model cost scales with volume, context size and retries.
- **Drift.** Inputs change, a tag list changes, a model version changes. Re-check against a hand-labelled sample on a schedule.
- **An owner.** Someone who is responsible when it breaks and when the world changes.
- **Maintenance cost.** A clever design that only its author understands is expensive later. Prefer plain steps that another person can read.

Include the cost of keeping it running when you decide whether to build it at all.`,
    },
  ],
  activity: {
    title: 'Assign each step to code, a model or a person',
    intro: 'Guided practice on an invented support-email workflow. Nothing runs.',
    items: [
      {
        id: 'l28-p1',
        kind: 'classify',
        concept: 'workflow-architecture',
        prompt: 'For the nightly triage workflow, who or what should do each step?',
        categories: [
          { id: 'code', label: 'Ordinary code' },
          { id: 'model', label: 'A model call, with a check' },
          { id: 'person', label: 'A person' },
        ],
        entries: [
          { id: 'e1', text: 'Fetch the new emails from the mailbox', correct: 'code', why: 'Deterministic and needs no language understanding.' },
          { id: 'e2', text: 'Decide which of the eight tags best fits the email', correct: 'model', why: 'It needs language understanding, and the output can be checked against the fixed list.' },
          { id: 'e3', text: 'Reject any tag that is not on the list of eight', correct: 'code', why: 'A deterministic check should not depend on a model\'s opinion.' },
          { id: 'e4', text: 'Decide what to do with an email the model is unsure about', correct: 'person', why: 'An ambiguous case with a routing cost is the place for human judgment.' },
          { id: 'e5', text: 'Create the ticket and record that it was created', correct: 'code', why: 'A deterministic, auditable action.' },
          { id: 'e6', text: 'Write a one-line summary of the email for the ticket', correct: 'model', why: 'Language generation, with low consequence if it is slightly off.' },
        ],
        explanation: 'Use code where the step is deterministic, a model where language is needed (with a check), and a person for the uncertain and the consequential.',
      },
      {
        id: 'l28-p2',
        kind: 'single',
        concept: 'workflow-architecture',
        prompt: 'The ticket-creation step fails after 120 of 200 emails. What design handles this best?',
        options: [
          o('a', 'Checkpoints after each batch, a bounded retry, then stop and report which emails remain', 'Work is saved, the failure is bounded and visible, and the run can resume.'),
          o('b', 'Restart the whole run from the first email so that every ticket is created in one clean pass again', 'Restarting repeats work and can create duplicate tickets unless the step is idempotent.'),
          o('c', 'Retry the failing call forever until it succeeds, so that no email is ever left without a ticket', 'Unbounded retries turn one failure into cost and noise.'),
          o('d', 'Skip the failed emails without saying so and report that the run completed, since most tickets were created', 'Hiding a partial failure removes the signal that somebody must act.'),
        ],
        correct: 'a',
        hints: ['What do you want to know in the morning?'],
        explanation: 'Checkpoint, bound the retry, stop and report.',
      },
      {
        id: 'l28-p3',
        kind: 'case',
        format: 'diagnosis',
        concept: 'workflow-architecture',
        prompt: 'Diagnose this month\'s report.',
        situation: 'The team\'s triage agent has run for a month. This is what they found. All figures are invented.',
        artifact: [
          'design: one agent reads, tags, files and replies to every email on its own',
          'cost: estimated 40 per month, actual 130 per month',
          'week 2: a crash at 3 am; 60 emails were never tagged; nobody noticed until a customer wrote in',
          'week 3: one failing ticket call retried for six hours',
          'week 4: the company added a ninth tag; accuracy fell and nobody was told',
          'owner: (none)',
        ],
        parts: [
          {
            id: 'cause',
            label: 'What is the underlying design problem?',
            options: [
              o('a', 'No success criteria, checkpoints, bounded retries, monitoring or owner: only the happy path was designed', 'Every symptom traces to a missing control, not to the model.'),
              o('b', 'The model chosen was too weak, so a larger model would have avoided the crash, the retries and the drift', 'A stronger model would not have saved progress, bounded retries, alerted anyone or updated the tag list.'),
              o('c', 'The team sent too many emails through the workflow in a single month for any automation to cope with', 'Volume was planned for; the problems are controls and ownership.'),
            ],
            correct: 'a',
          },
          {
            id: 'first',
            label: 'Which single change would have prevented the most harm?',
            options: [
              o('a', 'Monitoring with an alert on failures and a morning report of counts, so that the crash was seen on day one', 'Visibility turns a silent failure into a short one.'),
              o('b', 'A longer prompt that tells the agent to be more careful about crashing and to never retry for too long', 'A prompt cannot stop a crash or bound a retry; code does that.'),
              o('c', 'A cheaper model, so that the same silent failures at least cost less to run during the month', 'It reduces cost but leaves the failures invisible.'),
            ],
            correct: 'a',
          },
          {
            id: 'redesign',
            label: 'What is the soundest redesign?',
            options: [
              o('a', 'A fixed pipeline with a model only for tagging, validation in code, checkpoints, bounded retries, a cost limit, monitoring and a named owner', 'It uses the plainest design that meets the need and adds controls where failure is expensive.'),
              o('b', 'Keep the single agent but add a second agent that watches the first and reports on whatever it believes went wrong', 'Another model watching the first shares its blind spots and still needs monitoring around it.'),
              o('c', 'Stop automating email triage altogether and have a person tag every email by hand from now on', 'The task is repeated and checkable, so automation with controls is a good fit.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'The model was not the problem. A design with no success criteria, checkpoints, bounds, monitoring or owner will fail in the same ways with any model.',
      },
    ],
  },
  assessment: {
    title: 'Independent check: workflow architecture',
    intro: 'New situations. Decide from the constraints given.',
    passMark: 0.7,
    items: [
      {
        id: 'l28-a1',
        kind: 'case',
        format: 'scenario',
        concept: 'workflow-architecture',
        critical: true,
        points: 2,
        prompt: 'Choose the design.',
        situation: 'A finance team wants to extract line items from supplier invoices (PDF text) into their ledger system every week.',
        constraints: [
          'Invoices vary in layout, but the fields to extract are fixed: supplier, date, line items and total.',
          'A wrong amount in the ledger is expensive to unwind and must be caught before posting.',
          'About 300 invoices arrive each week; cost per run matters.',
          'A finance analyst is available for a short review each week.',
        ],
        parts: [
          {
            id: 'design',
            label: 'Which design fits?',
            options: [
              o('a', 'A fixed pipeline: extract fields with one model call per invoice, validate arithmetic and formats in code, then queue for posting', 'The fields are fixed and checkable, so fixed steps with validation beat autonomy.'),
              o('b', 'An autonomous agent that decides how to read each invoice, looks up suppliers and posts entries directly to the ledger', 'Autonomy and direct posting remove the checks where a wrong amount is expensive.', 'agents-always-better'),
              o('c', 'A person types in every invoice by hand, because ledger errors cost too much for any automation to be trusted', 'A repeated, checkable extraction suits automation, with review where it matters.'),
            ],
            correct: 'a',
          },
          {
            id: 'check',
            label: 'Where does the strongest check go?',
            options: [
              o('a', 'In code before posting: line items must sum to the total, dates and amounts must parse, and mismatches go to the analyst', 'Arithmetic is deterministic, and it catches the errors that are expensive.'),
              o('b', 'In a second model call that is asked whether the first model\'s extraction looks right, with the analyst skipped', 'The same kind of author vouching for itself, with the human removed.'),
              o('c', 'After posting, as a monthly report that the analyst reads to find any entries that look unusual in hindsight', 'After the fact it is a report, and the wrong amounts are already in the ledger.'),
            ],
            correct: 'a',
          },
          {
            id: 'human',
            label: 'Where does the analyst approve?',
            options: [
              o('a', 'On the items that fail validation or that the model marks uncertain, before anything is posted', 'A person reviews the few that matter, with the details in view.'),
              o('b', 'On every invoice, one by one, before posting, so that the analyst has seen all 300 of them each week', 'Reviewing everything wastes the point of automation and trains reflex approval.'),
              o('c', 'Nowhere, because the validation in code already guarantees that every posted amount is the correct one', 'Validation catches arithmetic errors, not every wrong but consistent value.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'Fixed steps, a deterministic check before posting, and a person on the exceptions.',
      },
      {
        id: 'l28-a2',
        kind: 'case',
        format: 'scenario',
        concept: 'workflow-architecture',
        points: 2,
        prompt: 'Same team, changed constraints.',
        situation: 'The finance team now wants the assistant to investigate unusual supplier charges: it should read invoices, contracts and emails and explain what looks wrong.',
        constraints: [
          'The sources to read vary widely, and nobody can list the steps in advance.',
          'The output is a written explanation for an analyst to read, not an entry in the ledger.',
          'Nothing is written or sent; the agent only reads.',
          'The analyst will verify any claim that matters before acting on it.',
        ],
        parts: [
          {
            id: 'design',
            label: 'Which design now fits?',
            options: [
              o('a', 'A read-only agent that explores the documents and returns an explanation with pointers to what it read', 'The steps cannot be known in advance, nothing is written, and a person verifies the result.'),
              o('b', 'The same fixed extraction pipeline as before, run again on each document set and posted to the ledger', 'The task is open-ended exploration, which a fixed extraction pipeline does not do.'),
              o('c', 'An agent with write access to the ledger, so that it can correct entries as soon as it finds an error', 'Writes to the ledger are consequential and the analyst has not verified them.'),
            ],
            correct: 'a',
          },
          {
            id: 'controls',
            label: 'Which controls matter most here?',
            options: [
              o('a', 'Read-only permissions, a step and cost limit, and pointers to evidence so that the analyst can check each claim', 'Bound the autonomy, and make the output checkable.'),
              o('b', 'Approval before every file the agent opens, so that the analyst sees each document before it is read by the agent', 'A gate on every read is a reflex click and defeats the purpose of exploration.'),
              o('c', 'No limits, because a read-only agent cannot do any harm however long it runs or however much it reads', 'Reading is bounded risk but unbounded cost; a limit is still needed.'),
            ],
            correct: 'a',
          },
          {
            id: 'trust',
            label: 'How should the agent\'s explanation be treated?',
            options: [
              o('a', 'As a set of leads with pointers, which the analyst spot-checks before acting on anything that matters', 'A summary from an agent is a claim, not a fact.'),
              o('b', 'As verified, because the agent read the actual documents and so its explanation reflects the evidence', 'It may have misread or missed something, and the analyst has not seen its checks.'),
              o('c', 'As worthless, because an agent\'s explanation can never be relied on for any purpose in a finance setting', 'It is useful as a lead; it just is not proof.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'Open-ended exploration with no writes is where an agent earns its place; the design then bounds it and keeps a person on the verification.',
      },
      {
        id: 'l28-a2b',
        kind: 'case',
        format: 'diagnosis',
        concept: 'workflow-architecture',
        critical: true,
        points: 2,
        prompt: 'Diagnose this workflow design.',
        situation: 'A workflow was designed to extract data from forms and update a customer database every night. This is its design and what happened in week one. Names and figures are invented.',
        artifact: [
          'step 1 (agent): read forms, decide the fields, update the customer database directly',
          'validation: none; the model is asked at the end whether it is sure',
          'retries: until success',
          'monitoring: none; the owner is "the team"',
          'week 1: 40 customer records overwritten with a wrong phone number format; the agent retried a locked record 900 times',
        ],
        parts: [
          {
            id: 'cause',
            label: 'What caused the overwritten records?',
            options: [
              o('a', 'The model wrote directly to the database with no validation or approval, so a wrong value became a permanent change', 'A consequential write was made with no check in code and no person.'),
              o('b', 'The forms were too long for the model to read, so it guessed at the phone numbers when the text ran out', 'Nothing in the trace points to truncated input; the failure was what happened to the output.'),
              o('c', 'The nightly schedule was too frequent, which gave the workflow too many chances to make the same mistake', 'Frequency scaled the damage but did not cause it.'),
            ],
            correct: 'a',
          },
          {
            id: 'retry',
            label: 'What is wrong with the retry design?',
            options: [
              o('a', 'Retries are unbounded and the write is not idempotent, so one locked record produced hundreds of attempts', 'Retries should be few and bounded, and repeating a step must be harmless.'),
              o('b', 'Retries should never be used in a workflow, because any retry means that the first attempt was designed badly', 'Bounded retries are a normal control for transient failures.'),
              o('c', 'The retry count was too low, so the workflow gave up before the locked record became available again', 'It retried 900 times, which is the opposite of too few.'),
            ],
            correct: 'a',
          },
          {
            id: 'fix',
            label: 'What is the safest redesign?',
            options: [
              o('a', 'Fixed steps: extract, validate formats in code, route doubtful records to a person, write with a checkpoint, bound retries, alert on failures and name an owner', 'It adds checks in code, a human on the uncertain cases and visibility, and keeps the design plain.'),
              o('b', 'Keep the agent but ask a second model to confirm each update before the agent is allowed to write it to the database', 'A second model shares the first one\'s blind spots and is not a deterministic check.'),
              o('c', 'Keep the design and add a sentence to the prompt asking the agent to double-check phone numbers before it writes', 'A request that the agent can still fail to follow, with no control in code.'),
            ],
            correct: 'a',
          },
        ],
        explanation: 'A consequential write needs a check in code, a person for the uncertain, bounded and safe retries, and monitoring with an owner.',
      },
      {
        id: 'l28-a3',
        kind: 'construct',
        format: 'json',
        concept: 'workflow-architecture',
        points: 2,
        prompt: 'Write the design for a workflow.',
        brief: `Design a small workflow as JSON for this: **each night, tag about 200 support emails from a fixed list of eight tags, and create a ticket for each.** It is a design sketch for review.

Include: a \`workflow\` name; \`success_criteria\` (at least one that is measurable); \`steps\`, each with an \`id\`, a \`name\` and a \`kind\` of \`code\`, \`model\` or \`human\`; at least one step that is a \`model\` step with a \`check\`, at least one \`human\` step, and at least one step with a \`checkpoint\`; \`on_failure\` with a bounded retry; \`monitoring\`; a \`cost_limit\`; and \`maintenance\` that names an owner.`,
        placeholder: '{\n  "workflow": "..."\n}',
        checks: [
          { id: 'json', label: 'It is valid JSON with a workflow name', why: 'Give the design a "workflow" name string.', test: (d) => str(parse(d)?.workflow).length > 2 },
          { id: 'criteria', label: 'It has a measurable success criterion', why: 'Add success_criteria with at least one entry that contains a number, for example a percentage of a hand-checked sample.', test: (d) => { const c = parse(d)?.success_criteria; return Array.isArray(c) && c.some((x) => /\d/.test(String(x))); } },
          { id: 'steps', label: 'Every step has an id, a name and a kind of code, model or human', why: 'Each step needs an id, a name and a kind (code, model or human) so that the design shows who does what.', test: (d) => { const s = arr(parse(d)?.steps); return s.length >= 3 && s.every((x) => str(x.id).length > 0 && str(x.name).length > 2 && ['code', 'model', 'human'].includes(str(x.kind))); } },
          { id: 'modelcheck', label: 'A model step has a deterministic check', why: 'Every model step should have a check on its output, for example schema validation against the list of eight tags.', test: (d) => { const m = arr(parse(d)?.steps).filter((x) => str(x.kind) === 'model'); return m.length >= 1 && m.every((x) => str(x.check).length > 5); } },
          { id: 'human', label: 'A person handles the uncertain cases', why: 'Add a human step for low-confidence or invalid items, rather than guessing.', test: (d) => arr(parse(d)?.steps).some((x) => str(x.kind) === 'human') },
          { id: 'checkpoint', label: 'At least one step is a checkpoint', why: 'Mark at least one step with checkpoint: true so a failure resumes instead of restarting.', test: (d) => arr(parse(d)?.steps).some((x) => x.checkpoint === true) },
          { id: 'failure', label: 'Failure handling bounds its retries', why: 'on_failure must say that it stops and reports, and give a fixed retry limit rather than retrying forever.', test: (d) => { const f = str(parse(d)?.on_failure); return /stop|report/i.test(f) && /\d|twice|once|three|bounded|at most/i.test(f) && !/forever|indefinite|unlimited/i.test(f); } },
          { id: 'ops', label: 'It has monitoring, a cost limit and a named owner', why: 'Add monitoring, a cost_limit, and a maintenance line that names an owner.', test: (d) => { const p = parse(d); return str(p?.monitoring).length > 10 && str(p?.cost_limit).length > 5 && /owner/i.test(str(p?.maintenance)); } },
        ],
        rubric: [
          'Is the plainest design that meets the need the one you chose?',
          'If the model were replaced by a different one tomorrow, would your checks still catch the errors that matter?',
          'What would make you stop the workflow, and who would notice?',
          'Could another person read this design and maintain the workflow?',
        ],
        reference: DESIGN_REFERENCE,
        explanation: 'A design is useful when each step has an owner of its kind, each model output has a check, failures are bounded and visible, and somebody owns it.',
      },
      {
        id: 'l28-a4',
        kind: 'multi',
        concept: 'workflow-architecture',
        prompt: 'Select the controls that reduce the cost of a failure in an unattended nightly workflow.',
        options: [
          o('a', 'Checkpoints after each batch, so that a failure part way resumes instead of restarting', 'Saved progress means less repeated work and less lost work.'),
          o('b', 'A bounded retry count, after which the run stops and reports what remains', 'It prevents one failure turning into endless cost.'),
          o('c', 'An alert when failures exceed a threshold, and a daily summary of counts for a named person', 'A failure that nobody sees continues until a customer notices.'),
          o('d', 'A longer prompt telling the model never to fail and to try again until each step has succeeded', 'A prompt cannot stop a crash or bound a retry; code does that.'),
          o('e', 'Making every step idempotent, so that running a step twice does not create a second ticket', 'Safe to retry means retries cannot do damage.'),
        ],
        correct: ['a', 'b', 'c', 'e'],
        explanation: 'Checkpoints, bounded retries, alerts and idempotence are controls in code and operations. A prompt cannot provide them.',
      },
      {
        id: 'l28-a5',
        kind: 'single',
        concept: 'workflow-architecture',
        prompt: 'Which success criterion is best written before building a triage workflow?',
        options: [
          o('a', '95% of tags match a hand-checked sample of 50 emails each month, and failures stay under 5% of runs', 'Measurable, checkable and stated in advance.'),
          o('b', 'The tags should look sensible to the support team and the workflow should feel reliable once it has been running', 'It cannot be measured and gives no point at which to stop.'),
          o('c', 'The workflow should use the most capable model that the budget allows so that errors are rare and the team is happy', 'It describes an input choice, not an outcome that anyone can check.'),
          o('d', 'Nobody should complain about a wrong tag during the first three months of the workflow running in production', 'Silence is not a measurement; complaints depend on who notices.'),
        ],
        correct: 'a',
        explanation: 'A criterion is useful if you can check it against a sample and tell when to stop.',
      },
      {
        id: 'l28-a6',
        kind: 'classify',
        concept: 'workflow-architecture',
        prompt: 'For each situation, say whether it points towards a fixed workflow or an agent.',
        categories: [
          { id: 'workflow', label: 'Fixed workflow' },
          { id: 'agent', label: 'Agent' },
        ],
        entries: [
          { id: 'e1', text: 'Convert 300 files with a fixed mapping, then validate each against a schema', correct: 'workflow', why: 'The steps are known and the output is checkable.' },
          { id: 'e2', text: 'Investigate a production fault where each next step depends on what the last one found', correct: 'agent', why: 'The path cannot be known in advance, which is where autonomy earns its place.' },
          { id: 'e3', text: 'Send a weekly report built from three fixed queries', correct: 'workflow', why: 'Fully specified, repeated and deterministic.' },
          { id: 'e4', text: 'Explore an unfamiliar repository to find where a feature is implemented, read-only', correct: 'agent', why: 'Open-ended exploration with low risk and a checkable result.' },
          { id: 'e5', text: 'Tag emails from a fixed list and file a ticket for each', correct: 'workflow', why: 'One classification per item with a validated output.' },
        ],
        explanation: 'Known steps and checkable outputs point to a fixed workflow; unknowable paths with low risk point to an agent.',
      },
    ],
  },
  failureModes: [
    'Handing the whole job to one autonomous agent when the steps are already known.',
    'No measurable success criterion, so "it works" means "nobody has complained yet".',
    'Unbounded retries, or retries on a step that is not idempotent.',
    'No checkpoints, so a crash loses work or silently skips items.',
    'No monitoring, cost limit or owner, so drift and cost rise unseen.',
    'Putting a human approval on everything, or on nothing.',
  ],
  application: {
    title: 'Redesign one workflow you run',
    body: 'Take one automation or repeated AI task. Write its steps, mark each as code, model or person, write a measurable success criterion, and add checkpoints, a bounded retry, monitoring, a cost limit and an owner. Remove one piece of autonomy you cannot justify.',
    fieldPrompt: 'Log it under Growth → Field evidence when a redesigned workflow caught or bounded a failure in real use.',
  },
  reviewItems: [
    { id: 'l28-r1', kind: 'single', concept: 'workflow-architecture', difficulty: 1, prompt: 'When should you use code rather than a model for a step?', options: [o('a', 'When the step is deterministic and does not need language understanding, such as fetching, parsing or validating', 'Code is cheaper, faster and checkable for deterministic steps.'), o('b', 'Never, because a model can do every step of a workflow at least as well as ordinary code can do it', 'A model is slower, costlier and less predictable for deterministic work.'), o('c', 'Only for the final step, because the model should be left in charge of everything that comes before it', 'Where the model sits is decided by what each step needs.'), o('d', 'Only when the data is small, since code cannot cope with the volumes that a model is able to handle', 'Code handles volume well; size is not the criterion.')], correct: 'a', explanation: 'Match each step to what it needs.' },
    { id: 'l28-r2', kind: 'single', concept: 'workflow-architecture', difficulty: 1, prompt: 'What is the main reason to prefer a fixed workflow when the steps are known?', options: [o('a', 'It is cheaper, more predictable and easier to test and verify than an agent that chooses its own path', 'Predefined steps remove variance and make each step checkable.'), o('b', 'It is always more capable than an agent, which cannot complete tasks that involve more than a few steps', 'Agents can handle long tasks; the argument is about fit and cost.'), o('c', 'It is required by the Claude Code documentation for every task that is run on a regular schedule', 'No such requirement exists; it is a design judgment.'), o('d', 'It avoids using a model at all, which removes every kind of error from the task that is being automated', 'A workflow can use a model at some steps and still be predictable.')], correct: 'a', explanation: 'Fixed steps trade flexibility you do not need for predictability you do.' },
    { id: 'l28-r3', kind: 'single', concept: 'workflow-architecture', difficulty: 2, prompt: 'A step fails and is retried with no limit. What is the main risk?', options: [o('a', 'One failure turns into unbounded cost and noise, and may repeat side effects', 'Retries should be few, bounded and safe to repeat.'), o('b', 'The step will run too quickly, which reduces the chance that the other steps can finish in the time allowed', 'Speed is not the risk; the risk is that it never stops.'), o('c', 'The model will learn from the repeated failures and become less accurate on the next run of the workflow', 'Models do not learn from retries in this way.'), o('d', 'Nothing, because a step that keeps retrying will eventually succeed and so the workflow will always finish', 'It may never succeed, and each attempt costs something.')], correct: 'a', explanation: 'Bound retries, then stop and report.' },
    { id: 'l28-r4', kind: 'single', concept: 'workflow-architecture', difficulty: 2, prompt: 'Why does a workflow step need to be idempotent?', options: [o('a', 'So that a retry or a resumed run cannot create a second ticket or repeat a side effect', 'Safe repetition is what makes retries and resumes possible.'), o('b', 'So that the model always returns exactly the same words when it is given the same input twice in a row', 'Idempotence is about effects on the world, not about identical wording.'), o('c', 'So that the step runs faster after the first time, because its result is stored in a cache by the platform', 'It is a correctness property, not a speed optimisation.'), o('d', 'So that no human approval is needed, because a step that cannot be repeated by mistake needs no oversight', 'Approval and idempotence address different risks.')], correct: 'a', explanation: 'Retries are safe only if repeating a step is harmless.' },
    { id: 'l28-r5', kind: 'multi', concept: 'workflow-architecture', difficulty: 2, prompt: 'Select the things a monitoring report for a nightly workflow should show.', options: [o('a', 'How many items were processed, routed to a person and failed in the run', 'Counts show what happened without anyone having to guess.'), o('b', 'Whether failures crossed the alert threshold, and the cost of the run against its limit', 'Thresholds turn a number into a decision about whether to act.'), o('c', 'A statement that everything went well, written by the model that did the work, with no figures attached', 'The same author vouching for itself, without evidence.'), o('d', 'Which items are waiting for a person, with how long each has been waiting for a decision', 'Items routed to humans can quietly pile up if nobody can see them.')], correct: ['a', 'b', 'd'], explanation: 'Counts, thresholds and queues. Not self-reported reassurance.' },
    { id: 'l28-r6', kind: 'single', concept: 'workflow-architecture', difficulty: 3, prompt: 'Why should a workflow have a named owner?', options: [o('a', 'Inputs, tags and models drift, and somebody must be responsible when it breaks and when the world changes', 'Without an owner, drift and failures go unhandled.'), o('b', 'Because ownership makes the workflow run faster, since a named person can approve every step in less time', 'Ownership is about responsibility, not speed.'), o('c', 'Because the model needs a human to give it instructions every night before it is allowed to begin a run', 'An unattended workflow runs without that; the owner handles exceptions.'), o('d', 'Because a workflow with an owner cannot fail, as the owner is able to prevent every error in advance', 'Owners respond to failure; they do not prevent all of it.')], correct: 'a', explanation: 'Reliability over time needs a responsible person.' },
    { id: 'l28-r7', kind: 'single', concept: 'workflow-architecture', difficulty: 3, prompt: 'A team wants a second model to check that the first model\'s tags look right. What is the main weakness?', options: [o('a', 'It is not independent or deterministic, so a code check against the allowed list is stronger where one is possible', 'A model checking a model shares blind spots; validate in code when the rule is checkable.'), o('b', 'Two models always cost more than one, which is the only reason that anyone avoids using a model as a checker', 'Cost is a factor but not the main weakness.'), o('c', 'The second model cannot read the first model\'s output, so it would have to check the tags without seeing them', 'It can read the output; the issue is the quality of the check.'), o('d', 'It would block every tag, since a second opinion always disagrees with the first in a pipeline that is automated', 'Models often agree, including when both are wrong.')], correct: 'a', explanation: 'Prefer deterministic checks; use a model check as extra signal, not as the gate.' },
    { id: 'l28-r8', kind: 'single', concept: 'workflow-architecture', difficulty: 3, prompt: 'Where does a person belong in an automated triage workflow?', options: [o('a', 'On the low-confidence and invalid items and before irreversible actions, not on every item', 'Put human judgment where it adds the most and where a mistake costs the most.'), o('b', 'On every item, because only a person can be trusted to confirm that the right tag has been chosen', 'Reviewing everything removes the benefit and trains reflex approval.'), o('c', 'Nowhere, because validation in code removes all risk and so nobody needs to look at any of the output', 'Validation catches impossible values, not every wrong but allowed one.'), o('d', 'Only at the very start, to approve the design, after which a person has no further part in the workflow', 'Exceptions and drift appear during operation, so a person must stay in the loop for them.')], correct: 'a', explanation: 'Humans handle the uncertain and the consequential few.' },
  ],
  sources: [
    { ...ARTICLES.buildingAgents, supports: 'Workflows versus agents, starting with the simplest solution and adding complexity only when it improves outcomes.' },
    { ...ARTICLES.longRunningHarness, supports: 'Resumable work, checkpoints and not trusting a claim of completion.' },
    { ...ARTICLES.writingTools, supports: 'Designing tool results so failures and empty results are unambiguous.' },
    { ...DOCS.workflows, supports: 'Common workflows with Claude Code and their verification steps.' },
    { ...DOCS.hooks, supports: 'Deterministic checks at defined points as an alternative to asking a model to comply.' },
  ],
};
