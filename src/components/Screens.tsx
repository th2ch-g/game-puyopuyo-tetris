import {
  ArrowRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  GraduationCap,
  Keyboard,
  Link2,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Kind, MatchConfig, Mode } from '../game/types';
import { HeroArt } from './HeroArt';
import { Block } from './Board';
import type { Settings, RecordEntry } from '../lib/storage';

export const MODE_NAMES: Record<Mode, string> = {
  cpu: 'CPU対戦',
  local: 'ふたりで対戦',
  online: 'オンライン対戦',
  practice: 'じっくり練習',
  sprint: 'タイムアタック',
};
export function KindIcon({ kind }: { kind: Kind }) {
  return kind === 'puyo' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <Block cell={{ x: 0, y: 0, color: 1 }} kind="puyo" />
    </svg>
  ) : (
    <svg viewBox="0 0 72 48" aria-hidden="true">
      {[
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ].map((p, i) => (
        <Block key={i} cell={{ ...p, color: 3 }} kind="tetris" />
      ))}
    </svg>
  );
}

export function Home({
  onMode,
  onHelp,
  onResume,
  hasSave,
  onRejoin,
  hasSession,
}: {
  onMode: (mode: Mode) => void;
  onHelp: () => void;
  onResume: () => void;
  hasSave: boolean;
  onRejoin: () => void;
  hasSession: boolean;
}) {
  return (
    <main id="main" className="home">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            THE NEXT DROP IS YOURS
          </div>
          <h1>
            つなげて。
            <br />
            そろえて。
            <br />
            <span>夢中になれ。</span>
          </h1>
          <p className="hero-description">
            ぷよの連鎖か、テトリスの一撃か。
            <br />
            好きなスタイルで、次の一手を。
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => onMode('cpu')}>
              <Play size={17} fill="currentColor" />
              さっそく遊ぶ
              <ArrowRight size={18} />
            </button>
            <button className="button secondary" onClick={() => onMode('online')}>
              <Globe2 size={19} />
              友達を招待
            </button>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={14} />
              登録不要
            </span>
            <span>
              <Smartphone size={14} />
              スマホ対応
            </span>
            <button onClick={onHelp}>
              遊び方を見る
              <ChevronRight size={13} />
            </button>
          </div>
          {(hasSave || hasSession) && (
            <div className="resume-links">
              {hasSave && (
                <button onClick={onResume}>
                  <RefreshCw size={15} />
                  前のゲームを再開
                </button>
              )}
              {hasSession && (
                <button onClick={onRejoin}>
                  <Link2 size={15} />
                  対戦ルームに戻る
                </button>
              )}
            </div>
          )}
        </div>
        <HeroArt />
      </div>
      <section className="mode-section" aria-label="ゲームモード">
        <div className="section-heading">
          <span className="eyebrow">CHOOSE YOUR PLAY</span>
          <span>今日の気分で、遊び方を選ぼう。</span>
        </div>
        <div className="mode-grid">
          <ModeCard
            number="01"
            icon={<Bot />}
            title="ひとりで腕試し"
            tag="VS CPU"
            description="3段階のCPUと真剣勝負。"
            onClick={() => onMode('cpu')}
            color="green"
          />
          <ModeCard
            number="02"
            icon={<Users />}
            title="となりの人と"
            tag="LOCAL BATTLE"
            description="ひとつの画面で、ふたり対戦。"
            onClick={() => onMode('local')}
            color="purple"
          />
          <ModeCard
            number="03"
            icon={<GraduationCap />}
            title="自分のペースで"
            tag="PRACTICE"
            description="連鎖も積み方も、気ままに練習。"
            onClick={() => onMode('practice')}
            color="blue"
          />
          <ModeCard
            number="04"
            icon={<Timer />}
            title="限界に挑戦"
            tag="TIME ATTACK"
            description="40ライン、または120秒の勝負。"
            onClick={() => onMode('sprint')}
            color="orange"
          />
        </div>
      </section>
      <div className="home-bottom">
        <span>
          <span className="small-dot" />
          PUYO × TETRIS · BROWSER EDITION
        </span>
        <span>いい勝負は、いい一手から。</span>
      </div>
    </main>
  );
}
function ModeCard({
  number,
  icon,
  title,
  tag,
  description,
  onClick,
  color,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  tag: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button className={`mode-card accent-${color}`} onClick={onClick}>
      <div className="mode-card-top">
        <span className="mode-icon">{icon}</span>
        <span className="mode-number">/{number}</span>
      </div>
      <span className="mode-tag">{tag}</span>
      <strong>{title}</strong>
      <span className="mode-description">{description}</span>
      <ArrowRight className="mode-arrow" size={18} />
    </button>
  );
}

