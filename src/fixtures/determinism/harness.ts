/**
 * Determinism harness. Runs the SAME seeded games under several perturbed environments and compares trace hashes:
 *  - global Math.random is replaced by a different seeded stream in each environment,
 *  - Date.now is replaced by a clock that differs (and ticks differently) in each environment,
 *  - independent same-tick inputs arrive in a different order in each environment.
 * A deterministic simulation gives identical hashes in every environment. It prints raw hashes only; deciding what
 * they mean is the reviewer's job.
 */
import { mulberry32 } from './rng';
import { BASE, playGame, traceHash, type Move, type Variant } from './sim';

export const ENVIRONMENTS = 4;
export const GAMES = 6;
export const MOVES_PER_GAME = 40;

export function script(seed: number): Move[] {
  const rnd = mulberry32(seed * 7919);
  const moves: Move[] = [];
  let tick = 0;
  let id = 1;
  while (moves.length < MOVES_PER_GAME) {
    const batch = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < batch && moves.length < MOVES_PER_GAME; k++) moves.push({ id: id++, tick, col: Math.floor(rnd() * 6), rank: 1 + Math.floor(rnd() * 2) });
    tick++;
  }
  return moves;
}

/** Input arrival order differs per environment: as scripted, reversed, rotated, as scripted. */
function arrival(moves: Move[], env: number): Move[] {
  const byTick = new Map<number, Move[]>();
  for (const m of moves) byTick.set(m.tick, [...(byTick.get(m.tick) ?? []), m]);
  return [...byTick.values()].flatMap((batch) => (env % 4 === 1 ? [...batch].reverse() : env % 4 === 2 ? [...batch.slice(1), ...batch.slice(0, 1)] : batch));
}

function withEnvironment<T>(env: number, fn: () => T): T {
  const realRandom = Math.random;
  const realNow = Date.now;
  const stream = mulberry32(1000 + env);
  let calls = 0;
  Math.random = stream;
  Date.now = () => 1_700_000_000_000 + env * 37 + 13 * calls++;
  try {
    return fn();
  } finally {
    Math.random = realRandom;
    Date.now = realNow;
  }
}

export interface HarnessResult {
  /** One hash per environment, over all games. */
  envHashes: string[];
  /** Hash of the reviewed (golden) behaviour on the same games. */
  golden: string;
  /** Index of the first trace event (game 1) that differs between environments, or null. */
  firstDivergence: number | null;
}

export function runHarness(variant: Variant): HarnessResult {
  const traces = (v: Variant, env: number) => withEnvironment(env, () => Array.from({ length: GAMES }, (_, g) => playGame(v, g + 1, arrival(script(g + 1), env))));
  const envTraces = Array.from({ length: ENVIRONMENTS }, (_, e) => traces(variant, e));
  const envHashes = envTraces.map((t) => traceHash(t.flat()));
  const golden = traceHash(traces(BASE, 0).flat());
  let firstDivergence: number | null = null;
  const ref = envTraces[0]![0]!;
  for (const t of envTraces.slice(1)) {
    const g1 = t[0]!;
    for (let i = 0; i < Math.max(ref.length, g1.length); i++) if (ref[i] !== g1[i]) { firstDivergence = firstDivergence === null ? i : Math.min(firstDivergence, i); break; }
  }
  return { envHashes, golden, firstDivergence };
}
