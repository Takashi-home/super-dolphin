/**
 * SoundEngine — Web Audio API による手続き生成サウンド（音声ファイル不要）。
 * torokko の SoundEngine を横スクロールアクション向けに整理したもの。
 * 最初の操作（スタートボタン）で ensureRunning() を呼んでから音を出すこと。
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmTimer = null;
    this.beat = 0;
    this.scale = [0, 2, 4, 7, 9]; // ペンタトニック
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
  jump()    { this.sweep(420, 760, 0.18, 'square', 0.25); }
  dash()    { this.sweep(200, 120, 0.12, 'sawtooth', 0.15); }
  coin()    { this.beep(988, 0.08, 'square', 0.25); this.beep(1319, 0.12, 'square', 0.22, 0.07); }
  break()   { this.noise(0.18, 0.3, 900); this.beep(160, 0.18, 'square', 0.2); }
  stomp()   { this.sweep(300, 90, 0.15, 'square', 0.25); }
  special() { [523, 659, 880].forEach((f, i) => this.beep(f, 0.18, 'triangle', 0.2, i * 0.05)); }
  fire()    { this.sweep(900, 300, 0.16, 'sawtooth', 0.18); }
  powerup() { [392, 523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.14, 'square', 0.22, i * 0.06)); }
  miss()    { this.sweep(440, 70, 0.7, 'sawtooth', 0.3); }

  clear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.beep(f, 0.4, 'triangle', 0.25, i * 0.13));
  }

  // ── BGM（軽い手続きループ）────────────────────────────────
  startBGM() {
    this.init(); this.ensureRunning();
    if (this.bgmTimer) return;
    this.beat = 0;
    this.bgmTimer = setInterval(() => this._tick(), 200); // ~150BPM 八分
  }

  stopBGM() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  _tick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // キック
    if (this.beat % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.12);
    }
    // メロディ（ペンタトニックを気ままに）
    if (this.beat % 2 === 0 || Math.random() < 0.4) {
      const deg = this.scale[Math.floor(Math.random() * this.scale.length)];
      const oct = Math.random() < 0.3 ? 12 : 0;
      const freq = 392 * Math.pow(2, (deg + oct) / 12);
      this.beep(freq, 0.16, 'square', 0.08);
    }
    this.beat++;
  }
}
