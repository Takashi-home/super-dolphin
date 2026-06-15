/**
 * TileRenderer — テーマ別のタイル描画（オートタイル）。
 * 露出した上面に「縁取り（草/岩/メタル）」を出し、角を丸め、立体感を付ける。
 * Level.draw から `drawTerrain(ctx, level, cameraX, W, H)` で呼ばれる。
 */
import { TILE } from '../data/levels.js';

const THEMES = {
  ocean: { capA: '#a6e86a', capB: '#5fbf3a', cap2: '#3f9e2a', bodyA: '#cf9a63', bodyB: '#86552c', line: '#5c3a1d', grass: true },
  cave:  { capA: '#6b7388', capB: '#454c60', cap2: '#2f3545', bodyA: '#3c4250', bodyB: '#23272f', line: '#14161d', grass: false },
  water: { capA: '#49b6c4', capB: '#268d9c', cap2: '#15616d', bodyA: '#216f7d', bodyB: '#103f48', line: '#0a2c33', grass: false },
  pipe:  { capA: '#46d06a', capB: '#1f9a3c', cap2: '#0f6824', bodyA: '#1f8a39', bodyB: '#0e521f', line: '#063012', grass: false },
  sky:   { capA: '#eef4fb', capB: '#bfcede', cap2: '#9aacc0', bodyA: '#aebccd', bodyB: '#7e8da0', line: '#5b6878', grass: false },
  city:  { capA: '#9c7a6b', capB: '#6d4c41', cap2: '#4e342e', bodyA: '#6d4c41', bodyB: '#3e2723', line: '#2a1b15', grass: false },
};

function occupied(level, c, r) {
  if (r < 0) return false;
  if (r >= level.rows) return true;           // 画面下は地面が続く想定
  if (c < 0 || c >= level.cols) return false;
  const ch = level.grid[r][c];
  if (ch === '#' || ch === '=' || ch === '?' || ch === 'p') return true;
  if (ch === 'B') return level.breakables.has(`${c},${r}`);
  return false;   // 'S'(バネ) は床扱いしない（単体で立つ）
}

export function drawTerrain(ctx, level, cameraX, W, H) {
  const T = TILE;
  const pal = THEMES[level.theme] || THEMES.ocean;
  const c0 = Math.max(0, Math.floor(cameraX / T));
  const c1 = Math.min(level.cols - 1, Math.floor((cameraX + W) / T));

  for (let r = 0; r < level.rows; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = level.grid[r][c];
      const x = c * T - cameraX, y = r * T;
      if (ch === '#' || ch === '=') {
        drawGround(ctx, x, y, T, pal, {
          top: !occupied(level, c, r - 1),
          left: !occupied(level, c - 1, r),
          right: !occupied(level, c + 1, r),
          bottom: !occupied(level, c, r + 1),
        });
      } else if (ch === 'B') {
        if (level.breakables.has(`${c},${r}`)) drawBrick(ctx, x, y + level.bumpOffset(c, r), T, pal);
      } else if (ch === '?') {
        drawQBlock(ctx, x, y + level.bumpOffset(c, r), T, level.qblocks.get(`${c},${r}`)?.used);
      } else if (ch === 'p') {
        drawPipe(ctx, x, y, T, level.grid[r - 1] ? level.grid[r - 1][c] !== 'p' : true);
      } else if (ch === 'S') {
        drawSpring(ctx, x, y, T, level.bumpOffset(c, r));
      } else if (ch === '^') {
        drawSpike(ctx, x, y, T, pal);
      }
    }
  }
}

function drawGround(ctx, x, y, T, pal, open) {
  // 胴（土/岩）
  const g = ctx.createLinearGradient(0, y, 0, y + T);
  g.addColorStop(0, pal.bodyA); g.addColorStop(1, pal.bodyB);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, T, T);

  // 細かいテクスチャ（点）
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i < 3; i++) {
    const px = x + 6 + ((i * 17 + (x | 0)) % (T - 12));
    const py = y + 16 + ((i * 23 + (y | 0)) % (T - 22));
    ctx.fillRect(px, py, 3, 3);
  }

  // 上面の縁取り（草 or 岩/メタル）
  if (open.top) {
    const capH = pal.grass ? 16 : 12;
    const cg = ctx.createLinearGradient(0, y, 0, y + capH);
    cg.addColorStop(0, pal.capA); cg.addColorStop(1, pal.capB);
    ctx.fillStyle = cg;
    if (pal.grass) {
      // 波打つ草
      ctx.beginPath();
      ctx.moveTo(x, y + capH);
      const tufts = 4, tw = T / tufts;
      for (let i = 0; i <= tufts; i++) {
        const tx = x + i * tw;
        ctx.lineTo(tx, y + 2 + (i % 2) * 3);
        if (i < tufts) ctx.quadraticCurveTo(tx + tw * 0.5, y - 3, tx + tw, y + 2 + ((i + 1) % 2) * 3);
      }
      ctx.lineTo(x + T, y + capH);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.cap2;
      ctx.fillRect(x, y + capH - 2, T, 2);
    } else {
      ctx.fillRect(x, y, T, capH);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, y, T, 3);
      ctx.fillStyle = pal.cap2;
      ctx.fillRect(x, y + capH - 2, T, 2);
    }
  }

  // 縁の陰影
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  if (open.left) ctx.fillRect(x, y, 3, T);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  if (open.right) ctx.fillRect(x + T - 3, y, 3, T);
  if (open.bottom) ctx.fillRect(x, y + T - 3, T, 3);
}

