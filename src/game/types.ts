export type Kind = 'puyo' | 'tetris';
export type Rule = 'versus' | 'swap';
export type Mode = 'cpu' | 'local' | 'online' | 'practice' | 'sprint';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Action = 'left' | 'right' | 'down' | 'cw' | 'ccw' | 'drop' | 'hold';
export type Tetromino = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Shape = Tetromino | 'P';
export interface Piece {
  type: Shape;
  colors: number[];
  x: number;
  y: number;
  rotation: number;
}
export interface Cell {
  x: number;
  y: number;
  color: number;
}
export interface Board {
  kind: Kind;
  width: number;
  height: number;
  grid: number[][];
  rng: number;
  queue: Piece[];
  bag: Tetromino[];
  active: Piece | null;
  hold: Piece | null;
  held: boolean;
  phase: 'falling' | 'clearing' | 'ready' | 'dead';
  gravity: number;
  lock: number;
  resets: number;
  rotated: boolean;
  lastKick: number;
  clearCells: Cell[];
  clearRows: number[];
  delay: number;
  chain: number;
  chainScore: number;
  remainder: number;
  outbox: number;
  combo: number;
  b2b: boolean;
  score: number;
  lines: number;
  puyos: number;
  pieces: number;
  maxChain: number;
  attack: number;
  label: string;
  labelTime: number;
  event: number;
}
export interface Player {
  name: string;
  kind: Kind;
  boards: Record<Kind, Board>;
  incoming: number;
  wins: number;
  cpuClock: number;
  cpuPlan: Action[];
}
export interface MatchConfig {
  mode: Mode;
  rule: Rule;
  kinds: [Kind, Kind];
  names: [string, string];
  difficulty: Difficulty;
  firstTo: number;
}
export interface Match {
  version: 1;
  id: string;
  seed: number;
  config: MatchConfig;
  players: [Player, Player];
  phase: 'countdown' | 'playing' | 'paused' | 'roundEnd' | 'finished';
  resumePhase: 'countdown' | 'playing';
  timer: number;
  elapsed: number;
  roundElapsed: number;
  swapIn: number;
  round: number;
  winner: number | null;
  reason: string;
  revision: number;
}
export const ACTIONS: Action[] = ['left', 'right', 'down', 'cw', 'ccw', 'drop', 'hold'];
export const DEFAULT_CONFIG: MatchConfig = {
  mode: 'cpu',
  rule: 'versus',
  kinds: ['puyo', 'tetris'],
  names: ['YOU', 'CPU'],
  difficulty: 'normal',
  firstTo: 2,
};
