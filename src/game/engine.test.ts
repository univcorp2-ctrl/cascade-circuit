import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  createGame,
  dailySeed,
  dropInColumn,
  findRecommendedColumn,
  getLandingRow,
  nextRandom,
  peekNextTile,
  resolveCascades,
} from './engine';

describe('Cascade Circuit engine', () => {
  it('starts with an obvious pair matching the next tile', () => {
    const state = createGame(42);
    const next = peekNextTile(state.seed);
    expect(state.board[7][0]).toBe(next);
    expect(state.board[7][1]).toBe(next);
    expect(findRecommendedColumn(state)).toBe(2);
  });

  it('the guided first move produces an immediate merge', () => {
    const state = createGame(42);
    const result = dropInColumn(state, findRecommendedColumn(state));
    expect(result.accepted).toBe(true);
    expect(result.state.lastGain).toBeGreaterThan(0);
    expect(result.state.combo).toBeGreaterThanOrEqual(1);
  });

  it('returns the lowest open landing row', () => {
    const board = createEmptyBoard();
    board[7][2] = 1;
    expect(getLandingRow(board, 2)).toBe(6);
    expect(getLandingRow(board, -1)).toBe(-1);
  });

  it('rejects a full column without spending a move', () => {
    const state = createGame(42);
    state.board = createEmptyBoard();
    for (let row = 0; row < state.board.length; row += 1) state.board[row][0] = 1 + row;
    const result = dropInColumn(state, 0, 1);
    expect(result.accepted).toBe(false);
    expect(result.state.movesLeft).toBe(36);
  });

  it('merges an orthogonally connected group of three', () => {
    const board = createEmptyBoard();
    board[7][0] = 1;
    board[7][1] = 1;
    board[7][2] = 1;
    const result = resolveCascades(board);
    expect(result.chains).toBe(1);
    expect(result.scoreGain).toBe(6);
    expect(result.board[7].filter((cell) => cell === 2)).toHaveLength(1);
  });

  it('applies gravity and resolves a second chain', () => {
    const board = createEmptyBoard();
    board[7][0] = 1;
    board[7][1] = 1;
    board[7][2] = 1;
    board[6][0] = 2;
    board[6][1] = 2;
    const result = resolveCascades(board);
    expect(result.chains).toBe(2);
    expect(result.maxTile).toBe(3);
    expect(result.board[7].some((cell) => cell === 3)).toBe(true);
  });

  it('previews the exact tile that the next drop consumes', () => {
    const state = createGame(1234);
    const preview = peekNextTile(state.seed);
    const column = getLandingRow(state.board, 3) >= 0 ? 3 : 2;
    const beforeCount = state.board.flat().filter((cell) => cell === preview).length;
    const result = dropInColumn(state, column);
    const afterCount = result.state.board.flat().filter((cell) => cell === preview).length;
    expect(result.accepted).toBe(true);
    expect(result.state.seed).not.toBe(state.seed);
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount - 2);
  });

  it('produces deterministic pseudo-random values and daily seeds', () => {
    expect(nextRandom(1234)).toEqual(nextRandom(1234));
    expect(peekNextTile(1234)).toBe(peekNextTile(1234));
    expect(dailySeed(new Date('2026-07-11T00:00:00Z'))).toBe(dailySeed(new Date('2026-07-11T23:59:59Z')));
  });
});
