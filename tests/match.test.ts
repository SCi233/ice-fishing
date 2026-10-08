import { it, expect } from 'vitest';
import { Simulation } from '../src/game/Simulation';
import { evaluateMatch } from '../src/game/rules';
it('电脑实际移动、开洞并钓鱼后得分', () => {
  const sim = new Simulation(() => .1); sim.start({ mode: 'target', target: 200, duration: 1200 });
  const x = sim.state.characters[2].x;
  for (let i = 0; i < 300; i++) sim.step(.1);
  expect(sim.state.characters[2].x).not.toBe(x);
  expect(sim.state.holes.length).toBeGreaterThan(0);
  expect(sim.state.teams[1].score).toBeGreaterThan(0);
  expect(sim.state.characters[2].inventory.silverfish).toBeGreaterThan(0);
});
it('限时平分进入60秒加时，领先立即获胜', () => {
  const sim = new Simulation(); sim.start({ mode: 'timed', duration: 1, target: 100 });
  evaluateMatch(sim.state, 1); expect(sim.state.phase).toBe('overtime');
  sim.state.teams[0].score = 6; evaluateMatch(sim.state, 0);
  expect(sim.state.phase).toBe('ended'); expect(sim.state.winners).toEqual([0]);
});
it('目标积分立刻结算且重新开始清零', () => {
  const sim = new Simulation(); sim.start({ mode: 'target', duration: 1200, target: 6 });
  sim.state.teams[1].score = 6; evaluateMatch(sim.state, 0);
  expect(sim.state.winners).toEqual([1]);
  sim.start({ mode: 'timed', duration: 1200, target: 100 });
  expect(sim.state.teams[1].score).toBe(0); expect(sim.state.elapsed).toBe(0); expect(sim.state.holes).toHaveLength(0);
});
