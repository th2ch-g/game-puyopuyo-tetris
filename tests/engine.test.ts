import { describe, expect, it } from 'vitest';
import {
  advanceBoard,
  applyAction,
  applyGarbage,
  command,
  createBoard,
  createMatch,
  currentBoard,
  finishRound,
  forfeit,
  lockPiece,
  nextRound,
  pause,
  puyoGroups,
  settlePuyos,
  spawn,
  step,
  SWAP_MS,
  validConfig,
  validMatch,
} from '../src/game/engine';
import { cells, fillQueue, fits, ghost, rotation } from '../src/game/pieces';
import { plan, tickCPU } from '../src/game/ai';
import {
  DEFAULT_CONFIG,
  type Board,
  type Match,
  type MatchConfig,
  type Piece,
} from '../src/game/types';
import { InputRepeater } from '../src/lib/input';

const config = (patch: Partial<MatchConfig> = {}): MatchConfig => ({
  ...structuredClone(DEFAULT_CONFIG),
  ...patch,
});
const run = (match: Match, ms: number) => {
  for (let t = 0; t < ms; t += 20) step(match, 20);
};
const resolve = (board: Board) => {
  for (let t = 0; t < 100 && board.phase === 'clearing'; t++) advanceBoard(board, 300, 0);
};
function singleLine(board: Board, hole = 4) {
  board.grid[21] = Array.from({ length: 10 }, (_, x) => (x === hole ? 0 : 8));
  board.active = { type: 'I', colors: [], x: hole - 2, y: 18, rotation: 1 };
}

describe('piece generation and movement', () => {
  it('uses reproducible independent random streams and fair piece sequences', () => {
    const a = createMatch(config({ kinds: ['tetris', 'tetris'] }), 42),
      b = createMatch(config({ kinds: ['tetris', 'tetris'] }), 42);
    expect(a.players[0].boards.tetris.queue).toEqual(a.players[1].boards.tetris.queue);
    expect(a.players[0].boards.puyo.queue).toEqual(b.players[0].boards.puyo.queue);
    a.players[0].boards.puyo.rng = 777;
    expect(a.players[0].boards.tetris.queue).toEqual(b.players[0].boards.tetris.queue);
  });
  it('draws each tetromino exactly once per seven-bag', () => {
    const board = createBoard('tetris', 123);
    const pieces = [board.active!.type];
    for (let i = 0; i < 20; i++) {
      pieces.push(board.queue.shift()!.type);
      fillQueue(board);
    }
    for (let i = 0; i < 21; i += 7) expect(new Set(pieces.slice(i, i + 7)).size).toBe(7);
  });
  it('prevents moving through boundaries and occupied cells', () => {
    const board = createBoard('puyo', 1);
    board.active = { type: 'P', colors: [1, 2], x: 0, y: 3, rotation: 0 };
    expect(applyAction(board, 'left')).toBe(false);
    board.grid[3][1] = 3;
    expect(applyAction(board, 'right')).toBe(false);
    expect(board.active.x).toBe(0);
  });
  it('projects a collision-free landing without mutating the active piece', () => {
    const board = createBoard('tetris', 3),
      original = structuredClone(board.active);
    const projected = ghost(board)!;
    expect(fits(board, projected)).toBe(true);
    expect(fits(board, { ...projected, y: projected.y + 1 })).toBe(false);
    expect(board.active).toEqual(original);
  });
  it('applies SRS wall kicks to a T piece', () => {
    const board = createBoard('tetris', 1);
    board.active = { type: 'T', colors: [], x: -1, y: 5, rotation: 1 };
    expect(fits(board, board.active)).toBe(true);
    expect(applyAction(board, 'ccw')).toBe(true);
    expect(board.active.rotation).toBe(0);
    expect(board.active.x).toBe(0);
  });
  it('applies I-piece wall kicks and preserves O coordinates', () => {
    const board = createBoard('tetris', 1);
    board.active = { type: 'I', colors: [], x: -2, y: 8, rotation: 1 };
    expect(rotation(board, -1)?.piece.x).toBe(0);
    board.active = { type: 'O', colors: [], x: 3, y: 10, rotation: 0 };
    const before = cells(board.active);
    applyAction(board, 'cw');
    expect(cells(board.active)).toEqual(before);
  });
  it('kicks a puyo pair away from the wall', () => {
    const board = createBoard('puyo', 1);
    board.active = { type: 'P', colors: [1, 2], x: 5, y: 6, rotation: 0 };
    expect(applyAction(board, 'cw')).toBe(true);
    expect(board.active!.x).toBe(4);
  });
  it('allows hold only once per lock and swaps with a fresh orientation', () => {
    const board = createBoard('tetris', 1),
      first = board.active!.type,
      second = board.queue[0].type;
    expect(applyAction(board, 'hold')).toBe(true);
    expect(board.hold!.type).toBe(first);
    expect(board.active!.type).toBe(second);
    expect(applyAction(board, 'hold')).toBe(false);
    applyAction(board, 'drop');
    spawn(board);
    expect(applyAction(board, 'hold')).toBe(true);
    expect(board.active!.type).toBe(first);
    expect(board.active!.rotation).toBe(0);
    expect(applyAction(createBoard('puyo', 2), 'hold')).toBe(false);
  });
  it('locks after the delay and caps grounded lock resets', () => {
    const board = createBoard('tetris', 2);
    board.active = ghost(board);
    advanceBoard(board, 400, 0);
    expect(board.pieces).toBe(0);
    applyAction(board, 'left');
    expect(board.lock).toBe(0);
    board.resets = 15;
    board.lock = 450;
    applyAction(board, 'right');
    expect(board.lock).toBe(450);
    advanceBoard(board, 60, 0);
    expect(board.pieces).toBe(1);
  });
});

