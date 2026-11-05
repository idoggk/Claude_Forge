import type { Lesson } from '@/domain/curriculum/types';
import { o, DOCS, ARTICLES } from './helpers';

const LAYERS = [
  { id: 'schema', label: 'Schema validation (shape)' },
  { id: 'policy', label: 'Policy check (meaning and permission)' },
  { id: 'tool', label: 'Tool-side error handling' },
  { id: 'approval', label: 'Human approval' },
];

/** A fabricated tool definition. Every name and value is invented. */
const TOOL_DEF = [
  '{',
  '  "name": "get_test_results",',
  '  "description": "Gets stuff about tests.",',
  '  "input_schema": {',
  '    "type": "object",',
  '    "properties": {',
  '      "run": { "type": "string" },',
  '      "path": { "type": "string", "description": "Where to read from" },',
  '      "format": { "type": "string" }',
  '    },',
  '    "additionalProperties": true',
  '  }',
  '}',
];
const TOOL_DEF_TARGETS = [
  { line: 3, severity: 'major' as const, why: 'A vague description. The model chooses and fills a tool from its description, so say what it returns, when to use it and what it does not do.' },
  { line: 7, severity: 'major' as const, why: 'An unconstrained id: nothing says what a valid run id looks like, so malformed or guessed ids reach your code. Describe the format and validate it.' },
  { line: 8, severity: 'critical' as const, why: 'A free-form path lets the model (or an injected instruction) read anywhere the process can. Accept an id and resolve the location on the server, inside an allowed folder.' },
  { line: 9, severity: 'minor' as const, why: 'A free-text format invites invalid values. Use an enum of the formats you actually support.' },
  { line: 11, severity: 'major' as const, why: '"additionalProperties": true lets unexpected fields through. A strict contract closes the object and lists what is required.' },
];

/** A fabricated agent transcript with a tool whose contract accepts shape-valid but meaningless values. */
const RUN_LOG = [
  'agent -> get_test_results {"run_id":"r-8812"}',
  'tool_result {"status":"passed","failed":0,"total":0}',
  'agent: 0 of 0 tests ran, but the status is "passed". Reporting success.',
  'agent -> report_outcome {"outcome":"success","evidence":""}',
  'tool_result (is_error) "Schema violation: evidence must be non-empty"',
  'agent -> report_outcome {"outcome":"success","evidence":"n/a"}',
  'tool_result {"accepted":true}',
];
const RUN_LOG_TARGETS = [
  { line: 2, severity: 'major' as const, why: '"passed" with zero tests is a contradiction a validator should reject, or map to "unknown": no tests ran, so nothing passed.' },
  { line: 3, severity: 'critical' as const, why: 'The agent noticed the contradiction and reported success anyway. A valid shape was treated as a reliable result.' },
  { line: 6, severity: 'critical' as const, why: 'The schema error was "fixed" with a placeholder: "n/a" satisfies the non-empty rule but is not evidence. The agent complied with the shape and defeated its purpose.' },
  { line: 7, severity: 'major' as const, why: 'The contract accepted a meaningless report. A schema cannot stop this; the application needs a semantic check (evidence must reference a real run, with counts above zero).' },
];

