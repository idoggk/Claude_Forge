# Learning-quality audit (Round 5, priority 8)

The audit is code, not opinion: `src/domain/curriculum/audit.ts` measures the content and `tests/unit/learning-quality.test.ts` enforces what can be enforced today. This page records what it found and what was done.

## What was measured (all 24 lessons, 461 items: practice, assessment and review pools)

| Check | Result | Action |
|---|---|---|
| Correct option repeats the question | none | guard test (must stay zero) |
| "All / none of the above" shortcuts | none | guard test (must stay zero) |
| Review item repeats an assessment prompt of its own lesson | none | guard test |
| Near-duplicate prompts | 9 pairs, all parallel forms with different data (for example 10 steps at 95% vs 8 steps at 90%) | guard test: the answer content must differ |
| Correct position in the authored data | strongly skewed to the first option | not a leak for learners: options are shuffled at display time (`seededOrder`, seeded per attempt) |
| **Correct option is the longest by 25% or more** | **211 of 258 single-answer items (82%)**. The correct option is the longest in 225 of 258 and its median length is about 2.3 to 2.6 times the average wrong option, in practice, assessment and review alike | **Not fixed.** See below |
| Wrong options with almost no explanation (< 4 words) | 108 | ratchet only (must not grow) |
| Written answers (keywords and fields, 15 items) passable by typing the accepted terms | **yes, all of them** | **Fixed** (below) |

## Fixed in this round

**Keyword stuffing.** `keywords` and `fields` items were graded by "does the text contain any accepted phrase of each group", so a list of accepted terms passed. `readsAsTermList` in `domain/assessment/grade.ts` now refuses to credit an answer of six or more words that is mostly accepted terms (70% or more) or has almost no connecting words, and says why. Short answers are graded as before. A real sentence using the same ideas still passes. A test requires every written item in the curriculum to reject its own full list of accepted terms. Because grading changed, the 14 lessons that contain a written item moved from version 1 to **version 2**; earlier attempts stay on record and stop counting toward current mastery, as designed. The test helpers that used to type term lists (unit and browser) now type a sentence.

## Found and NOT fixed (be honest about this)

**Length leak.** A learner who always picks the longest option would pass most multiple-choice items without knowing the material. This is the largest weakness in the curriculum's assessments and it affects mastery evidence. Fixing it properly means rewriting wrong options so that they are as detailed and as plausible as the right one, which is authoring work on about 200 items and was not done here. What exists now:
- a measurement (`longestCorrectShare`) and a **ratchet test** that fails if the share rises above today's 83%;
- the target recorded here: **40% or lower**, which should be reached by rewriting the weakest lessons first (every lesson has 4 to 12 offenders; L08, L24, L18, L21 and L05 have the most).

Until then, treat multiple-choice results as weaker evidence than the numeric, classify, order, flag-lines and fields items, which are not subject to the length leak. The competency levels are unchanged by this round.

## How to keep it from getting worse

Run `npx vitest run tests/unit/learning-quality.test.ts`. When you rewrite items, lower the ratchet constants in that file to the new measured values.
