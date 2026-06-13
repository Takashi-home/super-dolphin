/**
 * SceneManager — 横スクロール用のパララックス背景。
 * Game が所有する canvas/ctx に対して draw(ctx, cameraX, W, H) で描画する。
 * テーマ: 'ocean' / 'cave' / 'water' / 'pipe' / 'sky' / 'city'。
 * テーマはステージ（levels.js の theme）に応じて切り替わる。
 */
export class SceneManager {
  constructor() {
    this.theme = 'ocean';
    this.frame = 0;
  }

  setTheme(theme) { this.theme = theme || 'ocean'; }

  draw(ctx, cameraX, W, H) {
    this.frame++;
    switch (this.theme) {
      case 'cave':  this._drawCave(ctx, cameraX, W, H); break;
      case 'water': this._drawWater(ctx, cameraX, W, H); break;
      case 'sky':   this._drawSky(ctx, cameraX, W, H); break;
      case 'pipe':  this._drawPipe(ctx, cameraX, W, H); break;
      case 'city':  this._drawCity(ctx, cameraX, W, H); break;
      default:      this._drawOcean(ctx, cameraX, W, H);
    }
  }

  _sky(ctx, W, H, colors) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 繰り返しシード（決定的な疑似乱数）
  _rnd(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

  // ── なみのりビーチ（ocean）────────────────────────────────
  _drawOcean(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#0a3a5c', '#1976a8', '#4fb3d9', '#a7e0f2']);
    const sx = W * 0.78, sy = H * 0.2;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 180);
    sun.addColorStop(0, 'rgba(255,255,230,0.8)');
    sun.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    this._waveLayer(ctx, cameraX * 0.2, W, H, H * 0.62, 'rgba(255,255,255,0.10)', 120, 30);
    this._waveLayer(ctx, cameraX * 0.4, W, H, H * 0.72, 'rgba(255,255,255,0.14)', 90, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 24; i++) {
      const seed = i * 97.3;
      const bx = ((seed * 13 - cameraX * 0.5) % (W + 100) + W + 100) % (W + 100) - 50;
      const rise = (this.frame * (0.5 + (i % 3) * 0.3) + seed) % (H + 40);
      const by = H - rise, r = 2 + (i % 4);
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  _waveLayer(ctx, off, W, H, baseY, color, wlen, amp) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = baseY + Math.sin((x + off) / wlen + this.frame * 0.02) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  // ── どうくつケーブ（cave / 暗い）──────────────────────────
  _drawCave(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#05060a', '#0a0d16', '#10131f', '#161a28']);
    // ぼんやり光る鉱石（パララックス）
    for (let i = 0; i < 14; i++) {
      const seed = i * 53.7;
      const cx = ((this._rnd(seed) * 2600 - cameraX * 0.3) % (W + 120) + W + 120) % (W + 120) - 60;
      const cy = H * (0.2 + this._rnd(seed + 1) * 0.6);
      const tw = 0.5 + 0.5 * Math.sin(this.frame * 0.04 + seed);
      const col = i % 2 ? '120,210,255' : '180,140,255';
      const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      gl.addColorStop(0, `rgba(${col},${0.35 * tw})`);
      gl.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gl; ctx.fillRect(cx - 30, cy - 30, 60, 60);
      ctx.fillStyle = `rgba(${col},${0.5 * tw})`;
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // 鍾乳石（上）／石筍（下）のシルエット
    this._stalactites(ctx, cameraX * 0.4, W, H, '#070910', 90, 0);   // 上
    this._stalactites(ctx, cameraX * 0.4, W, H, '#070910', 110, 1);  // 下
    // 暗いビネット
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  _stalactites(ctx, off, W, H, color, step, bottom) {
    ctx.fillStyle = color;
    const span = W + step * 2;
    for (let i = -1; i * step < span; i++) {
      const seed = i * 71.3 + bottom * 9;
      const x = (i * step - ((off % step) + step) % step);
      const len = 40 + this._rnd(seed) * H * 0.28;
      const w = step * 0.7;
      ctx.beginPath();
      if (bottom) { ctx.moveTo(x, H); ctx.lineTo(x + w / 2, H - len); ctx.lineTo(x + w, H); }
      else { ctx.moveTo(x, 0); ctx.lineTo(x + w / 2, len); ctx.lineTo(x + w, 0); }
      ctx.closePath(); ctx.fill();
    }
  }

  // ── すいちゅうダイブ（water / 水中）───────────────────────
  _drawWater(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#012a4a', '#02486f', '#036b96', '#0a86a8']);
    // 光のカーテン（斜めの光芒）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const bx = (i / 6) * W + Math.sin(this.frame * 0.01 + i) * 40 - cameraX * 0.1 % W;
      ctx.fillStyle = 'rgba(180,240,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(bx, 0); ctx.lineTo(bx + 60, 0);
      ctx.lineTo(bx + 180, H); ctx.lineTo(bx + 100, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 海藻（手前のシルエット、ゆらゆら）
    ctx.fillStyle = 'rgba(3,40,30,0.55)';
    const step = 70;
    for (let i = -1; i * step < W + step; i++) {
      const x = i * step - (cameraX * 0.5 % step);
      const h = H * (0.3 + this._rnd(i * 17.1) * 0.25);
      ctx.beginPath(); ctx.moveTo(x, H);
      for (let s = 0; s <= h; s += 12) {
        const sway = Math.sin(this.frame * 0.05 + i + s * 0.05) * 14 * (s / h);
        ctx.lineTo(x + sway, H - s);
      }
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(4,60,42,0.5)';
      ctx.stroke();
    }
    // 泡
    ctx.fillStyle = 'rgba(220,255,255,0.3)';
    for (let i = 0; i < 30; i++) {
      const seed = i * 61.7;
      const bx = ((seed * 13 - cameraX * 0.5) % (W + 100) + W + 100) % (W + 100) - 50;
      const rise = (this.frame * (0.6 + (i % 3) * 0.4) + seed) % (H + 40);
      const r = 1.5 + (i % 4);
      ctx.beginPath(); ctx.arc(bx + Math.sin(rise * 0.1) * 6, H - rise, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── そらのフォートレス（sky / 空の上）────────────────────
  _drawSky(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#2f7fd6', '#5aa6ee', '#9fd0f7', '#e8f6ff']);
    // 太陽
    const sx = W * 0.82, sy = H * 0.18;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 120);
    sun.addColorStop(0, 'rgba(255,255,235,1)');
    sun.addColorStop(0.4, 'rgba(255,250,200,0.7)');
    sun.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    // 遠くの山なみ
    this._hills(ctx, cameraX * 0.15, W, H, H * 0.72, 'rgba(255,255,255,0.20)', 260, 120);
    // 雲（2レイヤーのパララックス）
    this._clouds(ctx, cameraX * 0.25, W, H, 0.22, 0.9);
    this._clouds(ctx, cameraX * 0.5, W, H, 0.40, 1.3);
  }

  _hills(ctx, off, W, H, baseY, color, wlen, amp) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
      const y = baseY - Math.abs(Math.sin((x + off) / wlen)) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  _clouds(ctx, off, W, H, yBase, scale) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const step = 320;
    for (let i = -1; i * step < W + step; i++) {
      const seed = i * 41.3;
      const x = i * step - (((off % step) + step) % step) + this._rnd(seed) * 120;
      const y = H * (yBase + this._rnd(seed + 2) * 0.12);
      const s = (18 + this._rnd(seed + 5) * 16) * scale;
      ctx.globalAlpha = 0.85;
      [[0, 0, 1], [s * 1.1, 4, 0.8], [-s * 1.1, 4, 0.8], [s * 0.5, -s * 0.5, 0.7], [-s * 0.5, -s * 0.5, 0.7]]
        .forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, s * r, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.globalAlpha = 1;
  }

  // ── どかんパイプ（pipe / 土管の中）───────────────────────
  _drawPipe(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#04210f', '#073518', '#0a4a22', '#073518']);
    // 奥の大きな土管（パララックス）
    for (let i = 0; i < 6; i++) {
      const seed = i * 88.1;
      const step = 260;
      const x = ((this._rnd(seed) * 2200 - cameraX * 0.25) % (W + step) + W + step) % (W + step) - step / 2;
      const pw = 90 + this._rnd(seed + 1) * 60;
      const top = H * (0.15 + this._rnd(seed + 2) * 0.25);
      // 管の胴
      const g = ctx.createLinearGradient(x, 0, x + pw, 0);
      g.addColorStop(0, '#0a5a28'); g.addColorStop(0.5, '#1f8c45'); g.addColorStop(1, '#0a5a28');
      ctx.fillStyle = g; ctx.fillRect(x, top, pw, H - top);
      // 縁（リップ）
      ctx.fillStyle = '#23a04f';
      ctx.fillRect(x - 8, top, pw + 16, 22);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 8, top + 18, pw + 16, 4);
    }
    // スクロールするリング状ハイライト（管の中を進む感じ）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rs = 64;
    for (let yy = -(this.frame * 1.2 % rs); yy < H; yy += rs) {
      ctx.fillStyle = 'rgba(120,255,160,0.05)';
      ctx.fillRect(0, yy, W, 10);
    }
    ctx.restore();
    // 中央を明るく、周囲を暗く（管の中の陰影）
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(40,120,60,0.12)'); v.addColorStop(1, 'rgba(0,10,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // ── 夕暮れの街（city / 鉄人28号の旧テーマ・予備）──────────
  _drawCity(ctx, cameraX, W, H) {
    this._sky(ctx, W, H, ['#1a1330', '#3a2a5a', '#a85a7a', '#ffb27a']);
    const sx = W * 0.7, sy = H * 0.32;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 140);
    sun.addColorStop(0, 'rgba(255,200,120,0.95)');
    sun.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
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
      ctx.fillStyle = 'rgba(255,220,140,0.35)';
      for (let wy = baseY - hh + 12; wy < baseY - 10; wy += 22)
        for (let wx = x + 8; wx < x + w - 8; wx += 18)
          if (Math.sin(wx * 12.9 + wy * 78.2 + seed) > 0.2) ctx.fillRect(wx, wy, 8, 12);
      ctx.fillStyle = color;
    }
  }
}
