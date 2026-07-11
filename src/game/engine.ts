export type Cell = number | null;
export type Board = Cell[][];

export interface GameState {
  board: Board;
  score: number;
  movesLeft: number;
  combo: number;
  maxTile: number;
  seed: number;
  gameOver: boolean;
  lastGain: number;
  lastMessage: string;
}

export interface DropResult {
  state: GameState;
  accepted: boolean;
}

export const ROWS = 8;
export const COLS = 6;
export const STARTING_MOVES = 36;

export function createEmptyBoard(rows = ROWS, cols = COLS): Board {
  return Array.from({ length: rows }, () => Array<Cell>(cols).fill(null));
}

export function createGame(seed = dailySeed()): GameState {
  const safeSeed = seed >>> 0 || 1;
  const board = createEmptyBoard();
  const openingTile = peekNextTile(safeSeed);
  const secondTile = openingTile === 1 ? 2 : 1;

  // The opening board always contains an obvious pair. Dropping the NEXT tile
  // into column 3 immediately demonstrates the core rule without reading text.
  board[ROWS - 1][0] = openingTile;
  board[ROWS - 1][1] = openingTile;
  board[ROWS - 1][4] = secondTile;
  board[ROWS - 1][5] = secondTile;

  return {
    board,
    score: 0,
    movesLeft: STARTING_MOVES,
    combo: 0,
    maxTile: Math.max(openingTile, secondTile),
    seed: safeSeed,
    gameOver: false,
    lastGain: 0,
    lastMessage: '点滅している列をタップすると、同じ色が3つそろいます',
  };
}

