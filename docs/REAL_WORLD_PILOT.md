# Real-world pilot protocol

**Status: not yet run.** Nothing in this document has been done by anyone. It is a protocol for a first pilot you run yourself with your own Claude Code, plus what to record and how the results should steer the next round. Claude Forge never runs Claude, reads your repositories, or verifies results, so every outcome below is something you observe and write down.

The pilot exists to answer one question the fixtures cannot: **does Claude Forge change what you do on real work, and does what it teaches hold up outside its own examples?** Fixtures show the method works. They do not show the method pays off.

## What counts as having done the pilot

The pilot is done when all three parts below have a saved record (Markdown export or backup) and a written findings note. Parts can be done in any order. Do not count a part if its evidence rests only on a model saying it worked.

| Part | What you do | Where in the app | Evidence that counts |
|---|---|---|---|
| A. Skill Improvement Loop | Improve one real Skill with Claude Code using the Loop | Improvement Loop, Skill Workshop | Dev-set and held-out results you recorded, the revision history, your decision to keep or reject the change |
| B. Real playbook | Design, test and use one playbook on a real task | Workflow Playbooks, AI Lab, Real-world tasks | Evidence links with your criteria and judgement, a saved evaluation summary, a completed transfer task |
| C. Non-game evaluation | Compare two prompts or workflows on a non-game task | AI Lab | An experiment with at least three runs per condition, a baseline, written limitations, an exported report |

Time: about two to four hours per part, spread over days. Do not rush the held-out step in Part A.

## Before you start (15 minutes)

1. Export a backup (Settings and data). The pilot changes nothing destructive, but you will want a clean before-and-after.
2. Pick **real** targets, not demos: a Skill you actually use or would use, a task you repeat at least monthly, a prompt that has disappointed you.
3. Decide privacy rules. Do not paste secrets, credentials or private customer data into the app. Describe a private project by name only; the app never reads it. Evidence notes describe what you hold elsewhere.
4. Write one sentence for each part: "I expect X to improve Y, and I will change my mind if Z."

## Part A: one real Skill, improved with Claude Code

Goal: find out whether the Loop's discipline (development cases to improve on, held-out cases to test on) changes what you keep.

1. Open the Skill Workshop and bring in the Skill (write it, or import a ZIP you have read). Run the quality review and the trigger checks. Note what they flag.
2. Open the Improvement Loop for that Skill. Record, before looking at any result, what you expect the Skill to get wrong.
3. Run the development cases in your own Claude Code, with and without the Skill. Record each run, **including failed and abandoned attempts**.
4. Make one change to the Skill. Write down exactly what you changed and why. Do not change two things at once.
5. Run the held-out cases once. Do not edit the Skill afterwards to fit the held-out result; if you want to, that is a new loop.
6. Record your decision: keep, revise, or reject.

Record: expected vs observed; number of runs per condition; how many attempts failed; what the revision diff shows; whether the held-out result agreed with the development result; time spent.

## Part B: one real playbook, evidenced and used

Goal: find out whether linking evidence to steps changes how much you trust a workflow, and whether it surfaces a weak step.

1. Create a playbook for a task you really repeat (start from a seeded design only if it matches your task). Write the gate and failure handling for every step. Fix what the reliability checklist flags.
2. Pick the step you trust least. From that step, **create an experiment** (the step opens the Lab with its gate as the success criterion).
3. Run at least two runs per condition in your own tooling and record them. Include a baseline: the way you do it today.
4. Return to the step. Write your acceptance criteria **before** judging. Record your judgement and a note, and state what the evidence cannot show.
5. Save an evaluation summary. Read its Next experiment section and do one thing it suggests.
6. Use the playbook once on a real task. In Real-world tasks, plan it, record what happened (including interventions and what you reverted), add evidence notes and a reflection, then mark it complete. If it came from a playbook, record it on the playbook as a self-reported result.

Record: which step the evidence changed your mind about; whether any link went stale and why; maturity before and after; what the real use showed that the fixture did not.

## Part C: one non-game AI evaluation

Goal: check the evaluation method outside game development, where the fixtures give no help.

1. Choose a prompt or workflow comparison from your own work: for example a plain instruction versus one with few-shot examples, or an unguided summary versus a structured-output extraction, on a task such as commit messages, ticket triage, meeting notes, data cleaning or code review comments.
2. Create an experiment with a baseline and **one** stated difference. Use "My own fixture" and describe it: the fixed set of inputs you will reuse (aim for ten or more cases, chosen before you look at outputs).
3. Plan at least three runs per condition. Decide the measures first: a check you can run (valid output, a test, a count of required fields) beats a rating. If you must rate, use the rubric and rate every run the same way.
4. Record every attempt. Where you paste model output, use the text-analysis panel: a claim in the output is never a measurement. Import a real test or schema-check report if you have one.
5. Read the comparison: spread, sample size, integrity notes. Export the Markdown report.
6. Write the limitations yourself before reading the generated ones, then compare.

Record: how many cases and runs; which measures; what the report called out that you had missed; whether the answer would change what you do.

## What to collect, in one place

- Backup export before and after.
- The Markdown export of each experiment report, the playbook evaluation summary, and the transfer task.
- For each part: your expectation (written before), the outcome, and one thing that surprised you.
- Friction log: every moment the app made you stop, guess, re-enter something or doubt what a label meant. These are product findings, not your mistakes.
- Time per step, roughly.

## Findings note (fill in after, in your own words)

```text
Date:
Part(s) completed:
Expected going in:
What happened:
Where the method held up on real work:
Where it did not (fixture-only, too heavy, wrong measure, misleading label):
Did any recommendation, lesson or playbook change what I did? Which?
What I would change in Claude Forge:
```

## How findings steer the next iteration

Use these rules rather than impressions.

| Finding | Likely next step |
|---|---|
| You skipped the held-out step or edited after seeing it | Make the Loop's lock harder to bypass, or explain the lock better where you hit it |
| Evidence linking felt like ceremony and you never judged a step | Reduce required fields, or surface the highest-value step first |
| You could not find a measure for a real task | Add task-type templates with measures and fixtures that are not game-specific |
| Reports flagged things you agreed with but would have missed | Keep; consider surfacing the integrity notes earlier |
| Few-shot, structured-output or injection lessons did not match a real task | Revise those lessons with a worked example from the real task |
| The real run disagreed with the fixture run | Record it as a limitation of fixtures; weight the real result; add a fixture that reproduces the disagreement |
| Setup cost exceeded the benefit for small tasks | Add a lightweight path: one condition pair, three runs, one measure |
| A label or status was misread | Fix the wording first; it is cheaper than any feature |

## Honest limits of this protocol

- One person, one machine, one week is an anecdote. It can reveal broken flows and wrong labels. It cannot show Claude Forge improves outcomes in general.
- You are both the designer and the judge of your own evidence. Write expectations down beforehand to limit hindsight.
- Nothing is blinded. Rate outputs with the criteria fixed in advance, and prefer measures that do not need your judgement.
- Do not publish a result from this pilot as if it were a study.

## Verification state of this document

This protocol was written against the features that exist in the app and are covered by tests (Playbook evidence links and evaluation summaries, AI Lab attempts and import with preview, Real-world tasks). No part of it has been performed in a real project, and nothing here reports a result.
