import Phaser from 'phaser';

export const PALETTE = {
  ink: 0x284d60, snow: 0xf1f7f2, shadow: 0xa5c3cd,
  ice: 0xa7d6e2, pine: 0x376c70, pineLight: 0x528c86,
};

export function polygon(g: Phaser.GameObjects.Graphics, points: number[], color: number, alpha = 1) {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i += 2) vertices.push({ x: points[i], y: points[i + 1] });
  g.fillStyle(color, alpha).fillPoints(vertices, true);
}

export function pine(g: Phaser.GameObjects.Graphics, x: number, y: number, scale = 1, depleted = false) {
  g.fillStyle(0x598393, .15).fillEllipse(x + 8 * scale, y + 3 * scale, 59 * scale, 19 * scale);
  g.fillStyle(0x805f51).fillRoundedRect(x - 5 * scale, y - 21 * scale, 10 * scale, 26 * scale, 2);
  if (depleted) {
    g.fillStyle(0xaf8f72).fillEllipse(x, y - 13 * scale, 19 * scale, 8 * scale);
    g.lineStyle(1, 0x715748).strokeEllipse(x, y - 13 * scale, 12 * scale, 4 * scale);
    return;
  }
  const tier = (peak: number, base: number, width: number, color: number) => {
    polygon(g, [x, y - peak * scale, x - width * scale, y - base * scale, x - 8 * scale, y - (base - 3) * scale, x + width * scale, y - base * scale], color);
    polygon(g, [x, y - peak * scale, x - width * .77 * scale, y - (base + 9) * scale, x - width * .12 * scale, y - (base + 14) * scale, x + width * .7 * scale, y - (base + 9) * scale], PALETTE.snow);
    polygon(g, [x, y - (peak - 11) * scale, x + width * .7 * scale, y - (base + 9) * scale, x + width * .34 * scale, y - (base + 4) * scale], 0xd4e7e7);
  };
  tier(66, 15, 30, 0x346a71);
  tier(85, 35, 25, 0x427b78);
  tier(102, 57, 20, 0x538b84);
}

export function rock(g: Phaser.GameObjects.Graphics, x: number, y: number, scale = 1, depleted = false) {
  g.fillStyle(0x66899a, .2).fillEllipse(x + 6 * scale, y + 3 * scale, 73 * scale, 23 * scale);
  if (depleted) {
    polygon(g, [x - 21 * scale, y, x - 12 * scale, y - 12 * scale, x + 7 * scale, y - 17 * scale, x + 26 * scale, y, x + 5 * scale, y + 5 * scale], 0x90a7b4);
    g.fillStyle(0xd9e7e8).fillEllipse(x + 4 * scale, y - 10 * scale, 24 * scale, 8 * scale);
    return;
  }
  polygon(g, [x - 34 * scale, y - 7 * scale, x - 27 * scale, y - 34 * scale, x - 3 * scale, y - 52 * scale, x + 24 * scale, y - 40 * scale, x + 37 * scale, y - 9 * scale, x + 19 * scale, y + 3 * scale, x - 14 * scale, y + 5 * scale], 0x7891a3);
  polygon(g, [x - 3 * scale, y - 52 * scale, x - 8 * scale, y - 13 * scale, x - 34 * scale, y - 7 * scale, x - 27 * scale, y - 34 * scale], 0x95aeba);
  polygon(g, [x - 3 * scale, y - 52 * scale, x + 24 * scale, y - 40 * scale, x + 29 * scale, y - 24 * scale, x + 5 * scale, y - 28 * scale, x - 8 * scale, y - 23 * scale, x - 25 * scale, y - 28 * scale], 0xe7f1ee);
  polygon(g, [x + 9 * scale, y - 27 * scale, x + 14 * scale, y - 38 * scale, x + 20 * scale, y - 29 * scale, x + 14 * scale, y - 16 * scale], 0xa9dbed);
  polygon(g, [x + 22 * scale, y - 20 * scale, x + 26 * scale, y - 30 * scale, x + 29 * scale, y - 21 * scale, x + 25 * scale, y - 12 * scale], 0xc9ebf4);
  g.lineStyle(1.5, 0xdffbff, .65).lineBetween(x + 14 * scale, y - 34 * scale, x + 14 * scale, y - 20 * scale);
}

