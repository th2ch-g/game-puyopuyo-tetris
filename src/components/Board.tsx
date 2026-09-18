import { memo, useId } from 'react';
import { cells, ghost } from '../game/pieces';
import { HIDDEN } from '../game/engine';
import type { Board as BoardState, Cell, Kind, Piece, Player } from '../game/types';

const PUYO_COLORS = ['', '#b6ec78', '#b59afa', '#ff8c99', '#77d9f5'];
const TETRIS_COLORS = [
  '',
  '#77d9f5',
  '#f4d77d',
  '#b59afa',
  '#b6ec78',
  '#ff8c99',
  '#83a9ff',
  '#f8ae76',
];
const MARKS = ['', '●', '◆', '▲', '■', 'Z', 'J', 'L'];

export function Block({
  cell,
  kind,
  ghost: projection = false,
  labels = false,
  clearing = false,
}: {
  cell: Cell;
  kind: Kind;
  ghost?: boolean;
  labels?: boolean;
  clearing?: boolean;
}) {
  const { x, y, color } = cell;
  const fill =
    color === 8 ? '#768096' : (kind === 'puyo' ? PUYO_COLORS : TETRIS_COLORS)[color] || '#fff';
  return (
    <g
      transform={`translate(${x * 24} ${y * 24})`}
      className={clearing ? 'cell-clearing' : undefined}
    >
      {projection ? (
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx={kind === 'puyo' ? 8 : 2}
          fill={fill}
          fillOpacity=".09"
          stroke={fill}
          strokeOpacity=".65"
          strokeDasharray="3 2"
        />
      ) : kind === 'puyo' && color !== 8 ? (
        <>
          <path d="M12 2C5 2 1.5 7 1.5 13s4 9 10.5 9 10.5-3 10.5-9S19 2 12 2Z" fill={fill} />
          <ellipse
            cx="8"
            cy="6"
            rx="3.4"
            ry="1.4"
            fill="#fff"
            opacity=".38"
            transform="rotate(-25 8 6)"
          />
          <ellipse cx="8.5" cy="12" rx="2.7" ry="3.8" fill="#fff" />
          <ellipse cx="15.4" cy="12" rx="2.7" ry="3.8" fill="#fff" />
          <ellipse cx="9" cy="12.5" rx="1.3" ry="2" fill="#1b2137" />
          <ellipse cx="15.9" cy="12.5" rx="1.3" ry="2" fill="#1b2137" />
          <path
            d="M10 18q2 1.5 4 0"
            fill="none"
            stroke="#242c3d"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          {labels && (
            <text x="19" y="7" textAnchor="middle" fontSize="6" fontWeight="900" fill="#101423">
              {MARKS[color]}
            </text>
          )}
        </>
      ) : (
        <>
          <rect x="1" y="1" width="22" height="22" rx={color === 8 ? 6 : 2.5} fill={fill} />
          <path d="M3 9V3h18" stroke="#fff" strokeWidth="2" opacity=".3" fill="none" />
          <path d="M3 21h18V10" stroke="#101423" strokeWidth="2" opacity=".25" fill="none" />
          {color === 8 ? (
            <>
              <circle cx="9" cy="11" r="1.5" fill="#20273d" />
              <circle cx="15" cy="11" r="1.5" fill="#20273d" />
              <path d="M9 16h6" stroke="#20273d" strokeWidth="1.5" />
            </>
          ) : labels ? (
            <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#101423">
              {MARKS[color]}
            </text>
          ) : (
            <rect x="7" y="7" width="10" height="10" rx="1" fill="#fff" opacity=".07" />
          )}
        </>
      )}
    </g>
  );
}

