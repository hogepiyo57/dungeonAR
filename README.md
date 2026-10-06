# ダンジョンAR 〜石の守護者の間〜

つばめ祭のフォトスポット用Web AR。QRコードを読むとブラウザでカメラが起動し、ダンジョンに入りこんだような写真が撮れる。アプリのインストールは不要。

## 遊び方

| タイトル画面の項目 | ページ | 内容 |
|---|---|---|
| ゴーレムと たたかう | `photo.html?scene=hall` | 大広間の奥に3Dゴーレムと宝箱が出現し、切り抜いた人物と一緒に写る。ポスター不要。「しょうかん」で登場しなおし、「こうげき」で左手をふりあげて（こぶしに「G」）振り下ろし＋画面ゆれ |
| ダンジョンで しゃしんを とる | `photo.html?scene=magic` | お城の部屋で、光る魔法陣の上に立った写真をとる。魔法陣の色はセリフに合わせて変わる（かえんまほう＝赤、あおく かがやきだした＝青、めざめた＝紫、えらばれた＝金、ふしぎな ひかり＝緑）。シャッターの瞬間に強く光る |
| モンスターに なる | `photo.html?scene=battle` | 戦闘画面のまんなかに、切り抜いた自分がモンスターとして立つ。右下の「てき」の名前と数（最大3行）を入力できる |
| つばめいを よびだす | `ar.html?chara=tsubamei` | つばめいのポスター（`tsubamei-marker.html`）をうつすと、つばめい（高さ40cm。設定の「つばめいの大きさ」で20cm〜1m20cmに変えられ、端末に記憶）が出現する。かべに貼ったときは、ふだんはポスターの下のふちに立つ（設定の「つばめいの立つ場所」を「床」にすると、「ポスターの下のふちの高さ」ぶん下の床に立つ）。大きさは「印刷したポスターの横幅」（A4縦＝21cm）から換算する（係が一度入れれば端末に記憶） |
| ゴーレムを しょうかんする | `ar.html` | 教室に貼ったポスターをうつすと、3Dの石ゴーレムが出現する |
| （撮影画面の「ばしょ」から） | `photo.html?scene=golem` | 参考画像（絵のゴーレム入り）に人物を合成する |

### 撮影画面の共通機能

- **立ち位置の自動合わせ**：切り抜いた人物の頭〜足先を見つけて、部屋ごとの立ち位置（魔法陣の中心など）と身長に自動で合わせる。足が映っていない（上半身だけ）ときは頭の高さをそろえる。画面をドラッグ／ピンチすると手動になり、「立ち位置を自動にもどす」で戻る
- **ドット絵化**：なし／ふつう／粗い／とても粗い（端末に記憶）
- **記念スタンプ**：写真の隅に「つばめ祭 2026.10.02」（撮影した日）。メッセージウィンドウと重ならない側に入る
- **効果音**：カウントダウン、シャッター、ゴーレムの登場・攻撃、魔法陣の発動、戦闘開始など。音声ファイルは使わずブラウザで合成している。設定の「おと」で消せる（端末に記憶）。iPhone はマナーモードだと鳴らない
- 撮影結果を表示している間は、切り抜き・描画・ARの認識を止めて電池と発熱を抑える

### つばめい

- 正面のイラスト `つばめい/つばめい (2).PNG` から作った3Dモデル。絵を色ごとの部品（頭・とさか・くちばし・羽・胴・ズボン・足）に分け、輪郭をふくらませて立体にし、正面には元の絵をそのまま貼っている（正面から見ると元の絵と同じ）。色は4枚のイラスト（1・3・4・5）の濃いめの配色にそろえた。後頭部のはねは横向きの絵（3・5）を参考に追加。横からの厚み（頭・胴・ズボンは幅と同じくらいの丸い体型）は横向き・斜めの絵（3・4）に、とさか（ほぼまっすぐ立った葉の形）・くちばし・背中（サスペンダー2本、ズボンの腰ひも）・しっぽ（左右のズボンのすそを底辺とする三角形が、下・後ろへとがる。後ろから見ると W 字）はデザインの線画 `つばめい/線画/`（横・後ろ）に合わせた
- 作り直し方：`.venv` の Python（numpy・pillow・scipy）で `python tools/build_tsubamei.py` を実行すると `assets/tsubamei/`（model.json・model.bin・front.png・back.png）ができる。動き・ポーズは `js/models/tsubamei.js`
- モデルの版は `tools/build_tsubamei.py` の `MODEL_VERSION`（`model.html` の右上に表示）。版ごとに git のタグ `tsubamei-v<番号>` を付けている。前の版に戻すときは次を実行する（例：v1）
  `git checkout tsubamei-v1 -- assets/tsubamei tools/build_tsubamei.py js/models/tsubamei.js`
