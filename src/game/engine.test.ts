import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createGame, dailySeed, dropInColumn, nextRandom, peekNextTile, resolveCascades } from './engine';

describe('Cascade Circuit engine', () => {
  it('drops a forced tile into the lowest open cell', () => {
    const result = dropInColumn(createGame(42), 2, 1);
    expect(result.accepted).toBe(true);
    expect(result.state.board[7][2]).toBe(1);
    expect(result.state.movesLeft).toBe(35);
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

  it('previews the exact tile that the next drop will consume', () => {
    const state = createGame(1234);
    const preview = peekNextTile(state.seed);
    const result = dropInColumn(state, 0);
    expect(result.state.board[7][0]).toBe(preview);
  });

  it('produces deterministic pseudo-random values and daily seeds', () => {
    expect(nextRandom(1234)).toEqual(nextRandom(1234));
    expect(peekNextTile(1234)).toBe(peekNextTile(1234));
    expect(dailySeed(new Date('2026-07-11T00:00:00Z'))).toBe(dailySeed(new Date('2026-07-11T23:59:59Z')));
  });
});
