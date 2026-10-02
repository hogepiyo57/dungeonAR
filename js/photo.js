// モードA：人物を切り抜いてダンジョン背景に合成し、RPG風ウィンドウ付きで撮影する
import { FilesetResolver, ImageSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
import {
  MESSAGES, fillMessage, drawRpgHud, ensureFont, countdown, flash, showResult, showError, cameraErrorText,
  initialFacing, rememberFacing, bindCameraSelect,
} from './rpg.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

const $ = (id) => document.getElementById(id);
const view = $('view');
const ctx = view.getContext('2d');
const W = view.width, H = view.height;
const video = $('video');

// 背景：ゴーレムの間＝参考画像そのまま／大広間＝ゴーレムのいない部分を左右対称にした画像＋3Dゴーレム
const SCENES = {
  golem: 'assets/dungeon.jpg',
  hall: 'assets/dungeon-hall.jpg',
};

// 参考画像内のゴーレムの目の位置（1536x1024基準）
const EYES = [[1030, 238], [1076, 238]];

const ui = {
  name: $('name'), scale: $('scale'), timer: $('timer'),
  pixel: $('pixel'), hudStatus: $('hudStatus'), hudMessage: $('hudMessage'), embers: $('embers'),
  scene: $('scene'), chest: $('chest'),
};

const sceneParam = new URLSearchParams(location.search).get('scene');
if (sceneParam in SCENES) ui.scene.value = sceneParam;

const state = {
  facing: initialFacing('photo', 'user'),
  stream: null,
  msgIndex: 0,
  cx: W * 0.3,       // 人物の中心X
  bottom: H * 1.02,  // 人物の足元Y
  segmenter: null,
  lastVideoTime: -1,
  prevMask: null,
};

// 作業用キャンバス
const segIn = document.createElement('canvas');   // 切り抜きAIに渡す縮小画像
const segCtx = segIn.getContext('2d', { willReadFrequently: true });
const maskCv = document.createElement('canvas');  // 透明度マスク
const maskCtx = maskCv.getContext('2d');
const person = document.createElement('canvas');  // 切り抜いた人物
const pCtx = person.getContext('2d');
const pixelCv = document.createElement('canvas'); // ドット絵化用
const pxCtx = pixelCv.getContext('2d');

let bg = new Image();
let hall = null;       // 3Dゴーレム（大広間のときだけ読み込む）
let shake = 0;         // こうげき時の画面ゆれ

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function applyScene() {
  const name = ui.scene.value;
  bg = await loadImage(SCENES[name]);
  $('golemBar').hidden = name !== 'hall';
  if (name === 'hall') {
    if (!hall) {
      const { createHallGolem } = await import('./hall3d.js');
      hall = createHallGolem();
    }
    hall.setChest(ui.chest.checked);
    hall.appear();
    state.msgIndex = 0;
  }
}

// ---------- 初期化 ----------
async function init() {
  try {
    await Promise.all([applyScene(), ensureFont()]);
    await startCamera();
  } catch (err) {
    showError($('loading'), 'カメラを起動できません', cameraErrorText(err));
    return;
  }
  try {
    $('loadingText').textContent = '人物切り抜きAIを読み込んでいます…（初回は10秒ほどかかります）';
    state.segmenter = await createSegmenter();
  } catch (err) {
    console.error(err);
    showError($('loading'), '切り抜きAIを読み込めません', '通信状態を確認して再読み込みしてください。');
    return;
  }
  $('loading').hidden = true;
  $('shoot').disabled = false;
  requestAnimationFrame(loop);
}

async function createSegmenter() {
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

async function startCamera() {
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = state.stream;
  await video.play();
  state.prevMask = null;
}

// ---------- 描画ループ ----------
let lastT = performance.now();
const embers = Array.from({ length: 70 }, () => newEmber(true));

function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  updatePerson(now);
  render(now / 1000, dt);
  requestAnimationFrame(loop);
}

function updatePerson(now) {
  if (video.readyState < 2 || !state.segmenter) return;
  if (video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;

  const vw = video.videoWidth, vh = video.videoHeight;
  const mirror = state.facing === 'user';

  // 切り抜きAIへ 256px 幅に縮小して渡す
  const sw = 256, sh = Math.round(256 * vh / vw);
  if (segIn.width !== sw || segIn.height !== sh) {
    segIn.width = maskCv.width = sw;
    segIn.height = maskCv.height = sh;
    state.prevMask = null;
  }
  segCtx.save();
  if (mirror) { segCtx.translate(sw, 0); segCtx.scale(-1, 1); }
  segCtx.drawImage(video, 0, 0, sw, sh);
  segCtx.restore();

  state.segmenter.segmentForVideo(segIn, now, (result) => {
    const m = result.confidenceMasks && result.confidenceMasks[0];
    if (!m) return;
    const conf = m.getAsFloat32Array();
    const img = maskCtx.createImageData(m.width, m.height);
    // 前フレームとなめらかに混ぜてチラつきを抑える
    const prev = state.prevMask && state.prevMask.length === conf.length ? state.prevMask : null;
    const out = new Float32Array(conf.length);
    for (let i = 0; i < conf.length; i++) {
      const c = prev ? prev[i] * 0.45 + conf[i] * 0.55 : conf[i];
      out[i] = c;
      const a = Math.max(0, Math.min(1, (c - 0.45) / 0.3));
      img.data[i * 4 + 3] = a * 255;
    }
    state.prevMask = out;
    maskCtx.putImageData(img, 0, 0);
  });

  // 人物レイヤー：映像をマスクで切り抜き、ダンジョンの光に色を寄せる
  const pw = Math.min(vw, 720), ph = Math.round(pw * vh / vw);
  if (person.width !== pw || person.height !== ph) { person.width = pw; person.height = ph; }
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
  pCtx.globalCompositeOperation = 'source-atop';
  const grad = pCtx.createLinearGradient(0, 0, pw, 0);
  grad.addColorStop(0, 'rgba(255,140,40,0.22)');
  grad.addColorStop(1, 'rgba(70,100,255,0.22)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, pw, ph);
  pCtx.restore();
}

function personRect() {
  const s = parseFloat(ui.scale.value);
  const h = H * 0.92 * s;
  const w = h * (person.width / Math.max(1, person.height));
  return { x: state.cx - w / 2, y: state.bottom - h, w, h };
}

function render(t, dt) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  const useHall = ui.scene.value === 'hall' && hall;
  ctx.save();
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    ctx.translate(Math.sin(t * 90) * 14 * shake / 0.35, Math.cos(t * 70) * 10 * shake / 0.35);
  }
  ctx.drawImage(bg, -16, -16, W + 32, H + 32);

  if (useHall) {
    // 3Dゴーレム（背景と人物のあいだ）
    hall.lookAtPerson(state.cx / W);
    hall.render(dt);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hall.canvas, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    const p = hall.attackPhase();
    if (p > 0.55 && p < 0.6 && shake === 0) shake = 0.35;
  }
  ctx.restore();

  // ゴーレムの目を明滅させる（絵のゴーレムのとき）
  ctx.save();
  if (useHall) ctx.globalAlpha = 0;
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.55 + Math.sin(t * 3) * 0.35;
  for (const [ex, ey] of EYES) {
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 34);
    g.addColorStop(0, `rgba(255,170,60,${0.8 * pulse})`);
    g.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ex - 34, ey - 34, 68, 68);
  }
  ctx.restore();

  // 人物
  if (person.width > 0) {
    const r = personRect();
    // 足元の影
    ctx.save();
    const sg = ctx.createRadialGradient(state.cx, state.bottom - r.h * 0.01, 0, state.cx, state.bottom - r.h * 0.01, r.w * 0.35);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.translate(0, state.bottom);
    ctx.scale(1, 0.25);
    ctx.translate(0, -state.bottom);
    ctx.fillRect(state.cx - r.w * 0.4, state.bottom - r.w * 0.4, r.w * 0.8, r.w * 0.8);
    ctx.restore();

    if (ui.pixel.checked) {
      // ドット絵化：縮小してから拡大（ぼかしなし）
      const block = 7;
      const pw = Math.max(1, Math.round(r.w / block)), ph = Math.max(1, Math.round(r.h / block));
      if (pixelCv.width !== pw || pixelCv.height !== ph) { pixelCv.width = pw; pixelCv.height = ph; }
      pxCtx.clearRect(0, 0, pw, ph);
      pxCtx.imageSmoothingEnabled = true;
      pxCtx.drawImage(person, 0, 0, pw, ph);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixelCv, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.drawImage(person, r.x, r.y, r.w, r.h);
    }
  }

  // 火の粉
  if (ui.embers.checked) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.v * dt;
      e.x += Math.sin(t * 1.5 + e.p) * 12 * dt;
      e.life -= dt;
      if (e.y < -10 || e.life <= 0) Object.assign(e, newEmber(false));
      const a = Math.max(0, Math.min(1, e.life)) * (0.6 + 0.4 * Math.sin(t * 8 + e.p));
      ctx.fillStyle = `rgba(255,${150 + e.p * 10 | 0},60,${a})`;
      ctx.fillRect(e.x | 0, e.y | 0, e.s, e.s);
    }
    ctx.restore();
  }

  // 周辺を少し暗く
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  drawRpgHud(ctx, W, H, {
    name: ui.name.value.trim(),
    message: fillMessage(MESSAGES[state.msgIndex], ui.name.value.trim()),
    showStatus: ui.hudStatus.checked,
    showMessage: ui.hudMessage.checked,
  });
}

