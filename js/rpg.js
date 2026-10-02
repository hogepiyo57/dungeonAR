// RPG風ウィンドウを canvas に描くための共通処理と、撮影・保存まわりのユーティリティ

export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';

export const MESSAGES = [
  'ゴーレムが あらわれた！',
  '{name}は ゆうきを ふりしぼった！',
  'ゴーレムの こうげき！ {name}は ひらりと かわした！',
  '{name}は たからばこを みつけた！',
  '{name}たちは ゴーレムを たおした！',
];

export function fillMessage(template, name) {
  return template.replaceAll('{name}', name || 'ゆうしゃ');
}

// 角丸の二重枠ウィンドウ
export function drawWindow(ctx, x, y, w, h, unit) {
  const r = unit * 1.2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = unit * 0.45;
  ctx.strokeStyle = '#f4f4f4';
  roundRect(ctx, x + unit * 0.5, y + unit * 0.5, w - unit, h - unit, r * 0.7);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 画面下部のメッセージウィンドウと左上のステータスウィンドウ
export function drawRpgHud(ctx, W, H, { name, message, showStatus = true, showMessage = true, level = 1 }) {
  const unit = Math.min(W, H) / 70;
  ctx.save();
  ctx.textBaseline = 'top';

  if (showStatus) {
    const fs = unit * 2.6;
    ctx.font = `${fs}px ${FONT}`;
    const label = (name || 'ゆうしゃ').slice(0, 8);
    const w = Math.max(unit * 18, ctx.measureText(label).width + unit * 5);
    const h = unit * 16.5;
    const x = unit * 2, y = unit * 2;
    drawWindow(ctx, x, y, w, h, unit);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillText(label, x + unit * 2.4, y + unit * 1.8);
    ctx.fillStyle = '#ffb43a';
    ctx.fillText(`Lv ${level}`, x + unit * 2.4, y + unit * 5.1);
    ctx.fillStyle = '#f4f4f4';
    ctx.fillText(`H  ${String(99).padStart(3)}`, x + unit * 2.4, y + unit * 8.4);
    ctx.fillText(`M  ${String(12).padStart(3)}`, x + unit * 2.4, y + unit * 11.7);
  }

  if (showMessage && message) {
    const fs = unit * 3.1;
    ctx.font = `${fs}px ${FONT}`;
    const x = unit * 2, w = W - unit * 4;
    const lines = wrapText(ctx, message, w - unit * 6 - ctx.measureText('＊「」').width);
    const h = unit * 3.6 + lines.length * fs * 1.45 + unit * 1.4;
    const y = H - h - unit * 2;
    drawWindow(ctx, x, y, w, h, unit);
    ctx.fillStyle = '#f4f4f4';
    lines.forEach((line, i) => {
      ctx.fillText((i === 0 ? '＊「' : '　 ') + line + (i === lines.length - 1 ? '」' : ''), x + unit * 2.4, y + unit * 2.2 + i * fs * 1.45);
    });
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// フォント読み込みを待つ（canvas描画前に必要）
export async function ensureFont() {
  try {
    await document.fonts.load(`20px "DotGothic16"`, 'ゴーレムがあらわれた');
  } catch { /* フォントが無くても代替フォントで続行 */ }
}

// 3・2・1 のカウントダウン
export async function countdown(el, seconds) {
  if (!seconds) return;
  el.hidden = false;
  for (let i = seconds; i > 0; i--) {
    el.textContent = i;
    await new Promise((r) => setTimeout(r, 900));
  }
  el.hidden = true;
}

export function flash(el) {
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// 撮影結果モーダル：共有（iPhone/Androidの写真保存）とダウンロードに対応
export function showResult(modal, canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `dungeon-${timestamp()}.jpg`, { type: 'image/jpeg' });
      const img = modal.querySelector('img');
      img.src = url;
      modal.hidden = false;

      const shareBtn = modal.querySelector('[data-act="share"]');
      const dlBtn = modal.querySelector('[data-act="download"]');
      const closeBtn = modal.querySelector('[data-act="close"]');
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      shareBtn.hidden = !canShare;

      const cleanup = () => {
        modal.hidden = true;
        URL.revokeObjectURL(url);
        shareBtn.onclick = dlBtn.onclick = closeBtn.onclick = null;
        resolve();
      };
      shareBtn.onclick = async () => {
        try { await navigator.share({ files: [file], title: 'ダンジョンAR' }); } catch { /* キャンセル */ }
      };
      dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
      };
      closeBtn.onclick = cleanup;
    }, 'image/jpeg', 0.92);
  });
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function showError(el, title, detail) {
  el.hidden = false;
  el.querySelector('.win').innerHTML = `<h2>${title}</h2><p>${detail}</p><p><a href="index.html">もどる</a></p>`;
}

export function cameraErrorText(err) {
  if (!window.isSecureContext) return 'カメラは https のページでしか使えません。GitHub Pages のURLから開いてください。';
  if (err && err.name === 'NotAllowedError') return 'カメラの使用が許可されていません。ブラウザの設定でカメラを許可してから再読み込みしてください。';
  if (err && err.name === 'NotFoundError') return 'カメラが見つかりませんでした。';
  return `カメラを起動できませんでした（${err && err.message ? err.message : err}）。`;
}
