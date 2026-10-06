// モードB：ポスター（ダンジョン画像）をカメラでうつすと、3Dのゴーレムまたはつばめいが出現する
//   つばめいは実物大（1.2m）。印刷したポスターの横幅から、ポスター座標→メートルを換算する
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { createGolem, createChest, createEmbers } from '../models/golem.js';
import { createTsubamei } from '../models/tsubamei.js';
import { MESSAGES, fillMessage, drawRpgHud, drawStamp, ensureFont } from '../common/rpg-ui.js';
import { countdown, flash, showResult } from '../common/capture.js';
import { initialFacing, rememberFacing, bindCameraSelect, cameraErrorText, showError } from '../common/camera.js';
import { play, bindSoundToggle } from '../common/sound.js';
import { load, save } from '../common/storage.js';

const $ = (id) => document.getElementById(id);
const container = $('ar');
const ui = {
  name: $('name'), mount: $('mount'), size: $('size'), offsetX: $('offsetX'),
  timer: $('timer'), chest: $('chest'), hud: $('hud'),
  chara: $('chara'), posterWidth: $('posterWidth'), posterBottom: $('posterBottom'),
};

// よびだすキャラ：URLの ?chara=tsubamei で最初から選べる
const charaParam = new URLSearchParams(location.search).get('chara');
if (charaParam === 'tsubamei') ui.chara.value = 'tsubamei';
const isTsubamei = () => ui.chara.value === 'tsubamei';

// つばめいのセリフ（ポーズに合わせる）
const TSUBAMEI_MESSAGES = {
  appear: 'つばめいが あらわれた！',
  stand: 'つばめいは {name}を じっと みている',
  wave: 'つばめいが {name}に てを ふっている！',
  banzai: 'つばめいは うれしそうに はねを ひろげた！',
  shy: 'つばめいは ちょっぴり てれている…',
  fly: 'つばめいは そらへ まいあがった！',
};
const messageList = () => (isTsubamei() ? Object.values(TSUBAMEI_MESSAGES) : MESSAGES);

// ポスターの大きさ・高さは係が一度入れたら端末に記憶する
for (const key of ['posterWidth', 'posterBottom']) {
  const v = load(key);
  if (v) ui[key].value = v;
  ui[key].addEventListener('change', () => save(key, ui[key].value));
}

// キャラごとのポスター（認識データと、縦横比＝幅を1としたときの高さ）
//   ゴーレム：ダンジョンの絵（marker.html）、つばめい：つばめいのポスター（tsubamei-marker.html）
const POSTERS = {
  golem: { mind: 'assets/targets.mind', aspect: 1024 / 1536 },
  tsubamei: { mind: 'assets/tsubamei.mind', aspect: 1754 / 1240 },
};
const poster = POSTERS[ui.chara.value];
if (ui.chara.value === 'tsubamei') $('status').innerHTML = 'つばめいのポスターを<br>カメラにうつしてください';
const TARGET_ASPECT = poster.aspect;

const mindar = new MindARThree({
  container,
  imageTargetSrc: poster.mind,
  uiScanning: 'no',
  uiLoading: 'no',
  uiError: 'no',
  filterMinCF: 0.0001, // 揺れを抑える
  filterBeta: 0.001,
  missTolerance: 10,
});
const { renderer, scene, camera } = mindar;
let facing = initialFacing('ar', 'environment');
mindar.shouldFaceUser = facing === 'user';
renderer.outputColorSpace = THREE.SRGBColorSpace;
const anchor = mindar.addAnchor(0);

// ポスターを見失っても最後の位置にゴーレムを残すため、anchor とは別のグループに姿勢をコピーする
const world = new THREE.Group();
world.matrixAutoUpdate = false;
world.visible = false;
scene.add(world);

const stand = new THREE.Group(); // 壁／床の向きを切り替える
world.add(stand);

const golem = createGolem();
const chest = createChest();
const embers = createEmbers(50, 1.6);
const tsubamei = createTsubamei();
stand.add(golem, chest, embers, tsubamei);
const activeModel = () => (isTsubamei() ? tsubamei : golem);

// 照明：たいまつの暖色と、ダンジョンの青い環境光（つばめいのときは色を付けない）
const hemi = new THREE.HemisphereLight(0x9fb0ff, 0x3a2414, 1.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd0a0, 1.6);
sun.position.set(-1, 2, 3);
scene.add(sun);
const torch = new THREE.PointLight(0xff8a30, 2.5, 6, 1.5);
stand.add(torch);

