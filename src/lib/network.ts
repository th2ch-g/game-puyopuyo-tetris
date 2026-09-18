import Peer, { util, type DataConnection, type PeerOptions } from 'peerjs';
import { command, forfeit, pause, validConfig, validMatch } from '../game/engine';
import { ACTIONS, type Action, type Kind, type Match, type MatchConfig } from '../game/types';
import { read, remove, write } from './storage';

const PREFIX = 'drop-arena-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export interface Member {
  name: string;
  kind: Kind;
}
export interface NetworkConfig {
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
  host: string;
  port: number;
  path: string;
  secure: boolean;
}
export const DEFAULT_NETWORK: NetworkConfig = {
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
  host: '',
  port: 443,
  path: '/',
  secure: true,
};
export interface RoomSession {
  role: 'host' | 'guest';
  code: string;
  token: string;
  member: Member;
  config: MatchConfig;
}
export interface RoomView {
  role: 'host' | 'guest';
  code: string;
  status: 'connecting' | 'waiting' | 'connected' | 'reconnecting' | 'error';
  host: Member;
  guest: Member | null;
  ready: boolean;
  latency: number | null;
  message: string;
  config: MatchConfig;
}
interface Callbacks {
  view: (view: RoomView) => void;
  state: (match: Match) => void;
  input: (action: Action) => void;
  notice: (message: string) => void;
}
type Packet = { v: number; type: string; [key: string]: unknown };
interface HostSave {
  state: Match | null;
  guest: Member | null;
  token: string | null;
  ready: boolean;
}

export function validCode(code: string) {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}
export function cleanCode(code: string) {
  return code
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 8);
}
export function inviteLink(code: string) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `room=${code}`;
  return url.href;
}
export function invitedCode() {
  const code = new URLSearchParams(location.hash.slice(1)).get('room') || '';
  return validCode(code) ? code : '';
}
function validMember(value: unknown): value is Member {
  const m = value as Member;
  return (
    !!m &&
    typeof m.name === 'string' &&
    m.name.trim().length > 0 &&
    m.name.length <= 16 &&
    ['puyo', 'tetris'].includes(m.kind)
  );
}
export function createSession(
  role: 'host' | 'guest',
  member: Member,
  config: MatchConfig,
  code?: string,
): RoomSession {
  return {
    role,
    member,
    config,
    code:
      code ||
      Array.from(
        crypto.getRandomValues(new Uint8Array(8)),
        (b) => ALPHABET[b % ALPHABET.length],
      ).join(''),
    token: crypto.randomUUID(),
  };
}
export function loadSession(): RoomSession | null {
  const s = read<RoomSession | null>('session', null, true);
  return s &&
    ['host', 'guest'].includes(s.role) &&
    validCode(s.code) &&
    typeof s.token === 'string' &&
    /^[\da-f-]{36}$/i.test(s.token) &&
    validMember(s.member) &&
    validConfig(s.config)
    ? s
    : null;
}

export class Room {
  readonly session: RoomSession;
  view: RoomView;
  private peer: Peer;
  private connection: DataConnection | null = null;
  private pendingConnections = new Set<DataConnection>();
  private closed = false;
  private rejected = false;
  private token: string | null = null;
  private latest: Match | null = null;
  private timer: ReturnType<typeof setInterval>;
  private started = Date.now();
  private lastHeard = Date.now();
  private lastConnect = 0;
  private lastPublish = 0;
  private lastSave = 0;
  private seq = 0;
  private ack = 0;
  private pending: { seq: number; action: Action }[] = [];
  private inputWindow = 0;
  private inputCount = 0;
  private connectedOnce = false;
  private remotePaused = false;
  private saveOnExit = () => {
    if (this.session.role === 'host') this.persist();
  };