export function KindSelect({
  value,
  onChange,
  label,
}: {
  value: Kind;
  onChange: (kind: Kind) => void;
  label: string;
}) {
  return (
    <div className="kind-select" role="group" aria-label={label}>
      {(['puyo', 'tetris'] as Kind[]).map((kind) => (
        <button
          key={kind}
          className={`kind-option ${kind} ${value === kind ? 'selected' : ''}`}
          aria-pressed={value === kind}
          onClick={() => onChange(kind)}
        >
          <span className="kind-icon">
            <KindIcon kind={kind} />
          </span>
          <strong>{kind === 'puyo' ? 'ぷよ' : 'テトリス'}</strong>
          <small>{kind === 'puyo' ? '4つつなげて連鎖' : 'ラインをそろえて消去'}</small>
          {value === kind && <Check className="kind-check" size={15} />}
        </button>
      ))}
    </div>
  );
}

export function Setup({
  config,
  onChange,
  onStart,
  onBack,
}: {
  config: MatchConfig;
  onChange: (config: MatchConfig) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const solo = ['practice', 'sprint'].includes(config.mode);
  const update = (patch: Partial<MatchConfig>) => onChange({ ...config, ...patch });
  const names = (i: number, name: string) => {
    const next = [...config.names] as [string, string];
    next[i] = name;
    update({ names: next });
  };
  const kinds = (i: number, kind: Kind) => {
    const next = [...config.kinds] as [Kind, Kind];
    next[i] = kind;
    update({ kinds: next });
  };
  return (
    <main id="main" className="setup-page">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={16} />
        ホームへ
      </button>
      <div className="page-heading">
        <span className="eyebrow">MAKE IT YOUR GAME</span>
        <h1>{MODE_NAMES[config.mode]}</h1>
        <p>
          {solo
            ? '好きなスタイルで、一手ずつ上達しよう。'
            : '得意なパズルを選んで、対戦をはじめよう。'}
        </p>
      </div>
      <div className={`setup-players ${solo ? 'solo-setup' : ''}`}>
        <section className="setup-player">
          <div className="panel-top">
            <span className="pill green">PLAYER 1</span>
            <label htmlFor="player-name">あなたの名前</label>
          </div>
          <input
            id="player-name"
            maxLength={16}
            value={config.names[0]}
            onChange={(e) => names(0, e.target.value)}
            placeholder="YOU"
            autoComplete="nickname"
          />
          <KindSelect
            value={config.kinds[0]}
            onChange={(kind) => kinds(0, kind)}
            label="1Pのパズル"
          />
        </section>
        {!solo && (
          <>
            <span className="setup-vs">VS</span>
            <section className="setup-player">
              <div className="panel-top">
                <span className="pill purple">{config.mode === 'cpu' ? 'CPU' : 'PLAYER 2'}</span>
                <label htmlFor="opponent-name">
                  {config.mode === 'cpu' ? '対戦相手' : '2人目の名前'}
                </label>
              </div>
              <input
                id="opponent-name"
                maxLength={16}
                value={config.names[1]}
                onChange={(e) => names(1, e.target.value)}
                placeholder="PLAYER 2"
                readOnly={config.mode === 'cpu'}
              />
              <KindSelect
                value={config.kinds[1]}
                onChange={(kind) => kinds(1, kind)}
                label="2Pのパズル"
              />
            </section>
          </>
        )}
      </div>
      {!solo && (
        <div className="match-options">
          <div className="option-block">
            <span className="option-label">
              <Swords size={16} />
              対戦ルール
            </span>
            <div className="segmented">
              <button
                aria-pressed={config.rule === 'versus'}
                onClick={() => update({ rule: 'versus' })}
              >
                VS バトル
              </button>
              <button
                aria-pressed={config.rule === 'swap'}
                onClick={() => update({ rule: 'swap' })}
              >
                <RefreshCw size={14} />
                スワップ
              </button>
            </div>
            <p>
              {config.rule === 'swap'
                ? '25秒ごとにぷよ ⇄ テトリス。両方の盤面を使う対戦。'
                : '消して攻撃。おじゃまを送り、相手の盤面を埋めよう。'}
            </p>
          </div>
          <div className="option-block">
            <label className="option-label" htmlFor="first-to">
              <Trophy size={16} />
              勝利条件
            </label>
            <select
              id="first-to"
              value={config.firstTo}
              onChange={(e) => update({ firstTo: Number(e.target.value) })}
            >
              <option value="1">1本先取</option>
              <option value="2">2本先取</option>
              <option value="3">3本先取</option>
            </select>
          </div>
          {config.mode === 'cpu' && (
            <div className="option-block">
              <label className="option-label" htmlFor="difficulty">
                <Zap size={16} />
                CPUの強さ
              </label>
              <select
                id="difficulty"
                value={config.difficulty}
                onChange={(e) =>
                  update({ difficulty: e.target.value as MatchConfig['difficulty'] })
                }
              >
                <option value="easy">やさしい</option>
                <option value="normal">ふつう</option>
                <option value="hard">つよい</option>
              </select>
            </div>
          )}
        </div>
      )}
      {solo && (
        <div className="info-strip">
          <Sparkles size={19} />
          <p>
            {config.mode === 'practice'
              ? '時間制限なし。ゲームは自動保存され、あとで続きから再開できます。'
              : config.kinds[0] === 'puyo'
                ? '120秒でスコアを競います。大連鎖と全消しで自己ベストを目指そう。'
                : '40ラインを消すまでのタイムを競います。ホールドとハードドロップを活用しよう。'}
          </p>
        </div>
      )}
      {config.mode === 'local' && (
        <div className="info-strip">
          <Keyboard size={20} />
          <p>
            1P: A / D 移動・W / Q 回転・S 落下・F ドロップ・R ホールド
            <br />
            2P: ← / → 移動・↑ / , 回転・↓ 落下・Enter ドロップ・右Shift ホールド
            <br />
            スマホでは、画面下の2人分のボタンで操作できます。
          </p>
        </div>
      )}
      <div className="setup-footer">
        <span>
          <ShieldCheck size={16} />
          同じパズルには同じ順番のピース
        </span>
        <button className="button primary start-button" onClick={onStart}>
          <Play size={18} fill="currentColor" />
          ゲームスタート
          <ArrowRight size={18} />
        </button>
      </div>
    </main>
  );
}

export function SettingsContent({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const update = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="settings-content">
      <p className="muted">設定はこのブラウザに保存されます。</p>
      <label className="text-setting">
        プレイヤー名
        <input
          value={settings.name}
          maxLength={16}
          onChange={(e) => update({ name: e.target.value })}
        />
      </label>
      {(
        [
          ['sound', '効果音', '移動・消去・連鎖を音でお知らせ'],
          ['ghost', '落下位置のガイド', 'ピースが着地する場所を表示'],
          ['labels', '色の識別マーク', '形と文字でも色を区別'],
          ['haptics', 'バイブレーション', '対応端末でドロップ時に振動'],
        ] as const
      ).map(([key, title, description]) => (
        <label className="toggle-row" key={key}>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings[key]}
            onChange={(e) => update({ [key]: e.target.checked })}
          />
        </label>
      ))}
      <label className="range-setting">
        音量 <output>{Math.round(settings.volume * 100)}%</output>
        <input
          type="range"
          min="0"
          max="1"
          step=".05"
          value={settings.volume}
          onChange={(e) => update({ volume: Number(e.target.value) })}
        />
      </label>
      <label className="range-setting">
        横移動の待ち時間 <output>{settings.das} ms</output>
        <input
          type="range"
          min="80"
          max="300"
          step="10"
          value={settings.das}
          onChange={(e) => update({ das: Number(e.target.value) })}
        />
      </label>
      <label className="range-setting">
        横移動の間隔 <output>{settings.arr} ms</output>
        <input
          type="range"
          min="20"
          max="100"
          step="5"
          value={settings.arr}
          onChange={(e) => update({ arr: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

export function HelpContent() {
  return (
    <div className="help-content">
      <p className="muted">好きなパズルで対戦。消して攻撃し、相手より長く生き残ろう。</p>
      <div className="help-rules">
        <section>
          <div className="help-icon">
            <KindIcon kind="puyo" />
          </div>
          <h3>ぷよ · つなげて連鎖</h3>
          <p>
            同じ色を上下左右に4つ以上つなげると消えます。落ちてきたぷよがさらに消えると連鎖。連鎖が伸びるほど強い攻撃になります。
          </p>
          <p>
            おじゃまぷよは、隣の色ぷよを消すと一緒に消去。盤面上の × にぷよが積まれると負けです。
          </p>
        </section>
        <section>
          <div className="help-icon">
            <KindIcon kind="tetris" />
          </div>
          <h3>テトリス · そろえて消去</h3>
          <p>
            横一列をすき間なく埋めるとライン消去。4列同時のテトリス、Tスピン、連続消しで強い攻撃。ホールドは1ピースにつき1回交換できます。
          </p>
          <p>
            7種類がひと巡りする7バッグ方式。壁際の回転補正、着地後0.5秒の操作時間、落下位置ガイドに対応しています。
          </p>
        </section>
      </div>
      <section>
        <h3>攻撃とスワップ</h3>
        <p>
          消去による攻撃は、まず自分のおじゃま予告を相殺。残りを相手に送ります。相手のおじゃまはピース確定後に降ります。テトリスの攻撃1列は、ぷよのおじゃま6個に換算します。
        </p>
        <p>
          スワップは25秒ごとにルールが交代。2つの盤面をそれぞれ保持し、連鎖中は消去が終わってから交代します。
        </p>
      </section>
      <section>
        <h3>キーボード操作</h3>
        <div className="key-table">
          {[
            ['← / →', '左右移動（長押し対応）'],
            ['↓', 'ソフトドロップ'],
            ['↑ / X', '右回転'],
            ['Z', '左回転'],
            ['Space', 'ハードドロップ'],
            ['C / Shift', 'ホールド（テトリス）'],
            ['Esc / P', '一時停止'],
          ].map(([key, label]) => (
            <div key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="muted">
          同一端末2人対戦の操作は対戦設定画面に表示されます。スマホ・タブレットでは盤面下のボタンを使います。移動と回転の同時タッチ、左右・下の長押しに対応。
        </p>
      </section>
      <section>
        <h3>オンライン対戦</h3>
        <p>
          ルームを作成して、リンク・QR・8文字のコードを友達に送ります。相手が「準備完了」を押すと、ホストが対戦を開始できます。再戦はホストから行います。
        </p>
        <p>
          画面を切り替えたり通信が切れたりした場合は一時停止します。同じタブで再接続し、相手が戻ったらホストが再開してください。厳しいネットワーク制限がある回線では、接続設定でTURNサーバーを指定できます。
        </p>
      </section>
      <p className="fine-print">
        独自実装のファンメイドゲームです。公式作品・公式オンラインサービスとの互換性はありません。キャラクター・画像・音声は独自制作。対戦の攻撃量とタイミングには独自の調整を含みます。
      </p>
    </div>
  );
}

export function RecordsContent({ records }: { records: RecordEntry[] }) {
  if (!records.length)
    return (
      <div className="empty-state">
        <Trophy size={40} />
        <h3>最初の一戦を、記録しよう。</h3>
        <p>終了したゲームのスコアとタイムがここに残ります。</p>
      </div>
    );
  return (
    <div className="records-list">
      <p className="muted">このブラウザの最近30ゲーム。対戦は最終ラウンドのスコアです。</p>
      {records.map((record) => (
        <div className="record-row" key={record.id}>
          <span className={`record-icon ${record.kind}`}>
            <KindIcon kind={record.kind as Kind} />
          </span>
          <div>
            <strong>
              {MODE_NAMES[record.mode as Mode] || record.mode}
              {record.won ? ' · WIN' : ''}
            </strong>
            <small>
              {new Date(record.date).toLocaleDateString('ja-JP')} · {formatTime(record.elapsed)} ·{' '}
              {record.kind === 'puyo' ? `${record.chain} 連鎖` : `${record.lines} LINES`}
            </small>
          </div>
          <strong>
            {record.score.toLocaleString()}
            <small>PTS</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
