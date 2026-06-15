/**
 * Sprites — キャラの手描き風アニメ描画（プロシージャル）。
 * public/assets/sprites/<key>.png があれば横並びフレームのシートとして差し替え描画。
 *
 * drawCharacter(ctx, key, sx, sy, w, h, o)
 *   sx,sy : 画面上のキャラ中心
 *   w,h   : 当たり判定相当の基準サイズ（tier で拡大済みの値を渡す）
 *   o     : { facing(1/-1), phase(0..2π 走りサイクル), squashX, squashY, tier(0-2), alpha, action }
 */
import { getImage } from './Assets.js';

const SHEET = { dolphin: 'sprites/dolphin', orca: 'sprites/orca', tetsujin: 'sprites/tetsujin' };
const FRAMES = 6; // シート使用時の横フレーム数想定

export function drawCharacter(ctx, key, sx, sy, w, h, o = {}) {
  const facing = o.facing ?? 1;
  const sqx = o.squashX ?? 1, sqy = o.squashY ?? 1;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(sx, sy);
  ctx.scale(facing * sqx, sqy);

  const img = getImage(SHEET[key]);
  if (img && img.width && img.height) {
    // 横並びシート：走りフレームを phase から選ぶ
    const fw = img.width / FRAMES, fh = img.height;
    let fi = 0;
    if (o.action === 'jump' || o.action === 'fall') fi = 4;
    else if (o.action === 'run') fi = 1 + (Math.floor((o.phase ?? 0) / (Math.PI / 2)) % 3);
    fi = Math.min(FRAMES - 1, fi);
    const dh = h * 1.3, dw = dh * (fw / fh);
    ctx.drawImage(img, fi * fw, 0, fw, fh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }

  // ── プロシージャル ──
  if (key === 'tetsujin') drawRobot(ctx, w, h, o);
  else drawSea(ctx, key, w, h, o);
  ctx.restore();
}

function drawSea(ctx, key, w, h, o) {
  const phase = o.phase ?? 0, tier = o.tier ?? 0;
  const pal = key === 'orca'
    ? { top: '#222a30', topDark: '#0d1216', belly: '#f3f6f8', fin: '#11161a', eyepatch: '#fff' }
    : { top: '#54b0e0', topDark: '#2f86bd', belly: '#eaf7ff', fin: '#327fb3', eyepatch: null };
  const tail = Math.sin(phase) * 0.35;        // 尾びれの羽ばたき
  const pec = Math.sin(phase + 1) * 0.3;      // 胸びれ
  const bobY = (o.action === 'run') ? Math.sin(phase) * 1.5 : 0;
  ctx.translate(0, bobY);

  const bx = w * 0.62, by = h * 0.44;         // 体の半径

  // 尾びれ（後方=左）
  ctx.save();
  ctx.translate(-bx * 0.9, 0); ctx.rotate(tail);
  ctx.fillStyle = pal.fin;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-bx * 0.5, -by * 0.7, -bx * 0.7, -by * 0.5);
  ctx.quadraticCurveTo(-bx * 0.35, 0, -bx * 0.7, by * 0.5);
  ctx.quadraticCurveTo(-bx * 0.5, by * 0.7, 0, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // 胴体（ティアドロップ）
  const grad = ctx.createLinearGradient(0, -by, 0, by);
  grad.addColorStop(0, pal.top); grad.addColorStop(1, pal.topDark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(bx, 0);                                   // 鼻先（前=右）
  ctx.quadraticCurveTo(bx * 0.5, -by, -bx * 0.2, -by);
  ctx.quadraticCurveTo(-bx, -by * 0.7, -bx, 0);
  ctx.quadraticCurveTo(-bx, by * 0.7, -bx * 0.2, by);
  ctx.quadraticCurveTo(bx * 0.5, by, bx, 0);
  ctx.closePath(); ctx.fill();

  // お腹（明色）
  ctx.fillStyle = pal.belly;
  ctx.beginPath();
  ctx.ellipse(bx * 0.05, by * 0.42, bx * 0.62, by * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  if (key === 'orca') { // シャチの白パッチ
    ctx.beginPath(); ctx.ellipse(bx * 0.45, -by * 0.25, bx * 0.16, by * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 背びれ
  ctx.fillStyle = pal.fin;
  ctx.beginPath();
  ctx.moveTo(-bx * 0.05, -by * 0.9);
  ctx.lineTo(-bx * 0.45, -by * 1.55);
  ctx.lineTo(-bx * 0.4, -by * 0.85);
  ctx.closePath(); ctx.fill();

  // 胸びれ
  ctx.save();
  ctx.translate(bx * 0.25, by * 0.45); ctx.rotate(0.5 + pec);
  ctx.fillStyle = pal.fin;
  ctx.beginPath(); ctx.ellipse(0, 0, bx * 0.34, by * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 目
  const ex = bx * 0.52, ey = -by * 0.18;
  if (pal.eyepatch) { ctx.fillStyle = pal.eyepatch; ctx.beginPath(); ctx.ellipse(ex - 1, ey, 5.5, 4, -0.3, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#10171d'; ctx.beginPath(); ctx.arc(ex + 1, ey, 2.4, 0, Math.PI * 2); ctx.fill();

  // 口
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx * 0.95, by * 0.12); ctx.quadraticCurveTo(bx * 0.7, by * 0.3, bx * 0.5, by * 0.2); ctx.stroke();

  if (tier >= 2) { // ファイア：ほお紅
    ctx.fillStyle = 'rgba(255,90,40,0.5)';
    ctx.beginPath(); ctx.arc(bx * 0.4, by * 0.12, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRobot(ctx, w, h, o) {
  const phase = o.phase ?? 0, tier = o.tier ?? 0;
  const swing = (o.action === 'run') ? Math.sin(phase) : 0;
  const bw = w * 0.78, bh = h * 0.58;
  const metal = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  metal.addColorStop(0, '#6f8190'); metal.addColorStop(0.5, '#aebcc7'); metal.addColorStop(1, '#56707f');

  // 脚（走りで前後）
  ctx.fillStyle = '#46555f';
  ctx.save(); ctx.translate(-bw * 0.22, bh * 0.5); ctx.rotate(swing * 0.5);
  ctx.fillRect(-6, 0, 12, h * 0.28); ctx.restore();
  ctx.save(); ctx.translate(bw * 0.22, bh * 0.5); ctx.rotate(-swing * 0.5);
  ctx.fillRect(-6, 0, 12, h * 0.28); ctx.restore();

  // 腕
  ctx.fillStyle = '#5a6b78';
  ctx.save(); ctx.translate(-bw * 0.5, -bh * 0.1); ctx.rotate(-swing * 0.5);
  ctx.fillRect(-5, 0, 10, h * 0.3); ctx.restore();
  ctx.save(); ctx.translate(bw * 0.5, -bh * 0.1); ctx.rotate(swing * 0.5);
  ctx.fillRect(-5, 0, 10, h * 0.3); ctx.restore();

  // 胴
  ctx.fillStyle = metal;
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
  // 胸エンブレム
  ctx.fillStyle = tier >= 2 ? '#ff5722' : '#ffca28';
  ctx.beginPath(); ctx.arc(0, -bh * 0.05, bw * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.font = `900 ${bw * 0.2}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('28', 0, -bh * 0.05);

  // 頭
  const hw = bw * 0.62, hh = h * 0.3;
  ctx.fillStyle = metal;
  roundRect(ctx, -hw / 2, -bh / 2 - hh + 2, hw, hh, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  // アンテナ
  ctx.strokeStyle = '#9fb0bd'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -bh / 2 - hh + 2); ctx.lineTo(0, -bh / 2 - hh - 7); ctx.stroke();
  ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(0, -bh / 2 - hh - 8, 2.5, 0, Math.PI * 2); ctx.fill();
  // 目（光る）
  const eyeY = -bh / 2 - hh * 0.45;
  ctx.fillStyle = '#1b2228'; roundRect(ctx, -hw * 0.36, eyeY - 4, hw * 0.72, 9, 3); ctx.fill();
  ctx.fillStyle = tier >= 2 ? '#ff7043' : '#7df9ff';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(-hw * 0.18, eyeY, 2.6, 0, Math.PI * 2); ctx.arc(hw * 0.18, eyeY, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ホバー/急降下時のロケット炎
  if (o.action === 'hover' || o.action === 'smash') {
    ctx.fillStyle = '#ffd54f';
    for (const dx of [-bw * 0.22, bw * 0.22]) {
      ctx.beginPath();
      ctx.moveTo(dx - 5, bh * 0.5 + h * 0.28);
      ctx.lineTo(dx, bh * 0.5 + h * 0.28 + 12 + Math.random() * 6);
      ctx.lineTo(dx + 5, bh * 0.5 + h * 0.28);
      ctx.closePath(); ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
