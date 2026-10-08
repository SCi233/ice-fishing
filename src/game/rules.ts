import { CONFIG } from './config';
import type { GameState } from './types';
export function finish(state: GameState, winners: number[], reason: string) {
  if (state.phase === 'ended') return;
  state.phase = 'ended'; state.winners = winners; state.resultReason = reason;
  for (const c of state.characters) { c.fishing = null; c.action = '比赛结束'; c.targetId = null; c.gatherIn = 0; }
  for (const hole of state.holes) hole.occupant = null;
}
export function evaluateMatch(state: GameState, dt: number) {
  if (state.phase !== 'playing' && state.phase !== 'overtime') return;
  const highest = Math.max(...state.teams.map(t => t.score));
  const leaders = state.teams.filter(t => t.score === highest).map(t => t.id);
  if (state.options.mode === 'target') {
    if (highest >= state.options.target) finish(state, leaders, '达到目标积分');
    return;
  }
  if (state.phase === 'overtime') {
    if (leaders.length === 1) { finish(state, leaders, '加时取得领先'); return; }
    state.overtimeRemaining = Math.max(0, state.overtimeRemaining - dt);
    if (state.overtimeRemaining === 0) finish(state, leaders, '加时仍平分 · 共同获胜');
  } else {
    state.remaining = Math.max(0, state.remaining - dt);
    if (state.remaining === 0) {
      if (leaders.length === 1) finish(state, leaders, '限时赛结束');
      else { state.phase = 'overtime'; state.overtimeRemaining = CONFIG.match.overtime; }
    }
  }
}
