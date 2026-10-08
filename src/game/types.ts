export type Phase = 'menu' | 'playing' | 'overtime' | 'ended';
export type Role = 'fishing' | 'gathering';
export interface Vec { x: number; y: number }
export type ItemId = 'silverfish' | 'ribbonfish' | 'moonfish' | 'wood' | 'ore';
export type Inventory = Record<ItemId, number>;
export interface CatchDef { id: ItemId; name: string; points: number; weight: number; upgradedWeight: number; color: number }
export interface Fishing { holeId: number; stage: 'waiting' | 'reeling'; elapsed: number; wait: number; marker: number; direction: number; resolved?: boolean }
export interface Character extends Vec {
  id: number; name: string; team: number; human: boolean; color: number;
  hp: number; warmth: number; rod: 0 | 1; inventory: Inventory; fishing: Fishing | null;
  dead: boolean; deaths: number; respawnIn: number; protection: number;
  role: Role; action: string; gatherIn: number; targetId: number | null;
}
export interface Hole extends Vec { id: number; occupant: number | null }
export interface Resource extends Vec { id: number; kind: 'tree' | 'rock'; amount: number; respawnIn: number }
export interface Camp extends Vec { team: number; fuel: number }
export interface Team { id: number; name: string; color: number; score: number }
export interface MatchOptions { mode: 'timed' | 'target'; duration: number; target: number }
export interface GameEvent { id: number; text: string; tone: 'info' | 'success' | 'warning'; at: number }
export interface GameState {
  phase: Phase; options: MatchOptions; elapsed: number; remaining: number; overtimeRemaining: number;
  teams: Team[]; characters: Character[]; holes: Hole[]; resources: Resource[]; camps: Camp[];
  events: GameEvent[]; winners: number[]; resultReason: string;
}
