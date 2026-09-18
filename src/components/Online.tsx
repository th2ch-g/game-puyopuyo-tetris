import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Copy,
  Globe2,
  Link2,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Wifi,
} from 'lucide-react';
import type { MatchConfig } from '../game/types';
import { KindSelect } from './Screens';
import {
  cleanCode,
  inviteLink,
  validCode,
  type NetworkConfig,
  type RoomView,
} from '../lib/network';

export function OnlineSetup({
  config,
  onChange,
  code,
  setCode,
  onHost,
  onJoin,
  onBack,
  onNetwork,
}: {
  config: MatchConfig;
  onChange: (config: MatchConfig) => void;
  code: string;
  setCode: (value: string) => void;
  onHost: () => void;
  onJoin: () => void;
  onBack: () => void;
  onNetwork: () => void;
}) {
  return (
    <main id="main" className="online-page">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={16} />
        ホームへ
      </button>
      <div className="page-heading">
        <span className="eyebrow">GOOD GAMES, ANYWHERE</span>
        <h1>離れていても、対戦。</h1>
        <p>リンクを送るだけ。友達と同じアリーナへ。</p>
      </div>
      <div className="online-grid">
        <section className="panel online-profile">
          <span className="pill green">YOUR STYLE</span>
          <label htmlFor="online-name">プレイヤー名</label>
          <input
            id="online-name"
            value={config.names[0]}
            maxLength={16}
            placeholder="YOU"
            onChange={(e) => onChange({ ...config, names: [e.target.value, config.names[1]] })}
          />
          <KindSelect
            value={config.kinds[0]}
            onChange={(kind) => onChange({ ...config, kinds: [kind, config.kinds[1]] })}
            label="あなたのパズル"
          />
          <div className="online-facts">
            <span>
              <Globe2 size={17} />
              2人でリアルタイム対戦
            </span>
            <span>
              <Link2 size={17} />
              アカウント・インストール不要
            </span>
            <span>
              <Wifi size={17} />
              接続中はこの画面を開いたままに
            </span>
          </div>
        </section>
        <div className="online-options">
          <section className="panel">
            <div className="panel-title">
              <Plus size={20} />
              <h2>ルームをつくる</h2>
            </div>
            <div className="online-settings">
              <label>
                ルール
                <select
                  aria-label="ルール"
                  value={config.rule}
                  onChange={(e) =>
                    onChange({ ...config, rule: e.target.value as MatchConfig['rule'] })
                  }
                >
                  <option value="versus">VS バトル</option>
                  <option value="swap">スワップ · 25秒交代</option>
                </select>
              </label>
              <label>
                勝利条件
                <select
                  aria-label="勝利条件"
                  value={config.firstTo}
                  onChange={(e) => onChange({ ...config, firstTo: Number(e.target.value) })}
                >
                  <option value="1">1本先取</option>
                  <option value="2">2本先取</option>
                  <option value="3">3本先取</option>
                </select>
              </label>
            </div>
            <button className="button primary full" onClick={onHost}>
              ルーム作成
              <ArrowRight size={18} />
            </button>
          </section>
          <section className="panel">
            <div className="panel-title">
              <Send size={19} />
              <h2>コードで参加</h2>
            </div>
            <label htmlFor="room-code" className="sr-only">
              招待コード
            </label>
            <div className="join-row">
              <input
                id="room-code"
                className="code-input"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="8文字のコード"
                value={code}
                maxLength={8}
                onChange={(e) => setCode(cleanCode(e.target.value))}
              />
              <button className="button secondary" disabled={!validCode(code)} onClick={onJoin}>
                参加する
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
          <button className="text-button network-link" onClick={onNetwork}>
            <Wifi size={15} />
            接続設定 · TURN / シグナリング
          </button>
        </div>
      </div>
    </main>
  );
}