  constructor(
    session: RoomSession,
    private callbacks: Callbacks,
    config: NetworkConfig = DEFAULT_NETWORK,
  ) {
    this.session = session;
    this.view = {
      role: session.role,
      code: session.code,
      status: 'connecting',
      host: session.member,
      guest: null,
      ready: false,
      latency: null,
      message: '接続サービスにつないでいます…',
      config: session.config,
    };
    if (session.role === 'host') {
      const saved = read<HostSave | null>(`host:${session.code}`, null, true);
      if (saved && (!saved.state || validMatch(saved.state))) {
        this.latest = saved.state;
        this.token = typeof saved.token === 'string' ? saved.token : null;
        this.view.guest = validMember(saved.guest) ? saved.guest : null;
        this.view.ready = !!saved.ready;
        if (this.latest) {
          if (this.latest.phase === 'playing' || this.latest.phase === 'countdown')
            pause(this.latest);
          callbacks.state(this.latest);
        }
      }
    }
    write('session', session, true);
    const iceServers: RTCIceServer[] = [
      ...util.defaultConfig.iceServers,
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];
    if (/^turns?:[^\s]+$/.test(config.turnUrl))
      iceServers.push({
        urls: config.turnUrl,
        username: config.turnUsername,
        credential: config.turnCredential,
      });
    const options: PeerOptions = { debug: 0, pingInterval: 5000, config: { iceServers } };
    if (config.host)
      Object.assign(options, {
        host: config.host,
        port: config.port,
        path: config.path,
        secure: config.secure,
      });
    this.peer =
      session.role === 'host' ? new Peer(PREFIX + session.code, options) : new Peer(options);
    this.peer.on('open', () => {
      if (this.closed) return;
      if (session.role === 'host')
        this.status(
          this.latest ? 'reconnecting' : 'waiting',
          this.latest ? '相手の再接続を待っています。' : '招待コードを友達に送ってください。',
        );
      else this.connect();
    });
    this.peer.on('connection', (conn) => {
      if (session.role !== 'host' || this.pendingConnections.size >= 4) {
        conn.on('open', () => conn.close());
        return;
      }
      this.attach(conn);
    });
    this.peer.on('disconnected', () => {
      if (!this.connection?.open) this.lost();
    });
    this.peer.on('error', (error) => {
      if (this.closed) return;
      if (this.connection?.open && this.view.status === 'connected') return;
      const messages: Record<string, string> = {
        'unavailable-id':
          'このルームは別のタブで開いています。元のタブに戻るか、新しいルームを作成してください。',
        'peer-unavailable':
          'ルームが見つかりません。コードと、ホストの画面が開いているかを確認してください。',
        network: '接続サービスに届きません。通信環境を確認して再接続してください。',
        webrtc: '端末間で接続できません。別の回線か、接続設定のTURNサーバーをお試しください。',
      };
      this.status(
        this.connectedOnce ? 'reconnecting' : 'error',
        messages[error.type] || '接続に失敗しました。再接続してください。',
      );
    });
    this.timer = setInterval(() => this.tick(), 1000);
    window.addEventListener('pagehide', this.saveOnExit);
    this.emit();
  }

  private emit() {
    this.callbacks.view(structuredClone(this.view));
  }
  private status(status: RoomView['status'], message: string) {
    this.view.status = status;
    this.view.message = message;
    this.emit();
  }
  private send(type: string, body: Record<string, unknown> = {}) {
    if (this.connection?.open) this.connection.send({ v: 1, type, ...body });
  }
  private connect() {
    if (
      this.closed ||
      this.peer.destroyed ||
      this.peer.disconnected ||
      this.connection?.open ||
      Date.now() - this.lastConnect < 3000
    )
      return;
    this.lastConnect = Date.now();
    this.connection?.close();
    const conn = this.peer.connect(PREFIX + this.session.code, {
      reliable: true,
      serialization: 'json',
    });
    this.connection = conn;
    this.attach(conn);
  }
  private attach(conn: DataConnection) {
    this.pendingConnections.add(conn);
    const timeout = setTimeout(() => {
      if (this.pendingConnections.has(conn)) {
        conn.close();
        this.pendingConnections.delete(conn);
      }
    }, 15_000);
    conn.on('open', () => {
      if (this.closed) {
        conn.close();
        return;
      }
      if (this.session.role === 'guest') {
        this.connection = conn;
        conn.send({ v: 1, type: 'hello', token: this.session.token, member: this.session.member });
      }
    });
    conn.on('data', (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const packet = value as Packet;
      if (packet.v !== 1 || typeof packet.type !== 'string') return;
      if (this.session.role === 'host' && packet.type === 'hello') {
        if (
          !validMember(packet.member) ||
          typeof packet.token !== 'string' ||
          !/^[\da-f-]{36}$/i.test(packet.token)
        ) {
          conn.close();
          return;
        }
        if (this.token && this.token !== packet.token) {
          conn.send({ v: 1, type: 'reject', message: 'このルームは満員です。' });
          setTimeout(() => conn.close(), 200);
          return;
        }
        const previous = this.connection;
        this.connection = conn;
        if (previous && previous !== conn) previous.close();
        this.token = packet.token;
        this.view.guest = packet.member;
        this.view.config.kinds[1] = packet.member.kind;
        this.view.config.names[1] = packet.member.name;
        this.pendingConnections.delete(conn);
        clearTimeout(timeout);
        this.lastHeard = Date.now();
        this.connectedOnce = true;
        this.ack = 0;
        this.status(
          'connected',
          this.latest
            ? '再接続しました。再開できます。'
            : '友達が参加しました。準備完了を待ってください。',
        );
        this.send('welcome', { view: this.view, state: this.latest });
        this.persist();
        return;
      }
      if (conn !== this.connection) return;
      this.lastHeard = Date.now();
      this.receive(packet);
      if (packet.type === 'welcome') {
        this.pendingConnections.delete(conn);
        clearTimeout(timeout);
      }
    });
    conn.on('close', () => {
      clearTimeout(timeout);
      this.pendingConnections.delete(conn);
      if (!this.closed && conn === this.connection) {
        this.connection = null;
        if (!this.rejected) this.lost();
      }
    });
    conn.on('error', () => {
      if (conn === this.connection && !this.closed) this.lost();
    });
  }

