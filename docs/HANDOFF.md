# Claude Forge — handoff summary (state as of 2026-11-05, after Development Round 3 + visual assets)

Paste this whole document into a new conversation. It describes what exists, what was verified, what is NOT verified, and what to improve next.

## 1. What it is

**Claude Forge** is a static, offline-capable learning app — a *personal AI Mastery Academy* — that teaches an experienced developer **judgment about AI**: which approach fits a problem (prompt, workflow, Skill, agent, tool/MCP, hook, script, conventional software, a person, or nothing), how to specify tasks, why agents fail, how to integrate tools safely, how to build reliable workflows, how to evaluate claims honestly, and how to discover and assess new tools. It began (Rounds 1–2) as an academy for Claude Code Skills; that remains its deepest hands-on track (Skill Workshop, Skill Improvement Loop, AI Lab).

Learning loop: Discover → Understand → Practice → Experiment → Apply → Measure → Master.

Hard product rules (must be preserved):
- No backend, account, analytics, paid API or Claude API key. Everything is local (IndexedDB). The app never runs Claude, never runs a playbook, never installs or executes anything.
- Never present synthetic or authored data as real telemetry or an AI output. Manual metrics are labelled self-reported / user-imported, never "verified".
- Unknown stays unknown (never coerced to 0; no invented URLs, install commands, licences, dates, prices, popularity or benchmarks). Star counts appear only "as displayed" with a date and are never used to rank.
- Third-party and imported content is untrusted data: rendered as text, never executed. Imported playbooks have other people's "verified" claims reset.
- Mastery only from evidence (unseen assessments, field evidence). Goals, practice runs, the diagnostic and playbooks never raise a competency level.
- Planned topics are never shown as available.

## 2. Stack and location

React 19, TypeScript 5.9 (strict), Vite 8 (Node ≥ 22.12), Tailwind 4, React Router 7 (hash routing, `base: './'`), Dexie 4 (IndexedDB, schema v5), Zod 4, `yaml`, JSZip, react-markdown + remark-gfm, Vitest 5 + Testing Library + fake-indexeddb, Playwright (Chromium) + axe-core, ESLint 9.

Repository: `https://github.com/idoggk/Claude_Forge` (Round 1–2 on `main`; Round 3 on branch `round-3-ai-mastery`, draft PR). Local working copy used for Round 3: `/home/user/claude_forge`.

```
src/app          shell (grouped nav), router, providers, error boundary
src/features     academy (+ Opportunity Finder) · mission · onboarding · explore (Capability Map, goals) · playbooks · discovery ·
                 workshop · battle-lab (= AI Lab) · loop · arsenal · growth (+ mastery profile) · settings · search · more
src/domain       curriculum (types, 17 competencies, 12 tracks, 13 profile areas) · assessment (grade incl. `fields`, calibration,
                 external checks) · mastery (competency, review, recommend, profile) · capability · goals · playbook · finder ·
                 skills · experiments (generalised) · catalog · loop
src/content      lessons l01–l18 · misconceptions · diagnostic (17 q) · missions · catalog (entries + entries-r3) ·
                 capability/map · playbook/seeds · lab/templates · finder/scenarios · sources/registry.json
src/persistence  db.ts (v5), schemas, repo, backup, useLive
src/components/ui accessible primitives + Illustration
public/assets/forge  nine decorative SVGs (see docs/ASSETS.md)
scripts          sw-plugin.ts, check-sources.mjs (optional, read-only)
tests/unit  tests/e2e  docs/  .github/workflows/{ci,deploy,source-check}.yml
```

## 3. What exists

**Navigation** (six areas): Mission Control · Learn (Academy, Improvement Loop) · Explore (Capability Map, Discovery Hub) · Lab (AI Lab) · Build (Skill Workshop, Workflow Playbooks) · My System (Arsenal & Growth). Mobile bottom bar: Mission, Learn, Explore, Lab, More. Global search covers lessons, capabilities, catalog, Skills, playbooks and experiments.

**Academy — 12 tracks, 18 lessons.** Available vs planned is explicit (44 topics are planned and say so). Lessons 1–10 are the Round 1–2 Skills curriculum (track slugs remapped, content/grading unchanged except wording "Battle Lab" → "AI Lab"). Lessons 11–18 are new (each: problem → prediction-before-explanation → concepts → worked example → guided practice → independent assessment with at least one mandatory-check where safety-critical → application → 8-item review pool → sources):
11 Choose the Right AI Approach · 12 Context Engineering · 13 Why AI Agents Fail (failure autopsies on fabricated traces) · 14 MCP or Not? · 15 Build a Reliable AI Workflow (verifies a saved Playbook) · 16 AI Evaluation Fundamentals (verifies a real AI Lab experiment) · 17 Efficient AI-Assisted Development · 18 Discover and Evaluate an AI Tool.
New item kind `fields` (labelled written answers checked for required ideas by keyword groups — deliberately narrow, always paired with a self-assessment `reflect` rubric). New `Segment.prediction`. Diagnostic now 17 questions (one per competency; a hint only). 8 new misconceptions with targeted feedback.

