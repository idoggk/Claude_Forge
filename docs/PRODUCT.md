# Product and learning model

## The learner

An experienced developer (TypeScript, React, Python, Phaser, GitHub, automated testing, multi-agent orchestration) who wants to become *genuinely expert* at Claude Skills — not to learn programming. The primary example project is **One More Merge**, but the app never assumes access to its repository: every game exercise is an original, minimal, clearly-labelled **training fixture**.

## The loop

Discover → Understand → Practice → Experiment → Apply → Measure → Master

Each lesson has: the developer problem, why it matters, concise teaching segments, an interactive guided activity, an independent assessment, per-option feedback, failure modes, and a practical application with a field-evidence prompt.

## Competency model (implemented in `src/domain/mastery/competency.ts`)

| Level | Name | Evidence required (current lesson version only) |
|---|---|---|
| 0 | Unseen | none |
| 1 | Recognizes | teaching segments completed, or any graded attempt touching the concept |
| 2 | Guided application | concept score ≥ 70% on a practice, assessment or review attempt (hints allowed) |
| 3 | Independent application | concept score ≥ 75% on an **unseen, hint-free** attempt — the *first* assessment attempt on this lesson version, or a spaced-review item from the separate review pool — with **no missed critical item** |
| 4 | Field-proven | Level 3 **plus** a self-reported field-evidence record tagged with the concept |

Rules that protect honesty:

- **Mandatory (critical) items cannot be compensated.** Missing one caps that concept at level 2, whatever else you score. Reaching level 3 again needs a later unseen pass; a later unseen miss revokes it.
- **Retakes have seen the questions**, so they count as guided practice only. Fresh review questions can earn level 3 back.
- **Content changes don't erase history.** Attempts record the lesson version. Old attempts stay visible but don't count toward current-version mastery; Growth shows when an earlier version had a higher level.
- **Duplicate submissions can't inflate progress.** Each attempt has an ID created when the exercise opens; the write is idempotent.
- **Level 4 can't be earned inside the app.** It needs a real-work record, which is self-reported and labelled as such.
- **Self-assessed items are never scored.** They are recorded, labelled, and excluded from mastery.

## Assessments

Deterministic graders only (`src/domain/assessment/grade.ts`): single choice, multi-select (exact set; partial credit shown), classification, ordering (pairwise), numeric (with tolerance and targeted diagnosis; computed from trusted fixtures at grading time), keyword short-answer (labelled "narrow"), line-flagging (severity-weighted recall with a false-positive penalty), self-assessment, and **external checks** that read your saved Workshop / Battle Lab data. There is no free-form natural-language grader because there is no reliable evaluator offline.

## Confidence calibration

Before each assessment you choose how confident you are (1–5 ≙ ~20/40/60/80/95%). After submitting you see prediction vs result, a verdict (±25 points is "calibrated"), the relevant concept, and recommended practice. Growth tracks the history. Overconfidence is flagged without penalty.

## Spaced review (`src/domain/mastery/review.ts`)

A simple, explicit ladder — not an optimized algorithm: **1 → 3 → 7 → 14 days**. After a 3-question session on fresh items: *pass* (≥80%, no hints, not overconfident-wrong) moves up a box; *partial* stays; *fail* (<50%) returns to day 1 and counts a lapse. Dates are **local calendar days** (`YYYY-MM-DD`) so DST and timezone changes can't shift due dates. Settings has a visible "clock offset" so you can verify scheduling without waiting.

## Recommendation (`src/domain/mastery/recommend.ts`)

A deterministic scoring rule: due reviews first; then curriculum order, prerequisites, a failed assessment (names the missed concepts), lessons that unlock others, your chosen interests, and game-development relevance. Every point has a reason shown on Mission Control. It is **not** AI personalization and the UI says so.

## 30-day outcomes → features

