# Claude Forge — handoff summary (state as of 2026-11-05, after Development Round 2)

Paste this whole document into a new conversation. It describes what exists, what was verified, what is NOT verified, and what to improve next.

## 1. What it is

**Claude Forge** is a static, offline-capable learning app ("personal AI engineering academy") that teaches an experienced developer to discover, evaluate, write, test and measure **Claude Code Skills**, using original One More Merge–inspired game-dev exercises (merge-and-shoot Phaser/TypeScript game; the app never assumes access to the real repo).

Learning loop: Discover → Understand → Practice → Experiment → Apply → Measure → Master.

Hard product rules (must be preserved):
- No backend, account, analytics, paid API or Claude API key. Everything is local (IndexedDB). The app never runs Claude.
- Never present synthetic data as real telemetry or an AI output. Manual metrics are labelled self-reported / user-imported, never "verified".
- Unknown stays unknown (never coerced to 0; no invented URLs, install commands, licences, dates, stats, benchmarks).
- Never execute third-party Skill scripts or user JavaScript. Never install anything. Render third-party text as safe data.
- Mastery only from evidence (unseen assessments, field evidence), never from clicking "used".
- Installed ≠ verified. Inspected, approved, installed(declared) are separate facts.

## 2. Stack and location

React 19, TypeScript 5.9 (strict), Vite 8, Tailwind 4, React Router 7 (hash routing, `base: './'`), Dexie 4 (IndexedDB), Zod 4, `yaml`, JSZip, react-markdown, Vitest 5 + Testing Library + jsdom + fake-indexeddb, Playwright 1.63 + axe-core. Node ≥ 22.12 required (Vitest 5). No ESLint configured (strict `tsc` is the static gate). A custom ~40-line service-worker build plugin (`scripts/sw-plugin.ts`) replaced `vite-plugin-pwa` (its workbox toolchain caused 6 audit findings).

Project: `/home/user/claude-forge` (git-initialised, everything staged, NOT committed, no remote). Source zip was delivered separately. ~12,100 lines in `src`, ~2,800 in `tests`, 132 files.

```
src/app          shell, router, providers (data/theme), error boundary
src/features     academy · mission · onboarding · discovery · workshop · battle-lab · arsenal · growth · settings · search · more
src/domain       pure tested logic: curriculum types, assessment (grade, calibration, external checks),
                 mastery (competency, review, recommend), skills (generate/validate/export/trigger/paths/fields),
                 experiments (model/compare/report/testReport/demo), catalog (schema/search)
src/content      lessons (l01–l10 + review-extra), catalog/entries.ts
src/fixtures     merge-cascade, economy, review (handoff), skill-autopsy, index.ts (pack builder)
src/persistence  db.ts (versioned), schemas.ts (zod), repo.ts (transactions), backup.ts (import/export), useLive.ts
src/components/ui accessible primitives
tests/unit  tests/e2e  docs/  .github/workflows/{deploy,ci}.yml
```
Docs: README, docs/PRODUCT.md (learning model + outcome→feature map), docs/ARCHITECTURE.md (data model, security table), docs/CONTENT.md (authoring rules + source-verification log), docs/ROADMAP.md.

## 3. What was built

**Mission Control** — one primary "next mission" with explainable reasons (deterministic scoring: due reviews first, then curriculum order, prerequisites, failed assessments naming missed concepts, unlocking value, user interests, game relevance). Also active track, review queue, competency bars, recent experiments, Arsenal summary, quick links.

**Academy** — 5 tracks, **10 lessons**: L01 Skill or Tool?; L02 Inside SKILL.md; L03 Trigger Dojo; L04 Skill Autopsy; L05 Your First Custom Skill; L06 Debug a Merge-Chain Failure; L07 Economy Inflation Investigator; L08 The Battle Lab; L09 Reviewer vs Builder; L10 Forge a Production Skill (capstone). Each has problem/why/objectives, ≥3 segments, guided activity (+ interactive widget), independent assessment, failure modes, application + field-evidence prompt, review pool of 5, doc sources. Item types: single, multi, classify, order, numeric (can be computed from fixtures), keyword short-answer, flag-lines, reflect (self-assessed, never scored), external (verified from saved Workshop/Battle Lab data). Every option has a "why". Lesson versions are tracked; old attempts are kept but don't count toward current mastery.