**Mastery** unchanged in rules (L0–L4; L3 needs an unseen hint-free attempt with no missed critical item; L4 needs self-reported field evidence). **Personal AI Mastery Profile** (Growth page): 13 areas; state follows the weakest competency in the area; areas with no lessons are "planned" with no level; each area gives evidence counts and an explained next step.

**Recommendations** stay deterministic and explained: due reviews first; then prerequisites, failed attempts, learning goals (+30 per goal, reason shown), practice gaps from the Opportunity Finder (+10), interests, diagnostic hints, game relevance. No AI coach.

**AI Capability Map** (`/explore`): 19 capabilities, 10 goal-phrased outcomes ("I want to…"), search, typed relations, each card with the deciding question, use/avoid/risks and links to lessons, catalog entries, playbook templates and AI Lab templates (unit-tested: no dead ends, every reference resolves). **Learning goals** (max 5 active) steer recommendations; "achieved" is the learner's own declaration with a note.

**Discovery Hub**: 23 entries (20 source-read, 3 proposed custom Skills) across skills, plugins, MCP servers, agent frameworks, an AI coding tool, models, an automation tool, techniques, workflow patterns, developer integrations; provenance and unknowns shown; `capabilityIds` link to the map. **Source registry** (`content/sources/registry.json`) records every source and four *unreachable* hosts. Optional `scripts/check-sources.mjs` + weekly `source-check.yml` open a *draft PR* of status data only.

**Workflow Playbooks** (`/playbooks`): create/edit/duplicate/delete, six seeded exemplars (all steps start "planned"; they pass the same reliability checklist Lesson 15 grades), steps with verification gate / failure handling / human-approval flag / status (a step cannot be "verified" without a note saying what verified it), links to Skills and catalog entries, observed results (self-reported), version history (30), Markdown + JSON export, validated import (verification claims reset).

**AI Lab** (`/battle-lab`): experiments for Skills, prompts, workflows, agent setups, tool configurations or models (you supply results); six templates; baseline kinds generalised; reports state what is compared. Legacy Skill experiments and the Improvement Loop are unchanged.

**AI Opportunity Finder** (`/academy/opportunity-finder`): 12 invented scenarios (conventional software, a person and "do nothing" are each the best answer somewhere), best = 1 / defensible = 0.5, runs stored in `activityRuns` (never levels).

**Visual assets**: nine supplied SVGs, decorative only — see `docs/ASSETS.md`.

## 4. Verification

`npm run verify` exited **0** in one clean, final run (2026-11-05): **ESLint clean · `tsc --noEmit` clean · Vitest 398 passed (29 files) · production build OK · Playwright 88 passed (Chromium, ~7.9 min)** · `npm audit`: 0 vulnerabilities.

What the Round 3 tests prove, beyond Rounds 1–2:
- *Content integrity*: 18 lessons with stable ids; every option explains itself (≥ 12 chars for new content); a perfect answer to every non-external item is graded correct and a blank/wrong one is not (including the new `fields` kind); each new lesson has a prediction, a worked example, ≥ 4 practice items, an 8-item review pool, sources and an application; the diagnostic covers all 17 competencies once.
- *Capability Map*: no dead-end cards; every lesson, catalog entry, playbook template, lab template, area, outcome and relation resolves; every available lesson is reachable; no popularity ranking text.
- *Catalog and sources*: ten entity types present; star counts only "as displayed" with a date; every catalog URL is in the source registry; unreachable hosts are never used by an entry.
- *Playbooks*: seeds start planned, pass the Lesson 15 checklist, and use real capability ids; "verified" needs a note; import rejects bad/foreign/newer files and resets other people's verification; hostile text stays inert; version history is capped; the Lesson 15 external check reads saved playbooks.
- *Evaluation honesty*: non-Skill experiments accept baseline/prompt/workflow/model kinds, unknown stays unknown, overlapping ranges are not called a win, Lesson 16's check ignores unknown values.
- *Learning engine*: goals raise priority with a visible reason and never create evidence; practice runs feed hints only; the Mastery Profile follows the weakest competency and marks areas without lessons as planned.
- *Persistence*: a real v4 database is upgraded to v5 with every record intact (old experiments become Skill experiments); an R2 backup with none of the new stores imports; R3 data round-trips; an invalid record is reported, never silently dropped; goal limits.
- *End to end*: grouped navigation, outcome-first exploration and a goal steering Mission Control, prediction gate, a lesson passed through real `fields`/flag-lines UI, the playbook lifecycle (copy, verify-needs-note, version history, Markdown/JSON export, hostile import), a full Opportunity Finder run, AI Lab templates, Discovery filters, axe on the new routes in both themes, no horizontal overflow at 375/1280 px, and the visual-asset checks (decorative alt, no art on dense pages, hidden art not fetched on phones, app usable with images blocked, dark-theme-only backdrop).

