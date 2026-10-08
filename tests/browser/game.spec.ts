import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function state(page: Page) { return page.evaluate(() => (window as any).__ICE_TEST__.snapshot()); }
async function start(page: Page, short = false) {
  await page.goto('/?debug=1');
  await expect(page.locator('canvas')).toBeVisible();
  if (short) await page.locator('#short-game').check();
  await page.locator('#start-button').click();
  await expect(page.getByTestId('start-menu')).toBeHidden();
  await page.locator('#guide-close').click();
}
async function place(page: Page, x: number, y: number) {
  await page.evaluate(({x,y}) => { const api = (window as any).__ICE_TEST__; api.sim.cancelFishing(); api.sim.player.x=x; api.sim.player.y=y; api.hud.update(); }, {x,y});
}
async function advance(page: Page, seconds: number) { await page.evaluate(s => (window as any).__ICE_TEST__.advance(s), seconds); }

test('实际键盘钓鱼、采集、添柴、升级、两分钟结算和再玩', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page, true);
  expect((await state(page)).options.duration).toBe(120);
  await page.evaluate(() => (window as any).__ICE_TEST__.sim.random = () => .1);
  const before = (await state(page)).characters[0].x;
  await page.keyboard.down('d'); await page.waitForTimeout(1450); await page.keyboard.up('d');
  expect((await state(page)).characters[0].x).toBeGreaterThan(before + 100);
  await page.keyboard.press('e', { delay: 45 });
  await expect.poll(async () => (await state(page)).holes.length).toBeGreaterThan(0);
  await page.keyboard.press('e', { delay: 45 });
  await expect.poll(async () => (await state(page)).characters[0].fishing?.stage).toBe('waiting');
  await expect(page.getByTestId('fishing-widget')).toBeVisible({ timeout: 7000 });
  await page.waitForFunction(() => { const f = (window as any).__ICE_TEST__.sim.player.fishing; return f?.stage === 'reeling' && f.marker >= .43 && f.marker <= .55; });
  await page.screenshot({ path: 'test-results/screenshots/fishing.png' });
  // Screenshot can take long enough for marker to leave the area; wait for a fresh pass.
  await page.waitForFunction(() => { const f = (window as any).__ICE_TEST__.sim.player.fishing; return f?.stage === 'reeling' && f.marker >= .43 && f.marker <= .55; });
  await page.keyboard.press('Space', { delay: 45 });
  await expect.poll(async () => (await state(page)).characters[0].inventory.silverfish).toBe(1);
  // Isolate scoring during material rules while opponents remain genuine moving AI.
  await page.locator('#panel-toggle').click(); await page.locator('#role-gathering').click(); await page.keyboard.press('Escape');
  const score = (await state(page)).teams[0].score;
  await place(page, 230, 352);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('e', { delay: 45 }); await page.waitForTimeout(80); await advance(page, 1.35); }
  expect((await state(page)).characters[0].inventory.wood).toBeGreaterThanOrEqual(6);
  await place(page, 346, 218);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('e', { delay: 45 }); await page.waitForTimeout(80); await advance(page, 1.35); }
  expect((await state(page)).characters[0].inventory.ore).toBeGreaterThanOrEqual(4);
  expect((await state(page)).teams[0].score).toBe(score);
  await place(page, 230, 568); await page.keyboard.press('e', { delay: 45 });
  await expect(page.locator('#inventory-panel')).toBeVisible();
  const materials = (await state(page)).characters[0].inventory;
  await page.locator('#refuel-button').click();
  expect((await state(page)).characters[0].inventory.wood).toBe(materials.wood - 1);
  await page.locator('#upgrade-button').click();
  expect((await state(page)).characters[0].rod).toBe(1);
  expect((await state(page)).characters[0].inventory.wood).toBe(materials.wood - 5);
  expect((await state(page)).characters[0].inventory.ore).toBe(materials.ore - 3);
  await page.screenshot({ path: 'test-results/screenshots/camp.png' });
  await page.keyboard.press('Escape');
  await advance(page, 125);
  await expect(page.getByTestId('result')).toBeVisible();
  const ended = await state(page); expect(ended.phase).toBe('ended'); expect(ended.teams[1].score).toBeGreaterThan(0);
  await page.keyboard.press('e', { delay: 45 }); await advance(page, 2);
  expect((await state(page)).teams.map((t: any) => t.score)).toEqual(ended.teams.map((t: any) => t.score));
  await page.screenshot({ path: 'test-results/screenshots/result.png' });
  await page.locator('#restart-button').click();
  const restarted = await state(page);
  expect(restarted.phase).toBe('playing'); expect(restarted.teams.map((t: any) => t.score)).toEqual([0,0]);
  expect(restarted.characters[0].rod).toBe(0); expect(restarted.characters[0].inventory.silverfish).toBe(0);
  expect(restarted.holes).toHaveLength(0); expect(errors).toEqual([]);
});

