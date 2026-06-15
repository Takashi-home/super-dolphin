# 🐬 スーパードルフィン

みんなのスマホが「1つのコマンド」になる、協力型の横スクロールアクション。
大画面に映る **1体のキャラ（いるか / シャチ / 鉄人28号）** を、参加者がそれぞれ別の操作（左・右・ジャンプ・ダッシュ・必殺）を分担して動かし、息を合わせて **全5ステージ** のゴールを目指します。
スマホは **傾き（移動）と加速度の振り（ジャンプ等）** でコマンドを送ります。

> torokko の controller-relay（SSE 中継）を、複数プレイヤー・複数コマンド対応に拡張しています。中継は共通モジュール（`src/server/relay.js`）にまとめ、開発サーバ（Vite）と本番サーバ（`server.js`）の両方で使います。

## あそびの要素

- **全9ステージ（背景もそれぞれ違う／後半ほど長く難しい）**：
  1. なみのりビーチ（海） 2. どうくつケーブ（洞窟） 3. すいちゅうダイブ（水中） 4. どかんパイプ（土管）
  5. そらのかいどう（空） 6. ヒートシティ（街） 7. ふかいどうくつ（深い洞窟） 8. だいかいえんダイブ（大海）
  9. ラストフォートレス（最終・最長）

  前半5つは手作りのギミック見本、**後半4つは [_gen.mjs](_gen.mjs) が自動生成した長く難しいコース**（穴・敵・トゲ・ブロック・土管・バネ・動く床・中間地点が多数）。**ワールドマップ**でステージを選び（左右で選択・ジャンプで決定）、クリアで次が解放。背景もBGMも各ステージの `theme`（[src/data/levels.js](src/data/levels.js)）で切り替わります。
- **手描き風アニメ**：キャラは待機の上下動・走りサイクル・ジャンプ/着地のスクワッシュ&ストレッチ、土ぼこり/破片/キラ/花火などのパーティクル付き（[Sprites.js](src/modules/Sprites.js) / [Particles.js](src/modules/Particles.js)）。タイルは草/岩/メタルの縁取りオートタイル（[TileRenderer.js](src/modules/TileRenderer.js)）。
- **走りジャンプ＆3段ジャンプ**：移動とジャンプは同時に効きます。着地直後に走った勢いのまま続けて跳ぶと、2段・3段とジャンプが高くなります（マリオ風）。先行入力・コヨーテタイムでジャンプ不発も解消。
- **？ブロック・レンガ**：下から頭突きで **？ブロック**からアイテム、**レンガ**からコイン（進化中はレンガ破壊）。
- **進化（パワーアップ）**：🍄/フラワーで `ノーマル → パワー → ファイア`。**パワー**は頭でブロックを壊せて被弾を1回耐え、**ファイア**は必殺でファイアボール。被弾で1段階もどる（ノーマルで被弾＝ミス）。
- **敵バリエーション**：クリボー（踏むと潰れる）、ノコノコ（踏むと甲羅→蹴ると高速滑走して他の敵やレンガを壊す）、パックンフラワー（土管から出入り）。
- **ギミック**：入れない土管、**バネ**（高くジャンプ）、**動く床**（乗ると運ばれる）、**中間地点**（ミスしても旗から復帰）、**旗ざおゴール**（滑り降り→花火）。
- **残機・スコア・1UP**：初期5機。コインでスコア、**通算100枚で残機+1**。残機0でゲームオーバー→ワールドマップ。
- **キャラ別の特殊技**：下記参照。

## 遊び方

1. ホストPCで起動：
   ```bash
   npm install
   npm run dev
   ```
2. 大画面で `https://localhost:5173/`（自己署名証明書は「続行」）を開く。
3. 参加者のスマホで、**同じWi-Fi**から `https://<PCのLAN-IP>:5173/controller.html` を開く
   （URLは大画面のロビーに表示。証明書警告は「続行」→「センサーON」を許可）。
4. 大画面でキャラを選び「スタート」。人数に応じて各スマホへ役割が配られ、**ワールドマップ**が開きます。
5. みんなで左右＋ジャンプでステージを選び、協力してゴール！（マップ・リザルト・ゲームオーバーも同じ操作で進めます）

- **2〜5人**で可変。人数で役割が自動割当：
  - 2人 `[左右移動 / ジャンプ＆ダッシュ]`
  - 3人 `[左 / 右 / ジャンプ]`
  - 4人 `[左 / 右 / ジャンプ / ダッシュ]`
  - 5人 `[左 / 右 / ジャンプ / ダッシュ / 必殺]`
- スマホが無くても **キーボード**で操作可能（開発・お試し用）：
  `←→` 移動 / `Space` ジャンプ / `Shift` ダッシュ / `Z` 必殺

## キャラクター

