import { SoundEngine } from './src/modules/SoundEngine.js';
import { SceneManager } from './src/modules/SceneManager.js';
import { InputHub } from './src/modules/InputHub.js';
import { Level } from './src/modules/Level.js';
import { Player } from './src/modules/Player.js';
import { Hud } from './src/modules/Hud.js';
import { LEVELS } from './src/data/levels.js';
import { CHARACTERS } from './src/data/characters.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.scene = new SceneManager();
    this.input = new InputHub();
    this.player = new Player(this.sound);
    this.level = null;
    this.players = [];          // ロビーの参加者一覧（relayから）
    this.character = 'dolphin';
    this.state = 'LOBBY';
    this.cameraX = 0;
    this.startTime = 0;

    this.hud = new Hud({
      onStart: () => this.start(),
      onSelectCharacter: (key) => this.selectCharacter(key),
      onReset: () => this.beginPlay(),
    });

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.selectCharacter('dolphin');
    this.hud.showLobby();
    this._connect();
    requestAnimationFrame(() => this._loop());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _connect() {
    try {
      const es = new EventSource('/api/ctrl/stream');
      es.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === 'input') {
          this.input.applyRemote(msg.action, msg.state);
        } else if (msg.type === 'roster') {
          this.players = msg.players || [];
          this.hud.updateRoster(this.players);
          if (this.state === 'PLAYING') this.hud._renderLegend(this.players, this.character);
        } else if (msg.type === 'gamestate' && msg.state === 'PLAYING') {
          if (this.state !== 'PLAYING') this.beginPlay();
        }
      };
      es.onerror = () => {/* dev サーバ再起動時など。自動再接続に任せる */};
      this.es = es;
    } catch {
      // EventSource 非対応環境（キーボードのみで遊ぶ）
    }
  }

  selectCharacter(key) {
    if (!CHARACTERS[key]) return;
    this.character = key;
    this.hud.selectCharacter(key);
    this.scene.setTheme(CHARACTERS[key].theme);
    this.sound.ensureRunning();
  }

  // ロビーの「スタート」: relay に役割割当を依頼してから開始
  start() {
    this.sound.ensureRunning();
    fetch('/api/ctrl/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: this.character }),
    }).catch(() => {});
    this.beginPlay(); // relay が無くてもキーボードで遊べるよう即開始
  }

  beginPlay() {
    this.level = new Level(LEVELS[0]);
    this.player.reset(this.level.spawn);
    this.input.reset();
    this.cameraX = 0;
    this.startTime = performance.now();
    this.state = 'PLAYING';
    this.scene.setTheme(CHARACTERS[this.character].theme);
    this.sound.startBGM();
    this.hud.showPlaying(this.players, this.character);
  }

  _win() {
    this.state = 'RESULT';
    this.sound.stopBGM();
    this.sound.clear();
    this.hud.showResult('clear', this._stats());
  }

  _lose() {
    this.state = 'RESULT';
    this.sound.stopBGM();
    this.hud.showResult('gameover', this._stats());
  }

  _stats() {
    const coins = this.level.coins.filter((c) => c.taken).length;
    return { coins, total: this.level.coinsTotal, seconds: (performance.now() - this.startTime) / 1000 };
  }

  _loop() {
    if (this.state === 'PLAYING') this._update();
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    const char = CHARACTERS[this.character];
    this.level.update();
    const ev = this.player.update(this.level, this.input, char);

    const target = this.player.x + this.player.w / 2 - this.W / 2;
    this.cameraX = Math.max(0, Math.min(this.level.width - this.W, target));
    if (this.level.width < this.W) this.cameraX = 0;

    const st = this._stats();
    this.hud.updateStats(st.coins, st.total, st.seconds);

    if (ev === 'goal') this._win();
    else if (ev === 'dead') this._lose();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    this.scene.draw(ctx, this.cameraX, this.W, this.H);
    if (this.level && (this.state === 'PLAYING' || this.state === 'RESULT')) {
      this.level.draw(ctx, this.cameraX, this.W, this.H);
      this.player.draw(ctx, this.cameraX, CHARACTERS[this.character]);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => { window._game = new Game(); });
