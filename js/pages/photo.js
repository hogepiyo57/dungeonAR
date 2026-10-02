// 撮影画面：人物を切り抜いて部屋の背景に合成し、RPG風ウィンドウ付きで撮影する
// 部屋ごとの演出は js/scenes/ に、人物の切り抜き・置き場所は js/photo/ にある
import { MESSAGES, fillMessage, drawRpgHud, drawStamp, ensureFont } from '../common/rpg-ui.js';
import { countdown, flash, showResult } from '../common/capture.js';
import { initialFacing, rememberFacing, bindCameraSelect, cameraErrorText, showError } from '../common/camera.js';
import { play, bindSoundToggle } from '../common/sound.js';
import { load, save } from '../common/storage.js';
import { SCENE_IDS, loadScene } from '../scenes/index.js';
import { createSegmenter, createPersonLayer } from '../photo/segment.js';
import { createPlacement } from '../photo/placement.js';
import { createEmbers } from '../photo/embers.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const ctx = view.getContext('2d');
let W = view.width, H = view.height;
const video = $('video');

const ui = {
  name: $('name'), scale: $('scale'), timer: $('timer'), pixel: $('pixel'),
  hudStatus: $('hudStatus'), hudMessage: $('hudMessage'), embers: $('embers'),
  scene: $('scene'), chest: $('chest'), sound: $('sound'), autoFit: $('autoFit'),
};

const state = {
  facing: initialFacing('photo', 'user'),
  stream: null,
  segmenter: null,
  paused: false, // 撮影結果を表示している間は処理を止める
  scene: null,   // 今の部屋の設定（js/scenes/*.js）
  fx: null,      // 今の部屋の演出（scene.create() の結果）
  msgIndex: 0,
  lastLayout: null,
};
const fxCache = new Map(); // 一度用意した部屋の演出は使いまわす

const person = createPersonLayer();
const placement = createPlacement();
const embers = createEmbers();
const pixelCv = document.createElement('canvas'); // ドット絵化用
const pxCtx = pixelCv.getContext('2d');
const PIXEL_LEVELS = ['0', '7', '10', '14'];       // なし／ふつう／粗い／とても粗い（1ドットの大きさ px）
let bg = new Image();

// ---------- 部屋 ----------
const sceneParam = new URLSearchParams(location.search).get('scene');
if (SCENE_IDS.includes(sceneParam)) ui.scene.value = sceneParam;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const sceneMessages = () => state.scene.messages || MESSAGES;
const messageText = (m) => (typeof m === 'string' ? m : m.text);

async function applyScene() {
  const scene = await loadScene(ui.scene.value);
  bg = await loadImage(scene.src);
  let fx = fxCache.get(scene.id);
  if (!fx) {
    fx = await scene.create({ bg });
    fxCache.set(scene.id, fx);
  }
  state.scene = scene;
  state.fx = fx;

  // キャンバスの大きさを背景に合わせ、人物を自動の立ち位置へ
  view.width = W = scene.w;
  view.height = H = scene.h;
  placement.reset(scene.stand);
  ui.scale.value = 1;
  paintAutoFit();

  // 部屋専用の操作
  const sui = scene.ui || {};
  $('golemBar').hidden = !sui.golemBar;
  $('battleFields').hidden = !sui.battleFields;
  $('nameField').hidden = !!sui.hideName;
  $('msgNext').hidden = !!sui.hideMsgNext;

  state.msgIndex = 0;
  if (fx.onMessage) fx.onMessage(0, { quiet: true });
  if (fx.enter) fx.enter();
  if (scene.enterSound) play(scene.enterSound);
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

async function startCamera() {
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = state.stream;
  await video.play();
  person.reset();
}

// ---------- 描画 ----------
let lastT = performance.now();

function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (!state.paused) {
    person.update(video, now, {
      mirror: state.facing === 'user',
      segmenter: state.segmenter,
      tint: state.fx && state.fx.tintPerson,
    });
    render(now / 1000, dt);
  }
  requestAnimationFrame(loop);
}

function readOpts() {
  return {
    particles: ui.embers.checked,
    chest: ui.chest.checked,
    status: ui.hudStatus.checked,
    message: ui.hudMessage.checked,
    name: ui.name.value.trim(),
    enemies: readEnemies(),
    msgIndex: state.msgIndex,
  };
}

