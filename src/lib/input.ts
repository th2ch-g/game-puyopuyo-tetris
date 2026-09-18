import type { Action } from '../game/types';

export const SINGLE_KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'cw',
  KeyX: 'cw',
  KeyZ: 'ccw',
  Space: 'drop',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
};
export const LOCAL_ONE: Record<string, Action> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyS: 'down',
  KeyW: 'cw',
  KeyE: 'cw',
  KeyQ: 'ccw',
  KeyF: 'drop',
  KeyR: 'hold',
};
export const LOCAL_TWO: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'cw',
  Period: 'cw',
  Comma: 'ccw',
  Enter: 'drop',
  ShiftRight: 'hold',
};

export class InputRepeater {
  private held = new Map<string, { player: number; action: Action; remaining: number }>();
  constructor(
    private send: (player: number, action: Action) => void,
    private timing: () => { das: number; arr: number },
  ) {}
  press(key: string, player: number, action: Action) {
    if (this.held.has(key)) return;
    this.send(player, action);
    if (['left', 'right', 'down'].includes(action))
      this.held.set(key, { player, action, remaining: action === 'down' ? 35 : this.timing().das });
  }
  release(key: string) {
    this.held.delete(key);
  }
  clear() {
    this.held.clear();
  }
  tick(dt: number) {
    for (const held of this.held.values()) {
      held.remaining -= dt;
      let count = 0;
      while (held.remaining <= 0 && count++ < 6) {
        this.send(held.player, held.action);
        held.remaining += held.action === 'down' ? 35 : this.timing().arr;
      }
    }
  }
}