test('失温死亡、保留物品、10/20/30秒复活与重置', async ({page}) => {
  await start(page);
  await page.locator('[data-debug="materials"]').click();
  // First death is caused by the real cold/damage update, not just the debug kill button.
  await place(page, 640, 470);
  await page.evaluate(() => { const p=(window as any).__ICE_TEST__.sim.player; p.hp=.1; p.warmth=0; });
  await expect(page.getByTestId('death-card')).toBeVisible();
  expect((await state(page)).characters[0].deaths).toBe(1);
  expect((await state(page)).characters[0].inventory.wood).toBe(6);
  await advance(page, 10.1);
  await expect(page.getByTestId('death-card')).toBeHidden();
  let p=(await state(page)).characters[0]; expect(p.hp).toBe(100); expect(p.warmth).toBe(100); expect(p.protection).toBeGreaterThan(0);
  for (const [count, wait] of [[2,20],[3,30],[4,30]]) {
    await page.locator('[data-debug="kill"]').click();
    p=(await state(page)).characters[0]; expect(p.deaths).toBe(count); expect(p.respawnIn).toBeGreaterThan(wait - 1);
    await advance(page, wait + .1); expect((await state(page)).characters[0].dead).toBe(false);
  }
  await page.locator('[data-debug="short"]').click(); await advance(page, 11);
  if ((await state(page)).phase === 'overtime') await advance(page, 61);
  await expect(page.getByTestId('result')).toBeVisible(); await page.locator('#restart-button').click();
  expect((await state(page)).characters[0].deaths).toBe(0);
});

test('菜单不穿透、取消和死亡释放占洞', async ({page}) => {
  await start(page); await place(page, 600, 470);
  await page.keyboard.press('e', { delay: 45 }); await page.keyboard.press('e', { delay: 45 });
  await expect.poll(async () => (await state(page)).characters[0].fishing !== null).toBe(true);
  await page.keyboard.press('b'); await expect(page.locator('#inventory-panel')).toBeVisible();
  const before=await state(page); expect(before.characters[0].fishing).toBeNull(); expect(before.holes[0].occupant).toBeNull();
  await page.keyboard.down('d'); await page.keyboard.press('e', { delay: 45 }); await page.keyboard.press('Space', { delay: 45 }); await page.waitForTimeout(300); await page.keyboard.up('d');
  const after=await state(page); expect(after.characters[0].x).toBe(before.characters[0].x); expect(after.characters[0].fishing).toBeNull();
  await page.keyboard.press('Escape'); await page.waitForTimeout(100); expect((await state(page)).characters[0].fishing).toBeNull();
  await page.keyboard.press('e', { delay: 45 }); await expect.poll(async () => (await state(page)).characters[0].fishing !== null).toBe(true);
  await page.locator('[data-debug="kill"]').click(); expect((await state(page)).holes[0].occupant).toBeNull();
});

test('目标积分赛、加时领先胜与加时共同胜', async ({page}) => {
  await page.goto('/?debug=1'); await page.locator('input[value="target"]').check(); await page.locator('#target-score').fill('12'); await page.locator('#start-button').click();
  expect((await state(page)).options.target).toBe(12); await place(page, 600, 470);
  await page.keyboard.press('e', { delay: 45 }); await page.keyboard.press('e', { delay: 45 });
  await page.evaluate(() => { const api=(window as any).__ICE_TEST__; api.sim.random=()=>.1; api.sim.state.teams[0].score=6; api.sim.player.fishing.stage='reeling'; api.sim.player.fishing.marker=.5; });
  await page.keyboard.press('Space', { delay: 45 }); await expect(page.getByTestId('result')).toBeVisible();
  expect((await state(page)).winners).toEqual([0]); expect((await state(page)).teams[0].score).toBe(12);
  await page.locator('#restart-button').click(); await page.locator('[data-debug="tie"]').click();
  expect((await state(page)).phase).toBe('overtime');
  await place(page, 600,470); await page.keyboard.press('e', { delay: 45 }); await page.keyboard.press('e', { delay: 45 });
  await page.evaluate(() => { const api=(window as any).__ICE_TEST__; api.sim.player.fishing.stage='reeling'; api.sim.player.fishing.marker=.5; });
  await page.keyboard.press('Space', { delay: 45 }); await expect(page.getByTestId('result')).toBeVisible(); expect((await state(page)).resultReason).toContain('加时');
  await page.locator('#restart-button').click(); await page.locator('[data-debug="tie"]').click();
  await page.evaluate(() => { const s=(window as any).__ICE_TEST__.sim.state; for(const c of s.characters){c.dead=true;c.respawnIn=999;} });
  await advance(page,61); await expect(page.locator('#result-title')).toHaveText('两支小队共同获胜');
});

test('正常入口隐藏测试工具、桌面画面截图与尺寸检查', async ({page}) => {
  await page.goto('/'); await expect(page.getByTestId('start-menu')).toBeVisible();
  expect(await page.evaluate(() => '__ICE_TEST__' in window)).toBe(false);
  await page.screenshot({ path: 'test-results/screenshots/menu.png' });
  await page.locator('#start-button').click(); await page.locator('#guide-close').click();
  await expect(page.locator('.debug-tools')).toBeHidden();
  await page.screenshot({ path: 'test-results/screenshots/playfield.png' });
  for(const size of [{width:1280,height:720},{width:1024,height:768}]) {
    await page.setViewportSize(size); await expect(page.locator('canvas')).toBeVisible();
    const toggle=await page.locator('#panel-toggle').boundingBox(); expect(toggle!.x + toggle!.width).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`test-results/screenshots/playfield-${size.width}.png`});
  }
});