function layout() {
  const s = parseFloat(ui.size.value);
  const ox = parseFloat(ui.offsetX.value);
  const t = isTsubamei();
  document.body.dataset.chara = ui.chara.value;
  document.body.dataset.mount = ui.mount.value;
  if (ui.mount.value === 'wall') {
    // 壁：ポスターの下端に立ち、手前にせり出す
    stand.rotation.set(0, 0, 0);
    stand.position.set(0, -TARGET_ASPECT / 2, 0.15);
  } else {
    // 床：ポスター面から上に立つ（ローカルY → ポスターの法線）
    stand.rotation.set(Math.PI / 2, 0, 0);
    stand.position.set(0, 0, 0);
  }
  golem.scale.setScalar(s);
  golem.position.set(ox, 0, 0);
  chest.scale.setScalar(s * 0.8);
  chest.position.set(ox + s * 0.8, 0, s * 0.15);
  chest.visible = ui.chest.checked && !t;
  embers.scale.setScalar(s);
  embers.position.set(ox, 0, 0);
  torch.position.set(ox - s * 0.8, s * 1.4, s * 0.8);
  golem.visible = embers.visible = torch.visible = !t;

  // つばめい：1m＝ポスターの横幅の 1/幅(m) 倍。かべに貼ったときは床まで下げ、少し手前に立たせる
  const perMeter = 100 / Math.max(10, parseFloat(ui.posterWidth.value) || 21);
  const wall = ui.mount.value === 'wall';
  const bottom = (parseFloat(ui.posterBottom.value) || 0) / 100;
  tsubamei.visible = t;
  tsubamei.scale.setScalar(perMeter);
  tsubamei.position.set(ox, wall ? -bottom * perMeter : 0, wall ? 0.3 * perMeter : 0);
  hemi.color.set(t ? 0xffffff : 0x9fb0ff);
  hemi.groundColor.set(t ? 0x807080 : 0x3a2414);
  sun.color.set(t ? 0xffffff : 0xffd0a0);
  $('attack').textContent = t ? 'ポーズ' : 'こうげき';
}
for (const el of [ui.size, ui.offsetX, ui.mount, ui.chest, ui.posterWidth, ui.posterBottom]) el.addEventListener('input', layout);
// キャラを変えると、うつすポスターも変わるので、そのキャラのページを開きなおす
ui.chara.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('chara', ui.chara.value);
  location.replace(url.href);
});
layout();

// ---------- メッセージ ----------
let msgIndex = 0;
let typeTimer = null;
function say(text) {
  const el = $('msg');
  el.hidden = !ui.hud.checked;
  el.dataset.text = text;
  clearInterval(typeTimer);
  let i = 0;
  const chars = [...text];
  el.textContent = '＊「';
  typeTimer = setInterval(() => {
    i++;
    el.textContent = '＊「' + chars.slice(0, i).join('') + (i >= chars.length ? '」' : '');
    if (i >= chars.length) clearInterval(typeTimer);
  }, 45);
}
const playerName = () => ui.name.value.trim();

// ---------- 追跡 ----------
let everFound = false;
anchor.onTargetFound = () => {
  $('status').hidden = true;
  if (!everFound) {
    everFound = true;
    world.visible = true;
    activeModel().userData.appear();
    play('summon');
    say(fillMessage(messageList()[0], playerName()));
    $('shoot').disabled = false;
  }
};

// ---------- ループ ----------
const clock = new THREE.Clock();
let shakeUntil = 0;
function tick() {
  const dt = Math.min(0.1, clock.getDelta());
  const t = clock.elapsedTime;
  if (anchor.visible) world.matrix.copy(anchor.group.matrix);
  activeModel().userData.update(dt);
  embers.userData.update(dt, t);
  torch.intensity = 2.2 + Math.sin(t * 13) * 0.25 + Math.sin(t * 7.3) * 0.25;

  // こうげきの振り下ろしで画面をゆらす
  const phase = isTsubamei() ? -1 : golem.userData.attackPhase();
  if (phase > 0.55 && phase < 0.6 && performance.now() > shakeUntil) {
    shakeUntil = performance.now() + 400;
    play('hit');
    container.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-8px,6px)' }, { transform: 'translate(7px,-5px)' }, { transform: 'translate(0,0)' }],
      { duration: 300 }
    );
  }
  renderer.render(scene, camera);
}