function newEmber(anyY) {
  return {
    x: Math.random() * W,
    y: anyY ? Math.random() * H : H + 10,
    v: 30 + Math.random() * 70,
    s: 3 + (Math.random() * 3 | 0),
    p: Math.random() * 6,
    life: 2 + Math.random() * 5,
  };
}

// ---------- 操作 ----------
bindCameraSelect($('camsel'), state.facing, async (facing) => {
  const prev = state.facing;
  state.facing = facing;
  try {
    await startCamera();
  } catch (err) {
    state.facing = prev;
    await startCamera().catch(() => {});
    throw err;
  }
  rememberFacing('photo', facing);
});

ui.scene.addEventListener('change', () => { applyScene().catch((err) => console.error(err)); });
ui.chest.addEventListener('change', () => { if (hall) hall.setChest(ui.chest.checked); });
$('summon').addEventListener('click', () => {
  if (!hall) return;
  hall.appear();
  state.msgIndex = 0;
  ui.hudMessage.checked = true;
});
$('attack').addEventListener('click', () => {
  if (!hall) return;
  hall.attack();
  state.msgIndex = 2;
  ui.hudMessage.checked = true;
});

$('msgNext').addEventListener('click', () => {
  state.msgIndex = (state.msgIndex + 1) % MESSAGES.length;
  ui.hudMessage.checked = true;
});

$('shoot').addEventListener('click', async () => {
  const btn = $('shoot');
  btn.disabled = true;
  await countdown($('countdown'), parseInt(ui.timer.value, 10));
  flash($('flash'));
  render(performance.now() / 1000, 0);
  await showResult($('result'), view);
  btn.disabled = false;
});

// ドラッグで移動、2本指ピンチで拡大縮小
const pointers = new Map();
let pinchStart = null;
const toCanvas = (e) => {
  const r = view.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
};
view.addEventListener('pointerdown', (e) => {
  view.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toCanvas(e));
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), s: parseFloat(ui.scale.value) };
  }
});
view.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const cur = toCanvas(e);
  pointers.set(e.pointerId, cur);
  if (pointers.size === 1) {
    state.cx = clamp(state.cx + cur.x - prev.x, 0, W);
    state.bottom = clamp(state.bottom + cur.y - prev.y, H * 0.3, H * 1.6);
  } else if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    ui.scale.value = clamp(pinchStart.s * d / pinchStart.d, 0.4, 1.6);
  }
});
const endPointer = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null; };
view.addEventListener('pointerup', endPointer);
view.addEventListener('pointercancel', endPointer);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

init();
