// 撮影画面の部屋（場面）一覧
//
// 各部屋のファイルは次の形の設定を default で書き出す。
//   id, src（背景画像）, w, h（写真の大きさ）
//   stand: { cx, feetY, height }  … 人物を自動で合わせるときの立ち位置（足元の点と身長、写真の座標）
//   messages                      … セリフ（文字列、または { text, ...部屋ごとの情報 }）
//   messageTop                    … メッセージを画面上部に出す
//   enterSound                    … 部屋に入ったときの効果音
//   embers                        … 共通の火の粉を出すか（既定 true）
//   ui: { golemBar, battleFields, hideName, hideMsgNext } … 部屋専用の操作の表示
//   async create({ bg })          … 部屋の演出を用意して、次の関数を持つオブジェクトを返す（どれも省略可）
//       enter()                     部屋に入るたび
//       shakeOffset(t, dt)          画面ゆれ [x, y]
//       drawBehind(ctx, f)          背景の上・人物より奥
//       drawFront(ctx, f)           人物より手前
//       drawHud(ctx, f)             ウィンドウ（省略時は共通のステータス＋メッセージ）
//       tintPerson(g, w, h)         人物の色味（省略時は共通のたいまつ色）
//       onMessage(index, { quiet }) セリフが変わったとき
//       onShutter()                 シャッターの直前（Promise 可）
//   f（フレーム情報）：{ t, dt, W, H, still（撮影用の1枚）, opts: { particles, chest, status, message, name, enemies, msgIndex } }

export const SCENE_IDS = ['hall', 'magic', 'battle', 'golem'];

export async function loadScene(id) {
  const mod = await import(`./${id}.js`);
  return mod.default;
}