**Mastery rules** — levels 0 Unseen, 1 Recognizes, 2 Guided (≥70% concept score), 3 Independent (≥75% on an unseen hint-free attempt: first assessment attempt on this version or a review-pool item, no missed critical item), 4 Field-proven (L3 + self-reported field evidence). Missed critical item caps at L2 and can be revoked by a later unseen miss. Retakes count as guided. Duplicate submissions are idempotent (attempt ID created on screen open). Confidence (1–5 → ~20/40/60/80/95%) captured before assessments; calibration verdict ±25 points. Spaced review ladder 1/3/7/14 days on local calendar dates; Settings has a visible "clock offset" for testing.

**Discovery Hub** — 11 entries (2 official: anthropics/skills, skill-creator plugin; 5 community: obra/superpowers, getsentry/skills, vercel-labs/agent-skills, microsoft/playwright-mcp, modelcontextprotocol/servers; 1 candidate: anthropics/claude-code repo; 3 proposed custom Skills). Search, filters (tier, type, game relevance, security status, freshness, Arsenal), detail pages with all 12 required sections, provenance, quoted install commands with source URL + caveats, user-added local unverified candidates.

**Skill Workshop** — draft editor (basics, Claude-Code-only vs portable fields, instructions, resources, scenarios + Trigger Dojo drill with lexical overlap meter, validate, preview, manual live-test log, export & revision snapshots, per-Skill Arsenal record). Validator: YAML (core schema, alias-bomb safe), name format, description quality heuristics, listing-cap math, unreachable invocation, unknown/portability fields, contradictions, missing/unused references, secrets (export-blocking), suspicious patterns (pipe-to-shell, rm -rf, injection phrases, secrecy, credential paths, hidden Unicode, hidden HTML comments, network allowed-tools). Safe ZIP export (`<name>/SKILL.md` + text resources; strict path validator). Paste-a-SKILL.md advisory scanner. Test-plan Markdown download.

**Battle Lab** — experiment creation (problem, hypothesis, fixture + SHA-256 manifest hash, success criteria, prompt, environment, conditions with explicit differences, planned measures, runs). Run form with test counts (typed or imported vitest/jest JSON as data), checklist fixtures, measured values (blank = unknown), 4-criterion rubric (locked at first run), pasted/uploaded text evidence with provenance. Comparison: per-measure mean/range/n/unknown, direction-aware, overlap/separated/one-sided readings, rubric subtotal over commonly-recorded criteria only, sufficiency levels (none/anecdotal/weak/limited), integrity notes. JSON + Markdown export. Read-only synthetic demo (clearly labelled), clonable without data. Mobile stacks comparison cards.

**Arsenal & Growth** — statuses interested/evaluating/using/practicing/mastered/rejected/archived; trust flags; usefulness; linked experiments; project relevance; notes; "Mastered" gated on a rating + ≥1 linked experiment. Growth: competency levels with evidence/history/stale-version notes, review queue, calibration history, attempt history, field-evidence form.

**Settings** — theme (dark default, light), motion, export/import with preview + merge/replace + auto pre-import backup, persistence request, delete-everything (typed confirm), time-travel clock, privacy/limitations/sources.

**Fixtures** (original, synthetic, labelled): (1) 5×5 merge-3 board with seeded bug (`pickMergeCells` consumes whole group) — value-conservation invariant, 8 hand-derived cases, seeded playthroughs, 4 candidate patches (1 correct); (2) "Shardfall" economy sim (compound vs linear power coupling; affordability/hoard/sink-coverage metrics; gate-bound surplus ≠ inflation); (3) fabricated Builder/Reviewer/Integrator handoff RB-17 with 7 seeded issues, 4 distractors, 12 gates, ordered steps, verdicts. Packs download as ZIPs with MANIFEST.sha256 and no answer keys.

**Platform** — HashRouter, lazy routes, error boundary, skip link + focus management, Ctrl/Cmd+K search, mobile bottom nav + "More", safe-area padding, reduced motion, offline service worker (`ignoreVary` needed), PWA manifest, GitHub Pages + CI workflows (written, not executed).


### Round 2 additions (implemented and tested)

