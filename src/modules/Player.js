import { TILE } from '../data/levels.js';

/**
 * Player — 全員で共有して動かす1体のキャラ。
 * update(level, input, char) を毎フレーム呼ぶ。戻り値: 'goal' | 'dead' | null。
 * 効果音は constructor で渡した SoundEngine から鳴らす。
 */
export class Player {
  constructor(sound) {
    this.sound = sound;
    this.w = TILE - 12;
    this.h = TILE - 6;
    this.reset({ x: TILE, y: TILE });
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.airJumps = 0;     // 2段ジャンプの残り回数管理
    this.smashing = false;
    this.hoverTimer = 0;
    this.flash = 0;
  }

  update(level, input, char) {
    const T = TILE;
    const dash = input.dash;
    const maxSpeed = char.speed * (dash ? 1.7 : 1);
    const accel = 0.6;

    // ── 横移動 ──
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    if (dir !== 0) {
      this.vx += dir * accel * (dash ? 1.4 : 1);
      this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      this.facing = dir;
    } else {
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }
    if (dash && dir !== 0 && Math.random() < 0.15) this.sound.dash();

    // ── ジャンプ ──
    if (input.consumeJump()) {
      if (this.onGround) {
        this.vy = -char.jump;
        this.onGround = false;
        this.airJumps = char.special === 'doublejump' ? 1 : 0;
        this.sound.jump();
      } else if (this.airJumps > 0) {
        this.vy = -char.jump * 0.92;
        this.airJumps--;
        this.sound.jump();
      }
    }

    // ── ひっさつ技 ──
    if (input.consumeSpecial()) this._special(char);

    // ── 横方向の衝突解決 ──
    this.x += this.vx;
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.width) { this.x = level.width - this.w; this.vx = 0; }
    for (const { c, r } of level.rectCells(this.x, this.y, this.w, this.h)) {
      const kind = level.solidKind(c, r);
      if (!kind) continue;
      if (kind === 'break' && char.special === 'smash' && dash) {
        if (level.breakAt(c, r)) this.sound.break();
        continue;
      }
      if (this.vx > 0) this.x = c * T - this.w;
      else if (this.vx < 0) this.x = (c + 1) * T;
      this.vx = 0;
    }

    // ── 重力＋縦移動 ──
    this.vy += char.gravity;
    if (this.hoverTimer > 0) { this.vy = Math.min(this.vy, 1.0); this.hoverTimer--; }
    if (this.smashing) this.vy = Math.max(this.vy, 20);
    this.vy = Math.min(this.vy, 24);

    this.y += this.vy;
    const wasFalling = this.vy > 0;
    this.onGround = false;
    for (const { c, r } of level.rectCells(this.x, this.y, this.w, this.h)) {
      const kind = level.solidKind(c, r);
      if (!kind) continue;
      if (kind === 'break' && this.smashing && this.vy > 0) {
        if (level.breakAt(c, r)) this.sound.break();
        continue;
      }
      if (this.vy > 0) {
        this.y = r * T - this.h;
        this.onGround = true;
        this.vy = 0;
        this.airJumps = 0;
        if (this.smashing) { this.smashing = false; this.sound.stomp(); }
      } else if (this.vy < 0) {
        this.y = (r + 1) * T;
        this.vy = 0;
      }
    }

    // ── 敵との接触 ──
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (this._overlap(e)) {
        if (wasFalling && (this.y + this.h) - e.y < 22) {
          e.alive = false;
          this.vy = -char.jump * 0.6;
          this.sound.stomp();
        } else {
          return this._die();
        }
      }
    }

    // ── コイン ──
    for (const co of level.coins) {
      if (co.taken) continue;
      if (Math.abs((this.x + this.w / 2) - co.x) < 26 && Math.abs((this.y + this.h / 2) - co.y) < 28) {
        co.taken = true;
        this.sound.coin();
      }
    }

    // ── トゲ ──
    if (level.touchesSpike(this.x + 6, this.y + 6, this.w - 12, this.h - 6)) return this._die();

    // ── 落下死 ──
    if (this.y > level.height + 200) return this._die();

    // ── ゴール ──
    const gcx = level.goal.x + T / 2, gcy = level.goal.y + T / 2;
    if (Math.abs((this.x + this.w / 2) - gcx) < T && Math.abs((this.y + this.h / 2) - gcy) < T * 1.5) {
      return 'goal';
    }

    if (this.flash > 0) this.flash--;
    return null;
  }

  _special(char) {
    if (char.special === 'doublejump') {
      // 空中で発動すると即2段ジャンプ
      if (!this.onGround) { this.vy = -char.jump * 0.92; this.sound.jump(); }
    } else if (char.special === 'smash') {
      if (!this.onGround) { this.smashing = true; this.sound.dash(); }
    } else if (char.special === 'hover') {
      this.hoverTimer = 48;
      this.vy = Math.min(this.vy, 0);
      this.sound.special();
    }
    if (char.special !== 'hover') this.sound.special();
  }

  _overlap(e) {
    return this.x < e.x + e.w && this.x + this.w > e.x &&
           this.y < e.y + e.h && this.y + this.h > e.y;
  }

  _die() {
    this.sound.miss();
    this.flash = 30;
    return 'dead';
  }

  draw(ctx, cameraX, char) {
    const x = this.x - cameraX + this.w / 2;
    const y = this.y + this.h / 2;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, this.y + this.h, this.w * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // オーラ
    if (this.hoverTimer > 0 || this.smashing) {
      ctx.strokeStyle = char.accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, this.w * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    if (this.facing < 0) ctx.scale(-1, 1);
    ctx.font = `${this.h + 10}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = this.flash > 0 && this.flash % 6 < 3 ? 0.3 : 1;
    ctx.fillText(char.emoji, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
