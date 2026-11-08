import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
test.use({ actionTimeout: 15000 });
const defaults = { variant: 'standard', targetSeconds: 360, focus: 'complete' };
const panel = (p: Page) => p.locator('.bm-control-panel');
const button = (p: Page, name: string) => panel(p).getByRole('button', { name, exact: true });
const errors = new Map<Page, string[]>();
test.beforeEach(async ({ page, request }) => {
  await request.put('/api/brightmart/defaults', { data: defaults });
  errors.set(page, []);
  page.on('pageerror', (e) => errors.get(page)!.push(e.message));
  await page.goto('/app#brightmart');
  await expect(
    panel(page).getByRole('heading', { name: 'Every delivery is a decision.' }),
  ).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function start(p: Page) {
  await button(p, 'Start practice').click();
  await expect(panel(p).getByRole('heading')).toContainText('Receive and Shelf-Check');
  await button(p, 'Read delivery note').click();
  await expect(panel(p).getByRole('heading', { name: 'BM-2047' })).toBeVisible();
  await expect(panel(p)).toContainText('Coastal Supply Partners');
  await button(p, 'Begin receiving').click();
  await expect(panel(p)).toContainText('CARTON INSPECTOR · C01');
}
async function inspect(p: Page, id: string) {
  const b = p.locator('.bm-carton-grid').getByRole('button', { name: new RegExp('^' + id + ' ') });
  await b.click();
  await expect(panel(p)).toContainText('CARTON INSPECTOR · ' + id);
  if (await button(p, 'Confirm condition inspection').isVisible()) {
    await button(p, 'Confirm condition inspection').click();
    await expect(button(p, 'Check label, batch & expiry')).toBeVisible();
  }
  if (await button(p, 'Check label, batch & expiry').isVisible()) {
    await button(p, 'Check label, batch & expiry').click();
    await expect(button(p, 'Record received units')).toBeVisible();
  }
  await button(p, 'Record received units').click();
  await expect(panel(p).getByRole('heading')).toHaveText('Record the actual units.');
}
async function save(p: Page, id: string, wrongQuantity = false) {
  const n = Number(id.slice(1));
  if (n === 5 || n === 12) {
    await button(p, 'Damaged').click();
    await button(p, 'Quarantine').click();
  }
  if (n === 6) {
    await button(p, 'Expired').click();
    await button(p, 'Quarantine').click();
  }
  if (n === 8) {
    await button(p, 'Mismatch').click();
    await button(p, 'Quarantine').click();
  }
  if (n === 7) {
    if (wrongQuantity) {
      await button(p, 'Save item record').click();
      await expect(p.locator('.bm-feedback.warning')).toContainText('shortage of 2');
    }
    await p.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
    await p.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
    await expect(panel(p).getByLabel('Received units', { exact: true })).toHaveText('22');
  }
  if (n === 11) {
    await p.getByRole('button', { name: 'Increase received quantity', exact: true }).click();
    await p.getByRole('button', { name: 'Increase received quantity', exact: true }).click();
  }
  await button(p, 'Save item record').click();
  await expect(panel(p).getByRole('heading')).toHaveText('Where does this stock belong?');
}
function zone(n: number) {
  return [5, 6, 8, 12].includes(n)
    ? 'Quarantine / returns'
    : [3, 4, 10, 11].includes(n)
      ? 'Grocery & Household'
      : 'Health & Wellness';
}
async function place(p: Page, id: string, wrong = false) {
  const n = Number(id.slice(1)),
    before = await p.locator('.bm-carton-grid button.done').count();
  if (wrong) {
    const wrongLabel = n === 1 ? 'Grocery & Household' : 'Quarantine / returns';
    await panel(p)
      .locator('.bm-zone-buttons')
      .getByRole('button', { name: new RegExp('^' + wrongLabel) })
      .click();
    await expect(p.locator('.bm-feedback.warning')).toContainText(
      n === 1 ? 'Correct category' : 'sound units',
    );
  }
  await panel(p)
    .locator('.bm-zone-buttons')
    .getByRole('button', { name: new RegExp('^' + zone(n)) })
    .click();
  await expect(p.locator('.bm-carton-grid button.done')).toHaveCount(before + 1);
  await expect(panel(p)).not.toHaveAttribute('aria-busy', 'true');
}
async function finish(p: Page, total = 8, skip: string[] = []) {
  for (let n = 1; n <= total; n++) {
    const id = 'C' + String(n).padStart(2, '0');
    if (skip.includes(id)) continue;
    await inspect(p, id);
    await save(p, id);
    await place(p, id);
  }
  await expect(panel(p).getByRole('heading')).toHaveText('Every carton has a decision.');
  await button(p, 'Review receiving report').click();
  await expect(panel(p).getByRole('heading')).toHaveText('Check it. Then confirm.');
  await button(p, 'Confirm & submit').click();
  await expect(p.locator('.bm-final-score')).toBeVisible();
}

test('eight-carton loop teaches corrected mistakes, records 22/24 correctly, reviews explicitly and compares a perfect replay', async ({
  page,
  request,
}) => {
  test.setTimeout(160000);
  await mkdir('artifacts/brightmart', { recursive: true });
  await mkdir('artifacts/brightmart', { recursive: true });
  await start(page);
  await expect(page.locator('.bm-carton-grid button')).toHaveCount(8);
  await inspect(page, 'C01');
  await save(page, 'C01');
  await place(page, 'C01', true);
  await inspect(page, 'C03');
  await save(page, 'C03');
  await place(page, 'C03', true);
  await inspect(page, 'C07');
  await expect(panel(page)).toContainText('inside the carton 22');
  await save(page, 'C07', true);
  await panel(page).screenshot({ path: 'artifacts/brightmart/product-sort.png' });
  await place(page, 'C07');
  for (const id of ['C02', 'C04', 'C05', 'C06', 'C08']) {
    await inspect(page, id);
    if (id === 'C05') await expect(panel(page)).toContainText('Antiseptic bottles');
    await save(page, id);
    await place(page, id);
  }
  await expect(panel(page).getByRole('heading')).toHaveText('Every carton has a decision.');
  await expect(panel(page)).toContainText('76 sound units');
  await expect(panel(page)).toContainText('30 physical units');
  await button(page, 'Review receiving report').click();
  await expect(panel(page).getByRole('heading')).toHaveText('Check it. Then confirm.');
  const id = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  let run = await (await request.get(`/api/brightmart/runs/${id}`)).json();
  expect(run.status).toBe('in_progress');
  expect(run.scorecard).toBeNull();
  expect(run.totals.shortageUnits).toBe(2);
  await panel(page).screenshot({ path: 'artifacts/brightmart/product-review.png' });
  await button(page, 'Confirm & submit').click();
  await expect(page.locator('.bm-final-score>strong')).toHaveText('88/100');
  await expect(page.locator('.bm-score-meta')).toContainText('4/4 exceptions caught');
  run = await (await request.get(`/api/brightmart/runs/${id}`)).json();
  expect(run.records.C07.receivedUnits).toBe(22);
  expect(run.placements.C07.zone).toBe('health');
  expect(run.scorecard.dimensions.accuracy.points).toBe(25);
  expect(run.scorecard.dimensions.exceptions.points).toBe(23);
  await panel(page).screenshot({ path: 'artifacts/brightmart/product-scorecard.png' });
  await page.reload();
  await expect(page.locator('.bm-final-score>strong')).toHaveText('88/100');
  await button(page, 'Try again').click();
  await button(page, 'Read delivery note').click();
  await button(page, 'Begin receiving').click();
  await finish(page);
  await expect(page.locator('.bm-final-score>strong')).toHaveText('100/100');
  await expect(page.locator('.bm-previous')).toContainText('88/100');
  await expect(page.locator('.bm-previous')).toContainText('+12');
  await button(page, 'Try harder · 12 cartons').click();
  await expect(panel(page)).toContainText('12 cartons');
  await expect(panel(page)).toContainText('5 minutes');
});

test('quantity draft, optional note, pause and saved record survive reload without auto-submitting', async ({
  page,
  request,
}) => {
  await start(page);
  await inspect(page, 'C07');
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await page.getByLabel('Optional short note').selectOption('Counted twice');
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('22');
  const id = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem('opssim-brightmart-drafts:' + id) || '{}').C07
            ?.receivedUnits,
        id,
      ),
    )
    .toBe(22);
  await page.reload();
  await expect(panel(page).getByRole('heading')).toHaveText('Your shift is paused.');
  const paused = await (await request.get(`/api/brightmart/runs/${id}`)).json();
  expect(paused.paused).toBe(true);
  expect(paused.status).toBe('in_progress');
  await button(page, 'Resume shift').click();
  await page.locator('.bm-carton-grid').getByRole('button', { name: /^C07 / }).click();
  await button(page, 'Record received units').click();
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('22');
  await expect(page.getByLabel('Optional short note')).toHaveValue('Counted twice');
  await button(page, 'Save item record').click();
  await expect(panel(page).getByRole('heading')).toHaveText('Where does this stock belong?');
  const saved = await (await request.get(`/api/brightmart/runs/${id}`)).json();
  expect(saved.records.C07.receivedUnits).toBe(22);
  expect(saved.records.C07.note).toBe('Counted twice');
  expect(saved.reviewToken).toBeNull();
});