| キャラ | 必殺技 | ファイア時の必殺 |
|---|---|---|
| 🐬 イルカ | 2段ジャンプ | ＋ファイアボール |
| 🐳 シャチ | ヒップドロップ（ダッシュ/急降下で壊せるブロックを破壊） | ＋ファイアボール |
| 🤖 鉄人28号 | ロケットホバー（短時間の滞空） | ＋ファイアボール |

ステージデータは [src/data/levels.js](src/data/levels.js) にあり、3キャラ全員が歩きジャンプのみで全5ステージ走破可能なことを実機物理で検証ずみ（穴は2タイル幅、危険物は穴/足場と十分離す等のルールで設計）。検証ツールは `node _gen.mjs`（`EMIT=1 node _gen.mjs` で levels.js 用の出力）。

## 別Wi-Fi・他の人のスマホからも遊ぶ（リモートプレイ）

同じWi-Fiが要らないように、`dist/` を配信しつつ中継も行う **本番サーバ** を用意しています。

```bash
npm run serve     # = vite build && node server.js（既定ポート 8080 / PORT で変更可）
# または
npm run build
npm start
```

公開方法は2通り：

- **一時公開トンネル**（手早く共有）：本番サーバを起動して、トンネルで HTTPS URL を発行する。
  ```bash
  npm run serve
  cloudflared tunnel --url http://localhost:8080   # 表示された https URL を全員に共有
  # （ngrok http 8080 でも可）
  ```
- **常設ホストにデプロイ**：Render / Railway / Fly / Glitch などに置く（ビルド `npm run build`、起動 `npm start`、`PORT` は環境変数で渡る）。

> センサー（傾き・加速度）には **HTTPS が必須**。トンネルや常設ホストはHTTPSになるので、他の人のスマホからでもそのまま遊べます。中継状態（参加者・役割）はサーバのメモリ上で1部屋ぶん保持します。

## コマンド

```bash
npm run dev      # 開発サーバ（https・LAN公開・コントローラー中継つき）
npm run build    # dist/ へ本番ビルド
npm run preview  # Vite のビルドプレビュー
npm start        # 本番サーバ（dist 配信 ＋ コントローラー中継）
npm run serve    # build してから本番サーバ起動
```

lint/test はなし。`npm run build` が通れば import/構文エラー無しの目安。

## 技術メモ

- フレームワーク無しのバニラ JS（ES Modules）＋ Vite。描画は Canvas、音は Web Audio API の手続き生成（音声ファイル不要）。
- スマホ↔大画面の通信は **SSE 中継**。中継ロジックは [src/server/relay.js](src/server/relay.js) に集約し、開発（`vite.config.js`）と本番（`server.js`）で共有。GitHub Pages 等の**静的配信のみ**だと中継が動かないので、リモートは `server.js` を立てる（上記）。
- 背景は [src/modules/SceneManager.js](src/modules/SceneManager.js) のテーマ（ocean/cave/water/pipe/sky/city）。各ステージの `theme` で切替。
- センサー（DeviceMotion/Orientation）は **HTTPS 必須**。dev は `@vitejs/plugin-basic-ssl`、本番はホスト/トンネルのHTTPSで対応。
- 入力保持は **ID×アクションの有効期限方式**（[InputHub.js](src/modules/InputHub.js)）。コントローラーが保持中コマンドを定期再送し、受信側は期限切れで自動解除するため、激しく動かしても固着・フリーズしない（パケット欠落にも強い）。

## アセット差し替え（手描き → 本物のドット絵／音へ）

既定は全てプロシージャル（手描き風Canvas＋Web Audio合成）で、追加素材ゼロで動きます。差し替えたいものだけ [public/assets/manifest.json](public/assets/manifest.json) に列挙し、ファイルを置きます。

```jsonc
{
  "images": ["sprites/dolphin", "tiles/ocean"],   // public/assets/sprites/dolphin.png 等
  "audio":  ["se_coin", "se_jump"]                  // public/assets/audio/se_coin.ogg 等
}
```

- スプライト：`sprites/{dolphin,orca,tetsujin,goomba,koopa,piranha,items}`（横並びフレームのシート）
- タイル：`tiles/{ocean,cave,water,pipe,sky}`
- 効果音：`se_{jump,coin,stomp,break,powerup,oneup,clear,miss,spring}`（.ogg/.mp3/.wav）

列挙が無ければ従来どおりプロシージャル描画／合成にフォールバックします（[Assets.js](src/modules/Assets.js)）。

## レベル編集・検証ツール

ステージは [_gen.mjs](_gen.mjs) が一括生成＆検証します（手で levels.js を編集しない）。

```bash
node _gen.mjs            # 検証（穴幅・上空・危険物間隔＋3キャラの踏破可否）
WRITE=1 node _gen.mjs    # 検証OKなら src/data/levels.js を書き出し
```
