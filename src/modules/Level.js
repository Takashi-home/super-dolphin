import { TILE } from '../data/levels.js';
import { drawTerrain } from './TileRenderer.js';
import { createEnemy, updateEnemies, drawEnemies } from './Enemies.js';
import { spawnItem, updateItems, drawItems } from './Items.js';

/**
 * Level — ASCIIタイルマップの解析・描画・当たり判定・敵/コインの管理。
 * 座標はピクセル。1タイル = TILE px。
 */
export class Level {
  constructor(def) {
    this.tile = TILE;
    this.name = def.name || '';
    this.theme = def.theme || '';
    const cols = Math.max(...def.rows.map((r) => r.length));
    this.cols = cols;
    this.rows = def.rows.length;
    this.grid = def.rows.map((r) => r.padEnd(cols, ' '));
    this.width = cols * TILE;
    this.height = this.rows * TILE;

    this.coins = [];
    this.enemies = [];
    this.powerups = [];
    this.items = [];
    this.spikes = new Set();
    this.breakables = new Set(); // "c,r" の生存ブロック
    this.qblocks = new Map();    // "c,r" -> { used } ？ブロック
    this.bumps = new Map();      // "c,r" -> 残りフレーム（頭突きのアニメ）
    this.checkpoints = [];       // { x, y, hit }
    this.activeCheckpoint = null;
    this.movers = [];            // 動く床（乗ると運ばれる）
    this.spawn = { x: TILE, y: TILE };
    this.goal = { x: this.width - TILE * 2, y: 0 };
    this.coinsTotal = 0;
    this.coinCount = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = this.grid[r][c];
        const px = c * TILE, py = r * TILE;
        if (ch === 'o') { this.coins.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false }); this.coinsTotal++; }
        else if (ch === '^') this.spikes.add(`${c},${r}`);
        else if (ch === 'B') this.breakables.add(`${c},${r}`);
        else if (ch === '?') this.qblocks.set(`${c},${r}`, { used: false });
        else if (ch === 'E') this.enemies.push(createEnemy('goomba', c, r));
        else if (ch === 'K') this.enemies.push(createEnemy('koopa', c, r));
        else if (ch === 'F') this.enemies.push(createEnemy('piranha', c, r));
        else if (ch === 'C') this.checkpoints.push({ x: px, y: py, hit: false });
        else if (ch === '-') { const t0 = c * 0.6, rng = TILE * 2; this.movers.push({ x: px + Math.sin(t0) * rng, y: py + 16, w: TILE * 2, h: 16, origin: px, range: rng, speed: 0.022, t: t0, dx: 0, dy: 0 }); }
        else if (ch === 'M') this.powerups.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false });
        else if (ch === 'P') this.spawn = { x: px, y: py };
        else if (ch === 'G') this.goal = { x: px, y: py };
      }
    }
  }

  // 固いセルの種類: 'solid' | 'break' | 'qblock' | null
  solidKind(c, r) {
    if (c < 0) return 'solid';                 // 左の壁
    if (r < 0 || r >= this.rows || c >= this.cols) return null;
    const ch = this.grid[r][c];
    if (ch === '#' || ch === '=' || ch === 'p') return 'solid';
    if (ch === 'S') return 'spring';
    if (ch === '?') return 'qblock';
    if (ch === 'B') return this.breakables.has(`${c},${r}`) ? 'break' : null;
    return null;
  }

  // 頭突きアニメ
  bumpBlock(c, r) { this.bumps.set(`${c},${r}`, 9); }
  bumpOffset(c, r) {
    const t = this.bumps.get(`${c},${r}`) || 0;
    return t > 0 ? -Math.sin((9 - t) / 9 * Math.PI) * 9 : 0;
  }

  // ？ブロックを下から叩く。未使用ならアイテムを出して true。
  useQBlock(c, r, playerTier = 0) {
    const b = this.qblocks.get(`${c},${r}`);
    if (!b || b.used) return false;
    b.used = true;
    this.bumpBlock(c, r);
    // 中身は位置で決まる（決定的）。たまに1UP、それ以外は進化アイテム。
    if (((c * 7 + r) % 11) === 0) spawnItem(this, 'oneup', c, r - 1);
    else spawnItem(this, 'power', c, r - 1, playerTier >= 1);
    return true;
  }

  // レンガを下から叩く（非進化）→ コインを1枚出す
  popBrickCoin(c, r) {
    this.bumpBlock(c, r);
    spawnItem(this, 'coinpop', c, r - 1);
  }

  rectCells(x, y, w, h) {
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
    const cells = [];
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) cells.push({ c, r });
    return cells;
  }

  breakAt(c, r) {
    const key = `${c},${r}`;
    if (this.breakables.has(key)) { this.breakables.delete(key); return true; }
    return false;
  }

  // トゲに触れているか
  touchesSpike(x, y, w, h) {
    for (const { c, r } of this.rectCells(x, y, w, h)) {
      if (this.spikes.has(`${c},${r}`)) return true;
    }
    return false;
  }

  update(player, particles) {
    updateEnemies(this, player, particles);
    updateItems(this, player, particles);
    for (const m of this.movers) {
      const ox = m.x;
      m.t += m.speed;
      m.x = m.origin + Math.sin(m.t) * m.range;   // 水平に往復
      m.dx = m.x - ox; m.dy = 0;
    }
    for (const [k, t] of this.bumps) { if (t <= 1) this.bumps.delete(k); else this.bumps.set(k, t - 1); }
  }

  draw(ctx, cameraX, W, H) {
    const T = TILE;

    // 地形（テーマ別オートタイル）
    drawTerrain(ctx, this, cameraX, W, H);

    // コイン（回転する金貨）
    for (const co of this.coins) {
      if (co.taken) continue;
      const x = co.x - cameraX, y = co.y;
      if (x < -T || x > W + T) continue;
      const spin = Math.abs(Math.cos(Date.now() / 240 + co.x * 0.05)); // 0..1（厚み）
      const rw = 2 + 11 * spin;
      const g = ctx.createLinearGradient(x - rw, 0, x + rw, 0);
      g.addColorStop(0, '#b8860b'); g.addColorStop(0.5, '#ffe969'); g.addColorStop(1, '#c8930d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rw, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (spin > 0.45) {
        ctx.fillStyle = 'rgba(180,120,0,0.6)';
        ctx.font = `900 ${10 * spin}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', x, y + 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.ellipse(x - rw * 0.35, y - 4, rw * 0.18, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 進化アイテム
    for (const pu of this.powerups) {
      if (pu.taken) continue;
      const x = pu.x - cameraX, y = pu.y;
      if (x < -T || x > W + T) continue;
      const bob = Math.sin(Date.now() / 250 + pu.x) * 4;
      ctx.save();
      ctx.shadowColor = '#ff7043'; ctx.shadowBlur = 16;
      ctx.font = `${T * 0.8}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🍄', x, y + bob);
      ctx.restore();
    }

    // アイテム（？ブロックから出るキノコ等）
    drawItems(ctx, this, cameraX, W, H);

    // 中間地点の旗
    for (const cp of this.checkpoints) {
      const cx = cp.x - cameraX + T / 2;
      if (cx < -T || cx > W + T) continue;
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(cx - 2, cp.y - T, 4, T * 2);
      ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.arc(cx, cp.y - T, 5, 0, Math.PI * 2); ctx.fill();
      const wave = cp.hit ? Math.sin(Date.now() / 200) * 3 : 0;
      ctx.fillStyle = cp.hit ? '#43c463' : '#9aa7b0';
      ctx.beginPath();
      ctx.moveTo(cx + 2, cp.y - T + 2);
      ctx.lineTo(cx + 22, cp.y - T + 7 + wave);
      ctx.lineTo(cx + 2, cp.y - T + 15);
      ctx.closePath(); ctx.fill();
    }

    // 動く床
    for (const m of this.movers) {
      const x = m.x - cameraX;
      if (x < -m.w || x > W + m.w) continue;
      const g = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
      g.addColorStop(0, '#ffd54f'); g.addColorStop(1, '#c8930d');
      ctx.fillStyle = g; ctx.fillRect(x, m.y, m.w, m.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, m.y, m.w, 3);
      ctx.strokeStyle = '#7a5300'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, m.y + 1, m.w - 2, m.h - 2);
      // ボルト
      ctx.fillStyle = '#8d6e00';
      for (const bx of [x + 8, x + m.w - 8]) { ctx.beginPath(); ctx.arc(bx, m.y + m.h / 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }

    // 敵（アニメ付き）
    drawEnemies(ctx, this, cameraX, W, H);

    // ゴール旗ざお
    const gx = this.goal.x - cameraX + T / 2;
    const topY = this.goal.y - T * 3;
    const botY = this.goal.y + T;
    // ポール
    const pg = ctx.createLinearGradient(gx - 3, 0, gx + 3, 0);
    pg.addColorStop(0, '#cfd8dc'); pg.addColorStop(0.5, '#fff'); pg.addColorStop(1, '#90a4ae');
    ctx.fillStyle = pg; ctx.fillRect(gx - 3, topY, 6, botY - topY);
    // てっぺんの球
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(gx, topY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    // たなびく旗
    const wave = Math.sin(Date.now() / 200) * 4;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(gx + 3, topY + 6);
    ctx.quadraticCurveTo(gx + 26, topY + 10 + wave, gx + 46, topY + 16);
    ctx.lineTo(gx + 46, topY + 18);
    ctx.quadraticCurveTo(gx + 26, topY + 24 + wave, gx + 3, topY + 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx + 22, topY + 16, 4, 0, Math.PI * 2); ctx.fill();
    // 台座
    ctx.fillStyle = '#455a64'; ctx.fillRect(gx - 14, botY - 6, 28, 8);
  }
}
