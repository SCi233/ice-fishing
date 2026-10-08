import Phaser from 'phaser';
import { Simulation } from './game/Simulation';
import { WorldScene } from './view/WorldScene';
import { Hud } from './ui/Hud';
import { CONFIG } from './game/config';
import './ui/style.css';

const sim = new Simulation();
const hud = new Hud(sim, document.querySelector<HTMLElement>('#ui')!);
const scene = new WorldScene(sim, () => hud.inputBlocked());
const game = new Phaser.Game({
  type: Phaser.CANVAS, parent: 'game', backgroundColor: '#a9cdd7',
  width: CONFIG.world.width, height: CONFIG.world.height,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false },
  scene: [scene],
});
game.events.on(Phaser.Core.Events.POST_STEP, () => hud.update());
hud.update();

// 仅明确开启测试模式时提供测试 API；正常页面不创建此全局对象。
if (new URLSearchParams(location.search).get('debug') === '1') {
  Object.assign(window, { __ICE_TEST__: { sim, game, hud,
    advance: (seconds: number) => { for (let t = 0; t < seconds; t += .05) sim.step(Math.min(.05, seconds - t)); hud.update(); },
    snapshot: () => JSON.parse(JSON.stringify(sim.state)),
  } });
}
