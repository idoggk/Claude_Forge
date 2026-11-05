import { DEFAULT_SCENE, SUBSYSTEMS, UNIT_COST, profileScene, type FrameProfile, type SceneConfig, type Subsystem } from './profiler';

/**
 * Phaser Performance Investigator - seeded scenes.
 *
 * Every scene is a COMPLAINT plus a description of how the (fictional) Embergate scene is built. Ground truth is
 * computed by counting per-frame work with a published cost model (see profiler.ts). It is NOT frame time or FPS: no
 * device is measured and no FPS number is ever claimed anywhere in this fixture.
 *
 * Published rule: a subsystem is "the dominant cost" when it accounts for at least HALF of the counted work units.
 * If no subsystem reaches half, the root cause is "mixed". Tests enforce a safe margin around that threshold.
 */
export type RootCause = Subsystem | 'mixed';
export const DOMINANT_SHARE = 0.5;

export interface Scene {
  id: string;
  phase: 'dev' | 'heldout';
  title: string;
  complaint: string;
  /** What the scene does, in words a designer would use. */
  description: string;
  /** A short, plausible code excerpt. It may contain a red herring on purpose. */
  excerpt: string;
  config: SceneConfig;
}

const c = (o: Partial<SceneConfig>): SceneConfig => ({ ...DEFAULT_SCENE, ...o });

export const DEV_SCENES: Scene[] = [
  {
    id: 'scene-1', phase: 'dev', title: 'Boss fight drops frames when the boss fires',
    complaint: 'Frames dip every time the boss fires its barrage. The designers suspect the 120 enemies are colliding too much.',
    description: '120 enemies, one atlas for all sprites, a grid for collisions. The boss spawns 900 particles per frame during the barrage.',
    excerpt: "update() {\n  for (let i = 0; i < 900; i++) {\n    const dir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)); // new object\n    const box = new Phaser.Geom.Rectangle(x, y, 4, 4);            // new object\n    this.spawn(dir, box);\n  }\n}",
    config: c({ seed: 11, entities: 120, broadphase: 'grid', cellSize: 100, particlesPerFrame: 900, allocPerParticle: 2, textures: 6, atlasPacked: true }),
  },
  {
    id: 'scene-2', phase: 'dev', title: 'Crowd level slows down past 400 units',
    complaint: 'Anything above ~400 units makes the level crawl. The artists want to compress the sprite textures.',
    description: '520 units on a single packed atlas. Off-screen units are skipped when drawing. Collision is checked between all units.',
    excerpt: 'checkCollisions() {\n  for (const a of this.units) {\n    for (const b of this.units) {\n      if (a !== b && overlaps(a, b)) this.resolve(a, b);\n    }\n  }\n}',
    config: c({ seed: 12, entities: 520, broadphase: 'naive', atlasPacked: true, cullOffscreen: true, aiOps: 3 }),
  },
  {
    id: 'scene-3', phase: 'dev', title: 'Battle is choppy, the menu is smooth',
    complaint: 'The menu runs perfectly but the battle scene is choppy. The physics programmer wants to rewrite collision from scratch.',
    description: '320 units drawn in depth order. Each unit type has its own PNG (36 files, no atlas). A spatial grid handles collision.',
    excerpt: "create() {\n  this.tmp = new Phaser.Math.Vector2(); // once, at scene start\n  for (const t of TYPES) this.load.image(t.key, t.file); // 36 separate files\n}\nupdate() {\n  this.children.depthSort(); // textures interleave by y\n}",
    config: c({ seed: 13, entities: 320, broadphase: 'grid', cellSize: 50, atlasPacked: false, sortedByTexture: false, textures: 36, aiOps: 1 }),
  },
  {
    id: 'scene-4', phase: 'dev', title: 'Everything feels a little slow',
    complaint: 'No single thing stands out in the profile - the whole scene is just "a bit slow".',
    description: '260 units, health bars and labels as children, nothing culled, a few objects created per unit each frame, AI with an occasional path search.',
    excerpt: 'update() {\n  for (const u of this.units) {\n    u.target = new Phaser.Math.Vector2(goalX, goalY); // 1 allocation per unit\n    u.runAI();\n    if (this.time % 30 === 0) u.findPath();\n  }\n}',
    config: c({ seed: 14, entities: 260, broadphase: 'grid', cellSize: 60, textures: 8, atlasPacked: false, sortedByTexture: true, childrenPerEntity: 3, cullOffscreen: false, allocPerEntity: 2, aiOps: 7, pathOps: 60, repathEveryFrame: false }),
  },
];

