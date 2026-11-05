import { MAX_RANK, MERGE_SIZE, SIZE, floodGroup, totalValue, pieceValue } from './board';
import type { Board, ResolveResult } from './board';

export interface InvariantViolation {
  invariant: 'value-conservation' | 'stability' | 'rank-bounds' | 'merge-size';
  message: string;
}

/**
 * Invariants that must hold after every drop, regardless of cascade depth:
 *  1. value-conservation: totalValue(after) === totalValue(before) + pieceValue(droppedRank)
 *  2. stability: no remaining group of MERGE_SIZE+ pieces below MAX_RANK
 *  3. rank-bounds: every cell is 0..MAX_RANK
 *  4. merge-size: every step consumed exactly MERGE_SIZE cells
 */
export const INVARIANTS = [
  { id: 'value-conservation', text: 'A drop adds exactly the dropped piece\'s value; merges never create or destroy value (piece value = 3^rank).' },
  { id: 'stability', text: 'After resolution no group of 3+ equal pieces (below max rank) remains.' },
  { id: 'rank-bounds', text: 'Every cell holds 0..MAX_RANK.' },
  { id: 'merge-size', text: 'Each merge step consumes exactly 3 pieces.' },
] as const;

export function checkInvariants(before: Board, droppedRank: number, result: ResolveResult): InvariantViolation[] {
  const out: InvariantViolation[] = [];
  const expected = totalValue(before) + pieceValue(droppedRank);
  const actual = totalValue(result.board);
  if (expected !== actual) {
    out.push({ invariant: 'value-conservation', message: `Board value should be ${expected} but is ${actual} (${actual - expected > 0 ? '+' : ''}${actual - expected}).` });
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const rank = result.board[r]![c]!;
      if (rank < 0 || rank > MAX_RANK || !Number.isInteger(rank)) out.push({ invariant: 'rank-bounds', message: `Cell (${r},${c}) holds ${rank}.` });
      else if (rank > 0 && rank < MAX_RANK && floodGroup(result.board, { r, c }).length >= MERGE_SIZE) {
        out.push({ invariant: 'stability', message: `A group of ${MERGE_SIZE}+ rank-${rank} pieces is still on the board at (${r},${c}).` });
      }
    }
  }
  for (const [i, s] of result.steps.entries()) {
    if (s.consumed.length !== MERGE_SIZE) out.push({ invariant: 'merge-size', message: `Merge step ${i + 1} consumed ${s.consumed.length} pieces, expected ${MERGE_SIZE}.` });
  }
  // de-duplicate repeated stability messages
  return out.filter((v, i, a) => a.findIndex((w) => w.message === v.message) === i);
}
