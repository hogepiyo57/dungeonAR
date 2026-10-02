// 共通の火の粉（たいまつの部屋用）
export function createEmbers(count = 70) {
  let W = 1536, H = 1024;
  const spawn = (anyY) => ({
    x: Math.random() * W,
    y: anyY ? Math.random() * H : H + 10,
    v: 30 + Math.random() * 70,
    s: 3 + (Math.random() * 3 | 0),
    p: Math.random() * 6,
    life: 2 + Math.random() * 5,
  });
  const list = Array.from({ length: count }, () => spawn(true));

  return {
    draw(ctx, w, h, t, dt) {
      W = w; H = h;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of list) {
        e.y -= e.v * dt;
        e.x += Math.sin(t * 1.5 + e.p) * 12 * dt;
        e.life -= dt;
        if (e.y < -10 || e.life <= 0) Object.assign(e, spawn(false));
        const a = Math.max(0, Math.min(1, e.life)) * (0.6 + 0.4 * Math.sin(t * 8 + e.p));
        ctx.fillStyle = `rgba(255,${150 + e.p * 10 | 0},60,${a})`;
        ctx.fillRect(e.x | 0, e.y | 0, e.s, e.s);
      }
      ctx.restore();
    },
  };
}