describe('puyo chains', () => {
  it('clears only orthogonally connected groups of four or more', () => {
    const b = createBoard('puyo', 1);
    b.grid[13] = [1, 1, 1, 1, 2, 0];
    b.grid[12][5] = 2;
    b.grid[11][4] = 2;
    b.grid[10][5] = 2;
    expect(puyoGroups(b).map((g) => g.length)).toEqual([4]);
  });
  it('splits horizontal pairs onto unequal column heights', () => {
    const b = createBoard('puyo', 1);
    b.grid[13][1] = 3;
    b.grid[12][1] = 3;
    b.active = { type: 'P', colors: [1, 2], x: 0, y: 11, rotation: 1 };
    lockPiece(b);
    expect(b.grid[13][0]).toBe(1);
    expect(b.grid[11][1]).toBe(2);
  });
  it('resolves a two-chain, scores bonuses, and removes adjacent garbage', () => {
    const b = createBoard('puyo', 1);
    b.grid[13] = [1, 1, 2, 0, 0, 3];
    b.grid[12][0] = 1;
    b.grid[12][2] = 8;
    b.grid[11][0] = 2;
    b.grid[10][0] = 2;
    b.active = { type: 'P', colors: [1, 2], x: 1, y: 11, rotation: 0 };
    lockPiece(b);
    expect(b.chain).toBe(1);
    expect(b.phase).toBe('clearing');
    resolve(b);
    expect(b.maxChain).toBe(2);
    expect(b.puyos).toBe(8);
    expect(b.grid.flat().includes(8)).toBe(false);
    expect(b.chainScore).toBe(360);
    expect(b.outbox).toBe(5);
    expect(b.remainder).toBe(10);
  });
  it('grants an all-clear bonus', () => {
    const b = createBoard('puyo', 1);
    b.grid[13] = [1, 1, 0, 0, 0, 0];
    b.active = { type: 'P', colors: [1, 1], x: 2, y: 13, rotation: 1 };
    lockPiece(b);
    resolve(b);
    expect(b.grid.flat().every((v) => v === 0)).toBe(true);
    expect(b.label).toBe('ALL CLEAR!');
    expect(b.score).toBe(2140);
    expect(b.outbox).toBe(30);
  });
  it('settles garbage with colors and never deletes cells', () => {
    const b = createBoard('puyo', 1);
    b.grid[2][0] = 1;
    b.grid[7][0] = 8;
    b.grid[10][0] = 2;
    settlePuyos(b);
    expect(b.grid.slice(11).map((r) => r[0])).toEqual([1, 8, 2]);
  });
  it('tops out at the marked spawn cell', () => {
    const b = createBoard('puyo', 1);
    b.grid[2][2] = 1;
    spawn(b);
    expect(b.phase).toBe('dead');
  });
});

