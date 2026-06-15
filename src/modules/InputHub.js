/**
 * InputHub — スマホ（SSE経由）とキーボード（開発用fallback）の入力を統合する。
 *
 *  - left / right / dash : 押し続け（boolean）。複数プレイヤーが同じ action を担当しても OR で合成。
 *  - jump / special      : 単発（edgeトリガ）。consumeJump()/consumeSpecial() で1回だけ取り出す。
 *
 * Game は SSE の {type:'input', id, action, state} を applyRemote(id, action, state) に渡し、
 * 毎フレーム tick() を呼ぶ。
 *
 * 【保持の方式】カウンタ方式（down で+1 / up で-1）はやめ、
 *  「ID × アクションごとに有効期限(ms)」を持つ方式にする。
 *   - コントローラーは保持中 `down` を定期再送し、その都度 期限を延長する。
 *   - 同じ down が何回来ても冪等（フリーズしない）。
 *   - up が欠落しても、再送が止まれば期限切れで自動的に解除される（押しっぱなし固着を防ぐ）。
 */
export class InputHub {
  constructor() {
    this.left = false;
    this.right = false;
    this.dash = false;
    this._jumpQueued = false;
    this._specialQueued = false;

    // action -> Map<id, expiryMs>
    this._holds = { left: new Map(), right: new Map(), dash: new Map() };
    this._keyHeld = { left: false, right: false, dash: false };
    this.HOLD_MS = 550;   // down の有効期間（コントローラーの再送間隔 < これ）
    this.TAP_MS = 160;    // タップ（jump/special を hold に使う場合用）

    this._bindKeyboard();
  }

  // SSE からの入力を反映（id 単位で保持期限を更新）
  applyRemote(id, action, state) {
    if (action === 'jump') { if (state !== 'up') this._jumpQueued = true; return; }
    if (action === 'special') { if (state !== 'up') this._specialQueued = true; return; }
    const m = this._holds[action];
    if (!m) return;
    const key = id || 'anon';
    if (state === 'up') m.delete(key);
    else m.set(key, performance.now() + (state === 'tap' ? this.TAP_MS : this.HOLD_MS));
  }

  // 毎フレーム呼ぶ：期限切れの保持を掃除し、left/right/dash を再計算する
  tick() {
    const now = performance.now();
    for (const a of ['left', 'right', 'dash']) {
      const m = this._holds[a];
      let any = false;
      for (const [key, exp] of m) {
        if (exp <= now) m.delete(key);     // 期限切れは自動解除（Map は反復中の削除可）
        else any = true;
      }
      this[a] = this._keyHeld[a] || any;
    }
  }

  consumeJump() { const v = this._jumpQueued; this._jumpQueued = false; return v; }
  consumeSpecial() { const v = this._specialQueued; this._specialQueued = false; return v; }

  reset() {
    this._holds.left.clear();
    this._holds.right.clear();
    this._holds.dash.clear();
    this._jumpQueued = this._specialQueued = false;
    this.left = this.right = this.dash = false;
  }

  _bindKeyboard() {
    const map = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ShiftLeft: 'dash', ShiftRight: 'dash',
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { this._jumpQueued = true; e.preventDefault(); return; }
      if (e.code === 'KeyZ' || e.code === 'ArrowDown') { this._specialQueued = true; return; }
      const a = map[e.code];
      if (a) { this._keyHeld[a] = true; this[a] = true; }
    });
    window.addEventListener('keyup', (e) => {
      const a = map[e.code];
      if (a) this._keyHeld[a] = false;
    });
  }
}
