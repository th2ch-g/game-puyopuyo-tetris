import { nextRound, validMatch } from '../game/engine';
import type { Match } from '../game/types';

const PREFIX = 'drop-arena:v1:';
export interface Settings {
  sound: boolean;
  volume: number;
  ghost: boolean;
  labels: boolean;
  haptics: boolean;
  das: number;
  arr: number;
  name: string;
}
export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.35,
  ghost: true,
  labels: false,
  haptics: true,
  das: 160,
  arr: 45,
  name: 'YOU',
};
export interface RecordEntry {
  id: string;
  date: string;
  mode: string;
  kind: string;
  score: number;
  lines: number;
  chain: number;
  elapsed: number;
  won: boolean;
}

export function read<T>(key: string, fallback: T, session = false): T {
  try {
    const text = (session ? sessionStorage : localStorage).getItem(PREFIX + key);
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown, session = false): boolean {
  try {
    (session ? sessionStorage : localStorage).setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function remove(key: string, session = false) {
  try {
    (session ? sessionStorage : localStorage).removeItem(PREFIX + key);
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
}
export function loadSettings(): Settings {
  const s = read<Partial<Settings>>('settings', {});
  const d = { ...DEFAULT_SETTINGS };
  if (!s || typeof s !== 'object') return d;
  for (const key of ['sound', 'ghost', 'labels', 'haptics'] as const)
    if (typeof s[key] === 'boolean') d[key] = s[key];
  if (Number.isFinite(s.volume)) d.volume = Math.max(0, Math.min(1, s.volume!));
  if (Number.isFinite(s.das)) d.das = Math.max(80, Math.min(300, s.das!));
  if (Number.isFinite(s.arr)) d.arr = Math.max(20, Math.min(100, s.arr!));
  if (typeof s.name === 'string' && s.name.trim()) d.name = s.name.trim().slice(0, 16);
  return d;
}
export function loadGame(): Match | null {
  const saved = read<unknown>('save', null);
  if (!validMatch(saved) || saved.config.mode === 'online' || saved.phase === 'finished') {
    remove('save');
    return null;
  }
  if (saved.phase === 'roundEnd') nextRound(saved);
  if (saved.phase !== 'paused')
    saved.resumePhase = saved.phase === 'countdown' ? 'countdown' : 'playing';
  saved.phase = 'paused';
  return saved;
}
export function records(): RecordEntry[] {
  const data = read<unknown>('records', []);
  return Array.isArray(data)
    ? data
        .filter(
          (r): r is RecordEntry =>
            r &&
            typeof r.id === 'string' &&
            typeof r.date === 'string' &&
            typeof r.mode === 'string' &&
            ['puyo', 'tetris'].includes(r.kind) &&
            [r.score, r.lines, r.chain, r.elapsed].every((n) => Number.isFinite(n) && n >= 0),
        )
        .slice(0, 30)
    : [];
}
export function saveRecord(match: Match, index = 0) {
  const history = records();
  if (history.some((r) => r.id === match.id)) return true;
  const player = match.players[index],
    boards = Object.values(player.boards);
  const record: RecordEntry = {
    id: match.id,
    date: new Date().toISOString(),
    mode: match.config.mode,
    kind: match.config.kinds[index],
    score: boards.reduce((sum, b) => sum + b.score, 0),
    lines: player.boards.tetris.lines,
    chain: player.boards.puyo.maxChain,
    elapsed: match.elapsed,
    won: match.winner === index,
  };
  return write('records', [record, ...history].slice(0, 30));
}
