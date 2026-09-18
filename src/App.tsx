import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  CircleHelp,
  Crown,
  Flag,
  Home as HomeIcon,
  LoaderCircle,
  Maximize,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { command, createMatch, currentBoard, forfeit, isSolo, pause } from './game/engine';
import { DEFAULT_CONFIG, type MatchConfig, type Mode } from './game/types';
import { PlayerField } from './components/Board';
import { Controls } from './components/Controls';
import { Dialog } from './components/Dialog';
import {
  HelpContent,
  Home,
  MODE_NAMES,
  RecordsContent,
  SettingsContent,
  Setup,
  formatTime,
} from './components/Screens';
import { Lobby, NetworkSettings, OnlineSetup } from './components/Online';
import {
  DEFAULT_NETWORK,
  Room,
  createSession,
  invitedCode,
  loadSession,
  type NetworkConfig,
  type RoomSession,
  type RoomView,
} from './lib/network';
import { loadGame, loadSettings, records, write } from './lib/storage';
import { useGame } from './lib/useGame';

type Modal = 'settings' | 'help' | 'records' | 'network' | 'exit' | null;

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [screen, setScreen] = useState<'home' | 'setup' | 'online' | 'lobby'>(() => {
    const session = loadSession(),
      invitation = invitedCode();
    return invitation && session?.code !== invitation ? 'online' : 'home';
  });
  const [config, setConfig] = useState<MatchConfig>(() => ({
    ...structuredClone(DEFAULT_CONFIG),
    names: [loadSettings().name, 'CPU'],
  }));
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState(invitedCode);
  const [network, setNetwork] = useState<NetworkConfig>(DEFAULT_NETWORK);
  const [view, setView] = useState<RoomView | null>(null);
  const [hasSave, setHasSave] = useState(() => !!loadGame());
  const [hasSession, setHasSession] = useState(() => !!loadSession());
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const game = useGame(settings, (message) => notify(message));
  const { match } = game;
  const localIndex = view?.role === 'guest' ? 1 : 0;
  const fieldRef = useRef<HTMLDivElement>(null);

  function notify(message: string) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 5000);
  }
  const updateSettings = (next: typeof settings) => {
    setSettings(next);
    write('settings', next);
  };
  const openModal = (next: Modal) => {
    game.input.clear();
    if (game.engine.current && ['playing', 'countdown'].includes(game.engine.current.phase)) {
      if (game.room.current) game.room.current.requestPause(true);
      else pause(game.engine.current);
    }
    setModal(next);
  };
  const chooseMode = (mode: Mode) => {
    setConfig({
      ...config,
      mode,
      names: [settings.name.trim() || 'YOU', mode === 'cpu' ? 'CPU' : 'PLAYER 2'],
      rule: ['practice', 'sprint'].includes(mode) ? 'versus' : config.rule,
    });
    setScreen(mode === 'online' ? 'online' : 'setup');
  };
  const sanitized = (): MatchConfig => ({
    ...config,
    names: [config.names[0].trim() || 'YOU', config.names[1].trim() || 'PLAYER 2'],
  });
  const begin = () => {
    game.begin(sanitized());
    setHasSave(true);
  };
  const enterRoom = (session: RoomSession) => {
    game.room.current?.destroy(false);
    game.leave();
    setScreen('lobby');
    setHasSession(true);
    const room = new Room(
      session,
      {
        view: (next) => setView(next),
        state: (state) => game.sync(state),
        input: (action) => {
          if (game.engine.current) command(game.engine.current, 1, action);
        },
        notice: notify,
      },
      network,
    );
    game.room.current = room;
  };
  const host = () => {
    const cfg = { ...sanitized(), mode: 'online' as const };
    enterRoom(createSession('host', { name: cfg.names[0], kind: cfg.kinds[0] }, cfg));
  };
  const join = () => {
    const cfg = { ...sanitized(), mode: 'online' as const };
    enterRoom(createSession('guest', { name: cfg.names[0], kind: cfg.kinds[0] }, cfg, code));
  };
  const rejoin = () => {
    const session = loadSession();
    if (session) enterRoom(session);
    else setHasSession(false);
  };
  const leaveRoom = () => {
    game.room.current?.destroy();
    game.room.current = null;
    setView(null);
    setHasSession(false);
    game.leave();
    setScreen('home');
    history.replaceState(null, '', location.pathname + location.search);
  };
  const exitGame = () => {
    if (game.room.current) leaveRoom();
    else {
      game.leave();
      setScreen('home');
    }
    setHasSave(false);
    setModal(null);
  };
  const startOnline = () => {
    if (!view || !game.room.current) return;
    game.sound.unlock();
    const cfg = {
      ...view.config,
      mode: 'online' as const,
      names: [view.host.name, view.guest!.name] as [string, string],
      kinds: [view.host.kind, view.guest!.kind] as MatchConfig['kinds'],
    };
    game.room.current.start(createMatch(cfg));
  };
  const retryRoom = () => {
    const session = loadSession();
    if (session) enterRoom(session);
  };
  const rematch = () => {
    if (game.room.current) {
      if (view?.role === 'host') startOnline();
      else {
        game.room.current.requestRematch();
        notify('再戦の希望を送りました。ホストの開始を待ってください。');
      }
    } else if (match) game.begin(match.config);
  };

  useEffect(() => {
    const onHash = () => {
      const invited = invitedCode();
      if (invited && !game.engine.current && !game.room.current) {
        setCode(invited);
        setScreen('online');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      clearTimeout(noticeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!match) window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (match) {
      fieldRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [match?.id]);

  const backHome = () => {
    if (match || view) openModal('exit');
    else setScreen('home');
  };
  const solo = match ? isSolo(match) : false;
  const board = match ? currentBoard(match.players[localIndex]) : null;
  const active = match?.phase === 'playing';

  return (
    <div className={`app ${match ? 'in-game' : ''}`}>
      <a className="skip-link" href="#main">
        メインへスキップ
      </a>
      <header className="site-header">
        <button className="brand" onClick={backHome} aria-label="DROP ARENA ホーム">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            DROP<span className="brand-light">ARENA</span>
            <small>PUYO × TETRIS</small>
          </span>
        </button>
        <nav aria-label="メインメニュー">
          {!match && (
            <>
              <button className="nav-play" onClick={() => setScreen('home')}>
                PLAY
                <span />
              </button>
              <button className="nav-label" aria-label="遊び方" onClick={() => openModal('help')}>
                <CircleHelp size={16} />
                <span>遊び方</span>
              </button>
              <button className="nav-label" aria-label="記録" onClick={() => openModal('records')}>
                <Trophy size={16} />
                <span>記録</span>
              </button>
            </>
          )}
          <button
            className="icon-button sound-button"
            aria-label={settings.sound ? '効果音をオフ' : '効果音をオン'}
            onClick={() => {
              updateSettings({ ...settings, sound: !settings.sound });
              if (!settings.sound) setTimeout(() => game.sound.unlock(), 0);
            }}
          >
            {settings.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button className="icon-button" aria-label="設定" onClick={() => openModal('settings')}>
            <Settings2 size={19} />
          </button>
        </nav>
      </header>

      {!match && screen === 'home' && (
        <Home
          onMode={chooseMode}
          onHelp={() => setModal('help')}
          hasSave={hasSave}
          onResume={() => {
            const saved = loadGame();
            if (saved) game.sync(saved);
            else {
              setHasSave(false);
              notify('再開できるデータがありません。');
            }
          }}
          hasSession={hasSession}
          onRejoin={rejoin}
        />
      )}
      {!match && screen === 'setup' && (
        <Setup
          config={config}
          onChange={setConfig}
          onStart={begin}
          onBack={() => setScreen('home')}
        />
      )}
      {!match && screen === 'online' && (
        <OnlineSetup
          config={config}
          onChange={setConfig}
          code={code}
          setCode={setCode}
          onHost={host}
          onJoin={join}
          onBack={() => setScreen('home')}
          onNetwork={() => setModal('network')}
        />
      )}
      {!match &&
        screen === 'lobby' &&
        (view ? (
          <Lobby
            view={view}
            onStart={startOnline}
            onReady={() => game.room.current?.ready(!view.ready)}
            onLeave={leaveRoom}
            onRetry={retryRoom}
            onNotice={notify}
          />
        ) : (
          <main id="main" className="loading-state">
            <LoaderCircle className="spinning" />
            接続しています…
          </main>
        ))}

      {match && (
        <main
          id="main"
          className={`game-page ${solo ? 'solo-game' : ''} ${match.config.mode === 'local' ? 'local-game' : ''}`}
          ref={fieldRef}
          tabIndex={-1}
        >
          <div className="game-toolbar">
            <button className="back-link" onClick={() => openModal('exit')}>
              <ChevronLeft size={16} />
              <span>ホーム</span>
            </button>
            <div className="game-mode-label">
              <span className="status-dot" />
              {MODE_NAMES[match.config.mode]}
              <span className="toolbar-divider" />
              {match.config.rule === 'swap' ? 'SWAP' : 'VS'}
              {view && (
                <span className="online-latency">
                  <Wifi size={12} />
                  {view.latency ?? '—'} ms
                </span>
              )}
            </div>
            <div className="game-tools">
              <button
                className="icon-button fullscreen-button"
                aria-label="全画面表示"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else if (fieldRef.current?.requestFullscreen)
                    void fieldRef.current
                      .requestFullscreen()
                      .catch(() => notify('この端末では全画面表示に対応していません。'));
                  else notify('この端末では全画面表示に対応していません。');
                }}
              >
                <Maximize size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="ゲームを一時停止"
                onClick={game.togglePause}
                disabled={!['playing', 'countdown', 'paused'].includes(match.phase)}
              >
                <Pause size={19} />
              </button>
            </div>
          </div>
          <div className="match-stage">
            <div className="main-field">
              <PlayerField
                player={match.players[localIndex]}
                index={localIndex}
                labels={settings.labels}
                showGhost={settings.ghost}
                firstTo={match.config.firstTo}
              />
            </div>
            {!solo && (
              <div className="match-center">
                <span className="micro-label">ROUND {match.round}</span>
                <div className="match-score">
                  {match.players[localIndex].wins}
                  <span>:</span>
                  {match.players[1 - localIndex].wins}
                </div>
                <span className="versus-badge">VS</span>
                <time>{formatTime(match.roundElapsed)}</time>
                {match.config.rule === 'swap' && (
                  <div className="swap-timer">
                    <RefreshCw size={16} />
                    <strong>{Math.max(0, Math.ceil(match.swapIn / 1000))}</strong>
                    <span>NEXT SWAP</span>
                  </div>
                )}
                <div className="battle-note">
                  <Swords size={18} />
                  <span>{match.config.firstTo}本先取</span>
                </div>
              </div>
            )}
            {!solo && (
              <div className="rival-field">
                <PlayerField
                  player={match.players[1 - localIndex]}
                  index={1 - localIndex}
                  labels={settings.labels}
                  showGhost={settings.ghost}
                  firstTo={match.config.firstTo}
                  opponent={match.config.mode !== 'local'}
                  local={match.config.mode === 'local'}
                />
              </div>
            )}
            {solo && (
              <aside className="solo-sidebar">
                <span className="eyebrow">
                  {match.config.mode === 'sprint' ? 'BEAT YOUR BEST' : 'ONE DROP AT A TIME'}
                </span>
                <h2>
                  {match.config.mode === 'practice'
                    ? '自分のペースで。'
                    : board?.kind === 'tetris'
                      ? '40ラインへの挑戦。'
                      : '120秒の集中。'}
                </h2>
                <div className="solo-time">
                  <span>
                    {match.config.mode === 'sprint' && board?.kind === 'puyo'
                      ? 'REMAINING'
                      : 'TIME'}
                  </span>
                  <strong>
                    {formatTime(
                      match.config.mode === 'sprint' && board?.kind === 'puyo'
                        ? Math.max(0, 120_000 - match.elapsed)
                        : match.elapsed,
                    )}
                  </strong>
                </div>
                {match.config.mode === 'sprint' && board?.kind === 'tetris' && (
                  <div className="sprint-progress">
                    <span>{board.lines} / 40 LINES</span>
                    <progress value={board.lines} max={40} aria-label="40ラインの進捗" />
                  </div>
                )}
                <div className="solo-tips">
                  <span className="pill">PLAY TIP</span>
                  <p>
                    {board?.kind === 'puyo'
                      ? '消した後の形を想像してみよう。3つのかたまりをつくると、連鎖のきっかけに。'
                      : '平らな地形を保ち、穴をつくらないように。Iミノをホールドして4ライン消去を狙おう。'}
                  </p>
                  <button className="text-button" onClick={() => openModal('help')}>
                    ルールと操作
                    <ArrowRight size={14} />
                  </button>
                </div>
              </aside>
            )}
          </div>
          <div className="controls-area">
            <div className="own-controls">
              <Controls
                player={localIndex}
                kind={match.players[localIndex].kind}
                input={game.input}
                disabled={!active}
                local={match.config.mode === 'local'}
              />
            </div>
            {match.config.mode === 'local' && (
              <div className="other-controls">
                <Controls
                  player={1}
                  kind={match.players[1].kind}
                  input={game.input}
                  disabled={!active}
                  local
                />
              </div>
            )}
          </div>
          <div className="game-footnote">
            <span>移動は長押し対応 · タッチでもキーボードでも</span>
            <button className="text-button" onClick={() => openModal('help')}>
              <CircleHelp size={14} />
              操作ガイド
            </button>
          </div>

          {(match.phase === 'countdown' || match.phase === 'roundEnd') && (
            <div className="stage-overlay countdown-overlay" aria-live="polite">
              <div
                key={`${match.phase}-${Math.ceil(match.timer / 1000)}`}
                className="countdown-card"
              >
                {match.phase === 'countdown' ? (
                  <>
                    <span>ROUND {match.round}</span>
                    <strong>{Math.max(1, Math.ceil(match.timer / 1000))}</strong>
                    <p>READY TO DROP?</p>
                  </>
                ) : (
                  <>
                    <Crown size={36} />
                    <strong className="round-winner">
                      {match.winner === null ? 'DRAW' : `${match.players[match.winner].name} WIN`}
                    </strong>
                    <p>次のラウンドへ</p>
                  </>
                )}
              </div>
            </div>
          )}
          {match.phase === 'paused' && (
            <div className="stage-overlay pause-overlay">
              <section className="pause-card" aria-labelledby="pause-title">
                <Pause size={28} />
                <span className="eyebrow">TAKE A BREATH</span>
                <h2 id="pause-title">一時停止中</h2>
                <p>
                  {view?.status !== 'connected' && view
                    ? '接続が戻るまで盤面を保持しています。'
                    : view?.role === 'guest'
                      ? '準備ができたらホストに再開を知らせてください。'
                      : '準備ができたら、続きをどうぞ。'}
                </p>
                <button
                  className="button primary full"
                  disabled={!!view && view.status !== 'connected'}
                  onClick={() => {
                    game.sound.unlock();
                    game.togglePause();
                    if (view?.role === 'guest') notify('再開できることをホストに知らせました。');
                  }}
                >
                  <Play size={17} />
                  {view?.role === 'guest' ? '再開準備OK' : 'ゲームを再開'}
                </button>
                {view && view.status !== 'connected' && (
                  <button className="button secondary full" onClick={retryRoom}>
                    <RefreshCw size={16} />
                    再接続する
                  </button>
                )}
                <button
                  className="button secondary full"
                  onClick={() => {
                    if (game.room.current) game.room.current.surrender();
                    else if (game.engine.current) forfeit(game.engine.current, 0);
                  }}
                >
                  <Flag size={16} />
                  リタイアして結果を見る
                </button>
                <button className="text-button" onClick={() => openModal('exit')}>
                  ホームへ戻る
                </button>
              </section>
            </div>
          )}
          {match.phase === 'finished' && (
            <div className="stage-overlay results-overlay">
              <section className="result-card" aria-labelledby="result-title">
                <div className="result-medal">
                  <Trophy size={34} />
                </div>
                <span className="eyebrow">{solo ? 'YOUR SESSION' : 'GOOD GAME, WELL PLAYED'}</span>
                <h1 id="result-title">
                  {solo
                    ? match.winner === 0
                      ? 'CHALLENGE CLEAR!'
                      : 'NICE PRACTICE!'
                    : match.winner === null
                      ? 'DRAW'
                      : match.winner === localIndex
                        ? 'YOU WIN!'
                        : 'NEXT TIME!'}
                </h1>
                <p>
                  {solo
                    ? match.reason
                    : match.winner === null
                      ? '引き分け'
                      : `${match.players[match.winner].name} の勝利`}
                </p>
                {!solo && (
                  <div className="result-score">
                    {match.players[localIndex].wins}
                    <span>—</span>
                    {match.players[1 - localIndex].wins}
                  </div>
                )}
                <div className="result-stats">
                  <div>
                    <span>SCORE</span>
                    <strong>{board!.score.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>{board!.kind === 'puyo' ? 'BEST CHAIN' : 'LINES'}</span>
                    <strong>{board!.kind === 'puyo' ? board!.maxChain : board!.lines}</strong>
                  </div>
                  <div>
                    <span>TIME</span>
                    <strong>{formatTime(match.elapsed)}</strong>
                  </div>
                </div>
                <button className="button primary full" onClick={rematch}>
                  <RefreshCw size={17} />
                  {view?.role === 'guest' ? '再戦をリクエスト' : 'もう一度プレイ'}
                </button>
                <button className="button secondary full" onClick={exitGame}>
                  <HomeIcon size={17} />
                  ホームへ戻る
                </button>
                <span className="result-saved">
                  <Check size={13} />
                  {game.recordSaved
                    ? '記録をこのブラウザに保存しました'
                    : 'ブラウザの保存を利用できませんでした'}
                </span>
              </section>
            </div>
          )}
        </main>
      )}

      {!match && (
        <footer className="site-footer">
          <span>DROP ARENA © {new Date().getFullYear()}</span>
          <span>FAN-MADE · BUILT FOR THE LOVE OF PUZZLES</span>
          <button onClick={() => openModal('help')}>
            ABOUT & HOW TO PLAY
            <ArrowRight size={12} />
          </button>
        </footer>
      )}
      {modal && (
        <Dialog
          title={
            {
              settings: 'プレイ設定',
              help: '遊び方・操作ガイド',
              records: 'あなたの記録',
              network: 'オンライン接続設定',
              exit: 'ホームへ戻りますか？',
            }[modal]
          }
          wide={modal === 'help'}
          onClose={() => setModal(null)}
        >
          {modal === 'settings' && (
            <SettingsContent settings={settings} onChange={updateSettings} />
          )}
          {modal === 'help' && <HelpContent />}
          {modal === 'records' && <RecordsContent records={records()} />}
          {modal === 'network' && <NetworkSettings value={network} onChange={setNetwork} />}
          {modal === 'exit' && (
            <div className="exit-content">
              <p>
                このゲームを終了してホームに戻ります。
                {view
                  ? 'オンラインルームからも退出します。'
                  : '続けたい場合は「ゲームに戻る」を選んでください。'}
              </p>
              <button className="button secondary full" onClick={() => setModal(null)}>
                <ArrowLeft size={17} />
                ゲームに戻る
              </button>
              <button className="button danger-button full" onClick={exitGame}>
                終了してホームへ
              </button>
            </div>
          )}
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