// still：撮影用の1枚（点滅するものは必ず表示）
function render(t, dt, still = false) {
  const { scene, fx } = state;
  if (!scene) return;
  const f = { t, dt, W, H, still, opts: readOpts() };
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;

  // 背景と、人物より奥の演出（画面ゆれはここだけにかける）
  ctx.save();
  const [sx, sy] = fx.shakeOffset ? fx.shakeOffset(t, dt) : [0, 0];
  ctx.translate(sx, sy);
  ctx.drawImage(bg, -16, -16, W + 32, H + 32);
  ctx.restore();
  if (fx.drawBehind) {
    ctx.save();
    ctx.translate(sx, sy);
    fx.drawBehind(ctx, f);
    ctx.restore();
  }

  // 人物
  if (person.canvas.width > 0) {
    const aspect = person.canvas.width / person.canvas.height;
    const r = placement.layout(person.bbox, aspect, parseFloat(ui.scale.value));
    state.lastLayout = r;
    if (fx.setPersonX) fx.setPersonX((r.feet ? r.feet.x : r.x + r.w / 2) / W);
    if (r.feet) drawFootShadow(r);
    drawPerson(r);
  }

  if (fx.drawFront) fx.drawFront(ctx, f);
  if (ui.embers.checked && scene.embers !== false) embers.draw(ctx, W, H, t, dt);

  // 周辺を少し暗く
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (fx.drawHud) {
    fx.drawHud(ctx, f);
  } else {
    const msgs = sceneMessages();
    drawRpgHud(ctx, W, H, {
      name: f.opts.name,
      message: fillMessage(messageText(msgs[state.msgIndex % msgs.length]), f.opts.name),
      showStatus: f.opts.status,
      showMessage: f.opts.message,
      messageTop: !!scene.messageTop,
    });
  }
  // メッセージが下にある部屋は右上、上にある部屋は右下
  drawStamp(ctx, W, H, { corner: scene.messageTop ? 'bottom' : 'top' });
}

function drawFootShadow(r) {
  const { x, y } = r.feet;
  const rad = r.h * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.25);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
  sg.addColorStop(0, `rgba(0,0,0,${state.scene.id === 'magic' ? 0.4 : 0.55})`);
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
  ctx.restore();
}

function drawPerson(r) {
  const block = parseInt(ui.pixel.value, 10);
  if (block > 0) {
    // ドット絵化：縮小してから拡大（ぼかしなし）
    const pw = Math.max(1, Math.round(r.w / block)), ph = Math.max(1, Math.round(r.h / block));
    if (pixelCv.width !== pw || pixelCv.height !== ph) { pixelCv.width = pw; pixelCv.height = ph; }
    pxCtx.clearRect(0, 0, pw, ph);
    pxCtx.imageSmoothingEnabled = true;
    pxCtx.drawImage(person.canvas, 0, 0, pw, ph);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelCv, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.drawImage(person.canvas, r.x, r.y, r.w, r.h);
  }
}

// ---------- 設定 ----------
// ドット絵化の粗さは端末に記憶する
const savedPixel = load('pixel');
if (PIXEL_LEVELS.includes(savedPixel)) ui.pixel.value = savedPixel;
ui.pixel.addEventListener('change', () => save('pixel', ui.pixel.value));
bindSoundToggle(ui.sound);

// 戦闘画面のてき（名前が空の行は出さない）
const enemyRows = [...document.querySelectorAll('#battleFields .enemy-row')];
enemyRows.forEach((row, i) => {
  const sel = row.querySelector('.enemy-count');
  for (let n = 1; n <= 9; n++) sel.add(new Option(String(n), String(n)));
  sel.value = String(i + 1 <= 2 ? i + 1 : 1);
});
function readEnemies() {
  return enemyRows
    .map((row) => ({
      name: row.querySelector('.enemy-name').value.trim(),
      count: parseInt(row.querySelector('.enemy-count').value, 10),
    }))
    .filter((e) => e.name);
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
  play('select');
});

ui.scene.addEventListener('change', () => { applyScene().catch((err) => console.error(err)); });

$('summon').addEventListener('click', () => {
  if (!state.fx.summon) return;
  state.fx.summon();
  state.msgIndex = 0;
  ui.hudMessage.checked = true;
});
$('attack').addEventListener('click', () => {
  if (!state.fx.attack) return;
  state.fx.attack();
  state.msgIndex = 2;
  ui.hudMessage.checked = true;
});

$('msgNext').addEventListener('click', () => {
  state.msgIndex = (state.msgIndex + 1) % sceneMessages().length;
  ui.hudMessage.checked = true;
  if (state.fx.onMessage) state.fx.onMessage(state.msgIndex);
  else play('select');
});

$('shoot').addEventListener('click', async () => {
  const btn = $('shoot');
  btn.disabled = true;
  await countdown($('countdown'), parseInt(ui.timer.value, 10), (n) => play('tick', n));
  flash($('flash'));
  play('shutter');
  if (state.fx.onShutter) await state.fx.onShutter();
  render(performance.now() / 1000, 0, true);
  state.paused = true;
  await showResult($('result'), view);
  state.paused = false;
  btn.disabled = false;
});

// 立ち位置：自動に戻すボタン
function paintAutoFit() {
  ui.autoFit.setAttribute('aria-pressed', String(placement.mode === 'auto'));
  ui.autoFit.textContent = placement.mode === 'auto' ? '立ち位置：自動' : '立ち位置を自動にもどす';
}
ui.autoFit.addEventListener('click', () => {
  placement.setAuto();
  paintAutoFit();
  play('select');
});

// ドラッグで移動、2本指ピンチで拡大縮小（さわると手動に切り替わる）
const pointers = new Map();
let pinchStart = null;
const toCanvas = (e) => {
  const r = view.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
};
view.addEventListener('pointerdown', (e) => {
  view.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toCanvas(e));
  placement.startManual(state.lastLayout, person.bbox, parseFloat(ui.scale.value));
  paintAutoFit();
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
    placement.move(cur.x - prev.x, cur.y - prev.y);
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
