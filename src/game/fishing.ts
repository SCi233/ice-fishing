import { CATCHES, CONFIG } from './config';
import type { CatchDef, Fishing } from './types';
export function zoneWidth(rod: number) { return rod ? CONFIG.fishing.upgradedZone : CONFIG.fishing.zone; }
export function inSuccessZone(marker: number, rod: number) { return Math.abs(marker - .5) <= zoneWidth(rod) / 2; }
export function pickCatch(rod: number, random: () => number): CatchDef {
  let roll = random() * CATCHES.reduce((sum, c) => sum + (rod ? c.upgradedWeight : c.weight), 0);
  for (const item of CATCHES) { roll -= rod ? item.upgradedWeight : item.weight; if (roll < 0) return item; }
  return CATCHES[CATCHES.length - 1];
}
export function advanceMarker(fishing: Fishing, dt: number) {
  let p = fishing.marker + fishing.direction * CONFIG.fishing.markerSpeed * dt;
  while (p > 1 || p < 0) { if (p > 1) { p = 2 - p; fishing.direction = -1; } else { p = -p; fishing.direction = 1; } }
  fishing.marker = p;
}