function drawBrick(ctx, x, y, T, pal) {
  const g = ctx.createLinearGradient(0, y, 0, y + T);
  g.addColorStop(0, '#c87a45'); g.addColorStop(1, '#9a5527');
  ctx.fillStyle = g; ctx.fillRect(x, y, T, T);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  // レンガ目地
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + T / 2); ctx.lineTo(x + T, y + T / 2);
  ctx.moveTo(x + T / 2, y); ctx.lineTo(x + T / 2, y + T / 2);
  ctx.moveTo(x + T / 4, y + T / 2); ctx.lineTo(x + T / 4, y + T);
  ctx.moveTo(x + 3 * T / 4, y + T / 2); ctx.lineTo(x + 3 * T / 4, y + T);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 2, y + 2, T - 4, 3);
}

function drawSpring(ctx, x, y, T, bump) {
  const top = y + 10 + bump;            // 叩かれていない時は上寄り
  // 台座
  ctx.fillStyle = '#37474f'; ctx.fillRect(x + 6, y + T - 8, T - 12, 8);
  // コイル
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const yy = top + 6 + i * ((y + T - 10 - top - 6) / 3);
    ctx.moveTo(x + 8, yy); ctx.lineTo(x + T - 8, yy + 3);
  }
  ctx.stroke();
  // 上の板
  const g = ctx.createLinearGradient(0, top, 0, top + 8);
  g.addColorStop(0, '#eceff1'); g.addColorStop(1, '#90a4ae');
  ctx.fillStyle = g; ctx.fillRect(x + 4, top, T - 8, 8);
  ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 4, top, T - 8, 8);
}

function drawPipe(ctx, x, y, T, isTop) {
  const g = ctx.createLinearGradient(x, 0, x + T, 0);
  g.addColorStop(0, '#1f9a3c'); g.addColorStop(0.25, '#5fe070'); g.addColorStop(0.5, '#2fb24f'); g.addColorStop(1, '#0f6824');
  ctx.fillStyle = g;
  if (isTop) {
    // 縁（口）：少しはみ出す
    ctx.fillRect(x - 4, y, T + 8, T * 0.32);
    ctx.strokeStyle = '#0d4a1e'; ctx.lineWidth = 2; ctx.strokeRect(x - 4, y, T + 8, T * 0.32);
    ctx.fillStyle = g; ctx.fillRect(x, y + T * 0.32, T, T * 0.68);
    ctx.strokeRect(x, y + T * 0.32, T, T * 0.68);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 4, y + T * 0.27, T + 8, 3);
  } else {
    ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = '#0d4a1e'; ctx.lineWidth = 2; ctx.strokeRect(x, y, T, T);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + T * 0.14, y, T * 0.12, T);
}

function drawQBlock(ctx, x, y, T, used) {
  const g = ctx.createLinearGradient(0, y, 0, y + T);
  if (used) { g.addColorStop(0, '#9a7b4f'); g.addColorStop(1, '#6b5232'); }
  else { g.addColorStop(0, '#ffcf4d'); g.addColorStop(1, '#e09a18'); }
  ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
  ctx.strokeStyle = used ? '#4a3a22' : '#9a6a0e'; ctx.lineWidth = 3;
  ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
  // 四隅のリベット
  ctx.fillStyle = used ? '#3a2e1a' : '#7a5310';
  for (const [dx, dy] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2); ctx.fill(); }
  if (!used) {
    const bob = 1 + Math.sin(Date.now() / 250 + x) * 1;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(120,80,0,0.6)'; ctx.lineWidth = 3;
    ctx.font = `900 ${T * 0.62}px 'Hiragino Maru Gothic ProN',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText('?', x + T / 2, y + T / 2 + bob); ctx.fillText('?', x + T / 2, y + T / 2 + bob);
  }
}

function drawSpike(ctx, x, y, T, pal) {
  const n = 3, w = T / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(x + i * w, y, x + i * w, y + T);
    g.addColorStop(0, '#e8eef2'); g.addColorStop(1, '#7d8a96');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + i * w, y + T);
    ctx.lineTo(x + i * w + w / 2, y + T * 0.18);
    ctx.lineTo(x + (i + 1) * w, y + T);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    // ハイライト
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + i * w + w * 0.32, y + T * 0.8);
    ctx.lineTo(x + i * w + w / 2, y + T * 0.28);
    ctx.stroke();
  }
}
