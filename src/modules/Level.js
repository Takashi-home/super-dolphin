import { TILE } from '../data/levels.js';

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
    this.spikes = new Set();
    this.breakables = new Set(); // "c,r" の生存ブロック
    this.spawn = { x: TILE, y: TILE };
    this.goal = { x: this.width - TILE * 2, y: 0 };
    this.coinsTotal = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = this.grid[r][c];
        const px = c * TILE, py = r * TILE;
        if (ch === 'o') { this.coins.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false }); this.coinsTotal++; }
        else if (ch === '^') this.spikes.add(`${c},${r}`);
        else if (ch === 'B') this.breakables.add(`${c},${r}`);
        else if (ch === 'E') this.enemies.push({ x: px + 4, y: py + 4, w: TILE - 8, h: TILE - 8, vx: 1.2, alive: true });
        else if (ch === 'M') this.powerups.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false });
        else if (ch === 'P') this.spawn = { x: px, y: py };
        else if (ch === 'G') this.goal = { x: px, y: py };
      }
    }
  }

  // 固いセルの種類: 'solid' | 'break' | null
  solidKind(c, r) {
    if (c < 0) return 'solid';                 // 左の壁
    if (r < 0 || r >= this.rows || c >= this.cols) return null;
    const ch = this.grid[r][c];
    if (ch === '#' || ch === '=') return 'solid';
    if (ch === 'B') return this.breakables.has(`${c},${r}`) ? 'break' : null;
    return null;
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

  update() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx;
      // 進行方向の足元が無い、または壁に当たったら反転
      const aheadC = Math.floor((e.x + (e.vx > 0 ? e.w + 1 : -1)) / TILE);
      const footR = Math.floor((e.y + e.h + 2) / TILE);
      const midR = Math.floor((e.y + e.h / 2) / TILE);
      const wall = this.solidKind(aheadC, midR);
      const floor = this.solidKind(aheadC, footR);
      if (wall || !floor) e.vx *= -1;
    }
  }

  draw(ctx, cameraX, W, H) {
    const T = TILE;
    const c0 = Math.max(0, Math.floor(cameraX / T));
    const c1 = Math.min(this.cols - 1, Math.floor((cameraX + W) / T));

    for (let r = 0; r < this.rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = this.grid[r][c];
        const x = c * T - cameraX, y = r * T;
        if (ch === '#') this._block(ctx, x, y, T, '#5d4037', '#3e2723', '#795548');
        else if (ch === '=') this._block(ctx, x, y, T, '#6d4c41', '#4e342e', '#8d6e63');
        else if (ch === 'B') {
          if (this.breakables.has(`${c},${r}`)) this._brick(ctx, x, y, T);
        } else if (ch === '^') this._spike(ctx, x, y, T);
      }
    }

    // コイン
    for (const co of this.coins) {
      if (co.taken) continue;
      const x = co.x - cameraX, y = co.y;
      if (x < -T || x > W + T) continue;
      const pulse = 0.8 + Math.sin(Date.now() / 150 + co.x) * 0.2;
      ctx.fillStyle = '#ffd600';
      ctx.beginPath(); ctx.ellipse(x, y, 11 * pulse, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffecb3';
      ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
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

    // 敵
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const x = e.x - cameraX;
      if (x < -T || x > W + T) continue;
      ctx.font = `${e.h}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🦀', x + e.w / 2, e.y + e.h / 2);
    }

    // ゴール旗
    const gx = this.goal.x - cameraX;
    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(gx + T / 2 - 3, this.goal.y - T * 2, 6, T * 3);
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(gx + T / 2 + 3, this.goal.y - T * 2);
    ctx.lineTo(gx + T / 2 + 40, this.goal.y - T * 2 + 14);
    ctx.lineTo(gx + T / 2 + 3, this.goal.y - T * 2 + 28);
    ctx.closePath(); ctx.fill();
    ctx.font = `${T}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏁', gx + T / 2, this.goal.y + T / 2);
  }

  _block(ctx, x, y, T, top, bottom, line) {
    const g = ctx.createLinearGradient(0, y, 0, y + T);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = line; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  }

  _brick(ctx, x, y, T) {
    ctx.fillStyle = '#bf6a37'; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = '#7a3f1f'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, T, T);
    ctx.beginPath();
    ctx.moveTo(x, y + T / 2); ctx.lineTo(x + T, y + T / 2);
    ctx.moveTo(x + T / 2, y); ctx.lineTo(x + T / 2, y + T / 2);
    ctx.moveTo(x + T / 4, y + T / 2); ctx.lineTo(x + T / 4, y + T);
    ctx.moveTo(x + (3 * T) / 4, y + T / 2); ctx.lineTo(x + (3 * T) / 4, y + T);
    ctx.stroke();
  }

  _spike(ctx, x, y, T) {
    ctx.fillStyle = '#b0bec5';
    const n = 3, w = T / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * w, y + T);
      ctx.lineTo(x + i * w + w / 2, y + T * 0.25);
      ctx.lineTo(x + (i + 1) * w, y + T);
      ctx.closePath(); ctx.fill();
    }
  }
}
