import Phaser from 'phaser';
import { CONFIG } from '../game/config';
import type { Simulation } from '../game/Simulation';
import type { Character, Resource } from '../game/types';
import { crate, fire, PALETTE, pine, polygon, rock, tent } from './art';

type ActorView = { body: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; lastX: number; lastY: number; facing: number };
type ResourceView = { graphic: Phaser.GameObjects.Graphics; depleted: boolean };
type Keys = Record<'up' | 'down' | 'left' | 'right' | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight' | 'interact' | 'reel', Phaser.Input.Keyboard.Key>;
const FONT = '"Noto Sans SC", "Microsoft YaHei", sans-serif';

/** The scene renders the simulation and forwards local input; it owns no game rules. */
export class WorldScene extends Phaser.Scene {
  private readonly sim: Simulation;
  private readonly inputBlocked: () => boolean;
  private keys!: Keys;
  private pendingInteract = false;
  private pendingReel = false;
  private actors = new Map<number, ActorView>();
  private resources = new Map<number, ResourceView>();
  private holes!: Phaser.GameObjects.Graphics;
  private campFire!: Phaser.GameObjects.Graphics;
  private weather!: Phaser.GameObjects.Graphics;
  private clock = 0;
  private label!: Phaser.GameObjects.Text;

  constructor(sim: Simulation, inputBlocked: () => boolean) {
    super({ key: 'WorldScene' });
    this.sim = sim;
    this.inputBlocked = inputBlocked;
  }

