# Visual assets

Nine original SVG illustrations (supplied as `claude-forge-assets.zip`, no text, no third-party fonts or icon packs) live in `public/assets/forge/`. They are **decorative only**: every `<img>` has `alt=""` and `aria-hidden="true"`, the heading next to each carries the meaning, and the app is complete without them (an image that fails to load removes itself).

| File | Used on | How |
|---|---|---|
| `hero-forge.svg` | First-time welcome (onboarding), never on the profile-edit view; and the Mission Control (Home) header from Round 5 | Onboarding: hero, 160 px tall on phones, 256 px from 640 px up, cropped with `object-fit: cover`. Mission Control: `PageHeader art`, hidden below 768 px |
| `academy.svg` | Academy (Learn) header | `PageHeader art`, hidden below 768 px |
| `discovery.svg` | AI Capability Map (Explore) header | `PageHeader art`, hidden below 768 px |
| `battle-lab.svg` | AI Lab landing header and the First experiment (guided pilot) header | `PageHeader art`, hidden below 768 px |
| `workflows.svg` | Workflow Playbooks header | `PageHeader art`, hidden below 768 px |
| `agents.svg`, `game-dev.svg`, `research.svg` | The Agents, Game development and Research track headings in the Academy | 160 px thumbnail, hidden below 768 px. Art says nothing about availability: a planned track still says "planned" in text |
| `background-contours.svg` | A faint texture behind the top of every page in the **dark theme only** (9 % opacity, fades out downward, hidden in the light theme and in print) | CSS class `forge-contours` in `Shell` |

Not used: the Discovery Hub catalog page, experiment/lesson/playbook editor pages and all cards. Pages that are dense with data or controls stay free of art on purpose.

## Implementation notes

- `src/components/ui/Illustration.tsx` builds the URL from `import.meta.env.BASE_URL`, so it works at a domain root, under a GitHub Pages project path, or from any static host (`base: './'`).
- Images are `loading="lazy"` and `decoding="async"`. Because small screens hide most of them with `display: none`, a phone does not download them.
- No animation, so `prefers-reduced-motion` needs nothing special.
- The service worker precaches `public/assets/forge/*.svg` (see `scripts/sw-plugin.ts`) so the art also appears offline.
- Each SVG has an opaque dark panel with rounded corners baked in. In the light theme it therefore appears as a dark framed picture; a 1 px token-coloured border ties it to the page. Text is never drawn over an illustration.
- The SVGs were screened as untrusted data before use: no `<script>`, event handlers, `foreignObject`, external `href`/`url()` references, `<image>` or `<style>` elements.

## Home art pack (`public/assets/forge-home/`)

Seven decorative SVGs (no text, scripts or external references): `hero-forge-wide`, `track-ai-engineering`, `track-game-development`, `track-agents-automation`, `track-research`, `track-ai-lab`, `background-contours`. Rendered by `HomeImage` (alt="", aria-hidden, lazy, hidden below `md`), precached by `scripts/sw-plugin.ts`. Meaning is never carried by the art.