// ---------- 撮影 ----------
function capture() {
  const cr = container.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const out = document.createElement('canvas');
  out.width = Math.round(cr.width * scale);
  out.height = Math.round(cr.height * scale);
  const ctx = out.getContext('2d');

  // カメラ映像（画面に表示されている範囲と同じ切り取り）
  // インカメラは画面と同じ鏡像にする
  ctx.save();
  if (facing === 'user') { ctx.translate(out.width, 0); ctx.scale(-1, 1); }
  const video = mindar.video;
  const vw = video.offsetWidth, vh = video.offsetHeight;
  const vx = (cr.width - vw) / 2, vy = (cr.height - vh) / 2;
  ctx.drawImage(video, vx * scale, vy * scale, vw * scale, vh * scale);

  // 3D（描画直後ならバッファが残っている）
  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
  ctx.restore();

  if (ui.hud.checked) {
    drawRpgHud(ctx, out.width, out.height, {
      name: playerName(),
      message: $('msg').dataset.text || fillMessage(messageList()[0], playerName()),
      showStatus: true,
      showMessage: true,
    });
  }
  drawStamp(ctx, out.width, out.height, { corner: 'top' });
  return out;
}

$('shoot').addEventListener('click', async () => {
  const btn = $('shoot');
  btn.disabled = true;
  const msg = $('msg');
  const msgWasHidden = msg.hidden;
  await countdown($('countdown'), parseInt(ui.timer.value, 10), (n) => play('tick', n));
  msg.hidden = true;
  flash($('flash'));
  play('shutter');
  const shot = capture();
  msg.hidden = msgWasHidden;
  // 撮影結果を表示している間は、認識と3D描画を止める
  renderer.setAnimationLoop(null);
  mindar.controller.stopProcessVideo();
  await showResult($('result'), shot);
  mindar.controller.processVideo(mindar.video);
  clock.getDelta();
  renderer.setAnimationLoop(tick);
  btn.disabled = false;
});

$('attack').addEventListener('click', () => {
  if (!everFound) return;
  if (isTsubamei()) {
    // つばめい：すぐに次のポーズへ
    const pose = tsubamei.userData.nextPose();
    play('select');
    say(fillMessage(TSUBAMEI_MESSAGES[pose], playerName()));
    return;
  }
  golem.userData.attack();
  play('swing');
  say(fillMessage(MESSAGES[2], playerName()));
});

$('msgNext').addEventListener('click', () => {
  msgIndex = (msgIndex + 1) % messageList().length;
  ui.hud.checked = true;
  say(fillMessage(messageList()[msgIndex], playerName()));
  play('select');
});

ui.hud.addEventListener('change', () => { $('msg').hidden = !ui.hud.checked || !everFound; });
// カメラの切替：ARを止めて、選んだカメラで起動しなおす
bindCameraSelect($('camsel'), facing, async (next) => {
  const loading = $('loading');
  $('loadingText').textContent = 'カメラを切り替えています…';
  loading.hidden = false;
  mindar.stop();
  resetTracking();
  try {
    await startAR(next);
  } catch (err) {
    await startAR(facing).catch(() => {});
    throw err || new Error('camera');
  } finally {
    loading.hidden = true;
  }
  facing = next;
  rememberFacing('ar', next);
});

async function startAR(f) {
  mindar.shouldFaceUser = f === 'user';
  container.classList.toggle('mirror', f === 'user');
  await mindar.start();
}

// 切替後はもう一度ポスターを認識して、ゴーレムを登場させなおす
function resetTracking() {
  everFound = false;
  anchor.visible = false; // MindAR は停止しても認識中フラグを戻さないため
  world.visible = false;
  $('status').hidden = false;
  $('msg').hidden = true;
  $('shoot').disabled = true;
}

$('toggleSettings').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
bindSoundToggle($('sound'));

// ---------- 起動 ----------
(async () => {
  try {
    await ensureFont();
    await startAR(facing);
  } catch (err) {
    console.error(err);
    showError($('loading'), 'ARを起動できません', cameraErrorText(err));
    return;
  }
  $('loading').hidden = true;
  renderer.setAnimationLoop(tick);
})();
