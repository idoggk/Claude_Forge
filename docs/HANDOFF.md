# Claude Forge — handoff summary (state as of 2026-11-05, after Development Round 4)

Paste this whole document into a new conversation. It describes what exists, what was verified, what is NOT verified, and what to improve next.

## 1. What it is

**Claude Forge** is a static, offline-capable learning app — a *personal AI Mastery Academy* — that teaches an experienced developer **judgment about AI**: which approach fits a problem (prompt, workflow, Skill, agent, tool/MCP, hook, script, conventional software, a person, or nothing), how to specify tasks, why agents fail, how to integrate tools safely, how to build reliable workflows, how to evaluate claims honestly, and how to discover and assess new tools. It began (Rounds 1–2) as an academy for Claude Code Skills; that remains its deepest hands-on track (Skill Workshop, Skill Improvement Loop, AI Lab). Round 4 added advanced lessons, made playbooks accountable to AI Lab evidence, tightened the Lab, and added a record for taking work to real projects.

Learning loop: Discover → Understand → Practice → Experiment → Apply → Measure → Master.

Hard product rules (must be preserved):
- No backend, account, analytics, paid API or Claude API key. Everything is local (IndexedDB). The app never runs Claude, never runs a playbook, never installs or executes anything, and never reads a project folder.
- Never present synthetic or authored data as real telemetry or an AI output. Manual metrics are labelled self-reported / user-imported, never "verified".
- Unknown stays unknown (never coerced to 0; no invented URLs, install commands, licences, dates, prices, popularity or benchmarks). Star counts appear only "as displayed" with a date and are never used to rank.
- Third-party and imported content is untrusted data: rendered as text, never executed. Imported playbooks arrive without evidence and with other people's "verified" claims reset. Imported experiments arrive as NEW experiments, previewed first, relabelled user-imported. A model's statement that tests pass is never a measurement.
- Mastery only from evidence (unseen assessments, field evidence). Goals, practice runs, the diagnostic, playbooks, evidence maturity and transfer tasks never raise a competency level.
- Planned topics are never shown as available.

## 2. Stack, location, branch state

React 19, TypeScript 5.9 (strict), Vite 8 (Node ≥ 22.12), Tailwind 4, React Router 7 (hash routing, `base: './'`), Dexie 4 (IndexedDB, **schema v6**), Zod 4, `yaml`, JSZip, react-markdown + remark-gfm, Vitest + Testing Library + fake-indexeddb, Playwright (Chromium) + axe-core, ESLint 9.

