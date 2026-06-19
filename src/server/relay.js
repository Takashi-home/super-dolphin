/**
 * controller-relay（共有モジュール）
 * --------------------------------------------------
 * スマホ（コントローラー）↔ 大画面（ゲーム）を中継する SSE リレー。
 * Vite dev サーバ（vite.config.js）と本番サーバ（server.js）の両方から使う。
 *
 * メッセージ（すべて SSE で `data: <JSON>\n\n`）:
 *   screen 宛 : { type:'roster', players:[{id,name,role}] }
 *               { type:'input',  id, action, state }
 *               { type:'gamestate', state }
 *   phone 宛  : { type:'assign', role, character } / { type:'gamestate', state }
 *
 * HTTP API:
 *   GET  /api/ctrl/stream            … 大画面（id 無し）が購読
 *   GET  /api/ctrl/stream?id=<ID>    … スマホ（id 付き）が購読
 *   POST /api/ctrl/join   { id, name }
 *   POST /api/ctrl/input  { id, action, state }
 *   POST /api/ctrl/start  { character }
 *   POST /api/ctrl/reset
 *
 * createRelay().handle(req, res, next) は connect 互換のミドルウェア。
 * /api/ctrl/* を処理し、それ以外は next() を呼ぶ（静的配信などに委譲）。
 */

// 人数(2〜5)→役割割当プラン（src/data/roles.js の ROLE_PLANS と一致させること）
const ROLE_PLANS = {
  2: ['MOVE', 'ACTION'],
  3: ['LEFT', 'RIGHT', 'JUMP'],
  4: ['LEFT', 'RIGHT', 'JUMP', 'DASH'],
  5: ['LEFT', 'RIGHT', 'JUMP', 'DASH', 'SPECIAL'],
};

function assignRoles(players) {
  const count = Math.max(2, Math.min(5, players.size));
  const plan = ROLE_PLANS[count];
  let i = 0;
  players.forEach((p) => { p.role = plan[i % plan.length]; i++; }); // 6人以上は役割を共有
}

export function createRelay() {
  const screens = new Set();   // SSE res（大画面）
  const phones = new Map();    // id -> SSE res（スマホ接続）
  const players = new Map();   // id -> { id, name, role }
  const graceTimers = new Map(); // id -> 切断後に記録を消す予約（再接続でキャンセル）
  const GRACE_MS = 15000;      // 一時切断の猶予（テザリングのブレで役割を失わない）
  let character = 'dolphin';

  const send = (res, obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };
  const toScreens = (obj) => screens.forEach((r) => send(r, obj));
  const rosterPayload = () => ({ type: 'roster', players: [...players.values()] });
  const broadcastRoster = () => toScreens(rosterPayload());

  const readBody = (req) => new Promise((resolve) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve(null); } });
  });

  async function handle(req, res, next) {
    const url = new URL(req.url, 'http://localhost');

    // ── SSE 購読 ───────────────────────────────────────────
    if (url.pathname === '/api/ctrl/stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // 一部プロキシのバッファリング無効化
      res.flushHeaders?.();
      send(res, { type: 'hello' });

      const id = url.searchParams.get('id');
      if (id) {
        phones.set(id, res);
        const gt = graceTimers.get(id);          // 再接続：削除予約をキャンセル
        if (gt) { clearTimeout(gt); graceTimers.delete(id); }
        const p = players.get(id);
        if (p && p.role) send(res, { type: 'assign', role: p.role, character });
        req.on('close', () => {
          phones.delete(id);
          // すぐ消さず猶予を置く。猶予内に再接続すれば役割を保持できる。
          const t = setTimeout(() => { players.delete(id); graceTimers.delete(id); broadcastRoster(); }, GRACE_MS);
          graceTimers.set(id, t);
        });
      } else {
        screens.add(res);
        send(res, rosterPayload());
        req.on('close', () => screens.delete(res));
      }
      const ping = setInterval(() => send(res, { type: 'ping' }), 25000);
      req.on('close', () => clearInterval(ping));
      return;
    }

    // ── 参加登録 ───────────────────────────────────────────
    if (url.pathname === '/api/ctrl/join' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || !body.id) { res.statusCode = 400; return res.end('bad'); }
      const existing = players.get(body.id) || {};
      players.set(body.id, {
        id: body.id,
        name: body.name || `P-${body.id.slice(0, 4)}`,
        role: existing.role || null,
      });
      broadcastRoster();
      return res.end('ok');
    }

    // ── 入力 ───────────────────────────────────────────────
    if (url.pathname === '/api/ctrl/input' && req.method === 'POST') {
      const body = await readBody(req);
      const ACTIONS = ['left', 'right', 'jump', 'dash', 'special'];
      if (!body || !ACTIONS.includes(body.action)) { res.statusCode = 400; return res.end('bad'); }
      toScreens({ type: 'input', id: body.id, action: body.action, state: body.state || 'tap' });
      return res.end('ok');
    }

    // ── ゲーム開始（役割割当）────────────────────────────────
    if (url.pathname === '/api/ctrl/start' && req.method === 'POST') {
      const body = await readBody(req);
      if (body && body.character) character = body.character;
      assignRoles(players);
      players.forEach((p) => { const r = phones.get(p.id); if (r) send(r, { type: 'assign', role: p.role, character }); });
      const gs = { type: 'gamestate', state: 'PLAYING' };
      toScreens(gs); phones.forEach((r) => send(r, gs));
      broadcastRoster();
      return res.end('ok');
    }

    // ── ロビーに戻す ─────────────────────────────────────────
    if (url.pathname === '/api/ctrl/reset' && req.method === 'POST') {
      players.forEach((p) => (p.role = null));
      const gs = { type: 'gamestate', state: 'LOBBY' };
      toScreens(gs); phones.forEach((r) => send(r, gs));
      broadcastRoster();
      return res.end('ok');
    }

    return next();
  }

  return { handle };
}