describe('tetris clearing and scoring', () => {
  it('clears a row and preserves cells above it', () => {
    const b = createBoard('tetris', 1);
    singleLine(b);
    applyAction(b, 'drop');
    expect(b.lines).toBe(1);
    expect(b.phase).toBe('clearing');
    resolve(b);
    expect(b.grid[21][4]).toBe(1);
    expect(b.grid[21].filter(Boolean)).toHaveLength(1);
  });
  it('scores a four-line perfect clear and sends garbage', () => {
    const b = createBoard('tetris', 1);
    for (let y = 18; y < 22; y++)
      b.grid[y] = Array.from({ length: 10 }, (_, x) => (x === 4 ? 0 : 8));
    b.active = { type: 'I', colors: [], x: 2, y: 18, rotation: 1 };
    lockPiece(b);
    expect(b.lines).toBe(4);
    expect(b.outbox).toBe(84);
    expect(b.label).toBe('PERFECT CLEAR!');
    resolve(b);
    expect(b.grid.flat().every((v) => v === 0)).toBe(true);
  });
  it('recognizes a T-spin with three blocked corners', () => {
    const b = createBoard('tetris', 1);
    b.grid[19][3] = 8;
    b.grid[19][5] = 8;
    b.grid[21][3] = 8;
    b.active = { type: 'T', colors: [], x: 3, y: 19, rotation: 0 };
    b.rotated = true;
    lockPiece(b);
    expect(b.label).toBe('T-SPIN');
    expect(b.score).toBe(400);
  });
  it('does not award a T-spin without a final rotation', () => {
    const b = createBoard('tetris', 1);
    b.grid[19][3] = 8;
    b.grid[19][5] = 8;
    b.grid[21][3] = 8;
    b.active = { type: 'T', colors: [], x: 3, y: 19, rotation: 0 };
    lockPiece(b);
    expect(b.score).toBe(0);
  });
  it('maintains back-to-back through empty locks and ends it on a single', () => {
    const b = createBoard('tetris', 1);
    b.b2b = true;
    applyAction(b, 'drop');
    expect(b.b2b).toBe(true);
    b.grid = Array.from({ length: 22 }, () => Array(10).fill(0));
    spawn(b);
    singleLine(b);
    applyAction(b, 'drop');
    expect(b.b2b).toBe(false);
  });
  it('tops out when a piece locks entirely in hidden rows', () => {
    const b = createBoard('tetris', 1);
    b.active = { type: 'O', colors: [], x: 3, y: 0, rotation: 0 };
    b.grid[2][4] = 8;
    b.grid[2][5] = 8;
    lockPiece(b);
    expect(b.phase).toBe('dead');
  });
});

describe('attacks, rounds, and swap', () => {
  it('converts puyo units to whole tetris rows and retains remainders', () => {
    const b = createBoard('tetris', 1);
    expect(applyGarbage(b, 17)).toBe(12);
    expect(b.grid[20].filter(Boolean)).toHaveLength(9);
    expect(b.grid[21].filter(Boolean)).toHaveLength(9);
    expect(applyGarbage(b, 5)).toBe(0);
  });
  it('caps a puyo garbage drop at 30 and distributes partial rows without duplicates', () => {
    const b = createBoard('puyo', 1);
    expect(applyGarbage(b, 40)).toBe(30);
    expect(b.grid.flat().filter((v) => v === 8)).toHaveLength(30);
    const c = createBoard('puyo', 1);
    applyGarbage(c, 5);
    expect(c.grid[13].filter((v) => v === 8)).toHaveLength(5);
  });
  it('detects overflow when receiving garbage', () => {
    const b = createBoard('tetris', 1);
    b.grid[0][0] = 8;
    applyGarbage(b, 6);
    expect(b.phase).toBe('dead');
  });
  it('cancels incoming attacks before sending the remainder', () => {
    const m = createMatch(config(), 1);
    m.phase = 'playing';
    const b = currentBoard(m.players[0]);
    b.phase = 'ready';
    b.outbox = 18;
    m.players[0].incoming = 12;
    step(m);
    expect(m.players[0].incoming).toBe(0);
    expect(m.players[1].incoming).toBe(6);
    expect(b.attack).toBe(6);
  });
  it('cancels simultaneous outgoing attacks symmetrically', () => {
    const m = createMatch(config(), 1);
    m.phase = 'playing';
    for (const p of m.players) {
      currentBoard(p).phase = 'ready';
      currentBoard(p).outbox = 12;
    }
    step(m);
    expect(m.players.map((p) => p.incoming)).toEqual([0, 0]);
  });
  it('does not advance or accept input while paused', () => {
    const m = createMatch(config(), 1);
    run(m, 3000);
    pause(m);
    const before = structuredClone(m);
    run(m, 1000);
    expect(command(m, 0, 'drop')).toBe(false);
    expect(m).toEqual(before);
    pause(m);
    expect(m.phase).toBe('playing');
  });
  it('runs a countdown and ends a best-of match only at the configured win count', () => {
    const m = createMatch(config(), 1);
    expect(command(m, 0, 'drop')).toBe(false);
    run(m, 3000);
    expect(m.phase).toBe('playing');
    finishRound(m, 0, 'test');
    expect(m.phase).toBe('roundEnd');
    run(m, 2200);
    expect(m.round).toBe(2);
    expect(m.players[0].wins).toBe(1);
    run(m, 3000);
    finishRound(m, 0, 'test');
    expect(m.phase).toBe('finished');
    expect(m.winner).toBe(0);
  });
  it('preserves both board states when swapping and does not switch mid-clear', () => {
    const m = createMatch(config({ rule: 'swap' }), 1);
    m.phase = 'playing';
    m.swapIn = 1;
    const b = m.players[0].boards.puyo;
    b.grid[13][0] = 3;
    b.phase = 'clearing';
    b.delay = 500;
    step(m, 20);
    expect(m.players[0].kind).toBe('puyo');
    b.phase = 'falling';
    step(m, 20);
    expect(m.players[0].kind).toBe('tetris');
    expect(b.grid[13][0]).toBe(3);
    expect(m.swapIn).toBe(SWAP_MS);
  });
  it('supports a draw when both players top out on the same tick', () => {
    const m = createMatch(config(), 1);
    m.phase = 'playing';
    for (const p of m.players) currentBoard(p).phase = 'dead';
    step(m);
    expect(m.winner).toBe(null);
    expect(m.players.map((p) => p.wins)).toEqual([0, 0]);
    expect(m.phase).toBe('roundEnd');
  });
  it('finishes solo challenges and records a forfeit without awarding a solo win', () => {
    const m = createMatch(config({ mode: 'sprint', kinds: ['tetris', 'puyo'] }), 1);
    m.phase = 'playing';
    currentBoard(m.players[0]).lines = 40;
    step(m);
    expect(m.phase).toBe('finished');
    expect(m.winner).toBe(0);
    const p = createMatch(config({ mode: 'sprint' }), 1);
    p.phase = 'playing';
    p.elapsed = 119999;
    step(p);
    expect(p.reason).toBe('120秒終了');
    const practice = createMatch(config({ mode: 'practice' }), 2);
    forfeit(practice, 0);
    expect(practice.winner).toBe(null);
    expect(practice.phase).toBe('finished');
  });
  it('rejects corrupt saves and nonfinite timings', () => {
    const m = createMatch(config(), 1);
    expect(validMatch(m)).toBe(true);
    expect(validConfig({})).toBe(false);
    const before = structuredClone(m);
    step(m, NaN);
    expect(m).toEqual(before);
    for (const corrupted of [null, {}, { ...m, players: null }, { ...m, elapsed: NaN }])
      expect(validMatch(corrupted)).toBe(false);
    m.players[0].boards.puyo.grid[0][0] = 999;
    expect(validMatch(m)).toBe(false);
  });
  it('rejects malformed pieces, CPU plans, and display fields in snapshots', () => {
    const broken: unknown[] = [];
    for (const mutate of [
      (m: Match) => {
        m.players[0].cpuPlan = null as never;
      },
      (m: Match) => {
        m.players[0].boards.puyo.queue[0] = null as never;
      },
      (m: Match) => {
        m.players[0].boards.puyo.label = {} as never;
      },
      (m: Match) => {
        m.reason = {} as never;
      },
      (m: Match) => {
        m.players[1].boards.tetris.active!.type = 'P';
      },
    ]) {
      const m = createMatch(config(), 1);
      mutate(m);
      broken.push(m);
    }
    for (const value of broken) expect(validMatch(value)).toBe(false);
  });
  it('accepts snapshots while a swap waits for an active chain', () => {
    const m = createMatch(config({ rule: 'swap' }), 1);
    m.phase = 'playing';
    m.swapIn = -500;
    expect(validMatch(m)).toBe(true);
  });
});

