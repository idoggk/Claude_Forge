# Round 7 quality audit

Scope: the Round 7 learning experience (guided missions, Quick Sparks, learning-first Home, five-minute review, playgrounds, Deep Lab, local quality report) on branch `round-7-learning-experience`, reviewed as a product designer, learning scientist, AI engineer, mobile UX specialist and senior software engineer.

**Who did this and what it can and cannot show.** The same agent that wrote Round 7 audited it, with no human learner, no real device and no second reviewer. The content statistics below come from small samples (40 single-answer choice groups across 17 units) and from simple scripted proxies for test-taking tricks, so each percentage carries roughly ±15 points of uncertainty. Browser measurements are Chromium on Linux with phone-sized viewports. Nothing here measures whether anyone learns more.

**Severity.** Critical: breaks a stated guarantee or loses data for everyone. High: a clear defect on the main path or a guarantee that can be broken. Medium: a real weakness with a workaround or limited reach. Low: polish or a rare case.

**Outcome.** No Critical findings. Five High findings, all fixed in this change with regression tests. Several Medium findings were also fixed; the rest are listed as open with a recommendation. Nothing found blocks merging, subject to the checks in the last section.

## Summary table

| # | Perspective | Finding | Severity | Status |
|---|---|---|---|---|
| H1 | Learning scientist / engineer | The option shuffle put the authored-first option last about half the time; every new unit authored the right option first | High | Fixed |
| H2 | Learning scientist | The right option was the shortest in 45–48% of new choice groups; "pick the shortest" scored 57% against 32% by chance | High | Fixed |
| H3 | Product designer / mobile | First-run Home: the first challenge sat behind the bottom nav on a 667 px phone, below an optional diagnostic and two other competing actions | High | Fixed |
| H4 | Senior engineer | A stale second tab could replace an answer that was already checked ("frozen") | High | Fixed |
| H5 | Accessibility / mobile | After "Check my answer" focus fell to the page body; the feedback and Continue were below the fold on a phone | High | Fixed |
| M1 | Learning scientist | Wrong options explained themselves with "since / because / so that" far more often than right ones (44% vs 12%) | Medium | Fixed |
| M2 | Learning scientist | Right options carry precision words ("only", "real", "actual", "before", "separate") 31% of the time against 11% for wrong ones | Medium | Open |
| M3 | Learning scientist | A wrong prediction counted as a missed decision in the summary and as a "confusing step" in the quality report | Medium | Fixed |
| M4 | Senior engineer | Option order was re-shuffled on every reload, including for an already-checked answer | Medium | Fixed |
| M5 | Product designer | Lesson pages did not link to their guided mission (`unitForLesson` was unused) | Medium | Fixed |
| M6 | Learning scientist | Sparks are two single-choice questions on one idea, answered once, with no retry and no spaced follow-up | Medium | Open |
| M7 | Mobile UX | On a 375×667 phone the first question's Check button is below the fold | Medium | Open |
| M8 | Product designer | The first-run intro is about 60 words and a second "Your first mission" card still competes with the next challenge | Medium | Open |
| L1 | Mobile UX | The "All set – welcome" toast overlaps the area just under the first CTA for a few seconds | Low | Open |
| L2 | Engineer | The `resumes` counter counts every reload of an unfinished run, not only returns after a break | Low | Open |
| L3 | Engineer | Hints shown are not saved; reload, then answering, records zero hints for that step | Low | Open |
| L4 | Engineer | Two tabs opened at the same moment on a unit with no run can each start a run | Low | Open |
| L5 | Learning scientist | "Try it again" repeats identical items with a different option order, so they can be memorised | Low | Open |

## 1. The first 30 seconds (product designer, mobile UX)

Measured with Playwright on a first-time profile after onboarding.

**Before.** At 375×667 the Start button of "Your next challenge" spanned y = 633–681. The mobile bottom navigation begins at y = 602, so the button was hidden behind it. Above it sat the hero paragraph and two hero buttons ("Optional: take the 5-minute diagnostic", "Browse the Academy"). Below it sat a third, older primary action ("Your first mission", a lesson). A new learner met three competing calls to action and the real first step was the one they could not see. (H3)

