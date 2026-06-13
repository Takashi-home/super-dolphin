/**
 * SceneManager — 横スクロール用のパララックス背景。
 * Game が所有する canvas/ctx に対して draw(ctx, cameraX, W, H) で描画する。
 * テーマ: 'ocean'（イルカ/シャチ） / 'city'（鉄人28号）。
 */
export class SceneManager {
  constructor() {
    this.theme = 'ocean';
    this.frame = 0;
  }

  setTheme(theme) { this.theme = theme; }

  draw(ctx, cameraX, W, H) {
    this.frame++;
    if (this.theme === 'city') this._drawCity(ctx, cameraX, W, H);
    else this._drawOcean(ctx, cameraX, W, H);
  }

  _sky(ctx, W, H, colors) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  _drawOcean(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#0a3a5c', '#1976a8', '#4fb3d9', '#a7e0f2']);

    // 太陽の光（ゆれる）
    const sx = W * 0.78, sy = H * 0.2;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 180);
    sun.addColorStop(0, 'rgba(255,255,230,0.8)');
    sun.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    // 遠景の波の丘（パララックス 0.2）
    this._waveLayer(ctx, cameraX * 0.2, W, H, H * 0.62, 'rgba(255,255,255,0.10)', 120, 30);
    // 中景（0.4）
    this._waveLayer(ctx, cameraX * 0.4, W, H, H * 0.72, 'rgba(255,255,255,0.14)', 90, 24);

    // 泡（手前で上昇）
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 24; i++) {
      const seed = i * 97.3;
      const bx = ((seed * 13 - cameraX * 0.5) % (W + 100) + W + 100) % (W + 100) - 50;
      const rise = (this.frame * (0.5 + (i % 3) * 0.3) + seed) % (H + 40);
      const by = H - rise;
      const r = 2 + (i % 4);
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  _waveLayer(ctx, off, W, H, baseY, color, wlen, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = baseY + Math.sin((x + off) / wlen + this.frame * 0.02) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  _drawCity(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#1a1330', '#3a2a5a', '#a85a7a', '#ffb27a']);

    // 夕陽
    const sx = W * 0.7, sy = H * 0.32;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 140);
    sun.addColorStop(0, 'rgba(255,200,120,0.95)');
    sun.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    // ビル群 2レイヤー
    this._buildings(ctx, cameraX * 0.25, W, H, H * 0.78, '#2a2440', 0.9, 140);
    this._buildings(ctx, cameraX * 0.5, W, H, H * 0.86, '#181426', 1.0, 90);
  }

  _buildings(ctx, off, W, H, baseY, color, density, step) {
    ctx.fillStyle = color;
    const span = W + step * 2;
    for (let i = -1; i * step < span; i++) {
      const seed = i * 131.7;
      const x = (i * step - ((off % step) + step) % step);
      const hh = 60 + (Math.abs(Math.sin(seed)) * 0.5 + 0.5) * H * 0.35 * density;
      const w = step * 0.8;
      ctx.fillRect(x, baseY - hh, w, hh + H);
      // 窓
      ctx.fillStyle = 'rgba(255,220,140,0.35)';
      for (let wy = baseY - hh + 12; wy < baseY - 10; wy += 22) {
        for (let wx = x + 8; wx < x + w - 8; wx += 18) {
          if (Math.sin(wx * 12.9 + wy * 78.2 + seed) > 0.2) ctx.fillRect(wx, wy, 8, 12);
        }
      }
      ctx.fillStyle = color;
    }
  }
}
