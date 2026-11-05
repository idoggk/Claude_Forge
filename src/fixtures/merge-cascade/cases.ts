import { SIZE, emptyBoard, dropPiece as buggyDrop } from './board';
import type { Board, Cell, ResolveResult } from './board';
import { checkInvariants } from './invariants';
import { mulberry32 } from './rng';

/** Parse a board from 5 strings: '.' is empty, a digit is the piece rank. */
export function parseBoard(rows: string[]): Board {
  const b = emptyBoard();
  rows.forEach((row, r) => {
    for (let c = 0; c < SIZE; c++) {
      const ch = row[c] ?? '.';
      b[r]![c] = ch === '.' ? 0 : Number(ch);
    }
  });
  return b;
}

export function formatBoard(b: Board): string[] {
  return b.map((row) => row.map((v) => (v === 0 ? '.' : String(v))).join(''));
}

export type Resolver = (board: Board, at: Cell, rank: number) => ResolveResult;

export interface FixtureCase {
  id: string;
  title: string;
  why: string;
  board: string[];
  drop: { r: number; c: number; rank: number };
  /** Hand-derived expected final board (not generated from the implementation). */
  expect?: string[];
  expectSteps?: number;
  expectThrows?: boolean;
}

export const CASES: FixtureCase[] = [
  {
    id: 'isolated-drop',
    title: 'Isolated drop does nothing',
    why: 'Baseline: a piece with no equal neighbours just sits there.',
    board: ['.....', '.....', '.....', '.....', '.....'],
    drop: { r: 2, c: 2, rank: 1 },
    expect: ['.....', '.....', '..1..', '.....', '.....'],
    expectSteps: 0,
  },
  {
    id: 'simple-triple',
    title: 'Three in a row merge',
    why: 'The happy path: exactly three pieces, one merge.',
    board: ['11...', '.....', '.....', '.....', '.....'],
    drop: { r: 0, c: 2, rank: 1 },
    expect: ['..2..', '.....', '.....', '.....', '.....'],
    expectSteps: 1,
  },
  {
    id: 'group-of-four',
    title: 'Group of four leaves one piece behind',
    why: 'Four connected pieces: only three are consumed, the fourth must stay where it was.',
    board: ['11...', '..1..', '.....', '.....', '.....'],
    drop: { r: 0, c: 2, rank: 1 },
    expect: ['1.2..', '.....', '.....', '.....', '.....'],
    expectSteps: 1,
  },
  {
    id: 'group-of-five-row',
    title: 'Group of five (row) leaves two pieces behind',
    why: 'A drop that bridges two pairs. Distinguishes a real fix from a special-case for "exactly four".',
    board: ['11.11', '.....', '.....', '.....', '.....'],
    drop: { r: 0, c: 2, rank: 1 },
    expect: ['1.2.1', '.....', '.....', '.....', '.....'],
    expectSteps: 1,
  },
  {
    id: 'cascade-clean',
    title: 'Two-step cascade, exact groups',
    why: 'A merge creates a rank-2 piece that completes a second group of exactly three.',
    board: ['11.2.', '..2..', '.....', '.....', '.....'],
    drop: { r: 0, c: 2, rank: 1 },
    expect: ['..3..', '.....', '.....', '.....', '.....'],
    expectSteps: 2,
  },
  {
    id: 'cascade-into-four',
    title: 'Cascade lands in a group of four',
    why: 'The reported field bug: the first merge is fine, the cascade step destroys a piece. Only appears with a cascade.',
    board: ['..1..', '..1..', '.2.2.', '..2..', '.....'],
    drop: { r: 2, c: 2, rank: 1 },
    expect: ['.....', '.....', '..32.', '.....', '.....'],
    expectSteps: 2,
  },
  {
    id: 'max-rank-no-merge',
    title: 'Max-rank pieces never merge',
    why: 'Edge case: rank 6 groups are inert.',
    board: ['66...', '.....', '.....', '.....', '.....'],
    drop: { r: 0, c: 2, rank: 6 },
    expect: ['666..', '.....', '.....', '.....', '.....'],
    expectSteps: 0,
  },
  {
    id: 'occupied-cell',
    title: 'Dropping on an occupied cell is rejected',
    why: 'Edge case: invalid input must throw, not silently overwrite.',
    board: ['1....', '.....', '.....', '.....', '.....'],
    drop: { r: 0, c: 0, rank: 1 },
    expectThrows: true,
  },
];

export interface CaseResult {
  id: string;
  title: string;
  pass: boolean;
  failures: string[];
  finalBoard: string[] | null;
}

export function runCase(resolver: Resolver, tc: FixtureCase): CaseResult {
  const board = parseBoard(tc.board);
  const failures: string[] = [];
  let result: ResolveResult | null = null;
  try {
    result = resolver(board, { r: tc.drop.r, c: tc.drop.c }, tc.drop.rank);
    if (tc.expectThrows) failures.push('Expected an error but the drop succeeded.');
  } catch (e) {
    if (!tc.expectThrows) failures.push(`Unexpected error: ${(e as Error).message}`);
  }
  if (result && !tc.expectThrows) {
    for (const v of checkInvariants(board, tc.drop.rank, result)) failures.push(`[${v.invariant}] ${v.message}`);
    if (tc.expect) {
      const got = formatBoard(result.board);
      if (got.join('/') !== tc.expect.join('/')) failures.push(`Board mismatch. Expected ${tc.expect.join(' ')} but got ${got.join(' ')}.`);
    }
    if (tc.expectSteps !== undefined && result.steps.length !== tc.expectSteps) failures.push(`Expected ${tc.expectSteps} merge step(s) but saw ${result.steps.length}.`);
  }
  return { id: tc.id, title: tc.title, pass: failures.length === 0, failures, finalBoard: result ? formatBoard(result.board) : null };
}

export function runSuite(resolver: Resolver): { results: CaseResult[]; passed: number; failed: number } {
  const results = CASES.map((c) => runCase(resolver, c));
  const passed = results.filter((r) => r.pass).length;
  return { results, passed, failed: results.length - passed };
}

/** A seeded random playthrough: drops rank 1-2 pieces onto random empty cells until the board is full. */
export interface PlaythroughViolation {
  seed: number;
  dropNumber: number;
  at: Cell;
  rank: number;
  boardBefore: string[];
  messages: string[];
}

export function playSeeded(resolver: Resolver, seed: number, maxDrops = 60): PlaythroughViolation | null {
  const rnd = mulberry32(seed);
  let board = emptyBoard();
  for (let n = 1; n <= maxDrops; n++) {
    const empties: Cell[] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r]![c] === 0) empties.push({ r, c });
    if (empties.length === 0) return null;
    const at = empties[Math.floor(rnd() * empties.length)]!;
    const rank = rnd() < 0.7 ? 1 : 2;
    const res = resolver(board, at, rank);
    const violations = checkInvariants(board, rank, res);
    if (violations.length > 0) {
      return { seed, dropNumber: n, at, rank, boardBefore: formatBoard(board), messages: violations.map((v) => `[${v.invariant}] ${v.message}`) };
    }
    board = res.board;
  }
  return null;
}

/** Scan seeds and report the failing ones (empty list = the resolver passes every playthrough). */
export function scanSeeds(resolver: Resolver, seeds: number[]): PlaythroughViolation[] {
  const out: PlaythroughViolation[] = [];
  for (const s of seeds) {
    const v = playSeeded(resolver, s);
    if (v) out.push(v);
  }
  return out;
}

export const BUGGY_RESOLVER: Resolver = (b, at, rank) => buggyDrop(b, at, rank);
