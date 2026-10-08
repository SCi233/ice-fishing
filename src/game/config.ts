import type { CatchDef, ItemId } from './types';
// 全部为首轮试玩暂定值，未经过平衡验证；单位：秒、世界像素。
export const CONFIG = {
  world: { width: 1280, height: 820, lake: { x: 640, y: 470, rx: 330, ry: 222 } },
  match: { duration: 20 * 60, shortDuration: 120, overtime: 60, target: 100 },
  moveSpeed: 142, interactionRadius: 66, holeSpacing: 62,
  fishing: { waitMin: 2.2, waitMax: 4.8, reelDuration: 4.2, markerSpeed: .68, zone: .24, upgradedZone: .40, aiSuccess: .70, upgradedAiSuccess: .84, aiReelDelay: .7 },
  survival: { maxHp: 100, maxWarmth: 100, coldPerSecond: .72, warmPerSecond: 9, damagePerSecond: 6, healPerSecond: 3, warmthRadius: 125, respawnProtection: 12, fishHp: 18, fishWarmth: 8 },
  camp: { startFuel: 95, maxFuel: 180, fuelPerWood: 32, lowFuel: 30 },
  gather: { duration: 1.3, yield: 2, capacity: 12, respawn: 18 },
  upgrade: { wood: 4, ore: 3 }, ai: { gatherWoodGoal: 6, gatherOreGoal: 4, coldThreshold: 30, recoverThreshold: 85 },
  respawnTiers: [10, 20, 30],
} as const;
export const CATCHES: CatchDef[] = [
  { id: 'silverfish', name: '雪银鱼', points: 6, weight: 52, upgradedWeight: 30, color: 0xa6dbea },
  { id: 'ribbonfish', name: '绯尾鱼', points: 12, weight: 20, upgradedWeight: 32, color: 0xf29b8f },
  { id: 'moonfish', name: '月灯鱼', points: 25, weight: 5, upgradedWeight: 18, color: 0xf7d774 },
  { id: 'wood', name: '漂流木', points: 2, weight: 14, upgradedWeight: 12, color: 0xb3815d },
  { id: 'ore', name: '冰纹矿石', points: 3, weight: 9, upgradedWeight: 8, color: 0x99a6c9 },
];
export const ITEM_NAMES: Record<ItemId, string> = { silverfish: '雪银鱼', ribbonfish: '绯尾鱼', moonfish: '月灯鱼', wood: '木材', ore: '矿石' };
export const TEAM_COLORS = [0xe4a659, 0x74aecf];
export const CAMP_POSITIONS = [{ x: 188, y: 548 }, { x: 1092, y: 548 }];