**After.** The optional diagnostic and "Browse the Academy" moved to a quiet row below the challenge card (test ids unchanged). The Start button now spans y = 511–559 at 375×667 and y = 444–492 at 1280×800. Regression test: "first 30 seconds: on a small phone the first challenge can be started without scrolling…" (`tests/e2e/r7.spec.ts`).

What works: from Home it is one click to a first screen that is a question with three options (no reading wall), opened in about 0.2–0.35 s locally; the progress line says "Predict · step 1 of about 4"; the card says "about 3 min (an estimate)" and "nothing to read before you start".

Still open:
- **M8.** The first-run intro paragraph is about 60 words (eight lines at 375 px) and must stay, because `home.spec.ts` requires the planned-topic honesty sentence. It still pushes the Start button down to y ≈ 511. Recommendation: keep one sentence visible and put the rest in a `<details>`, updating the test to match. The older "Your first mission" lesson card still follows the challenge card. For a brand-new learner it is a second primary action; consider hiding it until the first spark is done.
- **L1.** The onboarding toast overlaps the strip just under the Start button for a few seconds. It did not cover the button's centre in the measured layout, but at 667 px it is close.

## 2. The five missions and twelve sparks (learning scientist)

### Structure and reasoning demand

- Missions use predict → discover → practice → challenge → reflect. Their challenges are the strongest items: three-part scenarios or diagnoses whose right answers depend on stated constraints (full credit needs every part), flag-the-line, and a constructed evaluation plan. Guessing all three parts of a three-option challenge is 1 in 27.
- **Sparks are weaker.** Each is one predict question before the idea is taught and one follow-up after it, both single choice with three options. The follow-up usually applies the principle read one screen earlier, so it tests recognition and short-term recall, not transfer. A random guess passes a spark's two questions 1 time in 9. Given that, "genuine reasoning" is what the missions deliver and the sparks only prime. The summary screen already says finishing is practice and not mastery; keep saying it. (M6)
- Every option, right or wrong, has feedback of at least 12 characters (enforced by `validateMission`), and a wrong answer is never left unexplained.

### Answer-length and wording clues

Method: for every single-answer group in the 17 units (29 single, 4 multi, 11 case parts; 40 groups with exactly one right option) I measured the right option's length rank by words and by characters, the rate of causal clauses ("since", "because", "so that", ", so"), a precision-word list, overlap with the prompt and with earlier reading text, and how well one-rule strategies would score. Scripts were throw-away and are not in the repo; the gates below are.

| Measure (40 groups) | Before | After |
|---|---|---|
| Right option strictly **shortest**, by words | 19 (47.5%) | 7 (17.5%) |
| Right option strictly **shortest**, by characters | 18 (45%) | 4 (10%) |
| Right option strictly **longest**, by words | 5 (12.5%) | 6 (15%) |
| Right option strictly **longest**, by characters | 10 (25%) | 19 (47.5%) |
| Right option visibly longer than all others (≥8%) | not measured | 1 |
| Right option visibly shorter than all others (≥8%) | not measured | 0 |
| Strategy "pick the shortest" | 57% (chance 32%) | 21% |
| Strategy "pick the option with no causal clause, then the shortest" | 68% | 14% |
| Wrong options with a causal clause / right options with one | 44% / 12% (first, narrower pattern list) | 20% / 31% (final, broader list that also counts ", so") |

