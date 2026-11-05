# Architecture

## Principles

Static-first · offline-capable · no backend, account, paid API or analytics · feature-based folders · domain logic separated from presentation · typed content · deterministic grading · testable functions · accessible primitives · minimal operational complexity.

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router 7 (hash routing) · Dexie 4 (IndexedDB) · Zod 4 · yaml · JSZip · react-markdown · Vitest + Testing Library + fake-indexeddb · Playwright + axe-core.

Deliberately **not** used: a UI kit (small accessible primitives instead), `vite-plugin-pwa` (its workbox toolchain pulled in six audit findings; replaced by a ~40-line build-time service-worker plugin — `scripts/sw-plugin.ts`), a state-management library (state lives in IndexedDB and is read through live queries), and any runtime network dependency.

## Layers

```
domain/       pure functions + types. No React, no IndexedDB. Everything here is unit-tested.
persistence/  Dexie tables, zod schemas, repositories (transactions), backup/import.
content/      lessons and catalog as typed data, validated at import and by tests.
fixtures/     original training exercises; plain TS so they can also be exported as runnable packs.
features/     React screens per product area.
components/   accessible UI primitives.
```

`useLive()` wraps Dexie's `liveQuery`, so every screen re-renders from persisted state. Progress bars and levels are *derived from stored evidence*, never from component state.

## The Skill Improvement Loop

```
content/missions/*        a mission = problem, starter Skill, dev + held-out cases, checklist, labels, verdict options, truth()
fixtures/<mission>/*      pure TS that BOTH the app (ground truth) and the downloadable pack (raw source) use
domain/loop/engine.ts     step state DERIVED from recorded data (never from clicks), gates, grading, failure signals
domain/loop/report.ts     Markdown + JSON Skill Improvement Report (honest by construction)
persistence/loopRepo.ts   transactional start / freeze v1 / record run / grade / save v2 / reveal+lock / graduate
features/loop/*           hub, stepper, eight step components, case runner
```

Design rules that the tests enforce: a loop is **two real Battle Lab experiments** (development and held-out) linked by `loopId`; every run is one (case x condition) with a **self-reported** answer that Forge grades against ground truth computed from the fixture; held-out truth is hidden until every held-out run is recorded and is then **locked** (later edits are refused); v1 and v2 are frozen revision snapshots, so later Workshop edits cannot change what was tested (and the report flags a final Skill that differs from v2); packs contain no answers or reference solutions; dev and held-out use different fixtures with different hashes; unknown metrics stay `null`, never 0. Ground truth per mission: the economy **simulator** with published design targets; a **work-counting cost model** (never FPS); a **perturbation harness** (global `Math.random`, `Date.now`, input arrival order) over a toy merge simulation; a **merge policy** applied to fabricated packets.

## Review planning and the diagnostic

`domain/mastery/reviewPlan.ts` builds each spaced-review session deterministically: a misconception-focused slot, a mistake-focused slot, difficulty by Leitner box, rotation away from the previous session, and one interleaved item from a different passed lesson. `submitReview` records the exact item ids shown and accepts only items from some lesson's separate review pool. The placement diagnostic writes only to `diagnostics`: it cannot create an attempt, review or competency change. Answer options are shown in a per-attempt order; grading is by option id.

## Routing and hosting

Hash routing + `base: './'` means the same build works at a domain root, under `/<repo>/` on GitHub Pages, or from any static folder, with no rewrite rules. Feature areas are lazy-loaded.

## Data model (IndexedDB `claude-forge`, schema version 4)

`profile · preferences · lessonProgress · attempts · competencies · reviews · annotations · arsenal · customSkills · experiments · evidence · fieldEvidence (v2) · loops (v3) · diagnostics (v4) · meta`

- **Versioning.** `src/persistence/db.ts` declares explicit versions. v2 added `fieldEvidence` and an upgrade that backfills `independent`, `unseen` and `conceptResults` on v1 attempts — no record is dropped. The migration is tested by creating a real v1 database and opening it with the v2 class (`tests/unit/persistence.test.ts`).
- **v3** adds `loops` and backfills `loopId / phase / runsLockedAt` on experiments and `caseId / verdict / gradedTruth / skillActivated` on runs with `null` (additive; tested from a real v2 database). **v4** adds `diagnostics` (additive; tested from a real v3 database). Both are in the backup schema; older backups without those sections still import.
- **Attempts are append-only** and carry the lesson version, hints used, confidence, per-item results and per-concept results, so competency can be recomputed from history at any time.
- **Competency records** are a cache of `evaluateCompetencies()` plus a change history; they are recomputed inside the same transaction as the attempt write.
- **Idempotency.** `submitAttempt` is a single transaction that returns the existing attempt when the ID already exists.

