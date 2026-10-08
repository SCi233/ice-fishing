import { describe, it, expect } from 'vitest';
import { Simulation } from '../src/game/Simulation';
import { CONFIG } from '../src/game/config';
describe('移动与一次完整钓鱼原型', () => {
  it('真实移动到冰面，开洞、等待、按时收竿、物品入袋并释放钓洞', () => {
    const sim = new Simulation(() => .1);
    sim.start({ mode: 'timed', duration: CONFIG.match.duration, target: 100 });
    const before = sim.player.x;
    sim.movePlayer(1, 0, 1);
    expect(sim.player.x).toBeGreaterThan(before);
    sim.player.x = 500; sim.player.y = 490;
    sim.interact(); expect(sim.state.holes).toHaveLength(1);
    sim.interact(); expect(sim.player.fishing?.stage).toBe('waiting');
    for (let i = 0; i < 30; i++) sim.step(.1);
    expect(sim.player.fishing?.stage).toBe('reeling');
    sim.player.fishing!.marker = .5; sim.reel();
    expect(sim.state.teams[0].score).toBe(6);
    expect(sim.player.inventory.silverfish).toBe(1);
    expect(sim.state.holes[0].occupant).toBeNull();
    expect(sim.player.fishing).toBeNull();
  });
});