test('manager team name, invite, focused assignment and trainer defaults persist through the shared demo', async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString().slice(-5);
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('BrightMart Demo ' + suffix);
  await button(page, 'Save team name').click();
  await expect(page.locator('.bm-feedback.correct')).toContainText('Team name saved');
  const shared = await (await request.get('/api/receiving/bootstrap')).json();
  await button(page, 'Join with an invite').click();
  await page.getByLabel('Practice name', { exact: true }).fill('Example Learner ' + suffix);
  await page.getByLabel('Invite code', { exact: true }).fill(shared.inviteCode);
  await button(page, 'Join practice team').click();
  await expect(
    panel(page).getByRole('heading', { name: 'Every delivery is a decision.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await page.getByLabel('Practice focus').selectOption('exceptions');
  await button(page, 'Assign receiving lesson').click();
  await expect(page.locator('.bm-feedback.correct')).toContainText('assigned');
  await button(page, 'Assign receiving lesson').click();
  await expect(page.locator('.bm-feedback.warning')).toContainText('already has');
  await page.getByRole('button', { name: 'Trainer', exact: true }).click();
  await page.getByLabel('Difficulty').selectOption('harder');
  await page.getByLabel('Practice focus').selectOption('recording');
  await button(page, 'Save trainer defaults').click();
  await expect(page.locator('.bm-feedback.correct')).toContainText('Trainer defaults saved');
  const b = await (await request.get('/api/brightmart/bootstrap')).json();
  expect(b.defaults.variant).toBe('harder');
  expect(b.defaults.focus).toBe('recording');
  expect(
    b.assignments.some((a: any) => a.config.focus === 'exceptions' && a.status === 'pending'),
  ).toBe(true);
});

test('touch layout fits 320 and 390 pixels and offers large quantity targets without a free-text quantity input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await inspect(page, 'C07');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const size = await page
      .getByRole('button', { name: 'Decrease received quantity', exact: true })
      .boundingBox();
    expect(size!.width).toBeGreaterThanOrEqual(48);
    expect(size!.height).toBeGreaterThanOrEqual(48);
  }
  expect(await panel(page).locator('input[type=number]').count()).toBe(0);
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('23');
  await button(page, 'Pause shift').click();
  await expect(panel(page).getByRole('heading')).toHaveText('Your shift is paused.');
  await page.screenshot({ path: 'artifacts/brightmart/mobile-paused.png', fullPage: true });
});

