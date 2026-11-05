# Content authoring and source verification

## Lessons (`src/content/lessons/`)

Lessons are typed TypeScript (`Lesson` in `src/domain/curriculum/types.ts`), one file per lesson, registered in `index.ts`. `tests/unit/content.test.ts` enforces the rules below on every run.

**Required parts:** stable `id`, `version`, track, prerequisites, competency tags, effort, objectives, ≥3 teaching segments, a guided activity (optionally with an interactive widget), an assessment, failure modes, an application with a field-evidence prompt, a review pool of **≥5** items, and source references (https only).

**Item rules**

- Every option of a choice item has a `why` (≥8 characters) — the learner is told why each wrong answer is wrong.
- Every item has an `explanation`.
- Assessment items must **not** duplicate practice items, and review items must not duplicate either (the assessment is meant to be unseen). The test compares content, not just prompts.
- `critical: true` marks a **mandatory check**. Any competency flagged `safetyCritical` (skill-security, experiment-design) must have at least one critical assessment item in the lessons that teach it.
- Numeric items may take a function so the answer is computed from a trusted fixture at grading time (they can never drift from the data).
- The test suite proves a *perfect* answer to every item is graded fully correct and a blank answer never is.

**Changing a lesson.** If you change anything that affects grading (items, answers, pass mark), **bump `version`**. Old attempts are kept but stop counting toward current-version mastery; the learner sees a notice on the lesson and on Growth. Pure wording fixes need no bump.

**Fixtures** live in `src/fixtures/`. Keep them small, original, deterministic and labelled as educational. Whenever a lesson makes a numerical or behavioural claim about a fixture, add an assertion in `tests/unit/content.test.ts` or `fixtures.test.ts` so the claim can't drift.

## Catalog (`src/content/catalog/entries.ts`)

Entries are validated by `CatalogEntrySchema` at import time and by `tests/unit/catalog.test.ts`.

- Every non-custom entry needs a canonical https `sourceUrl`, a `verifiedAt` date and a `verificationMethod` that says **how** it was checked.
- Anything not established stays `null`/`unknown` (commit date, release, SPDX, stars). The tests assert commit/release stay `null` until a real source supplies them.
- `install.status: 'verified-from-source'` requires at least one method, each with the URL it was read from and any caveat. Anything else shows "no installation command" and a link.
- `tier`: `official` (Anthropic-published or documented in Anthropic's docs) · `community` (third party, repository page read) · `candidate` (insufficiently evaluated) · `custom` (a proposal; never has a source or install command).
- `missingChecks` lists what has *not* been verified — it is displayed to the learner.

### To refresh or add an entry

1. Read the canonical page(s) yourself. Prefer cloning and reading the files over summaries.
2. Update fields; keep unknowns unknown. Quote install commands exactly; add the source URL and caveats.
3. Set `verifiedAt` to today and describe the method honestly.
4. `npm test` — the catalog tests catch missing sources, bad URLs, unresolved lesson/alternative references.
5. External changes must go through review; never auto-promote a newly found Skill into trusted recommendations.

## Verification log — snapshot of 2026-11-05

Method: pages were read through an automated fetch-and-summarize tool. **That is weaker than reading the files**; it is recorded as such in every entry. Nothing was cloned, installed or executed.

| Source | Result |
|---|---|
| `code.claude.com/docs/en/skills` | Read in full (frontmatter reference, invocation, listing cap, supporting files, string substitutions, `/skills`, `/reload-skills`, `/skill-doctor`, `claude plugin validate`/`eval`, `skillOverrides`, troubleshooting). |
| `…/plugins`, `…/discover-plugins`, `…/plugin-marketplaces` | Read. The latter two now serve "Install and manage plugins" and "Create a marketplace". Used for install syntax, scopes, trust and marketplace facts. |
| `…/sub-agents`, `…/hooks-guide`, `…/memory` | Read (sub-agents: first 100k of 116k characters; hooks and memory: targeted fact extraction). Used for Lesson 1 and 9. |
| `github.com/anthropics/skills` | Repository page read: README claims, structure, licence statements, install commands. Skills list under `skills/` not visible; no LICENSE file in the listing. |
| `github.com/obra/superpowers`, `getsentry/skills`, `vercel-labs/agent-skills`, `microsoft/playwright-mcp`, `modelcontextprotocol/servers`, `anthropics/claude-code` | Repository pages read. Licences as stated on the pages; commit dates and releases **not shown**, so recorded as unknown. |
| `agentskills.io/specification` | **Could not be reached** from the authoring environment (host not on the session's network allowlist). Portable-format limits in Forge (name pattern ≤64 chars, description ≤1024, compatibility ≤500) follow the Claude Code docs and general knowledge of the spec. **Re-check against the spec** before relying on exact limits. |
| GitHub API (commit dates, releases) | Not available in the authoring session. |
| Individual `SKILL.md` files, scripts, LICENSE files | **Not read.** |

Known small risk: the docs change quickly. Lesson text that quotes commands says "docs read 2026-11-05"; re-verify before relying on a command.


## Round 2 content

- **Review pools** (`src/content/lessons/review-extra.ts`, `review-pool-2.ts`): nine items per lesson, each with `difficulty` 1-3 (the original five are tagged in `index.ts`). Review items stay separate from practice and assessment items so they count as *unseen* evidence.
- **Misconceptions** (`src/content/misconceptions.ts`): tag a wrong option with `o(id, text, why, 'misconception-id')`. Tests require every tag to exist, never to sit on a correct option, every catalog entry to be triggered by at least one option, and every corrective question to be a gradeable single-choice item.
- **Diagnostic** (`src/content/diagnostic.ts`): one question per competency; bump `DIAGNOSTIC.version` if grading content changes (old results stay on record).
- **Loop missions** (`src/content/missions/*`, fixtures in `src/fixtures/<mission>/`): to add a mission, write the fixture as pure TS (the same file is imported by the app for ground truth and shipped raw in the pack), register dev and held-out fixture ids in `src/fixtures/index.ts`, and define the mission (cases, checklist, verdict options, labels, starter Skill). `tests/unit/loop-missions.test.ts` runs every registered mission through the full lifecycle; each mission also needs its own fixture test: ground-truth margins, pack CLI output equal to the in-app computation, no answers or causes in packs, dev/held-out disjoint, and a starter Skill that is valid but deliberately imperfect.
- **Honesty rules for fixtures**: no FPS or timing claim anywhere (the perf fixture counts work; the integration fixture counts operations); fabricated material is labelled as fabricated; held-out packs never contain dev material and vice versa.
