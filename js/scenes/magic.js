// 魔法陣の間：お城の部屋で、光る魔法陣の上に立つ。魔法陣の色はセリフに合わせて変わる
import { createMagicCircle } from '../effects/magic-circle.js';
import { play } from '../common/sound.js';

export default {
  id: 'magic',
  src: 'assets/castle.jpg', w: 1292, h: 1025,
  stand: { cx: 640, feetY: 845, height: 560 }, // 魔法陣の中心に立つ
  messageTop: true,                             // 足元の魔法陣を隠さない
  enterSound: 'magic',
  embers: false,                                // 魔法陣の光の粒を使う
  messages: [
    { text: '{name}は　かえんまほうをつかった！', color: 'red' },
    { text: 'まほうじんが あおく かがやきだした！', color: 'blue' },
    { text: '{name}は あたらしい ちからに めざめた！', color: 'purple' },
    { text: '{name}は ゆうしゃに えらばれた！', color: 'gold' },
    { text: 'ふしぎな ひかりが {name}を つつみこんだ…', color: 'green' },
  ],

  async create({ bg }) {
    const circle = await createMagicCircle(bg, this.messages[0].color);
    const messages = this.messages;
    return {
      drawBehind(ctx, f) { circle.drawBack(ctx, f.W, f.H, f.t, f.dt, f.opts.particles); },
      drawFront(ctx, f) { circle.drawFront(ctx, f.W, f.H, f.t, f.opts.particles); },
      tintPerson(g, w, h) { circle.tintPerson(g, w, h); },
      onMessage(index, { quiet = false } = {}) {
        circle.setColor(messages[index].color);
        if (!quiet) {
          circle.flash(); // 色が切り替わった瞬間に一度強く光らせる
          play('magic');
        }
      },
      async onShutter() {
        // 魔法陣が強く光った瞬間を撮る
        circle.flash();
        await new Promise((r) => setTimeout(r, 120));
      },
    };
  },
};
