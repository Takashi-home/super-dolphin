/**
 * Enemies — 敵の生成・更新・描画・接触処理（アニメ付き）。
 * 種類:
 *   goomba … クリボー。歩く。踏むと潰れる。横から当たるとダメージ。
 *   koopa  … ノコノコ。歩く。踏むと甲羅(shell)になり、横から蹴ると高速滑走(sliding)。
 *            滑走中の甲羅は他の敵を倒し、壊せるブロックを割り、プレイヤーにも当たる。
 *
 * 敵オブジェクトは { type, x, y, w, h, vx, vy, alive, state, t, dir } を持ち、
 * Player のファイアボール処理（e.x/e.y/e.w/e.h/e.alive を参照）とも互換。
 */
import { TILE as T } from '../data/levels.js';

export function createEnemy(type, c, r) {
  const base = { type, x: 0, y: 0, vx: 0, vy: 0, alive: true, state: 'walk', t: 0 };
  if (type === 'piranha') {
    // パックンフラワー：土管(直下の'p')から上下する。横移動・重力なし。
    base.w = T - 18; base.h = T - 4; base.state = 'piranha';
    base.homeC = c;
    base.hideY = (r + 1) * T;            // 隠れ位置（土管の中）
    base.topY = r * T - 4;               // 出た位置
    base.x = c * T + (T - base.w) / 2;
    base.y = base.hideY;
    base.t = Math.floor(Math.random() * 120);
    return base;
  }
  if (type === 'koopa') {
    base.w = T - 14; base.h = T - 2; base.vx = -0.8;
  } else { // goomba
    base.w = T - 12; base.h = T - 12; base.vx = -0.85;
  }
  base.x = c * T + (T - base.w) / 2;
  base.y = (r + 1) * T - base.h;     // 地面の上に乗せる
  base.flatTimer = 0;
  return base;
}

const WALKERS = new Set(['walk']);

