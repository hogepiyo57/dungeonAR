// 人物の切り抜き（MediaPipe）と、切り抜いた人物の位置（頭〜足先の範囲）の検出
import { FilesetResolver, ImageSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export async function createSegmenter() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
  try {
    return await ImageSegmenter.createFromOptions(fileset, opts('GPU'));
  } catch {
    return await ImageSegmenter.createFromOptions(fileset, opts('CPU'));
  }
}

// 人物レイヤー：カメラ映像を切り抜いた canvas と、人物の範囲 bbox（映像に対する 0〜1 の割合）
export function createPersonLayer() {
  const segIn = document.createElement('canvas');   // 切り抜きAIに渡す縮小画像
  const segCtx = segIn.getContext('2d', { willReadFrequently: true });
  const maskCv = document.createElement('canvas');  // 透明度マスク
  const maskCtx = maskCv.getContext('2d');
  const canvas = document.createElement('canvas');  // 切り抜いた人物
  const pCtx = canvas.getContext('2d');
  let prevMask = null;
  let lastVideoTime = -1;

  const layer = {
    canvas,
    // { x0, x1, y0, y1 }：人物が写っている範囲。見つからないときは null
    bbox: null,
    reset() { prevMask = null; layer.bbox = null; },

    // 新しいフレームがあれば切り抜きを更新する。tint(g, w, h) で人物の色味を変える
    update(video, now, { mirror, segmenter, tint }) {
      if (video.readyState < 2 || !segmenter) return;
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const vw = video.videoWidth, vh = video.videoHeight;

      // 切り抜きAIへ 256px 幅に縮小して渡す
      const sw = 256, sh = Math.round(256 * vh / vw);
      if (segIn.width !== sw || segIn.height !== sh) {
        segIn.width = maskCv.width = sw;
        segIn.height = maskCv.height = sh;
        prevMask = null;
      }
      segCtx.save();
      if (mirror) { segCtx.translate(sw, 0); segCtx.scale(-1, 1); }
      segCtx.drawImage(video, 0, 0, sw, sh);
      segCtx.restore();

      segmenter.segmentForVideo(segIn, now, (result) => {
        const m = result.confidenceMasks && result.confidenceMasks[0];
        if (!m) return;
        const conf = m.getAsFloat32Array();
        const img = maskCtx.createImageData(m.width, m.height);
        // 前フレームとなめらかに混ぜてチラつきを抑える
        const prev = prevMask && prevMask.length === conf.length ? prevMask : null;
        const out = new Float32Array(conf.length);
        for (let i = 0; i < conf.length; i++) {
          const c = prev ? prev[i] * 0.45 + conf[i] * 0.55 : conf[i];
          out[i] = c;
          const a = Math.max(0, Math.min(1, (c - 0.45) / 0.3));
          img.data[i * 4 + 3] = a * 255;
        }
        prevMask = out;
        maskCtx.putImageData(img, 0, 0);
        layer.bbox = findBox(out, m.width, m.height);
      });

      // 人物レイヤー：映像をマスクで切り抜き、部屋の光に色を寄せる
      const pw = Math.min(vw, 720), ph = Math.round(pw * vh / vw);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      pCtx.save();
      pCtx.globalCompositeOperation = 'source-over';
      pCtx.clearRect(0, 0, pw, ph);
      pCtx.filter = 'brightness(0.88) contrast(1.1) saturate(0.95)';
      if (mirror) { pCtx.translate(pw, 0); pCtx.scale(-1, 1); }
      pCtx.drawImage(video, 0, 0, pw, ph);
      pCtx.restore();

      pCtx.save();
      pCtx.globalCompositeOperation = 'destination-in';
      pCtx.imageSmoothingEnabled = true;
      pCtx.drawImage(maskCv, 0, 0, pw, ph);
      pCtx.restore();
      (tint || torchTint)(pCtx, pw, ph);
    },
  };
  return layer;
}

// 共通の色味：左からたいまつの橙、右から青
function torchTint(g, w, h) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,140,40,0.22)');
  grad.addColorStop(1, 'rgba(70,100,255,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// マスクから人物の上下左右の端を求める（小さなノイズは無視する）
function findBox(conf, w, h) {
  const rows = new Uint16Array(h), cols = new Uint16Array(w);
  let total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (conf[y * w + x] > 0.5) { rows[y]++; cols[x]++; total++; }
    }
  }
  if (total < w * h * 0.01) return null;
  const minRow = Math.max(2, w * 0.01), minCol = Math.max(2, h * 0.01);
  let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
  while (y0 < h && rows[y0] < minRow) y0++;
  while (y1 > y0 && rows[y1] < minRow) y1--;
  while (x0 < w && cols[x0] < minCol) x0++;
  while (x1 > x0 && cols[x1] < minCol) x1--;
  return { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
}