Real bugs found by these tests/reviews and fixed during Round 3: the demo clone leaking its "synthetic" subject into a real experiment; the Opportunity Finder re-picking its scenarios when a run was saved (the summary would have described different scenarios); stale list fields after restoring a playbook version; brittle Academy track chip labels; three lessons missing an explicit worked example; 68 option explanations that were just "Correct." or "No."

## 5. NOT verified / known limitations

- **Four research hosts were unreachable** (`modelcontextprotocol.io`, `openai.github.io`, `genai.owasp.org`, `ai.google.dev`; DNS failure). Nothing from them is claimed. Gemini/Google and OWASP coverage is a gap. The MCP specification repository page was read, not the rendered docs.
- Catalog facts were read 2026-11-05 through an automated fetch-and-summarise step; release names and commit dates were not shown on any GitHub page read (unknown). The models entry shows prices only "as displayed" on the overview that day; the Pricing page was not read. The Agent SDK entry covers only the overview page.
- Lessons 11–18, the Capability Map, playbook seeds, Opportunity Finder scenarios and lab templates are **authored by Forge** from cited sources. Claims about Claude Code behaviour (MCP scopes and approval, hooks, subagents, Plan Mode, worktrees, `/clear`) were taken from the documentation pages as read; they may drift. Nothing was run in Claude Code to test the playbooks.
- `fields` answers are keyword-checked: they can be gamed by listing the expected words, and they cannot judge writing quality. The paired `reflect` rubric is self-assessed.
- The Opportunity Finder has 12 scenarios (6 per run): enough to practice, not enough to measure.
- `source-check.yml` and `scripts/check-sources.mjs` have **not been run** in GitHub Actions / against the network from this repository.
- **Not verified:** WebKit/Safari, Windows, a real iPhone, GitHub Pages deployment. Only Chromium on Linux (including phone-width emulation) was tested locally. **GitHub Actions:** `ci.yml` ran for the first time on PR #1 and exposed two environment-only problems that local runs hid: `vite preview` bound to `localhost` (IPv6 `::1`) so Playwright's web server never became reachable (fixed by binding `127.0.0.1`), and a non-wrapping Workshop badge overflowing at 375/390 px on the runner's wider system fonts (fixed by letting `Badge` wrap, plus a regression test that forces a DejaVu font stack). Check the PR's latest `verify` run before trusting either fix; `deploy.yml` and `source-check.yml` have still never run.
- Illustrations were reviewed visually in Chromium at 375/768/1280 px in both themes, and covered by axe + overflow tests; not on real devices.
- Round 1–2 limitations still apply: the Improvement Loop's ground truth is synthetic and its verdicts are self-reported; the Trigger Dojo overlap meter is lexical; ZIP import limits are conservative guesses; progress does not sync between devices.

## 6. Conventions for continuing

- Run `npm run verify` (lint → typecheck → vitest → build → playwright) before claiming anything passes. Do not claim unrun tests passed.
- Changing grading content ⇒ bump that lesson's `version`. Every choice option needs a `why` (≥ 12 chars for new content; "Correct." alone is not feedback). Assessment items must differ from practice and review items.
- A `fields` item needs a `reflect` rubric beside it. Fabricated material uses `.example` domains.
- Catalog edits: keep unknowns null; set `verifiedAt` + an honest `verificationMethod`; every sourced entry's URL must be in `sources/registry.json`; `capabilityIds` must exist on the map. Never auto-promote newly found tools.
- A new capability card needs a real destination (lesson, entry, playbook or lab template).
- Never `await` a non-Dexie promise (WebCrypto, fetch) inside a Dexie transaction, and list every touched table in the scope.
- Keep the dependency list small; prefer pinned versions via the lockfile.

## 7. Next three priorities

1. **Close the research gaps**: run `node scripts/check-sources.mjs` from a network that reaches the four blocked hosts, read them, then add a Gemini/Google entry, an OWASP LLM-risk entry, the MCP documentation, and a prompt-injection lesson for the Safety track. Run `source-check.yml` once and review the draft PR it opens.
2. **Teach the planned topics that matter most** — structured outputs and tool calling (Track 1), few-shot examples and prompt-injection awareness (Track 2), RAG and evaluation harnesses (Track 12). A topic leaves "planned" only with a lesson that has an independent assessment.
3. **Connect playbooks and the Lab**: link a playbook to an AI Lab experiment so a step can be marked verified *from* recorded runs; add transcript import so run data can be user-imported rather than typed; then run a real playbook and a real loop with real Claude Code and fix what the evidence shows.

(Earlier candidates still open: blinded rubric scoring, screenshot regression, a "what changed" notice when lesson versions bump, running the optional WebKit smoke project somewhere it can install.)
