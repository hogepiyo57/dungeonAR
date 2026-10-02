# ダンジョンAR 〜石の守護者の間〜

文化祭のフォトスポット用Web AR。QRコードを読むとブラウザでカメラが起動し、ダンジョンに入りこんだような写真が撮れる。アプリのインストールは不要。

## 2つのモード

| モード | ページ | 内容 |
|---|---|---|
| A. ゴーレムとたたかう | `photo.html?scene=hall` | 画面内の大広間の背景に3Dゴーレムと宝箱が出現し、切り抜いた人物と一緒に写る。ポスター不要。「しょうかん」で登場しなおし、「こうげき」で振り下ろし＋画面ゆれ |
| A'. ダンジョン撮影 | `photo.html?scene=magic` | お城の部屋で、光る魔法陣の上に立った写真をとる。魔法陣は多段の発光・光の一周・波紋・回るルーン・光の柱・きらめき・光の粒で演出し、人物も下から青く照らす。シャッターの瞬間に強く光る。魔法陣の色は青・赤・緑・紫・金から選べる（URLの `&color=red` などで初期色も指定可） |
| A''. モンスターになる | `photo.html?scene=battle` | 戦闘画面のまんなかに、切り抜いた自分がモンスターとして立つ。右下の「てき」の名前と数（最大3行）を入力でき、パーティ先頭は「なまえ」の名前になる |
| （おまけ） | `photo.html?scene=golem` | 参考画像（絵のゴーレム入り）に人物を合成する。撮影画面の「ばしょ」から選ぶ |
| B. ゴーレム召喚 | `ar.html` | 教室に貼ったポスターをうつすと、3Dの石ゴーレムと宝箱が出現する。「こうげき」でアニメーション。ポスターが人で隠れても、ゴーレムは最後の位置にとどまる |

## カメラの選択

両モードとも、画面の「イン／アウト」でインカメラ（自撮り）とアウトカメラ（係が撮影）を選べる。インカメラは鏡に映したように左右反転して表示・保存する。選んだカメラは端末に記憶され、次回も同じカメラで起動する。

URLの末尾に `?camera=user`（イン）または `?camera=environment`（アウト）を付けると、最初に使うカメラを指定できる。例：自撮り用QRは `photo.html?camera=user`、係用QRは `ar.html?camera=environment`。

既定値：ダンジョン撮影＝インカメラ、ゴーレム召喚＝アウトカメラ

係用ページ：

- `marker.html` … ARポスター（印刷用）
- `qr.html` … 入口に貼るQRコード（印刷用）

## 公開方法（GitHub Pages）

1. GitHub のリポジトリで **Settings → Pages** を開く
2. **Source: Deploy from a branch**、**Branch: `main` / `(root)`** を選んで Save
3. 数分後に `https://hogepiyo57.github.io/dungeonAR/` で公開される
4. 公開URLで `qr.html` を開き、QRコードを印刷する

カメラは https でしか動かないため、パソコンのファイルを直接開いて（`file://`）も動かない。

## 当日の準備

- ポスター（`marker.html`）はA3以上で印刷すると、離れても認識しやすい。光が反射しにくい紙を使う
- 壁に貼るときは「せってい → ポスターの場所：かべに貼る」、机や床に置くときは「床・机に置く」
- ゴーレムの大きさは「せってい → ゴーレムの大きさ」で、ポスターとの距離に合わせて調整する
- 来場者のスマホで動かない場合に備え、係用の端末（タブレットやノートPC）を1台用意する
- 写真は端末の中だけで作られ、サーバーには送信されない

## 動作環境

- iPhone：Safari（iOS 15以降を想定）
- Android：Chrome
- 初回は人物切り抜きAI（約数MB）とARライブラリを読み込むため、通信が必要

## 構成

```
index.html        タイトル画面
photo.html        モードA（人物切り抜き合成）  js/photo.js
ar.html           モードB（画像マーカーAR）    js/ar.js, js/golem.js
marker.html       印刷用ARポスター
qr.html           印刷用QRコード
js/rpg.js         RPG風ウィンドウ・撮影・保存の共通処理
assets/dungeon.jpg      背景・ポスター画像（AI生成）
assets/dungeon-hall.jpg 大広間の背景（参考画像のゴーレムがいない左側を左右対称にしたもの）
js/hall3d.js            大広間に重ねる3Dゴーレム
assets/castle.jpg       魔法陣の間の背景（AI生成画像の天井部分を切り落としたもの）
assets/magic-lines.png  魔法陣の線だけを抜き出した発光用マスク
js/magic.js             魔法陣の発光演出
assets/battle.jpg       戦闘画面の背景（AI生成）
js/battle.js            戦闘画面のウィンドウ（パーティ・コマンド・てき）
assets/targets.mind     ポスター認識データ（MindARで作成）
```

使用ライブラリ（CDN読み込み）：MediaPipe Tasks Vision（人物切り抜き）、MindAR（画像認識AR）、three.js（3D表示）、qrcode-generator、Google Fonts「DotGothic16」

## ポスター画像を差し替える場合

`assets/targets.mind` は画像から作る認識データなので、ポスター画像を変えたら作り直す必要がある。MindAR の公式コンパイラ（https://hiukim.github.io/mind-ar-js-doc/tools/compile ）に新しい画像をアップロードし、出力された `targets.mind` を `assets/` に置く。あわせて `js/ar.js` の `TARGET_ASPECT`（高さ÷幅）を新しい画像に合わせる。
