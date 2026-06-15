/**
 * Assets — 任意の差し替え用アセット（PNGスプライト/音声）を読み込む。
 * `public/assets/manifest.json` の "images"/"audio" に列挙したものだけ取得し、
 * 無ければ各描画/音はプロシージャル（手描き風 Canvas / Web Audio 合成）にフォールバックする。
 * （既定の manifest は空なので追加素材ゼロで動き、コンソールも汚さない）
 *
 * 本物のドット絵を使うには:
 *   1) public/assets/sprites/dolphin.png などを置く
 *   2) manifest.json の "images" に "sprites/dolphin" を追記
 * 命名例: sprites/{dolphin,orca,tetsujin,goomba,koopa,piranha,items}, tiles/{ocean,cave,...}
 */
const BASE = './assets/';

const images = new Map();   // key -> HTMLImageElement
const audio = new Map();    // key -> ArrayBuffer | null
let manifest = { images: [], audio: [] };
let ready = false;

function loadImage(key) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(key, img); resolve(); };
    img.onerror = () => resolve(); // 無ければ無視（procedural）
    img.src = `${BASE}${key}.png`;
  });
}

/** manifest を読み、列挙された任意アセットを読み込む。 */
export async function preloadAssets() {
  if (ready) return;
  try {
    const res = await fetch(`${BASE}manifest.json`);
    if (res.ok) manifest = await res.json();
  } catch { /* manifest 無し → 全てプロシージャル */ }
  const imgs = Array.isArray(manifest.images) ? manifest.images : [];
  await Promise.all(imgs.map(loadImage));
  ready = true;
}

/** 画像を返す（無ければ null）。例: getImage('sprites/dolphin') */
export function getImage(key) { return images.get(key) || null; }

/** 音声 ArrayBuffer を任意取得（manifest.audio に列挙されたもののみ／無ければ null）。 */
export async function fetchAudio(key, exts = ['ogg', 'mp3', 'wav']) {
  if (audio.has(key)) return audio.get(key);
  const list = Array.isArray(manifest.audio) ? manifest.audio : [];
  if (!list.includes(key)) { audio.set(key, null); return null; }
  for (const ext of exts) {
    try {
      const res = await fetch(`${BASE}audio/${key}.${ext}`);
      if (res.ok) { const buf = await res.arrayBuffer(); audio.set(key, buf); return buf; }
    } catch { /* try next */ }
  }
  audio.set(key, null);
  return null;
}

export function assetsReady() { return ready; }