export function PiecePreview({
  piece,
  kind,
  labels = false,
}: {
  piece: Piece | null;
  kind: Kind;
  labels?: boolean;
}) {
  if (!piece)
    return (
      <span className="empty-piece" role="img" aria-label="なし">
        —
      </span>
    );
  const content = cells({ ...piece, x: 0, y: 0, rotation: 0 });
  const xs = content.map((c) => c.x),
    ys = content.map((c) => c.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    w = Math.max(...xs) - minX + 1,
    h = Math.max(...ys) - minY + 1;
  return (
    <svg
      className="piece-preview"
      viewBox={`0 0 ${w * 24} ${h * 24}`}
      aria-label={kind === 'puyo' ? '次のぷよ' : `${piece.type} ミノ`}
      role="img"
    >
      {content.map((c, i) => (
        <Block key={i} cell={{ ...c, x: c.x - minX, y: c.y - minY }} kind={kind} labels={labels} />
      ))}
    </svg>
  );
}

export const Board = memo(function Board({
  board,
  showGhost = true,
  labels = false,
  mini = false,
}: {
  board: BoardState;
  showGhost?: boolean;
  labels?: boolean;
  mini?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const w = board.width * 24,
    h = (board.height - HIDDEN) * 24;
  const active = board.active ? cells(board.active) : [];
  const projection = showGhost ? ghost(board) : null;
  const occupied = board.grid.flatMap((row, y) =>
    row.flatMap((color, x) => (color ? [{ x, y, color }] : [])),
  );
  const clearing = new Set(board.clearCells.map((c) => `${c.x},${c.y}`));
  const danger = board.grid.slice(HIDDEN, HIDDEN + 3).some((row) => row.some(Boolean));
  return (
    <div
      className={`board-surface ${board.kind} ${danger ? 'danger' : ''} ${mini ? 'mini-board' : ''}`}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="board-svg"
        role="img"
        aria-label={`${board.kind === 'puyo' ? 'ぷよ' : 'テトリス'}盤面、スコア ${board.score}、${board.pieces} 手`}
      >
        <defs>
          <pattern id={`grid-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M24 0H0V24"
              fill="none"
              stroke="#c1c8ee"
              strokeOpacity=".065"
              strokeWidth="1"
            />
          </pattern>
          <clipPath id={`clip-${id}`}>
            <rect width={w} height={h} rx="3" />
          </clipPath>
        </defs>
        <rect width={w} height={h} fill={`url(#grid-${id})`} />
        {board.kind === 'puyo' && (
          <g opacity=".45" stroke="#ff8c99" strokeWidth="2">
            <path d="M55 6l10 10m0-10L55 16" />
          </g>
        )}
        <g clipPath={`url(#clip-${id})`}>
          {projection &&
            cells(projection).map((c, i) => (
              <Block key={`ghost-${i}`} cell={{ ...c, y: c.y - HIDDEN }} kind={board.kind} ghost />
            ))}
          {occupied.map((c) => (
            <Block
              key={`${c.x}-${c.y}`}
              cell={{ ...c, y: c.y - HIDDEN }}
              kind={board.kind}
              labels={labels}
              clearing={clearing.has(`${c.x},${c.y}`)}
            />
          ))}
          {active.map((c, i) => (
            <Block
              key={`active-${i}`}
              cell={{ ...c, y: c.y - HIDDEN }}
              kind={board.kind}
              labels={labels}
            />
          ))}
        </g>
      </svg>
      {!mini && board.labelTime > 0 && (
        <div key={board.event} className="clear-callout" role="status">
          {board.label}
        </div>
      )}
      {board.phase === 'dead' && <div className="board-dead">TOP OUT</div>}
    </div>
  );
});

export function PlayerField({
  player,
  index,
  local = false,
  opponent = false,
  labels = false,
  showGhost = true,
  firstTo = 2,
}: {
  player: Player;
  index: number;
  local?: boolean;
  opponent?: boolean;
  labels?: boolean;
  showGhost?: boolean;
  firstTo?: number;
}) {
  const board = player.boards[player.kind];
  return (
    <section
      className={`player-field player-${index} ${opponent ? 'opponent-field' : ''}`}
      aria-label={`${player.name}のフィールド`}
      data-player={index}
    >
      <div className="player-heading">
        <div className={`player-avatar ${player.kind}`}>
          {player.kind === 'puyo' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <Block cell={{ x: 0, y: 0, color: 1 }} kind="puyo" />
            </svg>
          ) : (
            <span aria-hidden="true">T</span>
          )}
        </div>
        <div>
          <span className="player-tag">
            {local ? 'LOCAL' : opponent ? 'RIVAL' : 'PLAYER ' + (index + 1)}
          </span>
          <h2>{player.name}</h2>
        </div>
        <div className="round-dots" role="img" aria-label={`${player.wins}勝`}>
          {Array.from({ length: firstTo }, (_, i) => (
            <span key={i} className={i < player.wins ? 'won' : ''} />
          ))}
        </div>
      </div>
      <div className="field-body">
        <aside className="field-side left-side">
          <span className="micro-label">{player.kind === 'tetris' ? 'HOLD' : 'CHAIN'}</span>
          {player.kind === 'tetris' ? (
            <div className={`hold-box ${board.held ? 'hold-used' : ''}`}>
              <PiecePreview piece={board.hold} kind="tetris" labels={labels} />
            </div>
          ) : (
            <div className="chain-value">
              {board.maxChain}
              <small>BEST</small>
            </div>
          )}
          <div
            className="garbage-indicator"
            role="group"
            aria-label={`おじゃま予告 ${player.incoming}`}
          >
            <span className="micro-label">INCOMING</span>
            <strong className={player.incoming ? 'has-garbage' : ''}>{player.incoming}</strong>
            <span className="garbage-track">
              <i style={{ height: `${Math.min(100, (player.incoming / 30) * 100)}%` }} />
            </span>
          </div>
        </aside>
        <Board board={board} showGhost={showGhost && !opponent} labels={labels} />
        <aside className="field-side next-side">
          <span className="micro-label">NEXT</span>
          {board.queue.slice(0, player.kind === 'puyo' ? 3 : 5).map((p, i) => (
            <div key={i} className={`next-piece next-${i}`}>
              <PiecePreview piece={p} kind={board.kind} labels={labels} />
            </div>
          ))}
        </aside>
      </div>
      <div className="field-score">
        <div>
          <span>SCORE</span>
          <strong data-testid={`score-${index}`}>{board.score.toLocaleString()}</strong>
        </div>
        <div>
          <span>{board.kind === 'puyo' ? 'CLEARED' : 'LINES'}</span>
          <strong>{board.kind === 'puyo' ? board.puyos : board.lines}</strong>
        </div>
        <div>
          <span>ATTACK</span>
          <strong>{board.attack}</strong>
        </div>
      </div>
    </section>
  );
}