- 高さはとさかの先まで1.2m。くちばしは開かない
- 羽を広げるポーズ（手をふる・ばんざい・とぶ）では、ばんざいの絵 `つばめい (1).png` から作った「広げた羽」（上が紫、下に白い羽根）に入れかわる
- 約3.6秒ごとにポーズが変わる：立つ → 手をふる → ばんざい（目を閉じてにっこり）→ てれる → とぶ（左右交互）。ときどきまばたきする
- ポスターARでつばめいを出すときは、ポスターを「床・机に置く」か、「かべに貼る」なら床からの高さを入れる。ポスターを見失っても最後の位置に残る

## カメラの選択

画面の「イン／アウト」でインカメラ（自撮り）とアウトカメラ（係が撮影）を選べる。インカメラは鏡に映したように左右反転して表示・保存する。選んだカメラは端末に記憶され、次回も同じカメラで起動する。

URLの末尾に `?camera=user`（イン）または `?camera=environment`（アウト）を付けると、最初に使うカメラを指定できる。例：自撮り用QRは `photo.html?camera=user`、係用QRは `ar.html?camera=environment`。

既定値：撮影画面＝インカメラ、ゴーレム召喚（ポスターAR）＝アウトカメラ

係用ページ：

- `marker.html` … ゴーレムのARポスター（印刷用）
- `tsubamei-marker.html` … つばめいのARポスター（A4縦で印刷用）
- `qr.html` … 入口に貼るQRコード（印刷用）
- `model.html` … つばめいの3Dモデルを回して見る（ポーズを選んで止められる）

## バージョン

タイトル画面の下に `ver 0.11.3（2026.10.06）` のように表示する。更新を公開するたびに `js/common/version.js` の `VERSION` と `RELEASED` を上げる（大きな作り直し＝1つ目、機能の追加＝2つ目、修正だけ＝3つ目）。当日、端末に古い画面が残っていないかの確認に使う。

## 公開方法（GitHub Pages）

1. GitHub のリポジトリで **Settings → Pages** を開く
2. **Source: Deploy from a branch**、**Branch: `main` / `(root)`** を選んで Save
3. 数分後に `https://hogepiyo57.github.io/dungeonAR/` で公開される
4. 公開URLで `qr.html` を開き、QRコードを印刷する

カメラは https でしか動かないため、パソコンのファイルを直接開いて（`file://`）も動かない。

## 当日の準備

- 写真は来場者の個人のスマホで撮って保存する（写真はサーバーに送信されない）
- ポスター（`marker.html`）はA3以上で印刷すると、離れても認識しやすい。光が反射しにくい紙を使う
- 壁に貼るときは「せってい → ポスターの場所：かべに貼る」、机や床に置くときは「床・机に置く」

## 動作環境

- iPhone・iPad：Safari（実機で確認済み）
- Android：Chrome
- 人物切り抜きAI・ARライブラリ・フォントはネットから読み込む（モバイルデータ通信で運用）

## 構成