Repository: `https://github.com/idoggk/Claude_Forge`. Round 1–2 are on `main`; Round 3 is on `round-3-ai-mastery` (draft PR #1, **not merged**); Round 4 is on `round-4-advanced-mastery`, branched from Round 3 and therefore opened as a draft PR **against `round-3-ai-mastery`**. Nothing was merged or deployed. Local working copy used: `/home/user/claude_forge`.

```
src/app          shell (grouped nav), router, providers, error boundary
src/features     academy (+ Opportunity Finder, retrieval widget) · mission · onboarding · explore · playbooks (+ EvidencePanel) ·
                 transfer · discovery · workshop · battle-lab (= AI Lab) · loop · arsenal · growth · settings · search · more
src/domain       curriculum (23 competencies, 12 tracks, 13 profile areas) · assessment · mastery · capability · goals ·
                 playbook (ops, evidence) · transfer · retrieval · finder · skills · experiments (compare, report, importer) · catalog · loop
src/content      lessons l01–l24 · misconceptions (30) · diagnostic (17 q) · missions · catalog (entries + entries-r3, 38) ·
                 capability/map (22) · playbook/seeds · transfer/prompts · lab/templates · finder/scenarios · sources/registry.json (36)
src/persistence  db.ts (v6), schemas, repo, backup, useLive
scripts          sw-plugin.ts, check-sources.mjs + source-check-lib.mjs (optional, read-only)
tests/unit  tests/e2e  docs/  .github/workflows/{ci,deploy,source-check}.yml
```

## 3. What Round 4 added

**Six advanced lessons (L19–L24)** — Structured Outputs and Tool Calling · Few-Shot Prompting · Prompt Injection and Trust Boundaries · Retrieval-Augmented Generation · Designing AI Evaluation Harnesses · Context Engineering for Long-Running Agents. Each has a realistic problem, mental model, worked example, a prediction segment, practice with feedback on every option, misconception correctives, a separate independent assessment (deterministic grading: `fields`, flag-lines, classify, order, numeric, single/multi, reflect), an application, verified sources and an 8-item review pool. L22 uses a deterministic BM25 fixture over a fictional corpus (no embedding API, no vector DB; the lesson states what it does not simulate). L23's external check reads real AI Lab experiments (hypothesis, criteria, baseline, ≥ 3 runs per condition with known measurements, locked rubric, limitations). L21's samples are inert (`.example` hosts). Six new `advanced` competencies keep the foundation diagnostic at 17 questions. Seven new misconceptions; the recommender names a lesson that directly teaches a misconception recorded elsewhere, with the reason.

**Playbook ↔ AI Lab evidence (Priority 2).** From a step: create an experiment (the form opens with the step's gate as the success criterion and links on creation) or link an existing one. Each link stores playbook ID/version, step fingerprint, an experiment snapshot (conditions, per-measure n/mean/min/max, sufficiency, fixture hash), provenance, and the learner's criteria, claimed outcome, judgement, note and limitations. **Linking verifies nothing.** A step is *supported* only when the link is current, the evidence is suitable (non-synthetic, baseline, ≥ 2 runs with data per condition, criteria written, a judgement with a note, limitations) and the judgement is "supports". If the step or experiment changes, the link is stale, ignored, and cannot be judged until reassessed (the old judgement moves to history). A step marked verified records its wording; an edit shows "Verification outdated". Playbook **maturity** is computed: Draft / Ready to test / Partially evaluated / Evaluated on fixtures / Applied to real work (self-reported; never replaces fixture evaluation). **Evaluation summaries** are frozen, versioned Markdown (Observed evidence / Interpretation / Limitations / Next experiment). The Lab shows the reverse view and can attach an experiment to a step. Existing playbooks migrate (DB v6) with their verifications intact; imported playbooks carry no evidence.

**AI Lab quality (Priority 3).** Attempt result (completed / failed / abandoned, all kept and counted); per-run Skill version, fixture version and execution context, with validity notes when they differ; sample SD beside n and range ("no significance test was computed"); pasted output analysed with labels — recognised test-runner summaries are **Parsed**, statements like "all tests pass" are **Inferred** and never applied, contradictions are flagged; exported experiments import only after a preview and confirmation, as a new experiment, relabelled user-imported; reports separate Observed results / Interpretation / Limitations / Next experiment (the last derived from what is weak in that record). **Not done: blinded review of subjective outputs.**

**Real-world transfer (Priority 4).** `/transfer`: plan (problem, current and proposed workflow, expected benefit, verification criteria, risks), what happened (observations, evidence notes), reflect (reflection, next improvement), Markdown export. Guidance is placeholder-only. Complete needs criteria + observations + evidence + reflection; completion is the learner's declaration and changes no level. Six kinds (prompt technique, Skill, automation, agent workflow, research procedure, game-dev workflow) plus other. Starts from any lesson's Apply tab. A completed playbook-sourced task can add a self-reported real-work result to the playbook. `docs/REAL_WORLD_PILOT.md` is a **protocol** for one real Skill Improvement Loop, one real playbook and one non-game evaluation; **no pilot has been run**.

**Living knowledge (Priority 5).** The four blocked hosts were refused by the session's network allowlist (HTTP 403 on CONNECT, not the sites). They were allowed with the user's approval (plus `aistudio.google.com`, where ai.google.dev redirects), and eight pages were read and added to the catalog: MCP introduction, specification landing page, security best practices; OWASP 2025 Top 10 listing and LLM01 Prompt Injection; Gemini function calling and structured outputs; OpenAI Agents SDK documentation. The registry now has 36 pages, all `read`. Each entry lists what was not read. The source-check job was hardened: curated public https only, ≤ 100 sources, 1 req/s, ≤ 2 MB per response, off-host redirects flagged, and a **two-job workflow** (read-only fetch; then a write-permitted job that validates the artifact's shape and opens a *draft* PR). It never promotes a source.

## 4. Verification

`npm run verify` exited **0** on commit `0f200ee` in one clean run (2026-11-05, Linux, Chromium only): **ESLint clean · `tsc --noEmit` clean · Vitest 485 passed (35 files) · production build OK · Playwright 100 passed (about 10 min)**. GitHub Actions `verify` on the same commit: see the PR (#2) for the run; a run on the earlier commit `346e0c2` failed with the same six tests the full local run had failed (details below), which `0f200ee` fixes.

How the full browser suite earned its keep: the first complete Round 4 run (94 passed, 6 failed) found, on CI and locally, two **real defects** and four stale expectations:
- *Real:* the "required before" recommendation bonus grew with the number of dependent lessons, so after Lesson 1 the Mission Control recommended Context Engineering (L12, a prerequisite of many new lessons) instead of "Inside SKILL.md". Capped at three dependents; a unit test now fails without the cap.
- *Real:* the playbook editor briefly flipped back to the previously stored copy after a save, which could mangle text typed during that moment. It now follows the stored copy only when that copy is newer than the draft (same fix in the transfer editor).
- *Stale expectations:* catalog size 30 → 38 (two tests), the new `sd` figure in the comparison text, and a `getByText('Saved')` selector that now also matched the evidence panel's "no summaries saved yet".
- One of my own new tests read a playbook id from the URL before the editor had opened; fixed by waiting for the editor.

What the Round 4 tests prove, beyond Rounds 1-3:
- *Lessons L19-L24*: every option explains itself, a perfect answer to every non-external item is graded correct and a blank/wrong one is not, assessments differ from practice and review items, sources are verified pages, the external check for L23 accepts only a real, repeated, baselined experiment, the retrieval fixture is deterministic and rejects stale/contradictory/irrelevant passages, the recommender names a lesson with a reason, and the foundation diagnostic stays at 17 questions.
- *Playbook evidence* (26 unit tests + 3 browser flows): fingerprints change with meaning, not with notes; a link proves nothing until criteria, a judgement with a note, limitations and suitable evidence exist; stale links are ignored, cannot be judged, and reassessing keeps the old judgement in history; the synthetic demo never supports a step; maturity cannot reach "evaluated on fixtures" without every gated step supported and "applied to real work" never replaces it; a draft opened before a link was made cannot erase it; evaluation summaries are frozen and versioned; imports carry no evidence; a real v5 database with an R3-shaped playbook migrates to v6 with its verifications intact; none of this creates competency evidence.
- *AI Lab* (15 unit tests + 3 browser flows): failed and abandoned attempts are counted, validity notes appear for mixed versions/contexts, no p-values appear, "all tests pass" is never a measurement and contradictions are flagged, hostile text is inert and fast to analyse, exported records import only as new experiments with user-imported provenance, older records import with safe defaults.
- *Transfer tasks* (9 unit tests + 2 browser flows): a plan is never complete, guidance is placeholder-only, Markdown export has every section, completion creates no competency evidence, older backups import.
- *Sources* (11 unit tests): only curated public https URLs are fetched, responses are read with a cap, changes are reported not applied, the handed-over file is shape-validated, and the workflow's fetch job holds no write permission.
- *Accessibility and layout*: axe (serious/critical) on the new routes, lesson stages L19-L24 in both themes, the evidence panel with stale and review states open, the transfer editor and the import error, plus no horizontal overflow at 375 and 1280 px.


## 5. NOT verified / known limitations

- **GitHub Actions:** the Round 4 branch has been pushed and CI confirmed only as stated in the final report for the head commit; `deploy.yml` and `source-check.yml` have **never run** on GitHub. GitHub Pages must be enabled by hand (Settings → Pages → Source: GitHub Actions) or the deploy workflow fails. The source-check workflow needs "Allow GitHub Actions to create and approve pull requests" to open its PR.
- `scripts/check-sources.mjs` was run **locally** in this session. Node's `fetch` here bypasses the session proxy, so the five newly allowed hosts failed DNS and were reported `BROKEN`; that is an artifact of this sandbox, not a finding about the sites.
- **No real project, real Claude Code session or real device was used.** Playbook evidence, transfer tasks, the Lab additions and L19–L24 are authored by Forge and exercised by unit and browser tests only. The pilot protocol is unrun.
- **Blinded rubric scoring was not built.** Transcript import was not built (exported records and pasted text only).
- The retrieval fixture is deterministic BM25 over fictional text. It says nothing about embeddings, reranking or a model's behaviour.
- Evidence "suitability" and "maturity" are rules over what the learner recorded. They cannot make a self-reported number true.
- The OWASP Top 10 entry rests on teaser text of the listing page; the MCP security page was read closely in five sections and by heading elsewhere; Gemini structured outputs was read only at its introduction and first example. Catalog facts come from an automated fetch-and-summarise step and, for the Round 4 pages, a fetch converted to text; release names, commit dates, licences and pricing are unknown.
- `fields` answers are keyword-checked: they can be gamed by listing the expected words and cannot judge writing quality; each is paired with a self-assessed `reflect` rubric.
- **Not verified:** WebKit/Safari, Windows, a real iPhone, GitHub Pages deployment. Only Chromium on Linux (including phone-width emulation) was tested locally. Round 1–3 limitations still apply: the Improvement Loop's ground truth is synthetic; the Trigger Dojo overlap meter is lexical; ZIP import limits are conservative guesses; progress does not sync between devices.

## 6. Conventions for continuing

- Run `npm run verify` (lint → typecheck → vitest → build → playwright) before claiming anything passes. Do not claim unrun tests passed. CI results belong to the pushed head commit only.
- Changing grading content ⇒ bump that lesson's `version`. Every choice option needs a `why` (≥ 12 chars; ≥ 9 for misconception correctives). Assessment items must differ from practice and review items.
- A `fields` item needs a `reflect` rubric beside it. Fabricated material uses `.example` domains.
- Evidence rules live in `domain/playbook/evidence.ts` and are covered by `tests/unit/playbook-evidence.test.ts`; change them with tests. Evidence is written only through the repo functions (`linkExperimentToStep`, `reviewEvidenceLink`, `reassessEvidenceLink`, `unlinkEvidence`, `saveEvaluation`); `savePlaybook` deliberately ignores a draft's evidence.
- Changing which fields of a step or experiment matter to evidence changes the fingerprints and will make existing links stale; do that deliberately.
- Catalog edits: keep unknowns null; set `verifiedAt` + an honest `verificationMethod`; every sourced entry's URL must be in `sources/registry.json`; `capabilityIds` must exist on the map; never reproduce an install command found on a third-party page without reading what it does. Never auto-promote newly found tools.
- Never `await` a non-Dexie promise (WebCrypto, fetch, `File.text()`) inside a Dexie transaction, and list every touched table in the scope.
- Keep the dependency list small; prefer pinned versions via the lockfile.

## 7. Next three priorities

1. **Run the pilot** ([REAL_WORLD_PILOT.md](REAL_WORLD_PILOT.md)) and fix what it shows; then run `source-check.yml` once and enable GitHub Pages. Nothing about Round 3–4 workflows is known to help on real work until this happens.
2. **Blinded rubric scoring and transcript import** for the Lab (same preview/label rules as the Round 4 importer).
3. **Non-game fixtures and the remaining planned topics** (34 are still planned): task-type templates with objective checks (extraction, triage, review comments), then hooks/guardrails as gates and agent permission design.

(Earlier candidates still open: screenshot regression, a "what changed" notice when lesson versions bump, running the optional WebKit smoke project somewhere it can install.)
