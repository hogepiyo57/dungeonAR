// 戦闘画面：自分がモンスターとして中央に立つ。
// ウィンドウは参考画像（石造りの地下墓所で戦闘準備.png）と同じ位置に、ほかの部屋と同じ形で描き直す
import { FONT, drawWindow, hudUnit } from '../common/rpg-ui.js';

// battle.jpg（1536x1024）に描かれているウィンドウの外枠。少し大きめに不透明で塗って元の文字を隠す
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

function drawBattleHud(ctx, { W, H, enemies, showParty, showBottom, cursorOn }) {
  const unit = hudUnit(W, H);
  const win = (r) => drawWindow(ctx, r.x, r.y, r.w, r.h, unit, { opaque: true });
  ctx.save();
  ctx.textBaseline = 'top';

  if (showParty) {
    win(PARTY_WIN);
    // 名前の下の区切り線
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(PARTY_WIN.x + 24, 107, PARTY_WIN.w - 48, 4);
    const colW = (PARTY_WIN.w - 70) / 4;
    PARTY.forEach((p, i) => {
      const x = PARTY_WIN.x + 46 + i * colW;
      ctx.font = `38px ${FONT}`;
      fitText(ctx, p.name, x, 56, colW - 14);
      ctx.font = `40px ${FONT}`;
      ctx.fillText(`H ${String(p.h).padStart(3)}`, x, 120);
      ctx.fillText(`M ${String(p.m).padStart(3)}`, x, 163);
      ctx.fillText(`Lv:${String(p.lv).padStart(3)}`, x, 206);
    });
  }

  if (showBottom) {
    // コマンド
    const cw = COMMAND_WIN;
    win(cw);
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
    win(ew);
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

export default {
  id: 'battle',
  src: 'assets/battle.jpg', w: 1536, h: 1024,
  stand: { cx: 768, feetY: 770, height: 470 }, // 上下のウィンドウのあいだ
  enterSound: 'encounter',
  ui: { battleFields: true, hideName: true, hideMsgNext: true },

  async create() {
    return {
      drawHud(ctx, f) {
        drawBattleHud(ctx, {
          W: f.W,
          H: f.H,
          enemies: f.opts.enemies,
          showParty: f.opts.status,
          showBottom: f.opts.message,
          cursorOn: f.still || Math.floor(f.t * 2) % 2 === 0, // 撮影時は必ず表示
        });
      },
    };
  },
};