```
index.html / photo.html / ar.html / marker.html / tsubamei-marker.html / qr.html   各ページ

js/pages/        ページごとの処理
  index.js         タイトル画面（バージョン表示）
  photo.js         撮影画面（カメラ・描画ループ・撮影・操作）
  ar.js            ポスターAR
js/scenes/       撮影画面の部屋。1部屋1ファイル（決まりは scenes/index.js の先頭に記載）
  hall.js          大広間（3Dゴーレム）
  magic.js         魔法陣の間（セリフと魔法陣の色の対応もここ）
  battle.js        戦闘画面（パーティ・コマンド・てきのウィンドウ）
  golem.js         ゴーレムの間（絵のゴーレムの目を光らせる）
js/photo/        撮影画面の部品
  segment.js       人物の切り抜きと、頭〜足先の範囲の検出
  placement.js     立ち位置の自動合わせ・手動移動
  embers.js        火の粉
js/effects/      重い演出
  magic-circle.js  魔法陣の発光（色の配色セットもここ）
  hall-golem.js    大広間に重ねる3Dゴーレムの描画
js/models/golem.js     3Dゴーレムと宝箱の形・動き（大広間とポスターARで共通）
js/models/tsubamei.js  3Dつばめいの形・ポーズ
js/common/       全ページ共通
  rpg-ui.js        RPG風ウィンドウ・メッセージ・記念スタンプ
  capture.js       カウントダウン・フラッシュ・撮影結果の保存
  camera.js        イン／アウトカメラの選択とエラー表示
  sound.js         効果音（合成）
  storage.js       端末への設定の記憶
  version.js       バージョン

assets/dungeon.jpg       ゴーレムの間の背景・ARポスター（AI生成）
assets/dungeon-hall.jpg  大広間の背景（参考画像のゴーレムがいない左側を左右対称にしたもの）
assets/castle.jpg        魔法陣の間の背景（AI生成画像の天井部分を切り落としたもの）
assets/magic-lines.png   魔法陣の線だけを抜き出した発光用マスク
assets/battle.jpg        戦闘画面の背景（AI生成）
assets/targets.mind      ゴーレムのポスター認識データ（MindARで作成）
assets/tsubamei-poster.png  つばめいのARポスター（tools/make_tsubamei_poster.py で作成）
assets/tsubamei-target.jpg  つばめいのポスターを縮小した、認識データ作成用の画像
assets/tsubamei.mind        つばめいのポスター認識データ
assets/tsubamei/         つばめいの3Dモデル（tools/build_tsubamei.py で作成）
tools/build_tsubamei.py  イラストから3Dモデルを作るスクリプト
つばめい/                つばめいの元イラスト（ページからは読み込まない）
```

使用ライブラリ（CDN読み込み）：MediaPipe Tasks Vision（人物切り抜き）、MindAR（画像認識AR）、three.js（3D表示）、qrcode-generator、Google Fonts「DotGothic16」

### 部屋を追加するには

1. 背景画像を `assets/` に置く
2. `js/scenes/` に部屋のファイルを作る（`scenes/index.js` の先頭の説明と、既存の部屋を参考に）
3. `scenes/index.js` の `SCENE_IDS` と、`photo.html` の「ばしょ」の選択肢に追加する

## ポスター画像を差し替える場合

`assets/targets.mind` は画像から作る認識データなので、ポスター画像を変えたら作り直す必要がある。MindAR の公式コンパイラ（https://hiukim.github.io/mind-ar-js-doc/tools/compile ）に新しい画像をアップロードし、出力された `targets.mind` を `assets/` に置く。あわせて `js/pages/ar.js` の `TARGET_ASPECT`（高さ÷幅）を新しい画像に合わせる。

## つばめいのポスターを作り直す場合

1. `.venv` の Python で `python tools/make_tsubamei_poster.py` を実行する（`assets/tsubamei-poster.png` と `assets/tsubamei-target.jpg` ができる。模様の配置は毎回同じ）
2. `assets/tsubamei-target.jpg` から認識データを作り、`assets/tsubamei.mind` に置く（MindAR の公式コンパイラ、またはブラウザで `MINDAR.IMAGE.Compiler` を使う）
3. 縦横比を変えたときは `js/pages/ar.js` の `POSTERS.tsubamei.aspect` を合わせる
