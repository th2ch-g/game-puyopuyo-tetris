import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMatch, finishRound, pause } from '../src/game/engine';
import { DEFAULT_CONFIG } from '../src/game/types';
import {
  DEFAULT_SETTINGS,
  loadGame,
  loadSettings,
  records,
  saveRecord,
  write,
} from '../src/lib/storage';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('durable local game state', () => {
  it('preserves a paused countdown instead of skipping its remaining time', () => {
    const m = createMatch(structuredClone(DEFAULT_CONFIG), 10);
    m.timer = 1400;
    pause(m);
    write('save', m);
    const restored = loadGame()!;
    expect(restored.phase).toBe('paused');
    expect(restored.resumePhase).toBe('countdown');
    expect(restored.timer).toBe(1400);
  });
  it('restores a completed round at the next countdown without awarding another win', () => {
    const m = createMatch(structuredClone(DEFAULT_CONFIG), 10);
    m.phase = 'playing';
    finishRound(m, 0, 'test');
    write('save', m);
    const restored = loadGame()!;
    expect(restored.players[0].wins).toBe(1);
    expect(restored.round).toBe(2);
    expect(restored.resumePhase).toBe('countdown');
    expect(restored.players[0].boards.puyo.phase).toBe('falling');
  });
  it('ignores malformed storage and clamps settings', () => {
    localStorage.setItem('drop-arena:v1:save', '{broken');
    expect(loadGame()).toBe(null);
    write('settings', null);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    write('settings', { volume: 999, arr: -10, das: 999, name: 'A'.repeat(40), sound: 'false' });
    expect(loadSettings()).toMatchObject({
      volume: 1,
      arr: 20,
      das: 300,
      name: 'A'.repeat(16),
      sound: true,
    });
  });
  it('deduplicates completed sessions and retains the latest thirty', () => {
    for (let i = 1; i <= 35; i++) {
      const m = createMatch(structuredClone(DEFAULT_CONFIG), i);
      saveRecord(m);
      saveRecord(m);
    }
    expect(records()).toHaveLength(30);
    expect(new Set(records().map((r) => r.id)).size).toBe(30);
  });
  it('handles denied storage without interrupting the game', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Unavailable');
      },
      setItem: () => {
        throw new Error('Unavailable');
      },
    });
    expect(write('settings', DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(records()).toEqual([]);
    expect(saveRecord(createMatch(structuredClone(DEFAULT_CONFIG), 1))).toBe(false);
  });
});
