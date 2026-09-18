import type { Action, Board, Cell, Kind, Match, MatchConfig, Piece, Player } from './types';
import { cells, fillQueue, fits, ghost, random, rotation } from './pieces';

export const HIDDEN = 2;
export const SWAP_MS = 25_000;
export const TICK_MS = 1000 / 60;

export function createBoard(kind: Kind, seed: number): Board {
  const width = kind === 'puyo' ? 6 : 10;
  const height = kind === 'puyo' ? 14 : 22;
  const board: Board = {
    kind,
    width,
    height,
    grid: Array.from({ length: height }, () => Array(width).fill(0)),
    rng: seed || 1,
    queue: [],
    bag: [],
    active: null,
    hold: null,
    held: false,
    phase: 'ready',
    gravity: 0,
    lock: 0,
    resets: 0,
    rotated: false,
    lastKick: 0,
    clearCells: [],
    clearRows: [],
    delay: 0,
    chain: 0,
    chainScore: 0,
    remainder: 0,
    outbox: 0,
    combo: -1,
    b2b: false,
    score: 0,
    lines: 0,
    puyos: 0,
    pieces: 0,
    maxChain: 0,
    attack: 0,
    label: '',
    labelTime: 0,
    event: 0,
  };
  spawn(board);
  return board;
}

export function spawn(board: Board, replacement?: Piece) {
  fillQueue(board);
  const piece = replacement || board.queue.shift()!;
  board.active = {
    ...piece,
    x: board.kind === 'puyo' ? 2 : 3,
    y: board.kind === 'puyo' ? 1 : 0,
    rotation: 0,
  };
  board.gravity = 0;
  board.lock = 0;
  board.resets = 0;
  board.rotated = false;
  board.chain = 0;
  board.chainScore = 0;
  board.phase =
    fits(board, board.active) && !(board.kind === 'puyo' && board.grid[HIDDEN][2])
      ? 'falling'
      : 'dead';
  fillQueue(board);
}

function announce(board: Board, label: string) {
  board.label = label;
  board.labelTime = 1500;
  board.event++;
}

export function applyAction(board: Board, action: Action): boolean {
  if (board.phase !== 'falling' || !board.active) return false;
  const active = board.active;
  const grounded = !fits(board, { ...active, y: active.y + 1 });
  if (action === 'hold') {
    if (board.kind !== 'tetris' || board.held) return false;
    const hold = board.hold;
    board.hold = { ...active, rotation: 0 };
    spawn(board, hold || undefined);
    board.held = true;
    return true;
  }
  if (action === 'drop') {
    const landed = ghost(board)!;
    board.score += (landed.y - active.y) * 2;
    board.active = landed;
    lockPiece(board);
    return true;
  }
  if (action === 'cw' || action === 'ccw') {
    const result = rotation(board, action === 'cw' ? 1 : -1);
    if (!result) return false;
    board.active = result.piece;
    board.rotated = true;
    board.lastKick = result.kick;
  } else {
    const piece = {
      ...active,
      x: active.x + (action === 'left' ? -1 : action === 'right' ? 1 : 0),
      y: active.y + (action === 'down' ? 1 : 0),
    };
    if (!fits(board, piece)) return false;
    board.active = piece;
    if (action === 'down') board.score++;
    else board.rotated = false;
  }
  if (grounded && board.resets < 15) {
    board.lock = 0;
    board.resets++;
  }
  return true;
}

export function settlePuyos(board: Board) {
  for (let x = 0; x < board.width; x++) {
    let target = board.height - 1;
    for (let y = board.height - 1; y >= 0; y--)
      if (board.grid[y][x]) {
        const value = board.grid[y][x];
        board.grid[y][x] = 0;
        board.grid[target--][x] = value;
      }
  }
}