describe('CPU and input handling', () => {
  it('finds a reachable line-clearing placement', () => {
    const b = createBoard('tetris', 1);
    b.grid[21] = [8, 8, 8, 8, 0, 0, 0, 0, 8, 8];
    b.active = { type: 'I', colors: [], x: 3, y: 0, rotation: 0 };
    const actions = plan(b, 'hard');
    for (const action of actions) applyAction(b, action);
    expect(b.lines).toBe(1);
    expect(actions.at(-1)).toBe('drop');
  });
  it('plays both rules without using illegal moves', () => {
    for (const kind of ['puyo', 'tetris'] as const) {
      const m = createMatch(config({ kinds: [kind, kind], difficulty: 'hard' }), 123);
      m.phase = 'playing';
      for (let i = 0; i < 600; i++) {
        tickCPU(m, 20);
        step(m, 20);
      }
      expect(currentBoard(m.players[1]).pieces).toBeGreaterThan(3);
      expect(validMatch(m)).toBe(true);
    }
  });
  it('repeats directional inputs, never repeats drop, and releases canceled pointers', () => {
    const calls: string[] = [];
    const input = new InputRepeater(
      (p, a) => calls.push(`${p}:${a}`),
      () => ({ das: 160, arr: 40 }),
    );
    input.press('left', 0, 'left');
    input.tick(159);
    expect(calls).toHaveLength(1);
    input.tick(1);
    expect(calls).toHaveLength(2);
    input.release('left');
    input.tick(500);
    expect(calls).toHaveLength(2);
    input.press('drop', 0, 'drop');
    input.tick(500);
    expect(calls.filter((c) => c === '0:drop')).toHaveLength(1);
    input.press('right', 1, 'right');
    input.clear();
    input.tick(500);
    expect(calls.at(-1)).toBe('1:right');
  });
});