  create() {
    this.cameras.main.setBackgroundColor('#dce9e8');
    this.drawLandscape();
    this.holes = this.add.graphics().setDepth(30);
    this.campFire = this.add.graphics().setDepth(545);
    this.weather = this.add.graphics().setDepth(1000);
    this.label = this.add.text(640, 740, '在冰面留下脚印，让营火照亮归途。', {
      fontFamily: FONT, fontSize: '13px', color: '#6a8993', letterSpacing: 3,
    }).setOrigin(.5).setDepth(40);
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        up: 'W', down: 'S', left: 'A', right: 'D',
        arrowUp: 'UP', arrowDown: 'DOWN', arrowLeft: 'LEFT', arrowRight: 'RIGHT',
        interact: 'E', reel: 'SPACE',
      }, false, false) as Keys;
      // Queue edge events: a fast press/release between frames must still register.
      this.keys.interact.on('down', () => { if (this.sim.active && !this.inputBlocked()) this.pendingInteract = true; });
      this.keys.reel.on('down', () => { if (this.sim.active && !this.inputBlocked()) this.pendingReel = true; });
    }
    this.renderWorld(0);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, .25);
    this.clock += dt;
    for (let remaining = dt; remaining > 0; remaining -= .05) this.sim.step(Math.min(.05, remaining));
    const active = this.sim.state.phase === 'playing' || this.sim.state.phase === 'overtime';
    if (this.keys) {
      // Consume edge presses even while menus are open so closing a menu cannot replay them.
      const interact = this.pendingInteract;
      const reel = this.pendingReel;
      this.pendingInteract = false; this.pendingReel = false;
      if (active && !this.inputBlocked()) {
        const horizontal = Number(this.keys.right.isDown || this.keys.arrowRight.isDown) - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown);
        const vertical = Number(this.keys.down.isDown || this.keys.arrowDown.isDown) - Number(this.keys.up.isDown || this.keys.arrowUp.isDown);
        this.sim.movePlayer(horizontal, vertical, dt);
        if (interact) this.sim.interact();
        else if (reel) this.sim.reel();
      }
    }
    this.renderWorld(dt);
  }

  private worldText(x: number, y: number, text: string, size: number, color = '#648491') {
    return this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, letterSpacing: 2 }).setOrigin(.5).setDepth(20);
  }

  private drawLandscape() {
    const g = this.add.graphics().setDepth(-1000);
    const { width, height, lake } = CONFIG.world;
    g.fillStyle(0xdce9e8).fillRect(0, 0, width, height);
    // A distant ridge establishes the oblique view without gameplay elevation.
    polygon(g, [0, 112, 58, 90, 143, 110, 212, 54, 307, 94, 373, 37, 458, 96, 529, 62, 611, 106, 684, 62, 759, 99, 844, 35, 926, 94, 1020, 52, 1111, 109, 1197, 80, 1280, 115, 1280, 188, 0, 188], 0xb8cdd1);
    polygon(g, [212, 54, 176, 85, 207, 79, 228, 90, 252, 74, 273, 81], 0xf4f8f4);
    polygon(g, [373, 37, 324, 78, 355, 72, 372, 86, 393, 64, 415, 76], 0xf4f8f4);
    polygon(g, [844, 35, 801, 76, 832, 66, 847, 81, 872, 65, 884, 74], 0xf4f8f4);
    polygon(g, [1020, 52, 978, 77, 1008, 75, 1025, 85, 1046, 76, 1063, 80], 0xf4f8f4);
    polygon(g, [0, 164, 128, 135, 266, 166, 380, 124, 484, 152, 618, 129, 768, 145, 900, 117, 1041, 158, 1160, 135, 1280, 163, 1280, 820, 0, 820], 0xecf4ef);
    g.fillStyle(0xc2d8dc, .52).fillEllipse(170, 294, 382, 148).fillEllipse(1110, 294, 382, 148);
    g.fillStyle(0xf1f7f2).fillEllipse(166, 276, 396, 142).fillEllipse(1114, 276, 396, 142);
    g.fillStyle(0xc7dade, .55).fillEllipse(632, 178, 450, 97);
    g.fillStyle(0xe5f0ed).fillEllipse(636, 157, 432, 99);
    // Snow paths lead each team through the same distance to the lake and resources.
    g.lineStyle(42, 0xd8e5e4, .55);
    g.beginPath(); g.moveTo(178, 566); g.lineTo(239, 452); g.lineTo(305, 354); g.lineTo(313, 253); g.strokePath();
    g.beginPath(); g.moveTo(1102, 566); g.lineTo(1041, 452); g.lineTo(975, 354); g.lineTo(967, 253); g.strokePath();
    g.lineStyle(20, 0xf5f8f1, .9);
    g.beginPath(); g.moveTo(181, 569); g.lineTo(243, 448); g.lineTo(309, 350); g.lineTo(316, 249); g.strokePath();
    g.beginPath(); g.moveTo(1099, 569); g.lineTo(1037, 448); g.lineTo(971, 350); g.lineTo(964, 249); g.strokePath();
    // Uneven snow rim, darker translucent edge, and pale ice keep the lake readable.
    g.fillStyle(0xc4d9df).fillEllipse(lake.x, lake.y + 8, (lake.rx + 29) * 2, (lake.ry + 19) * 2);
    g.fillStyle(0xf9faf3).fillEllipse(lake.x, lake.y - 4, (lake.rx + 22) * 2, (lake.ry + 15) * 2);
    const shoreline: number[] = [];
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const wobble = 1 + Math.sin(i * 1.7) * .014;
      shoreline.push(lake.x + Math.cos(a) * lake.rx * wobble, lake.y + Math.sin(a) * lake.ry * wobble);
    }
    polygon(g, shoreline, 0x8cbecf);
    g.fillStyle(0xabd5df).fillEllipse(lake.x, lake.y - 2, lake.rx * 1.94, lake.ry * 1.93);
    g.fillStyle(0xc6e5e9, .72).fillEllipse(lake.x - 46, lake.y - 59, 483, 218);
    g.fillStyle(0xbce0e7, .66).fillEllipse(lake.x + 73, lake.y + 73, 366, 152);
    g.lineStyle(2, 0xe7f6f4, .8).strokeEllipse(lake.x, lake.y - 5, lake.rx * 1.94, lake.ry * 1.91);
    g.lineStyle(1, 0x69a7bd, .3);
    const cracks = [
      [390, 457, 466, 475, 506, 466, 535, 489, 584, 483],
      [466, 475, 471, 513, 455, 548], [835, 394, 809, 417, 814, 451, 778, 479],
      [814, 451, 856, 462, 876, 491], [621, 288, 615, 317, 645, 339, 637, 367],
      [563, 595, 594, 572, 636, 587, 666, 578, 697, 600], [594, 572, 590, 552],
    ];
    for (const line of cracks) {
      g.beginPath(); g.moveTo(line[0], line[1]);
      for (let i = 2; i < line.length; i += 2) g.lineTo(line[i], line[i + 1]);
      g.strokePath();
    }
    g.fillStyle(0xeaf7f4, .55);
    for (const [x, y, w] of [[506, 374, 45], [681, 545, 58], [788, 334, 38], [442, 535, 26], [825, 556, 30]]) {
      g.fillRoundedRect(x, y, w, 4, 2).fillRoundedRect(x + 12, y + 9, w * .6, 2, 1);
    }
    // Natural framing: sparse decorative pines and rocks never replace harvestable objects.
    for (const [x, y, s] of [[42, 272, .93], [93, 316, .76], [73, 419, 1.05], [1219, 272, .93], [1187, 316, .76], [1207, 419, 1.05], [45, 700, .85], [115, 742, .65], [1235, 700, .85], [1165, 742, .65]]) pine(g, x, y, s);
    rock(g, 521, 141, .85); rock(g, 739, 131, .75); rock(g, 586, 115, .5); rock(g, 687, 118, .55);
    for (let i = 0; i < 82; i++) {
      const x = (i * 137 + 71) % 1240 + 20;
      const y = (i * 97 + 179) % 620 + 156;
      const onLake = ((x - lake.x) / (lake.rx + 25)) ** 2 + ((y - lake.y) / (lake.ry + 23)) ** 2 < 1;
      if (onLake) continue;
      g.fillStyle(0xc0d6d7, .5).fillEllipse(x, y, 4 + i % 5, 2);
      if (i % 4 === 0) {
        g.lineStyle(1.5, 0x91b4b9, .5).lineBetween(x, y, x - 4, y - 6).lineBetween(x, y, x + 3, y - 8);
      }
    }
    for (const camp of this.sim.state.camps) {
      g.fillStyle(0xd8d6c5, .48).fillEllipse(camp.x, camp.y + 5, 229, 147);
      g.fillStyle(0xf5edda, .5).fillEllipse(camp.x, camp.y + 4, 183, 115);
      const structures = this.add.graphics().setDepth(camp.y - 65);
      tent(structures, camp.x - 25, camp.y - 51, camp.team === 1);
      crate(structures, camp.x + 69, camp.y - 44);
      crate(structures, camp.x + 75, camp.y - 18);
      g.lineStyle(4, 0x978774).lineBetween(camp.x - 78, camp.y + 59, camp.x - 42, camp.y + 64);
      g.lineStyle(4, 0x978774).lineBetween(camp.x + 44, camp.y + 64, camp.x + 80, camp.y + 59);
      this.worldText(camp.x, camp.y + 90, camp.team === 0 ? '暖橘营地' : '霜蓝营地', 15, camp.team === 0 ? '#947451' : '#618798');
    }
    this.worldText(640, 405, '冰 镜 湖', 23, '#77a6b4').setAlpha(.58);
    this.worldText(153, 380, '雪杉林', 14);
    this.worldText(1127, 380, '雪杉林', 14);
    this.worldText(360, 259, '霜石岭', 14);
    this.worldText(920, 259, '霜石岭', 14);
    this.worldText(637, 698, '— 冰 湖 小 队 —', 14, '#7e9ba5').setAlpha(.75);
  }

  private renderResource(resource: Resource) {
    let view = this.resources.get(resource.id);
    const depleted = resource.amount <= 0;
    if (!view) {
      view = { graphic: this.add.graphics({ x: resource.x, y: resource.y }).setDepth(resource.y), depleted: !depleted };
      this.resources.set(resource.id, view);
    }
    if (view.depleted === depleted) return;
    view.depleted = depleted;
    view.graphic.clear();
    if (resource.kind === 'tree') pine(view.graphic, 0, 0, .82 + resource.id % 3 * .055, depleted);
    else rock(view.graphic, 0, 0, .88 + resource.id % 2 * .1, depleted);
  }

  private actorView(character: Character): ActorView {
    let actor = this.actors.get(character.id);
    if (!actor) {
      actor = {
        body: this.add.graphics(), label: this.add.text(0, 0, '', {
          fontFamily: FONT, fontSize: '12px', color: '#345867', stroke: '#f2f8f4', strokeThickness: 3,
        }).setOrigin(.5), lastX: character.x, lastY: character.y, facing: character.team ? -1 : 1,
      };
      this.actors.set(character.id, actor);
    }
    return actor;
  }

  private renderCharacter(c: Character) {
    const view = this.actorView(c);
    const g = view.body;
    const moving = Math.hypot(c.x - view.lastX, c.y - view.lastY) > .1;
    if (Math.abs(c.x - view.lastX) > .1) view.facing = c.x > view.lastX ? 1 : -1;
    view.lastX = c.x; view.lastY = c.y;
    const bob = moving ? Math.sin(this.clock * 15 + c.id) * 1.7 : Math.sin(this.clock * 2 + c.id) * .4;
    const x = c.x, y = c.y + bob, facing = view.facing;
    g.clear().setDepth(c.y + 10);
    view.label.setPosition(x, y - 59).setDepth(c.y + 11);
    view.label.setText(c.dead ? `${c.name} · ${Math.ceil(c.respawnIn)} 秒` : c.human ? (c.name === '你' ? '你' : `${c.name} · 你`) : `${c.name} · 电脑`);
    if (c.dead) {
      g.fillStyle(0x6b8a97, .13).fillEllipse(x, c.y, 32, 11);
      g.fillStyle(0xf4f7ee, .7).fillCircle(x, c.y - 23, 13).fillRoundedRect(x - 13, c.y - 23, 26, 21, 7);
      g.fillStyle(0x7895a5, .7).fillCircle(x - 4, c.y - 24, 2).fillCircle(x + 4, c.y - 24, 2);
      g.lineStyle(1.5, 0x98b9c4, .6).strokeEllipse(x, c.y, 39, 16);
      return;
    }
    if (c.human) {
      g.fillStyle(0x547f8c, .08).fillEllipse(x, c.y + 1, 42, 20);
      g.lineStyle(1.7, 0x326575, .5).strokeEllipse(x, c.y + 1, 35, 15);
      polygon(g, [x, y - 69, x - 4, y - 76, x + 4, y - 76], 0x426774);
    }
    if (c.protection > 0) g.lineStyle(1.5, 0x8ac4b5, .5).strokeEllipse(x, c.y - 20, 40, 59);
    g.fillStyle(0x4d7891, .18).fillEllipse(x + 2, c.y + 3, 28, 11);
    const step = moving ? Math.sin(this.clock * 15 + c.id) * 3 : 0;
    g.fillStyle(0x3d5260).fillRoundedRect(x - 10, y - 9 + step, 9, 13, 3).fillRoundedRect(x + 2, y - 9 - step, 9, 13, 3);
    // Tiny supply backpack, two mittened arms, and thick coats keep roles legible.
    g.fillStyle(c.team ? 0x597687 : 0x96795c).fillRoundedRect(x - facing * 13 - 5, y - 34, 12, 23, 4);
    g.fillStyle(c.color).fillRoundedRect(x - 13, y - 35, 26, 30, 9);
    g.fillStyle(c.team ? 0x5a849c : 0xc58a47).fillRoundedRect(x + 1, y - 32, 11, 23, 4);
    g.fillStyle(0xe5e8d6).fillRoundedRect(x - 11, y - 30, 22, 5, 2);
    g.fillStyle(c.color).fillRoundedRect(x - 18, y - 28, 8, 20, 4).fillRoundedRect(x + 10, y - 28, 8, 20, 4);
    g.fillStyle(0x5a6470).fillCircle(x - 14, y - 10, 4).fillCircle(x + 14, y - 10, 4);
    g.fillStyle(0xf0c4a0).fillEllipse(x, y - 39, 23, 22);
    g.fillStyle(c.team ? 0x345c74 : 0x806044).fillEllipse(x, y - 48, 29, 18).fillRoundedRect(x - 15, y - 47, 30, 7, 3);
    g.fillStyle(c.team ? 0x91becb : 0xefc77d).fillCircle(x + 4, y - 59, 5);
    g.fillStyle(0x334b59).fillCircle(x - 4, y - 39, 1.6).fillCircle(x + 4, y - 39, 1.6);
    g.fillStyle(0xe5a090, .75).fillEllipse(x - 7, y - 34, 5, 3).fillEllipse(x + 7, y - 34, 5, 3);
    if (c.warmth < 25) {
      g.fillStyle(0xc6e9f4, .3).fillEllipse(x, y - 18, 24, 27);
      g.lineStyle(1, 0x6495b0, .7).lineBetween(x - 23, y - 29, x - 25, y - 23).lineBetween(x + 23, y - 25, x + 25, y - 19);
    }
    if (c.fishing) {
      const hole = this.sim.state.holes.find(h => h.id === c.fishing!.holeId);
      if (hole) {
        const side = hole.x >= x ? 1 : -1;
        const tipX = x + side * 29, tipY = y - 55;
        g.lineStyle(c.rod ? 3 : 2.5, c.rod ? 0xdaaa5b : 0x766853).lineBetween(x + side * 14, y - 19, tipX, tipY);
        g.lineStyle(1, 0xf6faf3, .9).lineBetween(tipX, tipY, hole.x, hole.y - 3);
        g.fillStyle(c.fishing.stage === 'reeling' ? 0xf6b362 : 0xf27964).fillEllipse(hole.x, hole.y - 4 + Math.sin(this.clock * 4) * 1.5, 5, 6);
        if (c.fishing.stage === 'reeling') {
          g.lineStyle(1.5, 0xe9f9f4, .8).strokeEllipse(hole.x, hole.y - 3, 17 + Math.sin(this.clock * 7) * 4, 8);
        }
      }
    } else if (c.gatherIn > 0 && this.sim.active) {
      const swing = Math.sin(this.clock * 11) * .6;
      const tx = x + facing * (25 + swing * 9), ty = y - 28 + swing * 14;
      g.lineStyle(3, 0x86684a).lineBetween(x + facing * 14, y - 19, tx, ty);
      g.lineStyle(5, 0x9cafb6).lineBetween(tx - 6, ty - 5, tx + 7, ty - 2);
      g.fillStyle(0xefd49b, .8).fillCircle(tx + 3, ty + 7, 2);
    } else {
      g.lineStyle(2, c.rod ? 0xd8a250 : 0x766853).lineBetween(x + facing * 13, y - 14, x + facing * 23, y - 43);
    }
  }

  private renderWorld(_dt: number) {
    for (const resource of this.sim.state.resources) this.renderResource(resource);
    this.holes.clear();
    for (const hole of this.sim.state.holes) {
      this.holes.fillStyle(0xf4faf5).fillEllipse(hole.x, hole.y, 39, 20);
      this.holes.fillStyle(0x558b9e).fillEllipse(hole.x, hole.y - 1, 29, 15);
      this.holes.fillStyle(0x294e64).fillEllipse(hole.x, hole.y + 1, 24, 10);
      this.holes.lineStyle(1.5, 0xc3e7ec).lineBetween(hole.x - 10, hole.y - 4, hole.x + 4, hole.y - 6);
      if (hole.occupant !== null) this.holes.lineStyle(1, 0xd7f5f2, .45).strokeEllipse(hole.x, hole.y, 49, 25);
    }
    this.campFire.clear();
    for (const camp of this.sim.state.camps) fire(this.campFire, camp.x, camp.y, camp.fuel > 0, this.clock + camp.team);
    for (const character of this.sim.state.characters) this.renderCharacter(character);
    // Clear views after a restart if a future roster changes IDs.
    for (const [id, actor] of this.actors) {
      if (!this.sim.state.characters.some(c => c.id === id)) { actor.body.destroy(); actor.label.destroy(); this.actors.delete(id); }
    }
    this.weather.clear();
    for (let i = 0; i < 25; i++) {
      const x = (i * 173 + this.clock * (3 + i % 3)) % 1280;
      const y = (i * 131 + this.clock * (8 + i % 4)) % 820;
      this.weather.fillStyle(0xffffff, .35).fillCircle(x, y, i % 4 === 0 ? 1.8 : 1);
    }
    this.label.setVisible(this.sim.state.phase === 'menu');
  }
}
