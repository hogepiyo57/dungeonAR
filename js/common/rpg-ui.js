// RPG風ウィンドウ・メッセージ・記念スタンプを canvas に描く共通処理

export const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif';

// 場面ごとのセリフが無いときの共通セリフ
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

// すべての部屋で共通の角丸ウィンドウ（黒地＋内側に白い線）
// opaque：背景に描かれた元の文字を隠したいときは不透明で塗る
export function drawWindow(ctx, x, y, w, h, unit, { opaque = false } = {}) {
  const r = unit * 1.2;
  ctx.save();
  ctx.fillStyle = opaque ? '#000' : 'rgba(0,0,0,0.88)';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = unit * 0.45;
  ctx.strokeStyle = '#f4f4f4';
  roundRect(ctx, x + unit * 0.5, y + unit * 0.5, w - unit, h - unit, r * 0.7);
  ctx.stroke();
  ctx.restore();
}

// ウィンドウの大きさの基準（すべての部屋で同じ見た目にそろえる）
export const hudUnit = (W, H) => Math.min(W, H) / 70;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 左上のステータスウィンドウと、メッセージウィンドウ（通常は画面下部）
// messageTop: true のときはメッセージをステータスの右に置き、画面下部（足元）をあける
export function drawRpgHud(ctx, W, H, { name, message, showStatus = true, showMessage = true, level = 1, messageTop = false }) {
  const unit = hudUnit(W, H);
  ctx.save();
  ctx.textBaseline = 'top';
  let statusRight = 0;

  if (showStatus) {
    const fs = unit * 2.6;
    ctx.font = `${fs}px ${FONT}`;
    const label = (name || 'ゆうしゃ').slice(0, 8);
    const w = Math.max(unit * 18, ctx.measureText(label).width + unit * 5);
    const h = unit * 16.5;
    const x = unit * 2, y = unit * 2;
    drawWindow(ctx, x, y, w, h, unit);
    statusRight = x + w;
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
    const x = messageTop && statusRight ? statusRight + unit * 1.5 : unit * 2;
    const w = W - x - unit * 2;
    const lines = wrapText(ctx, message, w - unit * 6 - ctx.measureText('＊「」').width);
    const h = unit * 3.6 + lines.length * fs * 1.45 + unit * 1.4;
    const y = messageTop ? unit * 2 : H - h - unit * 2;
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

// 写真の隅に入れる記念スタンプ「つばめ祭 2026.10.02」（日付は撮影した日）
// corner：'top'＝右上、'bottom'＝右下（メッセージウィンドウと重ならない側を選ぶ）
export function drawStamp(ctx, W, H, { corner = 'bottom', date = new Date() } = {}) {
  const p = (n) => String(n).padStart(2, '0');
  const text = `つばめ祭 ${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())}`;
  const fs = Math.round(Math.min(W, H) * 0.028);
  ctx.save();
  ctx.font = `${fs}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = corner === 'top' ? 'top' : 'bottom';
  const x = W - fs * 0.6, y = corner === 'top' ? fs * 0.45 : H - fs * 0.35;
  ctx.lineJoin = 'round';
  ctx.lineWidth = fs * 0.28;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff6e0';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// フォント読み込みを待つ（canvas描画前に必要）
export async function ensureFont() {
  try {
    await document.fonts.load(`20px "DotGothic16"`, 'ゴーレムがあらわれたつばめ祭');
  } catch { /* フォントが無くても代替フォントで続行 */ }
}
