/**
 * Items — ？ブロック/レンガから出るアイテムとコインの実体。
 * level.items 配列を Enemies と同様に Level/main から更新・描画する。
 *   power   … スーパーキノコ/ファイアフラワー（取ると進化 tier+1）
 *   oneup   … 1UPキノコ（緑）
 *   coinpop … ブロックから出てくる回転コイン（出た瞬間にカウント加算、軽く跳ねて消える）
 */
import { TILE as T } from '../data/levels.js';

export function spawnItem(level, type, c, r, flower = false) {
  if (type === 'coinpop') {
    level.items.push({ type, x: c * T + T / 2, y: r * T, vy: -9, t: 0, alive: true });
    level.coinCount++;
    return;
  }
  // power / oneup：ブロックの上にせり出してから歩き出す
  level.items.push({
    type, flower, x: c * T + 5, y: r * T, w: T - 10, h: T - 10,
    vx: 0, vy: 0, emerge: T, dir: 1, alive: true, t: 0,
  });
}

export function updateItems(level, player, particles) {
  for (const it of level.items) {
    if (!it.alive) continue;
    it.t++;

    if (it.type === 'coinpop') {
      it.vy += 0.5; it.y += it.vy;
      if (it.t > 28) it.alive = false;
      continue;
    }

    // せり出し中（当たり判定なしで上へ）
    if (it.emerge > 0) { it.y -= 2; it.emerge -= 2; if (it.emerge <= 0) it.vx = it.dir * 1.3; continue; }

    // 物理（重力＋地面＋壁反転、敵と同様）
    it.vy = Math.min(it.vy + 0.5, 16); it.y += it.vy;
    const botR = Math.floor((it.y + it.h) / T);
    const cL = Math.floor((it.x + 3) / T), cR = Math.floor((it.x + it.w - 3) / T);
    let onGround = false;
    if (it.vy >= 0 && (level.solidKind(cL, botR) || level.solidKind(cR, botR))) { it.y = botR * T - it.h; it.vy = 0; onGround = true; }
    it.x += it.vx;
    const frontC = Math.floor((it.x + (it.vx > 0 ? it.w + 1 : -1)) / T);
    const midR = Math.floor((it.y + it.h / 2) / T);
    if (level.solidKind(frontC, midR) || it.x <= 0 || it.x + it.w >= level.width) { it.vx *= -1; it.dir = -it.dir; }
    // 端で落ちないよう反転
    if (onGround) {
      const aheadC = Math.floor((it.x + (it.vx > 0 ? it.w + 1 : -1)) / T);
      const belowR = Math.floor((it.y + it.h + 2) / T);
      if (!level.solidKind(aheadC, belowR)) { it.vx *= -1; it.dir = -it.dir; }
    }
    if (it.y > level.height + 80) it.alive = false;

    // 取得
    if (overlapPlayer(it, player)) {
      it.alive = false;
      if (it.type === 'oneup') {
        player.gainLife?.();
        if (particles) particles.popText(it.x + it.w / 2, it.y, '1UP', '#69f0ae');
        player.sound.powerup();
      } else {
        player.tier = it.flower ? 2 : Math.min(player.tier + 1, 2);
        player.flash = 18;
        player.sound.powerup();
        if (particles) {
          particles.sparkle(it.x + it.w / 2, it.y + it.h / 2, player.tier >= 2 ? '#ff7043' : '#80d8ff');
          particles.popText(it.x + it.w / 2, it.y, player.tier >= 2 ? 'FIRE!' : 'POWER!', player.tier >= 2 ? '#ff7043' : '#80d8ff');
        }
      }
    }
  }
  // 後始末
  if (level.items.length > 40) level.items = level.items.filter((i) => i.alive);
}

function overlapPlayer(it, p) {
  return p.x < it.x + it.w && p.x + p.w > it.x && p.y < it.y + it.h && p.y + p.h > it.y;
}

export function drawItems(ctx, level, cameraX, W, H) {
  for (const it of level.items) {
    if (!it.alive) continue;
    const x = it.x - cameraX;
    if (x < -T || x > W + T) continue;
    if (it.type === 'coinpop') { drawCoinPop(ctx, x, it.y, it.t); continue; }
    const cx = x + it.w / 2, cy = it.y + it.h / 2;
    if (it.type === 'oneup') drawMushroom(ctx, cx, cy, it.w, '#43c463', '#1b7a36');
    else if (it.flower) drawFlower(ctx, cx, cy, it.w);
    else drawMushroom(ctx, cx, cy, it.w, '#e53935', '#a31515');
  }
}

function drawCoinPop(ctx, x, y, t) {
  const sw = Math.abs(Math.cos(t * 0.4)) * 9 + 2;
  const g = ctx.createLinearGradient(x - sw, 0, x + sw, 0);
  g.addColorStop(0, '#b8860b'); g.addColorStop(0.5, '#ffe969'); g.addColorStop(1, '#c8930d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, sw, 12, 0, 0, Math.PI * 2); ctx.fill();
}

function drawMushroom(ctx, cx, cy, w, cap, capDark) {
  const r = w * 0.5;
  // 茎
  ctx.fillStyle = '#fff3e0';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.4, r * 0.55, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4632';
  ctx.beginPath(); ctx.arc(cx - r * 0.2, cy + r * 0.45, 1.6, 0, Math.PI * 2); ctx.arc(cx + r * 0.2, cy + r * 0.45, 1.6, 0, Math.PI * 2); ctx.fill();
  // かさ
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.2);
  g.addColorStop(0, cap); g.addColorStop(1, capDark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0); ctx.lineTo(cx + r, cy + r * 0.1); ctx.lineTo(cx - r, cy + r * 0.1); ctx.closePath(); ctx.fill();
  // 斑点
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.25, r * 0.2, 0, Math.PI * 2); ctx.arc(cx + r * 0.4, cy - r * 0.25, r * 0.2, 0, Math.PI * 2); ctx.arc(cx, cy - r * 0.55, r * 0.22, 0, Math.PI * 2); ctx.fill();
}

function drawFlower(ctx, cx, cy, w) {
  const r = w * 0.42;
  ctx.fillStyle = '#2e9e3a';
  ctx.fillRect(cx - 2, cy, 4, r);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3;
    ctx.fillStyle = i % 2 ? '#ff7043' : '#ffd54f';
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.7, cy - r * 0.3 + Math.sin(a) * r * 0.7, r * 0.42, r * 0.28, a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.3, r * 0.34, 0, Math.PI * 2); ctx.fill();
}
