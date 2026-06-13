/**
 * 本番サーバ（リモートプレイ用）
 * ------------------------------------------------------------------
 * `npm run build` で生成した dist/ を配信し、コントローラー中継（SSE）も担う。
 * これを公開ホスト（Render / Railway / Fly / Glitch など）に置くか、
 * ローカルで起動してトンネル（cloudflared / ngrok）で公開すれば、
 * 同じ Wi-Fi でなくても他の人のスマホから参加できる。
 *
 * 使い方:
 *   npm run build
 *   npm start                 # PORT 環境変数で待受ポート変更可（既定 8080）
 *   （別の人のスマホから遊ぶには HTTPS で公開すること。センサーに HTTPS 必須）
 *
 * 例（ローカル起動 + 一時公開トンネル）:
 *   npm run build && npm start
 *   cloudflared tunnel --url http://localhost:8080      # 表示された https URL を共有
 */
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRelay } from './src/server/relay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const relay = createRelay();

const server = createServer((req, res) => {
  // まず中継ミドルウェアに渡す。/api/ctrl/* 以外は next() で静的配信へ。
  relay.handle(req, res, async () => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/') pathname = '/index.html';
      // dist 外へのアクセスを防ぐ
      const file = join(DIST, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
      if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end('forbidden'); }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  🐬 スーパードルフィン server`);
  console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  console.log(`  ➜  公開するには HTTPS 必須（センサー用）。トンネルか HTTPS ホストを利用してください。\n`);
  if (!process.env._SD_DIST_OK) {
    // dist が無い場合の軽い警告
    readFile(join(DIST, 'index.html')).catch(() =>
      console.warn('  ⚠ dist/ が見つかりません。先に `npm run build` を実行してください。\n'));
  }
});
