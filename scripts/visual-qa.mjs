// Offline handoff and public-site visual capture. Does not submit data or alter the live database.
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const result = { date: new Date().toISOString(), passed: false, checks: [], errors: [] };
await mkdir('artifacts/brightmart', { recursive: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => result.errors.push(e.message));
  await page.goto(pathToFileURL(resolve('docs/OpsSim-Design-Kit.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('h1')).toHaveCount(1);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Offline design kit overflow at ' + width,
    );
    result.checks.push({ view: 'offline design kit', width, overflow: false });
  }
  assert.ok(
    await page
      .locator('img')
      .evaluateAll((images) => images.every((i) => i.complete && i.naturalWidth > 0)),
    'Embedded images must load without network resources.',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'artifacts/brightmart/design-kit-desktop.png' });
  await page
    .locator('#spatial')
    .scrollIntoViewIfNeeded()
    .catch(() => page.locator('.xr').scrollIntoViewIfNeeded());
  await page.locator('.xr').screenshot({ path: 'artifacts/brightmart/design-kit-spatial.png' });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(axe.violations, [], 'Offline design handoff accessibility');
  result.checks.push({ view: 'offline design kit', axeViolations: axe.violations.length });
  const video = page.locator('video');
  await expect
    .poll(() =>
      video.evaluate((v) => Number.isFinite(v.duration) && v.duration >= 59 && v.duration <= 61),
    )
    .toBe(true);
  result.checks.push({
    view: 'embedded offline video',
    duration: await video.evaluate((v) => v.duration),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/brightmart/design-kit-mobile.png' });
  const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
  for (const [path, label] of [
    ['/', 'home'],
    ['/product', 'product'],
    ['/contact', 'contact'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + path);
    await expect(page.locator('.business-site main h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator('main img')
      .evaluateAll((images) =>
        Promise.all(images.map((i) => (i.complete ? Promise.resolve() : i.decode()))),
      );
    await page.screenshot({
      path: `artifacts/brightmart/site-${label}-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.business-site main h1')).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({
      path: `artifacts/brightmart/site-${label}-mobile.png`,
      fullPage: true,
    });
    result.checks.push({ view: label, desktop: true, mobile: true });
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = String(error);
  throw error;
} finally {
  await writeFile('artifacts/brightmart/visual-qa.json', JSON.stringify(result, null, 2));
  await browser.close();
}
