/**
 * Seeded merge-board simulation (educational, fictional). The rule under test is DETERMINISM: the same seed and the
 * same moves must always produce the same trace, however the host environment behaves (wall clock, global
 * Math.random, the order independent inputs arrive in).
 */
import { mulberry32 } from './rng';

export type Rng = () => number;

export interface Move {
  id: number;
  /** Moves with the same tick are independent inputs that may arrive in any order. */
  tick: number;
  col: number;
  rank: number;
}

export interface Group {
  rank: number;
  cells: number[];
}

/** The behaviours a code change can alter. BASE below is the reviewed, golden behaviour. */
export interface Variant {
  id: string;
  /** Spawn the bonus piece before (true) or after (false) merges are resolved. */
  spawnFirst: boolean;
  pickSpawn: (empties: number[], rng: Rng) => number;
  /** Negative: group a resolves before group b (called only when both groups have the same size). */
  tieBreak: (a: Group, b: Group, rng: Rng) => number;
  /** Order in which one tick's moves are applied. `batch` is in ARRIVAL order. */
  sameTickOrder: (batch: Move[]) => Move[];
  neighbors: (cell: number) => number[];
  /** Called once per drop; a change may consume extra random numbers here. */
  perDrop: (rng: Rng) => void;
}

export const SIZE = 6;

export function plainNeighbors(cell: number): number[] {
  const x = cell % SIZE;
  const y = Math.floor(cell / SIZE);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < SIZE - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - SIZE);
  if (y < SIZE - 1) out.push(cell + SIZE);
  return out;
}

export const BASE: Variant = {
  id: 'base',
  spawnFirst: false,
  pickSpawn: (empties, rng) => empties[Math.floor(rng() * empties.length)]!,
  tieBreak: (a, b) => Math.min(...a.cells) - Math.min(...b.cells),
  sameTickOrder: (batch) => [...batch].sort((a, b) => a.id - b.id),
  neighbors: plainNeighbors,
  perDrop: () => undefined,
};

function findGroups(board: number[], v: Variant): Group[] {
  const seen = new Set<number>();
  const groups: Group[] = [];
  for (let start = 0; start < board.length; start++) {
    if (board[start] === 0 || seen.has(start)) continue;
    const rank = board[start]!;
    const stack = [start];
    const cells: number[] = [];
    seen.add(start);
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const n of v.neighbors(c)) if (!seen.has(n) && board[n] === rank) { seen.add(n); stack.push(n); }
    }
    if (cells.length >= 3) groups.push({ rank, cells: cells.sort((a, b) => a - b) });
  }
  return groups;
}

function dropCell(board: number[], col: number): number {
  for (let y = SIZE - 1; y >= 0; y--) if (board[y * SIZE + col] === 0) return y * SIZE + col;
  return -1;
}

/** Plays one game and returns its trace (one line per event). */
export function playGame(v: Variant, seed: number, moves: Move[]): string[] {
  const rng = mulberry32(seed);
  const board = new Array<number>(SIZE * SIZE).fill(0);
  const trace: string[] = [];
  const spawn = () => {
    const empties = board.flatMap((x, i) => (x === 0 ? [i] : []));
    if (empties.length === 0) return;
    const cell = v.pickSpawn(empties, rng);
    board[cell] = 1;
    trace.push(`spawn ${cell}`);
  };
  const resolve = () => {
    for (let guard = 0; guard < 50; guard++) {
      const groups = findGroups(board, v).sort((a, b) => b.cells.length - a.cells.length || v.tieBreak(a, b, rng));
      const g = groups[0];
      if (!g) return;
      for (const c of g.cells) board[c] = 0;
      const anchor = g.cells[0]!;
      board[anchor] = g.rank + 1;
      trace.push(`merge r${g.rank}x${g.cells.length} at ${anchor}`);
    }
  };
  // group by tick, keeping arrival order inside each tick
  const ticks = new Map<number, Move[]>();
  for (const m of moves) ticks.set(m.tick, [...(ticks.get(m.tick) ?? []), m]);
  for (const tick of [...ticks.keys()].sort((a, b) => a - b)) {
    for (const m of v.sameTickOrder(ticks.get(tick)!)) {
      v.perDrop(rng);
      const cell = dropCell(board, m.col);
      if (cell < 0) { trace.push(`drop ${m.id} column ${m.col} full`); continue; }
      board[cell] = m.rank;
      trace.push(`drop ${m.id} col ${m.col} -> ${cell} r${m.rank}`);
      if (v.spawnFirst) spawn();
      resolve();
      if (!v.spawnFirst) spawn();
    }
  }
  trace.push(`final ${board.join('')}`);
  return trace;
}

/** Small, stable, non-cryptographic hash (FNV-1a, 32 bit) so traces can be compared at a glance. */
export function traceHash(lines: string[]): string {
  let h = 2166136261;
  for (const ch of lines.join('\n')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
