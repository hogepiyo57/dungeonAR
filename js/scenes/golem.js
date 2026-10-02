// ゴーレムの間：参考画像そのまま。絵のゴーレムの目を光らせる

// 参考画像内のゴーレムの目の位置（1536x1024基準）
const EYES = [[1030, 238], [1076, 238]];

export default {
  id: 'golem',
  src: 'assets/dungeon.jpg', w: 1536, h: 1024,
  stand: { cx: 430, feetY: 1000, height: 760 },

  async create() {
    return {
      drawBehind(ctx, f) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.55 + Math.sin(f.t * 3) * 0.35;
        for (const [ex, ey] of EYES) {
          const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 34);
          g.addColorStop(0, `rgba(255,170,60,${0.8 * pulse})`);
          g.addColorStop(1, 'rgba(255,90,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(ex - 34, ey - 34, 68, 68);
        }
        ctx.restore();
      },
    };
  },
};
