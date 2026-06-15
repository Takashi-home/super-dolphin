/**
 * Particles — 軽量パーティクル（プール管理・カメラ相対描画）。
 * Game が1つ所有し、毎フレーム update() / draw() する。
 * 種類: dust(土ぼこり) / debris(破片) / sparkle(キラ) / bubble(泡) / pop(スコア文字) / ring(衝撃波)
 */
export class Particles {
  constructor(max = 320) {
    this.max = max;
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push(this._blank());
    this.active = 0;
  }

  _blank() {
    return { on: false, type: 'dust', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, rot: 0, vrot: 0, color: '#fff', text: '', grav: 0 };
  }

  _get() {
    for (let i = 0; i < this.max; i++) if (!this.pool[i].on) return this.pool[i];
    return null; // プール枯渇時は無視
  }

  spawn(type, x, y, opts = {}) {
    const p = this._get();
    if (!p) return;
    p.on = true; p.type = type; p.x = x; p.y = y;
    p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0;
    p.maxLife = p.life = opts.life ?? 30;
    p.size = opts.size ?? 4;
    p.rot = opts.rot ?? 0; p.vrot = opts.vrot ?? 0;
    p.color = opts.color ?? '#ffffff';
    p.text = opts.text ?? '';
    p.grav = opts.grav ?? 0;
  }

  // ── よく使うエフェクトのショートカット ──
  dust(x, y, dir = 0) {
    for (let i = 0; i < 4; i++) {
      this.spawn('dust', x, y, {
        vx: dir * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5),
        vy: -Math.random() * 1.2, life: 18 + Math.random() * 10,
        size: 5 + Math.random() * 5, color: 'rgba(255,255,255,0.8)',
      });
    }
  }

  landDust(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI - Math.PI;
      this.spawn('dust', x + Math.cos(a) * 10, y, {
        vx: Math.cos(a) * (1 + Math.random()), vy: -Math.random() * 1.5,
        life: 20 + Math.random() * 10, size: 6 + Math.random() * 6,
        color: 'rgba(230,235,245,0.85)',
      });
    }
  }

  debris(x, y, color = '#bf6a37') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.spawn('debris', x, y, {
        vx: Math.cos(a) * (2 + Math.random() * 2), vy: -3 - Math.random() * 3,
        life: 40, size: 6 + Math.random() * 4, rot: Math.random() * 6.28,
        vrot: (Math.random() - 0.5) * 0.5, color, grav: 0.4,
      });
    }
  }

  sparkle(x, y, color = '#fff3b0') {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn('sparkle', x, y, {
        vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2),
        life: 24 + Math.random() * 12, size: 3 + Math.random() * 3, color,
      });
    }
  }

  bubble(x, y) {
    this.spawn('bubble', x, y, { vx: (Math.random() - 0.5) * 0.4, vy: -1 - Math.random(), life: 60, size: 2 + Math.random() * 4, color: 'rgba(220,255,255,0.5)' });
  }

  popText(x, y, text, color = '#fff') {
    this.spawn('pop', x, y, { vy: -1.1, life: 45, size: 18, color, text });
  }

  ring(x, y, color = 'rgba(255,255,255,0.6)') {
    this.spawn('ring', x, y, { life: 18, size: 6, color });
  }

  firework(x, y) {
    const hue = Math.floor(Math.random() * 360);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const sp = 2.5 + Math.random() * 2;
      this.spawn('sparkle', x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 36 + Math.random() * 18, size: 3 + Math.random() * 2,
        color: `hsl(${hue},90%,${60 + Math.random() * 20}%)`, grav: 0.05,
      });
    }
  }

  update() {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      p.life--;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.grav;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vrot;
      n++;
    }
    this.active = n;
  }

  draw(ctx, cameraX) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      const a = Math.max(0, p.life / p.maxLife);
      const x = p.x - cameraX, y = p.y;
      ctx.globalAlpha = a;
      if (p.type === 'dust' || p.type === 'bubble') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size * (p.type === 'dust' ? a : 1), 0, Math.PI * 2); ctx.fill();
        if (p.type === 'bubble') { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
      } else if (p.type === 'debris') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === 'sparkle') {
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.3);
        ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.3, y + s * 0.3);
        ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.3, y + s * 0.3);
        ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.3, y - s * 0.3);
        ctx.closePath(); ctx.fill();
      } else if (p.type === 'ring') {
        const r = p.size + (1 - a) * 26;
        ctx.strokeStyle = p.color; ctx.lineWidth = 3 * a;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.type === 'pop') {
        ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
        ctx.font = `900 ${p.size}px 'Hiragino Maru Gothic ProN','Yu Gothic',sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText(p.text, x, y); ctx.fillText(p.text, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { for (const p of this.pool) p.on = false; this.active = 0; }
}
