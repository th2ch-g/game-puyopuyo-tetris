import { advanceBoard, applyAction, currentBoard, lockPiece } from './engine';
import { fits, ghost, rotation } from './pieces';
import type { Action, Board, Difficulty, Match, Piece } from './types';

interface Candidate {
  piece: Piece;
  path: Action[];
  score: number;
}

function evaluate(board: Board): number {
  const heights: number[] = [];
  let holes = 0,
    buried = 0,
    neighbors = 0;
  for (let x = 0; x < board.width; x++) {
    let height = 0,
      filled = false;
    for (let y = 0; y < board.height; y++) {
      const color = board.grid[y][x];
      if (color) {
        if (!filled) {
          height = board.height - y;
          filled = true;
        }
        if (color !== 8) {
          if (board.grid[y]?.[x + 1] === color) neighbors++;
          if (board.grid[y + 1]?.[x] === color) neighbors++;
          if (y > 0 && board.grid[y - 1][x] && board.grid[y - 1][x] !== color) buried++;
        }
      } else if (filled) holes++;
    }
    heights.push(height);
  }
  const max = Math.max(...heights);
  const total = heights.reduce((a, b) => a + b, 0);
  const bump = heights.slice(1).reduce((sum, h, i) => sum + Math.abs(h - heights[i]), 0);
  if (board.kind === 'tetris')
    return (
      board.lines * 9 +
      board.attack * 2 -
      holes * 11 -
      total * 0.6 -
      bump * 0.3 -
      Math.max(0, max - 14) * 5
    );
  return (
    board.maxChain * 50 +
    board.puyos * 3 +
    neighbors * 2.5 -
    buried * 0.6 -
    total * 0.9 -
    bump * 0.45 -
    Math.max(0, max - 8) * 9 -
    (heights[2] > 10 ? 40 : 0)
  );
}

function scorePlacement(board: Board, piece: Piece): number {
  const copy = structuredClone(board);
  copy.active = piece;
  copy.phase = 'falling';
  copy.lines = 0;
  copy.puyos = 0;
  copy.maxChain = 0;
  copy.attack = 0;
  lockPiece(copy);
  for (let i = 0; i < 40 && (copy.phase as Board['phase']) === 'clearing'; i++)
    advanceBoard(copy, 300, 0);
  return (copy.phase as Board['phase']) === 'dead' ? -100_000 : evaluate(copy);
}

export function plan(board: Board, difficulty: Difficulty): Action[] {
  if (!board.active || board.phase !== 'falling') return [];
  const pending: { piece: Piece; path: Action[] }[] = [{ piece: { ...board.active }, path: [] }];
  const visited = new Set<string>();
  const landed = new Map<string, Candidate>();
  let index = 0;
  const scratch = { ...board };
  while (index < pending.length && index < 1200) {
    const node = pending[index++];
    const key = `${node.piece.x},${node.piece.y},${node.piece.rotation}`;
    if (visited.has(key)) continue;
    visited.add(key);
    scratch.active = node.piece;
    const landing = ghost(scratch)!;
    const landingKey = `${landing.x},${landing.y},${landing.rotation}`;
    if (!landed.has(landingKey))
      landed.set(landingKey, {
        piece: landing,
        path: [...node.path, 'drop'],
        score: scorePlacement(board, landing),
      });
    if (node.path.length > 15) continue;
    for (const action of ['left', 'right', 'cw', 'ccw', 'down'] as Action[]) {
      let piece: Piece | null = null;
      if (action === 'cw' || action === 'ccw')
        piece = rotation(scratch, action === 'cw' ? 1 : -1)?.piece || null;
      else {
        const moved = {
          ...node.piece,
          x: node.piece.x + (action === 'left' ? -1 : action === 'right' ? 1 : 0),
          y: node.piece.y + (action === 'down' ? 1 : 0),
        };
        if (fits(scratch, moved)) piece = moved;
      }
      if (piece) pending.push({ piece, path: [...node.path, action] });
    }
  }
  const candidates = [...landed.values()].sort(
    (a, b) => b.score - a.score || a.path.length - b.path.length,
  );
  const noise = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 1 : 0;
  const choice = Math.min(candidates.length - 1, (board.rng >>> 8) % (noise + 1));
  return candidates[choice]?.path || ['drop'];
}

export function tickCPU(match: Match, dt: number) {
  if (match.config.mode !== 'cpu' || match.phase !== 'playing') return;
  const player = match.players[1],
    board = currentBoard(player);
  if (board.phase !== 'falling') {
    player.cpuPlan = [];
    return;
  }
  player.cpuClock += dt;
  const speed = { easy: 180, normal: 95, hard: 42 }[match.config.difficulty];
  if (player.cpuClock < speed) return;
  player.cpuClock = 0;
  if (!player.cpuPlan.length) player.cpuPlan = plan(board, match.config.difficulty);
  const action = player.cpuPlan.shift();
  if (action && !applyAction(board, action)) player.cpuPlan = [];
  if (action === 'drop')
    player.cpuClock = -{ easy: 800, normal: 400, hard: 120 }[match.config.difficulty];
}
