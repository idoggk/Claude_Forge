/**
 * Embergate frame-cost profiler (educational, fictional, deterministic).
 *
 * IMPORTANT: this does NOT measure frame time or FPS. It COUNTS work a Phaser-style scene does each frame and
 * converts the counts to abstract "work units" with a published, fixed cost model. Real performance depends on the
 * device, browser and GPU and must be measured with real profiling tools. The counts are useful for one thing:
 * telling which subsystem's work dominates, so you investigate the right place first.
 */
import { mulberry32 } from './rng';

export const SUBSYSTEMS = ['allocation', 'collision', 'draw-calls', 'display-list', 'update-logic'] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

/** Published cost model: abstract work units per counted operation. */
export const UNIT_COST: Record<Subsystem, number> = {
  allocation: 4, // per object allocated during a frame (garbage-collection pressure proxy)
  collision: 1, // per candidate pair tested
  'draw-calls': 30, // per draw call (a texture / batch change forces a new call)
  'display-list': 1.5, // per display object visited by the renderer
  'update-logic': 1, // per scripted operation in per-entity update code
};

export interface SceneConfig {
  seed: number;
  /** Entities in the world (enemies, pickups, props). */
  entities: number;
  /** Fraction of entities that take part in collision (0..1). */
  collidable: number;
  /** 'naive' tests every pair; 'grid' tests entities sharing a grid cell neighbourhood. */
  broadphase: 'naive' | 'grid';
  /** Grid cell size in world units (only for 'grid'). */
  cellSize: number;
  /** Distinct textures used by entities. */
  textures: number;
  /** All textures live in one atlas page (one draw call per page), or are separate files. */
  atlasPacked: boolean;
  /** Draw order is grouped by texture (true) or by depth/y so textures interleave (false). */
  sortedByTexture: boolean;
  /** Children per entity in the display list (health bar, shadow, label...). */
  childrenPerEntity: number;
  /** Skip off-screen objects when drawing. */
  cullOffscreen: boolean;
  /** Objects created every frame per entity (new Vector2, new Rectangle ...). 0 when pooled/reused. */
  allocPerEntity: number;
  /** Particles spawned each frame, and objects allocated per particle (0 when pooled). */
  particlesPerFrame: number;
  allocPerParticle: number;
  /** Scripted operations per entity per frame (AI, steering). */
  aiOps: number;
  /** Path search operations per entity, and whether it re-runs every frame (true) or every 30 frames. */
  pathOps: number;
  repathEveryFrame: boolean;
}

export const WORLD = { width: 2000, height: 1200 } as const;
export const CAMERA = { width: 1280, height: 720 } as const;

export const DEFAULT_SCENE: SceneConfig = {
  seed: 1, entities: 100, collidable: 1, broadphase: 'grid', cellSize: 120, textures: 4, atlasPacked: true, sortedByTexture: true,
  childrenPerEntity: 0, cullOffscreen: true, allocPerEntity: 0, particlesPerFrame: 0, allocPerParticle: 0, aiOps: 4, pathOps: 0, repathEveryFrame: false,
};

export interface SubsystemCount {
  subsystem: Subsystem;
  /** The raw counted quantity (objects, pairs, calls, visits, ops). */
  count: number;
  units: number;
  share: number;
}

export interface FrameProfile {
  perFrame: SubsystemCount[];
  totalUnits: number;
  dominant: Subsystem;
  dominantShare: number;
  secondShare: number;
}

interface Pt { x: number; y: number }

function placeEntities(cfg: SceneConfig): Pt[] {
  const rnd = mulberry32(cfg.seed);
  return Array.from({ length: cfg.entities }, () => ({ x: rnd() * WORLD.width, y: rnd() * WORLD.height }));
}

/** Candidate pairs the collision pass tests this frame. */
export function countCollisionPairs(cfg: SceneConfig, pts: Pt[]): number {
  const n = Math.floor(pts.length * cfg.collidable);
  if (cfg.broadphase === 'naive') return (n * (n - 1)) / 2;
  const cells = new Map<string, number>();
  const cell = Math.max(1, cfg.cellSize);
  for (let i = 0; i < n; i++) {
    const key = `${Math.floor(pts[i]!.x / cell)},${Math.floor(pts[i]!.y / cell)}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  // each entity is tested against every other entity in its own cell and the 8 neighbours (each pair counted once)
  let pairs = 0;
  for (const [key, count] of cells) {
    const [cx, cy] = key.split(',').map(Number) as [number, number];
    pairs += (count * (count - 1)) / 2;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) pairs += count * (cells.get(`${cx + dx},${cy + dy}`) ?? 0);
  }
  return pairs;
}

/** Number of draw calls: one per run of identical textures in draw order (or one per atlas page). */
export function countDrawCalls(cfg: SceneConfig, pts: Pt[]): number {
  const visible = pts.filter((p) => !cfg.cullOffscreen || (p.x <= CAMERA.width && p.y <= CAMERA.height));
  if (visible.length === 0) return 0;
  if (cfg.atlasPacked) return 1;
  const rnd = mulberry32(cfg.seed + 7919);
  const tex = visible.map(() => Math.floor(rnd() * cfg.textures));
  if (cfg.sortedByTexture) return new Set(tex).size;
  let calls = 1;
  for (let i = 1; i < tex.length; i++) if (tex[i] !== tex[i - 1]) calls++;
  return calls;
}

export function countDisplayVisits(cfg: SceneConfig, pts: Pt[]): number {
  const visible = pts.filter((p) => !cfg.cullOffscreen || (p.x <= CAMERA.width && p.y <= CAMERA.height)).length;
  return visible * (1 + cfg.childrenPerEntity);
}

export function profileScene(cfg: SceneConfig): FrameProfile {
  const pts = placeEntities(cfg);
  const counts: Record<Subsystem, number> = {
    allocation: pts.length * cfg.allocPerEntity + cfg.particlesPerFrame * cfg.allocPerParticle,
    collision: countCollisionPairs(cfg, pts),
    'draw-calls': countDrawCalls(cfg, pts),
    'display-list': countDisplayVisits(cfg, pts),
    'update-logic': Math.round(pts.length * cfg.aiOps + pts.length * cfg.pathOps * (cfg.repathEveryFrame ? 1 : 1 / 30)),
  };
  const units = Object.fromEntries(SUBSYSTEMS.map((s) => [s, counts[s] * UNIT_COST[s]])) as Record<Subsystem, number>;
  const total = SUBSYSTEMS.reduce((a, s) => a + units[s], 0);
  const perFrame = SUBSYSTEMS.map((s) => ({ subsystem: s, count: Math.round(counts[s] * 100) / 100, units: Math.round(units[s] * 10) / 10, share: total === 0 ? 0 : Math.round((units[s] / total) * 1000) / 1000 }));
  const sorted = [...perFrame].sort((a, b) => b.units - a.units || a.subsystem.localeCompare(b.subsystem));
  return { perFrame, totalUnits: Math.round(total * 10) / 10, dominant: sorted[0]!.subsystem, dominantShare: sorted[0]!.share, secondShare: sorted[1]!.share };
}
