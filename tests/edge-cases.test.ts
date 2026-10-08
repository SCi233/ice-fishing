import { describe, expect, it } from 'vitest';
import { Simulation, distance } from '../src/game/Simulation';
import { CATCHES, CONFIG } from '../src/game/config';
import { inSuccessZone, pickCatch, zoneWidth } from '../src/game/fishing';
import { evaluateMatch } from '../src/game/rules';

const options = { mode: 'target' as const, target: 100_000, duration: CONFIG.match.duration };

function createSolo(random: () => number = () => .1) {
  const sim = new Simulation(random);
  sim.start(options);
  // 独立检验玩家规则时让其他角色不执行电脑决策，避免无关收获影响队伍积分。
  for (const actor of sim.state.characters.slice(1)) actor.human = true;
  return sim;
}

function advance(sim: Simulation, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / .1); i++) sim.step(.1);
}

function until(sim: Simulation, condition: () => boolean, timeout: number) {
  for (let i = 0; i < Math.ceil(timeout / .1) && !condition(); i++) sim.step(.1);
  expect(condition(), `在 ${timeout} 秒内应达到指定状态`).toBe(true);
}

function cast(sim: Simulation) {
  sim.player.x = 500; sim.player.y = 490;
  sim.interact();
  sim.interact();
  expect(sim.player.fishing?.stage).toBe('waiting');
  return sim.state.holes.find(h => h.occupant === sim.player.id)!;
}

function ready(sim: Simulation) {
  const hole = cast(sim);
  until(sim, () => sim.player.fishing?.stage === 'reeling', CONFIG.fishing.waitMax + .5);
  return hole;
}

function atCamp(sim: Simulation) {
  const camp = sim.state.camps[sim.player.team];
  sim.player.x = camp.x + 40; sim.player.y = camp.y;
  return camp;
}

describe('钓鱼与一次性计分', () => {
  it('咬钩前不能收获，失败保留已有分数，成功后重复收竿不重复计分', () => {
    const sim = createSolo();
    sim.state.teams[0].score = 37;
    const hole = cast(sim);
    sim.reel();
    expect(sim.player.inventory.silverfish).toBe(0);
    expect(sim.state.teams[0].score).toBe(37);
    until(sim, () => sim.player.fishing?.stage === 'reeling', CONFIG.fishing.waitMax + .5);
    sim.player.fishing!.marker = 0;
    sim.reel();
    expect(sim.state.teams[0].score).toBe(37);
    expect(sim.player.inventory.silverfish).toBe(0);
    expect(hole.occupant).toBeNull();
    sim.interact();
    until(sim, () => sim.player.fishing?.stage === 'reeling', CONFIG.fishing.waitMax + .5);
    sim.player.fishing!.marker = .5;
    sim.reel();
    expect(sim.state.teams[0].score).toBe(43);
    expect(sim.player.inventory.silverfish).toBe(1);
    sim.reel(); sim.reel();
    expect(sim.state.teams[0].score).toBe(43);
    expect(sim.player.inventory.silverfish).toBe(1);
  });

  it.each(['移动', '取消', '死亡'] as const)('%s时释放钓洞，其他角色可以接着使用', action => {
    const sim = createSolo();
    const hole = cast(sim);
    if (action === '移动') sim.movePlayer(1, 0, .1);
    if (action === '取消') sim.cancelFishing();
    if (action === '死亡') sim.debug('kill');
    expect(sim.player.fishing).toBeNull();
    expect(hole.occupant).toBeNull();
    const teammate = sim.state.characters[1];
    teammate.x = hole.x; teammate.y = hole.y;
    expect(sim.cast(teammate, hole.id)).toBe(true);
    expect(hole.occupant).toBe(teammate.id);
  });

  it('错过收竿时限失去本次钓获并释放钓洞', () => {
    const sim = createSolo();
    const hole = ready(sim);
    advance(sim, CONFIG.fishing.reelDuration + .2);
    expect(sim.player.fishing).toBeNull();
    expect(hole.occupant).toBeNull();
    expect(sim.state.teams[0].score).toBe(0);
    expect(Object.values(sim.player.inventory).every(n => n === 0)).toBe(true);
  });

  it('玩家收竿达到目标时立即结算，并停止计分、移动和新抛竿', () => {
    const sim = createSolo();
    sim.state.options.target = 6;
    const hole = ready(sim);
    sim.player.fishing!.marker = .5;
    sim.reel();
    expect(sim.state.phase).toBe('ended');
    expect(sim.state.winners).toEqual([0]);
    expect(sim.state.teams[0].score).toBe(6);
    expect(hole.occupant).toBeNull();
    expect(sim.state.characters.every(c => c.fishing === null)).toBe(true);
    const before = { x: sim.player.x, y: sim.player.y, elapsed: sim.state.elapsed };
    sim.movePlayer(1, 1, 1); sim.interact(); sim.reel(); advance(sim, 3);
    expect(sim.cast(sim.player, hole.id)).toBe(false);
    expect(sim.player.x).toBe(before.x); expect(sim.player.y).toBe(before.y);
    expect(sim.state.elapsed).toBe(before.elapsed);
    expect(sim.state.teams[0].score).toBe(6);
  });
});

