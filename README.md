# Claude Forge — the personal AI mastery academy

Claude Forge is a static, offline-capable learning app that teaches an experienced developer **judgment about AI**: which approach fits a problem (a prompt, a workflow, a Skill, an agent, a tool, a script, conventional software, a person — or nothing), how to give AI the context it needs, why agents fail, how to integrate tools safely, how to build reliable workflows, how to evaluate claims honestly, and how to discover and assess new tools. It started as an academy for Claude Code Skills (still its deepest hands-on track) and uses One More Merge–inspired game-development exercises.

It is built around one loop: **Discover → Understand → Practice → Experiment → Apply → Measure → Master.**
Reading is not mastery, installing a Skill is not mastery, and a beautiful UI is not evidence — so the app grades your answers, records what you can demonstrate, and refuses to award levels for simply clicking "used".

- **No backend, no account, no analytics, no API key.** Everything is stored on your device (IndexedDB).
- **Does not run Claude.** Experiments are recorded by hand; every number is labelled self-reported or user-imported and is never presented as verified.
- **Works offline** after the first load (service worker) and on an iPhone (install to Home Screen).

## What is in it

| Area | What you can do |
|---|---|
| **Skill Improvement Loop** | The core exercise (Round 2). Build a Skill for a real game-dev problem, measure it against **no Skill**, revise it from what you saw, then test the revision on **held-out** cases whose ground truth stays hidden until you have recorded every run. Four missions: Economy Balance Reviewer (flagship), Phaser Performance Investigator, Deterministic Merge Simulation Reviewer, Multi-Agent Integration Auditor. Ground truth is computed deterministically from each fixture (simulation, work-counting cost model, perturbation harness, merge policy) - never by an AI and never from FPS. Ends in an exportable Skill Improvement Report. |
| **AI Capability Map** | Round 3. 19 capabilities organised by what you want to achieve ("I want to… automate something repeatable, safely"). Each card gives the deciding question, when it fits, when it does not, the risks, and leads to lessons, catalog entries, playbook templates and AI Lab templates. Save **learning goals** that steer recommendations (they are intentions, never evidence). |
| **Workflow Playbooks** | Round 3 + 4. Design a repeatable AI workflow: inputs, outputs, steps with a verification gate and failure handling, human approval points, completion criteria. Six seeded exemplars, version history, Markdown + JSON export, safe import (other people's "verified" claims are reset). A playbook is a design: Forge never runs it. **Round 4:** create or link an AI Lab experiment from a step, write acceptance criteria *before* judging, record your judgement, and see a computed **evidence maturity** (Draft → Ready to test → Partially evaluated → Evaluated on fixtures → Applied to real work). Linking proves nothing; evidence goes stale when the step or experiment changes; "evaluated on fixtures" is not "works on real work"; versioned **evaluation summaries** export as Markdown. |
| **Real-world transfer** | Round 4. Take one thing you learned (a prompt technique, Skill, automation, agent workflow, research procedure or game-dev workflow) to real work: plan, check you can run, observations, evidence notes, reflection, Markdown export. Never complete because a plan exists, never read your project, never changes a competency level. A protocol for a first real pilot is in [docs/REAL_WORLD_PILOT.md](docs/REAL_WORLD_PILOT.md); it has **not** been run. |
| **AI Opportunity Finder** | Round 3. Twelve invented scenarios asking which approach fits — including conventional software, a person, or doing nothing. Practice runs shape recommendations and never raise a level. |
| **Mission Control** | See the single next mission, *why* it was chosen (deterministic, explainable rule), due reviews, competency levels, recent experiments. |
| **Academy** | **12 tracks** (honestly marked available vs planned), **24 authored lessons** (the original ten, eight Round 3 lessons: Choose the Right AI Approach · Context Engineering · Why AI Agents Fail · MCP or Not? · Build a Reliable AI Workflow · AI Evaluation Fundamentals · Efficient AI-Assisted Development · Discover and Evaluate an AI Tool; and six Round 4 advanced lessons: Structured Outputs and Tool Calling · Few-Shot Prompting · Prompt Injection and Trust Boundaries · Retrieval-Augmented Generation (with a deterministic retrieval fixture) · Designing AI Evaluation Harnesses · Context Engineering for Long-Running Agents), prediction-before-explanation, structured written answers checked deterministically, a **Personal AI Mastery Profile** over 13 areas, and the original structure: (learn → guided practice → independent assessment → apply), a **placement diagnostic** (a hint, never a level), **9-question review pools** with mistake-focused, difficulty-paced and interleaved spaced reviews, and authored **misconception feedback** (why it is tempting, why it fails, contrast example, corrective question). Graded exercises: choice, multi-select, classification, ordering, numeric, keyword short-answer, line-flagging, self-assessment, and checks verified against your saved Workshop / Battle Lab work. Every wrong option is explained. |
| **Discovery Hub** | 38 curated entries across ten entity types (Skills, plugins, MCP servers, agent frameworks, an AI coding tool, models, an automation tool, techniques, workflow patterns, developer integrations; 35 source-read, 3 proposed custom Skills), plus a **source registry** of 36 pages, each with how and when it was read. Search, filters, provenance, unknown-stays-unknown, quoted install commands with their source, and Arsenal controls. |
| **Skill Workshop** | Guided SKILL.md authoring, portable-vs-Claude-Code field split, validation (YAML, name rules, description quality, contradictions, missing references, secrets, suspicious patterns), Trigger Dojo, **trigger tuning** (expected vs your recorded live results, FP/FN, stale-wording detection), **quality review** with an evidence-only maturity ladder (never ticks *field-proven*), **version compare** (line diff), manual live-test log, revision snapshots, safe ZIP export, and **safe inert ZIP import** (path/symlink/bomb/binary checks; scripts stay text; nothing runs). |
| **AI Lab** | Controlled two-or-more-condition experiments for Skills, **prompts, workflows, agent setups, tool configurations and models** (you supply the results; Forge runs nothing), six templates, with fixtures + hashes, evidence with provenance, locked rubric, comparison that keeps **unknown ≠ 0**, sufficiency verdicts, JSON + Markdown export, and a clearly labelled **synthetic** demo. **Round 4:** failed and abandoned attempts are kept and counted; per-run Skill/fixture versions and execution context are compared and flagged when they differ; spread (sample SD) beside n and range, never a significance claim; pasted output is analysed with labels (**Parsed / Inferred**) so "all tests pass" is never a measurement; exported experiments import only after a preview and confirmation, relabelled *user-imported*; reports separate **Observed results / Interpretation / Limitations / Next experiment**. |
| **Arsenal & Growth** | Adoption states with separate *inspected / approved / installed (declared)* facts, competency levels with evidence, spaced-review queue, assessment history, confidence calibration, field evidence. |
| **Game-dev fixtures** | (1) merge-cascade bug in TypeScript (real, seeded, verified), (2) economy-inflation simulation, (3) multi-agent review failure, plus the Round-2 mission fixtures: Shardfall economy proposals, Embergate cost-model scenes, a seeded merge simulation with a determinism harness, and fabricated integration packets. Dev and held-out packs are separate ZIPs with a SHA-256 manifest and contain **no answers**. |

## Quick start (Windows)

1. Install **Node.js 22 LTS (22.12 or newer)** from <https://nodejs.org> (this includes `npm`). Check: `node -v`.
2. Open **PowerShell** or **Windows Terminal** in the project folder:

```powershell
npm install
npm run dev
```

3. Open <http://localhost:5173>.

Other commands:

```powershell
npm test                      # unit + component tests (Vitest)
npm run typecheck             # strict TypeScript
npm run build                 # typecheck + production build into dist/
npm run preview               # serve dist/ at http://127.0.0.1:4173
npx playwright install chromium   # once, to download a browser for e2e tests
npm run test:e2e              # end-to-end tests (builds and serves the app itself)
npm run verify                # everything above, in order
```

> On Windows the e2e config uses Playwright's own Chromium. In locked-down containers you can point `PW_CHROMIUM_PATH` at an existing Chromium binary.

## Use it on your iPhone

Offline mode and Home Screen install need **HTTPS**, so deploy to GitHub Pages (below), open the URL in **Safari**, then Share → **Add to Home Screen**. Progress lives on that device only — use **Settings → Export backup** to move or protect it. Safari can clear site data for sites that go unused for a long time, so export a backup every so often.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (default branch `main`).
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` typechecks, tests, builds and publishes `dist/`. Your site appears at `https://<user>.github.io/<repo>/`.

Any static host works: upload `dist/`. The build uses relative asset URLs (`base: './'`) and hash routing (`#/academy`), so no rewrite rules are needed and a project sub-path is fine. `.github/workflows/ci.yml` runs the full suite (including Playwright) on pull requests. For stricter supply-chain hygiene, pin the workflow actions to commit SHAs.

## Project layout

```
src/
  app/            shell, router, providers (data, theme), error boundary
  features/       academy · mission · loop · explore · playbooks (+ evidence panel) · transfer · discovery · workshop · battle-lab (the AI Lab) · arsenal · growth · settings · search
  domain/         pure, tested logic: curriculum types, assessment (grading, calibration, external checks),
                  mastery (competency, review scheduler, recommender), skills (generate/validate/export/trigger),
                  experiments (compare/report/test-report import), loop (engine, report), catalog (schema, search)
  content/        lessons (typed TS data), misconceptions, diagnostic, loop missions, catalog entries (validated snapshot),
                  capability map, playbook seeds, lab templates, Opportunity Finder scenarios, source registry
  fixtures/       the three R1 exercises, the four loop-mission fixtures (economy · perf · determinism · integration), the Skill Autopsy sample, pack builder
  persistence/    Dexie database (versioned), zod schemas, repositories, backup/import
  components/ui/  accessible primitives
scripts/          service-worker build plugin · check-sources.mjs + source-check-lib.mjs (optional, read-only)
tests/            unit (Vitest) · e2e (Playwright + axe-core)
docs/             ARCHITECTURE · PRODUCT · CONTENT · ROADMAP
```

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) — the learning model, mastery rules, and how each 30-day outcome maps to a feature.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisions, data model, migrations, security controls, offline design.
- [docs/CONTENT.md](docs/CONTENT.md) — authoring lessons and catalog entries, source-verification procedure, and the verification log.
- [docs/ROADMAP.md](docs/ROADMAP.md) — what is deliberately not in this release.
- [docs/HANDOFF.md](docs/HANDOFF.md) — the current state, what was verified, what was not, and what to do next.

