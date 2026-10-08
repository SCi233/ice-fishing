import { CONFIG } from './config';
import type { Character, Vec } from './types';
export interface AiContext {
  moveToward(c: Character, target: Vec, dt: number): boolean;
  fish(c: Character, dt: number): void;
  gather(c: Character, kind: 'tree' | 'rock', dt: number): void;
  goCamp(c: Character, dt: number): void;
  campFor(c: Character): Vec & { fuel: number };
  atCamp(c: Character): boolean;
  refuel(c: Character): boolean;
  upgrade(c: Character): boolean;
  deliver(c: Character): void;
}
/** 仅选择目标；移动、收获、升级和生存全部调用共享规则。 */
export function actAi(c: Character, ctx: AiContext, dt: number) {
  if (c.dead || c.fishing || c.gatherIn > 0) return;
  const camp = ctx.campFor(c);
  // 先保证存活和真实燃料补给。
  if (c.warmth < CONFIG.ai.coldThreshold || (c.warmth < CONFIG.ai.recoverThreshold && c.action === '回营保暖')) {
    if (camp.fuel <= 0 && c.inventory.wood === 0) { ctx.gather(c, 'tree', dt); return; }
    ctx.goCamp(c, dt); c.action = '回营保暖';
    if (ctx.atCamp(c)) ctx.refuel(c);
    c.action = '回营保暖';
    return;
  }
  if (camp.fuel < CONFIG.camp.lowFuel) {
    if (c.inventory.wood > 0) { ctx.goCamp(c, dt); if (ctx.atCamp(c)) ctx.refuel(c); }
    else ctx.gather(c, 'tree', dt);
    return;
  }
  if (!c.rod && c.inventory.wood >= CONFIG.upgrade.wood && c.inventory.ore >= CONFIG.upgrade.ore) {
    ctx.goCamp(c, dt); if (ctx.atCamp(c)) ctx.upgrade(c); return;
  }
  if (c.role === 'gathering') {
    if (c.inventory.wood >= CONFIG.ai.gatherWoodGoal && c.inventory.ore >= CONFIG.ai.gatherOreGoal) {
      ctx.goCamp(c, dt); if (ctx.atCamp(c)) ctx.deliver(c); return;
    }
    ctx.gather(c, c.inventory.wood < CONFIG.ai.gatherWoodGoal ? 'tree' : 'rock', dt); return;
  }
  ctx.fish(c, dt);
}