describe('比赛规则与重开', () => {
  it('正式限时赛默认保持20分钟，短局有独立配置', () => {
    const sim = new Simulation();
    expect(sim.state.options.mode).toBe('timed');
    expect(sim.state.options.duration).toBe(20 * 60);
    expect(CONFIG.match.shortDuration).toBe(2 * 60);
  });

  it('限时平分进入最多一分钟加时，加时仍平分共同获胜并释放全部洞', () => {
    const sim = createSolo();
    sim.state.options.mode = 'timed'; sim.state.remaining = 1;
    const hole = cast(sim);
    sim.state.teams[0].score = 42; sim.state.teams[1].score = 42;
    evaluateMatch(sim.state, 1);
    expect(sim.state.phase).toBe('overtime');
    expect(sim.state.overtimeRemaining).toBe(60);
    evaluateMatch(sim.state, 59.9);
    expect(sim.state.phase).toBe('overtime');
    evaluateMatch(sim.state, .2);
    expect(sim.state.phase).toBe('ended');
    expect(sim.state.winners).toEqual([0, 1]);
    expect(hole.occupant).toBeNull();
    expect(sim.player.fishing).toBeNull();
  });

  it('新一局清空物品、分数、钓洞、死亡档位和上一局计时', () => {
    const sim = createSolo();
    ready(sim); sim.player.fishing!.marker = .5; sim.reel();
    sim.debug('materials'); atCamp(sim); sim.upgrade();
    sim.debug('kill'); advance(sim, 2);
    sim.state.characters[1].inventory.wood = 8;
    sim.state.characters[1].deaths = 3;
    sim.start({ mode: 'timed', duration: CONFIG.match.duration, target: 100 });
    expect(sim.state.phase).toBe('playing');
    expect(sim.state.elapsed).toBe(0);
    expect(sim.state.remaining).toBe(20 * 60);
    expect(sim.state.overtimeRemaining).toBe(60);
    expect(sim.state.teams.map(t => t.score)).toEqual([0, 0]);
    expect(sim.state.holes).toHaveLength(0);
    expect(sim.state.winners).toEqual([]);
    for (const actor of sim.state.characters) {
      expect(actor.dead).toBe(false);
      expect(actor.deaths).toBe(0); expect(actor.respawnIn).toBe(0);
      expect(actor.fishing).toBeNull(); expect(actor.rod).toBe(0);
      expect(actor.hp).toBe(CONFIG.survival.maxHp);
      expect(actor.warmth).toBe(CONFIG.survival.maxWarmth);
      expect(Object.values(actor.inventory).every(n => n === 0)).toBe(true);
    }
    expect(sim.state.camps.every(c => c.fuel === CONFIG.camp.startFuel)).toBe(true);
  });
});