export function updateEnemies(level, player, particles) {
  const list = level.enemies;
  for (const e of list) {
    if (!e.alive) continue;
    e.t++;

    if (e.state === 'piranha') {         // パックン：上下に出入り。近づくと引っ込む
      const px = player.x + player.w / 2;
      const near = Math.abs(px - (e.homeC * T + T / 2)) < T * 1.15;
      const up = Math.sin(e.t * 0.045) > 0.1;
      const targetY = (!near && up) ? e.topY : e.hideY;
      e.y += (targetY - e.y) * 0.16;
      continue;
    }

    if (e.state === 'flat') {            // 潰れたクリボー：少し残って消える
      if (--e.flatTimer <= 0) e.alive = false;
      continue;
    }

    // ── 横移動＋壁判定 ──
    const speed = e.state === 'sliding' ? Math.sign(e.vx) * 6.2 : e.vx;
    e.x += speed;
    const dir = Math.sign(speed) || e.dir || -1; e.dir = dir;
    const frontC = Math.floor((e.x + (dir > 0 ? e.w + 1 : -1)) / T);
    const midR = Math.floor((e.y + e.h / 2) / T);
    const k = level.solidKind(frontC, midR);
    if (k || e.x <= 0 || e.x + e.w >= level.width) {
      if (e.state === 'sliding' && k === 'break') { level.breakAt(frontC, midR); player.sound.break(); if (particles) particles.debris(frontC * T + T / 2, midR * T + T / 2); }
      e.vx = -Math.abs(e.vx) * Math.sign(speed) || e.vx * -1;
      e.vx = Math.abs(e.state === 'sliding' ? 6.2 : e.vx) * (dir > 0 ? -1 : 1);
      e.x += dir > 0 ? -2 : 2;
    }

    // ── 重力＋着地 ──
    e.vy = Math.min(e.vy + 0.6, 18);
    e.y += e.vy;
    const botR = Math.floor((e.y + e.h) / T);
    const cL = Math.floor((e.x + 3) / T), cR = Math.floor((e.x + e.w - 3) / T);
    let onGround = false;
    if (e.vy >= 0 && (level.solidKind(cL, botR) || level.solidKind(cR, botR))) {
      e.y = botR * T - e.h; e.vy = 0; onGround = true;
    }

    // ── 歩行型は端で反転（滑走甲羅は落ちる）──
    if (WALKERS.has(e.state) && onGround) {
      const aheadC = Math.floor((e.x + (Math.sign(e.vx) > 0 ? e.w + 1 : -1)) / T);
      const belowR = Math.floor((e.y + e.h + 2) / T);
      if (!level.solidKind(aheadC, belowR)) e.vx *= -1;
    }

    // ── 穴に落ちたら退場 ──
    if (e.y > level.height + 80) e.alive = false;
  }

  // ── 滑走甲羅 × ほかの敵 ──
  for (const s of list) {
    if (!s.alive || s.state !== 'sliding') continue;
    for (const e of list) {
      if (e === s || !e.alive || e.state === 'sliding') continue;
      if (overlap(s, e)) {
        e.alive = false;
        if (particles) { particles.debris(e.x + e.w / 2, e.y + e.h / 2, '#7a5a2a'); particles.popText(e.x + e.w / 2, e.y, '+200', '#fff'); }
        player.sound.stomp();
      }
    }
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * プレイヤーが敵に接触したときの処理。
 * 戻り値: 'bounce'(踏んだ→上に跳ねる) | 'hurt'(被弾) | 'kick'/'none'(影響なし)
 */
export function enemyContact(e, player, particles) {
  const fromTop = player.vy > 0 && (player.y + player.h) - e.y < e.h * 0.7;

  if (e.type === 'piranha') {
    // 引っ込んでいる時は当たらない。出ている時は踏んでもダメージ（踏めない）。
    if (e.y > e.hideY - 12) return 'none';
    return 'hurt';
  }

  if (e.type === 'goomba') {
    if (e.state === 'flat') return 'none';
    if (fromTop) {
      e.state = 'flat'; e.flatTimer = 26; e.vx = 0;
      player.sound.stomp();
      if (particles) { particles.dust(e.x + e.w / 2, e.y + e.h, 0); particles.popText(e.x + e.w / 2, e.y, '+100', '#fff'); }
      return 'bounce';
    }
    return 'hurt';
  }

  // koopa
  if (e.state === 'walk') {
    if (fromTop) {
      e.state = 'shell'; e.vx = 0; e.t = 0; e.h = T - 16; e.y += 14; // 甲羅にしゃがむ
      player.sound.stomp();
      if (particles) particles.popText(e.x + e.w / 2, e.y, '+100', '#fff');
      return 'bounce';
    }
    return 'hurt';
  }
  if (e.state === 'shell') {
    // 上からでも横からでも蹴って滑走させる（甲羅の上で跳ね続けない）
    const side = (player.x + player.w / 2) < (e.x + e.w / 2) ? 1 : -1;
    const dir = fromTop ? (player.facing || side) : side;
    e.state = 'sliding'; e.vx = dir * 6.2; e.dir = dir;
    player.sound.kick();
    return 'kick';
  }
  if (e.state === 'sliding') {
    if (fromTop) { e.state = 'shell'; e.vx = 0; player.sound.stomp(); return 'bounce'; }
    return 'hurt';
  }
  return 'none';
}

export function drawEnemies(ctx, level, cameraX, W, H) {
  for (const e of level.enemies) {
    if (!e.alive) continue;
    const x = e.x - cameraX;
    if (x < -T || x > W + T) continue;
    if (e.type === 'goomba') drawGoomba(ctx, e, x);
    else if (e.type === 'piranha') drawPiranha(ctx, e, x);
    else drawKoopa(ctx, e, x);
  }
}

function drawPiranha(ctx, e, x) {
  if (e.y > e.hideY - 8) return;        // ほぼ隠れている
  const cx = x + e.w / 2;
  const headR = e.w * 0.6;
  const headY = e.y + headR;
  // 茎
  ctx.fillStyle = '#3aa64a';
  ctx.fillRect(cx - 5, headY, 10, (e.hideY) - headY + 6);
  ctx.strokeStyle = '#1f7a30'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 5, headY, 10, (e.hideY) - headY + 6);
  // 頭（赤い球＋白い斑点）
  const g = ctx.createRadialGradient(cx - 4, headY - 4, 2, cx, headY, headR);
  g.addColorStop(0, '#ff6f6f'); g.addColorStop(1, '#c62828');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  for (const [dx, dy] of [[-headR * 0.4, -headR * 0.2], [headR * 0.4, -headR * 0.2], [0, headR * 0.45]]) { ctx.beginPath(); ctx.arc(cx + dx, headY + dy, headR * 0.16, 0, Math.PI * 2); ctx.fill(); }
  // 口（ギザ歯）
  ctx.fillStyle = '#fff';
  ctx.save(); ctx.beginPath(); ctx.rect(cx - headR, headY - 3, headR * 2, 7); ctx.clip();
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 5, headY - 3); ctx.lineTo(cx + i * 5 + 2.5, headY + 4); ctx.lineTo(cx + i * 5 + 5, headY - 3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

function drawGoomba(ctx, e, x) {
  const cx = x + e.w / 2, top = e.y, w = e.w, h = e.h;
  if (e.state === 'flat') {
    ctx.fillStyle = '#7a4a22';
    ctx.beginPath(); ctx.ellipse(cx, top + h - 4, w * 0.6, 6, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const waddle = Math.sin(e.t * 0.25);
  // 足
  ctx.fillStyle = '#3c2410';
  ctx.beginPath(); ctx.ellipse(cx - w * 0.24, top + h - 3 + waddle * 2, w * 0.18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + w * 0.24, top + h - 3 - waddle * 2, w * 0.18, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 体（きのこドーム）
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#a96a32'); g.addColorStop(1, '#6e421d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + h - 6);
  ctx.quadraticCurveTo(cx - w / 2, top, cx, top);
  ctx.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + h - 6);
  ctx.quadraticCurveTo(cx, top + h, cx - w / 2, top + h - 6);
  ctx.closePath(); ctx.fill();
  // 顔（明色帯）
  ctx.fillStyle = '#e9c79a';
  ctx.beginPath(); ctx.ellipse(cx, top + h * 0.62, w * 0.4, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  // 目＋怒り眉
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + s * w * 0.16, top + h * 0.45, 4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + s * w * 0.16 + s, top + h * 0.47, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3c2410'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx + s * w * 0.06, top + h * 0.34); ctx.lineTo(cx + s * w * 0.28, top + h * 0.42); ctx.stroke();
  }
}

function drawKoopa(ctx, e, x) {
  const cx = x + e.w / 2, top = e.y, w = e.w, h = e.h;
  if (e.state === 'shell' || e.state === 'sliding') {
    const spin = e.state === 'sliding' ? e.t * 0.4 : 0;
    // 甲羅
    const g = ctx.createRadialGradient(cx - 4, top + h * 0.4, 2, cx, top + h * 0.5, w * 0.7);
    g.addColorStop(0, '#5fd06a'); g.addColorStop(1, '#1f8a39');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, top + h * 0.5, w * 0.62, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0d4a1e'; ctx.lineWidth = 3; ctx.stroke();
    // 甲羅の六角模様（回転）
    ctx.save(); ctx.translate(cx, top + h * 0.5); ctx.rotate(spin);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * w * 0.34, Math.sin(a) * h * 0.28); }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    return;
  }
  // 歩くノコノコ
  const step = Math.sin(e.t * 0.22);
  ctx.fillStyle = '#f4c430'; // 足
  ctx.beginPath(); ctx.ellipse(cx - w * 0.22, top + h - 3 + step * 2, w * 0.16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + w * 0.22, top + h - 3 - step * 2, w * 0.16, 5, 0, 0, Math.PI * 2); ctx.fill();
  // 甲羅
  const g = ctx.createLinearGradient(0, top + h * 0.2, 0, top + h);
  g.addColorStop(0, '#46c85a'); g.addColorStop(1, '#1f8a39');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx - w * 0.05, top + h * 0.55, w * 0.5, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0d4a1e'; ctx.lineWidth = 2.5; ctx.stroke();
  // 頭（前方=進行方向）
  const hx = cx + e.dir * w * 0.42;
  ctx.fillStyle = '#f4d06a';
  ctx.beginPath(); ctx.ellipse(hx, top + h * 0.34, w * 0.26, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + e.dir * w * 0.08, top + h * 0.3, 2.2, 0, Math.PI * 2); ctx.fill();
}