export function tent(g: Phaser.GameObjects.Graphics, x: number, y: number, blue: boolean) {
  g.fillStyle(0x668799, .18).fillEllipse(x + 11, y + 3, 126, 33);
  polygon(g, [x - 48, y - 1, x - 6, y - 77, x + 49, y - 65, x + 65, y - 2], blue ? 0x7197ae : 0xc39062);
  polygon(g, [x - 48, y - 1, x - 6, y - 77, x + 27, y - 1], blue ? 0x87b6c4 : 0xe3b875);
  polygon(g, [x - 28, y - 1, x - 7, y - 48, x + 10, y - 1], 0x344d57);
  polygon(g, [x - 6, y - 77, x + 49, y - 65, x + 54, y - 46, x + 15, y - 52, x - 16, y - 55], 0xf4f6e7);
  g.lineStyle(2, 0x4c676c, .6).lineBetween(x - 6, y - 77, x + 27, y - 1);
  g.lineStyle(1.5, 0x718794).lineBetween(x - 30, y - 15, x - 61, y + 7).lineBetween(x + 42, y - 13, x + 80, y + 7);
  g.lineStyle(3, 0x726451).lineBetween(x - 61, y + 1, x - 61, y + 13).lineBetween(x + 80, y + 1, x + 80, y + 13);
}

export function crate(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  polygon(g, [x - 16, y - 4, x - 16, y - 27, x + 9, y - 27, x + 16, y - 20, x + 16, y + 1, x - 9, y + 1], 0xb6936c);
  polygon(g, [x + 9, y - 27, x + 16, y - 20, x + 16, y + 1, x + 9, y - 5], 0x8f765d);
  polygon(g, [x - 16, y - 27, x + 9, y - 27, x + 16, y - 20, x - 9, y - 20], 0xd8bb91);
  g.lineStyle(2, 0x7b6855).lineBetween(x - 12, y - 19, x + 5, y - 6).lineBetween(x - 12, y - 6, x + 5, y - 19);
}

export function fire(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean, time: number) {
  if (lit) {
    g.fillStyle(0xf5bc68, .09).fillEllipse(x, y, 187, 118);
    g.fillStyle(0xffb36a, .12).fillEllipse(x, y, 118, 64);
  }
  g.fillStyle(0x648598, .17).fillEllipse(x, y + 7, 66, 22);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    g.fillStyle(i % 2 ? 0x8898a0 : 0xaab5b6).fillEllipse(x + Math.cos(a) * 26, y + Math.sin(a) * 12, 13, 9);
  }
  g.lineStyle(9, lit ? 0x846049 : 0x655955).lineBetween(x - 16, y + 2, x + 17, y - 8).lineBetween(x - 16, y - 9, x + 18, y + 3);
  g.lineStyle(2, 0xaa7c4f).lineBetween(x - 17, y - 10, x + 17, y + 1);
  if (!lit) return;
  const sway = Math.sin(time * 6) * 3;
  polygon(g, [x - 17, y - 3, x - 18, y - 18, x - 8, y - 28, x - 4 + sway, y - 52, x + 6, y - 28, x + 16, y - 38, x + 18, y - 14, x + 11, y - 2], 0xf08e4d);
  polygon(g, [x - 11, y - 4, x - 9, y - 20, x + sway, y - 38, x + 4, y - 22, x + 11, y - 13, x + 8, y - 3], 0xffc56c);
  polygon(g, [x - 5, y - 3, x - 4, y - 12, x + 1, y - 23, x + 7, y - 6], 0xffebaa);
  for (let i = 0; i < 3; i++) {
    const t = (time * .4 + i / 3) % 1;
    g.fillStyle(0xffd785, 1 - t).fillCircle(x + Math.sin(time + i) * 10, y - 42 - t * 25, 1.5);
  }
}
