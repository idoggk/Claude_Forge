import { dropPiece, pickMergeCells as buggyPick, MERGE_SIZE, SIZE, pieceValue, totalValue } from './board';
import type { Board, Cell, ResolveResult } from './board';
import type { Resolver } from './cases';

/**
 * Candidate patches the learner can evaluate. Each is a real function that the
 * app runs against the fixture suite - nothing is typed in or evaluated at runtime.
 * Exactly one is a correct fix.
 */
export interface Candidate {
  id: string;
  label: string;
  patch: string;
  resolver: Resolver;
  isCorrect: boolean;
  verdict: string;
}

const sliceFix = (group: Cell[]): Cell[] => group.slice(0, MERGE_SIZE);

const special4 = (group: Cell[], anchor: Cell): Cell[] => (group.length === 4 ? group.slice(0, MERGE_SIZE) : buggyPick(group, anchor));

const scoreTopUp: Resolver = (board, at, rank) => {
  const res = dropPiece(board, at, rank);
  // "Fix the reported score" by crediting the lost value to the score. The board is still wrong.
  const lost = totalValue(board) + pieceValue(rank) - totalValue(res.board);
  return { ...res, score: res.score + Math.max(0, lost) };
};

const respawnLost: Resolver = (board, at, rank): ResolveResult => {
  const res = dropPiece(board, at, rank);
  // "Repair" by re-spawning the destroyed value as rank-1 pieces in the first empty cells.
  let lost = totalValue(board) + pieceValue(rank) - totalValue(res.board);
  const b: Board = res.board.map((r) => r.slice());
  for (let r = 0; r < SIZE && lost > 0; r++)
    for (let c = 0; c < SIZE && lost > 0; c++)
      if (b[r]![c] === 0) {
        b[r]![c] = 1;
        lost -= pieceValue(1);
      }
  return { ...res, board: b };
};

export const CANDIDATES: Candidate[] = [
  {
    id: 'slice-merge-size',
    label: 'Consume only MERGE_SIZE cells',
    patch: '- return group;\n+ return group.slice(0, MERGE_SIZE);',
    resolver: (b, at, rank) => dropPiece(b, at, rank, sliceFix),
    isCorrect: true,
    verdict: 'Fixes the root cause: the merge rule says "exactly three", and now the code says it too.',
  },
  {
    id: 'special-case-four',
    label: 'Special-case groups of exactly four',
    patch: '- return group;\n+ return group.length === 4 ? group.slice(0, 3) : group;',
    resolver: (b, at, rank) => dropPiece(b, at, rank, special4),
    isCorrect: false,
    verdict: 'Matches the report that prompted the ticket, not the cause. Groups of five still lose pieces.',
  },
  {
    id: 'credit-score',
    label: 'Credit the lost value to the score',
    patch: '  const res = dropPiece(...);\n+ res.score += lostValue;',
    resolver: scoreTopUp,
    isCorrect: false,
    verdict: 'Hides the symptom players noticed (score) while the board still destroys pieces.',
  },
  {
    id: 'respawn-lost',
    label: 'Re-spawn lost value as rank-1 pieces',
    patch: '  const res = dropPiece(...);\n+ fillFirstEmptyCellsWith(rank1, lostValue);',
    resolver: respawnLost,
    isCorrect: false,
    verdict: 'Restores total value but invents pieces in the wrong places. It satisfies one invariant by violating the rules.',
  },
];
