# Learning-quality audit

The audit is code, not opinion: `src/domain/curriculum/audit.ts` measures the content, `tests/unit/learning-quality.test.ts` enforces what can be enforced, and `npm run audit:content` writes a readable report to `docs/audit-report.txt`. Heuristics find regressions; they do not prove that a question teaches well. Editorial judgment still decides.

## Round 6: before and after

Measured on the same 461 items in the 24 lessons that existed in Round 5 (practice, assessment and review pools). The four lessons added in Round 6 are held to the same gates.

| Measure | Round 5 (before) | Round 6 (after) |
|---|---|---|
| Single-answer items where the right option is at least 25% longer than every wrong one | **211 of 258 (82%)** | **2 of 240 (0.8%)** (items whose longest option is under 25 characters, such as case names, are skipped: there is no room for a length cue) |
| Median length of the right option relative to the average wrong option | about 2.3 to 2.6 | about 0.87 |
| Right option is the longest | about 90% | 18% |
| Right option is the shortest | not measured | **46%** (chance is 25 to 33%; see "Not fixed") |
| Wrong options with feedback under four words | 98 | 0 |
| Options with empty or one-word feedback (including a bare "Correct.") | 60 | 0 |
| Duplicate options inside an item | not measured | 0 (one documented exception: `~/.claude/skills` versus `.claude/skills`) |
| A right answer restated in another item of the same lesson | 0 | 0 |
| Wrong options using absolute words (always, never, only, all) versus right options | not measured | 23% versus 14% |
| Written answers passable by typing the accepted terms | all 15 | none (Round 5 fix, still tested) |
| Option order shown to the learner | shuffled per attempt | shuffled per attempt, and the shuffle itself was **biased and is fixed** (below) |

## What was done

**Distractors rewritten.** Every wrong option in the 211 items that had the length leak, and in the items that had very thin feedback, was rewritten as a realistic misunderstanding with a stated reason (not padded with filler), and the feedback for every option now explains why it is right or wrong. Correct options were not shortened. Fourteen of the 24 lessons went from version 2 to 3 and ten from 1 to 2, so earlier attempts stay on record but stop counting as current evidence, exactly as the versioning rules say. A test requires the old version not to count.

**A shuffle bug found while testing.** `seededOrder` used FNV-1a alone, so option ids that differ only in their last character (`a`, `b`, `c`, `d`) were ordered with a visible bias: over 400 seeds the first option landed in some positions about 12% of the time instead of 25%. A murmur3-style finaliser now mixes every bit. A test checks that each position gets between 15% and 35% of 400 seeds, that the order is a permutation and that it is deterministic per seed.

**Stronger gates** (all in `learning-quality.test.ts`): length leak at most 40% (target) and at most 10% (ratchet); right option not the longest by a wide margin; shortest tendency capped at 50%; absolute-word gap at most 20 points; no duplicate or empty options and at least three options; no answer restated elsewhere; no option with unexplained feedback; no broken prerequisite links; written items reject their own list of accepted terms; lesson versions.

**New assessment formats.** Case items (a decision scenario or an error diagnosis made of linked parts) and construct items (a small structure checked deterministically, with a self-evaluation rubric that is never scored). They are not multiple-choice, so the length cue does not apply to them, and their option order is shuffled per part.

## Not fixed, and what that means

- **Shortest-is-right tendency (46% of single-answer items).** Closing the length gap by lengthening wrong options overshot in about half the items: the right option is now shorter than every wrong option in 46% of them. That is a weaker cue than the old one (choose the longest passed about 90%), but it is a cue. Fixing it means lengthening or sharpening the right option in those items, which is authoring work. A ratchet stops it getting worse. An automatic fix was tried (appending the existing feedback to the right option) and rejected because it read badly.
- **Two lessons without sources** (L06 and L07 teach on invented game fixtures and cite no external page). That is intentional for the fixture content, but it means no claim in them can be traced. A ratchet allows no more than two.
- **Heuristics are not proof.** None of these checks can tell whether a distractor is a real misconception or whether a scenario is realistic. Reviewers should read the items.

## Round 7 additions

Guided missions and sparks are practice, not evidence. Gates: every option has feedback; challenge steps are frozen and hint-free; unit items must not restate lesson items (overlap test); completion writes no attempts. The Round 7 quality audit (`ROUND_7_QUALITY_AUDIT.md`) then measured and rebalanced length, causal-clause and position cues in the units and added corpus gates for them. Known weakness that remains: precision words ("only", "real", "actual") appear in right options about three times as often as in wrong ones. Earlier note: unit options were only partly checked for the "right answer is longest/shortest" cue; the 110-item cue from Round 6 is still open.

## Earlier findings (Round 5)

The Round 5 audit found the 82% length leak and the keyword-stuffing weakness. Keyword and fields answers that read as a list of accepted terms are not credited (`readsAsTermList` in `domain/assessment/grade.ts`).

## How to keep it from getting worse

Run `npm run audit:content` before adding or editing items, read `docs/audit-report.txt`, and lower the ratchet constants in `tests/unit/learning-quality.test.ts` when you improve a measure. When grading content changes, bump the lesson `version`. When you write multiple-choice items, make every option about the same length and give every option its own reason.
