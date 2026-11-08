// Runs against an ISOLATED production instance; creates real practice records.
// Example: PORT=3200 DB_PATH=.cache/production-smoke.sqlite npm start
// Then: BASE_URL=http://127.0.0.1:3200 node tests/production-smoke.mjs
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3200';
const faults = [];
const failedResources = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`);
  });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.status, 'ok');
  const html = await (await fetch(base)).text();
  assert.ok(
    !html.includes('/@vite/client'),
    'Must serve the production build, not the Vite development client.',
  );
  await page.goto(base + '/?xrDebug=1#receiving');
  await expect(page.locator('.receiving-canvas canvas')).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.getByTestId('receiving-scene').getAttribute('data-xr-state'),
    null,
    'Development XR diagnostic poses must not be exposed by the production bundle.',
  );
  await page.screenshot({ path: 'artifacts/receiving-landing-desktop.png', fullPage: true });
  const controls = page.locator('.receiving-tablet');
  const press = (label) => controls.getByRole('button', { name: label, exact: true }).click();
  await press('Retail Stock Receiving');
  await expect(controls.getByRole('heading')).toHaveText('Inspect. Sort. Record. Submit.');
  await page.screenshot({ path: 'artifacts/receiving-briefing-desktop.png', fullPage: true });
  await press('Enter stockroom');
  for (let n = 1; n <= 10; n++) {
    const id = `C${String(n).padStart(2, '0')}`;
    await expect(controls.getByRole('heading')).toContainText(id);
    await press('Confirm inspection');
    await expect(controls.getByRole('button', { name: 'Inspected ✓', exact: true })).toBeDisabled();
    if (n === 5) await press('Damaged seal');
    if (n === 8) await press('Expired goods');
    await press(
      n === 5 || n === 8
        ? 'Place: quarantine'
        : n === 3 || n === 4
          ? 'Place: cold store'
          : 'Place: dry rack',
    );
    await expect(page.locator('.receiving-carton.placed')).toHaveCount(n);
  }
  const id = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  await press('Receiving form');
  await page.getByLabel('Accepted carton count').fill('8');
  await page.getByLabel('Quarantined carton count').fill('2');
  await page.getByLabel('Shortfall carton count').fill('0');
  await press('Review & submit');
  await expect(controls.getByRole('heading')).toHaveText('Submit this receiving report?');
  await press('Confirm & submit');
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await expect(page.locator('.receiving-report-saved')).toContainText(
    '8 accepted / 2 quarantined / 0 short',
  );
  await page.screenshot({ path: 'artifacts/receiving-production-scorecard.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
  const run = await (await fetch(`${base}/api/receiving/runs/${id}`)).json();
  assert.equal(run.status, 'completed');
  assert.equal(run.score, 100);
  assert.equal(run.placements && Object.keys(run.placements).length, 10);
  await press('Harder variation');
  await expect(controls.getByRole('heading')).toHaveText('Inspect. Sort. Record. Submit.');
  await press('Enter stockroom');
  await expect(page.locator('.receiving-carton')).toHaveCount(12);
  await press('Pause shift');
  await expect(controls.getByRole('heading')).toHaveText('Your shift is paused');
  assert.deepEqual(faults, []);
  assert.deepEqual(failedResources, []);
  const result = {
    passed: true,
    date: '2026-11-08',
    mode: 'production',
    health: health.status,
    viteClient: false,
    developmentXRDiagnostics: false,
    standard: {
      status: run.status,
      score: run.score,
      accuracy: run.accuracy,
      cartons: 10,
      record: run.record,
    },
    reloadRestoredScorecard: true,
    harderReplayCartons: 12,
    explicitPause: true,
    browserErrors: faults,
    failedResources,
    physicalQuestVerified: false,
  };
  await writeFile('artifacts/production-smoke.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(
    'artifacts/production-smoke.json',
    JSON.stringify(
      { passed: false, date: '2026-11-08', mode: 'production', error: String(error) },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  await browser.close();
}
