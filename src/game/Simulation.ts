import { CAMP_POSITIONS, CONFIG, TEAM_COLORS, ITEM_NAMES } from './config';
import { advanceMarker, inSuccessZone, pickCatch } from './fishing';
import { evaluateMatch } from './rules';
import { actAi } from './ai';
import { clearSegment, routeAround, safeGoal } from './navigation';
import type { Character, GameState, Inventory, ItemId, MatchOptions, Resource, Role, Vec } from './types';

export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const emptyInventory = (): Inventory => ({ silverfish: 0, ribbonfish: 0, moonfish: 0, wood: 0, ore: 0 });
export class Simulation {
  state: GameState;
  campMenuRequested = false;
  private eventId = 0;
  private nextHoleId = 1;
  private routes = new Map<number, { target: Vec; points: Vec[] }>();
  constructor(public random: () => number = Math.random) { this.state = this.createState({ mode: 'timed', duration: CONFIG.match.duration, target: CONFIG.match.target }, 'menu'); }
  get player() { return this.state.characters[0]; }
  get active() { return this.state.phase === 'playing' || this.state.phase === 'overtime'; }
  private createState(options: MatchOptions, phase: GameState['phase']): GameState {
    const resources: Resource[] = [];
    for (const mirror of [false, true]) {
      for (const [x, y] of [[155, 230], [222, 268], [130, 324], [252, 350], [190, 170]]) resources.push({ id: resources.length, x: mirror ? 1280 - x : x, y, kind: 'tree', amount: CONFIG.gather.capacity, respawnIn: 0 });
      for (const [x, y] of [[344, 166], [388, 215], [303, 220]]) resources.push({ id: resources.length, x: mirror ? 1280 - x : x, y, kind: 'rock', amount: CONFIG.gather.capacity, respawnIn: 0 });
    }
    return { phase, options: { ...options }, elapsed: 0, remaining: options.duration, overtimeRemaining: CONFIG.match.overtime,
      teams: [{ id: 0, name: '暖橘小队', color: TEAM_COLORS[0], score: 0 }, { id: 1, name: '霜蓝小队', color: TEAM_COLORS[1], score: 0 }],
      characters: ['你', '松果', '阿岚', '小凛'].map((name, id): Character => {
        const team = id < 2 ? 0 : 1, camp = CAMP_POSITIONS[team];
        return { id, name, team, human: id === 0, color: TEAM_COLORS[team], x: camp.x + (team ? -1 : 1) * (id % 2 ? 60 : 42), y: camp.y + (id % 2 ? -32 : 30), hp: CONFIG.survival.maxHp, warmth: CONFIG.survival.maxWarmth, rod: 0, inventory: emptyInventory(), fishing: null, dead: false, deaths: 0, respawnIn: 0, protection: 0, role: id === 3 ? 'gathering' : 'fishing', action: '准备出发', gatherIn: 0, targetId: null };
      }), holes: [], resources, camps: CAMP_POSITIONS.map((p, team) => ({ ...p, team, fuel: CONFIG.camp.startFuel })), events: [], winners: [], resultReason: '' };
  }
  start(options: MatchOptions) {
    this.routes.clear(); this.nextHoleId = 1; this.eventId = 0; this.campMenuRequested = false;
    this.state = this.createState({ mode: options.mode, duration: Math.max(1, options.duration), target: Math.max(1, Math.floor(options.target)) }, 'playing');
    this.notify('比赛开始！走到冰面按 E 开洞，再按 E 抛竿。', 'info');
  }
  notify(text: string, tone: 'info' | 'success' | 'warning' = 'info') {
    this.state.events.push({ id: ++this.eventId, text, tone, at: this.state.elapsed });
    if (this.state.events.length > 8) this.state.events.shift();
  }
  isLake(p: Vec) { const lake = CONFIG.world.lake; return ((p.x - lake.x) / lake.rx) ** 2 + ((p.y - lake.y) / lake.ry) ** 2 < .93; }
  movePlayer(dx: number, dy: number, dt: number) { if (this.active && !this.player.dead) this.move(this.player, dx, dy, dt); }
  private move(c: Character, dx: number, dy: number, dt: number) {
    const len = Math.hypot(dx, dy); if (!len) return;
    this.cancel(c); c.gatherIn = 0; c.targetId = null;
    const speed = CONFIG.moveSpeed * dt / len;
    const nx = Math.max(38, Math.min(CONFIG.world.width - 38, c.x + dx * speed));
    const ny = Math.max(120, Math.min(CONFIG.world.height - 38, c.y + dy * speed));
    // 资源有简单圆形碰撞；无高度与攀爬。
    const blocked = (x: number, y: number) => this.state.resources.some(r => {
      const radius = r.kind === 'tree' ? 22 : 24, previous = distance(c, r), candidate = Math.hypot(x - r.x, y - r.y);
      // 枯竭资源恢复时可能正有角色经过，允许向外走出新障碍。
      return r.amount > 0 && candidate < radius && (previous >= radius || candidate <= previous);
    });
    if (!blocked(nx, c.y)) c.x = nx;
    if (!blocked(c.x, ny)) c.y = ny;
    c.action = '移动中';
  }
  private cancel(c: Character) {
    if (c.fishing) { const hole = this.state.holes.find(h => h.id === c.fishing!.holeId); if (hole?.occupant === c.id) hole.occupant = null; c.fishing = null; }
  }
  cancelFishing() { if (!this.active) return; this.cancel(this.player); this.player.gatherIn = 0; this.player.targetId = null; this.player.action = '已取消'; }
  private nearbyResource(c: Character) { return this.state.resources.filter(r => r.amount > 0 && distance(c, r) <= CONFIG.interactionRadius).sort((a, b) => distance(c, a) - distance(c, b))[0]; }
  private nearbyHole(c: Character) { return this.state.holes.filter(h => distance(c, h) < 55).sort((a, b) => distance(c, a) - distance(c, b))[0]; }
  getPrompt(): string {
    const c = this.player;
    if (!this.active) return '';
    if (c.dead) return `失温倒下 · ${Math.ceil(c.respawnIn)} 秒后在营地复活`;
    if (c.fishing) return c.fishing.stage === 'waiting' ? '等一等，水下有动静… · 移动或 Esc 取消' : '鱼咬钩了！标记进入金色区域时按 空格';
    if (c.gatherIn > 0) return `正在采集… · 移动取消`;
    if (distance(c, this.state.camps[c.team]) <= CONFIG.interactionRadius) return 'E 打开营地 · 添加木材 / 升级钓竿';
    const r = this.nearbyResource(c); if (r) return r.kind === 'tree' ? 'E 采集雪杉木材' : 'E 采集冰纹矿石';
    const h = this.nearbyHole(c); if (h) return h.occupant === null ? 'E 向钓洞抛竿' : '这个钓洞有人使用 · 找一处新冰面';
    return this.isLake(c) ? 'E 用破冰镐开洞' : '走向冰湖开始钓鱼 · WASD / 方向键移动';
  }
  interact() {
    const c = this.player; if (!this.active || c.dead || c.fishing || c.gatherIn > 0) return;
    if (distance(c, this.state.camps[c.team]) <= CONFIG.interactionRadius) { this.campMenuRequested = true; return; }
    const resource = this.nearbyResource(c); if (resource) { this.beginGather(c, resource); return; }
    const hole = this.nearbyHole(c);
    if (hole) { if (hole.occupant === null) this.cast(c, hole.id); else this.notify('钓洞正被占用，换一处冰面吧。', 'warning'); return; }
    if (this.isLake(c)) { const id = this.drill(c); if (id !== null) this.notify('钓洞开好了！再按 E 抛竿。'); }
  }
  drill(c: Character): number | null {
    if (!this.active || c.dead || !this.isLake(c)) return null;
    if (this.state.holes.some(h => distance(c, h) < CONFIG.holeSpacing)) return null;
    const hole = { id: this.nextHoleId++, x: c.x + 16, y: c.y + 15, occupant: null };
    if (!this.isLake(hole)) { hole.x = c.x; hole.y = c.y; }
    this.state.holes.push(hole); c.action = '凿开钓洞'; return hole.id;
  }
  cast(c: Character, id: number): boolean {
    const hole = this.state.holes.find(h => h.id === id);
    if (!this.active || c.dead || c.fishing || !hole || hole.occupant !== null || distance(c, hole) > CONFIG.interactionRadius) return false;
    c.gatherIn = 0; c.targetId = null; hole.occupant = c.id;
    c.fishing = { holeId: id, stage: 'waiting', elapsed: 0, wait: CONFIG.fishing.waitMin + this.random() * (CONFIG.fishing.waitMax - CONFIG.fishing.waitMin), marker: 0, direction: 1 };
    c.action = '等待咬钩'; return true;
  }
  reel() { const c = this.player; if (this.active && !c.dead && c.fishing?.stage === 'reeling') this.resolveFishing(c, inSuccessZone(c.fishing.marker, c.rod)); }
  resolveFishing(c: Character, success: boolean) {
    if (!this.active || c.dead || c.fishing?.stage !== 'reeling') return;
    if (success) {
      const caught = pickCatch(c.rod, this.random); c.inventory[caught.id]++; this.state.teams[c.team].score += caught.points;
      c.action = `钓到${caught.name}`;
      if (c.human) this.notify(`${caught.name}入袋 · +${caught.points} 分`, 'success');
    } else { c.action = '鱼儿溜走了'; if (c.human) this.notify('鱼儿溜走了，已有积分不变。再按 E 抛竿。', 'warning'); }
    this.cancel(c); evaluateMatch(this.state, 0);
  }
  private updateFishing(c: Character, dt: number) {
    const f = c.fishing; if (!f) return;
    f.elapsed += dt;
    if (f.stage === 'waiting') {
      if (f.elapsed >= f.wait) { f.stage = 'reeling'; f.elapsed = 0; f.marker = 0; f.direction = 1; c.action = '鱼咬钩了'; }
    } else {
      advanceMarker(f, dt);
      if (!c.human && f.elapsed >= CONFIG.fishing.aiReelDelay) this.resolveFishing(c, this.random() < (c.rod ? CONFIG.fishing.upgradedAiSuccess : CONFIG.fishing.aiSuccess));
      else if (f.elapsed >= CONFIG.fishing.reelDuration) this.resolveFishing(c, false);
    }
  }
  private moveToward(c: Character, target: Vec, dt: number): boolean {
    const overlap = this.state.resources.find(r => r.amount > 0 && distance(c, r) < 26);
    if (overlap) {
      let dx = c.x - overlap.x, dy = c.y - overlap.y;
      if (Math.hypot(dx, dy) < .1) dx = c.team ? -1 : 1;
      this.routes.delete(c.id); this.move(c, dx, dy, dt); return false;
    }
    const goal = safeGoal(c, target, this.state.resources);
    if (distance(c, goal) < 6) { this.routes.delete(c.id); return true; }
    let next = goal;
    if (!clearSegment(c, goal, this.state.resources, 25)) {
      let route = this.routes.get(c.id);
      if (!route || distance(route.target, target) > 2 || !route.points.length || !clearSegment(c, route.points[0], this.state.resources, 22)) {
        route = { target: { ...target }, points: routeAround(c, goal, this.state.resources) }; this.routes.set(c.id, route);
      }
      while (route.points.length && distance(c, route.points[0]) < 6) route.points.shift();
      if (route.points.length) next = route.points[0];
    } else this.routes.delete(c.id);
    const dist = distance(c, next);
    this.move(c, next.x - c.x, next.y - c.y, Math.min(dt, dist / CONFIG.moveSpeed)); return false;
  }
  private aiFish(c: Character, dt: number) {
    const spot = { x: c.team === 0 ? 474 + (c.id % 2) * 75 : 806 - (c.id % 2) * 75, y: 437 + (c.id % 2) * 102 };
    const primary = this.state.holes.find(h => distance(h, spot) < 55);
    const destination = primary && primary.occupant !== null && primary.occupant !== c.id ? { x: spot.x, y: spot.y + 110 } : spot;
    if (!this.moveToward(c, destination, dt)) return;
    const hole = this.nearbyHole(c);
    if (hole && hole.occupant === null) this.cast(c, hole.id);
    else if (!hole) { const id = this.drill(c); if (id !== null) this.cast(c, id); }

  }
  private aiStep(c: Character, dt: number) {
    actAi(c, {
      moveToward: (actor, target, d) => this.moveToward(actor, target, d),
      fish: (actor, d) => this.aiFish(actor, d),
      gather: (actor, kind, d) => this.aiGather(actor, kind, d),
      goCamp: (actor, d) => { const p = this.state.camps[actor.team]; this.moveToward(actor, { x: p.x + (actor.team ? -45 : 45), y: p.y + 20 }, d); },
      campFor: actor => this.state.camps[actor.team], atCamp: actor => distance(actor, this.state.camps[actor.team]) < CONFIG.interactionRadius,
      refuel: actor => this.refuel(actor.id), upgrade: actor => this.upgrade(actor.id), deliver: actor => this.deliver(actor),
    }, dt);
  }
  private aiGather(c: Character, kind: 'tree' | 'rock', dt: number) {
    const r = this.state.resources.filter(r => r.kind === kind && r.amount > 0 && (c.team === 0 ? r.x < 640 : r.x > 640)).sort((a, b) => distance(c, a) - distance(c, b))[0];
    if (!r) { c.action = '等待资源恢复'; return; }
    if (distance(c, r) < CONFIG.interactionRadius - 8) this.beginGather(c, r);
    else this.moveToward(c, r, dt);
  }
  private deliver(c: Character) {
    const mate = this.state.characters.find(a => a.team === c.team && a.id !== c.id)!;
    const wood = c.inventory.wood, ore = c.inventory.ore;
    mate.inventory.wood += wood; mate.inventory.ore += ore;
    c.inventory.wood = 0; c.inventory.ore = 0; c.action = '交付队伍材料';
    if (c.team === 0) this.notify(`松果送来 ${wood} 木材、${ore} 矿石，可用于营地与升级。`, 'success');
  }