test('profile, briefing, note, inspector, record, sort, manager, trainer and hand keyboard have no WCAG A/AA violations', async ({
  page,
}) => {
  test.setTimeout(160000);
  async function scan(name: string) {
    const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(a.violations, name).toEqual([]);
  }
  await scan('profile');
  await button(page, 'Start practice').click();
  await scan('briefing');
  await button(page, 'Read delivery note').click();
  await scan('delivery note');
  await button(page, 'Begin receiving').click();
  await button(page, 'Confirm condition inspection').click();
  await scan('inspector');
  await button(page, 'Check label, batch & expiry').click();
  await button(page, 'Record received units').click();
  await scan('receiving record');
  await button(page, 'Save item record').click();
  await expect(panel(page).getByRole('heading')).toHaveText('Where does this stock belong?');
  await scan('sort');
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await scan('manager');
  await page.getByRole('button', { name: 'Open team-name hand keyboard' }).click();
  await scan('hand keyboard');
  await button(page, 'Cancel').click();
  await page.getByRole('button', { name: 'Trainer', exact: true }).click();
  await scan('trainer');
});

test('missing WebGL retains the full eight-carton practice and final report', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null;
      return original.call(this, type, ...(args as [any]));
    } as typeof original;
  });
  const p = await ctx.newPage();
  await p.goto('/app#brightmart');
  await expect(p.locator('.receiving-fallback')).toBeVisible();
  await start(p);
  await finish(p);
  await expect(p.locator('.bm-final-score>strong')).toHaveText('100/100');
  await ctx.close();
});