  private receive(packet: Packet) {
    if (packet.type === 'ping' && typeof packet.at === 'number') {
      this.send('pong', { at: packet.at });
      return;
    }
    if (packet.type === 'pong' && typeof packet.at === 'number') {
      this.view.latency = Math.max(0, Date.now() - packet.at);
      this.emit();
      return;
    }
    if (packet.type === 'bye') {
      this.callbacks.notice('相手がルームを退出しました。');
      this.lost();
      this.connection?.close();
      return;
    }
    if (this.session.role === 'guest') {
      if (packet.type === 'reject') {
        this.rejected = true;
        this.status(
          'error',
          typeof packet.message === 'string' ? packet.message : '参加できませんでした。',
        );
        return;
      }
      if (packet.type === 'welcome' || packet.type === 'view') {
        const view = packet.view as RoomView;
        if (
          !view ||
          !validMember(view.host) ||
          (view.guest !== null && !validMember(view.guest)) ||
          typeof view.ready !== 'boolean' ||
          view.code !== this.session.code ||
          !validConfig(view.config)
        )
          return;
        this.view = {
          ...view,
          role: 'guest',
          status: 'connected',
          latency: this.view.latency,
          message: '接続しました。準備ができたら「準備完了」を押してください。',
        };
        this.connectedOnce = true;
        this.seq = 0;
        this.pending = [];
        this.emit();
        if (packet.state && validMatch(packet.state)) {
          this.latest = packet.state;
          this.callbacks.state(packet.state);
        }
      }
      if (packet.type === 'state' && validMatch(packet.state)) {
        const state = packet.state;
        if (this.latest?.id !== state.id) {
          this.pending = [];
          this.seq = 0;
        }
        if (this.latest?.id === state.id && state.revision < this.latest.revision - 100) return;
        this.pending = this.pending.filter((p) => p.seq > Number(packet.ack || 0));
        for (const input of this.pending) command(state, 1, input.action);
        this.latest = state;
        this.callbacks.state(state);
      }
      return;
    }
    if (packet.type === 'ready' && !this.latest) {
      this.view.ready = packet.ready === true;
      this.send('view', { view: this.view });
      this.emit();
      this.persist();
    }
    if (
      packet.type === 'input' &&
      typeof packet.seq === 'number' &&
      Number.isInteger(packet.seq) &&
      packet.seq > this.ack &&
      ACTIONS.includes(packet.action as Action)
    ) {
      const now = Date.now();
      if (now - this.inputWindow > 1000) {
        this.inputWindow = now;
        this.inputCount = 0;
      }
      if (++this.inputCount > 100) return;
      this.ack = packet.seq;
      if (this.view.status === 'connected' && this.latest?.phase === 'playing')
        this.callbacks.input(packet.action as Action);
    }
    if (packet.type === 'pause' && this.latest && typeof packet.paused === 'boolean') {
      this.remotePaused = packet.paused;
      if (packet.paused && ['playing', 'countdown'].includes(this.latest.phase)) {
        pause(this.latest);
        this.callbacks.state(this.latest);
      }
      if (!packet.paused) this.callbacks.notice('相手が再開できる状態になりました。');
      this.broadcast(true);
    }
    if (packet.type === 'rematch')
      this.callbacks.notice('相手が再戦を希望しています。ホストから再戦できます。');
    if (packet.type === 'forfeit' && this.latest && this.latest.phase !== 'finished') {
      forfeit(this.latest, 1);
      this.callbacks.state(this.latest);
      this.broadcast(true);
    }
  }

