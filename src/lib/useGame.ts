import { useEffect, useRef, useState } from 'react';
import { command, createMatch, currentBoard, pause, step, TICK_MS } from '../game/engine';
import { tickCPU } from '../game/ai';
import type { Action, Match, MatchConfig } from '../game/types';
import { InputRepeater, LOCAL_ONE, LOCAL_TWO, SINGLE_KEYS } from './input';
import { Sound } from './audio';
import type { Room } from './network';
import { remove, saveRecord, write, type Settings } from './storage';

export function useGame(settings: Settings, onNotice: (message: string) => void) {
  const [match, setMatch] = useState<Match | null>(null);
  const [recordSaved, setRecordSaved] = useState(true);
  const engine = useRef<Match | null>(null);
  const room = useRef<Room | null>(null);
  const preferences = useRef(settings);
  preferences.current = settings;
  const notice = useRef(onNotice);
  notice.current = onNotice;
  const sound = useRef(new Sound(settings));
  sound.current.settings = settings;
  const input = useRef(
    new InputRepeater(
      (player, action) => {
        sound.current.unlock();
        if (!engine.current || engine.current.phase !== 'playing') return;
        const changed =
          room.current?.session.role === 'guest'
            ? room.current.input(action)
            : command(engine.current, player, action);
        if (changed) {
          sound.current.play(
            action === 'drop' ? 'drop' : action === 'cw' || action === 'ccw' ? 'rotate' : 'move',
          );
          if (action === 'drop' && preferences.current.haptics && 'vibrate' in navigator)
            navigator.vibrate(12);
        }
      },
      () => preferences.current,
    ),
  );

  const sync = (state: Match) => {
    engine.current = state;
    setMatch(structuredClone(state));
  };
  const begin = (config: MatchConfig) => {
    sound.current.unlock();
    input.current.clear();
    const state = createMatch(config);
    sync(state);
    return state;
  };
  const togglePause = () => {
    input.current.clear();
    const state = engine.current;
    if (!state) return;
    if (room.current) room.current.requestPause(state.phase !== 'paused');
    else {
      pause(state);
      setMatch(structuredClone(state));
    }
  };
  const leave = () => {
    input.current.clear();
    engine.current = null;
    setMatch(null);
    remove('save');
  };

  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      accumulator = 0,
      renderAt = 0,
      saveAt = 0,
      recorded = '';
    let lastEvent = [0, 0],
      lastCountdown = 0;
    const loop = (now: number) => {
      const elapsed = Math.min(100, now - last);
      last = now;
      accumulator += elapsed;
      const state = engine.current;
      if (state) {
        const guest = room.current?.session.role === 'guest';
        while (accumulator >= TICK_MS) {
          input.current.tick(TICK_MS);
          if (!guest) {
            tickCPU(state, TICK_MS);
            step(state, TICK_MS);
          }
          accumulator -= TICK_MS;
        }
        for (let i = 0; i < 2; i++) {
          const board = currentBoard(state.players[i]);
          if (board.event !== lastEvent[i]) {
            if (board.event > lastEvent[i]) sound.current.play('clear', board.chain);
            lastEvent[i] = board.event;
          }
        }
        if (state.phase === 'countdown') {
          const count = Math.ceil(state.timer / 1000);
          if (count !== lastCountdown) {
            sound.current.play('count');
            lastCountdown = count;
          }
        }
        if (room.current && !guest) {
          room.current.setState(state);
          room.current.broadcast();
        }
        if (now - renderAt >= 33) {
          setMatch(structuredClone(state));
          renderAt = now;
        }
        if (state.phase === 'finished' && recorded !== state.id) {
          recorded = state.id;
          setRecordSaved(saveRecord(state, guest ? 1 : 0));
          if (!room.current) remove('save');
          sound.current.play('win');
        } else if (!room.current && state.phase !== 'finished' && now - saveAt > 2000) {
          write('save', state);
          saveAt = now;
        }
      } else {
        accumulator = 0;
        lastEvent = [0, 0];
        lastCountdown = 0;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const down = (event: KeyboardEvent) => {
      if (
        !engine.current ||
        document.querySelector('dialog[open]') ||
        (event.target instanceof HTMLElement &&
          /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName))
      )
        return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (event.repeat) return;
        input.current.clear();
        if (room.current) room.current.requestPause(engine.current.phase !== 'paused');
        else pause(engine.current);
        return;
      }
      const local = engine.current.config.mode === 'local';
      let player = room.current?.session.role === 'guest' ? 1 : 0;
      let action: Action | undefined = (local ? LOCAL_ONE : SINGLE_KEYS)[event.code];
      if (local && !action) {
        action = LOCAL_TWO[event.code];
        player = 1;
      }
      if (action) {
        event.preventDefault();
        if (!event.repeat) input.current.press(event.code, player, action);
      }
    };
    const up = (event: KeyboardEvent) => input.current.release(event.code);
    const blurred = () => input.current.clear();
    const visibility = () => {
      input.current.clear();
      if (!engine.current) return;
      if (room.current) room.current.requestPause(document.hidden);
      else if (document.hidden && ['playing', 'countdown'].includes(engine.current.phase)) {
        pause(engine.current);
        write('save', engine.current);
      }
    };
    const save = () => {
      if (engine.current && !room.current && engine.current.phase !== 'finished')
        write('save', engine.current);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blurred);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', save);
    return () => {
      cancelAnimationFrame(frame);
      input.current.clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blurred);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', save);
      room.current?.destroy(false);
    };
  }, []);
  return {
    match,
    recordSaved,
    engine,
    room,
    input: input.current,
    sound: sound.current,
    sync,
    begin,
    togglePause,
    leave,
  };
}
