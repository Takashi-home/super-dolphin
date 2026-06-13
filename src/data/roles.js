// 人数(2〜5)→役割割当プラン。vite.config.js の assignRoles と必ず一致させること。
export const ROLE_PLANS = {
  2: ['MOVE', 'ACTION'],
  3: ['LEFT', 'RIGHT', 'JUMP'],
  4: ['LEFT', 'RIGHT', 'JUMP', 'DASH'],
  5: ['LEFT', 'RIGHT', 'JUMP', 'DASH', 'SPECIAL'],
};

// 役割ごとの表示情報と、コントローラーが有効化すべき検知方式。
// detectors: コントローラーで使うセンサー検知（tilt / shakeUp / shake / flickDown）
// actions:   この役割が送信しうる action 名
export const ROLE_INFO = {
  LEFT: {
    label: '左に進む', icon: '⬅️', color: '#1a6fff',
    instr: '端末を左にかたむけ続ける', detectors: ['tiltLeft'], actions: ['left'],
  },
  RIGHT: {
    label: '右に進む', icon: '➡️', color: '#ff3b3b',
    instr: '端末を右にかたむけ続ける', detectors: ['tiltRight'], actions: ['right'],
  },
  MOVE: {
    label: '左右の移動', icon: '↔️', color: '#7c4dff',
    instr: 'かたむけた方向に進む（左／右）', detectors: ['tiltBoth'], actions: ['left', 'right'],
  },
  JUMP: {
    label: 'ジャンプ', icon: '⬆️', color: '#00c853',
    instr: '上にシュッと振る（走りながら連続で跳ぶと3段ジャンプ！）', detectors: ['shakeUp'], actions: ['jump'],
  },
  DASH: {
    label: 'ダッシュ', icon: '💨', color: '#ff9100',
    instr: '端末を細かく振り続ける', detectors: ['shake'], actions: ['dash'],
  },
  ACTION: {
    label: 'ジャンプ＆ダッシュ', icon: '✨', color: '#00bfa5',
    instr: '上に振る＝ジャンプ／振り続ける＝ダッシュ', detectors: ['shakeUp', 'shake'], actions: ['jump', 'dash'],
  },
  SPECIAL: {
    label: 'ひっさつ技', icon: '🌟', color: '#ffd600',
    instr: '下にガッと振る（🔥ファイア時はファイアボール発射！）', detectors: ['flickDown'], actions: ['special'],
  },
};