- **Skill Improvement Loop** (`/loop`, `features/loop`, `domain/loop`, `persistence/loopRepo.ts`, `content/missions`): eight steps (Mission → Baseline → Build → Test → Evaluate → Improve → Held-out → Graduate). Step state is derived from recorded data. v1 and v2 are frozen revision snapshots; held-out truth is hidden until every held-out run is recorded, then the runs are locked. Output: Markdown + JSON Skill Improvement Report and a final Skill ZIP. It reuses Battle Lab experiments (`loopId`, `phase`, `runsLockedAt`; runs gained `caseId`, `verdict`, `gradedTruth`, `skillActivated`).
- **Four missions**, all with dev + held-out packs, a starter Skill that is valid but deliberately imperfect, a five-item checklist, a transfer prompt, and deterministic ground truth: Economy Balance Reviewer (flagship; Shardfall simulator + published design targets), **Phaser Performance Investigator** (Embergate work-counting cost model - counted units, never FPS), **Deterministic Merge Simulation Reviewer** (a toy seeded merge simulation run under perturbed `Math.random` / `Date.now` / input order; trace hashes compared with a golden hash), **Multi-Agent Integration Auditor** (fabricated Builder/Reviewer/CI/main-state packets judged by a published merge policy, including a false alarm).
- **Learning**: placement diagnostic (`/academy/diagnostic`, store `diagnostics`, never touches mastery), review pools of 9 items with difficulty tags, deterministic review planner (mistake-/misconception-focused, difficulty by box, rotation, interleaving) with visible reasons, 16 authored misconceptions with corrective questions, per-attempt option shuffling, recommender uses diagnostic gaps / recent misconceptions / offers the loop once L05 + L07 are passed.
- **Workshop**: version compare (line diff), safe inert ZIP import, trigger tuning (expected vs manually recorded, stale-wording detection, FP/FN only where measured), static quality review with an evidence-only maturity ladder (never ticks field-proven).
- **Tooling**: ESLint (recommended + react-hooks) in `verify` and CI (with an `overrides` pin for a patched `minimatch`, keeping `npm audit` at 0), CI concurrency + explicit build, optional WebKit smoke project (never run - see limitations).

## 4. Verification (final run, after Round 2)

`npm run verify` exited 0 in one clean run: **ESLint clean · `tsc --noEmit` clean · Vitest 334 passed (21 files) · production build OK (main chunk ~118 kB gz, Loop page ~15 kB gz, lazy fixtures chunk ~30 kB gz) · Playwright 73 passed (Chromium, ~6.7 min) · `npm audit`: 0 vulnerabilities.**

What the Round 2 tests prove (beyond the Round 1 suite): per-mission ground-truth margins (verdicts safely away from thresholds), pack CLI output identical to the in-app computation, no answers/causes/held-out material inside any pack, a full loop lifecycle for every registered mission (start → baseline → freeze → test → grade → improve → held-out reveal + lock → graduate → report), migrations v2→v3 and v3→v4 from real older databases, backup round-trips including `loops` and `diagnostics`, hostile-ZIP import cases (traversal, symlink, zip bomb, binary, several Skills, secrets, scripts kept inert), tuning rates only from recorded data with stale/untested rows excluded, the maturity ladder never ticking field-proven, the diagnostic never touching attempts/competencies, review planning (rotation, difficulty by box, mistake/misconception focus, interleaving only from passed lessons), and axe (serious/critical = 0) on the new screens in both themes plus no-horizontal-overflow at 375/390/768/1280.

Real bugs found by Round 2 tests and fixed: a reflection-field save that overwrote text typed in the next field (the Graduate button never enabled); the diagnostic result vanishing because a history-length `key` remounted the runner; the loop auto-jumping away from results you needed to read (now only recording steps auto-advance); a Dexie `Premature commit` from awaiting WebCrypto inside a transaction; the held-out reveal reading a table outside its transaction scope; an unlabeled hidden file input (axe critical); a correct option mistakenly tagged as a misconception; precision reported as 100% with no should-not scenario observed (now unmeasured).

Earlier (Round 1) findings are in git history of this file: onboarding race, assessment results vanishing, service worker `Vary: Origin`, optimistic profile after "delete all", fieldset/select mobile layout.

## 5. NOT verified / known limitations (be honest about these)

