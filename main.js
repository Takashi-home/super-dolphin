import { SoundEngine } from './src/modules/SoundEngine.js';
import { SceneManager } from './src/modules/SceneManager.js';
import { InputHub } from './src/modules/InputHub.js';
import { Level } from './src/modules/Level.js';
import { Player } from './src/modules/Player.js';
import { Hud } from './src/modules/Hud.js';
import { Particles } from './src/modules/Particles.js';
import { WorldMap } from './src/modules/WorldMap.js';
import { preloadAssets } from './src/modules/Assets.js';
import { LEVELS } from './src/data/levels.js';
import { CHARACTERS } from './src/data/characters.js';

const START_LIVES = 5;

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.scene = new SceneManager();
    this.input = new InputHub();
    this.player = new Player(this.sound);
    this.particles = new Particles();
    this.worldmap = new WorldMap(LEVELS.map((l) => ({ name: l.name.replace(/^\d+\.\s*/, ''), theme: l.theme })));
    this.level = null;
    this.levelIndex = 0;
    this.players = [];          // ロビーの参加者一覧（relayから）
    this.character = 'dolphin';
    this.state = 'LOBBY';
    this.cameraX = 0;
    this.cameraY = 0;
    this.startTime = 0;
    this.lives = START_LIVES;
    this.score = 0;
    this.coins = 0;             // 1UP用の通算コイン（100で残機+1）
    this._lastLevelCoins = 0;
    this._gameover = false;
    this._checkpoint = null;    // { index, x, y } 到達した中間地点
    this.devMode = false;       // 開発者モード：全ステージ開放
    preloadAssets();            // 任意のPNG/音声を非同期ロード（無ければプロシージャル）

    this.hud = new Hud({
      onStart: () => this.start(),
      onSelectCharacter: (key) => this.selectCharacter(key),
      onReset: () => this._onResultButton(),
      onToggleDev: (on) => this.setDevMode(on),
    });

    this._resize();
    window.addEventListener('resize', () => this._resize());
    // 開発者モードのショートカット（バッククォート/Dキーでトグル）
    this._dbg = false;          // 入力デバッグ表示（I キーでトグル）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || (e.code === 'KeyG' && e.shiftKey)) this.setDevMode(!this.devMode);
      if (e.code === 'KeyI') this._dbg = !this._dbg;
    });
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
          this.input.applyRemote(msg.id, msg.action, msg.state);
        } else if (msg.type === 'roster') {
          this.players = msg.players || [];
          this.hud.updateRoster(this.players);
          if (this.state === 'PLAYING') this.hud._renderLegend(this.players, this.character);
        }
        // ゲーム進行は大画面（ホスト）が直接制御する（gamestate はスマホ向け通知）
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

  // ロビーの「スタート」: relay に役割割当を依頼してワールドマップへ
  start() {
    this.sound.ensureRunning();
    this.lives = START_LIVES;
    this.score = 0;
    this.coins = 0;
    this._checkpoint = null;
    this.player.tier = 0;       // 新規スタートは進化リセット
    this.worldmap.reset();
    fetch('/api/ctrl/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: this.character }),
    }).catch(() => {});
    this._toMap();
  }

  // 開発者モード：全ステージ開放（クリア不要でどこでも選べる）
  setDevMode(on) {
    this.devMode = on;
    this.worldmap.dev = on;
    this.hud.setDev(on);
  }

  _toMap() {
    this.state = 'MAP';
    this.level = null;
    this.sound.stopBGM();
    this.hud.showMap();
  }

  // リザルト画面のボタン
  _onResultButton() {
    if (this._gameover) {           // ゲームオーバー → 残機リセットしてマップへ
      this._gameover = false;
      this.lives = START_LIVES;
      this.score = 0; this.coins = 0;
      this.player.tier = 0;          // ゲームオーバーで進化リセット
      this.worldmap.reset();
    }
    this._toMap();                  // クリア後もマップへ（次が解放済み）
  }

  _updateMap() {
    this.input.tick();
    if (this.worldmap.update(this.input) === 'enter') {
      this.levelIndex = this.worldmap.selected;
      this._checkpoint = null;
      this.beginPlay(true);   // 進化状態（パワー/ファイア）を次ステージへ引き継ぐ
    }
  }

  beginPlay(keepPower = false) {
    this.level = new Level(LEVELS[this.levelIndex]);
    let spawn = this.level.spawn;
    if (this._checkpoint && this._checkpoint.index === this.levelIndex) {
      spawn = { x: this._checkpoint.x, y: this._checkpoint.y };
      const cp = this.level.checkpoints.find((c) => Math.abs(c.x - spawn.x) < 1);
      if (cp) cp.hit = true;
      this.level.activeCheckpoint = { x: spawn.x, y: spawn.y };
    }
    this.player.reset(spawn, keepPower);
    this.input.reset();
    this.particles.clear();
    this._lastLevelCoins = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.startTime = performance.now();
    this.state = 'PLAYING';
    // 背景・BGM はステージのテーマで切り替える（無ければキャラのテーマ）
    const theme = this.level.theme || CHARACTERS[this.character].theme;
    this.scene.setTheme(theme);
    this.sound.startBGM(theme);
    this.hud.showPlaying(this.players, this.character, {
      name: this.level.name, index: this.levelIndex + 1, total: LEVELS.length,
    });
  }

  _win() {
    this.state = 'RESULT';
    this.sound.stopBGM();
    this.sound.clear();
    for (let i = 0; i < 6; i++) {
      this.particles.firework(this.cameraX + this.W * (0.2 + Math.random() * 0.6), this.cameraY + this.H * (0.2 + Math.random() * 0.4));
    }
    const seconds = (performance.now() - this.startTime) / 1000;
    const last = this.levelIndex >= LEVELS.length - 1;
    this.worldmap.clearStage(this.levelIndex);
    this.score += 1000 + Math.max(0, Math.round(200 - seconds)) * 10; // クリア＋タイムボーナス
    this._gameover = false;
    this.hud.showResult(last ? 'allclear' : 'next', this._stats(seconds), {
      index: this.levelIndex + 1, total: LEVELS.length,
      nextName: last ? null : LEVELS[this.levelIndex + 1].name,
    });
  }

  // ミス：残機を1減らし、残っていれば中間地点から復帰、尽きたらゲームオーバー
  _startDeath() {
    this.state = 'DEATH';
    this._deathTimer = 70;
    this.lives = Math.max(0, this.lives - 1);
    this.player.vy = -13; this.player.vx = 0; this.player.anim = 'fall';
    this.sound.stopBGM();
  }

  _updateDeath() {
    this._deathTimer--;
    this.player.vy += 0.7;
    this.player.y += this.player.vy;
    this.player.animPhase += 0.2;
    this.particles.update();
    if (this._deathTimer <= 0) {
      if (this.lives <= 0) this._gameOver();
      else this.beginPlay(false);   // 中間地点（あれば）から復帰
    }
  }

  _gameOver() {
    this.state = 'RESULT';
    this._gameover = true;
    this.sound.stopBGM();
    this.hud.showResult('gameover', this._stats(0), { index: this.levelIndex + 1, total: LEVELS.length });
  }

  _stats(seconds = 0) {
    return { coins: this.level ? this.level.coinCount : 0, score: this.score, lives: this.lives, seconds };
  }

  _loop() {
    if (this.state === 'PLAYING') this._update();
    else if (this.state === 'CLEAR_SEQ') this._updateClear();
    else if (this.state === 'MAP') this._updateMap();
    else if (this.state === 'DEATH') this._updateDeath();
    else this.particles.update();   // リザルト中も花火などを動かす
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  // 旗ざおクリア演出：ポールに掴まって滑り降りる→花火→リザルト
  _startClear() {
    this.state = 'CLEAR_SEQ';
    this._clearTimer = 70;
    const T = this.level.tile;
    this.player.x = this.level.goal.x + T / 2 - this.player.w / 2;
    this.player.vx = 0; this.player.vy = 0;
    this.player.anim = 'idle';
    this.sound.stopBGM();
    this.sound.clear();
  }

  _updateClear() {
    this._clearTimer--;
    const groundTopY = this.level.goal.y + this.level.tile - this.player.h;
    if (this.player.y < groundTopY) this.player.y = Math.min(groundTopY, this.player.y + 5); // ポールを滑り降りる
    else if (this.player.facing > 0) { this.player.x += 1.5; this.player.anim = 'run'; this.player.animPhase += 0.2; }
    if (this._clearTimer % 5 === 0) this.particles.sparkle(this.player.x + this.player.w / 2, this.player.y, '#ffd54f');
    this.particles.update();
    if (this._clearTimer <= 0) this._win();
  }

  _update() {
    const char = CHARACTERS[this.character];
    this.input.tick();   // 入力の有効期限を更新（フリーズ防止）
    this.level.update(this.player, this.particles);
    const ev = this.player.update(this.level, this.input, char, this.particles);
    this.particles.update();
    if (this.level.activeCheckpoint) {
      this._checkpoint = { index: this.levelIndex, x: this.level.activeCheckpoint.x, y: this.level.activeCheckpoint.y };
    }

    // コイン→スコア、通算100枚で1UP
    if (this.level.coinCount > this._lastLevelCoins) {
      const d = this.level.coinCount - this._lastLevelCoins;
      this._lastLevelCoins = this.level.coinCount;
      this.coins += d; this.score += d * 100;
      while (this.coins >= 100) {
        this.coins -= 100; this.lives++;
        this.particles.popText(this.player.x + this.player.w / 2, this.player.y - 20, '1UP', '#69f0ae');
        this.sound.oneup();
      }
    }

    // カメラ：進行方向を先読みしつつ、縦はデッドゾーンで追従（スムージング）
    const look = this.player.facing * 90 + this.player.vx * 14;
    const tx = this.player.x + this.player.w / 2 - this.W / 2 + look;
    const clampedX = Math.max(0, Math.min(this.level.width - this.W, tx));
    this.cameraX += (clampedX - this.cameraX) * 0.12;
    if (this.level.width < this.W) this.cameraX = 0;

    const pcy = this.player.y + this.player.h / 2;
    const dead = this.H * 0.18;
    const center = this.H * 0.52;
    let ty = this.cameraY;
    if (pcy - this.cameraY > center + dead) ty = pcy - center - dead;
    else if (pcy - this.cameraY < center - dead) ty = pcy - center + dead;
    const maxY = this.level.height - this.H;
    ty = Math.max(0, Math.min(maxY > 0 ? maxY : 0, ty));
    this.cameraY += (ty - this.cameraY) * 0.1;

    this.hud.updateStats({ coins: this.coins, score: this.score, lives: this.lives, tier: this.player.tier });

    if (ev === 'goal') this._startClear();
    else if (ev === 'dead') this._startDeath();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.state === 'MAP') { this.worldmap.draw(ctx, this.W, this.H, { lives: this.lives, score: this.score }, this.character); return; }
    this.scene.draw(ctx, this.cameraX, this.W, this.H);
    if (this.level && (this.state === 'PLAYING' || this.state === 'RESULT' || this.state === 'CLEAR_SEQ' || this.state === 'DEATH')) {
      ctx.save();
      ctx.translate(0, -this.cameraY);                 // 縦スクロール
      this.level.draw(ctx, this.cameraX, this.W, this.H + this.cameraY);
      this.particles.draw(ctx, this.cameraX);
      this.player.draw(ctx, this.cameraX, CHARACTERS[this.character]);
      ctx.restore();
    }
    if (this._dbg) this._drawInputDebug(ctx);
  }

  // 入力デバッグ：どの端末から何が届いているかを実時間表示（I キーでトグル）
  // 「左右移動とジャンプを別端末で同時操作」したとき、両方の入力が画面に
  // 来ているかを確認する用。来ていれば緑、来ていなければ原因は送信側（センサー/通信）。
  _drawInputDebug(ctx) {
    const now = performance.now();
    const i = this.input;
    const fresh = (t, ms = 300) => now - t < ms;
    const lines = [
      `INPUT DEBUG (I で消す)  players:${this.players.length}`,
      `left:${i.left ? '●' : '·'}  right:${i.right ? '●' : '·'}  dash:${i.dash ? '●' : '·'}` +
        `  jump:${fresh(i.dbg.lastJump) ? '●' : '·'}  special:${fresh(i.dbg.lastSpecial) ? '●' : '·'}`,
      '— 端末ごとの最終入力 —',
    ];
    for (const [id, d] of i.dbg.byId) {
      lines.push(`${id}: ${d.action} ${d.state}  (${Math.round(now - d.t)}ms前)`);
    }
    ctx.save();
    ctx.font = '14px monospace';
    const w = 360, h = 18 * lines.length + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(10, 10, w, h);
    ctx.textBaseline = 'top';
    lines.forEach((t, idx) => {
      ctx.fillStyle = idx <= 1 ? '#9be7ff' : '#cfe';
      ctx.fillText(t, 20, 18 + idx * 18);
    });
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => { window._game = new Game(); });