| # | Outcome | Where it is practised and verified |
|---|---|---|
| 1 | Explain the Skills ecosystem accurately | L01, L02; Discovery provenance |
| 2 | Choose between Skills, agents, hooks, MCP, plugins, CLAUDE.md, code | L01 (classification + scenarios), L09 |
| 3 | Discover and investigate real third-party Skills | Discovery Hub; L04 |
| 4 | Identify unsafe, outdated, redundant or low-quality Skills | L04 (mandatory checks), Workshop scanner, catalog security fields |
| 5 | Install Skills using current official instructions | Catalog quoted commands with sources; Workshop install guidance (docs read 2026-11-05) |
| 6 | Write strong custom Skills | L02, L03, L05, L10; Workshop validation |
| 7 | Test Skill invocation behaviour | L03 Trigger Dojo; Workshop scenarios and live-test log |
| 8 | Run controlled effectiveness experiments | L08; Battle Lab |
| 9 | Apply workflows to game development | L06, L07, L09 fixtures |
| 10 | Measure instead of trusting impressions | Battle Lab comparison, sufficiency verdicts |
| 11 | Maintain a personal Skill arsenal | Arsenal states, trust steps, notes, experiment links |
| 12 | Know the next concept to learn | Mission Control, Growth |

## What the product refuses to do

- Pretend a number came from Claude, or that a manually entered metric is verified.
- Turn a missing metric into zero, or a single successful run into "Skill A is better".
- Award mastery for marking something "used", or call an install "verified".
- Present proposed custom Skills as sourced resources, or guess licences and commit dates.


## Round 2 additions (what changed in the learning experience)

- **The Skill Improvement Loop is the centre.** Lessons teach concepts; the loop makes you *measure* a Skill of your own: baseline without it, a frozen v1, a recorded test, an evidence-based failure pattern, a hypothesis-driven v2, and a held-out test whose answers you could not tune against. The report states plainly what the data does and does not show. Four missions cover economy review, performance investigation, simulation determinism and multi-agent integration.
- **Placement diagnostic.** Ten scenario questions, one per competency. A hint about where to look first; it never changes a competency level (it is stored apart from attempts and cannot).
- **Better retrieval practice.** Review pools hold nine questions per lesson, tagged by difficulty. Sessions are planned by fixed rules: missed items and items that test a misconception you actually chose come back, difficulty rises with the schedule box, the previous session's questions are skipped, and one question from another lesson you have passed is mixed in. Every question shows why it was chosen.
- **Misconception feedback.** Sixteen authored misconceptions (why it is tempting, what actually happens, a contrast example, a corrective question). The corrective question is practice only and never counts toward mastery.
- **Evidence, not vibes, in the Workshop.** Trigger tuning compares what you expected with what you manually recorded in real Claude Code sessions (recall, precision and FP/FN only where measured; stale and untested rows stay out of the maths). The quality review is static and says so; its maturity ladder ticks a rung only when matching evidence exists, and *field-proven* is never ticked.

## Round 3: from Skills academy to AI Mastery Academy

**What it now teaches.** Judgment, not tool names. The twelve tracks (AI fundamentals; prompting and context; Claude Code; agents and orchestration; MCP and tools; automation and workflows; engineering practice; game development; research; ecosystem; safety and evaluation; advanced systems) are shown in full. A topic is *available* only if a lesson exists; the rest are marked planned and show no progress.

**The eight new lessons** each follow problem → concept → worked example → interactive exercise → incorrect-answer feedback → independent assessment → transfer challenge → sources:
1. Choose the Right AI Approach (decision battles; "do nothing" is a first-class answer)
2. Context Engineering Masterclass (rewrite a vague task; structured `fields` answers)
3. Why AI Agents Fail (failure autopsies on fabricated traces)
4. MCP or Not? (integration choice, credentials, untrusted tool output)
5. Build a Reliable AI Workflow (gates, bounded retries, approval before irreversible steps; checks your saved Playbook)
6. AI Evaluation Fundamentals (baseline, variance, held-out cases; checks a real AI Lab experiment)
7. Efficient AI-Assisted Development (slices, verify with a run, parallel only when independent)
8. Discover and Evaluate an AI Tool (claims versus evidence, popularity is not safety)

**Learning-science choices.** Prediction before explanation (not graded, not stored); confidence calibration kept from Round 2; decision battles (Opportunity Finder); failure autopsies; spaced review pools of 8 items per new lesson; a diagnostic that covers all 17 competencies and never raises a level. No points, streaks or badges.

**Mastery rules unchanged.** Level 3 still needs an unseen, hint-free attempt with no missed critical item; level 4 still needs self-reported field evidence. The Personal AI Mastery Profile is a *view* (state follows the weakest competency in an area). Practice runs and goals never change a level.