## Round 6 additions

- **Assessment integrity.** The multiple-choice length leak (82% of single-answer items) is down to under 1%, every option has its own explanation, and a biased option shuffle was fixed. `npm run audit:content` reports the measures; see [docs/LEARNING_AUDIT.md](docs/LEARNING_AUDIT.md), including what is not fixed (the right option is now the shortest in 46% of items).
- **New assessment formats.** Decision scenarios and error diagnoses (multi-part cases whose right answers depend on the stated constraints) and structured constructions (a small JSON design checked deterministically, with an unscored self-evaluation rubric).
- **Four new modules (L25 to L28).** Agent permissions and least privilege; hooks, guardrails and deterministic gates; research reliability; real-world AI workflow architecture.
- **Practice that fits you** (`#/practice`): suggestions from confidence against result, hints, independence, repeated mistakes and assessment version, each with why, what it trains, your evidence and what would count as improvement; plus five mixed-topic exercises. Practice never raises a level.
- **Pilot readiness.** A plain "Do this now" line in the guided experiment, a local, optional feedback form (opinion, never evidence), and a human validation checklist in [docs/REAL_WORLD_PILOT.md](docs/REAL_WORLD_PILOT.md).

## Round 6 limitations (read these)

- Nothing was run with a real Claude Code session, a real project or a real device. The pilot is unrun.
- The live GitHub Pages site could not be reached from the build sandbox (the network allowlist blocks the host), so its loading, routing, offline behaviour and PWA caching were not inspected there; only the sub-path build served locally was checked.
- WebKit ran only as an informational CI job on a Linux runner. Real iPhone Safari has not been tested.
- Adaptive suggestions are deterministic rules over the learner's records, not AI personalisation, and they rest on small samples.
- Case and construct items check structure and stated choices, not whether a real design is good.