export const L19: Lesson = {
  id: 'L19-structured-outputs-tool-calling',
  version: 1,
  track: 'mcp-tools',
  alsoIn: ['prompting', 'agents'],
  order: 19,
  title: 'Structured Outputs and Tool Calling',
  subtitle: 'Schemas, tool contracts and validation boundaries - and why a valid shape is not a reliable action',
  prerequisites: ['L12-context-engineering', 'L14-mcp-or-not'],
  competencies: ['structured-tool-contracts'],
  effortMinutes: 40,
  gameRelevance: 1,
  interestTags: ['ai-judgment', 'automation', 'security'],
  problem: 'An agent has to fetch a CI run\'s test results and report a structured outcome. The tool returns {"status":"passed","failed":0,"total":0}; the agent files "success" with evidence "n/a", and the schema accepts it. Every call was valid. Nothing was true.',
  whyItMatters: 'Structured outputs and tool calls are how model text becomes program behaviour. Done well they remove a class of parsing errors; done carelessly they give you well-formed nonsense that your code then acts on. The skill is designing the contract and deciding where, and how deeply, to validate.',
  objectives: [
    'Explain the tool-use round trip: who runs a client tool, what the model returns, and how results and errors flow back.',
    'Design an input and an output contract, including explicit error and unknown states, for a tool an agent will call.',
    'Validate at both boundaries and tell schema validation (shape) from policy checks (meaning, permission) and approval (consequence).',
    'Handle malformed responses, schema violations, tool failures and retries without turning a failure into a success.',
    'Decide when structured output is worth its complexity and when plain text is enough.',
  ],
  segments: [
    {
      id: 's1',
      title: 'What a valid structure does and does not promise',
      prediction: {
        prompt: 'A tool call arrives as valid JSON that matches your input schema exactly. What does that tell you?',
        options: [
          o('a', 'The call has the right shape; whether it is allowed, true or sensible is still unchecked', 'A schema is a shape check. Meaning and permission are separate questions.'),
          o('b', 'The call is safe to run', 'Safety depends on what the values mean and who may do what, not on their types.', 'valid-schema-is-valid-action'),
          o('c', 'The values are correct', 'A string of the right type can still be the wrong run, a stale id or an invented value.', 'valid-schema-is-valid-action'),
        ],
        correct: 'a',
      },
      body: `Anthropic's tool-use documentation describes the round trip. For a **client tool** (one you define), the model replies with \`stop_reason: "tool_use"\` and a \`tool_use\` block carrying an \`id\`, a \`name\` and an \`input\` that conforms to the tool's \`input_schema\`. **Your code runs the operation** and sends back a \`tool_result\` block that carries the same id. The model never runs your function; your application does.

Two features keep outputs well-formed. **JSON outputs** constrain what the model says to a JSON schema; **strict tool use** (\`strict: true\`) guarantees tool calls match your schema. The structured-outputs page states the guarantees plainly: valid, parseable output for downstream processing, with no retries needed for *schema* violations.

Hold on to the word *schema*. Everything this lesson teaches is the gap between "the output has the right shape" and "the action is right".`,
    },
    {
      id: 's2',
      title: 'Two boundaries, three kinds of check',
      body: `There are two places data crosses a trust line, and each needs validation:

| Boundary | What can go wrong | What to check |
|---|---|---|
| **Model → your code** (the tool call's \`input\`) | Wrong or invented ids, paths outside an allowed folder, absurd limits, an injected instruction shaping the call | Shape, then policy: is this value allowed *for this caller*? |
| **Your tool → the model** (the \`tool_result\`) | Empty or partial data, errors disguised as success, contradictions (\`passed\` with zero tests), untrusted text | Return an explicit status; never let a failure look like a result |

And three different kinds of check, which are often confused:

1. **Schema validation** - the shape and types. Cheap, deterministic, necessary.
2. **Policy / semantic checks** - does the run exist, is the path inside the allowed directory, is \`total > 0\` when \`status\` is "passed", is the timeout within bounds? Only your application knows these rules.
3. **Approval** - for consequential or irreversible actions, a person decides before it happens.

A tool call that passes check 1 has passed the *easiest* check.`,
    },
    {
      id: 's3',
      title: 'Designing the contract',
      body: `Treat the tool like an API for a new teammate who cannot ask questions. Anthropic's guidance on writing tools adds: build a few high-impact tools, return high-signal results, and write descriptions that say what the tool does.

**Input contract**
- A **precise description**: purpose, when to use it, when *not* to.
- **Required fields** and **constrained values**: enums for fixed choices, documented formats for ids.
- **Close the object** (\`additionalProperties: false\`). Prefer an **id the server resolves** over a free-form path or query the model composes.

**Output contract**
- An explicit **status enum** that includes the failure states: \`passed | failed | error | unknown\`. "I could not tell" must be sayable - otherwise the model has to guess.
- **Evidence**, not just a verdict: counts, a report reference, a log excerpt.
- A defined **error shape**, with messages that say what went wrong and what to try next ("Rate limit exceeded. Retry after 60 seconds." is the documentation's own example).

**Operational contract**: is the call idempotent, what is its timeout, and what is its side effect? A read tool and a delete tool should never look alike.`,
    },
    {
      id: 's4',
      title: 'Failure, retries and what to do with each',
      body: `| What happened | Handle it by |
|---|---|
| Output is not parseable, or \`stop_reason\` is \`refusal\` or \`max_tokens\` | Do not trust it: the structured-outputs docs say a refusal or truncation **may not match your schema**. Check \`stop_reason\` first |
| Tool call fails schema validation | Return a \`tool_result\` with \`is_error: true\` and an *instructive* message; the docs note Claude typically retries 2-3 times with corrections |
| Call is valid but out of policy | Reject with a reason (not a silent clamp the model cannot see) |
| Tool itself fails (timeout, HTTP 500) | Return \`is_error: true\` with what happened; **bound** the retries, then stop and report |
| Result is empty or contradictory | Return \`status: "unknown"\` or an error. **Never** convert a failure into a success to keep the flow moving |

One more hazard the transcript above shows: an agent can *satisfy* a validator and *defeat* its purpose - an empty evidence field rejected, so "n/a" supplied. If your rule exists to force real evidence, validate the evidence (does it reference a real run?), not just its presence.`,
    },
    {
      id: 's5',
      title: 'Security: tool inputs are attacker-influenced',
      body: `What the model puts in a tool call is shaped by everything it has read, including untrusted content. So tool inputs are **untrusted input**, like a web form:

- **Validate against an allowlist**, never a blocklist: allowed folders, allowed run-id patterns, allowed operations.
- **Least privilege**: the process behind the tool should be able to do only what the tool is for.
- **No secrets in arguments or results**: they would be logged and sent back through the model.
- **Approval before side effects**: a person confirms deletion, sending or spending.
- **Treat tool results as data**, including those you wrote: a result that contains text from a ticket or web page can carry instructions (see the prompt-injection lesson).`,
    },
    {
      id: 's6',
      title: 'When plain text is enough',
      body: `Structure has a cost: a schema to write and maintain, validation code, and failure paths. Use it when **a program consumes the output** (an API, a database, another tool), when the **set of values is fixed**, or when you must **count and compare** results.

Plain text is the better choice when a **person is the reader** (a summary, an explanation), when the task is **one-off**, or when forcing a schema would hide the nuance you want ("it mostly works, except on large files"). A common pattern is both: free-text reasoning for the person, plus a small structured field the program reads.`,
    },
    {
      id: 's7',
      title: 'Worked example: the test-results reporter',
      body: `*Goal: an agent retrieves a CI run's results and reports a structured outcome.*

**Weak contract.** \`get_test_results(run, path, format)\` returns \`{status, failed, total}\`; \`report_outcome(outcome, evidence)\` where evidence is any non-empty string.

**Repaired contract.**
- \`get_test_results\`: input \`{ run_id: string matching ^r-[0-9]+$ }\`, closed object. The server maps the id to a report in an allowed location. Output \`{ status: "passed"|"failed"|"error"|"unknown", total, passed, failed, report_ref }\`.
- **Semantic validation on the result:** \`passed\` requires \`total > 0\` and \`failed = 0\`; otherwise the tool returns \`status: "unknown"\` with a message ("0 tests were reported for r-8812; the run may not have executed").
- \`report_outcome\`: input \`{ outcome, report_ref }\` where \`report_ref\` must resolve to a real, stored report; free-text evidence is optional commentary, never the proof.
- **Failures:** schema errors and out-of-policy calls come back as \`is_error\` with instructions; at most two retries, then the agent stops and reports "could not determine" to a person.
- **Approval:** none needed to *read* results; a person approves anything that closes a ticket or merges.

The repaired design cannot be satisfied by "n/a". It can still be wrong - which is why it ends in a report a person can open.`,
    },
  ],
  activity: {
    title: 'Which check catches it, and what is wrong with this tool?',
    intro: 'Guided practice with fabricated tools and transcripts. Nothing runs.',
    items: [
      {
        id: 'l19-p1',
        kind: 'classify',
        concept: 'structured-tool-contracts',
        prompt: 'Which layer is responsible for catching each problem?',
        categories: LAYERS,
        entries: [
          { id: 'e1', text: 'A tool call supplies "suite": 7 where a string is required', correct: 'schema', why: 'A type mismatch is exactly what schema validation catches.' },
          { id: 'e2', text: 'A syntactically valid path points at a private key file outside the project folder', correct: 'policy', why: 'The shape is fine; only an allowlist check knows the location is not permitted.' },
          { id: 'e3', text: 'The CI service returns HTTP 500 for a valid request', correct: 'tool', why: 'The tool must report the failure explicitly (is_error with a message), not return a fake result.' },
          { id: 'e4', text: 'A call would delete 400 stored reports', correct: 'approval', why: 'A consequential, hard-to-undo action needs a person to decide first.' },
          { id: 'e5', text: 'A timeout of 99999 seconds is requested', correct: 'policy', why: 'It is a valid number but outside what the application allows.' },
        ],
        explanation: 'Shape is only the first of four layers.',
      },
      {
        id: 'l19-p2',
        kind: 'flaglines',
        concept: 'structured-tool-contracts',
        filename: 'get_test_results.tool.json',
        lines: TOOL_DEF,
        prompt: 'Flag the lines of this fabricated tool definition that weaken its contract.',
        targets: TOOL_DEF_TARGETS,
        hints: ['Look at the description, how a run is identified, the path, the format, and whether extra fields are allowed.'],
        explanation: 'The free-form path is the critical flaw; the vague description, loose id, free-text format and open object weaken reliability. The definition also has no `required` list.',
      },
      {
        id: 'l19-p3',
        kind: 'single',
        concept: 'structured-tool-contracts',
        prompt: 'The CI service returns an empty body for a valid run id. What should your tool return to the model?',
        options: [
          o('a', 'An explicit error or status "unknown" saying no results were returned, so the model cannot mistake it for a pass', 'Correct: failure must be visible and unambiguous.'),
          o('b', 'An empty result, which the model will interpret sensibly', 'An empty result invites the model to guess, and guesses tend toward the hoped-for answer.', 'valid-schema-is-valid-action'),
          o('c', '{"status":"passed"} so the workflow can continue', 'Turning a failure into a success corrupts every later step.'),
        ],
        correct: 'a',
        explanation: 'Say "I could not tell" out loud.',
      },
      {
        id: 'l19-p4',
        kind: 'multi',
        concept: 'structured-tool-contracts',
        prompt: 'Which of these belong in a well-designed OUTPUT contract for a results tool? Select all.',
        options: [
          o('a', 'A status field that can say error or unknown, not only passed and failed', 'The contract must allow the honest answer.'),
          o('b', 'Counts and a reference to the underlying report', 'Evidence lets a person or a check verify the verdict.'),
          o('c', 'A defined error shape with a message that says what to try next', 'Instructive errors help the model recover.'),
          o('d', 'A boolean "ok" that is true whenever the HTTP call returned', 'A transport success says nothing about whether the tests passed.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Explicit states, evidence and instructive errors.',
      },
    ],
  },
  assessment: {
    title: 'Design and audit a tool contract',
    intro: 'A new tool and a new transcript, no hints. The valid-shape question is a mandatory check.',
    passMark: 0.8,
    items: [
      {
        id: 'l19-a1',
        kind: 'fields',
        concept: 'structured-tool-contracts',
        points: 3,
        prompt: 'Design the contract for this tool. Answer each part concretely.',
        brief: `**Tool:** \`get_build_artifacts\` lets an agent list the artifacts a CI build produced (file names, sizes) so it can report them. It must work for builds that failed, timed out or never started.`,
        fields: [
          {
            id: 'input',
            label: 'The input contract',
            help: 'What the model must supply, how it is constrained, and what it must NOT supply.',
            groups: [
              { label: 'an identifier or constrained value', anyOf: ['build id', 'build_id', 'id', 'enum', 'pattern', 'format', 'regex', 'constrained', 'allowed values'] },
              { label: 'no free-form path or closed object', anyOf: ['not a path', 'no path', 'free-form', 'free form', 'closed', 'additionalproperties', 'server resolves', 'resolved on the server', 'allowlist', 'allowed folder'] },
            ],
            placeholder: 'e.g. the model supplies a build id matching ... and never a path ...',
          },
          {
            id: 'output',
            label: 'The output contract',
            help: 'Including what it says for failed, timed-out or never-started builds.',
            groups: [
              { label: 'explicit failure or unknown states', anyOf: ['unknown', 'error', 'not started', 'failed', 'timed out', 'status', 'state'] },
              { label: 'evidence rather than a bare verdict', anyOf: ['count', 'size', 'list of', 'names', 'reference', 'report', 'evidence', 'total'] },
            ],
            placeholder: 'e.g. returns a status of ... plus ...',
          },
          {
            id: 'failure',
            label: 'Failure handling',
            help: 'Malformed input, a tool failure, and retries.',
            groups: [
              { label: 'an instructive error result', anyOf: ['is_error', 'error message', 'instructive', 'says what', 'tell the model', 'explains'] },
              { label: 'bounded retries then stop', anyOf: ['once', 'twice', 'two retries', 'three', 'at most', 'bounded', 'limit', 'then stop', 'escalate'] },
            ],
            placeholder: 'e.g. return is_error with ... ; retry at most ...',
          },
          {
            id: 'validation',
            label: 'Validation beyond the schema',
            help: 'A semantic or policy check, and whether any approval is needed.',
            groups: [
              { label: 'a semantic or policy check', anyOf: ['policy', 'semantic', 'exists', 'allowlist', 'permitted', 'authorised', 'authorized', 'check that', 'verify that', 'must resolve'] },
              { label: 'least privilege or read-only', anyOf: ['read-only', 'read only', 'least privilege', 'no side effect', 'no side-effect', 'only reads', 'cannot modify'] },
            ],
            placeholder: 'e.g. check that ... ; the tool is read-only so ...',
          },
        ],
        explanation: 'A constrained id (not a path), explicit error and unknown states with evidence, instructive bounded failure handling, and a semantic check on a read-only tool.',
      },
      {
        id: 'l19-a2',
        kind: 'flaglines',
        concept: 'structured-tool-contracts',
        filename: 'agent-run.log',
        lines: RUN_LOG,
        prompt: 'Flag the lines where a valid shape was treated as a reliable result, or where the contract failed to protect the workflow. Some lines are fine.',
        targets: RUN_LOG_TARGETS,
        explanation: 'A "passed" with zero tests, an agent that reported success anyway, a placeholder that satisfied the validator, and a contract that accepted it: four faces of "valid is not reliable". The schema error on line 5 is the validator working.',
      },
      {
        id: 'l19-a3',
        kind: 'single',
        concept: 'structured-tool-contracts',
        critical: true,
        points: 2,
        prompt: 'A tool call {"action":"archive","target":"reports/2024"} matches your schema exactly. Which is the sound next step?',
        options: [
          o('a', 'Check the action and target against policy (is archiving permitted, does the target exist, is it inside the allowed folder) and require approval if it is hard to undo', 'Correct: shape is checked; meaning, permission and consequence are separate checks.'),
          o('b', 'Run it: the schema validated, so the call is safe', 'Validation proves the shape only.', 'valid-schema-is-valid-action'),
          o('c', 'Run it and look at the result afterwards', 'After the fact is a report, not a control, for an action that may be hard to reverse.', 'valid-schema-is-valid-action'),
          o('d', 'Ask the model to confirm the call is correct', 'The same author vouching for itself is not an independent check.', 'valid-schema-is-valid-action'),
        ],
        correct: 'a',
        explanation: 'Valid shape is necessary, never sufficient.',
      },
      {
        id: 'l19-a4',
        kind: 'single',
        concept: 'structured-tool-contracts',
        prompt: 'A model response requested structured JSON output but ends with stop_reason "max_tokens". What does the documentation imply you should do?',
        options: [
          o('a', 'Treat the output as possibly incomplete and not matching the schema; retry with more room or handle it as a failure', 'Correct: truncation can break the schema guarantee, so check stop_reason before trusting the output.'),
          o('b', 'Parse it anyway; structured outputs are always valid', 'The guarantee does not cover a truncated response.', 'valid-schema-is-valid-action'),
          o('c', 'Fill in the missing fields yourself', 'That invents data the model never produced.'),
        ],
        correct: 'a',
        explanation: 'Check the stop reason before the contents.',
      },
      {
        id: 'l19-a5',
        kind: 'classify',
        concept: 'structured-tool-contracts',
        prompt: 'Which layer is responsible for catching each problem?',
        categories: LAYERS,
        entries: [
          { id: 'b1', text: 'The "build_id" field is missing from the call', correct: 'schema', why: 'A missing required field is a shape error.' },
          { id: 'b2', text: 'The build id is well-formed but belongs to another team\'s project', correct: 'policy', why: 'Authorisation is a policy question the schema cannot see.' },
          { id: 'b3', text: 'The artifact store is unreachable for ninety seconds', correct: 'tool', why: 'The tool must surface the failure and the retry rules decide what happens next.' },
          { id: 'b4', text: 'The call would publish the artifacts to a public bucket', correct: 'approval', why: 'Publishing is external and hard to undo: a person decides first.' },
        ],
        explanation: 'Match the problem to the layer that can actually see it.',
      },
      {
        id: 'l19-a6',
        kind: 'multi',
        concept: 'structured-tool-contracts',
        prompt: 'In which situations is plain text a better choice than a structured output? Select all.',
        options: [
          o('a', 'A short explanation of a build failure that a developer will read', 'A person is the reader; structure adds nothing.'),
          o('b', 'A one-off question in an interactive session', 'No program consumes it, so a schema is overhead.'),
          o('c', 'A nuanced assessment where forcing fixed fields would hide the caveats', 'Structure can flatten the nuance you want.'),
          o('d', 'A count that a dashboard will sum across thousands of builds', 'A program consumes it and must compare values: structure earns its cost.'),
        ],
        correct: ['a', 'b', 'c'],
        explanation: 'Structure when a program consumes it; text when a person does.',
      },
      {
        id: 'l19-a7',
        kind: 'single',
        concept: 'structured-tool-contracts',
        prompt: 'Your validator requires the "evidence" field to be non-empty, and an agent supplies "n/a". What is the best fix?',
        options: [
          o('a', 'Validate that the evidence refers to something real (for example a stored report id that resolves), not merely that it is present', 'Correct: validate the purpose of the field, not its presence.'),
          o('b', 'Make the field longer than ten characters', 'Placeholders can be longer too.', 'valid-schema-is-valid-action'),
          o('c', 'Remove the field so there is nothing to fake', 'Without evidence a verdict has no support at all.'),
        ],
        correct: 'a',
        explanation: 'A schema can force presence; only a semantic check can force substance.',
      },
      {
        id: 'l19-a8',
        kind: 'reflect',
        concept: 'structured-tool-contracts',
        prompt: 'Self-assessment (recorded, not scored).',
        rubric: [
          'I can name what a schema does and does not guarantee',
          'I give every tool an explicit way to say "error" or "unknown"',
          'I validate meaning and permission as well as shape, and put approval before consequential actions',
        ],
        explanation: 'Contracts are designed, not generated.',
      },
    ],
  },
  failureModes: [
    'Treating a schema-valid call as a safe or correct one.',
    'A free-form path, query or command in a tool input.',
    'No way for a tool to say "error" or "unknown", so failures look like results.',
    'Satisfying a validator with a placeholder and calling the result evidence.',
    'Unbounded retries on a permanently failing call.',
    'Parsing a refused or truncated response as if it were complete.',
  ],
  application: {
    title: 'Audit one real tool contract',
    body: 'Pick a tool or MCP server your agent can call. Read its input schema and what it returns when something goes wrong. Write down: what shape it enforces, what meaning it does not check, whether it can say "unknown", and what the worst valid call would do. Fix one gap (a stricter id, an explicit error state or a policy check). Practical takeaway: list names and schemas only - do not open files that hold secrets.',
    fieldPrompt: 'Log it under Growth → Field evidence when a contract change catches or prevents a real bad call.',
  },
  reviewItems: [
    { id: 'l19-r1', kind: 'single', concept: 'structured-tool-contracts', difficulty: 1, prompt: 'Who runs a client tool in the tool-use round trip?', options: [o('a', 'Your application, which then returns a tool_result', 'Correct: the model only requests the call.'), o('b', 'The model itself', 'The model produces a tool_use block; it does not execute your function.'), o('c', 'The API provider on its servers', 'That describes server tools; a tool you define is a client tool.')], correct: 'a', explanation: 'Client tools run in your code.' },
    { id: 'l19-r2', kind: 'single', concept: 'structured-tool-contracts', difficulty: 1, prompt: 'What does schema validation of a tool call check?', options: [o('a', 'The shape and types of the input', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Whether the action is allowed', 'Permission is a policy check.', 'valid-schema-is-valid-action'), o('c', 'Whether the values are true', 'Truth is outside a schema\'s reach.', 'valid-schema-is-valid-action')], correct: 'a', explanation: 'Shape only.' },
    { id: 'l19-r3', kind: 'single', concept: 'structured-tool-contracts', difficulty: 2, prompt: 'A tool times out. What should the tool_result say?', options: [o('a', 'is_error with a message saying what happened and what to try next', 'Correct: instructive errors help recovery.'), o('b', 'status "passed" so the run can continue', 'A failure presented as success corrupts later steps.', 'valid-schema-is-valid-action'), o('c', 'Nothing: leave it empty', 'An empty result invites a guess.')], correct: 'a', explanation: 'Make failure visible.' },
    { id: 'l19-r4', kind: 'multi', concept: 'structured-tool-contracts', difficulty: 2, prompt: 'Select the controls that belong on a tool that accepts a file location.', options: [o('a', 'Accept an id and resolve the location on the server', 'Removes the free-form path.'), o('b', 'Check the resolved location is inside an allowed folder', 'An allowlist check.'), o('c', 'Run the tool with only the access it needs', 'Least privilege.'), o('d', 'Accept any string and trust the model', 'The input is attacker-influenced.', 'valid-schema-is-valid-action')], correct: ['a', 'b', 'c'], explanation: 'Resolve, allowlist, least privilege.' },
    { id: 'l19-r5', kind: 'single', concept: 'structured-tool-contracts', difficulty: 2, prompt: 'A result says status "passed" but total is 0. What should a good tool do?', options: [o('a', 'Return "unknown" (or an error) because no tests ran, so nothing passed', 'Correct: a contradiction should not look like success.'), o('b', 'Return "passed" as reported', 'Passing nothing is not passing.', 'valid-schema-is-valid-action'), o('c', 'Return "failed"', 'Failed is also a claim the data does not support.')], correct: 'a', explanation: 'Unknown stays unknown.' },
    { id: 'l19-r6', kind: 'single', concept: 'structured-tool-contracts', difficulty: 3, prompt: 'Which design best prevents "n/a" as evidence?', options: [o('a', 'Require a report id that resolves to a stored report', 'Correct: validate what the field is for.'), o('b', 'Require at least five characters', 'Placeholders can be longer.', 'valid-schema-is-valid-action'), o('c', 'Tell the model not to write "n/a"', 'An instruction is not enforcement.', 'tell-it-to-ignore-injection')], correct: 'a', explanation: 'Validate substance.' },
    { id: 'l19-r7', kind: 'single', concept: 'structured-tool-contracts', difficulty: 3, prompt: 'When is plain text the better choice?', options: [o('a', 'When a person reads it and no program consumes it', 'Correct: it matches the practice taught in this lesson.'), o('b', 'Never; structure is always better', 'Structure has costs and can flatten nuance.'), o('c', 'Only for very short outputs', 'Length is not the deciding factor.')], correct: 'a', explanation: 'Match the format to the consumer.' },
    { id: 'l19-r8', kind: 'single', concept: 'structured-tool-contracts', difficulty: 3, prompt: 'A structured-output response ends with a refusal stop reason. How should the application treat it?', options: [o('a', 'As a possibly non-conforming response to handle explicitly, not as a normal result', 'Correct: the documentation says the output might not match the schema.'), o('b', 'As valid, because structured outputs are always valid', 'The guarantee does not cover every stop reason.', 'valid-schema-is-valid-action'), o('c', 'As proof the request was harmful', 'A refusal is a signal to handle, not a verdict to assume.')], correct: 'a', explanation: 'Check stop_reason first.' },
  ],
  sources: [
    { ...DOCS.toolUse, supports: 'The tool-use round trip: client versus server tools, tool_use and tool_result blocks, and strict tool use.' },
    { ...DOCS.handleToolCalls, supports: 'tool_result formatting, is_error, instructive error messages, and retry behaviour for invalid calls.' },
    { ...DOCS.structuredOutputs, supports: 'JSON outputs and strict tool use, what is guaranteed, and the refusal and max_tokens caveats.' },
    { ...ARTICLES.writingTools, supports: 'Designing a few high-impact tools with clear descriptions and high-signal results.' },
  ],
};