// Product evidence comes from the real application, not an invented UI rendering.
test('capture labelled desktop product evidence for the website and sixty-second walkthrough', async ({
  page,
}) => {
  test.setTimeout(100000);
  await mkdir('artifacts/brightmart', { recursive: true });
  await start(page);
  await page
    .locator('.bm-room-frame')
    .screenshot({ path: 'artifacts/brightmart/product-stockroom.png' });
  await button(page, 'Confirm condition inspection').click();
  await button(page, 'Check label, batch & expiry').click();
  await panel(page).screenshot({ path: 'artifacts/brightmart/product-inspect.png' });
  await inspect(page, 'C07');
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await panel(page).screenshot({ path: 'artifacts/brightmart/product-record.png' });
  await page
    .locator('.bm-room-frame')
    .screenshot({ path: 'artifacts/brightmart/stockroom-evidence.png' });
  await button(page, 'Save item record').click();
  await expect(panel(page).getByRole('heading')).toHaveText('Where does this stock belong?');
  await place(page, 'C07');
  await finish(page, 8, ['C07']).catch(async () => {
    throw new Error('Recording evidence failed before final report.');
  });
});

test('draft writes never cross carton or run identities while switching unsaved records', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.evaluate(() => {
    (window as any).__draftWrites = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('opssim-brightmart-drafts:'))
        (window as any).__draftWrites.push({ key, data: JSON.parse(value) });
      return original.call(this, key, value);
    };
  });
  await start(page);
  await inspect(page, 'C07');
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
  await page.getByLabel('Optional short note').selectOption('Counted twice');
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('22');
  await inspect(page, 'C02');
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('12');
  await expect(page.getByLabel('Optional short note')).toHaveValue('No extra note');
  await page.locator('.bm-carton-grid').getByRole('button', { name: /^C07 / }).click();
  await button(page, 'Record received units').click();
  await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('22');
  await expect(page.getByLabel('Optional short note')).toHaveValue('Counted twice');
  const first = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  await page.getByRole('button', { name: 'Trainee', exact: true }).click();
  await expect(
    panel(page).getByRole('heading', { name: 'Every delivery is a decision.' }),
  ).toBeVisible();
  await button(page, 'Start practice').click();
  await expect(panel(page).getByRole('heading', { level: 2 })).toContainText(
    'Receive and Shelf-Check',
  );
  const second = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  expect(second).not.toBe(first);
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem('opssim-brightmart-drafts:' + id) || '{}').C01
            ?.receivedUnits,
        second,
      ),
    )
    .toBe(24);
  const writes = await page.evaluate(() => (window as any).__draftWrites);
  expect(writes.length).toBeGreaterThan(2);
  for (const entry of writes) {
    if (entry.data.C02) expect(entry.data.C02.receivedUnits).toBe(12);
    if (entry.key === 'opssim-brightmart-drafts:' + second)
      expect(entry.data.C01.receivedUnits).toBe(24);
  }
});
