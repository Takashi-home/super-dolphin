import { fetchAudio } from './Assets.js';

/**
 * SoundEngine — Web Audio API による手続き生成サウンド（音声ファイル不要）。
 * 最初の操作（スタートボタン）で ensureRunning() を呼んでから音を出すこと。
 * manifest.audio に "se_coin" などを列挙し public/assets/audio に置けば、その効果音を差し替える。
 */
// テーマ別BGM設定（root=基準周波数, scale=音度, tempo=ms/拍, wave=波形）
const BGM = {
  ocean: { root: 392, scale: [0, 2, 4, 7, 9], tempo: 190, wave: 'square', vol: 0.08 },   // 明るい長調ペンタ
  cave:  { root: 196, scale: [0, 3, 5, 7, 10], tempo: 245, wave: 'triangle', vol: 0.09 }, // 低く遅い短調風
  water: { root: 330, scale: [0, 2, 5, 7, 9], tempo: 260, wave: 'sine', vol: 0.09 },      // ふわっと遅い
  pipe:  { root: 262, scale: [0, 3, 6, 7, 10], tempo: 175, wave: 'square', vol: 0.07 },   // 怪しい
  sky:   { root: 523, scale: [0, 2, 4, 7, 9], tempo: 165, wave: 'triangle', vol: 0.07 },  // 高く軽快
  city:  { root: 330, scale: [0, 2, 3, 7, 8], tempo: 200, wave: 'sawtooth', vol: 0.07 },
};

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmTimer = null;
    this.beat = 0;
    this.bgm = BGM.ocean;
    this.samples = new Map();   // key -> AudioBuffer（差し替え音）
    this._samplesTried = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
  }

  ensureRunning() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this._loadSamples();
  }

  // manifest.audio に列挙された差し替え効果音を一度だけ読み込む（無ければ procedural）
  async _loadSamples() {
    if (this._samplesTried) return;
    this._samplesTried = true;
    const keys = ['se_jump', 'se_coin', 'se_stomp', 'se_break', 'se_powerup', 'se_oneup', 'se_clear', 'se_miss', 'se_spring'];
    for (const k of keys) {
      const buf = await fetchAudio(k);
      if (buf && this.ctx) { try { this.samples.set(k, await this.ctx.decodeAudioData(buf.slice(0))); } catch {} }
    }
  }

  // 差し替え音があれば再生して true。無ければ false（procedural にフォールバック）
  _play(key, vol = 0.6) {
    const buf = this.samples.get(key);
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.buffer = buf; src.connect(g); g.connect(this.master); src.start();
    return true;
  }

  // ── プリミティブ ────────────────────────────────────────
  beep(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur);
  }

  sweep(f1, f2, dur, type = 'square', vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur);
  }

  noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  // ── 効果音 ──────────────────────────────────────────────
  jump()    { if (this._play('se_jump')) return; this.sweep(420, 760, 0.18, 'square', 0.25); }
  dash()    { this.sweep(200, 120, 0.12, 'sawtooth', 0.15); }
  coin()    { if (this._play('se_coin')) return; this.beep(988, 0.08, 'square', 0.25); this.beep(1319, 0.12, 'square', 0.22, 0.07); }
  break()   { if (this._play('se_break')) return; this.noise(0.18, 0.3, 900); this.beep(160, 0.18, 'square', 0.2); }
  stomp()   { if (this._play('se_stomp')) return; this.sweep(300, 90, 0.15, 'square', 0.25); }
  special() { [523, 659, 880].forEach((f, i) => this.beep(f, 0.18, 'triangle', 0.2, i * 0.05)); }
  fire()    { this.sweep(900, 300, 0.16, 'sawtooth', 0.18); }
  powerup() { if (this._play('se_powerup')) return; [392, 523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.14, 'square', 0.22, i * 0.06)); }
  miss()    { if (this._play('se_miss')) return; this.sweep(440, 70, 0.7, 'sawtooth', 0.3); }
  spring()  { if (this._play('se_spring')) return; this.sweep(280, 1000, 0.14, 'sine', 0.28); } // ボヨンと跳ねる
  kick()    { this.sweep(520, 160, 0.1, 'square', 0.22); }                       // 甲羅キック
  bump()    { this.beep(180, 0.08, 'square', 0.22); }                            // ブロック頭突き
  pipe()    { this.sweep(700, 120, 0.3, 'square', 0.22); }                       // 土管に入る
  checkpoint() { [659, 988].forEach((f, i) => this.beep(f, 0.16, 'triangle', 0.25, i * 0.08)); }
  oneup()   { if (this._play('se_oneup')) return; [659, 784, 1047, 1319].forEach((f, i) => this.beep(f, 0.16, 'triangle', 0.28, i * 0.08)); }

  clear() {
    if (this._play('se_clear')) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.beep(f, 0.4, 'triangle', 0.25, i * 0.13));
  }

  // ── BGM（テーマ別の手続きループ）──────────────────────────
  startBGM(theme = 'ocean') {
    this.init(); this.ensureRunning();
    const next = BGM[theme] || BGM.ocean;
    // 同じテーマで既に鳴っていれば何もしない
    if (this.bgmTimer && this.bgm === next) return;
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgm = next;
    this.beat = 0;
    this.bgmTimer = setInterval(() => this._tick(), this.bgm.tempo);
  }

  stopBGM() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  _tick() {
    if (!this.ctx || !this.bgm) return;
    const t = this.ctx.currentTime;
    const b = this.bgm;
    // キック（表拍）
    if (this.beat % 4 === 0) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.12);
    }
    // ベース（2拍ごと・ルート）
    if (this.beat % 2 === 0) {
      const bd = b.scale[this.beat % 4 === 0 ? 0 : 2 % b.scale.length];
      this.beep((b.root / 2) * Math.pow(2, bd / 12), 0.2, 'triangle', 0.14);
    }
    // メロディ（テーマのスケールを気ままに）
    if (this.beat % 2 === 0 || Math.random() < 0.4) {
      const deg = b.scale[Math.floor(Math.random() * b.scale.length)];
      const oct = Math.random() < 0.3 ? 12 : 0;
      this.beep(b.root * Math.pow(2, (deg + oct) / 12), 0.16, b.wave, b.vol);
    }
    this.beat++;
  }
}
