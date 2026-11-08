import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PerspectiveCamera, Vector3 } from 'three';

const standard = {
  variant: 'standard',
  targetSeconds: 360,
  businessType: 'Supermarket',
  jobRole: 'Shop attendant',
  focus: 'complete',
};
const faults = new Map<Page, string[]>();
test.beforeEach(async ({ page, request }) => {
  await request.put('/api/receiving/defaults', { data: standard });
  faults.set(page, []);
  page.on('pageerror', (e) => faults.get(page)!.push(e.message));
  await page.goto('/#receiving');
  await expect(page.locator('.receiving-tablet h2')).toContainText('Your next shift starts here');
});
test.afterEach(async ({ page }) => {
  expect(faults.get(page)).toEqual([]);
});
const controls = (page: Page) => page.locator('.receiving-tablet');
const button = (page: Page, name: string) =>
  controls(page).getByRole('button', { name, exact: true });
async function start(page: Page) {
  await button(page, 'Retail Stock Receiving').click();
  await expect(controls(page)).toContainText('Success: every carton accounted for');
  await button(page, 'Enter stockroom').click();
  await expect(controls(page)).toContainText('C01 · Golden Grain Rice');
}
async function inspect(page: Page, id: string) {
  await page.getByRole('button', { name: new RegExp(`^Inspect carton ${id} `) }).click();
  await button(page, 'Confirm inspection').click();
  await expect(button(page, 'Inspected ✓')).toBeDisabled();
}
async function sort(page: Page, harder = false, startAt = 1) {
  for (let n = startAt; n <= (harder ? 12 : 10); n++) {
    const id = `C${String(n).padStart(2, '0')}`;
    await inspect(page, id);
    if (n === 5) await button(page, 'Damaged seal').click();
    if (n === 8) await button(page, 'Expired goods').click();
    if (n === 11) await button(page, 'Label mismatch').click();
    await button(
      page,
      [5, 8, 11].includes(n)
        ? 'Place: quarantine'
        : [3, 4].includes(n)
          ? 'Place: cold store'
          : 'Place: dry rack',
    ).click();
    await expect(page.locator('.receiving-carton.placed')).toHaveCount(n);
  }
}
async function form(page: Page, accepted: string, quarantined: string, shortfall: string) {
  await button(page, 'Receiving form').click();
  await page.getByLabel('Accepted carton count').fill(accepted);
  await page.getByLabel('Quarantined carton count').fill(quarantined);
  await page.getByLabel('Shortfall carton count').fill(shortfall);
  await button(page, 'Review & submit').click();
  await expect(controls(page).getByRole('heading')).toHaveText('Submit this receiving report?');
}
async function finalise(page: Page) {
  await button(page, 'Confirm & submit').click();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
}