  private beginGather(c: Character, resource: Resource) { c.gatherIn = CONFIG.gather.duration; c.targetId = resource.id; c.action = resource.kind === 'tree' ? '采集木材' : '采集矿石'; }
  private canUseCamp(c: Character) { return this.active && !c.dead && distance(c, this.state.camps[c.team]) <= CONFIG.interactionRadius; }
  refuel(id = 0): boolean {
    if (!this.active) return false;
    const c = this.state.characters[id], camp = this.state.camps[c.team];
    if (!this.canUseCamp(c)) { if (c.human) this.notify('请靠近本队营地再添加燃料。', 'warning'); return false; }
    if (c.inventory.wood < 1 || camp.fuel >= CONFIG.camp.maxFuel) { if (c.human) this.notify('需要 1 木材，或篝火燃料已满。', 'warning'); return false; }
    c.inventory.wood--; camp.fuel = Math.min(CONFIG.camp.maxFuel, camp.fuel + CONFIG.camp.fuelPerWood); c.action = '给篝火添柴';
    if (c.human) this.notify(`消耗 1 木材 · 篝火燃料 +${CONFIG.camp.fuelPerWood} 秒`, 'success'); return true;
  }
  upgrade(id = 0): boolean {
    if (!this.active) return false;
    const c = this.state.characters[id];
    if (!this.canUseCamp(c)) { if (c.human) this.notify('请靠近本队营地再升级。', 'warning'); return false; }
    if (c.rod || c.inventory.wood < CONFIG.upgrade.wood || c.inventory.ore < CONFIG.upgrade.ore) { if (c.human) this.notify(`升级需要 ${CONFIG.upgrade.wood} 木材、${CONFIG.upgrade.ore} 矿石；每根钓竿只升级一次。`, 'warning'); return false; }
    c.inventory.wood -= CONFIG.upgrade.wood; c.inventory.ore -= CONFIG.upgrade.ore; c.rod = 1;
    if (c.human) this.notify('暖星钓竿升级完成！成功区域更宽，优质钓获概率提高。', 'success'); return true;
  }
  eat(item: ItemId): boolean {
    const c = this.player;
    if (!this.active || c.dead || !['silverfish', 'ribbonfish', 'moonfish'].includes(item) || c.inventory[item] < 1) return false;
    c.inventory[item]--; c.hp = Math.min(CONFIG.survival.maxHp, c.hp + CONFIG.survival.fishHp); c.warmth = Math.min(CONFIG.survival.maxWarmth, c.warmth + CONFIG.survival.fishWarmth);
    this.notify(`使用${ITEM_NAMES[item]} · 恢复 ${CONFIG.survival.fishHp} 生命、${CONFIG.survival.fishWarmth} 保暖`, 'success'); return true;
  }
  setRole(role: Role) {
    if (!this.active) return;
    const c = this.state.characters[1]; if (c.role === role) return;
    this.cancel(c); c.gatherIn = 0; c.targetId = null; this.routes.delete(c.id);
    c.role = role; c.action = role === 'gathering' ? '开始采集补给' : '准备前往冰湖';
  }
  debug(action: string) {
    if (!this.active) return;
    if (action === 'kill') this.die(this.player);
    if (action === 'materials') { this.player.inventory.wood += 6; this.player.inventory.ore += 4; this.notify('测试：给予 6 木材、4 矿石'); }
    if (action === 'short') { this.state.options.mode = 'timed'; this.state.remaining = 10; this.notify('测试：本局剩余 10 秒'); }
    if (action === 'tie') {
      const max = Math.max(...this.state.teams.map(t => t.score)); this.state.teams.forEach(t => t.score = max);
      this.state.characters.forEach(c => this.cancel(c)); this.state.options.mode = 'timed'; this.state.phase = 'playing'; this.state.remaining = 0;
      evaluateMatch(this.state, 0); this.notify('测试：强制平分，进入 60 秒加时');
    }
  }
  private die(c: Character) {
    this.routes.delete(c.id); this.cancel(c); c.gatherIn = 0; c.targetId = null; c.dead = true; c.hp = 0; c.deaths++;
    c.respawnIn = CONFIG.respawnTiers[Math.min(c.deaths - 1, 2)]; c.action = '等待复活';
    if (c.human) this.notify(`你因失温倒下，${c.respawnIn} 秒后在营地复活。积分和物品保留。`, 'warning');
  }
  private updateSurvival(c: Character, dt: number) {
    if (c.dead) {
      c.respawnIn = Math.max(0, c.respawnIn - dt);
      if (c.respawnIn < .00001) {
        const camp = this.state.camps[c.team]; c.x = camp.x + (c.team ? -42 : 42); c.y = camp.y + 30;
        c.hp = CONFIG.survival.maxHp; c.warmth = CONFIG.survival.maxWarmth; c.dead = false; c.respawnIn = 0; c.protection = CONFIG.survival.respawnProtection; c.action = '复活 · 暂时免受寒冷';
        if (c.human) this.notify('已在营地复活！生命和保暖恢复，短暂御寒保护。', 'success');
      }
      return;
    }
    c.protection = Math.max(0, c.protection - dt);
    const camp = this.state.camps[c.team];
    if (camp.fuel > 0 && distance(c, camp) < CONFIG.survival.warmthRadius) {
      c.warmth = Math.min(CONFIG.survival.maxWarmth, c.warmth + CONFIG.survival.warmPerSecond * dt);
      c.hp = Math.min(CONFIG.survival.maxHp, c.hp + CONFIG.survival.healPerSecond * dt);
    } else if (c.protection <= 0) c.warmth = Math.max(0, c.warmth - CONFIG.survival.coldPerSecond * dt);
    if (c.warmth <= 0 && c.protection <= 0) { c.hp = Math.max(0, c.hp - CONFIG.survival.damagePerSecond * dt); if (c.hp <= 0) this.die(c); }
  }
  private updateGather(c: Character, dt: number) {
    if (c.gatherIn <= 0) return;
    const r = this.state.resources.find(r => r.id === c.targetId);
    if (!r || r.amount <= 0 || distance(c, r) > CONFIG.interactionRadius) { c.gatherIn = 0; c.targetId = null; return; }
    c.gatherIn = Math.max(0, c.gatherIn - dt);
    if (c.gatherIn < .00001) {
      const amount = Math.min(CONFIG.gather.yield, r.amount), item = r.kind === 'tree' ? 'wood' : 'ore';
      c.inventory[item] += amount; r.amount -= amount; c.gatherIn = 0; c.targetId = null; c.action = `获得${ITEM_NAMES[item]}`;
      if (r.amount === 0) r.respawnIn = CONFIG.gather.respawn;
      if (c.human) this.notify(`采集获得 ${amount} ${ITEM_NAMES[item]} · 采集不计比赛积分`);
    }
  }
  private aiStepIfNeeded(c: Character, dt: number) { if (!c.human) this.aiStep(c, dt); }
  step(dt: number) {
    if (!this.active) return; dt = Math.min(.1, Math.max(0, dt)); this.state.elapsed += dt;
    for (const camp of this.state.camps) camp.fuel = Math.max(0, camp.fuel - dt);
    for (const r of this.state.resources) if (r.amount === 0) { r.respawnIn = Math.max(0, r.respawnIn - dt); if (r.respawnIn === 0) r.amount = CONFIG.gather.capacity; }
    for (const c of this.state.characters) {
      this.updateSurvival(c, dt);
      if (!c.dead) { this.aiStepIfNeeded(c, dt); this.updateGather(c, dt); this.updateFishing(c, dt); }
      if (!this.active) break;
    }
    evaluateMatch(this.state, dt);
  }
}
