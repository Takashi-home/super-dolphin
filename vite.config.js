import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * controller-relay
 * ----------------
 * torokko の controller-relay を「複数プレイヤー・複数コマンド・ロビー」対応に拡張したもの。
 * Vite dev サーバ上だけで動く（GitHub Pages 等の静的配信では動かない）。
 *
 * メッセージ（すべて SSE で `data: <JSON>\n\n` 形式）:
 *   screen 宛 : { type:'roster', players:[{id,name,role}] }
 *               { type:'input',  id, action, state }
 *               { type:'gamestate', state }
 *   phone 宛  : { type:'assign', role, character }
 *               { type:'gamestate', state }
 *
 * HTTP API:
 *   GET  /api/ctrl/stream            … 大画面（id 無し）が購読
 *   GET  /api/ctrl/stream?id=<ID>    … スマホ（id 付き）が購読
 *   POST /api/ctrl/join   { id, name }
 *   POST /api/ctrl/input  { id, action, state }
 *   POST /api/ctrl/start  { character }
 *   POST /api/ctrl/reset
 */
function controllerRelay() {
  return {
    name: 'controller-relay',
    configureServer(server) {
      const screens = new Set();        // SSE res（大画面）
      const phones = new Map();         // id -> SSE res（スマホ接続）
      const players = new Map();        // id -> { id, name, role }
      let character = 'dolphin';

      const send = (res, obj) => {
        try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
      };
      const toScreens = (obj) => screens.forEach((r) => send(r, obj));
      const rosterPayload = () => ({
        type: 'roster',
        players: [...players.values()],
      });
      const broadcastRoster = () => toScreens(rosterPayload());

      const readBody = (req) =>
        new Promise((res) => {
          let body = '';
          req.on('data', (d) => (body += d));
          req.on('end', () => {
            try { res(JSON.parse(body || '{}')); } catch { res(null); }
          });
        });

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');

        // ── SSE 購読 ────────────────────────────────────────────
        if (url.pathname === '/api/ctrl/stream') {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders?.();
          send(res, { type: 'hello' });

          const id = url.searchParams.get('id');
          if (id) {
            phones.set(id, res);
            // 再接続時、割当済みなら即送る
            const p = players.get(id);
            if (p && p.role) send(res, { type: 'assign', role: p.role, character });
            req.on('close', () => {
              phones.delete(id);
              players.delete(id);
              broadcastRoster();
            });
          } else {
            screens.add(res);
            send(res, rosterPayload());
            req.on('close', () => screens.delete(res));
          }
          // 接続維持の ping
          const ping = setInterval(() => send(res, { type: 'ping' }), 25000);
          req.on('close', () => clearInterval(ping));
          return;
        }

        // ── 参加登録 ────────────────────────────────────────────
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

        // ── 入力 ────────────────────────────────────────────────
        if (url.pathname === '/api/ctrl/input' && req.method === 'POST') {
          const body = await readBody(req);
          const ACTIONS = ['left', 'right', 'jump', 'dash', 'special'];
          if (!body || !ACTIONS.includes(body.action)) {
            res.statusCode = 400; return res.end('bad');
          }
          toScreens({ type: 'input', id: body.id, action: body.action, state: body.state || 'tap' });
          return res.end('ok');
        }

        // ── ゲーム開始（役割割当）──────────────────────────────────
        if (url.pathname === '/api/ctrl/start' && req.method === 'POST') {
          const body = await readBody(req);
          if (body && body.character) character = body.character;
          assignRoles(players);
          players.forEach((p) => {
            const r = phones.get(p.id);
            if (r) send(r, { type: 'assign', role: p.role, character });
          });
          const gs = { type: 'gamestate', state: 'PLAYING' };
          toScreens(gs);
          phones.forEach((r) => send(r, gs));
          broadcastRoster();
          return res.end('ok');
        }

        // ── ロビーに戻す ───────────────────────────────────────────
        if (url.pathname === '/api/ctrl/reset' && req.method === 'POST') {
          players.forEach((p) => (p.role = null));
          const gs = { type: 'gamestate', state: 'LOBBY' };
          toScreens(gs);
          phones.forEach((r) => send(r, gs));
          broadcastRoster();
          return res.end('ok');
        }

        next();
      });
    },
  };
}

// 人数に応じて参加順に役割を割り当てる（roles.js の ROLE_PLANS と対応）
function assignRoles(players) {
  const PLANS = {
    2: ['MOVE', 'ACTION'],
    3: ['LEFT', 'RIGHT', 'JUMP'],
    4: ['LEFT', 'RIGHT', 'JUMP', 'DASH'],
    5: ['LEFT', 'RIGHT', 'JUMP', 'DASH', 'SPECIAL'],
  };
  const count = Math.max(2, Math.min(5, players.size));
  const plan = PLANS[count];
  let i = 0;
  players.forEach((p) => {
    p.role = plan[i % plan.length]; // 6人以上は役割を共有
    i++;
  });
}

export default defineConfig({
  base: './',
  server: { host: true },
  plugins: [basicSsl(), controllerRelay()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        controller: resolve(__dirname, 'controller.html'),
      },
    },
  },
});