export const HELDOUT_SCENES: Scene[] = [
  {
    id: 'scene-5', phase: 'heldout', title: 'Open-world map stutters near towns',
    complaint: 'Walking into a town stutters. The team suspects texture memory.',
    description: '900 props in containers with nine children each (shadow, label, effects...). Everything is on one atlas. Nothing off-screen is skipped.',
    excerpt: 'this.props.forEach((p) => {\n  p.setVisible(true); // never culled\n  p.list.forEach((child) => child.update());\n});',
    config: c({ seed: 21, entities: 900, broadphase: 'grid', cellSize: 40, atlasPacked: true, childrenPerEntity: 9, cullOffscreen: false, aiOps: 1 }),
  },
  {
    id: 'scene-6', phase: 'heldout', title: 'Wave spawns freeze the game for a moment',
    complaint: 'The game freezes briefly when a wave spawns. The heap graph shows some garbage, so the team blames memory churn.',
    description: '420 units, pooled objects (almost no per-frame allocation). Each unit re-runs its path search every frame.',
    excerpt: 'update() {\n  for (const u of this.units) {\n    u.path = this.pathfinder.search(u.pos, u.goal); // every frame, every unit\n    u.follow(u.path);\n  }\n}',
    config: c({ seed: 22, entities: 420, broadphase: 'grid', cellSize: 80, atlasPacked: true, aiOps: 6, pathOps: 80, repathEveryFrame: true }),
  },
  {
    id: 'scene-7', phase: 'heldout', title: '"We added a spatial grid and it did not help"',
    complaint: 'Last sprint the team added a spatial grid to speed up collisions, but the scene is just as slow.',
    description: '480 units on one atlas. A grid broadphase was added with a cell size of 2000 world units.',
    excerpt: "const GRID_CELL = 2000; // world is 2000 x 1200\nconst grid = new SpatialGrid(GRID_CELL);\nfor (const u of units) grid.insert(u);\nfor (const [a, b] of grid.candidatePairs()) test(a, b);",
    config: c({ seed: 23, entities: 480, broadphase: 'grid', cellSize: 2000, atlasPacked: true, aiOps: 3 }),
  },
];

export const ALL_SCENES: Scene[] = [...DEV_SCENES, ...HELDOUT_SCENES];

export function rootCauseOf(p: FrameProfile): RootCause {
  return p.dominantShare >= DOMINANT_SHARE ? p.dominant : 'mixed';
}

export interface SceneTruth {
  caseId: string;
  verdict: RootCause;
  summary: string;
  numbers: FrameProfile;
}

export function sceneTruth(s: Scene): SceneTruth {
  const numbers = profileScene(s.config);
  const verdict = rootCauseOf(numbers);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const top = [...numbers.perFrame].sort((a, b) => b.units - a.units).slice(0, 2);
  const summary = verdict === 'mixed'
    ? `No subsystem reaches ${pct(DOMINANT_SHARE)} of the counted work (largest: ${top[0]!.subsystem} ${pct(top[0]!.share)}, then ${top[1]!.subsystem} ${pct(top[1]!.share)}), so there is no single root cause.`
    : `${verdict} accounts for ${pct(numbers.dominantShare)} of the counted work (${numbers.perFrame.find((x) => x.subsystem === verdict)!.count} counted per frame); the next largest is ${pct(numbers.secondShare)}.`;
  return { caseId: s.id, verdict, summary, numbers };
}

