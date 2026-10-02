// 大広間の背景画像に重ねる3Dゴーレム（カメラ映像ではなく、画面内の背景にARのように出現させる）
import * as THREE from 'three';
import { createGolem, createChest } from '../models/golem.js';

// 低解像度で描いてから拡大し、背景のドット絵になじませる
const RW = 768, RH = 512;

// ゴーレムの立ち位置（床の上。z がマイナスほど奥）
const GOLEM_X = 0.7, GOLEM_Z = -3.0;

export function createHallGolem() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RW, RH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // 背景画像の床の見え方に合わせたカメラ（床 y=0）
  const camera = new THREE.PerspectiveCamera(38, RW / RH, 0.1, 100);
  camera.position.set(0, 1.15, 5.2);
  camera.lookAt(0, 1.35, 0);

  // 照明：左右のたいまつ（暖色）と奥の青い光
  scene.add(new THREE.HemisphereLight(0x7080e0, 0x2a1a10, 0.75));
  const key = new THREE.DirectionalLight(0xffb070, 1.1);
  key.position.set(-3, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5070ff, 1.4);
  rim.position.set(1, 2, -4);
  scene.add(rim);
  const torchL = new THREE.PointLight(0xff8a30, 3, 8, 1.5);
  torchL.position.set(-3.2, 2.2, 1);
  const torchR = new THREE.PointLight(0xff8a30, 3, 8, 1.5);
  torchR.position.set(3.2, 2.2, 1);
  scene.add(torchL, torchR);
  // 奥に立つゴーレムを照らす灯り
  const backLight = new THREE.PointLight(0xffa050, 2.2, 6, 1.5);
  backLight.position.set(GOLEM_X - 1.2, 2.4, GOLEM_Z + 1.8);
  scene.add(backLight);

  const golem = createGolem();
  golem.scale.setScalar(1.6);
  golem.position.set(GOLEM_X, 0, GOLEM_Z);
  golem.rotation.y = -0.35; // 人物（左側）のほうを向く
  scene.add(golem);

  const chest = createChest();
  chest.scale.setScalar(1.1);
  chest.position.set(1.95, 0, 0.9);
  chest.rotation.y = -0.5;
  scene.add(chest);

  // 足元の影
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.3, 0.8, 1);
  shadow.position.set(GOLEM_X, 0.01, GOLEM_Z + 0.05);
  scene.add(shadow);

  let t = 0;
  return {
    canvas: renderer.domElement,
    appear() { golem.userData.appear(); },
    attack() { golem.userData.attack(); },
    attackPhase() { return golem.userData.attackPhase(); },
    // 人物の位置（0〜1）に合わせてゴーレムの向きを少し変える
    lookAtPerson(nx) { golem.rotation.y = -0.15 + (nx - 0.5) * 0.9; },
    setChest(v) { chest.visible = v; },
    render(dt) {
      t += dt;
      golem.userData.update(dt);
      const flick = Math.sin(t * 13) * 0.3 + Math.sin(t * 7.3) * 0.3;
      torchL.intensity = 3 + flick;
      torchR.intensity = 3 - flick;
      renderer.render(scene, camera);
    },
  };
}