  private lost() {
    if (this.latest && ['playing', 'countdown'].includes(this.latest.phase)) {
      pause(this.latest);
      this.callbacks.state(this.latest);
    }
    this.status('reconnecting', '接続が途切れました。盤面を保ったまま再接続しています…');
  }
  private tick() {
    if (this.closed) return;
    if (this.peer.disconnected && !this.peer.destroyed) {
      try {
        this.peer.reconnect();
      } catch {
        /* The next heartbeat retries signaling. */
      }
    }
    if (this.connection?.open) {
      if (Date.now() - this.lastHeard > 8000) {
        this.connection.close();
        this.connection = null;
        this.lost();
      } else this.send('ping', { at: Date.now() });
    } else if (this.session.role === 'guest' && this.connectedOnce) this.connect();
    if (this.view.status === 'connecting' && Date.now() - this.started > 18_000)
      this.status('error', '接続がタイムアウトしました。通信環境を確認して再接続してください。');
    if (this.session.role === 'host') this.persist();
  }
  private persist() {
    write(
      `host:${this.session.code}`,
      { state: this.latest, guest: this.view.guest, token: this.token, ready: this.view.ready },
      true,
    );
  }
  ready(ready: boolean) {
    this.send('ready', { ready });
  }
  input(action: Action) {
    if (this.view.status !== 'connected' || this.latest?.phase !== 'playing') return false;
    const input = { seq: ++this.seq, action };
    this.pending.push(input);
    if (this.pending.length > 150) this.pending.shift();
    const changed = command(this.latest, 1, action);
    this.callbacks.state(this.latest);
    this.send('input', input);
    return changed;
  }
  setState(match: Match) {
    this.latest = match;
  }
  start(match: Match) {
    if (this.session.role !== 'host' || !this.view.ready || this.view.status !== 'connected')
      return false;
    this.latest = match;
    this.remotePaused = false;
    this.ack = 0;
    this.callbacks.state(match);
    this.broadcast(true);
    return true;
  }
  broadcast(force = false) {
    if (this.session.role !== 'host' || !this.latest) return;
    if (force || Date.now() - this.lastPublish >= 50) {
      this.lastPublish = Date.now();
      this.send('state', { state: this.latest, ack: this.ack });
    }
    if (Date.now() - this.lastSave > 1500) {
      this.lastSave = Date.now();
      this.persist();
    }
  }
  requestPause(paused: boolean) {
    if (this.session.role === 'guest') {
      this.send('pause', { paused });
      return;
    }
    if (!this.latest || this.view.status !== 'connected') return;
    if (!paused && this.remotePaused) {
      this.callbacks.notice('相手が戻るまでお待ちください。');
      return;
    }
    if (
      (paused && ['playing', 'countdown'].includes(this.latest.phase)) ||
      (!paused && this.latest.phase === 'paused')
    )
      pause(this.latest);
    this.callbacks.state(this.latest);
    this.broadcast(true);
  }
  requestRematch() {
    this.send('rematch');
  }
  surrender() {
    if (this.session.role === 'guest') this.send('forfeit');
    else if (this.latest) {
      forfeit(this.latest, 0);
      this.callbacks.state(this.latest);
      this.broadcast(true);
    }
  }
  reconnect() {
    if (this.session.role === 'guest') {
      this.lastConnect = 0;
      this.connect();
    } else if (this.peer.disconnected) this.peer.reconnect();
  }
  destroy(leave = true) {
    if (leave) {
      this.send('bye');
      remove('session', true);
      remove(`host:${this.session.code}`, true);
    }
    this.closed = true;
    window.removeEventListener('pagehide', this.saveOnExit);
    clearInterval(this.timer);
    this.connection?.close();
    for (const c of this.pendingConnections) c.close();
    this.peer.destroy();
  }
}