export const sceneById = (id: string): Scene | undefined => ALL_SCENES.find((s) => s.id === id);
export const truthFor = (id: string): SceneTruth | undefined => { const s = sceneById(id); return s ? sceneTruth(s) : undefined; };

export const PERF_CHECKLIST = [
  { id: 'ran-profiler', text: 'Ran the profiler for this scene before diagnosing' },
  { id: 'cited-counts', text: "Cited the profiler's counts or shares, not guesses about what looks slow" },
  { id: 'dominant-not-loudest', text: 'Named the subsystem with the largest share even where another candidate looked more suspicious in the complaint or code' },
  { id: 'units-not-fps', text: 'Said the numbers are counted work units, not frame time or FPS, and that a real-device profile is needed before promising a speed-up' },
  { id: 'targeted-fix', text: 'Proposed a fix aimed at the dominant subsystem and described the expected change in COUNTED work (not a promised FPS)' },
] as const;

export const ROOT_CAUSES: { value: RootCause; label: string }[] = [
  { value: 'allocation', label: 'allocation' },
  { value: 'collision', label: 'collision' },
  { value: 'draw-calls', label: 'draw calls' },
  { value: 'display-list', label: 'display list' },
  { value: 'update-logic', label: 'update logic' },
  { value: 'mixed', label: 'mixed' },
];

export const VERDICT_FORMAT = 'ROOT CAUSE: allocation | collision | draw-calls | display-list | update-logic | mixed';

export function taskPrompt(s: Scene): string {
  return [
    'Investigate a performance complaint in the Embergate scene below (a fictional training game; this folder is the whole fixture).',
    '',
    `Scene ${s.id}: ${s.title}`,
    `Complaint: ${s.complaint}`,
    '',
    'cases.json has the scene description and a code excerpt. The README explains the cost model.',
    'Decide which subsystem accounts for most of the per-frame work, and what you would change first.',
    'Finish your answer with exactly one line of the form:',
    VERDICT_FORMAT,
  ].join('\n');
}

export const RULES_MD = `## How the profiler works (read this first)

The profiler **counts work per frame** and converts it to abstract *work units* with a fixed cost model. It does **not** measure frame time or FPS, and nothing here says how fast the game would run on any device.

${SUBSYSTEMS.map((s) => `- **${s}** (${UNIT_COST[s]} work units each): ${{ allocation: 'objects allocated during a frame', collision: 'candidate collision pairs tested', 'draw-calls': 'draw calls (texture/batch changes)', 'display-list': 'display objects visited by the renderer', 'update-logic': 'scripted operations in per-unit update code' }[s]}`).join('\n')}

- A subsystem is **the dominant cost** when it accounts for **at least 50%** of the counted work units. If none does, the root cause is **mixed**.
- A real speed-up claim needs a real measurement on a real device. Counted work only tells you where to look first.

Run \`npx tsx profile.ts <scene-id>\` to print the counts for a scene.`;

export function scenesJson(list: Scene[]): string {
  return JSON.stringify(list.map(({ id, title, complaint, description, excerpt, config }) => ({ id, title, complaint, description, excerpt, config })), null, 2) + '\n';
}

export const PROFILE_RUN = `import { readFileSync } from 'node:fs';
import { profileScene, type SceneConfig } from './profiler';

// Usage: npx tsx profile.ts <scene-id>   Prints counted work per frame (NOT frame time).
const scenes = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as { id: string; title: string; config: SceneConfig }[];
const id = process.argv[2];
const scene = scenes.find((s) => s.id === id);
if (!scene) {
  console.error('Usage: npx tsx profile.ts <scene-id>   (ids: ' + scenes.map((s) => s.id).join(', ') + ')');
  process.exit(1);
}
const p = profileScene(scene.config);
console.log('scene,' + scene.id);
console.log('subsystem,counted_per_frame,work_units,share');
for (const r of p.perFrame) console.log([r.subsystem, r.count, r.units, r.share].join(','));
console.log('total_work_units,' + p.totalUnits);
console.log('NOTE: work units are a counted proxy, not milliseconds or FPS.');
`;

export type { Subsystem };