- **H2.** Before the fix the right option was usually the shortest, and a single rule beat chance by 25 points; five of the eleven challenge-step groups were the shortest. I lengthened right options (and shortened some of the explaining clauses on wrong ones) in about 40 options across both content files. The first pass overshot: right options became the longest by characters in 60% of groups, so a second pass trimmed them. The one measure still above chance is "longest by characters" at 47.5%, but nearly all of those margins are under 8% (a few characters), and only one group is visibly longer. I left it rather than churn content again; the gate allows up to 50%.
- **M1.** Wrong options had often carried their own flawed justification ("Follow it, since it is addressed to the assistant…"), which made the clause itself a tell. The rates are now closer, though they point slightly the other way (31% right against 20% wrong).
- **M2 (open).** Right options use precision words far more often than wrong ones, and a "pick the option with a qualifier" rule scores about 49% against 32% by chance. Fixing it means rewriting distractors to be equally specific and plausible, which is a content pass, not a patch. Several wrong options are also still easy strawmen ("…the agent can be restricted later if it causes any trouble"). Recommendation for Round 8: rewrite the distractors from real mistakes (use the quality report's wrong-answer counts once there are learners), and have someone other than the author try to answer without reading the question.
- Right options echo the earlier reading text slightly more than wrong ones (average word overlap 0.18 against 0.14). That is normal for retrieval practice and not a leak (no option overlaps the earlier text by 0.6 or more, and no unit item restates a lesson item).
- **Position (H1).** Authors listed the right option first in all 40 groups, which is harmless only if the shuffle is uniform. It was not: `seededOrder` rotated the result whenever it happened to equal the authored order, so with three options the first-listed option landed last about half the time (about 1/6, 1/3, 1/2 by position). That rotation exists for ordering exercises and is wrong for answer options. A learner who always chose the last option would have been right in about 46% of all groups (about half of the three-option ones) against roughly 31% by chance. Options now pass `avoidIdentity = false` (also the prediction gate); order items keep the rotation. This changes option order in lessons too (cosmetic; stored answers are ids).

Regression tests: `units-content.test.ts` ("LENGTH CUE", "WORDING CUE", "POSITION") and `learning-quality.test.ts` ("answer options are uniform over positions even with three options…").

### Scoring and the quality report (M3)

A prediction is made before the idea is taught, so a wrong one is expected and is what the rest of the mission is for. It was counted as a missed "decision" on the summary screen and, in the local quality report, a prediction step most people get wrong would be listed as a "confusing step". The summary now shows predictions on their own line, and the report ignores predict steps. Tests: `missions-engine.test.ts`, `quality.test.ts`.

### Open (M6, L5)

- Every item is checked once and then frozen, including practice. That protects the independent challenge but means a learner who got a practice step wrong cannot try the corrected idea. Recommendation: allow one "try a fresh variant" after feedback on practice steps only, leaving challenges frozen.
- Completing a unit does not schedule any review. Recommendation: let a passed challenge create a review reminder for the linked lesson (never a mastery level).
- "Try it again" replays identical items. Recommendation: author a second variant per challenge before encouraging repeats.

## 3. Accessibility, keyboard and responsive layout (mobile UX specialist)

- **H5.** "Check my answer" disappears when the answer is checked, and focus fell to `<body>`. A keyboard or screen-reader user was returned to the top of the page; on a 375×667 phone the feedback and Continue (y = 1092–1140 in a 667 px viewport) were off-screen with no cue. Focus now moves to the feedback region on a fresh check (not on resume) and the branch consequence likewise; the feedback is in view afterwards. Tests: "after Check my answer focus moves to the feedback…" and "a Quick Spark can be completed with the keyboard alone (Tab, Space, Enter), ending on the summary".
- Existing coverage that still passes: axe at 375 and 1280 for missions and playgrounds, Home/Learn/Deep Lab/review5 at 375/390/768/1280, reduced motion, no horizontal overflow on every new route (the new routes were added to `responsive.spec.ts`). The first-run Home axe test caught a contrast failure on the old ghost-style hero button during this round; the button is now the secondary style.
- Focus moves to the step heading on every step change; the mobile bottom nav targets are at least 44 px.
- **M7 (open).** At 375×667 the first question's Check button is at y = 751–799, below both the fold and the bottom nav, so the learner scrolls to find it. The challenge screens measured fine (Check at y = 507–555, above the nav). Recommendation: a sticky action bar above the bottom nav for the primary button. I did not add it because it is a layout change across every step.
- The `aria-live="polite"` feedback is now also focused, so a screen reader may announce it twice. Low; leave until tested with a real screen reader.
- Not tested: a real screen reader, a real phone, WebKit beyond the existing smoke project, forced-colors mode.

## 4. Persistence, resume and frozen answers (senior engineer)

- Verified working: a refresh resumes at the same step; a checked answer is disabled after reload; the engine refuses a second answer, a second check and any backward move; runs are bound to a content version; backup export/import round-trips runs and an older backup without them imports.
- **H4.** The engine protects frozen answers, but storage did not. With the same unit open in two tabs, tab A checked a wrong answer; tab B, which still held the unanswered step, then answered correctly and checked, and its save replaced A's stored answer and result. Reproduced in the browser (stored `answers = {ask: "a"}` after A had stored the wrong one). `saveMissionRun` now reads and merges inside one Dexie transaction using the pure `mergeRuns`: a step frozen in storage keeps its stored answer, result and branch, a finished run is final, and progress never moves back. The stale tab is shown the stored state with a short notice. Tests: unit ("a stale copy of a run cannot replace an answer that is already checked…", "a finished run is final…") and e2e ("a second tab that still holds the unanswered step cannot replace an answer that was already checked").
- **M4.** The option seed was generated once per page load, so options moved on every reload, including a checked question the learner might be reviewing. It is now the run id. Test: "the option order of a question does not change when the page is reloaded…".
- Open and Low: **L2** `resumes` counts reloads, so the quality report's "resumed" overstates returns after a break (the separate "returns after a break" figure is based on days and is unaffected). **L3** hints shown are held in component state only. **L4** two simultaneous first visits can create two runs (the newest in-progress one wins on the next load). None of these touch mastery, because missions never write attempts or competency evidence (tested).
- Frozen answers are an integrity property of a practice record. They do not make a mission trustworthy evidence, and the finish screen says so.

## 5. Connection to deeper lessons and labs (product designer)

- Mission and spark finish screens link to the lesson (the assessment is the evidence), to related missions and playgrounds, and to "Save a takeaway" in the library. Deep Lab links to the AI Lab, Improvement Loop, Challenges, Playbooks and Transfer and shows where the learner left off.
- **M5.** The link ran only one way: a learner reading a lesson was never told a shorter guided mission existed. `unitForLesson` was defined and unused. Lessons that have a mission now show one line above the stage tabs ("Want a shorter way in? Try the 8-minute guided mission first. It is practice only…").
- Gaps left open: no unit leads into a specific lab experiment (Deep Lab is a doorway only); the five missions cover five of the 28 lessons, and the twelve sparks do not map to every track; a learner who finishes everything is told they are "caught up" with no push to the real assessments, though the older "first mission" card still points at a lesson. See M6 for the missing review link.

## 6. AI engineering (accuracy and honesty)

- Spot-checked the claims in the sparks and missions against the product's own lessons and sources (skills vs MCP vs hooks, indirect prompt injection, least privilege, schema validation vs meaning, trace vs narration, held-out evaluation). They are consistent and conservative, and every scenario uses invented names. I did not re-verify them against vendor documentation in this audit.
- The three playgrounds are rule-based simulations with fixed inputs; each states that it is simulated and none shows an accuracy or quality number. Their 22 unit tests and axe checks pass. I did not re-read their copy line by line in this audit.
- The local quality report uses only data already on the device, no timing, no network, and labels samples under five as "too few to say".
- No automatic execution of Claude, no Skill installation, no backend, accounts or analytics were added.

## 7. Verification

- Before this audit, CI on the pushed head was green (`verify`, `webkit-smoke`).
- After the fixes, local: ESLint, TypeScript, build and the full Playwright suite via `npm run verify`; the results are in the final report for this change and apply only to the commit they were run on. CI on the pushed head is separate evidence and must be checked after the push.
- New tests: 6 unit (stale tab, finished run final, report ignores predictions, three-option shuffle uniformity, wording gate, position gate; the summary test and the length gate were updated, not added) and 5 e2e (stale tab, focus after check, option order on reload, keyboard-only spark, first 30 seconds at 375×667).

## 8. What could still block merging PR #5

1. **CI on the pushed head.** Not yet run on this change.
2. **Your decision on the open Medium findings.** None breaks a guarantee. M2, M6, M7 and M8 are the ones most likely to matter to learners.
3. **A shared-code behaviour change.** The option shuffle fix also changes the order lesson options appear in. It is cosmetic and covered by the whole suite, but it touches code outside Round 7.
4. **Not verified:** any real learner, real device, screen reader, WebKit beyond the smoke project, or the live Pages site. The Round 6 note stands that about 110 older lesson items still have the shortest-right-option cue; this audit did not touch them.