- Never tested on a real iPhone, in real Safari/WebKit, or on Windows; only Chromium on Linux (phone-width emulation). **WebKit could not be downloaded in the build environment** (egress blocked), so the optional WebKit smoke project (`PW_WEBKIT=1`, `tests/e2e/smoke-webkit.spec.ts`) has never been run. Windows commands are documented, untried.
- GitHub Actions workflows have never been executed (CI now also runs lint and an explicit build; the deploy workflow was not changed beyond lint). Action versions (checkout@v4, setup-node@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4, upload-artifact@v4) come from memory. Nothing here claims a deployment works.
- **The Improvement Loop's ground truth is synthetic.** Economy: a simulation + published targets. Performance: a work-counting cost model (counted units, never FPS or frame time). Determinism: a toy simulation under four perturbed environments (shows hashes agree in those environments, not in every environment). Integration: a policy applied to fabricated packets. A graduated loop means "tested on a fixture", never "field-proven".
- Loop verdicts, checklist ticks, activation and effort are **self-reported**: Forge cannot see Claude's answers. One run per case and condition (small n); the report says so. Nobody has run a loop with real Claude Code yet, so starter Skills may turn out too easy or too hard; case difficulty is untested on real learners.
- The placement diagnostic has one question per competency: a hint, not a measurement.
- Review planning rules, difficulty tags (1-3) and the 9-item pools are authored judgement, not tuned on real data. Lesson 6's seeded playthroughs are still not very discriminating.
- Catalog facts were read 2026-11-05 via an automated fetch-and-summarize tool (not cloning); no individual SKILL.md, script or LICENSE file inspected; commit dates/releases/stars-as-evidence are unknown or merely "as displayed". The catalog is a committed snapshot.
- `agentskills.io/specification` was unreachable; portable-format limits (name ≤64 lowercase/hyphen, description ≤1024, compatibility ≤500) are not re-verified against the spec.
- Docs-derived claims (Skills frontmatter, `/skills`, `/reload-skills`, listing cap 1,536, etc.) were accurate as read on 2026-11-05 and may drift.
- The Trigger Dojo overlap meter and the tuning suggestions are lexical heuristics, not a model of Claude. Live testing is manual.
- Markdown rendering has no GFM extension, so tables in mission text are not supported (use lists).
- Workshop ZIP import limits (3 MB archive, 300 entries, 200 KB per file, 1.5 MB total, ratio 100) are conservative guesses. JSZip's declared sizes are trusted for pre-checks (JSZip itself verifies the size after decompression).
- Progress does not sync between devices; Safari may evict site data if unused — mitigated only by export/persist request.
- Unused-but-persisted field: `Experiment.skillLinks` (always empty).

## 6. Conventions for continuing

- Run `npm run verify` (lint → typecheck → vitest → build → playwright) before claiming anything passes. Do not claim unrun tests passed.
- Changing grading content ⇒ bump that lesson's `version`. Add an assertion whenever a lesson states a numeric/behavioural fixture claim.
- Every choice option needs a `why` (≥8 chars); assessment items must differ from practice and review items; critical items for safety-critical competencies.
- Catalog edits: keep unknowns null; update `verifiedAt` + honest `verificationMethod`; run catalog tests. Never auto-promote newly found Skills.
- Keep the dependency list small; prefer pinned versions via lockfile.

## 7. Candidate next steps (pick and prioritise)

1. **Run a real loop** with real Claude Code and fix what the data shows (starter Skills too easy/hard, ambiguous cases, checklist wording). Then repeat runs per case with a variance display.
2. Real-device pass: iPhone Safari/WebKit (run the optional smoke project where WebKit installs), touch targets, PWA install; run the workflows on a real repo.
3. Lessons for the three new missions (performance investigation, determinism, integration auditing) so their prerequisites are taught, not just linked.
4. Transcript import so verdicts/checklist ticks/activation can be user-imported instead of hand-entered; blinded rubric scoring.
5. Source-check workflow (scheduled Action, curated repos only, review queue, no auto-promotion); per-Skill inspection records with file hashes.
6. Link Skills to Battle Lab experiments so the maturity ladder can credit comparisons, not only graduated loops.
7. Quality: screenshot regression, more component tests, bundle trimming, a "what changed" notice when lesson versions bump.
