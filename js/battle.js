// 戦闘画面のウィンドウ（参考画像 石造りの地下墓所で戦闘準備.png と同じ位置に描き直す）
import { FONT } from './rpg.js';

// battle.jpg（1536x1024）に描かれているウィンドウの外枠。少し大きめに塗って元の文字を隠す
const PARTY_WIN = { x: 288, y: 33, w: 960, h: 235 };
const COMMAND_WIN = { x: 106, y: 735, w: 614, h: 240 };
const ENEMY_WIN = { x: 725, y: 735, w: 697, h: 240 };

const PARTY = [
  { name: 'ゆうしゃ', h: 333, m: 230, lv: 71 },
  { name: 'せんし', h: 447, m: 363, lv: 56 },
  { name: 'まほうつかい', h: 304, m: 243, lv: 65 },
  { name: 'そうりょ', h: 444, m: 145, lv: 42 },
];
const COMMANDS = [['こうげき', 'とくぎ'], ['じゅもん', 'どうぐ'], ['ぼうぎょ', 'そうび']];

// 数え方：1ぴき 2ひき 3びき …
export function countLabel(n) {
  if ([1, 6, 8, 10].includes(n)) return `${n}ぴき`;
  if (n === 3) return `${n}びき`;
  return `${n}ひき`;
}

function battleWindow(ctx, { x, y, w, h }) {
  ctx.save();
  ctx.fillStyle = '#080a1c'; // 不透明にして、絵に描かれた元の文字を完全に隠す
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f4f4f4';
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 8);
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

// 文字幅が枠に収まらないときは横に縮める
function fitText(ctx, text, x, y, maxW) {
  const w = ctx.measureText(text).width;
  if (w <= maxW) { ctx.fillText(text, x, y); return; }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(maxW / w, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// leader：パーティ先頭の名前、enemies：[{ name, count }]、cursorOn：▶ を表示するか
export function drawBattleHud(ctx, { leader, enemies, showParty = true, showBottom = true, cursorOn = true }) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f4f4f4';

  if (showParty) {
    const win = PARTY_WIN;
    battleWindow(ctx, win);
    // 名前の下の区切り線
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(win.x + 20, 107, win.w - 40, 5);
    const colW = (win.w - 70) / 4;
    PARTY.forEach((p, i) => {
      const x = win.x + 46 + i * colW;
      const name = i === 0 && leader ? leader : p.name;
      ctx.font = `38px ${FONT}`;
      fitText(ctx, name, x, 56, colW - 14);
      ctx.font = `40px ${FONT}`;
      ctx.fillText(`H ${String(p.h).padStart(3)}`, x, 120);
      ctx.fillText(`M ${String(p.m).padStart(3)}`, x, 163);
      ctx.fillText(`Lv:${String(p.lv).padStart(3)}`, x, 206);
    });
  }

  if (showBottom) {
    // コマンド
    const cw = COMMAND_WIN;
    battleWindow(ctx, cw);
    ctx.font = `44px ${FONT}`;
    ctx.fillStyle = '#f4f4f4';
    COMMANDS.forEach((row, r) => {
      row.forEach((label, c) => {
        ctx.fillText(label, cw.x + 88 + c * 296, cw.y + 34 + r * 64);
      });
    });
    if (cursorOn) {
      // ▶ カーソル
      const cx = cw.x + 48, cy = cw.y + 42;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 24, cy + 18);
      ctx.lineTo(cx, cy + 36);
      ctx.closePath();
      ctx.fill();
    }

    // てき
    const ew = ENEMY_WIN;
    battleWindow(ctx, ew);
    ctx.font = `44px ${FONT}`;
    ctx.fillStyle = '#f4f4f4';
    enemies.slice(0, 3).forEach((e, i) => {
      const y = ew.y + 34 + i * 64;
      fitText(ctx, e.name, ew.x + 50, y, 340);
      ctx.fillText(countLabel(e.count), ew.x + 420, y);
    });
  }
  ctx.restore();
}
