// 人物を写真のどこに、どの大きさで置くか
//   自動：切り抜いた人物の頭〜足先を見つけて、部屋ごとの立ち位置（足元の点と身長）に合わせる
//   手動：画面をドラッグ／ピンチしたら手動に切り替わり、その位置で固定する

// 足先がこれより下（映像の下端近く）なら、足が映っていない＝上半身だけとみなす
const FEET_VISIBLE = 0.96;
// 上半身だけのとき、映っている部分を身長のどれくらいとして扱うか
const UPPER_BODY_RATIO = 0.62;

export function createPlacement() {
  let target = { cx: 0, feetY: 0, height: 100 };
  let mode = 'auto';
  let rect = null;   // { x, y, h }（なめらかに追いかける）
  let manual = null; // { ax, ay, fx, fy, baseH }：映像上の点 (fx, fy) を写真の (ax, ay) に固定

  const api = {
    get mode() { return mode; },

    // 部屋に入ったとき：自動に戻す
    reset(stand) {
      target = stand;
      mode = 'auto';
      rect = null;
      manual = null;
    },
    setAuto() { mode = 'auto'; manual = null; },

    // 今フレームの人物の置き場所 { x, y, w, h, feet }。feet は足元の影を置く点（足が映っていないときは null）
    // bbox：人物の範囲（映像に対する割合）、aspect：映像の横/縦、s：「大きさ」の倍率
    layout(bbox, aspect, s) {
      const full = !!bbox && bbox.y1 < FEET_VISIBLE;
      if (mode === 'manual' && manual) {
        const h = manual.baseH * s, w = h * aspect;
        rect = { x: manual.ax - manual.fx * w, y: manual.ay - manual.fy * h, h };
      } else {
        let h, fx, fy, ay;
        if (bbox && full) {
          // 全身：足先を立ち位置に、頭〜足先を身長に合わせる
          h = target.height * s / Math.max(0.15, bbox.y1 - bbox.y0);
          fx = (bbox.x0 + bbox.x1) / 2; fy = bbox.y1; ay = target.feetY;
        } else if (bbox) {
          // 上半身だけ：頭の高さを全身のときと同じにそろえる
          h = target.height * s * UPPER_BODY_RATIO / Math.max(0.15, 1 - bbox.y0);
          fx = (bbox.x0 + bbox.x1) / 2; fy = bbox.y0; ay = target.feetY - target.height * s;
        } else {
          // まだ人物が見つからない：映像の下端を立ち位置に
          h = target.height * s / 0.8;
          fx = 0.5; fy = 0.95; ay = target.feetY;
        }
        const want = { x: target.cx - fx * h * aspect, y: ay - fy * h, h };
        // ゆっくり追いかけて、ぴょこぴょこ動かないようにする
        const k = rect ? 0.12 : 1;
        rect = rect
          ? { x: rect.x + (want.x - rect.x) * k, y: rect.y + (want.y - rect.y) * k, h: rect.h + (want.h - rect.h) * k }
          : want;
      }
      const w = rect.h * aspect;
      const feet = full
        ? { x: rect.x + ((bbox.x0 + bbox.x1) / 2) * w, y: rect.y + bbox.y1 * rect.h }
        : null;
      return { x: rect.x, y: rect.y, w, h: rect.h, feet };
    },

    // ドラッグ・ピンチを始めたとき：直前の置き場所 last（layout の結果）のまま手動に切り替える
    startManual(last, bbox, s) {
      if (mode === 'manual' || !last) return;
      const fx = bbox ? (bbox.x0 + bbox.x1) / 2 : 0.5;
      const fy = bbox ? Math.min(bbox.y1, 1) : 1;
      manual = { fx, fy, baseH: last.h / s, ax: last.x + fx * last.w, ay: last.y + fy * last.h };
      mode = 'manual';
    },
    move(dx, dy) {
      if (!manual) return;
      manual.ax += dx;
      manual.ay += dy;
    },
  };
  return api;
}
