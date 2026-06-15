/**
 * WorldMap — NSMBU 風のステージ選択マップ。
 * 既存の協力入力（左右で選択移動・ジャンプで決定）で操作する。
 * update(input) は 'enter' を返したら決定。draw() でマップを描画。
 */
import { drawCharacter } from './Sprites.js';

export class WorldMap {
  constructor(stages) {
    this.stages = stages;   // [{ name, theme }]
    this.selected = 0;
    this.unlocked = 1;      // 解放済みノード数（index < unlocked が選べる）
    this.cleared = 0;       // クリア済みノード数
    this._cd = 0;
    this.frame = 0;
  }

  reset() { this.selected = 0; this.unlocked = 1; this.cleared = 0; }

  // ステージ i をクリア → 次を解放してそこを選択
  clearStage(i) {
    this.cleared = Math.max(this.cleared, i + 1);
    this.unlocked = Math.max(this.unlocked, Math.min(this.stages.length, i + 2));
    this.selected = Math.min(this.stages.length - 1, i + 1);
  }

  update(input) {
    this._cd = Math.max(0, this._cd - 1);
    if (this._cd === 0) {
      if (input.left && !input.right && this.selected > 0) { this.selected--; this._cd = 12; }
      else if (input.right && !input.left && this.selected < this.unlocked - 1) { this.selected++; this._cd = 12; }
    }
    if (input.consumeJump()) return 'enter';
    return null;
  }

  _nodePos(i, W, H) {
    const n = this.stages.length;
    const x = W * (0.12 + (i / Math.max(1, n - 1)) * 0.76);
    const y = H * 0.52 + Math.sin(i * 1.4) * H * 0.14;
    return { x, y };
  }

  draw(ctx, W, H, info, charKey) {
    this.frame++;
    // 空
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2f7fd6'); g.addColorStop(0.7, '#9fd0f7'); g.addColorStop(1, '#dff1ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 360 + this.frame * 0.3) % (W + 200)) - 100;
      const cy = H * (0.12 + (i % 3) * 0.07);
      for (const [dx, r] of [[0, 22], [26, 17], [-26, 17]]) { ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // 草の地面
    ctx.fillStyle = '#6cc04a'; ctx.fillRect(0, H * 0.84, W, H * 0.16);
    ctx.fillStyle = '#4ea63a'; ctx.fillRect(0, H * 0.84, W, 6);

    // 道（点線）
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.setLineDash([2, 16]);
    ctx.beginPath();
    for (let i = 0; i < this.stages.length; i++) { const p = this._nodePos(i, W, H); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);

    // ノード
    for (let i = 0; i < this.stages.length; i++) {
      const p = this._nodePos(i, W, H);
      const locked = i >= this.unlocked;
      const cleared = i < this.cleared;
      const sel = i === this.selected;
      ctx.fillStyle = locked ? '#7e96a6' : cleared ? '#ffca28' : '#ff7043';
      ctx.beginPath(); ctx.arc(p.x, p.y, sel ? 26 : 20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(locked ? '🔒' : cleared ? '✓' : String(i + 1), p.x, p.y + 1);

      if (sel) {
        // 選択中：キャラが上でぴょこぴょこ＋名前ラベル
        const by = p.y - 52 + Math.sin(this.frame * 0.12) * 4;
        drawCharacter(ctx, charKey, p.x, by, 30, 34, { facing: 1, phase: this.frame * 0.18, squashX: 1, squashY: 1, tier: 0, action: 'idle' });
        const nm = this.stages[i].name;
        ctx.font = '900 19px sans-serif';
        const tw = ctx.measureText(nm).width + 24;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(ctx, p.x - tw / 2, p.y + 30, tw, 28, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(nm, p.x, p.y + 45);
      }
    }

    // タイトル＋残機/スコア
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 5;
    ctx.font = '900 30px "Hiragino Maru Gothic ProN","Yu Gothic",sans-serif'; ctx.textAlign = 'left';
    ctx.strokeText('ワールドマップ', 26, 22); ctx.fillText('ワールドマップ', 26, 22);
    ctx.font = '900 24px sans-serif'; ctx.textAlign = 'right';
    const stat = `★${info.score}    ×${info.lives}`;
    ctx.strokeText(stat, W - 26, 26); ctx.fillText(stat, W - 26, 26);

    // 操作ヒント
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 19px sans-serif';
    ctx.lineWidth = 4; ctx.fillStyle = '#fff';
    const hint = '← → ステージ選択 ／ ジャンプで決定';
    ctx.strokeText(hint, W / 2, H * 0.93); ctx.fillText(hint, W / 2, H * 0.93);
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
