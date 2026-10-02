// ボクセル風の石ゴーレム（参考画像の「石造りの守護者」をイメージ）を three.js の箱だけで組み立てる
import * as THREE from 'three';

// 石ブロックのドット絵テクスチャを canvas で生成（1面＝ふちが面取りされた1個の石）
function stoneTexture(seed = 1, moss = 0.18) {
  const S = 24;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tone = 0.9 + rnd() * 0.2;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let v = (0.85 + rnd() * 0.25) * tone;
      // 面取り：上と左は明るく、下と右は暗く、外周は継ぎ目
      if (x < 2 || y < 2) v *= 1.25;
      if (x >= S - 2 || y >= S - 2) v *= 0.62;
      if (x === 0 || y === 0 || x === S - 1 || y === S - 1) v *= 0.45;
      g.fillStyle = `rgb(${(152 * v) | 0},${(130 * v) | 0},${(102 * v) | 0})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  // ひび
  g.fillStyle = 'rgba(45,35,28,0.85)';
  let cx = 4 + rnd() * 16, cy = 3;
  for (let i = 0; i < 9; i++) {
    g.fillRect(cx | 0, cy | 0, 1, 1);
    cx += (rnd() - 0.5) * 2.4;
    cy += 1;
  }
  // 苔（上側に多め）
  for (let i = 0; i < S * S * moss * 0.1; i++) {
    const x = (rnd() * S) | 0, y = (rnd() * rnd() * S) | 0;
    g.fillStyle = rnd() > 0.5 ? '#6a7a28' : '#8c9c3a';
    g.fillRect(x, y, 1 + ((rnd() * 2) | 0), 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 大きな面を複数の石に分けて組む（少しずつ出っ張りを変える）
function stoneGrid(w, h, d, nx, ny, M, seed) {
  const g = new THREE.Group();
  const bw = w / nx, bh = h / ny;
  let k = seed;
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const jitter = ((k * 37) % 7) / 7;
      const m = block(bw * 0.98, bh * 0.97, d * (0.92 + jitter * 0.12), M(k++));
      m.position.set(-w / 2 + bw * (ix + 0.5), -h / 2 + bh * (iy + 0.5), jitter * 0.03);
      g.add(m);
    }
  }
  return g;
}

function block(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return m;
}

// ゴーレム本体。高さ約1.6（足元が y=0）
export function createGolem() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 呼吸アニメ用
  root.add(body);

  const mats = [1, 7, 13, 21, 34, 55].map((seed) =>
    new THREE.MeshStandardMaterial({ map: stoneTexture(seed), roughness: 1, metalness: 0, flatShading: true })
  );
  const M = (i) => mats[i % mats.length];

  // 脚
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.24, 0.55, 0);
    const thigh = block(0.3, 0.34, 0.32, M(side + 1));
    thigh.position.y = -0.12;
    const shin = block(0.34, 0.3, 0.36, M(side + 2));
    shin.position.y = -0.38;
    const foot = block(0.38, 0.12, 0.46, M(3));
    foot.position.set(0, -0.49, 0.05);
    leg.add(thigh, shin, foot);
    body.add(leg);
    legs.push(leg);
  }

  // 胴体（下が細く、胸が広い）
  const torso = new THREE.Group();
  torso.position.y = 0.62;
  body.add(torso);
  const hip = block(0.62, 0.22, 0.4, M(0));
  hip.position.y = 0.06;
  const belly = stoneGrid(0.7, 0.3, 0.46, 2, 1, M, 1);
  belly.position.y = 0.3;
  const chest = stoneGrid(0.98, 0.42, 0.56, 3, 2, M, 2);
  chest.position.y = 0.66;
  torso.add(hip, belly, chest);

  // 肩の岩
  for (const side of [-1, 1]) {
    const sh = block(0.36, 0.3, 0.42, M(side + 2));
    sh.position.set(side * 0.58, 0.88, 0);
    sh.rotation.z = side * -0.15;
    const rock = block(0.2, 0.16, 0.22, M(0));
    rock.position.set(side * 0.44, 0.98, -0.1);
    torso.add(sh, rock);
  }

  // 頭（肩に半分うまっている）と光る目
  const head = new THREE.Group();
  head.position.set(0, 0.98, 0.1);
  torso.add(head);
  const skull = block(0.34, 0.28, 0.32, M(1));
  const brow = block(0.36, 0.07, 0.1, M(3));
  brow.position.set(0, 0.06, 0.15);
  head.add(skull, brow);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffa020 });
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = block(0.07, 0.05, 0.02, eyeMat);
    eye.position.set(side * 0.08, 0.0, 0.165);
    head.add(eye);
    eyes.push(eye);
  }
  const eyeLight = new THREE.PointLight(0xff9a30, 0.6, 1.2, 2);
  eyeLight.position.set(0, 0, 0.35);
  head.add(eyeLight);

  // 腕（肩を軸に回転）と大きなこぶし
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.62, 0.78, 0.02);
    const upper = block(0.26, 0.34, 0.28, M(side + 1));
    upper.position.y = -0.18;
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    const fore = block(0.3, 0.3, 0.32, M(side + 3));
    fore.position.y = -0.14;
    const fist = block(0.4, 0.34, 0.4, M(2));
    fist.position.y = -0.44;
    const knuckle = block(0.36, 0.08, 0.08, M(0));
    knuckle.position.set(0, -0.4, 0.22);
    elbow.add(fore, fist, knuckle);
    arm.add(upper, elbow);
    arm.rotation.z = side * 0.18;
    arm.userData = { side, elbow };
    torso.add(arm);
    arms.push(arm);
  }

  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; }
  });

  // ---- アニメーション ----
  const state = { appear: 0, attack: -1, t: 0 };

  root.userData.appear = () => { state.appear = 0.0001; };
  root.userData.attack = () => { if (state.attack < 0) state.attack = 0; };

  root.userData.update = (dt) => {
    state.t += dt;
    const t = state.t;

    // 登場：地面からせり上がる＋ゆれ
    if (state.appear > 0 && state.appear < 1) {
      state.appear = Math.min(1, state.appear + dt / 1.6);
    }
    const a = state.appear === 0 ? 1 : easeOutBack(state.appear);
    body.position.y = (a - 1) * 1.6;
    body.position.x = state.appear > 0 && state.appear < 1 ? Math.sin(t * 60) * 0.02 * (1 - state.appear) : 0;

    // 呼吸
    torso.position.y = 0.62 + Math.sin(t * 1.6) * 0.012;
    head.rotation.y = Math.sin(t * 0.5) * 0.15;

    // 目の明滅
    const glow = 0.75 + Math.sin(t * 3) * 0.25;
    eyeMat.color.setRGB(1, 0.45 + glow * 0.25, 0.1 * glow);
    eyeLight.intensity = 0.4 + glow * 0.5;

    // 腕のアイドル
    for (const arm of arms) {
      const { side, elbow } = arm.userData;
      arm.rotation.x = Math.sin(t * 1.6 + side) * 0.06;
      arm.rotation.z = side * (0.18 + Math.sin(t * 1.6) * 0.02);
      elbow.rotation.x = -0.25;
    }

    // こうげき：右腕をふりかぶって振り下ろす
    if (state.attack >= 0) {
      state.attack += dt / 1.1;
      const p = state.attack;
      const arm = arms[1];
      let rx;
      if (p < 0.45) rx = -2.6 * easeOutCubic(p / 0.45);
      else if (p < 0.6) rx = -2.6 + 3.4 * ((p - 0.45) / 0.15);
      else rx = 0.8 * (1 - (p - 0.6) / 0.4);
      arm.rotation.x = rx;
      torso.rotation.x = p > 0.45 && p < 0.8 ? 0.15 : 0;
      if (p >= 1) { state.attack = -1; torso.rotation.x = 0; }
    }

    // 足ぶみ
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * 1.6 + i * Math.PI) * 0.03; });
  };

  root.userData.isAttacking = () => state.attack >= 0;
  root.userData.attackPhase = () => state.attack;
  return root;
}

// 宝箱
export function createChest() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.8, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc040, roughness: 0.35, metalness: 0.8, emissive: 0x402000, flatShading: true });
  const base = block(0.5, 0.26, 0.32, wood);
  base.position.y = 0.13;
  const lid = block(0.5, 0.12, 0.32, wood);
  lid.position.y = 0.32;
  const band1 = block(0.06, 0.39, 0.34, gold);
  band1.position.set(-0.17, 0.195, 0);
  const band2 = band1.clone();
  band2.position.x = 0.17;
  const lock = block(0.08, 0.1, 0.04, gold);
  lock.position.set(0, 0.24, 0.17);
  g.add(base, lid, band1, band2, lock);
  // 金貨
  const coinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 8);
  for (let i = 0; i < 14; i++) {
    const coin = new THREE.Mesh(coinGeo, gold);
    const ang = i * 2.4, rad = 0.3 + (i % 4) * 0.05;
    coin.position.set(Math.cos(ang) * rad, 0.006 + (i % 3) * 0.012, Math.sin(ang) * rad * 0.7 + 0.08);
    coin.rotation.set((i % 3) * 0.3, 0, (i % 2) * 0.4);
    g.add(coin);
  }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0x600008, roughness: 0.2 }));
  gem.position.set(0.32, 0.05, 0.22);
  g.add(gem);
  return g;
}

// 火の粉パーティクル
export function createEmbers(count = 60, spread = 2) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = Math.random() * spread;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.6;
    speed[i] = 0.1 + Math.random() * 0.25;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffa040, size: 0.025, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.userData.update = (dt, t) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speed[i] * dt;
      pos[i * 3] += Math.sin(t * 2 + i) * 0.002;
      if (pos[i * 3 + 1] > spread) pos[i * 3 + 1] = 0;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
