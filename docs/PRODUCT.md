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
