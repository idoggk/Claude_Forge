# Claude Forge — the personal AI engineering academy

Claude Forge is a static, offline-capable learning app that teaches an experienced developer to **discover, evaluate, write, test and measure Claude Code Skills** — using One More Merge–inspired game-development exercises.

It is built around one loop: **Discover → Understand → Practice → Experiment → Apply → Measure → Master.**
Reading is not mastery, installing a Skill is not mastery, and a beautiful UI is not evidence — so the app grades your answers, records what you can demonstrate, and refuses to award levels for simply clicking "used".

- **No backend, no account, no analytics, no API key.** Everything is stored on your device (IndexedDB).
- **Does not run Claude.** Experiments are recorded by hand; every number is labelled self-reported or user-imported and is never presented as verified.
- **Works offline** after the first load (service worker) and on an iPhone (install to Home Screen).

## What is in it

| Area | What you can do |
|---|---|
| **Skill Improvement Loop** | The core exercise (Round 2). Build a Skill for a real game-dev problem, measure it against **no Skill**, revise it from what you saw, then test the revision on **held-out** cases whose ground truth stays hidden until you have recorded every run. Four missions: Economy Balance Reviewer (flagship), Phaser Performance Investigator, Deterministic Merge Simulation Reviewer, Multi-Agent Integration Auditor. Ground truth is computed deterministically from each fixture (simulation, work-counting cost model, perturbation harness, merge policy) - never by an AI and never from FPS. Ends in an exportable Skill Improvement Report. |
| **Mission Control** | See the single next mission, *why* it was chosen (deterministic, explainable rule), due reviews, competency levels, recent experiments. |
| **Academy** | 5 tracks, **10 authored lessons** (learn → guided practice → independent assessment → apply), a **placement diagnostic** (a hint, never a level), **9-question review pools** with mistake-focused, difficulty-paced and interleaved spaced reviews, and authored **misconception feedback** (why it is tempting, why it fails, contrast example, corrective question). Graded exercises: choice, multi-select, classification, ordering, numeric, keyword short-answer, line-flagging, self-assessment, and checks verified against your saved Workshop / Battle Lab work. Every wrong option is explained. |
| **Discovery Hub** | 11 curated entries (8 source-read, 3 proposed custom Skills). Search, filters, provenance, unknown-stays-unknown, quoted install commands with their source, and Arsenal controls. |
| **Skill Workshop** | Guided SKILL.md authoring, portable-vs-Claude-Code field split, validation (YAML, name rules, description quality, contradictions, missing references, secrets, suspicious patterns), Trigger Dojo, **trigger tuning** (expected vs your recorded live results, FP/FN, stale-wording detection), **quality review** with an evidence-only maturity ladder (never ticks *field-proven*), **version compare** (line diff), manual live-test log, revision snapshots, safe ZIP export, and **safe inert ZIP import** (path/symlink/bomb/binary checks; scripts stay text; nothing runs). |
| **Battle Lab** | Controlled two-or-more-condition experiments with fixtures + hashes, evidence with provenance, locked rubric, comparison that keeps **unknown ≠ 0**, sufficiency verdicts, JSON + Markdown export, and a clearly labelled **synthetic** demo. |
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
  features/       academy · mission · loop · discovery · workshop · battle-lab · arsenal · growth · settings · search
  domain/         pure, tested logic: curriculum types, assessment (grading, calibration, external checks),
                  mastery (competency, review scheduler, recommender), skills (generate/validate/export/trigger),
                  experiments (compare/report/test-report import), loop (engine, report), catalog (schema, search)
  content/        lessons (typed TS data), misconceptions, diagnostic, loop missions, catalog entries (validated snapshot)
  fixtures/       the three R1 exercises, the four loop-mission fixtures (economy · perf · determinism · integration), the Skill Autopsy sample, pack builder
  persistence/    Dexie database (versioned), zod schemas, repositories, backup/import
  components/ui/  accessible primitives
scripts/          service-worker build plugin
tests/            unit (Vitest) · e2e (Playwright + axe-core)
docs/             ARCHITECTURE · PRODUCT · CONTENT · ROADMAP
```

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) — the learning model, mastery rules, and how each 30-day outcome maps to a feature.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — decisions, data model, migrations, security controls, offline design.
- [docs/CONTENT.md](docs/CONTENT.md) — authoring lessons and catalog entries, source-verification procedure, and the verification log.
- [docs/ROADMAP.md](docs/ROADMAP.md) — what is deliberately not in this release.

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
