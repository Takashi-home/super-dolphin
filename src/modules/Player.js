import { TILE } from '../data/levels.js';

// 進化段階。アイテム'M'で1段ずつ上がり、被弾で1段下がる（0で被弾するとミス）。
export const TIERS = [
  { name: 'ノーマル', scale: 1.0, aura: null },
  { name: 'パワー',   scale: 1.16, aura: '#80d8ff' }, // 頭でブロックを壊せる＋被弾1回耐える
  { name: 'ファイア', scale: 1.16, aura: '#ff7043' }, // ひっさつでファイアボール
];

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
    this.tier = 0;
    this.reset({ x: TILE, y: TILE });
  }

  reset(spawn, keepPower = false) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.wasOnGround = false;
    this.facing = 1;
    this.airJumps = 0;     // 2段ジャンプ（イルカ）の残り回数
    this.smashing = false;
    this.hoverTimer = 0;
    this.flash = 0;
    // 操作感: 先行入力（ジャンプバッファ）とコヨーテタイム
    this.jumpBuffer = 0;
    this.coyote = 0;
    // マリオ風3段ジャンプ
    this.jumpCombo = 0;
    this.comboTimer = 0;
    // 進化
    this.invuln = 0;
    this.fireballs = [];
    if (!keepPower) this.tier = 0;
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

    // ── ジャンプ（先行入力＋コヨーテタイム＋3段ジャンプ）──
    if (input.consumeJump()) this.jumpBuffer = 7;
    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyote > 0) {
        // 着地直後に走った勢いのまま跳ぶほど高くなる（最大3段）
        if (this.comboTimer > 0 && Math.abs(this.vx) > 1.5) {
          this.jumpCombo = Math.min(this.jumpCombo + 1, 2);
        } else {
          this.jumpCombo = 0;
        }
        const mult = [1, 1.18, 1.42][this.jumpCombo];
        this.vy = -char.jump * mult;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.comboTimer = 0;
        this.airJumps = char.special === 'doublejump' ? 1 : 0;
        this.sound.jump();
      } else if (this.airJumps > 0) {
        this.vy = -char.jump * 0.92;
        this.airJumps--;
        this.jumpBuffer = 0;
        this.sound.jump();
      }
    }
    if (this.jumpBuffer > 0) this.jumpBuffer--;

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
    this.wasOnGround = this.onGround;
    this.onGround = false;
    for (const { c, r } of level.rectCells(this.x, this.y, this.w, this.h)) {
      const kind = level.solidKind(c, r);
      if (!kind) continue;
      // 下に踏みつけ：シャチの急降下で壊す
      if (kind === 'break' && this.smashing && this.vy > 0) {
        if (level.breakAt(c, r)) this.sound.break();
        continue;
      }
      // 頭突き：パワー以上なら頭で壊せる（マリオ風）
      if (kind === 'break' && this.vy < 0 && this.tier >= 1) {
        if (level.breakAt(c, r)) { this.sound.break(); continue; }
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

    // 接地判定の安定化：足の1px下に固いセルがあれば接地とみなす。
    // （着地位置がタイル境界ちょうどだと rectCells が地面行を拾えず onGround が
    //  毎フレーム点滅し、ジャンプが不発になる＝操作しづらさの一因だった）
    if (!this.onGround && this.vy >= 0) {
      for (const { c, r } of level.rectCells(this.x + 2, this.y + this.h, this.w - 4, 1)) {
        if (level.solidKind(c, r)) { this.onGround = true; this.vy = 0; this.airJumps = 0; break; }
      }
    }

    // 着地した瞬間：3段ジャンプの猶予窓を開く
    if (this.onGround && !this.wasOnGround) this.comboTimer = 16;
    if (this.comboTimer > 0) this.comboTimer--;
    if (this.comboTimer === 0 && this.onGround && Math.abs(this.vx) < 1) this.jumpCombo = 0;
    // コヨーテタイム更新（次フレームで使う）
    this.coyote = this.onGround ? 6 : Math.max(0, this.coyote - 1);
    if (this.invuln > 0) this.invuln--;

    // ── ファイアボール ──
    this._updateFireballs(level);

    // ── 敵との接触 ──
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (this._overlap(e)) {
        if (wasFalling && (this.y + this.h) - e.y < 22) {
          e.alive = false;
          this.vy = -char.jump * 0.6;
          this.sound.stomp();
        } else {
          const r = this._hit();
          if (r) return r;
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

    // ── 進化アイテム ──
    for (const pu of level.powerups) {
      if (pu.taken) continue;
      if (Math.abs((this.x + this.w / 2) - pu.x) < 30 && Math.abs((this.y + this.h / 2) - pu.y) < 32) {
        pu.taken = true;
        if (this.tier < TIERS.length - 1) this.tier++;
        this.flash = 18;
        this.sound.powerup();
      }
    }

    // ── トゲ ──
    if (level.touchesSpike(this.x + 6, this.y + 6, this.w - 12, this.h - 6)) {
      const r = this._hit();
      if (r) return r;
    }

    // ── 落下死（穴は救済なし）──
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
    // ファイア状態ならファイアボールを発射（進化要素）
    if (this.tier >= 2) this._shootFire();

    if (char.special === 'doublejump') {
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

  _shootFire() {
    this.fireballs.push({
      x: this.x + this.w / 2 + this.facing * 12,
      y: this.y + this.h * 0.4,
      vx: this.facing * 8,
      vy: -2,
      life: 90,
      alive: true,
    });
    this.sound.fire();
  }

  _updateFireballs(level) {
    const T = TILE;
    for (const fb of this.fireballs) {
      if (!fb.alive) continue;
      if (--fb.life <= 0) { fb.alive = false; continue; }
      // 横移動 → 壁判定
      fb.x += fb.vx;
      const midR = Math.floor(fb.y / T);
      const wc = Math.floor((fb.x + (fb.vx > 0 ? 8 : -8)) / T);
      const wk = level.solidKind(wc, midR);
      if (wk) {
        if (wk === 'break') { level.breakAt(wc, midR); this.sound.break(); }
        fb.alive = false; continue;
      }
      // 縦移動 → 床でバウンド
      fb.vy += 0.5;
      fb.y += fb.vy;
      const fc = Math.floor(fb.x / T);
      const fr = Math.floor((fb.y + 8) / T);
      if (fb.vy > 0 && level.solidKind(fc, fr)) { fb.y = fr * T - 8; fb.vy = -7; }
      // 敵に命中
      for (const e of level.enemies) {
        if (!e.alive) continue;
        if (fb.x > e.x && fb.x < e.x + e.w && fb.y > e.y && fb.y < e.y + e.h) {
          e.alive = false; fb.alive = false; this.sound.stomp();
          break;
        }
      }
      if (fb.x < 0 || fb.x > level.width || fb.y > level.height) fb.alive = false;
    }
    if (this.fireballs.length > 12) this.fireballs = this.fireballs.filter((f) => f.alive);
  }

  _overlap(e) {
    return this.x < e.x + e.w && this.x + this.w > e.x &&
           this.y < e.y + e.h && this.y + this.h > e.y;
  }

  // 被弾。進化していれば1段階戻る（無敵時間つき）。0なら即ミス。
  _hit() {
    if (this.invuln > 0) return null;
    if (this.tier > 0) {
      this.tier--;
      this.invuln = 90;
      this.flash = 60;
      this.vy = -8;
      this.sound.stomp();
      return null;
    }
    return this._die();
  }

  _die() {
    this.sound.miss();
    this.flash = 30;
    return 'dead';
  }

  draw(ctx, cameraX, char) {
    const T = TILE;
    const x = this.x - cameraX + this.w / 2;
    const y = this.y + this.h / 2;
    const tier = TIERS[this.tier] || TIERS[0];

    // ファイアボール
    for (const fb of this.fireballs) {
      if (!fb.alive) continue;
      ctx.font = '20px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔥', fb.x - cameraX, fb.y);
    }

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, this.y + this.h, this.w * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 進化オーラ
    const aura = tier.aura || (this.hoverTimer > 0 || this.smashing ? char.accent : null);
    if (aura) {
      ctx.strokeStyle = aura; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(x, y, this.w * 0.72 * tier.scale, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(x, y);
    if (this.facing < 0) ctx.scale(-1, 1);
    ctx.font = `${(this.h + 10) * tier.scale}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = (this.flash > 0 || this.invuln > 0) && Math.floor(Date.now() / 80) % 2 === 0 ? 0.35 : 1;
    ctx.fillText(char.emoji, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