export function puyoGroups(board: Board): Cell[][] {
  const visited = new Set<string>();
  const groups: Cell[][] = [];
  for (let y = HIDDEN; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      const color = board.grid[y][x];
      if (!color || color === 8 || visited.has(`${x},${y}`)) continue;
      const group: Cell[] = [];
      const pending = [{ x, y, color }];
      while (pending.length) {
        const cell = pending.pop()!;
        const key = `${cell.x},${cell.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        group.push(cell);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cell.x + dx,
            ny = cell.y + dy;
          if (
            nx >= 0 &&
            nx < board.width &&
            ny >= HIDDEN &&
            ny < board.height &&
            board.grid[ny][nx] === color &&
            !visited.has(`${nx},${ny}`)
          )
            pending.push({ x: nx, y: ny, color });
        }
      }
      if (group.length >= 4) groups.push(group);
    }
  return groups;
}

function beginPuyoClear(board: Board): boolean {
  const groups = puyoGroups(board);
  if (!groups.length) return false;
  board.chain++;
  board.maxChain = Math.max(board.maxChain, board.chain);
  const colored = groups.flat();
  const colors = new Set(colored.map((c) => c.color)).size;
  const chainPower = [
    0, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480,
  ][Math.min(18, board.chain)];
  const groupBonus = groups.reduce(
    (sum, g) => sum + (g.length <= 4 ? 0 : g.length <= 10 ? g.length - 3 : 10),
    0,
  );
  const multiplier = Math.min(999, Math.max(1, chainPower + [0, 0, 3, 6, 12][colors] + groupBonus));
  const score = colored.length * 10 * multiplier;
  board.score += score;
  board.chainScore += score;
  board.puyos += colored.length;
  const clear = new Map(colored.map((c) => [`${c.x},${c.y}`, c]));
  for (const cell of colored)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = cell.x + dx,
        y = cell.y + dy;
      if (board.grid[y]?.[x] === 8) clear.set(`${x},${y}`, { x, y, color: 8 });
    }
  board.clearCells = [...clear.values()];
  board.phase = 'clearing';
  board.delay = 290;
  announce(board, `${board.chain} CHAIN!`);
  return true;
}

function finishPuyo(board: Board) {
  if (board.chain > 0 && board.grid.every((row) => row.every((v) => v === 0))) {
    board.score += 2100;
    board.chainScore += 2100;
    announce(board, 'ALL CLEAR!');
  }
  const total = board.chainScore + board.remainder;
  board.outbox += Math.floor(total / 70);
  board.remainder = total % 70;
  board.phase = 'ready';
}

function tSpin(board: Board, piece: Piece): 'full' | 'mini' | null {
  if (piece.type !== 'T' || !board.rotated) return null;
  const cx = piece.x + 1,
    cy = piece.y + 1;
  const blocked = (x: number, y: number) =>
    x < 0 || x >= board.width || y < 0 || y >= board.height || board.grid[y][x] !== 0;
  const corners = [
    [cx - 1, cy - 1],
    [cx + 1, cy - 1],
    [cx + 1, cy + 1],
    [cx - 1, cy + 1],
  ].map(([x, y]) => blocked(x, y));
  if (corners.filter(Boolean).length < 3) return null;
  const fronts = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ][piece.rotation];
  return fronts.every((i) => corners[i]) || board.lastKick === 4 ? 'full' : 'mini';
}

export function lockPiece(board: Board) {
  if (!board.active || board.phase !== 'falling') return;
  const piece = board.active;
  const spin = board.kind === 'tetris' ? tSpin(board, piece) : null;
  const placed = cells(piece);
  for (const { x, y, color } of placed) board.grid[y][x] = color;
  board.active = null;
  board.held = false;
  board.pieces++;
  if (board.kind === 'puyo') {
    settlePuyos(board);
    if (!beginPuyoClear(board)) finishPuyo(board);
    return;
  }
  const rows = board.grid.flatMap((row, y) => (row.every(Boolean) ? [y] : []));
  const count = rows.length;
  if (!count) {
    board.combo = -1;
    if (spin) {
      board.score += spin === 'full' ? 400 : 100;
      announce(board, spin === 'full' ? 'T-SPIN' : 'MINI T-SPIN');
    }
    board.phase = placed.every((c) => c.y < HIDDEN) ? 'dead' : 'ready';
    return;
  }
  board.lines += count;
  board.combo++;
  const difficult = count === 4 || !!spin;
  let attack =
    spin === 'full'
      ? [0, 2, 4, 6][count]
      : spin === 'mini'
        ? [0, 0, 1, 2][count]
        : [0, 0, 1, 2, 4][count];
  let score =
    spin === 'full'
      ? [400, 800, 1200, 1600][count]
      : spin === 'mini'
        ? [100, 200, 400, 600][count]
        : [0, 100, 300, 500, 800][count];
  if (difficult && board.b2b) {
    attack++;
    score = Math.floor(score * 1.5);
  }
  attack += Math.min(4, Math.floor((board.combo + 1) / 2));
  score += Math.max(0, board.combo) * 50;
  board.b2b = difficult;
  const perfect = board.grid.every((row, y) => rows.includes(y) || row.every((v) => !v));
  if (perfect) {
    attack += 10;
    score += 3500;
  }
  board.outbox += attack * 6;
  board.score += score * (1 + Math.floor(board.lines / 10));
  board.clearRows = rows;
  board.clearCells = rows.flatMap((y) => board.grid[y].map((color, x) => ({ x, y, color })));
  board.phase = 'clearing';
  board.delay = 220;
  announce(
    board,
    perfect
      ? 'PERFECT CLEAR!'
      : spin
        ? `${spin === 'mini' ? 'MINI ' : ''}T-SPIN${count > 1 ? ' ' + count : ''}`
        : count === 4
          ? 'TETRIS!'
          : board.combo > 0
            ? `${board.combo + 1} COMBO!`
            : ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][count],
  );
}

export function advanceBoard(board: Board, dt: number, elapsed: number) {
  board.labelTime = Math.max(0, board.labelTime - dt);
  if (board.phase === 'clearing') {
    board.delay -= dt;
    if (board.delay > 0) return;
    if (board.kind === 'tetris') {
      board.grid = board.grid.filter((_, y) => !board.clearRows.includes(y));
      while (board.grid.length < board.height) board.grid.unshift(Array(board.width).fill(0));
      board.clearCells = [];
      board.clearRows = [];
      board.phase = 'ready';
    } else {
      for (const { x, y } of board.clearCells) board.grid[y][x] = 0;
      board.clearCells = [];
      settlePuyos(board);
      if (!beginPuyoClear(board)) finishPuyo(board);
    }
    return;
  }
  if (board.phase !== 'falling' || !board.active) return;
  const level =
    Math.floor(elapsed / 45_000) + (board.kind === 'tetris' ? Math.floor(board.lines / 10) : 0);
  const interval = Math.max(65, (board.kind === 'puyo' ? 850 : 900) * Math.pow(0.8, level));
  board.gravity += dt;
  while (board.gravity >= interval && board.active) {
    board.gravity -= interval;
    const down: Piece = { ...board.active, y: board.active.y + 1 };
    if (fits(board, down)) board.active = down;
    else break;
  }
  if (board.active && !fits(board, { ...board.active, y: board.active.y + 1 })) {
    board.lock += dt;
    if (board.lock >= 500) lockPiece(board);
  } else board.lock = 0;
}

export function applyGarbage(board: Board, units: number): number {
  if (units <= 0 || board.phase === 'dead') return 0;
  if (board.kind === 'tetris') {
    const lines = Math.min(8, Math.floor(units / 6));
    const hole = Math.floor(random(board) * board.width);
    for (let i = 0; i < lines; i++) {
      if (board.grid.shift()!.some(Boolean)) board.phase = 'dead';
      board.grid.push(Array.from({ length: board.width }, (_, x) => (x === hole ? 0 : 8)));
    }
    return lines * 6;
  }
  const count = Math.min(30, units);
  const order = [0, 1, 2, 3, 4, 5];
  for (let i = 5; i > 0; i--) {
    const j = Math.floor(random(board) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < count; i++) {
    const x = order[i % 6];
    let y = board.height - 1;
    while (y >= 0 && board.grid[y][x]) y--;
    if (y < 0) {
      board.phase = 'dead';
      break;
    }
    board.grid[y][x] = 8;
  }
  return count;
}

function createPlayer(name: string, kind: Kind, seed: number, wins = 0): Player {
  return {
    name,
    kind,
    boards: { puyo: createBoard('puyo', seed), tetris: createBoard('tetris', seed ^ 0x5f3759df) },
    incoming: 0,
    wins,
    cpuClock: 0,
    cpuPlan: [],
  };
}

export function createMatch(config: MatchConfig, seed = Date.now() >>> 0): Match {
  return {
    version: 1,
    id: `${seed.toString(36)}-${Date.now().toString(36)}`,
    seed,
    config: structuredClone(config),
    players: [
      createPlayer(config.names[0], config.kinds[0], seed),
      createPlayer(config.names[1], config.kinds[1], seed),
    ],
    phase: 'countdown',
    resumePhase: 'countdown',
    timer: 3000,
    elapsed: 0,
    roundElapsed: 0,
    swapIn: SWAP_MS,
    round: 1,
    winner: null,
    reason: '',
    revision: 0,
  };
}

export function currentBoard(player: Player) {
  return player.boards[player.kind];
}
export function isSolo(match: Match) {
  return ['practice', 'sprint'].includes(match.config.mode);
}
export function command(match: Match, player: number, action: Action) {
  if (match.phase !== 'playing' || player < 0 || player > 1 || (player === 1 && isSolo(match)))
    return false;
  const changed = applyAction(currentBoard(match.players[player]), action);
  if (changed) match.revision++;
  return changed;
}

export function pause(match: Match) {
  if (match.phase === 'paused') {
    match.phase = match.resumePhase;
    return;
  }
  if (match.phase === 'playing' || match.phase === 'countdown') {
    match.resumePhase = match.phase;
    match.phase = 'paused';
  }
}

export function finishRound(match: Match, winner: number | null, reason: string) {
  if (match.phase === 'finished' || match.phase === 'roundEnd') return;
  match.winner = winner;
  match.reason = reason;
  if (winner !== null) match.players[winner].wins++;
  match.phase =
    isSolo(match) || (winner !== null && match.players[winner].wins >= match.config.firstTo)
      ? 'finished'
      : 'roundEnd';
  match.timer = 2200;
  match.revision++;
}

export function forfeit(match: Match, index: number) {
  finishRound(match, isSolo(match) ? null : 1 - index, 'リタイア');
  match.phase = 'finished';
}

export function nextRound(match: Match) {
  match.round++;
  match.roundElapsed = 0;
  match.swapIn = SWAP_MS;
  match.winner = null;
  match.reason = '';
  const seed = (match.seed + match.round * 7919) >>> 0;
  match.players = match.players.map((p, i) =>
    createPlayer(p.name, match.config.kinds[i], seed, p.wins),
  ) as [Player, Player];
  match.phase = 'countdown';
  match.timer = 3000;
}

export function step(match: Match, dt = TICK_MS) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(100, dt);
  if (match.phase === 'paused' || match.phase === 'finished') return;
  if (match.phase === 'countdown' || match.phase === 'roundEnd') {
    match.timer = Math.max(0, match.timer - dt);
    if (match.timer <= 0.001) {
      if (match.phase === 'countdown') match.phase = 'playing';
      else nextRound(match);
    }
    match.revision++;
    return;
  }
  match.elapsed += dt;
  match.roundElapsed += dt;
  const players = isSolo(match) ? [match.players[0]] : match.players;
  for (const player of players) advanceBoard(currentBoard(player), dt, match.elapsed);
  const outgoing = [0, 0];
  for (let i = 0; i < players.length; i++) {
    const player = players[i],
      board = currentBoard(player);
    if (board.phase === 'ready') {
      const canceled = Math.min(player.incoming, board.outbox);
      player.incoming -= canceled;
      board.outbox -= canceled;
      outgoing[i] = board.outbox;
      board.attack += board.outbox;
      board.outbox = 0;
    }
  }
  if (!isSolo(match)) {
    const canceled = Math.min(...outgoing);
    match.players[0].incoming += outgoing[1] - canceled;
    match.players[1].incoming += outgoing[0] - canceled;
  }
  for (const player of players) {
    const board = currentBoard(player);
    if (board.phase === 'ready') {
      player.incoming -= applyGarbage(board, player.incoming);
      if ((board.phase as Board['phase']) !== 'dead') spawn(board);
    }
  }
  const dead = players.map((p) => currentBoard(p).phase === 'dead');
  if (dead.some(Boolean)) {
    finishRound(
      match,
      isSolo(match) ? null : dead.every(Boolean) ? null : dead[0] ? 1 : 0,
      'トップアウト',
    );
    return;
  }
  if (match.config.mode === 'sprint') {
    const board = currentBoard(players[0]);
    if (board.kind === 'tetris' && board.lines >= 40) finishRound(match, 0, '40ライン達成');
    else if (board.kind === 'puyo' && match.elapsed >= 120_000) finishRound(match, 0, '120秒終了');
  }
  if (match.config.rule === 'swap' && !isSolo(match)) {
    match.swapIn -= dt;
    if (match.swapIn <= 0 && players.every((p) => currentBoard(p).phase !== 'clearing')) {
      for (const player of players) {
        player.kind = player.kind === 'puyo' ? 'tetris' : 'puyo';
        player.cpuPlan = [];
      }
      match.swapIn = SWAP_MS;
    }
  }
  match.revision++;
}

export function validConfig(value: unknown): value is MatchConfig {
  const c = value as MatchConfig;
  return (
    !!c &&
    ['cpu', 'local', 'online', 'practice', 'sprint'].includes(c.mode) &&
    ['versus', 'swap'].includes(c.rule) &&
    Array.isArray(c.kinds) &&
    c.kinds.length === 2 &&
    c.kinds.every((k) => ['puyo', 'tetris'].includes(k)) &&
    Array.isArray(c.names) &&
    c.names.length === 2 &&
    c.names.every((n) => typeof n === 'string' && n.length > 0 && n.length <= 16) &&
    ['easy', 'normal', 'hard'].includes(c.difficulty) &&
    [1, 2, 3].includes(c.firstTo)
  );
}

export function validMatch(value: unknown): value is Match {
  try {
    const m = value as Match;
    if (
      !m ||
      m.version !== 1 ||
      typeof m.id !== 'string' ||
      m.id.length > 100 ||
      typeof m.reason !== 'string' ||
      m.reason.length > 100 ||
      ![null, 0, 1].includes(m.winner) ||
      !['countdown', 'playing'].includes(m.resumePhase) ||
      !validConfig(m.config) ||
      !['countdown', 'playing', 'paused', 'roundEnd', 'finished'].includes(m.phase) ||
      !Array.isArray(m.players) ||
      m.players.length !== 2
    )
      return false;
    if (
      ![m.elapsed, m.roundElapsed, m.timer, m.round, m.seed, m.revision].every(
        (n) => Number.isFinite(n) && n >= 0,
      ) ||
      !Number.isFinite(m.swapIn)
    )
      return false;
    return m.players.every(
      (p) =>
        ['puyo', 'tetris'].includes(p.kind) &&
        typeof p.name === 'string' &&
        p.name.length <= 16 &&
        Array.isArray(p.cpuPlan) &&
        p.cpuPlan.length <= 30 &&
        p.cpuPlan.every((action) =>
          ['left', 'right', 'down', 'cw', 'ccw', 'drop', 'hold'].includes(action),
        ) &&
        Number.isFinite(p.cpuClock) &&
        Number.isFinite(p.incoming) &&
        p.incoming >= 0 &&
        Number.isFinite(p.wins) &&
        ['puyo', 'tetris'].every((kind) => {
          const b = p.boards[kind as Kind];
          const pieceOK = (piece: Piece | null) =>
            piece === null ||
            (['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'P'].includes(piece.type) &&
              (kind === 'puyo' ? piece.type === 'P' : piece.type !== 'P') &&
              Number.isInteger(piece.x) &&
              Number.isInteger(piece.y) &&
              piece.x >= -4 &&
              piece.x <= 10 &&
              piece.y >= 0 &&
              piece.y <= 22 &&
              Number.isInteger(piece.rotation) &&
              piece.rotation >= 0 &&
              piece.rotation <= 3 &&
              Array.isArray(piece.colors) &&
              (piece.type !== 'P' ||
                (piece.colors.length === 2 &&
                  piece.colors.every((c) => [1, 2, 3, 4].includes(c)))));
          return (
            b &&
            b.kind === kind &&
            b.width === (kind === 'puyo' ? 6 : 10) &&
            b.height === (kind === 'puyo' ? 14 : 22) &&
            Array.isArray(b.grid) &&
            b.grid.length === b.height &&
            b.grid.every(
              (row) =>
                Array.isArray(row) &&
                row.length === b.width &&
                row.every((n) => Number.isInteger(n) && n >= 0 && n <= 8),
            ) &&
            ['falling', 'clearing', 'ready', 'dead'].includes(b.phase) &&
            (b.phase !== 'falling' || b.active !== null) &&
            typeof b.held === 'boolean' &&
            typeof b.rotated === 'boolean' &&
            typeof b.b2b === 'boolean' &&
            Number.isFinite(b.combo) &&
            Number.isInteger(b.lastKick) &&
            typeof b.label === 'string' &&
            b.label.length <= 60 &&
            Array.isArray(b.queue) &&
            b.queue.length <= 8 &&
            b.queue.every((piece) => piece !== null && pieceOK(piece)) &&
            pieceOK(b.active) &&
            pieceOK(b.hold) &&
            Array.isArray(b.bag) &&
            b.bag.length <= 7 &&
            b.bag.every((type) => ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].includes(type)) &&
            Array.isArray(b.clearCells) &&
            b.clearCells.length <= b.width * b.height &&
            b.clearCells.every(
              (c) =>
                Number.isInteger(c.x) &&
                Number.isInteger(c.y) &&
                c.x >= 0 &&
                c.x < b.width &&
                c.y >= 0 &&
                c.y < b.height,
            ) &&
            Array.isArray(b.clearRows) &&
            b.clearRows.length <= 4 &&
            b.clearRows.every((y) => Number.isInteger(y) && y >= 0 && y < b.height) &&
            [
              b.rng,
              b.gravity,
              b.lock,
              b.resets,
              b.delay,
              b.chain,
              b.chainScore,
              b.remainder,
              b.outbox,
              b.score,
              b.lines,
              b.puyos,
              b.pieces,
              b.maxChain,
              b.attack,
              b.labelTime,
              b.event,
            ].every(Number.isFinite)
          );
        }),
    );
  } catch {
    return false;
  }
}
