import { CONFIG } from './config';
import type { Resource, Vec } from './types';
const GRID = 32;
const cellKey = (x: number, y: number) => `${x},${y}`;
/** Small local navigation grid only for detouring around trees/rocks. No game rules. */
export function clearSegment(a: Vec, b: Vec, resources: Resource[], padding = 24) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  return !resources.some(r => {
    if (!r.amount) return false;
    const t = length ? Math.max(0, Math.min(1, ((r.x - a.x) * dx + (r.y - a.y) * dy) / length)) : 0;
    return Math.hypot(a.x + t * dx - r.x, a.y + t * dy - r.y) < padding;
  });
}
export function routeAround(start: Vec, goal: Vec, resources: Resource[]): Vec[] {
  const point = (x: number, y: number) => ({ x: 48 + x * GRID, y: 128 + y * GRID });
  const cells: { x: number; y: number; p: Vec }[] = [];
  for (let x = 0; x <= 37; x++) for (let y = 0; y <= 20; y++) {
    const p = point(x, y);
    if (clearSegment(p, p, resources, 26)) cells.push({ x, y, p });
  }
  const first = [...cells].sort((a, b) => Math.hypot(a.p.x - start.x, a.p.y - start.y) - Math.hypot(b.p.x - start.x, b.p.y - start.y)).find(c => clearSegment(start, c.p, resources, 22));
  const last = [...cells].sort((a, b) => Math.hypot(a.p.x - goal.x, a.p.y - goal.y) - Math.hypot(b.p.x - goal.x, b.p.y - goal.y)).find(c => clearSegment(c.p, goal, resources, 24));
  if (!first || !last) return [];
  const available = new Set(cells.map(c => cellKey(c.x, c.y)));
  const queue = [first], parents = new Map<string, string | null>([[cellKey(first.x, first.y), null]]);
  const destination = cellKey(last.x, last.y);
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i], key = cellKey(c.x, c.y); if (key === destination) break;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = c.x + dx, y = c.y + dy, next = cellKey(x, y);
      if (!available.has(next) || parents.has(next) || !clearSegment(c.p, point(x, y), resources, 25)) continue;
      parents.set(next, key); queue.push({ x, y, p: point(x, y) });
    }
  }
  if (!parents.has(destination)) return [];
  const path: Vec[] = [goal]; let key: string | null = destination;
  while (key) { const [x, y] = key.split(',').map(Number); path.push(point(x, y)); key = parents.get(key) ?? null; }
  return path.reverse();
}
export function safeGoal(actor: Vec, target: Vec, resources: Resource[]): Vec {
  const obstacle = resources.find(r => r.amount > 0 && Math.hypot(target.x - r.x, target.y - r.y) < 28);
  if (!obstacle) return target;
  const dx = actor.x - obstacle.x, dy = actor.y - obstacle.y, len = Math.hypot(dx, dy) || 1;
  return { x: obstacle.x + dx / len * 48, y: obstacle.y + dy / len * 48 };
}