## Round 5 additions

- **Home** redesigned: a first-time view (what Forge is, one diagnostic or first lesson, four learning paths) and a returning view (status with denominators, continue, review queue, goals, competency count). Art is decorative only.
- **Run your first real AI experiment** (`#/pilot`): eight guided steps over three starters, built on the existing Lab. **Transcript and result import** with a preview, evidence classification, secret warnings and explicit confirmation. **Blinded review** of outputs.
- **Challenges** (`#/challenges`): four non-game problems with computed fixtures: structured extraction, research reliability, agent failure investigation, prompt and context optimisation.
- **Capability pathways** (`#/pathways`): seven routes from learn to save. **My AI library** (`#/library`): takeaways with evidence-gated confidence labels, Markdown and JSON export (database v7).
- **Learning-quality audit**: see [docs/LEARNING_AUDIT.md](docs/LEARNING_AUDIT.md). A multiple-choice length leak was found and is **not fixed**.

## Round 5 limitations (read these)

- No real Claude Code session, project or device was used; no pilot has been run. The challenge fixtures and the context "reader" are deterministic stand-ins, not models.
- The multiple-choice length leak (docs/LEARNING_AUDIT.md) weakens those items as mastery evidence.
- The WebKit smoke test is a CI job (informational); it was not run locally (the download is blocked in the build sandbox) and a green run is not real-iPhone testing.
- Blinded review hides condition names in the interface; the stored mapping is a local file the learner can read.

