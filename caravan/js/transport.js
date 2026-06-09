const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

async function loadPeerJS() {
  if (typeof Peer !== 'undefined') return window.Peer;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEERJS_CDN;
    script.onload = () => {
      if (typeof window.Peer === 'undefined') reject(new Error('PeerJS loaded but Peer is undefined'));
      else resolve(window.Peer);
    };
    script.onerror = () => reject(new Error('Failed to load PeerJS — check your internet connection'));
    document.head.appendChild(script);
  });
}

const Transport = {
  callbacks: null,
  conn: null,
  peer: null,
  role: null,
  roomCode: null,
  status: 'idle',

  _generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  _wireConn(conn) {
    conn.on('open', () => {
      this.status = 'connected';
      this.callbacks.onConnected && this.callbacks.onConnected();
    });
    conn.on('data', (data) => this.callbacks.onMessage && this.callbacks.onMessage(data));
    conn.on('close', () => this.callbacks.onDisconnect && this.callbacks.onDisconnect());
  },

  disconnect() {
    if (this.conn) { try { this.conn.close(); } catch (e) { } this.conn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch (e) { } this.peer = null; }
    this.role = null;
    this.roomCode = null;
    this.status = 'idle';
    this.callbacks = null;
  },

  async initHost(callbacks) {
    this.disconnect();
    this.status = 'connecting';
    this.role = 'host';
    this.callbacks = callbacks;
    const PeerCtor = await loadPeerJS();
    const code = this._generateCode();
    this.peer = new PeerCtor(code);
    this.peer.on('open', (id) => {
      this.roomCode = id;
      this.status = 'waiting';
      callbacks.onRoomReady && callbacks.onRoomReady(id);
    });
    this.peer.on('connection', (conn) => {
      if (this.conn && this.conn.open) { try { conn.close(); } catch (e) { } return; }
      this.conn = conn;
      this._wireConn(conn);
      conn.on('error', (e) => callbacks.onError && callbacks.onError(e));
    });
    this.peer.on('error', (e) => {
      this.status = 'error';
      callbacks.onError && callbacks.onError(e);
    });
  },

  async initJoiner(roomCode, callbacks) {
    this.disconnect();
    this.status = 'connecting';
    this.role = 'joiner';
    this.callbacks = callbacks;
    this.roomCode = roomCode;
    const PeerCtor = await loadPeerJS();
    this.peer = new PeerCtor();
    this.peer.on('open', () => {
      this.conn = this.peer.connect(roomCode, { reliable: true });
      this._wireConn(this.conn);
      this.conn.on('error', (e) => {
        this.status = 'error';
        callbacks.onError && callbacks.onError(e);
      });
    });
    this.peer.on('error', (e) => {
      this.status = 'error';
      callbacks.onError && callbacks.onError(e);
    });
  },

  send(msg) {
    if (this.conn && this.conn.open) { this.conn.send(msg); return true; }
    return false;
  },
};

function redactStateForJoiner(state) {
  const s = JSON.parse(JSON.stringify(state));
  s.players[0].hand = s.players[0].hand.map(c => ({ id: c.id, _redacted: true }));
  s.players[0].deck = new Array(s.players[0].deck.length).fill(null).map(() => ({ _redacted: true }));
  s.players[1].deck = new Array(s.players[1].deck.length).fill(null).map(() => ({ _redacted: true }));
  return s;
}
