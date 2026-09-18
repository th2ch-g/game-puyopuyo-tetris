import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Repeat2,
} from 'lucide-react';
import type { Action, Kind } from '../game/types';
import type { InputRepeater } from '../lib/input';

export function Controls({
  player,
  kind,
  input,
  disabled = false,
  local = false,
}: {
  player: number;
  kind: Kind;
  input: InputRepeater;
  disabled?: boolean;
  local?: boolean;
}) {
  const buttons: { action: Action; label: string; icon: typeof ArrowLeft; key: string }[] = [
    {
      action: 'ccw',
      label: '左回転',
      icon: RotateCcw,
      key: local ? (player === 0 ? 'Q' : ',') : 'Z',
    },
    {
      action: 'cw',
      label: '右回転',
      icon: RotateCw,
      key: local ? (player === 0 ? 'W' : '↑') : '↑',
    },
    {
      action: 'hold',
      label: 'ホールド',
      icon: Repeat2,
      key: local ? (player === 0 ? 'R' : '⇧') : 'C',
    },
    { action: 'left', label: '左へ移動', icon: ArrowLeft, key: local && player === 0 ? 'A' : '←' },
    {
      action: 'down',
      label: 'ソフトドロップ',
      icon: ArrowDown,
      key: local && player === 0 ? 'S' : '↓',
    },
    {
      action: 'right',
      label: '右へ移動',
      icon: ArrowRight,
      key: local && player === 0 ? 'D' : '→',
    },
    {
      action: 'drop',
      label: 'ハードドロップ',
      icon: ArrowDownToLine,
      key: local ? (player === 0 ? 'F' : 'Enter') : 'Space',
    },
  ];
  return (
    <div
      className={`touch-controls ${local ? 'local-controls' : ''}`}
      role="group"
      aria-label={`${player + 1}Pの操作`}
    >
      {buttons.map(({ action, label, icon: Icon, key }) => (
        <button
          key={action}
          type="button"
          className={`control control-${action}`}
          aria-label={`${player + 1}P ${label}`}
          disabled={disabled || (action === 'hold' && kind !== 'tetris')}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            input.press(`touch-${player}-${event.pointerId}`, player, action);
          }}
          onPointerUp={(event) => input.release(`touch-${player}-${event.pointerId}`)}
          onPointerCancel={(event) => input.release(`touch-${player}-${event.pointerId}`)}
          onLostPointerCapture={(event) => input.release(`touch-${player}-${event.pointerId}`)}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            if (event.detail === 0) {
              input.press(`accessible-${player}`, player, action);
              input.release(`accessible-${player}`);
            }
          }}
        >
          <Icon size={20} strokeWidth={2} />
          <span>{action === 'drop' ? 'DROP' : action === 'hold' ? 'HOLD' : label}</span>
          <kbd>{key}</kbd>
        </button>
      ))}
    </div>
  );
}
