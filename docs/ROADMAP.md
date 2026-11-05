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