describe('材料、燃料与钓竿升级', () => {
  it('真实采集木材与矿石消耗资源，采集不增加比赛积分', () => {
    const sim = createSolo();
    for (const [kind, item] of [['tree', 'wood'], ['rock', 'ore']] as const) {
      const resource = sim.state.resources.find(r => r.kind === kind)!;
      const before = resource.amount;
      sim.player.x = resource.x + 35; sim.player.y = resource.y;
      sim.interact();
      expect(sim.player.gatherIn).toBeGreaterThan(0);
      expect(sim.player.inventory[item]).toBe(0);
      until(sim, () => sim.player.inventory[item] > 0, CONFIG.gather.duration + .5);
      expect(resource.amount).toBeLessThan(before);
      expect(sim.state.teams[0].score).toBe(0);
    }
  });

  it('营地加燃料真实消耗木材，不能隔空添加，也不能凭空添加', () => {
    const sim = createSolo();
    const camp = sim.state.camps[0]; camp.fuel = 0;
    sim.player.inventory.wood = 2;
    sim.player.x = 640; sim.player.y = 470;
    expect(sim.refuel()).toBe(false);
    expect(sim.player.inventory.wood).toBe(2);
    atCamp(sim);
    expect(sim.refuel()).toBe(true);
    expect(sim.player.inventory.wood).toBe(1);
    expect(camp.fuel).toBe(CONFIG.camp.fuelPerWood);
    expect(sim.refuel()).toBe(true);
    expect(sim.player.inventory.wood).toBe(0);
    expect(sim.refuel()).toBe(false);
    expect(camp.fuel).toBe(2 * CONFIG.camp.fuelPerWood);
    expect(sim.state.teams[0].score).toBe(0);
  });

  it('升级需要在营地消耗4木3矿，只能升级一次，失败不吞材料', () => {
    const sim = createSolo();
    sim.player.inventory.wood = 4; sim.player.inventory.ore = 2;
    atCamp(sim);
    expect(sim.upgrade()).toBe(false);
    expect(sim.player.inventory.wood).toBe(4);
    expect(sim.player.inventory.ore).toBe(2);
    sim.player.inventory.ore = 3;
    sim.player.x = 640; sim.player.y = 470;
    expect(sim.upgrade()).toBe(false);
    expect(sim.player.rod).toBe(0);
    atCamp(sim);
    expect(sim.upgrade()).toBe(true);
    expect(sim.player.rod).toBe(1);
    expect(sim.player.inventory.wood).toBe(0);
    expect(sim.player.inventory.ore).toBe(0);
    sim.player.inventory.wood = 4; sim.player.inventory.ore = 3;
    expect(sim.upgrade()).toBe(false);
    expect(sim.player.inventory.wood).toBe(4);
    expect(sim.player.inventory.ore).toBe(3);
    expect(sim.state.teams[0].score).toBe(0);
  });

  it('升级确实扩大收竿容错，并提高稀有鱼机会', () => {
    expect(zoneWidth(1)).toBeGreaterThan(zoneWidth(0));
    expect(inSuccessZone(.65, 0)).toBe(false);
    expect(inSuccessZone(.65, 1)).toBe(true);
    const outcomes = [0, 1].map(rod => {
      let rare = 0;
      // 穷举均匀分位，避免随机统计造成不稳定的测试。
      for (let i = 0; i < 1000; i++) {
        const caught = pickCatch(rod, () => (i + .5) / 1000);
        expect(CATCHES.some(c => c.id === caught.id)).toBe(true);
        if (caught.id === 'moonfish' || caught.id === 'ribbonfish') rare++;
      }
      return rare;
    });
    expect(outcomes[1]).toBeGreaterThan(outcomes[0]);
  });

  it('吃已经得分的鱼只消耗物品并恢复状态，不重复得分', () => {
    const sim = createSolo();
    ready(sim); sim.player.fishing!.marker = .5; sim.reel();
    sim.player.hp = 50; sim.player.warmth = 50;
    const before = sim.state.teams[0].score;
    expect(sim.eat('silverfish')).toBe(true);
    expect(sim.player.inventory.silverfish).toBe(0);
    expect(sim.player.hp > 50 || sim.player.warmth > 50).toBe(true);
    expect(sim.state.teams[0].score).toBe(before);
    expect(sim.eat('silverfish')).toBe(false);
    expect(sim.state.teams[0].score).toBe(before);
    expect(sim.eat('wood')).toBe(false);
  });
});

describe('失温、死亡与复活', () => {
  it('野外逐渐失温，燃烧的篝火恢复保暖，熄灭篝火无法恢复', () => {
    const sim = createSolo();
    sim.player.x = 640; sim.player.y = 470; sim.player.warmth = 70;
    advance(sim, 2);
    expect(sim.player.warmth).toBeLessThan(70);
    const camp = atCamp(sim); sim.player.warmth = 50;
    advance(sim, 1);
    expect(sim.player.warmth).toBeGreaterThan(50);
    camp.fuel = 0; sim.player.warmth = 50;
    advance(sim, 1);
    expect(sim.player.warmth).toBeLessThan(50);
  });

  it('严重失温损失生命并死亡，保留物品和比赛积分', () => {
    const sim = createSolo();
    sim.player.x = 640; sim.player.y = 470;
    sim.player.warmth = 0; sim.player.hp = 3;
    sim.player.inventory.moonfish = 1; sim.state.teams[0].score = 25;
    until(sim, () => sim.player.dead, 2);
    expect(sim.player.hp).toBe(0);
    expect(sim.player.inventory.moonfish).toBe(1);
    expect(sim.state.teams[0].score).toBe(25);
    expect(sim.player.respawnIn).toBeGreaterThan(9);
  });

  it('个人死亡等待依次10/20/30/30秒，复活回本队营地并有初始保护', () => {
    const sim = createSolo();
    sim.player.inventory.ore = 3; sim.state.teams[0].score = 17;
    for (const wait of [10, 20, 30, 30]) {
      sim.debug('kill');
      expect(sim.player.dead).toBe(true);
      expect(sim.player.respawnIn).toBe(wait);
      advance(sim, wait - 1);
      expect(sim.player.dead).toBe(true);
      until(sim, () => !sim.player.dead, 2);
      expect(distance(sim.player, sim.state.camps[0])).toBeLessThan(CONFIG.survival.warmthRadius);
      expect(sim.player.hp).toBe(CONFIG.survival.maxHp);
      expect(sim.player.warmth).toBeGreaterThan(0);
      expect(sim.player.protection).toBeGreaterThan(0);
      expect(sim.player.inventory.ore).toBe(3);
      expect(sim.state.teams[0].score).toBe(17);
    }
    // 保护期即使立刻离营且严重失温，也不再次死亡。
    sim.player.x = 640; sim.player.y = 470;
    sim.player.hp = 1; sim.player.warmth = 0;
    advance(sim, 1);
    expect(sim.player.dead).toBe(false);
  });
});

