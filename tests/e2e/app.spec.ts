import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PerspectiveCamera, Vector3 } from 'three';

const faults = new Map<Page, string[]>();
test.beforeEach(async ({ page }) => {
  faults.set(page, []);
  page.on('pageerror', (error) => faults.get(page)!.push(error.message));
  await page.goto('/#overview');
  await expect(
    page.getByRole('heading', { name: 'Operations overview', exact: true }),
  ).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(faults.get(page)).toEqual([]);
});

async function library(page: Page) {
  await page.getByRole('button', { name: 'Training library', exact: false }).first().click();
  await expect(
    page.getByRole('heading', { name: 'The training floor', exact: true }),
  ).toBeVisible();
}
async function start(page: Page, title: string) {
  await library(page);
  await page
    .locator('.scenario-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .click();
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.locator('.task-content h2')).toBeVisible();
}
async function choose(page: Page, label: string) {
  await page.locator('.task-options').getByRole('button', { name: label, exact: false }).click();
  await expect(page.locator('.task-feedback.correct')).toBeVisible();
}
async function number(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'Your answer', exact: true }).fill(value);
  await page.getByRole('button', { name: 'Check answer', exact: false }).click();
  await expect(page.locator('.task-feedback.correct')).toBeVisible();
}
async function next(page: Page) {
  await page.getByRole('button', { name: 'Next task', exact: false }).click();
}
async function results(page: Page) {
  await page.getByRole('button', { name: 'See your results', exact: false }).click();
  await expect(
    page.getByRole('heading', { name: 'A stronger shift starts here.', exact: true }),
  ).toBeVisible();
}

