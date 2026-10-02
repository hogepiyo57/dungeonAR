// 魔法陣の発光演出（castle.jpg 上の魔法陣に重ねる）
// 背面（人物より奥）と前面（人物より手前）に分けて描く

// castle.jpg（1292x1025）上の魔法陣の楕円
export const CIRCLE = { cx: 640, cy: 828, rx: 450, ry: 168 };
// magic-lines.png を置く位置
const LINES_X = 170, LINES_Y = 640;

// 5x5 のドット文字（ルーン）
const RUNES = [
  '10101/01110/11111/01110/10101',
  '11111/10001/10101/10001/11111',
  '00100/01110/10101/00100/00100',
  '10001/01010/00100/01010/10001',
  '01110/10001/11111/10001/10001',
  '11110/10001/11110/10001/11110',
  '00100/01010/10001/01010/00100',
  '11011/11011/00000/11011/11011',
].map((s) => s.split('/').map((row) => [...row].map(Number)));

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// 白いマスクを指定色に塗る
function tint(img, color) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// 半分ずつ縮小してぼかす（ctx.filter が使えない端末でも同じ見た目にする）
function blurDown(src, steps) {
  let cur = src;
  for (let i = 0; i < steps; i++) {
    const n = makeCanvas(cur.width / 2, cur.height / 2);
    const g = n.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, n.width, n.height);
    cur = n;
  }
  return cur;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function createMagicCircle() {
  const lines = await loadImage('assets/magic-lines.png');
  const LW = lines.width, LH = lines.height;
  const { cx, cy, rx, ry } = CIRCLE;

  // 発光レイヤー（色とぼかし量の違う3段）
  const core = tint(lines, '#eef8ff');
  const glowNear = blurDown(tint(lines, '#62a8ff'), 2);
  const glowFar = blurDown(tint(lines, '#2a5cff'), 4);
  const glowViolet = blurDown(tint(lines, '#9a6bff'), 2); // ときどき紫がかる

  // きらめきを置く候補点（線の明るい部分）
  const glintSpots = (() => {
    const c = makeCanvas(LW, LH);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(lines, 0, 0);
    const data = g.getImageData(0, 0, LW, LH).data;
    const spots = [];
    for (let y = 0; y < LH; y += 3) {
      for (let x = 0; x < LW; x += 3) {
        if (data[(y * LW + x) * 4 + 3] > 220) spots.push([x + LINES_X, y + LINES_Y]);
      }
    }
    return spots;
  })();
  const glints = Array.from({ length: 16 }, () => newGlint(true));
  function newGlint(initial) {
    const [x, y] = glintSpots[(Math.random() * glintSpots.length) | 0] || [cx, cy];
    const life = 0.5 + Math.random() * 0.8;
    return { x, y, life, age: initial ? Math.random() * life : 0, size: 10 + Math.random() * 16 };
  }

  // 光が一周する演出用
  const sweep = makeCanvas(LW, LH);
  const sweepCtx = sweep.getContext('2d');
  const hasConic = typeof sweepCtx.createConicGradient === 'function';

  // 光の柱（形は固定なので最初に作る）
  const pillar = (() => {
    const pw = rx * 1.7, ph = cy + ry;
    const c = makeCanvas(pw, ph);
    const g = c.getContext('2d');
    const hg = g.createLinearGradient(0, 0, pw, 0);
    hg.addColorStop(0, 'rgba(90,160,255,0)');
    hg.addColorStop(0.3, 'rgba(110,180,255,0.55)');
    hg.addColorStop(0.5, 'rgba(200,235,255,1)');
    hg.addColorStop(0.7, 'rgba(110,180,255,0.55)');
    hg.addColorStop(1, 'rgba(90,160,255,0)');
    g.fillStyle = hg;
    g.beginPath();
    g.rect(0, 0, pw, cy);
    g.ellipse(pw / 2, cy, pw / 2, ry * 0.85, 0, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-in';
    const vg = g.createLinearGradient(0, 0, 0, ph);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    vg.addColorStop(0.85, 'rgba(0,0,0,1)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg;
    g.fillRect(0, 0, pw, ph);
    return c;
  })();

  // 光の粒
  const particles = Array.from({ length: 110 }, () => spawn(true));
  function spawn(initial) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random());
    const life = 1.6 + Math.random() * 2.4;
    return {
      x: cx + Math.cos(a) * rx * 0.95 * d,
      y: cy + Math.sin(a) * ry * 0.95 * d,
      vy: 50 + Math.random() * 110,
      size: Math.random() < 0.7 ? 4 : 7,
      streak: Math.random() < 0.25,
      color: ['#ffffff', '#bfe3ff', '#7fc0ff', '#9ff7ff'][(Math.random() * 4) | 0],
      life,
      age: initial ? Math.random() * life : 0,
      front: Math.random() < 0.45,
      phase: Math.random() * 6.28,
    };
  }

  let burst = 0; // 撮影時に一瞬強く光らせる
  let showParticles = true;

  function pulseAt(t) {
    return 0.82 + Math.sin(t * 2.1) * 0.12 + Math.sin(t * 5.3) * 0.04 + burst;
  }

  function update(dt) {
    burst = Math.max(0, burst - dt * 1.2);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;
      p.y -= p.vy * dt;
      if (p.age >= p.life) particles[i] = spawn(false);
    }
    for (let i = 0; i < glints.length; i++) {
      glints[i].age += dt;
      if (glints[i].age >= glints[i].life) glints[i] = newGlint(false);
    }
  }

  // 十字のきらめき（ドット絵風）
  function drawGlints(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of glints) {
      const k = Math.sin(Math.PI * (g.age / g.life));
      const len = Math.round(g.size * k);
      if (len < 2) continue;
      const x = Math.round(g.x), y = Math.round(g.y);
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = '#7fc8ff';
      ctx.fillRect(x - len, y - 2, len * 2 + 1, 5);
      ctx.fillRect(x - 2, y - len, 5, len * 2 + 1);
      ctx.globalAlpha = k;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - Math.round(len * 0.7), y - 1, Math.round(len * 1.4) + 1, 3);
      ctx.fillRect(x - 1, y - Math.round(len * 0.7), 3, Math.round(len * 1.4) + 1);
      ctx.fillRect(x - 3, y - 3, 7, 7);
    }
    ctx.restore();
  }

  function drawParticles(ctx, t, front) {
    if (!showParticles) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      if (p.front !== front) continue;
      const k = p.age / p.life;
      const twinkle = 0.65 + 0.35 * Math.sin(t * 9 + p.phase);
      ctx.globalAlpha = Math.sin(Math.PI * k) * twinkle * (front ? 0.8 : 1);
      ctx.fillStyle = p.color;
      const x = Math.round(p.x + Math.sin(t * 1.7 + p.phase) * 10);
      const y = Math.round(p.y);
      if (p.streak) ctx.fillRect(x, y, 3, 18);
      else ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.restore();
  }

  function drawRunes(ctx, t, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const N = 18, px = 4;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + t * 0.18;
      const x = cx + Math.cos(a) * rx * 1.1;
      const y = cy + Math.sin(a) * ry * 1.12 - 6;
      const back = Math.sin(a) < 0; // 奥側は少し暗く
      ctx.globalAlpha = (back ? 0.45 : 0.85) * (0.7 + 0.3 * Math.sin(t * 3 + i)) * Math.min(1.2, pulse);
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#8fd0ff';
      const glyph = RUNES[i % RUNES.length];
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy][gx]) ctx.fillRect(Math.round(x + (gx - 2.5) * px), Math.round(y + (gy - 2.5) * px * 0.75), px, Math.ceil(px * 0.75));
        }
      }
    }
    ctx.restore();
  }

  // 人物より奥：部屋の暗転、床と壁の照り返し、魔法陣の発光、波紋、ルーン、光の柱、奥の光の粒
  function drawBack(ctx, W, H, t, dt, particlesOn = true) {
    showParticles = particlesOn;
    update(dt);
    const pulse = pulseAt(t);

    // 部屋を少し暗くして、魔法陣の光を引き立てる
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,30,0.42)';
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    // 壁への照り返し
    const wall = ctx.createRadialGradient(cx, cy - 120, 0, cx, cy - 120, 760);
    wall.addColorStop(0, `rgba(70,120,255,${0.22 * pulse})`);
    wall.addColorStop(1, 'rgba(70,120,255,0)');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    // 床の照り返し（楕円）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const floor = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx * 1.45);
    floor.addColorStop(0, `rgba(90,160,255,${0.35 * pulse})`);
    floor.addColorStop(0.7, `rgba(60,120,255,${0.18 * pulse})`);
    floor.addColorStop(1, 'rgba(40,90,255,0)');
    ctx.fillStyle = floor;
    ctx.fillRect(-rx * 1.5, -rx * 1.5, rx * 3, rx * 3);
    ctx.restore();

    // 魔法陣の線：遠いぼかし → 近いぼかし → 芯
    ctx.globalAlpha = Math.min(1, 0.95 * pulse);
    ctx.drawImage(glowFar, LINES_X - 24, LINES_Y - 16, LW + 48, LH + 32);
    ctx.drawImage(glowFar, LINES_X - 24, LINES_Y - 16, LW + 48, LH + 32);
    ctx.globalAlpha = Math.min(1, 0.9 * pulse);
    ctx.drawImage(glowNear, LINES_X - 4, LINES_Y - 3, LW + 8, LH + 6);
    ctx.globalAlpha = 0.45 * (0.5 + 0.5 * Math.sin(t * 0.7));
    ctx.drawImage(glowViolet, LINES_X - 4, LINES_Y - 3, LW + 8, LH + 6);
    ctx.globalAlpha = Math.min(1, 0.75 + burst);
    ctx.drawImage(core, LINES_X, LINES_Y);

    // 光が魔法陣の上をぐるりと走る
    if (hasConic) {
      sweepCtx.globalCompositeOperation = 'source-over';
      sweepCtx.clearRect(0, 0, LW, LH);
      sweepCtx.save();
      sweepCtx.translate(cx - LINES_X, cy - LINES_Y);
      sweepCtx.scale(1, ry / rx);
      const cg = sweepCtx.createConicGradient(t * 1.3, 0, 0);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.08, 'rgba(160,230,255,0.6)');
      cg.addColorStop(0.2, 'rgba(120,200,255,0)');
      cg.addColorStop(0.5, 'rgba(120,200,255,0)');
      cg.addColorStop(0.58, 'rgba(160,230,255,0.4)');
      cg.addColorStop(0.62, 'rgba(255,255,255,0.8)');
      cg.addColorStop(0.7, 'rgba(120,200,255,0)');
      cg.addColorStop(1, 'rgba(255,255,255,1)');
      sweepCtx.fillStyle = cg;
      sweepCtx.fillRect(-rx * 1.2, -rx * 1.2, rx * 2.4, rx * 2.4);
      sweepCtx.restore();
      sweepCtx.globalCompositeOperation = 'destination-in';
      sweepCtx.drawImage(lines, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(sweep, LINES_X, LINES_Y);
    }

    // 中心から広がる光の波紋
    ctx.globalAlpha = 1;
    for (let k = 0; k < 2; k++) {
      const p = ((t / 2.6) + k / 2) % 1;
      const s = 0.12 + p * 1.0;
      ctx.strokeStyle = `rgba(150,215,255,${Math.pow(1 - p, 2) * 0.75})`;
      ctx.lineWidth = 2 + 8 * (1 - p);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * s, ry * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    drawGlints(ctx);
    drawRunes(ctx, t, pulse);

    // 光の柱（奥側）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2 * pulse;
    ctx.drawImage(pillar, cx - pillar.width / 2, 0);
    ctx.restore();

    drawParticles(ctx, t, false);
  }

  // 人物より手前：うっすらとした光の柱と、手前を舞う光の粒
  function drawFront(ctx, W, H, t, particlesOn = true) {
    showParticles = particlesOn;
    const pulse = pulseAt(t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.07 * pulse;
    ctx.drawImage(pillar, cx - pillar.width / 2, 0);
    ctx.restore();
    drawParticles(ctx, t, true);
  }

  // 人物を魔法陣の青い光で下から照らす
  function tintPerson(g, w, h) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(30,45,120,0.18)';
    g.fillRect(0, 0, w, h);
    const lg = g.createLinearGradient(0, h, 0, h * 0.35);
    lg.addColorStop(0, 'rgba(120,190,255,0.5)');
    lg.addColorStop(1, 'rgba(120,190,255,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  return {
    drawBack,
    drawFront,
    tintPerson,
    flash() { burst = 0.8; },
  };
}