export function Lobby({
  view,
  onStart,
  onReady,
  onLeave,
  onRetry,
  onNotice,
}: {
  view: RoomView;
  onStart: () => void;
  onReady: () => void;
  onLeave: () => void;
  onRetry: () => void;
  onNotice: (text: string) => void;
}) {
  const [qr, setQr] = useState('');
  const link = inviteLink(view.code);
  useEffect(() => {
    void QRCode.toDataURL(link, {
      width: 200,
      margin: 2,
      color: { dark: '#101423', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [link]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onNotice('コピーしました。');
    } catch {
      onNotice('コピーできませんでした。下のリンクを選択してコピーしてください。');
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DROP ARENAで対戦しよう',
          text: 'ぷよ × テトリス、どっちで勝負する？',
          url: link,
        });
      } catch {
        /* Dismissed share sheets leave the room open. */
      }
    } else void copy(link);
  };
  return (
    <main id="main" className="lobby-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR ARENA IS READY</span>
        <h1>対戦ロビー</h1>
        <p>
          {view.config.rule === 'swap' ? 'スワップ · 25秒交代' : 'VS バトル'} ·{' '}
          {view.config.firstTo}本先取
        </p>
      </div>
      <div className="lobby-grid">
        <section className="panel invite-panel">
          <div className="panel-title">
            <Link2 size={20} />
            <h2>友達を招待しよう</h2>
          </div>
          <span className="micro-label">ROOM CODE</span>
          <div className="room-code-display" data-testid="room-code">
            {view.code}
          </div>
          <button className="text-button" onClick={() => void copy(view.code)}>
            <Copy size={15} />
            コードをコピー
          </button>
          {qr && (
            <img
              className="invite-qr"
              src={qr}
              width="160"
              height="160"
              alt="ルーム招待リンクのQRコード"
            />
          )}
          <div className="invite-actions">
            <button className="button secondary" onClick={() => void copy(link)}>
              <Copy size={16} />
              リンクをコピー
            </button>
            <button className="icon-button" onClick={() => void share()} aria-label="招待を共有">
              <Share2 size={20} />
            </button>
          </div>
          <label className="invite-link-label">
            招待リンク
            <input value={link} readOnly onFocus={(e) => e.target.select()} />
          </label>
        </section>
        <section className="panel room-members">
          <span className="micro-label">PLAYERS · {view.guest ? '2' : '1'} / 2</span>
          {[view.host, view.guest].map((member, i) => (
            <div className="member-row" key={i}>
              <span className={`member-number ${i ? 'purple' : 'green'}`}>P{i + 1}</span>
              <div>
                <strong>{member?.name || '友達の参加を待っています'}</strong>
                <small>
                  {member
                    ? `${member.kind === 'puyo' ? 'ぷよ' : 'テトリス'} · ${i === 0 ? 'ホスト' : 'ゲスト'}`
                    : '招待リンクまたはコードで参加'}
                </small>
              </div>
              {member && (
                <span className={`member-status ${i === 0 || view.ready ? 'ready' : ''}`}>
                  {i === 0 || view.ready ? (
                    <>
                      <Check size={13} />
                      準備完了
                    </>
                  ) : (
                    '準備中'
                  )}
                </span>
              )}
            </div>
          ))}
          <div
            className={`connection-status ${view.status === 'error' ? 'connection-error' : ''}`}
            role="status"
          >
            {view.status === 'connected' ? (
              <Wifi size={19} />
            ) : view.status === 'error' ? (
              <Globe2 size={19} />
            ) : (
              <LoaderCircle className="spinning" size={19} />
            )}
            <span>{view.message}</span>
          </div>
          {view.latency !== null && <span className="latency">往復 {view.latency} ms</span>}
          <div className="lobby-buttons">
            {view.status === 'error' || view.status === 'reconnecting' ? (
              <button className="button secondary full" onClick={onRetry}>
                <RefreshCw size={17} />
                再接続する
              </button>
            ) : view.role === 'host' ? (
              <button
                className="button primary full"
                disabled={!view.ready || view.status !== 'connected'}
                onClick={onStart}
              >
                対戦スタート
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className={`button ${view.ready ? 'secondary' : 'primary'} full`}
                disabled={view.status !== 'connected'}
                onClick={onReady}
              >
                <Check size={19} />
                {view.ready ? '準備を取り消す' : '準備完了'}
              </button>
            )}
            <button className="text-button" onClick={onLeave}>
              <LogOut size={16} />
              ルームを退出
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export function NetworkSettings({
  value,
  onChange,
}: {
  value: NetworkConfig;
  onChange: (value: NetworkConfig) => void;
}) {
  const update = (patch: Partial<NetworkConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="network-settings">
      <p className="muted">
        通常は設定不要です。企業・学校など接続が制限される回線では、利用できるTURNサーバーを指定してください。認証情報はこのタブのメモリだけに保持します。
      </p>
      <label>
        TURN URL
        <input
          placeholder="turn:relay.example.com:3478"
          value={value.turnUrl}
          onChange={(e) => update({ turnUrl: e.target.value })}
        />
      </label>
      <label>
        TURN ユーザー名
        <input
          autoComplete="off"
          value={value.turnUsername}
          onChange={(e) => update({ turnUsername: e.target.value })}
        />
      </label>
      <label>
        TURN パスワード
        <input
          type="password"
          autoComplete="off"
          value={value.turnCredential}
          onChange={(e) => update({ turnCredential: e.target.value })}
        />
      </label>
      <details>
        <summary>独自のシグナリングサーバー</summary>
        <p className="muted">
          PeerServer互換のサービスを使用します。空欄ではPeerJSの既定サービスを使用します。
        </p>
        <label>
          ホスト名
          <input
            placeholder="signal.example.com"
            value={value.host}
            onChange={(e) => update({ host: e.target.value })}
          />
        </label>
        <label>
          ポート
          <input
            type="number"
            min="1"
            max="65535"
            value={value.port}
            onChange={(e) => update({ port: Number(e.target.value) })}
          />
        </label>
        <label>
          パス
          <input value={value.path} onChange={(e) => update({ path: e.target.value })} />
        </label>
        <label className="toggle-row">
          <span>HTTPS / WSS</span>
          <input
            type="checkbox"
            checked={value.secure}
            onChange={(e) => update({ secure: e.target.checked })}
          />
        </label>
      </details>
      <p className="fine-print">設定の変更は次に作成・参加するルームへ適用されます。</p>
    </div>
  );
}
