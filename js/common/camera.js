// カメラ選択（インカメラ user ／ アウトカメラ environment）とエラー表示
import { load, save } from './storage.js';

export function cameraErrorText(err) {
  if (!window.isSecureContext) return 'カメラは https のページでしか使えません。GitHub Pages のURLから開いてください。';
  if (err && err.name === 'NotAllowedError') return 'カメラの使用が許可されていません。ブラウザの設定でカメラを許可してから再読み込みしてください。';
  if (err && err.name === 'NotFoundError') return 'カメラが見つかりませんでした。';
  return `カメラを起動できませんでした（${err && err.message ? err.message : err}）。`;
}

// 読み込み中の画面をエラー表示に切り替える
export function showError(el, title, detail) {
  el.hidden = false;
  el.querySelector('.win').innerHTML = `<h2>${title}</h2><p>${detail}</p><p><a href="index.html">もどる</a></p>`;
}

// 優先順位：URLの ?camera=user|environment → 前回の選択 → ページごとの既定値
export function initialFacing(pageKey, fallback) {
  const q = new URLSearchParams(location.search).get('camera');
  if (q === 'user' || q === 'environment') return q;
  const saved = load(`camera.${pageKey}`);
  if (saved === 'user' || saved === 'environment') return saved;
  return fallback;
}

export function rememberFacing(pageKey, facing) {
  save(`camera.${pageKey}`, facing);
}

// .camsel 内の [data-facing] ボタンを選択式にする。onChange は Promise を返してよい
export function bindCameraSelect(root, current, onChange) {
  const buttons = [...root.querySelectorAll('[data-facing]')];
  const paint = (f) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.facing === f)));
  paint(current);
  buttons.forEach((b) => b.addEventListener('click', async () => {
    const next = b.dataset.facing;
    if (next === current) return;
    buttons.forEach((x) => { x.disabled = true; });
    try {
      await onChange(next);
      current = next;
    } catch (err) {
      alert(cameraErrorText(err));
    }
    paint(current);
    buttons.forEach((x) => { x.disabled = false; });
  }));
}
