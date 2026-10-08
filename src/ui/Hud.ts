import { CONFIG, ITEM_NAMES } from '../game/config';
import type { Simulation } from '../game/Simulation';
import type { ItemId, MatchOptions } from '../game/types';

const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => HTML_ESCAPES[character]);

/** 中文 DOM 界面；只显示模拟状态，操作全部交回 Simulation。 */
export class Hud {
  private panelOpen = false;
  private showMenu = true;
  private showGuide = false;
  private firstGame = true;
  private lastEvent = -1;
  private lastInventory = '';
  private lastOptions: MatchOptions = { mode: 'timed', duration: CONFIG.match.duration, target: CONFIG.match.target };

  constructor(private readonly sim: Simulation, private readonly root: HTMLElement) {
    root.classList.add('ui-root');
    root.innerHTML = `
      <div class="match-hud" data-testid="match-hud" hidden>
        <div class="match-heading"><span class="brand-mark">❄</span><div><strong>冰湖小队</strong><small>本地试玩 · 1 位玩家 + 3 位电脑</small></div></div>
        <div class="scoreboard"><div class="team-score team-amber"><span>暖橘小队<small>你与电脑队友</small></span><strong id="score-0" data-testid="score-0">0</strong></div><div class="match-clock"><span id="clock-label">剩余时间</span><strong id="clock" data-testid="clock">20:00</strong></div><div class="team-score team-blue"><strong id="score-1" data-testid="score-1">0</strong><span>霜蓝小队<small>两位电脑对手</small></span></div></div>
        <button class="hud-panel-button" id="panel-toggle" aria-expanded="false" aria-controls="inventory-panel">背包 · 营地 <kbd>B</kbd></button>
      </div>
      <div class="player-status" hidden><div class="status-title"><span class="player-dot"></span><strong>你 · 暖橘小队</strong><span id="rod-label">基础钓竿</span></div><div class="meter-row"><span>生命</span><div class="status-meter hp-meter"><i id="hp-fill"></i></div><b id="hp-text" data-testid="hp">100</b></div><div class="meter-row"><span>保暖</span><div class="status-meter warmth-meter"><i id="warmth-fill"></i></div><b id="warmth-text" data-testid="warmth">100</b></div><p id="survival-hint">在燃烧的营火旁恢复保暖</p></div>
      <div class="event-stack" aria-live="polite" aria-atomic="false" hidden></div>
      <div class="guide-card" hidden><button id="guide-close" class="icon-button" aria-label="关闭新手引导">×</button><span class="eyebrow">第一竿，从这里开始</span><p><kbd>WASD</kbd> / 方向键移动到湖面，按 <kbd>E</kbd> 凿洞，再按 <kbd>E</kbd> 抛竿。咬钩后，标记进入金色区域时按 <kbd>空格</kbd>。</p><small>冷了就回营地。树林取木材，矿区取矿石；靠近按 E 采集。</small></div>
      <div class="context-prompt" data-testid="prompt" hidden><kbd>E</kbd><span id="prompt-text"></span></div>
      <div class="key-help" hidden><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 互动</span><span><kbd>空格</kbd> 收竿</span><span><kbd>B</kbd> 背包</span><span><kbd>Esc</kbd> 取消 / 菜单</span></div>
      <div class="fishing-widget" hidden data-testid="fishing-widget"><div class="fishing-header"><span class="fishing-label">咬钩了！</span><strong>进入金色区域，按 <kbd>空格</kbd></strong><button id="cancel-fishing" class="text-button">取消</button></div><div class="fishing-track"><div class="fishing-zone" id="fishing-zone"></div><i class="fishing-marker" id="fishing-marker"></i></div><p>失败不会扣分 · 移动会收起钓竿</p></div>
      <div class="waiting-widget" hidden><span class="waiting-dot"></span>浮漂轻晃，耐心等鱼咬钩… <small>移动或 Esc 取消</small></div>
      <div class="death-card" hidden data-testid="death-card"><span class="eyebrow">营地正在接应你</span><strong>失温倒下了</strong><p><b id="respawn-count">10</b> 秒后在己方营地复活</p><small>积分和背包保留 · 复活后有短暂保暖保护</small></div>
      <aside class="inventory-panel" id="inventory-panel" hidden><div class="panel-heading"><div><span class="eyebrow">冰湖补给站</span><h2>背包与营地</h2></div><button id="panel-close" class="icon-button" aria-label="关闭背包">×</button></div><div class="panel-scroll"><div class="panel-section"><h3>随身物品 <span>钓获已计分</span></h3><div id="inventory-list" class="inventory-list"></div><p class="muted">使用鱼恢复生命和保暖，使用物品不会再次加分。</p></div><div class="panel-section"><h3>营地补给 <span id="camp-fuel">燃料 95 秒</span></h3><div class="camp-fuel-track"><i id="camp-fuel-fill"></i></div><p id="camp-distance">回到己方营地即可补充燃料和升级。</p><button class="action-button" id="refuel-button">添一根木材 <span>燃料 +${CONFIG.camp.fuelPerWood} 秒</span></button><button class="action-button" id="upgrade-button">升级钓竿 <span>${CONFIG.upgrade.wood} 木材 + ${CONFIG.upgrade.ore} 矿石</span></button><p class="muted" id="upgrade-hint">升级会扩大成功区域，提高优质钓获的机会。</p></div><div class="panel-section"><h3>电脑队友分工</h3><div class="role-switch"><button id="role-fishing" data-role="fishing">主要钓鱼</button><button id="role-gathering" data-role="gathering">主要采集</button></div><p id="teammate-state" class="muted">队友正在准备。</p></div><p class="panel-footnote">背包打开时比赛继续。按 B 或 Esc 返回冰湖。</p></div></aside>
      <div class="start-overlay" data-testid="start-menu"><div class="start-card"><div class="start-art" aria-hidden="true"><span class="art-sun"></span><span class="art-ridge ridge-back"></span><span class="art-ridge ridge-front"></span><span class="art-lake"></span><span class="art-line"></span><span class="art-float"></span><span class="art-pine pine-one"></span><span class="art-pine pine-two"></span><span class="art-camp"></span><span class="art-snow snow-one"></span><span class="art-snow snow-two"></span></div><div class="start-content"><div class="edition-badge"><i></i> 本地试玩</div><h1>冰湖小队<span>一竿惊喜，一簇暖火。</span></h1><p class="start-intro">在冰湖上凿洞垂钓，和队友采集补给、照料营火。<br>投下一竿，向胜利出发。</p><div class="local-teams"><span><i class="amber-dot"></i> 你 + 1 位电脑队友</span><b>对阵</b><span><i class="blue-dot"></i> 2 位电脑对手</span></div><fieldset class="mode-picker"><legend>选择赛制</legend><label class="mode-choice"><input type="radio" name="mode" value="timed" checked><span><strong>限时赛</strong><small>正式 20 分钟 · 平分进入加时</small></span></label><label class="mode-choice"><input type="radio" name="mode" value="target"><span><strong>目标积分赛</strong><small>先达到目标积分的小队获胜</small></span></label></fieldset><div class="match-option" id="timed-option"><label class="checkbox-label"><input type="checkbox" id="short-game"><span>测试短局 · 2 分钟</span></label><small>正式限时赛默认 20 分钟</small></div><div class="match-option" id="target-option" hidden><label for="target-score">目标积分</label><input id="target-score" type="number" value="${CONFIG.match.target}" min="10" max="10000" step="10"><small>不限制时间</small></div><button class="primary-button" id="start-button" data-testid="start-button">开始比赛 <span>→</span></button><div class="start-controls"><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 凿洞 / 互动</span><span><kbd>空格</kbd> 看准收竿</span></div><p class="prototype-note">原创玩法原型 · 平衡数值为暂定试玩值</p></div></div><div class="start-bottom">冰湖、树林、矿区和营火都准备好了。</div></div>
      <div class="result-overlay" hidden data-testid="result"><div class="result-card"><span class="eyebrow">本地试玩 · 比赛结束</span><div class="result-medal" aria-hidden="true">✦</div><h2 id="result-title">暖橘小队获胜</h2><p id="result-reason"></p><div class="result-scores"><div class="team-amber"><span>暖橘小队</span><strong id="result-score-0">0</strong><small>你 + 电脑队友</small></div><div class="team-blue"><span>霜蓝小队</span><strong id="result-score-1">0</strong><small>电脑对手 × 2</small></div></div><p class="result-note">这一局的鱼获已留在冰湖的记忆里。</p><button class="primary-button" id="restart-button" data-testid="restart-button">再玩一局 <span>→</span></button><button class="secondary-button" id="change-mode-button">调整赛制</button></div></div>
      <div class="debug-tools" hidden><span>仅测试</span><button data-debug="short">缩短本局</button><button data-debug="tie">强制平分</button><button data-debug="kill">触发死亡</button><button data-debug="materials">给予升级材料</button></div>`;

    this.$('#start-button').addEventListener('click', () => {
      const mode = this.$<HTMLInputElement>('input[name="mode"]:checked').value as 'timed' | 'target';
      const targetInput = this.$<HTMLInputElement>('#target-score');
      const target = Math.min(10000, Math.max(10, Number(targetInput.value) || CONFIG.match.target));
      targetInput.value = String(target);
      this.lastOptions = { mode, duration: this.$<HTMLInputElement>('#short-game').checked ? CONFIG.match.shortDuration : CONFIG.match.duration, target };
      this.startMatch();
    });
    root.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(input => input.addEventListener('change', () => {
      const timed = this.$<HTMLInputElement>('input[name="mode"]:checked').value === 'timed';
      this.$('#timed-option').hidden = !timed;
      this.$('#target-option').hidden = timed;
    }));
    this.$('#panel-toggle').addEventListener('click', () => this.panelOpen ? this.closePanel() : this.openPanel());
    this.$('#panel-close').addEventListener('click', () => this.closePanel());
    this.$('#guide-close').addEventListener('click', () => { this.showGuide = false; this.update(); });
    this.$('#cancel-fishing').addEventListener('click', () => this.sim.cancelFishing());
    this.$('#refuel-button').addEventListener('click', () => { this.sim.refuel(); this.update(); });
    this.$('#upgrade-button').addEventListener('click', () => { this.sim.upgrade(); this.update(); });
    this.$('#role-fishing').addEventListener('click', () => { this.sim.setRole('fishing'); this.update(); });
    this.$('#role-gathering').addEventListener('click', () => { this.sim.setRole('gathering'); this.update(); });
    this.$('#inventory-list').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-eat]');
      if (button) { this.sim.eat(button.dataset.eat as ItemId); this.update(); }
    });
    this.$('#restart-button').addEventListener('click', () => this.startMatch());
    this.$('#change-mode-button').addEventListener('click', () => { this.showMenu = true; this.closePanel(); this.update(); });
    const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';
    this.$('.debug-tools').dataset.enabled = String(debugEnabled);
    root.querySelectorAll<HTMLButtonElement>('[data-debug]').forEach(button => button.addEventListener('click', () => { this.sim.debug(button.dataset.debug!); this.update(); }));
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code !== 'KeyB' && event.code !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || this.showMenu || this.sim.state.phase === 'ended') return;
      if (this.panelOpen) this.closePanel();
      else if (event.code === 'Escape' && this.sim.player.fishing) this.sim.cancelFishing();
      else this.openPanel();
    }, true);
    this.update();
  }

  private $<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }

  private startMatch() {
    (document.activeElement as HTMLElement | null)?.blur();
    this.sim.start({ ...this.lastOptions });
    this.showMenu = false;
    this.panelOpen = false;
    this.showGuide = this.firstGame;
    this.firstGame = false;
    this.lastEvent = -1;
    this.lastInventory = '';
    this.update();
  }

  openPanel() {
    if (this.showMenu || this.sim.state.phase === 'ended' || this.sim.player.dead) return;
    this.sim.cancelFishing();
    this.panelOpen = true;
    this.showGuide = false;
    this.update();
  }

  private closePanel() {
    this.panelOpen = false;
    (document.activeElement as HTMLElement | null)?.blur();
    this.update();
  }

  inputBlocked(): boolean {
    const active = document.activeElement;
    return this.showMenu || this.panelOpen || this.sim.state.phase === 'ended' || this.sim.player.dead || (active instanceof HTMLInputElement && this.root.contains(active));
  }

  update() {
    const state = this.sim.state;
    const player = this.sim.player;
    if (this.sim.campMenuRequested) { this.sim.campMenuRequested = false; this.openPanel(); }
    const playing = !this.showMenu && (state.phase === 'playing' || state.phase === 'overtime');
    if (player.dead || state.phase === 'ended') this.panelOpen = false;
    this.$('.start-overlay').hidden = !this.showMenu;
    this.$('.result-overlay').hidden = state.phase !== 'ended' || this.showMenu;
    this.$('.match-hud').hidden = this.showMenu;
    this.$('.player-status').hidden = !playing;
    this.$('.event-stack').hidden = !playing;
    this.$('.guide-card').hidden = !playing || !this.showGuide || this.panelOpen || !!player.fishing || player.dead;
    this.$('.inventory-panel').hidden = !playing || !this.panelOpen;
    this.$('#panel-toggle').setAttribute('aria-expanded', String(this.panelOpen));
    this.$('.key-help').hidden = !playing || this.panelOpen || player.dead;
    this.$('.debug-tools').hidden = !playing || this.$('.debug-tools').dataset.enabled !== 'true';
    this.$('#score-0').textContent = String(state.teams[0].score);
    this.$('#score-1').textContent = String(state.teams[1].score);
    this.$('#clock-label').textContent = state.phase === 'overtime' ? '平分加时 · 领先即胜' : state.options.mode === 'target' ? '目标积分' : state.options.duration === CONFIG.match.shortDuration ? '测试短局 · 剩余' : '剩余时间';
    this.$('#clock').textContent = state.phase === 'overtime' ? formatTime(state.overtimeRemaining) : state.options.mode === 'target' ? `${state.options.target} 分` : formatTime(state.remaining);
    this.$('.match-clock').classList.toggle('overtime', state.phase === 'overtime');
    this.$('#hp-fill').style.width = `${Math.max(0, player.hp)}%`;
    this.$('#warmth-fill').style.width = `${Math.max(0, player.warmth)}%`;
    this.$('#hp-text').textContent = String(Math.ceil(player.hp));
    this.$('#warmth-text').textContent = String(Math.ceil(player.warmth));
    this.$('.player-status').classList.toggle('is-cold', player.warmth < 22);
    this.$('#rod-label').textContent = player.rod ? '升级钓竿' : '基础钓竿';
    this.$('#survival-hint').textContent = player.protection > 0 ? `复活保护 · ${Math.ceil(player.protection)} 秒` : player.warmth <= 0 ? '正在失温掉血！快回燃烧的营火旁' : player.warmth < 25 ? '保暖不足，回到己方营地休息' : '燃烧的营火能恢复保暖和生命';
    this.$('.death-card').hidden = !playing || !player.dead;
    this.$('#respawn-count').textContent = String(Math.ceil(player.respawnIn));
    const fishing = playing && !this.panelOpen && !player.dead ? player.fishing : null;
    this.$('.fishing-widget').hidden = fishing?.stage !== 'reeling';
    this.$('.waiting-widget').hidden = fishing?.stage !== 'waiting';
    if (fishing?.stage === 'reeling') {
      const zone = player.rod ? CONFIG.fishing.upgradedZone : CONFIG.fishing.zone;
      this.$('#fishing-zone').style.width = `${zone * 100}%`;
      this.$('#fishing-zone').style.left = `${(1 - zone) * 50}%`;
      this.$('#fishing-marker').style.left = `${fishing.marker * 100}%`;
      this.$('.fishing-widget').classList.toggle('in-zone', Math.abs(fishing.marker - .5) <= zone / 2);
    }
    const prompt = this.sim.getPrompt();
    this.$('.context-prompt').hidden = !playing || this.panelOpen || player.dead || !!fishing || !prompt;
    this.$('#prompt-text').textContent = prompt.replace(/^E\s*[·：:]?\s*/, '');
    const newest = state.events.at(-1)?.id ?? -1;
    if (newest !== this.lastEvent) {
      this.lastEvent = newest;
      this.$('.event-stack').innerHTML = state.events.slice(-3).map(event => `<div class="event-message ${event.tone}">${escapeHtml(event.text)}</div>`).join('');
    }
    if (this.panelOpen) this.updatePanel();
    if (state.phase === 'ended') {
      this.$('#result-title').textContent = state.winners.length > 1 ? '两支小队共同获胜' : `${state.teams[state.winners[0] ?? 0].name}获胜`;
      this.$('#result-reason').textContent = state.resultReason;
      this.$('#result-score-0').textContent = String(state.teams[0].score);
      this.$('#result-score-1').textContent = String(state.teams[1].score);
    }
  }

  private updatePanel() {
    const player = this.sim.player;
    const camp = this.sim.state.camps[player.team];
    const nearCamp = Math.hypot(player.x - camp.x, player.y - camp.y) <= CONFIG.interactionRadius;
    const inventoryKey = JSON.stringify(player.inventory) + player.dead;
    if (inventoryKey !== this.lastInventory) {
      this.lastInventory = inventoryKey;
      this.$('#inventory-list').innerHTML = (Object.keys(ITEM_NAMES) as ItemId[]).map(id => {
        const fish = id.endsWith('fish');
        return `<div class="inventory-row"><span class="item-icon item-${id}" aria-hidden="true"></span><span class="item-name">${ITEM_NAMES[id]}<small>${fish ? '可食用' : id === 'wood' ? '营火 / 升级材料' : '升级材料'}</small></span><strong>${player.inventory[id]}</strong>${fish ? `<button data-eat="${id}"${!player.inventory[id] || player.dead ? ' disabled' : ''}>使用</button>` : '<span class="item-button-space"></span>'}</div>`;
      }).join('');
    }
    this.$('#camp-fuel').textContent = `燃料 ${Math.ceil(camp.fuel)} 秒`;
    this.$('#camp-fuel-fill').style.width = `${Math.max(0, camp.fuel) / CONFIG.camp.maxFuel * 100}%`;
    this.$('#camp-distance').textContent = nearCamp ? '你已在己方营地，可以补给。' : '需靠近己方营地，才能补充燃料和升级。';
    this.$<HTMLButtonElement>('#refuel-button').disabled = !nearCamp || player.inventory.wood < 1 || camp.fuel >= CONFIG.camp.maxFuel || player.dead;
    this.$<HTMLButtonElement>('#upgrade-button').disabled = !nearCamp || !!player.rod || player.inventory.wood < CONFIG.upgrade.wood || player.inventory.ore < CONFIG.upgrade.ore || player.dead;
    this.$('#upgrade-button').innerHTML = player.rod ? '钓竿已升级 <span>成功区域更宽 · 优质鱼机会增加</span>' : `升级钓竿 <span>${CONFIG.upgrade.wood} 木材 + ${CONFIG.upgrade.ore} 矿石</span>`;
    this.$('#upgrade-hint').textContent = player.rod ? '装备已就绪，下一竿去寻找月灯鱼吧。' : `需要 ${CONFIG.upgrade.wood} 木材和 ${CONFIG.upgrade.ore} 矿石；会真实消耗材料。`;
    const teammate = this.sim.state.characters.find(character => character.team === player.team && !character.human)!;
    this.$('#role-fishing').classList.toggle('selected', teammate.role === 'fishing');
    this.$('#role-gathering').classList.toggle('selected', teammate.role === 'gathering');
    this.$('#role-fishing').setAttribute('aria-pressed', String(teammate.role === 'fishing'));
    this.$('#role-gathering').setAttribute('aria-pressed', String(teammate.role === 'gathering'));
    this.$('#teammate-state').textContent = teammate.dead ? `队友复活等待：${Math.ceil(teammate.respawnIn)} 秒` : `队友：${teammate.action}。采集材料会带回营地交给你。`;
  }
}
