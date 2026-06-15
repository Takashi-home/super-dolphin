// プレイヤーキャラクター定義。スプライト画像は未用意なので絵文字＋図形で描画する。
// public/assets/ に画像を置けば spriteUrl を足して差し替え可能（Player.js 側で対応）。
export const CHARACTERS = {
  dolphin: {
    key: 'dolphin',
    name: 'イルカ', emoji: '🐬', color: '#4fc3f7', accent: '#b3e5fc',
    speed: 4.4, jump: 16, gravity: 0.72,
    special: 'doublejump',   // 空中でもう一度ジャンプ
    specialLabel: '2段ジャンプ',
    theme: 'ocean',
  },
  orca: {
    key: 'orca',
    name: 'シャチ', emoji: '🐳', color: '#26323a', accent: '#eceff1',
    speed: 4.0, jump: 14.5, gravity: 0.82,
    special: 'smash',        // 真下に急降下してブロックを破壊
    specialLabel: 'ヒップドロップ',
    theme: 'ocean',
  },
  tetsujin: {
    key: 'tetsujin',
    name: '鉄人28号', emoji: '🤖', color: '#90a4ae', accent: '#ffca28',
    speed: 3.8, jump: 13.5, gravity: 0.80,
    special: 'hover',        // 短時間ふわっと滞空（ロケット）
    specialLabel: 'ロケットホバー',
    theme: 'city',
  },
};

export const CHARACTER_ORDER = ['dolphin', 'orca', 'tetsujin'];
