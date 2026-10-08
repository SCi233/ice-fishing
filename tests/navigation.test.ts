import { it, expect } from 'vitest';
import { Simulation } from '../src/game/Simulation';

it('AI gathers, delivers supplies, upgrades and maintains both camps for 180 seconds', () => {
  let seed = 331;
  const sim = new Simulation(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; });
  sim.start({ mode: 'timed', duration: 1200, target: 100 });
  sim.setRole('gathering');
  let deaths = 0;
  for (let i = 0; i < 3600; i++) {
    sim.step(.05);
    deaths = Math.max(deaths, ...sim.state.characters.map(c=>c.deaths));
  }
  expect(sim.state.teams[1].score).toBeGreaterThan(0);
  expect(sim.state.holes.length).toBeGreaterThan(0);
  expect(sim.state.characters[1].rod).toBe(1);
  expect(sim.player.inventory.wood).toBeGreaterThan(0);
  expect(deaths).toBe(0);
  expect(sim.state.camps[0].fuel).toBeGreaterThan(0);
  expect(sim.state.camps[1].fuel).toBeGreaterThan(0);
});

it('AI walks to an alternate fishing point when the player occupies its first choice', () => {
  const sim = new Simulation(() => .1);
  sim.start({ mode:'timed', duration:1200, target:100 });
  sim.player.x=549; sim.player.y=539;
  const id=sim.drill(sim.player)!;
  sim.cast(sim.player,id);
  sim.player.fishing!.wait=60;
  sim.state.characters[1].x=549;sim.state.characters[1].y=539;
  for(let i=0;i<400;i++) sim.step(.05);
  expect(sim.state.holes.some(h=>h.id!==id && h.x<640)).toBe(true);
});

it('all actions preserve the finished match state', () => {
  const sim = new Simulation(() => .1);
  sim.start({ mode:'timed', duration:1, target:100 });
  sim.state.teams[0].score=1;
  for(let i=0;i<20;i++) sim.step(.1);
  expect(sim.state.phase).toBe('ended');
  const before=JSON.stringify(sim.state);
  sim.step(.1); sim.movePlayer(1,1,.1); sim.interact(); sim.reel();
  sim.refuel(); sim.upgrade(); sim.cancelFishing(); sim.setRole('gathering');
  expect(JSON.stringify(sim.state)).toBe(before);
});