test('dashboard, scenario search, category and difficulty filters work', async ({ page }) => {
  await expect(page.locator('.stat-value').first()).toContainText('93');
  await expect(page.locator('.trend-chart svg')).toBeVisible();
  await library(page);
  await expect(page.locator('.scenario-card')).toHaveCount(5);
  await page.getByRole('textbox', { name: 'Search scenarios' }).fill('cash');
  await expect(page.locator('.scenario-card')).toHaveCount(1);
  await expect(page.locator('.scenario-card h3')).toHaveText('Cash-up & reconciliation');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page
    .locator('.category-tabs')
    .getByRole('button', { name: 'Safety', exact: false })
    .click();
  await expect(page.locator('.scenario-card h3')).toHaveText('Spot the safety risks');
  await page.getByLabel('Filter difficulty').selectOption('Intermediate');
  await expect(page.getByRole('heading', { name: 'No matching scenarios' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.scenario-card')).toHaveCount(5);
});

test('receiving can be completed with a mistake, immediate coaching, and persistent correct scores', async ({
  page,
}) => {
  await start(page, 'Receiving & stock checks');
  await expect(page.locator('.three-host canvas')).toBeVisible();
  await page
    .locator('.task-options')
    .getByRole('button', { name: 'Sealed carton', exact: false })
    .click();
  await expect(page.getByText('A good moment to learn.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: false }).click();
  await choose(page, 'Crushed carton');
  await next(page);
  await number(page, '12');
  await next(page);
  await choose(page, 'Quarantine zone');
  await next(page);
  await number(page, '10');
  await next(page);
  await choose(page, 'Keep January stock in front');
  await results(page);
  await expect(page.locator('.result-main-score strong')).toContainText('92');
  await expect(page.locator('.result-metrics')).toContainText('83%');
  await expect(page.locator('.attempts-badge.retry')).toHaveText('2 attempts');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download session record' }).click();
  expect((await downloadPromise).suggestedFilename()).toContain('OpsSim-session-');
  await page.getByRole('button', { name: 'Close report' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Reports & insights', exact: false }).first().click();
  await page.getByLabel('Filter by scenario').selectOption('receiving');
  await page.getByLabel('Include samples').uncheck();
  await expect(page.locator('.reports-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.reports-table .score-badge')).toContainText('92');
});

test('picking workflow is fully playable', async ({ page }) => {
  await start(page, 'Pick, pack & dispatch');
  await choose(page, 'RCE-01');
  await next(page);
  await number(page, '3');
  await next(page);
  await choose(page, 'Packing & dispatch bench');
  await next(page);
  await choose(page, 'Inspect, secure the cartons');
  await next(page);
  await choose(page, 'ORD-1082 · Ada Okafor · 3 cartons');
  await results(page);
  await expect(page.locator('.result-main-score strong')).toContainText('100');
});

test('cash workflow accepts formatted amounts and produces a complete report', async ({ page }) => {
  await start(page, 'Cash-up & reconciliation');
  await number(page, '₦90,000');
  await next(page);
  await number(page, '1500');
  await next(page);
  await choose(page, 'Cash shortage of ₦1,500');
  await next(page);
  await choose(page, 'Recount, review receipts');
  await next(page);
  await choose(page, 'A handover showing expected cash');
  await results(page);
  await expect(page.locator('.result-main-score strong')).toContainText('100');
});

test('safety workflow finds hazards and stores completed outcomes', async ({ page }) => {
  await start(page, 'Spot the safety risks');
  await choose(page, 'Carton at the emergency exit');
  await next(page);
  await choose(page, 'Liquid spill on the floor');
  await next(page);
  await choose(page, 'Restrict access');
  await next(page);
  await choose(page, 'On a suitable low shelf');
  await next(page);
  await choose(page, 'Log the hazards');
  await results(page);
  await expect(page.locator('.result-metrics')).toContainText('100%');
});

test('3D object raycasting advances the task without using answer buttons', async ({ page }) => {
  await start(page, 'Receiving & stock checks');
  const canvas = page.locator('.three-host canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);
  const camera = new PerspectiveCamera(42, 1, 0.05, 40);
  const bounds = (await canvas.boundingBox())!;
  camera.aspect = bounds.width / bounds.height;
  camera.position.set(5.3, 4.5, 6.2);
  camera.lookAt(0, 0.6, -0.15);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const p = new Vector3(-1.65, 0.34, 0.44).project(camera);
  await page.mouse.click(
    bounds.x + ((p.x + 1) / 2) * bounds.width,
    bounds.y + ((1 - p.y) / 2) * bounds.height,
  );
  await expect(page.locator('.task-feedback.correct')).toBeVisible();
});

test('a saved session resumes at the correct task after a page reload', async ({ page }) => {
  await start(page, 'Receiving & stock checks');
  await choose(page, 'Crushed carton');
  await next(page);
  await expect(page.locator('.task-content h2')).toHaveText('Count what arrived');
  await page.getByRole('button', { name: 'Save & exit' }).click();
  await page.getByRole('button', { name: 'Save & return to workspace' }).click();
  await page.reload();
  await page.locator('.resume-banner').click();
  await expect(page.locator('.task-content h2')).toHaveText('Count what arrived');
  await expect(page.locator('.task-step-meta')).toContainText('TASK 02');
});

test('learners and assignments are saved and duplicate assignment errors are useful', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Team performance', exact: false }).first().click();
  await page.getByRole('button', { name: 'Add a learner' }).click();
  await page.getByLabel('Full name').fill('Kemi Johnson');
  await page.getByLabel('Role', { exact: true }).fill('Stock associate');
  await page.getByRole('button', { name: 'Add learner', exact: true }).click();
  await expect(page.locator('.team-table')).toContainText('Kemi Johnson');
  const row = page.locator('.team-table tr').filter({ hasText: 'Kemi Johnson' });
  await row.getByRole('button', { name: 'Assign', exact: false }).click();
  await page.getByLabel('Training scenario').selectOption('safety');
  await page.getByRole('button', { name: 'Assign training', exact: true }).click();
  await expect(page.locator('.toast').filter({ hasText: 'Training assigned.' })).toBeVisible();
  await row.getByRole('button', { name: 'Assign', exact: false }).click();
  await page.getByLabel('Training scenario').selectOption('safety');
  await page.getByRole('button', { name: 'Assign training', exact: true }).click();
  await expect(page.locator('.form-error')).toContainText('already has this training assigned');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await row.getByRole('button', { name: 'Kemi Johnson Stock associate' }).click();
  await expect(page.locator('.profile-assignments')).toContainText('Spot the safety risks');
});

test('scenario builder publishes a customised playable workflow and saves a local draft', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Scenario builder', exact: false }).first().click();
  await page.getByLabel('Scenario name').fill('Pharmacy receiving practice');
  await page.getByLabel('Industry', { exact: true }).selectOption('Pharmacy');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.draft-banner')).toBeVisible();
  await page.locator('.builder-task-heading').first().click();
  await page.getByLabel('Task title', { exact: true }).fill('Inspect pharmacy delivery');
  await page.getByRole('button', { name: 'Publish scenario', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'The training floor' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search scenarios' }).fill('Pharmacy receiving practice');
  await expect(page.locator('.scenario-card')).toHaveCount(1);
  await page.locator('.scenario-card').click();
  await expect(page.locator('.detail-objectives')).toContainText('Inspect pharmacy delivery');
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.locator('.task-content h2')).toHaveText('Inspect pharmacy delivery');
  await choose(page, 'Crushed carton');
});

test('reports export the currently filtered real session data', async ({ page }) => {
  await page.getByRole('button', { name: 'Reports & insights', exact: false }).first().click();
  await page.getByLabel('Include samples').uncheck();
  await expect(page.locator('.reports-table tbody tr')).toHaveCount(4);
  await page.getByLabel('Filter by scenario').selectOption('cash');
  await expect(page.locator('.reports-table tbody tr')).toHaveCount(1);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const file = await event;
  expect(file.suggestedFilename()).toMatch(/OpsSim-report-.*\.csv/);
  const stream = await file.createReadStream();
  let csv = '';
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain('Cash-up & reconciliation');
  expect(csv).toContain('"No"');
  expect(csv).not.toContain('"Yes"');
});

test('workspace settings and preferences survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Workspace settings', exact: false }).first().click();
  await page.getByLabel('Workspace name', { exact: true }).fill('Lagos Practice Lab');
  await page.getByLabel('Manager display name').fill('Tola Adeyemi');
  await page.getByRole('switch', { name: 'Audio feedback' }).click();
  await page.getByRole('switch', { name: 'Reduced motion' }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Workspace settings saved.');
  await page.reload();
  await expect(page.getByLabel('Workspace name', { exact: true })).toHaveValue(
    'Lagos Practice Lab',
  );
  await expect(page.getByRole('switch', { name: 'Audio feedback' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Reduced motion' })).toBeChecked();
});

test('keyboard search and workspace notifications are operational', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Find your next step' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search workspace' }).fill('cash');
  await expect(page.locator('.search-results button')).toHaveCount(1);
  await page.locator('.search-results button').click();
  await expect(page.locator('.detail-visual h2')).toHaveText('Cash-up & reconciliation');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page.locator('.notification-popover')).toBeVisible();
  await page.getByRole('button', { name: 'Mark read', exact: false }).click();
  await expect(page.locator('.notification-button i')).toHaveCount(0);
});

test('mobile navigation, pages and trainer have no horizontal document overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  for (const [nav, heading] of [
    ['Training library', 'The training floor'],
    ['Team performance', 'People behind the progress'],
    ['Reports & insights', 'From practice to progress'],
    ['Scenario builder', 'Your workflow. Your training.'],
    ['Workspace settings', 'A workspace that works for you'],
    ['Overview', 'Operations overview'],
  ]) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.locator('.sidebar').getByRole('button', { name: nav, exact: false }).first().click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Start a training session' }).click();
  await expect(page.locator('.receiving-tablet h2')).toContainText('Your next shift');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await start(page, 'Receiving & stock checks');
  await expect(page.locator('.task-content h2')).toBeAttached();
  await choose(page, 'Crushed carton');
  await next(page);
  await number(page, '12');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('training remains usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (kind.includes('webgl')) return null;
      return get.apply(this, [kind, ...args] as never);
    } as typeof get;
  });
  await page.reload();
  await start(page, 'Receiving & stock checks');
  await expect(page.locator('.webgl-fallback')).toBeVisible();
  await choose(page, 'Crushed carton');
  await next(page);
  await number(page, '12');
});

test('all workspace pages pass automated WCAG A/AA checks', async ({ page }) => {
  for (const route of ['overview', 'library', 'team', 'reports', 'builder', 'settings']) {
    await page.goto('/#' + route);
    await page.locator('.page-heading').waitFor();
    if (route === 'builder') await page.getByLabel('Scenario name').waitFor();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, route).toEqual([]);
  }
});

test('scenario details and the active trainer pass automated WCAG A/AA checks', async ({
  page,
}) => {
  await library(page);
  await page
    .locator('.scenario-card')
    .filter({ has: page.getByRole('heading', { name: 'Receiving & stock checks', exact: true }) })
    .click();
  const detail = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(detail.violations).toEqual([]);
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.locator('.task-content h2')).toBeVisible();
  const trainer = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(trainer.violations).toEqual([]);
});

test('sample history can be removed without deleting real training', async ({ page }) => {
  await page.getByRole('button', { name: 'Workspace settings', exact: false }).first().click();
  await page.getByRole('button', { name: 'Remove samples', exact: true }).click();
  await page.getByRole('button', { name: 'Remove sample sessions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove samples', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.stat-value').first()).toHaveText('4');
  await expect(page.locator('.sample-note')).toHaveText('Your workspace data');
});
