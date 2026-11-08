// Creates fictional records on an ISOLATED, already-running production instance.
// Build first. Terminal 1: PORT=3200 DB_PATH=.cache/production-smoke.sqlite npm start
// Terminal 2: BASE_URL=http://127.0.0.1:3200 node tests/production-smoke.mjs
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3200';
const faults = [],
  failedResources = [];
const report = {
  passed: false,
  date: new Date().toISOString(),
  mode: 'production',
  physicalQuestVerified: false,
};
await mkdir('artifacts/brightmart', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});
let page;
const began = Date.now();
try {
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(45000);
  await page.context().tracing.start({ screenshots: false, snapshots: true, sources: true });
  page.on('pageerror', (e) => faults.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`);
  });
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.status, 'ok');
  const html = await (await fetch(base)).text();
  assert.ok(!html.includes('/@vite/client'), 'Must serve the compiled build, not a Vite client.');
  for (const path of ['/', '/product', '/scenarios', '/for-businesses', '/about', '/contact']) {
    await page.goto(base + path);
    await expect(page.locator('.business-site main h1')).toHaveCount(1);
    await expect(page.locator('.site-footer')).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path);
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
  }
  await page.goto(base);
  await page.screenshot({ path: 'artifacts/site-production-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Watch the 60-second Demo', exact: true }).click();
  const video = page.locator('.site-demo-dialog video');
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((v) => Number.isFinite(v.duration) && v.duration >= 59 && v.duration <= 61),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.site-demo-dialog')).toHaveCount(0);
  await page.goto(base + '/contact');
  await page.getByLabel('Your name', { exact: true }).fill('Example Production Tester');
  await page.getByLabel('Business name', { exact: true }).fill('Fictional Production Smoke Shop');
  await page.getByLabel('Email address', { exact: true }).fill('production-smoke@example.invalid');
  await page.getByRole('combobox', { name: 'Industry', exact: true }).selectOption('Retail');
  await page.getByRole('combobox', { name: 'Team size', exact: true }).selectOption('6–20');
  await page
    .getByLabel('Main operational challenge', { exact: true })
    .fill('Fictional production check of receiving, expiry and quantity practice.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Request a Demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Request received.', exact: true })).toBeVisible();
  await expect(page.locator('.request-receipt code')).toHaveText(/^[a-f0-9-]{36}$/);
  await expect(page.locator('.demo-form-success')).toContainText(
    'not booked until the team confirms',
  );
  const receipt = await page.locator('.request-receipt code').textContent();
  assert.equal((await fetch(base + '/api/demo-requests')).status, 405);
  report.website = {
    pages: 6,
    captionedVideoSeconds: 60,
    requestSavedWithReceipt: receipt,
    automaticBooking: false,
    publicLeadListing: false,
  };

  // Current canonical BrightMart loop, using the rendered interface rather than completing via API.
  await page.goto(base + '/app?xrDebug=1#brightmart');
  await expect(page.locator('.receiving-canvas canvas')).toBeVisible({ timeout: 30000 });
  assert.equal(await page.getByTestId('receiving-scene').getAttribute('data-xr-state'), null);
  const bm = page.locator('.bm-control-panel');
  const heading = bm.getByRole('heading', { level: 2 });
  const pressBM = (name) => bm.getByRole('button', { name, exact: true }).click();
  await pressBM('Start practice');
  await expect(heading).toContainText('Receive and Shelf-Check');
  await pressBM('Read delivery note');
  await expect(heading).toHaveText('BM-2047');
  await pressBM('Begin receiving');
  for (let n = 1; n <= 8; n++) {
    const id = `C${String(n).padStart(2, '0')}`;
    await expect(bm).toContainText('CARTON INSPECTOR · ' + id);
    await pressBM('Confirm condition inspection');
    await expect(
      bm.getByRole('button', { name: 'Check label, batch & expiry', exact: true }),
    ).toBeVisible();
    await pressBM('Check label, batch & expiry');
    await expect(
      bm.getByRole('button', { name: 'Record received units', exact: true }),
    ).toBeVisible();
    await pressBM('Record received units');
    await expect(heading).toHaveText('Record the actual units.');
    if ([5, 6, 8].includes(n)) {
      await pressBM(n === 5 ? 'Damaged' : n === 6 ? 'Expired' : 'Mismatch');
      await pressBM('Quarantine');
    }
    if (n === 7) {
      await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
      await page.getByRole('button', { name: 'Decrease received quantity', exact: true }).click();
      await expect(bm.getByLabel('Received units', { exact: true })).toHaveText('22');
    }
    await pressBM('Save item record');
    await expect(heading).toHaveText('Where does this stock belong?');
    const zone = [5, 6, 8].includes(n)
      ? 'Quarantine / returns'
      : [3, 4].includes(n)
        ? 'Grocery & Household'
        : 'Health & Wellness';
    await bm
      .locator('.bm-zone-buttons')
      .getByRole('button', { name: new RegExp('^' + zone) })
      .click();
    await expect(page.locator('.bm-carton-grid button.done')).toHaveCount(n);
  }
  await expect(heading).toHaveText('Every carton has a decision.');
  await pressBM('Review receiving report');
  await expect(heading).toHaveText('Check it. Then confirm.');
  const bmId = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  assert.equal(
    (await (await fetch(`${base}/api/brightmart/runs/${bmId}`)).json()).status,
    'in_progress',
  );
  await pressBM('Confirm & submit');
  await expect(page.locator('.bm-final-score>strong')).toHaveText('100/100');
  await page.screenshot({ path: 'artifacts/brightmart/production-scorecard.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.bm-final-score>strong')).toHaveText('100/100');
  const bright = await (await fetch(`${base}/api/brightmart/runs/${bmId}`)).json();
  assert.equal(bright.status, 'completed');
  assert.equal(bright.score, 100);
  assert.equal(bright.records.C07.receivedUnits, 22);
  assert.equal(bright.totals.shortageUnits, 2);
  assert.equal(bright.totals.acceptedUnits, 76);
  assert.equal(bright.totals.quarantinedUnits, 30);
  assert.deepEqual(
    Object.values(bright.scorecard.dimensions).map((d) => d.points),
    [35, 25, 25, 15],
  );
  await pressBM('Try harder · 12 cartons');
  await expect(bm).toContainText('12 cartons');
  await pressBM('Read delivery note');
  await pressBM('Begin receiving');
  await expect(page.locator('.bm-carton-grid button')).toHaveCount(12);
  await pressBM('Pause shift');
  await expect(heading).toHaveText('Your shift is paused.');
  report.brightmart = {
    status: bright.status,
    score: bright.score,
    cartons: 8,
    fixedDimensions: [35, 25, 25, 15],
    totals: bright.totals,
    reloadRestoredScorecard: true,
    harderReplayCartons: 12,
    explicitPause: true,
  };

  // Historical receiving route/engine: retain the ten-carton workflow and its saved results.
  await page.goto(base + '/app?xrDebug=1#receiving');
  await expect(page.locator('.receiving-canvas canvas')).toBeVisible({ timeout: 30000 });
  assert.equal(await page.getByTestId('receiving-scene').getAttribute('data-xr-state'), null);
  const controls = page.locator('.receiving-tablet');
  const legacyHeading = controls.getByRole('heading', { level: 2 });
  const press = (label) => controls.getByRole('button', { name: label, exact: true }).click();
  await press('Retail Stock Receiving');
  await expect(legacyHeading).toHaveText('Inspect. Sort. Record. Submit.');
  await press('Enter stockroom');
  for (let n = 1; n <= 10; n++) {
    const id = `C${String(n).padStart(2, '0')}`;
    await expect(legacyHeading).toContainText(id);
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
  const legacyId = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  await press('Receiving form');
  await page.getByLabel('Accepted carton count').fill('8');
  await page.getByLabel('Quarantined carton count').fill('2');
  await page.getByLabel('Shortfall carton count').fill('0');
  await press('Review & submit');
  await expect(legacyHeading).toHaveText('Submit this receiving report?');
  await press('Confirm & submit');
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await expect(page.locator('.receiving-report-saved')).toContainText(
    '8 accepted / 2 quarantined / 0 short',
  );
  await page.reload();
  await expect(page.locator('.receiving-score-detail')).toBeVisible();
  const legacy = await (await fetch(`${base}/api/receiving/runs/${legacyId}`)).json();
  assert.equal(legacy.status, 'completed');
  assert.equal(legacy.score, 100);
  assert.equal(Object.keys(legacy.placements).length, 10);
  report.legacy = {
    status: legacy.status,
    score: legacy.score,
    cartons: 10,
    record: legacy.record,
    reloadRestoredScorecard: true,
  };
  assert.deepEqual(faults, []);
  assert.deepEqual(failedResources, []);
  Object.assign(report, {
    passed: true,
    health: health.status,
    viteClient: false,
    developmentXRDiagnostics: false,
    browserErrors: faults,
    failedResources,
  });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  if (page && !page.isClosed()) {
    report.lastUrl = page.url();
    await page
      .screenshot({ path: 'artifacts/brightmart/production-failure.png', timeout: 5000 })
      .catch(() => {});
  }
  throw error;
} finally {
  report.durationMilliseconds = Date.now() - began;
  await page
    ?.context()
    .tracing.stop(
      report.passed ? {} : { path: 'artifacts/brightmart/production-failure-trace.zip' },
    )
    .catch(() => {});
  await writeFile('artifacts/production-smoke.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