export function dailySeed(date = new Date()): number {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRandom(seed: number): [number, number] {
  let value = seed >>> 0 || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const next = value >>> 0;
  return [next, next / 0x100000000];
}

export function peekNextTile(seed: number): number {
  const [, random] = nextRandom(seed);
  if (random < 0.68) return 1;
  if (random < 0.94) return 2;
  return 3;
}

function generatedTile(seed: number): [number, number] {
  const [nextSeed] = nextRandom(seed);
  return [nextSeed, peekNextTile(seed)];
}

export function getLandingRow(board: Board, column: number): number {
  if (column < 0 || column >= board[0].length) return -1;
  for (let row = board.length - 1; row >= 0; row -= 1) {
    if (board[row][column] === null) return row;
  }
  return -1;
}

export function findRecommendedColumn(state: GameState): number {
  const nextTile = peekNextTile(state.seed);
  let bestColumn = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  const center = (state.board[0].length - 1) / 2;

  for (let column = 0; column < state.board[0].length; column += 1) {
    const landingRow = getLandingRow(state.board, column);
    if (landingRow < 0) continue;

    const simulated = dropInColumn(state, column, nextTile);
    if (!simulated.accepted) continue;

    let adjacency = 0;
    const neighbors = [
      [landingRow - 1, column],
      [landingRow + 1, column],
      [landingRow, column - 1],
      [landingRow, column + 1],
    ];
    for (const [row, col] of neighbors) {
      if (
        row >= 0 && row < state.board.length &&
        col >= 0 && col < state.board[0].length &&
        state.board[row][col] === nextTile
      ) adjacency += 1;
    }

    // Prefer an immediate merge first, then a visibly lower landing point and
    // a position near the center. This makes the guided opening easy to follow.
    const score =
      simulated.state.lastGain * 1000 +
      landingRow * 20 +
      adjacency * 10 -
      Math.abs(column - center);

    if (score > bestScore) {
      bestScore = score;
      bestColumn = column;
    }
  }

  return bestColumn;
}

export function dropInColumn(current: GameState, column: number, forcedValue?: number): DropResult {
  if (current.gameOver || column < 0 || column >= current.board[0].length) {
    return { state: current, accepted: false };
  }

  const landingRow = getLandingRow(current.board, column);
  if (landingRow < 0) {
    return {
      state: { ...current, lastMessage: 'その列は満杯です。別の列をタップしてください' },
      accepted: false,
    };
  }

  const [nextSeed, generated] = generatedTile(current.seed);
  const value = forcedValue ?? generated;
  const board = cloneBoard(current.board);
  board[landingRow][column] = value;
  const resolved = resolveCascades(board);
  const movesLeft = current.movesLeft - 1;
  const noSpace = resolved.board[0].every((cell) => cell !== null);
  const gameOver = movesLeft <= 0 || noSpace;
  const message = resolved.chains > 0
    ? `合体成功！ ${resolved.chains > 1 ? `${resolved.chains}連鎖です` : '3つが1つに進化しました'}`
    : gameOver
      ? 'ラウンド終了'
      : '次も、同じ色の近くへ落として3つにしよう';

  return {
    accepted: true,
    state: {
      board: resolved.board,
      score: current.score + resolved.scoreGain,
      movesLeft,
      combo: resolved.chains,
      maxTile: Math.max(current.maxTile, value, resolved.maxTile),
      seed: forcedValue === undefined ? nextSeed : current.seed,
      gameOver,
      lastGain: resolved.scoreGain,
      lastMessage: message,
    },
  };
}

export function resolveCascades(input: Board): {
  board: Board;
  scoreGain: number;
  chains: number;
  maxTile: number;
} {
  let board = cloneBoard(input);
  let scoreGain = 0;
  let chains = 0;
  let maxTile = highestTile(board);

  while (true) {
    const groups = findMergeGroups(board);
    if (groups.length === 0) break;
    chains += 1;

    for (const group of groups) {
      const value = board[group[0].row][group[0].col] as number;
      const anchor = [...group].sort((a, b) => b.row - a.row || a.col - b.col)[0];
      for (const cell of group) board[cell.row][cell.col] = null;
      const upgraded = value + 1;
      board[anchor.row][anchor.col] = upgraded;
      maxTile = Math.max(maxTile, upgraded);
      scoreGain += group.length * 2 ** value * chains;
    }

    board = applyGravity(board);
  }

  return { board, scoreGain, chains, maxTile };
}

function findMergeGroups(board: Board): Array<Array<{ row: number; col: number }>> {
  const seen = new Set<string>();
  const groups: Array<Array<{ row: number; col: number }>> = [];
  const rows = board.length;
  const cols = board[0].length;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = board[row][col];
      const key = `${row}:${col}`;
      if (value === null || seen.has(key)) continue;

      const queue = [{ row, col }];
      const group: Array<{ row: number; col: number }> = [];
      seen.add(key);

      while (queue.length > 0) {
        const cell = queue.shift() as { row: number; col: number };
        group.push(cell);
        const neighbors = [
          { row: cell.row - 1, col: cell.col },
          { row: cell.row + 1, col: cell.col },
          { row: cell.row, col: cell.col - 1 },
          { row: cell.row, col: cell.col + 1 },
        ];
        for (const neighbor of neighbors) {
          if (
            neighbor.row >= 0 && neighbor.row < rows &&
            neighbor.col >= 0 && neighbor.col < cols &&
            board[neighbor.row][neighbor.col] === value
          ) {
            const neighborKey = `${neighbor.row}:${neighbor.col}`;
            if (!seen.has(neighborKey)) {
              seen.add(neighborKey);
              queue.push(neighbor);
            }
          }
        }
      }

      if (group.length >= 3) groups.push(group);
    }
  }
  return groups;
}

function applyGravity(board: Board): Board {
  const result = createEmptyBoard(board.length, board[0].length);
  for (let col = 0; col < board[0].length; col += 1) {
    let target = board.length - 1;
    for (let row = board.length - 1; row >= 0; row -= 1) {
      const value = board[row][col];
      if (value !== null) {
        result[target][col] = value;
        target -= 1;
      }
    }
  }
  return result;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function highestTile(board: Board): number {
  return board.reduce((highest, row) => Math.max(highest, ...row.map((cell) => cell ?? 0)), 0);
}