**Recommendations stay explainable.** Due reviews first; then prerequisites, failed attempts, goals (+30 per goal, with the reason shown), practice gaps (+10), interests, diagnostic hints and game relevance. No AI coach.

## Round 4: advanced mastery, evidence you can use, and transfer to real work

**Six advanced lessons** (Structured Outputs and Tool Calling, Few-Shot Prompting, Prompt Injection and Trust Boundaries, Retrieval-Augmented Generation, Designing AI Evaluation Harnesses, Context Engineering for Long-Running Agents). Each: a realistic problem, a mental model, a worked example, a prediction before the explanation, practice with feedback on every wrong option, misconception correctives (why it is tempting, why it is wrong, a contrast, a corrective question), a separate independent assessment with deterministic grading, a practical application, verified sources and a versioned review pool. Inert samples only: no real payloads, no network, `.example` hosts. The recommender now also names a lesson when a misconception recorded elsewhere is taught there directly, with the reason shown.

**What a playbook can now say about itself.** A step can cite AI Lab experiments. A link is not a verification: the learner writes acceptance criteria first, then a judgement and the limits. Evidence that no longer matches the step or the experiment is ignored until reassessed. The playbook's maturity is computed from that evidence and is explicit that fixture evaluation is not field proof. None of it raises a competency level.

**Transfer.** A transfer task is the bridge from "I passed the assessment" to "I used it on real work". It is only complete with criteria, observations, evidence and a reflection, all in the learner's words, and it can be exported. Field evidence for Level 4 is still logged separately, by choice.

**Assessment integrity.** Mastery still comes from unseen, hint-free attempts and the learner's own field evidence. Clicking through, the diagnostic, memorised answers, declared goals, playbook maturity and completed transfer tasks do not move a level; tests assert that for playbooks, evaluations and transfer tasks.


## Round 5: from a well-tested academy to a real-world laboratory

- **Guided real experiment**: a first run on a task the learner really does, with what to keep constant, a run order that avoids order effects (ABBA), and a reading of the result that says when n is too small.
- **Evidence import**: pasted or uploaded results are previewed; every fact is classified (parsed tool result, parsed model output, user observation, inferred, unknown). A model saying "tests passed" is inferred, never a measurement. Secrets are flagged and redacted by default.
- **Blinded evaluation**: conditions are hidden, the rubric is locked before scoring, guesses are recorded before the reveal.
- **Challenges**: four non-game problems; practice runs never raise a competency level.
- **Pathways and library**: the last step of every pathway is a takeaway; a takeaway's confidence label is raised only by the learner and only if its references can support it (evaluated on fixtures needs a Lab report or a challenge run; applied to real work needs a completed transfer task).
- **Refused**: auto-running Claude, installing Skills, hidden analytics, treating a checkbox as mastery.


## Round 7: learning experience reinvention

The learner now starts with a 3-minute Quick Spark, a ~8-minute Guided Mission, or a Deep Lab, chosen by a single "next challenge" recommendation. Sparks and missions teach by predict → discover → practice → challenge → reflect, give feedback on every option, and never count toward mastery; only independent assessments do. Five-minute review and three simulated playgrounds add low-friction practice. A local, descriptive quality report shows where learners get stuck.


## Round 6: learning integrity, adaptive mastery and real-world practice

- **Assessments that cannot be passed by formatting.** Answer length, option wording and option position are no longer reliable cues; the remaining one (the right option tends to be the shortest) is documented and capped.
- **Judgment formats.** Scenarios change one constraint and flip the answers; diagnoses give a flawed artifact and ask for the failure, cause, principle and safest correction; constructions ask the learner to build a small, reviewable design. A deterministic check can say a required part is missing, never that a design is good, and says so.
- **Adaptive practice with reasons.** Confident-and-wrong answers and repeated beliefs lead to foundation review; guided-only evidence leads to an independent assessment; only repeated independent, unseen, strong results with no calibration problem lead to harder or cross-topic work; real-work transfer is suggested only after strong evidence and only until one is completed. Clicking through lessons never raises difficulty.
- **Pilot.** One plain next action at a time, optional local feedback, and a checklist for the five things only a human can do.
- **Refused again:** treating suggestions, practice runs or feedback as mastery evidence; presenting a planned topic as available.