### Backup and import (`persistence/backup.ts`)

Versioned JSON envelope (`claude-forge-backup`, v1). Import is **parse → validate → preview → apply**:

1. Size-capped `JSON.parse`; envelope checked (format, version — newer versions are refused).
2. Every record is checked against its zod schema. Invalid records are listed, never silently dropped.
3. Nothing is written until the user confirms. A backup of current data is downloaded first.
4. The write is one IndexedDB transaction across all stores: **all or nothing** (tested with a deliberately unwritable record).
5. *Merge* keeps local attempts, profile and newer records; *Replace* swaps everything.

## Security controls

| Threat | Control |
|---|---|
| Prompt injection / hostile text in catalog or imports | Content is data. Markdown is rendered without raw HTML, images are dropped, only `https:` links are active (`rel="noopener noreferrer nofollow"`, `target=_blank`). Tested with hostile payloads. |
| XSS via user-entered text | React text rendering everywhere; no `dangerouslySetInnerHTML`; component and e2e tests assert injected markup stays text. |
| Dangerous Skill scripts | Never executed, fetched or evaluated. Samples and imports are inert text. Exported scripts get no exec bit and a warning. |
| Malicious or malformed import files | Size cap, JSON-only parsing, schema validation, preview, atomic write, version gate. YAML is parsed with the core schema, bounded aliases and wrapped in try/catch (an alias-bomb test found and fixed a crash). |
| Path traversal in Skill export | `validateResourcePath()` rejects `..`, absolute, drive-letter, `~`, backslash, encoded, hidden, reserved-name, deep or non-text paths; the ZIP builder re-validates every path and refuses invalid drafts. |
| Secret exposure | Secret-shaped strings in a Skill or its files are an export-blocking *error*. No API keys exist in the client; the app never asks for one. |
| Misleading source authority | Tiers (official / community / candidate / custom), per-field provenance, verification date + method, `unknown` rather than guessed values, popularity shown only as an "observed signal" with a warning. |
| Confusing trust states | *Inspected*, *approved* and *installed (declared)* are separate switches; "installed" is never claimed verified. |
| Hostile Skill ZIPs (Workshop import) | `domain/skills/importZip.ts` reads the archive as data only: size / entry / ratio / total caps checked from declared sizes before decompression, symlinks and traversal refused, binaries skipped, strict UTF-8, scripts kept as inert text and scanned, nothing executed, installed or written to disk. A draft is created only after the learner confirms; refusals are listed. |
| Third-party dependencies | Few, pinned by lockfile; `npm audit` clean at build time. No runtime CDN. |
| Unsafe browser tool permissions | The app requests none (no camera, location, clipboard-read, etc.). Clipboard *write* is used only for the Copy button and fails visibly if blocked. |

Security checks inside the Workshop are **advisory**: a pattern scan cannot prove a Skill is safe, and the UI says so.

## Offline

`scripts/sw-plugin.ts` emits `sw.js` at build time: it precaches every emitted asset (cache name = content hash, so a new build replaces the old cache), serves same-origin GETs cache-first, and falls back to the cached shell for navigations. It matches with `ignoreVary` because some static hosts send `Vary: Origin`, which otherwise makes module scripts miss the cache (found by the offline e2e test). Service workers need HTTPS or localhost.

## Accessibility and responsiveness

Skip link and focus management on route change; real `<label>`s, `fieldset/legend`, `role=tablist` with arrow-key support, visible focus rings, reduced-motion support (system or in-app), dark default + accessible light theme, safe-area padding, 44px touch targets in primary navigation. Playwright runs axe-core (WCAG 2.0/2.1 A/AA) on all primary routes, lesson stages and editors in both themes, and asserts no horizontal overflow at 375, 390, 768, 1280 and 1440 px.

## Testing strategy

- **Unit / integration (Vitest, 334 tests):** grading, competency, scheduler, recommender, calibration, fixtures (the seeded bug *fails* before the reference fix and *passes* after), skills (generate/validate/export/trigger), experiments, catalog integrity, content integrity (a perfect answer to every item grades correct; blank answers never do), persistence with fake-indexeddb, import/export, migration.
- **Component (Testing Library + jsdom):** safe Markdown, safe links, item feedback, confirm pattern.
- **End to end (Playwright):** the 28 required scenarios plus responsive, keyboard, offline, security and axe audits, against the production build. No test depends on Claude or a network.
