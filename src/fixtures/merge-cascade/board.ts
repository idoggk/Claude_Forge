/**
 * EDUCATIONAL FIXTURE - original code written for Claude Forge, not taken from
 * any production game. A tiny "merge-3" board in the spirit of One More Merge.
 *
 * Rules
 *  - 5x5 grid. Each cell is 0 (empty) or a piece rank 1..MAX_RANK.
 *  - Dropping a piece on an empty cell may form a connected group (orthogonal
 *    neighbours, same rank) of MERGE_SIZE or more.
 *  - A merge consumes exactly MERGE_SIZE pieces of the group (the dropped piece
 *    plus the next two in breadth-first order) and leaves ONE piece of rank+1 on
 *    the dropped cell. Pieces of the group that are not consumed stay put.
 *  - Merges cascade: the new piece may complete another group, repeat until stable.
 *  - Pieces at MAX_RANK never merge.
 *
 * Invariant (see invariants.ts): merging conserves value, where a piece of rank r
 * is worth MERGE_SIZE ** r. Three rank-r pieces (3 * 3^r) become one rank r+1 (3^(r+1)).
 *
 * KNOWN BUG (seeded on purpose): see pickMergeCells().
 */

export const SIZE = 5;
export const MAX_RANK = 6;
export const MERGE_SIZE = 3;

export type Board = number[][];
export interface Cell {
  r: number;
  c: number;
}
export interface Step {
  anchor: Cell;
  /** Rank of the piece created by this merge. */
  rank: number;
  consumed: Cell[];
}
export interface ResolveResult {
  board: Board;
  steps: Step[];
  score: number;
}
export type PickFn = (group: Cell[], anchor: Cell) => Cell[];

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], // up
  [1, 0], // down
  [0, -1], // left
  [0, 1], // right
];

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

export function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

export function pieceValue(rank: number): number {
  return rank <= 0 ? 0 : MERGE_SIZE ** rank;
}

export function totalValue(b: Board): number {
  let sum = 0;
  for (const row of b) for (const rank of row) sum += pieceValue(rank);
  return sum;
}

/** Connected group of same-rank cells containing `start`, in breadth-first order (start first). */
export function floodGroup(b: Board, start: Cell): Cell[] {
  const rank = b[start.r]![start.c]!;
  if (rank === 0) return [];
  const seen = new Set<number>([start.r * SIZE + start.c]);
  const queue: Cell[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    for (const [dr, dc] of DIRS) {
      const r = cur.r + dr;
      const c = cur.c + dc;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
      const key = r * SIZE + c;
      if (seen.has(key) || b[r]![c] !== rank) continue;
      seen.add(key);
      queue.push({ r, c });
    }
  }
  return queue;
}

/**
 * Choose which cells a merge consumes. `group` is in breadth-first order and
 * starts with the anchor (the cell that was just dropped on / just created).
 *
 * BUG: this consumes the WHOLE group. When the group has more than MERGE_SIZE
 * pieces the extra pieces vanish, so value is destroyed.
 */
export function pickMergeCells(group: Cell[], _anchor: Cell): Cell[] {
  return group;
}

export function dropPiece(board: Board, at: Cell, rank: number, pick: PickFn = pickMergeCells): ResolveResult {
  if (at.r < 0 || at.c < 0 || at.r >= SIZE || at.c >= SIZE) throw new RangeError(`Cell (${at.r},${at.c}) is off the board`);
  if (board[at.r]![at.c] !== 0) throw new RangeError(`Cell (${at.r},${at.c}) is occupied`);
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK) throw new RangeError(`Invalid rank ${rank}`);

  const b = cloneBoard(board);
  b[at.r]![at.c] = rank;
  const steps: Step[] = [];
  let score = 0;

  for (;;) {
    const current = b[at.r]![at.c]!;
    if (current >= MAX_RANK) break;
    const group = floodGroup(b, at);
    if (group.length < MERGE_SIZE) break;
    const consumed = pick(group, at);
    for (const cell of consumed) b[cell.r]![cell.c] = 0;
    b[at.r]![at.c] = current + 1;
    steps.push({ anchor: at, rank: current + 1, consumed });
    score += pieceValue(current + 1);
  }
  return { board: b, steps, score };
}