describe('电脑角色执行相同规则', () => {
  it('电脑移动开洞、真实等待咬钩；失败不凭空产生物品或积分', () => {
    let random = .99;
    const sim = new Simulation(() => random); sim.start(options);
    const actor = sim.state.characters[2], startX = actor.x;
    until(sim, () => actor.fishing?.stage === 'waiting', 10);
    expect(actor.x).not.toBe(startX);
    expect(sim.state.holes.some(h => h.occupant === actor.id)).toBe(true);
    expect(sim.state.teams[1].score).toBe(0);
    advance(sim, CONFIG.fishing.waitMin - .2);
    expect(actor.fishing?.stage).toBe('waiting');
    expect(sim.state.teams[1].score).toBe(0);
    until(sim, () => actor.fishing === null, CONFIG.fishing.waitMax + 2);
    expect(Object.values(actor.inventory).every(n => n === 0)).toBe(true);
    expect(sim.state.teams[1].score).toBe(0);
    expect(sim.state.holes.every(h => h.occupant !== actor.id)).toBe(true);
    random = .1;
    until(sim, () => actor.inventory.silverfish > 0, 10);
    expect(sim.state.teams[1].score).toBe(6);
  });

  it('低温电脑会实际返回营地恢复，燃料不足时消耗所携木材补给', () => {
    const sim = new Simulation(() => .1); sim.start(options);
    const actor = sim.state.characters[1], camp = sim.state.camps[0];
    // 只观察这一名电脑，其他角色保留实体但关闭自主决策。
    sim.state.characters[2].human = true; sim.state.characters[3].human = true;
    actor.x = 474; actor.y = 437; actor.warmth = 20;
    actor.inventory.wood = 2; camp.fuel = 0;
    until(sim, () => camp.fuel > 0, 8);
    expect(distance(actor, camp)).toBeLessThan(CONFIG.interactionRadius);
    expect(actor.inventory.wood).toBeLessThan(2);
    until(sim, () => actor.warmth > 70, 10);
    expect(actor.dead).toBe(false);
    expect(sim.state.teams[0].score).toBe(0);
  });

  it('队友采集职责会获得真实材料，切回钓鱼后才靠钓获加分', () => {
    const sim = new Simulation(() => .1); sim.start(options);
    sim.state.characters[2].human = true; sim.state.characters[3].human = true;
    const teammate = sim.state.characters[1];
    sim.setRole('gathering');
    expect(teammate.role).toBe('gathering');
    until(sim, () => teammate.inventory.wood > 0, 10);
    expect(sim.state.teams[0].score).toBe(0);
    sim.setRole('fishing');
    expect(teammate.role).toBe('fishing');
    until(sim, () => sim.state.teams[0].score > 0, 15);
    expect(teammate.inventory.silverfish).toBeGreaterThan(0);
  });

  it('采集队友实际搬回材料交给玩家，材料转移不再加分', () => {
    const sim = new Simulation(() => .1); sim.start(options);
    sim.state.characters[2].human = true; sim.state.characters[3].human = true;
    const teammate = sim.state.characters[1];
    // 已升级的队友无需先消耗这批材料升级，可以完整检验交付流程。
    teammate.rod = 1; sim.state.camps[0].fuel = CONFIG.camp.maxFuel;
    sim.setRole('gathering');
    until(sim, () => sim.player.inventory.wood > 0 && sim.player.inventory.ore > 0, 60);
    expect(distance(teammate, sim.state.camps[0])).toBeLessThan(CONFIG.interactionRadius);
    expect(sim.player.inventory.wood).toBeGreaterThanOrEqual(CONFIG.ai.gatherWoodGoal);
    expect(sim.player.inventory.ore).toBeGreaterThanOrEqual(CONFIG.ai.gatherOreGoal);
    expect(teammate.inventory.wood).toBe(0);
    expect(teammate.inventory.ore).toBe(0);
    expect(sim.state.teams[0].score).toBe(0);
  });
});
