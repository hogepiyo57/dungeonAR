// 効果音（音声ファイルは使わず、ブラウザで8ビット風の音を合成する）
// ブラウザは「画面に一度ふれるまで音を出せない」ので、最初のタップで音を有効にする
import { load, save } from './storage.js';

let ac = null;
let master = null;
let enabled = load('sound') !== 'off';

function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
}
['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true }));

export function isSoundOn() { return enabled; }
export function setSoundOn(on) {
  enabled = on;
  save('sound', on ? 'on' : 'off');
}

// 音のチェックボックスをつなぐ
export function bindSoundToggle(checkbox) {
  if (!checkbox) return;
  checkbox.checked = enabled;
  checkbox.addEventListener('change', () => {
    setSoundOn(checkbox.checked);
    if (checkbox.checked) play('select');
  });
}

const ready = () => enabled && ac && ac.state === 'running';

// 1音：type は square / triangle / sawtooth、freq は Hz か [開始, 終了]
function tone(at, dur, freq, { type = 'square', vol = 0.5, slide = 'exp' } = {}) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  const [f0, f1] = Array.isArray(freq) ? freq : [freq, freq];
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) {
    if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    else o.frequency.linearRampToValueAtTime(f1, at + dur);
  }
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

// ノイズ（足音・衝撃・シャッター）
function noise(at, dur, { vol = 0.5, filter = 'lowpass', from = 2000, to = 200 } = {}) {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master);
  src.start(at);
  src.stop(at + dur + 0.02);
}

const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // 0 = ド(C4)

const SOUNDS = {
  // ボタン
  select(t) { tone(t, 0.05, 1320, { vol: 0.25 }); },
  // カウントダウン（残り1秒だけ高い音）
  tick(t, n) { tone(t, 0.12, n === 1 ? 1320 : 880, { vol: 0.35 }); },
  // シャッター：カシャ＋キラーン
  shutter(t) {
    noise(t, 0.07, { vol: 0.6, filter: 'highpass', from: 5000, to: 1500 });
    noise(t + 0.09, 0.05, { vol: 0.4, filter: 'highpass', from: 4000, to: 1200 });
    [12, 16, 19, 24].forEach((s, i) => tone(t + 0.16 + i * 0.06, 0.12, N(s + 12), { vol: 0.22 }));
  },
  // ゴーレム登場：地鳴り＋低い咆哮
  summon(t) {
    noise(t, 1.3, { vol: 0.7, from: 400, to: 60 });
    for (let i = 0; i < 6; i++) noise(t + i * 0.2, 0.12, { vol: 0.5, from: 300, to: 80 });
    tone(t + 0.3, 0.9, [140, 55], { type: 'sawtooth', vol: 0.25 });
  },
  // こうげき：ふりかぶり（風を切る音）
  swing(t) { noise(t, 0.35, { vol: 0.35, filter: 'bandpass', from: 600, to: 3000 }); },
  // こうげき：振り下ろしの衝撃
  hit(t) {
    noise(t, 0.4, { vol: 0.9, from: 1200, to: 60 });
    tone(t, 0.3, [120, 40], { vol: 0.5 });
  },
  // 魔法陣の発動：上昇するきらめき
  magic(t) {
    [0, 4, 7, 11, 12, 16, 19, 23, 24].forEach((s, i) => {
      tone(t + i * 0.045, 0.22, N(s + 12), { type: 'triangle', vol: 0.3 });
      tone(t + i * 0.045 + 0.02, 0.18, N(s + 24), { type: 'square', vol: 0.06 });
    });
    tone(t, 0.9, [N(0), N(24)], { type: 'triangle', vol: 0.12, slide: 'lin' });
  },
  // 戦闘開始：すばやく上下する音
  encounter(t) {
    for (let i = 0; i < 14; i++) {
      const s = [0, 7, 12, 7][i % 4] + Math.floor(i / 4) * 2;
      tone(t + i * 0.04, 0.05, N(s + 12), { vol: 0.25 });
    }
    noise(t + 0.56, 0.25, { vol: 0.35, filter: 'highpass', from: 3000, to: 800 });
  },
};

export function play(name, arg) {
  if (!ready() || !SOUNDS[name]) return;
  SOUNDS[name](ac.currentTime + 0.01, arg);
}
