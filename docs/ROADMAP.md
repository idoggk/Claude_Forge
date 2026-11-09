# Roadmap

Deliberately **not** in this release: accounts, cloud sync, community features, real Claude API execution, autonomous Skill installation, an agent-orchestration backend, a code IDE, marketplace publishing, large-scale crawling.

## V1 (prioritized)

1. **Source-check workflow.** A scheduled GitHub Action that checks only the curated repositories: availability, latest commit and release, licence-file changes, broken links, documentation diffs. Findings land in a **review queue** (an issue or a PR against `entries.ts`); nothing is auto-promoted.
2. **Per-Skill inspection records.** Clone-and-read tooling that records the hash of each reviewed `SKILL.md` and script, replacing "repository page read" with "file content inspected" where true.
3. **More lessons per track.** Prompt-injection hunt and `allowed-tools` auditing (B), architecture review (D), git-worktree workflows and hooks as gates (E). Lessons for the three new loop missions (performance investigation, determinism, integration auditing) so the loop's prerequisites are taught, not just linked.
4. **Transcript import for live tests.** Accept a Claude Code transcript/JSON and extract Skill tool calls as *user-imported* evidence for trigger tests and experiments.
5. **Blinded rubric scoring.** Hide condition labels while scoring so rubric judgements aren't influenced by which run is which.
6. **Tune the review ladder with real data** once there are enough attempts, keeping it explicit and testable.
7. **Tooling.** Screenshot regression tests, pin GitHub Actions to commit SHAs, actually run the optional WebKit smoke project somewhere it can be installed.
8. **Loop depth.** Repeat runs per case (a run count above one) with a variance display; a second held-out set per mission; transcript import so verdicts and checklist ticks can be user-imported rather than hand-entered; a Skill-to-experiment link so the maturity ladder can credit Battle Lab comparisons, not only graduated loops.

## After Round 3 (the next three priorities)

1. **Close the research gaps.** Run `scripts/check-sources.mjs` from a network that can reach `modelcontextprotocol.io`, `openai.github.io`, `genai.owasp.org` and `ai.google.dev`; read them; add catalog entries (a Gemini/Google entry, an OWASP LLM-risk entry, the MCP documentation) and a prompt-injection lesson for the Safety track. The registry already marks them unreachable so no claim leaks in.
2. **Teach the planned tracks that matter most.** The twelve tracks exist; many topics are marked planned. Highest value first: structured outputs and tool calling (Track 1), few-shot examples and prompt-injection awareness (Track 2), RAG and evaluation harnesses (Track 12). Each needs a real lesson with an independent assessment before it can leave "planned".
3. **Make playbooks and the Lab talk to each other.** Link a playbook to an AI Lab experiment ("this workflow versus one big prompt") so a step can be marked verified *from* recorded runs; add transcript import so run data can be user-imported rather than typed.

Still deliberately out: accounts, sync, executing playbooks, real Claude API calls, auto-installing anything.

## After Round 4 (the next three priorities)

1. **Run the pilot and fix what it shows.** Follow [REAL_WORLD_PILOT.md](REAL_WORLD_PILOT.md): one real Skill Improvement Loop, one real playbook with evidence, one non-game evaluation. Until this has happened, nothing about Round 3-4 workflows is known to help on real work. Run `source-check.yml` once (enable "Allow GitHub Actions to create and approve pull requests" first) and review the draft PR; enable GitHub Pages.
2. **Blinded rubric scoring and transcript import.** Hide condition labels while scoring subjective outputs; accept a Claude Code transcript as user-imported run evidence (preview and confirmation, same labels). The Round 4 importer handles exported records and pasted text only.
3. **Teach the next planned tracks and non-game fixtures.** 34 topics are still planned. The AI Lab fixtures are game-development files; add task-type templates and fixtures with objective checks for non-game work (extraction, triage, code review comments), then lessons for guardrails/hooks as gates and agent permission design.

Round 4 items from earlier lists that are now done: connecting playbooks and the Lab; structured-outputs/tool-calling, few-shot, prompt-injection, RAG and evaluation-harness lessons; the MCP, OWASP, Gemini and OpenAI documentation entries.


## After Round 5 (the next three priorities)

1. **Fix the multiple-choice length leak** (docs/LEARNING_AUDIT.md): rewrite wrong options lesson by lesson and lower the ratchet in `tests/unit/learning-quality.test.ts`.
2. **Run the pilot** (docs/REAL_WORLD_PILOT.md) with the guided experiment, a blinded review and a saved takeaway, on a real project, and fix what it shows.
3. **Planned topics** (research track, hooks and guardrails, agent permission design) and real-device checks (a phone, Safari) once WebKit CI has run.


## After Round 7 (the next three priorities)

1. **Watch real learners** use sparks and missions (the quality report is the instrument); fix confusing steps; do not trust editorial minute estimates.
2. **Convert more lessons** to missions and add sparks for the remaining planned topics; consider a bridge that lets a passed challenge schedule a review.
3. **Close the earlier open items:** assessment cue (shortest right option), pilot, real-device and live-site checks.


## After Round 6 (the next three priorities)

1. **Close the remaining assessment cue and run the pilot together.** Sharpen the right option in the roughly 110 single-answer items where it is now the shortest, lower the ratchet, and have a real learner take a few assessments and the guided experiment to see what the heuristics cannot.
2. **Verify on real devices and the live site.** Allow the Pages host in the build environment (or check it from a normal browser), check loading, routing, offline behaviour and caching, and test on a real iPhone.
3. **More judgment formats and planned topics.** Extend case and construct items to more existing lessons (the original 24 have few), add a second diagnosis per module, and build the topics still marked planned (fundamentals, engineering, game development, ecosystem, advanced).
