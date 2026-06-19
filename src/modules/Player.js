import { TILE } from '../data/levels.js';
import { drawCharacter } from './Sprites.js';
import { enemyContact } from './Enemies.js';

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
    this._mover = null;     // 乗っている動く床
    if (!keepPower) this.tier = 0;
    // アニメーション
    this.anim = 'idle';
    this.animPhase = 0;
    this.sqx = 1; this.sqy = 1;     // スクワッシュ&ストレッチ
    this._runDust = 0;
  }

  update(level, input, char, particles = null) {
    const T = TILE;
    // 動く床に乗っていたら一緒に運ばれる
    if (this._mover) { this.x += this._mover.dx; this.y += this._mover.dy; this._mover = null; }
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
        this.sqy = 1.32; this.sqx = 0.78;   // 踏み切りでタテに伸びる
        if (particles) particles.dust(this.x + this.w / 2, this.y + this.h, this.facing * 0.3);
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
    const fallSpeed = this.vy;
    this.wasOnGround = this.onGround;
    this.onGround = false;
    for (const { c, r } of level.rectCells(this.x, this.y, this.w, this.h)) {
      const kind = level.solidKind(c, r);
      if (!kind) continue;
      // バネ：上から乗ると高く跳ねる
      if (kind === 'spring') {
        if (this.vy > 0) {
          this.y = r * T - this.h; this.vy = -20;
          this.airJumps = char.special === 'doublejump' ? 1 : 0;
          level.bumpBlock(c, r); this.sound.spring();
          this.sqy = 1.3; this.sqx = 0.8;
          if (particles) particles.dust(this.x + this.w / 2, this.y + this.h, 0);
        } else if (this.vy < 0) { this.y = (r + 1) * T; this.vy = 0; }
        continue;
      }
      // 下に踏みつけ：シャチの急降下でレンガを壊す
      if (kind === 'break' && this.smashing && this.vy > 0) {
        if (level.breakAt(c, r)) { this.sound.break(); if (particles) particles.debris(c * T + T / 2, r * T + T / 2); }
        continue;
      }
      // レンガを頭突き：進化中なら壊す／ノーマルなら叩いてコイン
      if (kind === 'break' && this.vy < 0) {
        if (this.tier >= 1) {
          if (level.breakAt(c, r)) { this.sound.break(); if (particles) particles.debris(c * T + T / 2, r * T + T / 2); continue; }
        } else {
          if (level.popBrickCoin(c, r)) this.sound.coin();   // 上限(10枚)に達したら鳴らさない
        }
      }
      // ？ブロックを頭突き：アイテム/コインが出る
      if (kind === 'qblock' && this.vy < 0) {
        if (level.useQBlock(c, r, this.tier)) this.sound.coin();
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

    // 動く床の上に乗る（上面のみ・横には当たらない）
    if (this.vy >= 0) {
      for (const m of level.movers) {
        if (this.x + this.w > m.x + 3 && this.x < m.x + m.w - 3) {
          const feet = this.y + this.h;
          if (feet >= m.y - 10 && feet <= m.y + 14) {
            this.y = m.y - this.h; this.vy = 0; this.onGround = true;
            this.airJumps = char.special === 'doublejump' ? 1 : 0;
            this._mover = m;
            break;
          }
        }
      }
    }

    // 着地した瞬間：3段ジャンプの猶予窓を開く＋着地スクワッシュ＆土ぼこり
    if (this.onGround && !this.wasOnGround) {
      this.comboTimer = 16;
      if (fallSpeed > 4) {
        const amt = Math.min(0.4, fallSpeed / 40);
        this.sqy = 1 - amt; this.sqx = 1 + amt;
        if (particles) particles.landDust(this.x + this.w / 2, this.y + this.h);
      }
    }
    if (this.comboTimer > 0) this.comboTimer--;
    if (this.comboTimer === 0 && this.onGround && Math.abs(this.vx) < 1) this.jumpCombo = 0;
    // コヨーテタイム更新（次フレームで使う）
    this.coyote = this.onGround ? 6 : Math.max(0, this.coyote - 1);
    if (this.invuln > 0) this.invuln--;

    // ── アニメーション状態（描画用）──
    this._animate(particles);

    // ── ファイアボール ──
    this._updateFireballs(level);

    // ── 敵との接触 ──
    for (const e of level.enemies) {
      if (!e.alive || e.state === 'flat') continue;
      if (this._overlap(e)) {
        const res = enemyContact(e, this, particles);
        if (res === 'bounce') this.vy = -char.jump * 0.6;
        else if (res === 'hurt') { const r = this._hit(); if (r) return r; }
      }
    }

    // ── コイン ──
    for (const co of level.coins) {
      if (co.taken) continue;
      if (Math.abs((this.x + this.w / 2) - co.x) < 26 && Math.abs((this.y + this.h / 2) - co.y) < 28) {
        co.taken = true;
        level.coinCount++;
        this.sound.coin();
        if (particles) { particles.sparkle(co.x, co.y, '#ffe082'); particles.popText(co.x, co.y - 8, '+1', '#ffd54f'); }
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
        if (particles) {
          particles.sparkle(pu.x, pu.y, this.tier >= 2 ? '#ff7043' : '#80d8ff');
          particles.popText(pu.x, pu.y - 10, this.tier >= 2 ? 'FIRE!' : 'POWER!', this.tier >= 2 ? '#ff7043' : '#80d8ff');
        }
      }
    }

    // ── 中間地点 ──
    for (const cp of level.checkpoints) {
      if (cp.hit) continue;
      if (Math.abs((this.x + this.w / 2) - (cp.x + T / 2)) < T * 0.7 && Math.abs((this.y + this.h / 2) - cp.y) < T * 2) {
        cp.hit = true;
        level.activeCheckpoint = { x: cp.x, y: cp.y };
        this.sound.checkpoint();
        if (particles) { particles.sparkle(cp.x + T / 2, cp.y, '#69f0ae'); particles.popText(cp.x + T / 2, cp.y - 10, 'CHECK!', '#69f0ae'); }
      }
    }

    // ── トゲ ──
    if (level.touchesSpike(this.x + 6, this.y + 6, this.w - 12, this.h - 6)) {
      const r = this._hit();
      if (r) return r;
    }

    // ── 落下死（穴は救済なし）──
    if (this.y > level.height + 200) return this._die();

    // ── ゴール（本家風：旗ざおのポール位置より右まで来たら、高さ問わずクリア）──
    // ポールを飛び越えたり上を通っても、ゴールX以降に到達すれば判定する。
    const poleX = level.goal.x + T / 2;
    if ((this.x + this.w / 2) >= poleX) {
      return 'goal';
    }

    if (this.flash > 0) this.flash--;
    return null;
  }

  // 描画用のアニメ状態を毎フレーム更新する
  _animate(particles) {
    const moving = Math.abs(this.vx) > 0.4;
    let action;
    if (this.hoverTimer > 0) action = 'hover';
    else if (this.smashing) action = 'smash';
    else if (!this.onGround) action = this.vy < 0 ? 'jump' : 'fall';
    else if (moving && Math.sign(this.vx) !== this.facing) action = 'skid';
    else if (moving) action = 'run';
    else action = 'idle';
    this.anim = action;

    if (action === 'run') this.animPhase += 0.14 + Math.abs(this.vx) * 0.05;
    else if (action === 'idle') this.animPhase += 0.05;
    else this.animPhase += 0.1;
    if (this.animPhase > Math.PI * 200) this.animPhase -= Math.PI * 200;

    if (action === 'skid' && particles && this.onGround && Math.random() < 0.4) {
      particles.dust(this.x + this.w / 2, this.y + this.h, Math.sign(this.vx) * 0.6);
    }
    if (action === 'run' && this.onGround) {
      this._runDust -= Math.abs(this.vx);
      if (this._runDust <= 0 && particles) {
        particles.dust(this.x + this.w / 2 - this.facing * 8, this.y + this.h, -this.facing * 0.4);
        this._runDust = 26;
      }
    }
    // スクワッシュ復帰（イージング）
    this.sqx += (1 - this.sqx) * 0.18;
    this.sqy += (1 - this.sqy) * 0.18;
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
    const x = this.x - cameraX + this.w / 2;
    const y = this.y + this.h / 2;
    const tier = TIERS[this.tier] || TIERS[0];
    const scale = tier.scale;

    // ファイアボール（手描き）
    for (const fb of this.fireballs) {
      if (!fb.alive) continue;
      const fx = fb.x - cameraX, fy = fb.y;
      const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 11);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ff9e2c'); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx, fy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath(); ctx.arc(fx - 2, fy - 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    // 影（スクワッシュで横幅が変わる）
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, this.y + this.h, this.w * 0.5 * this.sqx, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 進化オーラ
    const aura = tier.aura || (this.hoverTimer > 0 || this.smashing ? char.accent : null);
    if (aura) {
      ctx.strokeStyle = aura; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 120) * 0.2;
      ctx.beginPath(); ctx.arc(x, y, this.w * 0.78 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const flashAlpha = (this.flash > 0 || this.invuln > 0) && Math.floor(Date.now() / 80) % 2 === 0 ? 0.35 : 1;
    drawCharacter(ctx, char.key, x, y, this.w * scale, this.h * scale, {
      facing: this.facing, phase: this.animPhase,
      squashX: this.sqx, squashY: this.sqy,
      tier: this.tier, alpha: flashAlpha, action: this.anim,
    });
  }
}
