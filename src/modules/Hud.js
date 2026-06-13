import { ROLE_INFO } from '../data/roles.js';
import { CHARACTERS } from '../data/characters.js';

/**
 * Hud — DOM オーバーレイ（ロビー／ゲーム中HUD／リザルト）の管理。
 * index.html の要素を id で参照する。コールバックは constructor で受け取る。
 */
export class Hud {
  constructor({ onStart, onSelectCharacter, onReset }) {
    this.$ = (id) => document.getElementById(id);
    this.lobby = this.$('lobby');
    this.hud = this.$('hud');
    this.result = this.$('result');
    this.roster = this.$('roster');
    this.coinsEl = this.$('coins');
    this.timerEl = this.$('timer');
    this.legend = this.$('role-legend');
    this.connectUrl = this.$('connect-url');
    this.startBtn = this.$('start-btn');

    this.startBtn.addEventListener('click', () => onStart());
    this.$('retry-btn').addEventListener('click', () => onReset());

    this.charButtons = [...document.querySelectorAll('[data-char]')];
    this.charButtons.forEach((b) =>
      b.addEventListener('click', () => onSelectCharacter(b.dataset.char)));

    // 接続URL（同じWi-Fiのスマホ用）
    const url = `${location.origin}${location.pathname.replace(/index\.html$/, '')}controller.html`;
    this.connectUrl.textContent = url.replace(/\/\//g, '//').replace(/([^:])\/\//g, '$1/');
  }

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

  showPlaying(players, charKey) {
    this.lobby.classList.add('hidden');
    this.result.classList.add('hidden');
    this.hud.classList.remove('hidden');
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

  updateStats(coins, total, seconds) {
    this.coinsEl.textContent = `🪙 ${coins}/${total}`;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timerEl.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
  }

  showResult(kind, { coins, total, seconds }) {
    this.hud.classList.add('hidden');
    this.result.classList.remove('hidden');
    const title = this.$('result-title');
    const desc = this.$('result-desc');
    if (kind === 'clear') {
      title.textContent = '🏁 ステージクリア！';
      title.className = 'clear';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      desc.textContent = `タイム ${m}:${String(s).padStart(2, '0')} ／ コイン ${coins}/${total}　みんなナイス連携！`;
    } else {
      title.textContent = '💥 ミス…！';
      title.className = 'gameover';
      desc.textContent = 'もう一度、息を合わせて挑戦しよう！';
    }
  }

  _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
}
