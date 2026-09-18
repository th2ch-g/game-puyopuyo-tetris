import type { Board, Cell, Piece, Tetromino } from './types';

const SHAPES: Record<Tetromino, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 2, 2, 0],
    [0, 2, 2, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
};

export function cells(piece: Piece): Cell[] {
  if (piece.type === 'P') {
    const [dx, dy] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][piece.rotation];
    return [
      { x: piece.x, y: piece.y, color: piece.colors[0] },
      { x: piece.x + dx, y: piece.y + dy, color: piece.colors[1] },
    ];
  }
  let matrix = SHAPES[piece.type];
  if (piece.type !== 'O')
    for (let r = 0; r < piece.rotation; r++)
      matrix = matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());
  return matrix.flatMap((row, y) =>
    row.flatMap((color, x) => (color ? [{ x: piece.x + x, y: piece.y + y, color }] : [])),
  );
}

export function fits(board: Board, piece: Piece): boolean {
  return cells(piece).every(
    ({ x, y }) => x >= 0 && x < board.width && y >= 0 && y < board.height && board.grid[y][x] === 0,
  );
}

export function ghost(board: Board): Piece | null {
  if (!board.active) return null;
  const piece = { ...board.active };
  while (fits(board, { ...piece, y: piece.y + 1 })) piece.y++;
  return piece;
}

// SRS kick coordinates use an upward-positive y axis.
const JLSTZ: Record<string, number[][]> = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};
const I_KICKS: Record<string, number[][]> = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

export function rotation(board: Board, direction: number): { piece: Piece; kick: number } | null {
  const active = board.active;
  if (!active) return null;
  const next = (active.rotation + direction + 4) % 4;
  const kicks =
    active.type === 'P'
      ? [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, 1],
        ]
      : active.type === 'O'
        ? [[0, 0]]
        : (active.type === 'I' ? I_KICKS : JLSTZ)[`${active.rotation}>${next}`];
  for (let i = 0; i < kicks.length; i++) {
    const [dx, dy] = kicks[i];
    const piece = { ...active, rotation: next, x: active.x + dx, y: active.y - dy };
    if (fits(board, piece)) return { piece, kick: i };
  }
  if (active.type === 'P') {
    const piece = { ...active, rotation: (active.rotation + 2) % 4 };
    if (fits(board, piece)) return { piece, kick: 4 };
  }
  return null;
}

export function random(board: Pick<Board, 'rng'>): number {
  let x = board.rng || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  board.rng = x >>> 0;
  return board.rng / 4294967296;
}

export function fillQueue(board: Board) {
  while (board.queue.length < 6) {
    if (board.kind === 'puyo') {
      board.queue.push({
        type: 'P',
        colors: [1 + Math.floor(random(board) * 4), 1 + Math.floor(random(board) * 4)],
        x: 2,
        y: 1,
        rotation: 0,
      });
    } else {
      if (!board.bag.length) {
        board.bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        for (let i = 6; i > 0; i--) {
          const j = Math.floor(random(board) * (i + 1));
          [board.bag[i], board.bag[j]] = [board.bag[j], board.bag[i]];
        }
      }
      board.queue.push({ type: board.bag.pop()!, colors: [], x: 3, y: 0, rotation: 0 });
    }
  }
}
