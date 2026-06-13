/**
 * InputHub — スマホ（SSE経由）とキーボード（開発用fallback）の入力を統合する。
 *
 *  - left / right / dash : 押し続け（boolean）。複数プレイヤーが同じ action を担当しても OR で合成。
 *  - jump / special      : 単発（edgeトリガ）。consumeJump()/consumeSpecial() で1回だけ取り出す。
 *
 * Game は SSE の {type:'input', action, state} を applyRemote() に渡す。
 */
export class InputHub {
  constructor() {
    this.left = false;
    this.right = false;
    this.dash = false;
    this._jumpQueued = false;
    this._specialQueued = false;

    // action ごとに「downしているソース数」を数え、複数担当でも破綻しないようにする
    this._holdCount = { left: 0, right: 0, dash: 0 };
    this._keyHeld = { left: false, right: false, dash: false };

    this._bindKeyboard();
  }

  // SSE からの入力を反映
  applyRemote(action, state) {
    if (action === 'jump') { if (state !== 'up') this._jumpQueued = true; return; }
    if (action === 'special') { if (state !== 'up') this._specialQueued = true; return; }
    // 押し続け系
    if (!(action in this._holdCount)) return;
    if (state === 'down') this._holdCount[action]++;
    else if (state === 'up') this._holdCount[action] = Math.max(0, this._holdCount[action] - 1);
    else if (state === 'tap') { // タップは短く ON にする
      this._holdCount[action]++;
      setTimeout(() => { this._holdCount[action] = Math.max(0, this._holdCount[action] - 1); this._sync(); }, 140);
    }
    this._sync();
  }

  _sync() {
    this.left = this._holdCount.left > 0 || this._keyHeld.left;
    this.right = this._holdCount.right > 0 || this._keyHeld.right;
    this.dash = this._holdCount.dash > 0 || this._keyHeld.dash;
  }

  consumeJump() { const v = this._jumpQueued; this._jumpQueued = false; return v; }
  consumeSpecial() { const v = this._specialQueued; this._specialQueued = false; return v; }

  reset() {
    this._holdCount = { left: 0, right: 0, dash: 0 };
    this._jumpQueued = this._specialQueued = false;
    this._sync();
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
      if (a) { this._keyHeld[a] = true; this._sync(); }
    });
    window.addEventListener('keyup', (e) => {
      const a = map[e.code];
      if (a) { this._keyHeld[a] = false; this._sync(); }
    });
  }
}
