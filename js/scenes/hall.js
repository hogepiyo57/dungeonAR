// 大広間：奥に3Dのゴーレムが出現する。「しょうかん」「こうげき」で動く
import { createHallGolem } from '../effects/hall-golem.js';
import { play } from '../common/sound.js';

export default {
  id: 'hall',
  src: 'assets/dungeon-hall.jpg', w: 1536, h: 1024,
  stand: { cx: 470, feetY: 1000, height: 760 }, // 手前の左側
  enterSound: 'summon',
  ui: { golemBar: true },

  async create() {
    const golem = createHallGolem();
    let shake = 0;
    let hitPlayed = false;
    let personX = 0.3;
    return {
      golem,
      enter() { golem.appear(); },
      summon() { golem.appear(); play('summon'); },
      attack() { golem.attack(); hitPlayed = false; play('swing'); },
      shakeOffset(t, dt) {
        // 振り下ろした瞬間に画面をゆらして衝撃音
        const p = golem.attackPhase();
        if (p > 0.55 && p < 0.6 && !hitPlayed) {
          hitPlayed = true;
          shake = 0.35;
          play('hit');
        }
        if (shake <= 0) return [0, 0];
        shake = Math.max(0, shake - dt);
        return [Math.sin(t * 90) * 14 * shake / 0.35, Math.cos(t * 70) * 10 * shake / 0.35];
      },
      setPersonX(nx) { personX = nx; },
      drawBehind(ctx, f) {
        golem.setChest(f.opts.chest);
        golem.lookAtPerson(personX);
        golem.render(f.dt);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(golem.canvas, 0, 0, f.W, f.H);
        ctx.restore();
      },
    };
  },
};