test('complete standard flow teaches mistakes, explicitly submits, saves a manager result, compares improvement and offers a harder replay', async ({
  page,
}) => {
  test.setTimeout(120000);
  await button(page, 'How hands work').click();
  await expect(controls(page)).toContainText('POINT + PINCH');
  await button(page, 'Back').click();
  await start(page);
  await expect(page.locator('.receiving-canvas canvas')).toBeVisible();
  await inspect(page, 'C01');
  await button(page, 'Place: cold store').click();
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('dry storage rack');
  await button(page, 'Place: dry rack').click();
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(1);
  await sort(page, false, 2);
  await form(page, '10', '0', '0');
  const before = await page.request.get(
    `/api/receiving/runs/${new URLSearchParams(page.url().split('?')[1]).get('run')}`,
  );
  expect((await before.json()).status).toBe('in_progress');
  await button(page, 'Confirm & submit').click();
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('does not reconcile');
  await expect(page.locator('.receiving-score-detail')).toHaveCount(0);
  await page.getByLabel('Accepted carton count').fill('8');
  await page.getByLabel('Quarantined carton count').fill('2');
  await button(page, 'Review & submit').click();
  await finalise(page);
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('84');
  await expect(page.locator('.receiving-score-metrics')).toContainText('85%');
  await expect(page.locator('.receiving-score-metrics')).toContainText('2/2');
  await expect(page.locator('.receiving-report-saved')).toContainText(
    '8 accepted / 2 quarantined / 0 short',
  );
  const scoreAxe = await new AxeBuilder({ page }).analyze();
  expect(
    scoreAxe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([]);
  await button(page, 'Send result to team').click();
  await expect(page.locator('.receiving-feedback')).toContainText('no email or WhatsApp was sent');
  await button(page, 'Manager review').click();
  await expect(page.locator('.receiving-failures')).toContainText('Wrong storage zone');
  await expect(page.locator('.receiving-failures')).toContainText('Unreconciled receiving form');
  await button(page, 'Review scorecard').click();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
  await button(page, 'Retry this delivery').click();
  await button(page, 'Enter stockroom').click();
  await sort(page);
  await form(page, '8', '2', '0');
  await finalise(page);
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await expect(page.locator('.receiving-comparison')).toContainText('84/100');
  await expect(page.locator('.receiving-comparison')).toContainText('100/100');
  await button(page, 'Harder variation').click();
  await expect(controls(page)).toContainText('12 cartons');
  await button(page, 'Enter stockroom').click();
  await expect(page.locator('.receiving-carton')).toHaveCount(12);
  await page.getByRole('button', { name: 'Reports & insights', exact: false }).first().click();
  await page.getByLabel('Filter by scenario').selectOption('retail-receiving-lab');
  await page.getByLabel('Include samples').uncheck();
  await page.locator('.reports-table tbody tr').first().click();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
  await expect(page.locator('.session-overlay')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
});

test('harder twelve-carton delivery records label mismatch, damaged/expired stock and the one-carton shortfall', async ({
  page,
}) => {
  test.setTimeout(75000);
  await button(page, 'Difficulty').click();
  await button(page, 'Difficulty').click();
  await expect(controls(page)).toContainText('Harder · 12 cartons');
  await start(page);
  await sort(page, true);
  await form(page, '9', '3', '1');
  await finalise(page);
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await expect(page.locator('.receiving-score-metrics')).toContainText('3/3');
  await expect(page.locator('.receiving-report-saved')).toContainText(
    '9 accepted / 3 quarantined / 1 short',
  );
  await expect(button(page, 'Harder variation')).toBeDisabled();
});

test('actual 3D raycast, grab, drag and release place cartons spatially and reject uninspected/wrong-zone drops', async ({
  page,
}) => {
  await start(page);
  const canvas = page.locator('.receiving-canvas canvas');
  await expect(canvas).toBeVisible();
  await inspect(page, 'C01');
  const bounds = (await canvas.boundingBox())!;
  const camera = new PerspectiveCamera(43, bounds.width / bounds.height, 0.035, 35);
  camera.position.set(4.35, 4.3, 5.9);
  camera.lookAt(0, 0.77, -0.05);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const screen = (x: number, y: number, z: number) => {
    const p = new Vector3(x, y, z).project(camera);
    return {
      x: bounds.x + ((p.x + 1) / 2) * bounds.width,
      y: bounds.y + ((1 - p.y) / 2) * bounds.height,
    };
  };
  const drag = async (index: number, zone: 'dry' | 'cold') => {
    // Aim at the visible top face; centres of the back row are naturally occluded.
    const from = screen(((index % 6) - 2.5) * 0.27, 1.065, Math.floor(index / 6) * 0.3 - 0.1);
    const to = screen(zone === 'dry' ? -1.52 : 1.52, 0.95, -1.12);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  };
  await drag(0, 'dry');
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(1);
  await drag(1, 'cold');
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('Inspect and confirm');
  await inspect(page, 'C02');
  await drag(1, 'cold');
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('dry storage rack');
  await drag(1, 'dry');
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(2);
});

test('pause, reload and explicit resume keep saved positions, inspections and active time', async ({
  page,
}) => {
  await start(page);
  await inspect(page, 'C01');
  await button(page, 'Place: dry rack').click();
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(1);
  await button(page, 'Receiving form').click();
  await page.getByLabel('Accepted carton count').fill('3');
  await page.getByLabel('Quarantined carton count').fill('1');
  await page.getByLabel('Shortfall carton count').fill('0');
  await button(page, 'Pause shift').click();
  await expect(controls(page).getByRole('heading')).toHaveText('Your shift is paused');
  const clock = await page.locator('.receiving-floor-status strong').innerText();
  await page.waitForTimeout(1100);
  await expect(page.locator('.receiving-floor-status strong')).toHaveText(clock);
  await page.reload();
  await expect(controls(page).getByRole('heading')).toHaveText('Your shift is paused');
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(1);
  await button(page, 'Resume shift').click();
  await expect(controls(page).getByRole('heading')).toContainText('C02');
  await expect(page.locator('.receiving-floor-status')).toContainText('SHIFT IN PROGRESS');
  await button(page, 'Receiving form').click();
  await expect(page.getByLabel('Accepted carton count')).toHaveValue('3');
  await expect(page.getByLabel('Quarantined carton count')).toHaveValue('1');
  await expect(page.getByLabel('Shortfall carton count')).toHaveValue('0');
});

test('named demo team, invite join, trainer defaults and focused remedial assignment work', async ({
  page,
  request,
}) => {
  await button(page, 'Manager').click();
  await button(page, 'Name the team').click();
  await page.getByLabel('Team name', { exact: true }).fill('Receiving Practice Team');
  await button(page, 'Save').click();
  await expect(controls(page).getByRole('heading')).toHaveText('Receiving Practice Team');
  await button(page, 'Invite trainees').click();
  await button(page, 'Enter learner name').click();
  await page.getByLabel('Learner name', { exact: true }).fill('Kemi Receiving');
  await button(page, 'Save').click();
  const b = await (await request.get('/api/receiving/bootstrap')).json();
  await button(page, 'Enter invite code').click();
  await page.getByLabel('Invite code', { exact: true }).fill('BAD00');
  await button(page, 'Save').click();
  await button(page, 'Join workspace').click();
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('does not match');
  await button(page, 'Enter invite code').click();
  await page.getByLabel('Invite code', { exact: true }).fill(b.inviteCode);
  await button(page, 'Save').click();
  await button(page, 'Join workspace').click();
  await expect(controls(page)).toContainText('Kemi Receiving');
  await expect(controls(page)).toContainText('Welcome, Kemi Receiving');
  await button(page, 'Trainer').click();
  await button(page, 'Coaching focus').click();
  await button(page, 'Coaching focus').click();
  await button(page, 'Save trainer defaults').click();
  await expect(page.locator('.receiving-feedback')).toContainText('Trainer defaults saved');
  expect((await (await request.get('/api/receiving/bootstrap')).json()).defaults.focus).toBe(
    'recording',
  );
  await button(page, 'Manager').click();
  await button(page, 'Remedial focus').click();
  await button(page, 'Remedial focus').click();
  await button(page, 'Assign practice').click();
  await expect(page.locator('.receiving-feedback.correct')).toContainText(
    'Focused exceptions practice',
  );
  await button(page, 'Assign practice').click();
  await expect(page.locator('.receiving-feedback.incorrect')).toContainText('already has');
  await button(page, 'Trainee').click();
  await button(page, 'Assigned practice').click();
  await expect(controls(page)).toContainText('Focus: inspect seals, dates and printed SKUs');
});

test('touch-sized mobile layout stays within viewport and completes inspect/place/pause', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#receiving');
  await expect(controls(page).getByRole('heading')).toContainText('Your next shift');
  await start(page);
  await inspect(page, 'C01');
  await button(page, 'Place: dry rack').tap();
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(1);
  await button(page, 'Pause shift').tap();
  await expect(controls(page).getByRole('heading')).toHaveText('Your shift is paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/receiving-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  await context.close();
});

test('a WebGL-unavailable browser retains the entire receiving workflow', async ({ browser }) => {
  test.setTimeout(75000);
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...(args as [any]));
    } as typeof original;
  });
  const page = await context.newPage();
  await page.goto('/#receiving');
  await expect(page.locator('.receiving-fallback')).toBeVisible();
  await start(page);
  await sort(page);
  await form(page, '8', '2', '0');
  await finalise(page);
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await context.close();
});

test('receiving profile, briefing, active floor, form, pause, manager and hands keyboard pass automated serious/critical accessibility checks', async ({
  page,
}) => {
  test.setTimeout(150000);
  const scan = async (label: string) => {
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
      label,
    ).toEqual([]);
  };
  await scan('profile');
  await button(page, 'Retail Stock Receiving').click();
  await scan('briefing');
  await button(page, 'Enter stockroom').click();
  await scan('active');
  await button(page, 'Receiving form').click();
  await scan('record');
  await button(page, 'Pause shift').click();
  await scan('paused');
  await button(page, 'Profile & team').click();
  await button(page, 'Manager').click();
  await scan('manager');
  await button(page, 'Name the team').click();
  await scan('hands keyboard');
});
