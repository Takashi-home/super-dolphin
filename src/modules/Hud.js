import { ROLE_INFO } from '../data/roles.js';
import { CHARACTERS } from '../data/characters.js';
import { TIERS } from './Player.js';

/**
 * Hud — DOM オーバーレイ（ロビー／ゲーム中HUD／リザルト）の管理。
 * index.html の要素を id で参照する。コールバックは constructor で受け取る。
 */
export class Hud {
  constructor({ onStart, onSelectCharacter, onReset, onToggleDev }) {
    this.$ = (id) => document.getElementById(id);
    this.lobby = this.$('lobby');
    this.hud = this.$('hud');
    this.result = this.$('result');
    this.roster = this.$('roster');
    this.coinsEl = this.$('coins');
    this.scoreEl = this.$('score');
    this.livesEl = this.$('lives');
    this.stageEl = this.$('stage');
    this.powerEl = this.$('power');
    this.coinsVal = this.coinsEl?.querySelector('.val');
    this.scoreVal = this.scoreEl?.querySelector('.val');
    this.livesVal = this.livesEl?.querySelector('.val');
    this.livesIc = this.livesEl?.querySelector('.ic');
    this.powerVal = this.powerEl?.querySelector('.val');
    this.powerIc = this.powerEl?.querySelector('.ic');
    this.legend = this.$('role-legend');
    this.connectUrl = this.$('connect-url');
    this.startBtn = this.$('start-btn');

    this.startBtn.addEventListener('click', () => onStart());
    this.$('retry-btn').addEventListener('click', () => onReset());
    this.devCheck = this.$('dev-check');
    if (this.devCheck && onToggleDev) this.devCheck.addEventListener('change', () => onToggleDev(this.devCheck.checked));

    this.charButtons = [...document.querySelectorAll('[data-char]')];
    this.charButtons.forEach((b) =>
      b.addEventListener('click', () => onSelectCharacter(b.dataset.char)));

    // 接続URL（同じWi-Fiのスマホ用）
    const url = `${location.origin}${location.pathname.replace(/index\.html$/, '')}controller.html`;
    this.connectUrl.textContent = url.replace(/\/\//g, '//').replace(/([^:])\/\//g, '$1/');
  }

  setDev(on) { if (this.devCheck) this.devCheck.checked = on; }

  selectCharacter(key) {
    this.charButtons.forEach((b) => b.classList.toggle('selected', b.dataset.char === key));
  }

  updateRoster(players) {
    if (!players.length) {
      this.roster.innerHTML = '<li class="empty">スマホでアクセスして参加してね…</li>';
    } else {
      this.roster.innerHTML = players
        .map((p) => {
          const info = p.role ? ROLE_INFO[p.role] : null;
          const tag = info ? `<span class="role-tag" style="background:${info.color}">${info.icon} ${info.label}</span>` : '<span class="role-tag wait">待機中</span>';
          return `<li><span class="pname">${this._esc(p.name)}</span>${tag}</li>`;
        })
        .join('');
    }
    this.startBtn.textContent = players.length >= 2
      ? `スタート！ (${players.length}人)`
      : `スタート（スマホ${players.length}台 / キーボードでも可）`;
  }

  showLobby() {
    this.lobby.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.result.classList.add('hidden');
  }

  // ワールドマップ表示中は DOM オーバーレイを全て隠す（マップは canvas 描画）
  showMap() {
    this.lobby.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.result.classList.add('hidden');
  }

  showPlaying(players, charKey, stage) {
    this.lobby.classList.add('hidden');
    this.result.classList.add('hidden');
    this.hud.classList.remove('hidden');
    if (stage && this.stageEl) this.stageEl.textContent = `STAGE ${stage.index}/${stage.total}　${stage.name.replace(/^\d+\.\s*/, '')}`;
    if (this.livesIc && CHARACTERS[charKey]) this.livesIc.textContent = CHARACTERS[charKey].emoji;
    this._renderLegend(players, charKey);
  }

  _renderLegend(players, charKey) {
    const ch = CHARACTERS[charKey];
    const roles = players.filter((p) => p.role);
    let html = `<div class="legend-char">${ch.emoji} ${ch.name}</div>`;
    if (roles.length) {
      html += roles
        .map((p) => {
          const info = ROLE_INFO[p.role];
          return `<div class="legend-item" style="border-color:${info.color}">
            <span class="li-icon">${info.icon}</span>
            <span class="li-text"><b>${this._esc(p.name)}</b>${info.label}</span></div>`;
        })
        .join('');
    } else {
      html += '<div class="legend-item">キーボード操作中：←→ 移動 / Space ジャンプ / Shift ダッシュ / Z 必殺</div>';
    }
    this.legend.innerHTML = html;
  }

  updateStats({ coins = 0, score = 0, lives = 0, tier = 0 }) {
    if (this.coinsVal) this.coinsVal.textContent = `${coins}`;
    if (this.scoreVal) this.scoreVal.textContent = `${score}`;
    if (this.livesVal) this.livesVal.textContent = `×${lives}`;
    if (this.powerVal) {
      const t = TIERS[tier] || TIERS[0];
      this.powerVal.textContent = t.name;
      this.powerIc.textContent = tier === 0 ? '○' : tier === 1 ? '🍄' : '🔥';
      this.powerEl.classList.toggle('t1', tier === 1);
      this.powerEl.classList.toggle('t2', tier === 2);
    }
  }

  showResult(kind, { coins = 0, score = 0, lives = 0 } = {}, info = {}) {
    this.hud.classList.add('hidden');
    this.result.classList.remove('hidden');
    const title = this.$('result-title');
    const desc = this.$('result-desc');
    if (kind === 'next') {
      title.textContent = '🏁 ステージクリア！';
      title.className = 'clear';
      desc.textContent = `コイン ${coins}枚 ／ スコア ${score} ／ 残機 ×${lives}　つぎは「${(info.nextName || '').replace(/^\d+\.\s*/, '')}」！`;
      this.$('retry-btn').textContent = 'ワールドマップへ →';
    } else if (kind === 'allclear') {
      title.textContent = '🎉 ぜんステージ クリア！';
      title.className = 'clear';
      desc.textContent = `${info.total}ステージ制覇！ 最終スコア ${score}　みんなナイス連携！`;
      this.$('retry-btn').textContent = 'ワールドマップへ →';
    } else {
      title.textContent = '💥 ゲームオーバー';
      title.className = 'gameover';
      desc.textContent = `スコア ${score}　残機が尽きた… もう一度ワールドマップから！`;
      this.$('retry-btn').textContent = 'ワールドマップへ';
    }
  }

  _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
}
