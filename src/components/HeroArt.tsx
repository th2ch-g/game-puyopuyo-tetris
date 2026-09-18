import { Board } from './Board';
import { createBoard } from '../game/engine';

const puyo = createBoard('puyo', 1234),
  tetris = createBoard('tetris', 1234);
puyo.active = { type: 'P', colors: [2, 1], x: 2, y: 5, rotation: 1 };
const rows = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 4, 0],
  [0, 0, 0, 4, 4, 0],
  [3, 0, 1, 2, 3, 0],
  [3, 1, 1, 2, 3, 4],
  [1, 1, 2, 2, 4, 4],
];
rows.forEach((row, i) => (puyo.grid[puyo.height - rows.length + i] = row));
tetris.active = { type: 'T', colors: [], x: 4, y: 5, rotation: 0 };
const tetRows = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 7, 7],
  [0, 0, 0, 0, 0, 0, 4, 4, 7, 0],
  [6, 0, 0, 0, 0, 4, 4, 2, 2, 0],
  [6, 6, 6, 0, 0, 5, 5, 2, 2, 0],
  [3, 3, 3, 3, 0, 0, 5, 5, 1, 0],
  [2, 2, 6, 6, 6, 6, 7, 7, 1, 0],
  [2, 2, 4, 4, 4, 4, 7, 3, 1, 0],
];
tetRows.forEach((row, i) => (tetris.grid[tetris.height - tetRows.length + i] = row));

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <span className="art-spark spark-one">✦</span>
      <span className="art-spark spark-two">✧</span>
      <div className="art-board art-puyo">
        <div className="art-board-title">
          <span className="small-dot" />
          PUYO<span>01</span>
        </div>
        <Board board={puyo} />
        <div className="art-board-footer">
          CONNECT 4. <span>CHAIN IT.</span>
        </div>
      </div>
      <div className="art-board art-tetris">
        <div className="art-board-title">
          <span className="small-dot" />
          TETRIS<span>02</span>
        </div>
        <Board board={tetris} />
        <div className="art-board-footer">
          FILL A LINE. <span>CLEAR IT.</span>
        </div>
      </div>
      <div className="art-vs">
        VS<span>LET’S DROP</span>
      </div>
      <div className="art-caption">
        <span className="status-dot" />
        2つのパズル。無限の駆け引き。
      </div>
    </div>
  );
}