## Honest limitations

- Claude Forge **cannot** run Claude, install Skills, or verify what is on your machine. Live testing is manual, and the app says so wherever it matters.
- The Trigger Dojo's overlap meter is a **lexical heuristic**, not a prediction of Claude's behaviour.
- Catalog facts were read from pages on **2026-11-05** through an automated fetch-and-summarize step (nothing was cloned or executed). Commit dates and releases were not visible, so they are *unknown*. The Agent Skills specification site was unreachable during authoring, so portable-format name/length rules follow the Claude Code docs and should be re-checked against the spec.
- The catalog is a committed snapshot; it does not update itself. See the roadmap for the planned review-queue workflow.
- Progress does not sync between devices. There is no cloud backup.
- ESLint (recommended + React hooks rules) and strict `tsc` are the static gates (`npm run lint`, `npm run typecheck`). `npm run verify` runs lint, typecheck, unit tests, build and the Playwright suite.
- **Cross-browser:** the e2e suite runs on Chromium only. An optional WebKit smoke project exists (`PW_WEBKIT=1 npx playwright install webkit && npm run test:e2e:webkit`) but WebKit could not be downloaded in the build environment, so it has **never been run**. Nothing has been tested on a real iPhone, on real Windows, or in real Safari.
- **Ground truth in the Improvement Loop is synthetic**: a simulation, a counted-work cost model (not FPS), a perturbation harness over a toy simulation, and a policy applied to fabricated packets. A graduated loop shows a Skill was tested on a fixture - it is *not* "field-proven".
- The Improvement Loop records what *you* read from Claude's answers (self-reported); Forge compares them with ground truth but cannot see the answers.

## Round 4 limitations (read these)

- **Four research hosts were blocked, then allowed.** modelcontextprotocol.io, genai.owasp.org, ai.google.dev and openai.github.io were refused by the session's network allowlist (not by the sites). They were allowed on 2026-11-05 (plus aistudio.google.com, where ai.google.dev redirects), and eight pages were read and added to the catalog. Only landing pages and the sections named in each entry were read; every entry lists what it did not read.
- Round 4 playbook evidence, AI Lab additions, transfer tasks and lessons L19-L24 are **authored by Forge**, tested by unit and browser tests, and **never exercised on a real project**. `docs/REAL_WORLD_PILOT.md` is a protocol, not a result.
- **Blinded review of subjective outputs was not implemented.** Rubric scoring is still unblinded.
- The retrieval fixture is a deterministic BM25 over a fictional corpus. It does **not** simulate embeddings, reranking or a language model, and says so in the lesson.
- `source-check.yml` (now two jobs: read-only fetch, then a validated draft PR) and `scripts/check-sources.mjs` have been run **locally only**, not in GitHub Actions. Opening a PR from a workflow needs a repository setting (see the workflow header). GitHub Pages has to be enabled by hand.
- Evidence "suitability" and maturity are rules Forge applies to what you recorded. They do not make the underlying numbers true.

## Round 3 limitations (read these)

- (Superseded in Round 4: the four research hosts were later allowed and read; see above.)
- Round 3 catalog entries were read from repository and documentation pages on **2026-11-05** through an automated fetch-and-summarise step. Release and last-commit dates were not visible and are *unknown*. Star counts are shown only "as displayed" with a date and never used to rank.
- The optional `source-check.yml` workflow and `scripts/check-sources.mjs` exist but were **not run in GitHub Actions** from this repository. The script's local behaviour is verified only to the extent the unit tests cover the registry it reads.
- The Capability Map, lessons, playbook seeds, Opportunity Finder scenarios and lab templates are **authored by Forge** from the cited sources. They are judgments and designs, not measurements. Nothing was run in Claude Code to test the playbooks.
- Keyword-checked written answers (the new `fields` item) are deliberately narrow: they check that required ideas are present, not that the writing is good. Each such item is paired with a self-assessment rubric.
- WebKit, Windows and iPhone behaviour were **not** verified. GitHub Pages deployment was not verified.
