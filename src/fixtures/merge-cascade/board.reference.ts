/**
 * REFERENCE SOLUTION for the merge-cascade fixture.
 * The only behavioural change from board.ts is pickMergeCells(): a merge consumes
 * exactly MERGE_SIZE cells (the anchor + the next two in breadth-first order).
 */
import * as buggy from './board';
import type { Board, Cell, ResolveResult } from './board';

export * from './board';

export function pickMergeCells(group: Cell[], _anchor: Cell): Cell[] {
  return group.slice(0, buggy.MERGE_SIZE);
}

export function dropPiece(board: Board, at: Cell, rank: number): ResolveResult {
  return buggy.dropPiece(board, at, rank, pickMergeCells);
}
