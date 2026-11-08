import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
test.use({ actionTimeout: 15000 });
const paths = ['/', '/product', '/scenarios', '/for-businesses', '/about', '/contact'];
const errors = new Map<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on('pageerror', (e) => errors.get(page)!.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function fill(page: Page) {
  await page.getByLabel('Your name', { exact: true }).fill('Example Operations Manager');
  await page.getByLabel('Business name', { exact: true }).fill('Fictional BrightMart Demo');
  await page.getByLabel('Email address', { exact: true }).fill('example-manager@example.invalid');
  await page.getByRole('combobox', { name: 'Industry', exact: true }).selectOption('Retail');
  await page.getByRole('combobox', { name: 'Team size', exact: true }).selectOption('6–20');
  await page
    .getByLabel('Main operational challenge', { exact: true })
    .fill('We need repeatable receiving practice for expiry checks and quantity shortages.');
  await page.getByRole('checkbox').check();
}

test('six public pages load directly with one heading, working local assets and honest product status', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  for (const path of paths) {
    const failed: string[] = [];
    const onResponse = (r: any) => {
      if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1:3100'))
        failed.push(`${r.status()} ${r.url()}`);
    };
    page.on('response', onResponse);
    await page.goto(path);
    await expect(page.locator('.business-site')).toBeVisible();
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(
      page.getByRole('link', { name: 'Book a Demo', exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    expect(await page.title()).toContain('OpsSim Africa');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    expect(failed, path).toEqual([]);
    page.off('response', onResponse);
  }
  await page.goto('/scenarios');
  await expect(page.locator('.available-badge')).toHaveCount(1);
  await expect(page.locator('.planned-badge')).toHaveCount(5);
  await expect(page.locator('main')).toContainText('Roadmap descriptions are plans');
  await page.goto('/about');
  await expect(page.locator('main')).toContainText('No AI makes hiring or staffing decisions');
  await page.goto('/product');
  await expect(page.locator('.product-shot-grid img')).toHaveCount(3);
  for (const img of await page.locator('.product-shot-grid img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  expect((await request.get('/images/product-demo.mp4')).status()).toBe(200);
  expect((await request.get('/images/product-demo.vtt')).status()).toBe(200);
});

test('mobile navigation, primary CTA and all pages stay within 320, 390 and 768-pixel layouts', async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} at ${width}`,
      ).toBe(true);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Open website menu' }).click();
    await expect(page.locator('.site-nav nav')).toBeVisible();
    await page.locator('.site-nav nav').getByRole('link', { name: 'Product', exact: true }).click();
    await expect(page).toHaveURL(/\/product$/);
    await expect(page.locator('main h1')).toContainText('A practical training room');
  }
  await mkdir('artifacts/brightmart', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.business-site main h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/brightmart/site-home-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.business-site main h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/brightmart/site-home-desktop.png', fullPage: true });
});

test('demo request validates, saves with a receipt and does not falsely book a calendar slot', async ({
  page,
  request,
}) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Request a Demo', exact: true }).click();
  expect(
    await page
      .locator('input[name=name]')
      .evaluate((e) => (e as HTMLInputElement).validity.valueMissing),
  ).toBe(true);
  await fill(page);
  await page.getByRole('button', { name: 'Request a Demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Request received.' })).toBeVisible();
  await expect(page.locator('.request-receipt code')).toHaveText(/^[a-f0-9-]{36}$/);
  await expect(page.locator('.demo-form-success')).toContainText(
    'not booked until the team confirms',
  );
  await expect(page.locator('.demo-form-success')).toContainText(
    'No calendar booking, email or WhatsApp message has been sent automatically',
  );
  expect((await request.get('/api/demo-requests')).status()).toBe(405);
  await page.goto('/contact?intent=waitlist');
  await fill(page);
  await page.getByRole('button', { name: 'Join the waitlist', exact: true }).click();
  await expect(page.locator('.demo-form-success')).toContainText(
    'waitlist request has been received',
  );
});

test('business page has the real form and failed saves preserve entered values with a useful error', async ({
  page,
}) => {
  await page.goto('/for-businesses');
  await fill(page);
  await page.route('**/api/demo-requests', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Too many requests. Please wait a few minutes before trying again.',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Request a Demo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue(
    'Fictional BrightMart Demo',
  );
  await expect(page.getByRole('button', { name: 'Request a Demo', exact: true })).toBeEnabled();
});

test('the sixty-second captioned demo opens accessibly, has a real video and closes with Escape', async ({
  page,
}) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Watch the 60-second Demo', exact: true });
  await opener.click();
  await expect(page.locator('dialog')).toBeVisible();
  const video = page.locator('dialog video');
  await expect
    .poll(() => video.evaluate((e) => (e as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((e) => (e as HTMLVideoElement).duration)).toBeCloseTo(60, 1);
  await expect(page.locator('dialog track[kind=captions]')).toHaveCount(1);
  await expect(page.locator('dialog')).toContainText('not physical-headset validation');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('public desktop and mobile pages meet automated WCAG A/AA checks', async ({ page }) => {
  test.setTimeout(180000);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations, `${path} at ${width}`).toEqual([]);
    }
  }
});

test('public practice entry opens BrightMart immediately and preserves historical hash links', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto('/product');
  await page.getByRole('link', { name: 'Try the practice lab', exact: true }).click();
  await expect(page.locator('.bm-control-panel h2')).toContainText('Every delivery');
  await page.goto('/app#receiving');
  await expect(page.locator('.receiving-tablet h2')).toContainText('Your next shift');
  await page.goto('/app#overview');
  await expect(
    page.getByRole('heading', { name: 'Operations overview', exact: true }),
  ).toBeVisible();
  // Root-site hash changes must switch the root component without a reload.
  await page.goto('/');
  await expect(page.locator('.business-site main h1')).toBeVisible();
  await page.goto('/#receiving');
  await expect(page.locator('.receiving-tablet h2')).toContainText('Your next shift');
  const failures: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) failures.push(r.url());
  });
  const created = await request.post('/api/brightmart/runs', {
    data: {
      memberId: 'ada',
      config: { variant: 'standard', targetSeconds: 360, focus: 'complete' },
    },
  });
  expect(created.status()).toBe(201);
  const bright = await created.json();
  await page.goto('/app#brightmart?run=' + bright.id);
  await expect(page.locator('.bm-control-panel h2')).toContainText('Receive and Shelf-Check');
  await page.goto('/app#receiving');
  await expect(page.locator('.receiving-tablet h2')).toContainText('Your next shift');
  const old = await request.post('/api/receiving/runs', { data: { memberId: 'ada', config: {} } });
  expect(old.status()).toBe(201);
  const legacy = await old.json();
  await page.goto('/app#receiving?run=' + legacy.id);
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Your shift is paused');
  await page.goto('/app#brightmart');
  await expect(page.getByRole('heading', { name: 'Every delivery is a decision.' })).toBeVisible();
  const shared = await (await request.get('/api/receiving/bootstrap')).json();
  await page.goto('/app#brightmart?invite=' + encodeURIComponent(shared.inviteCode));
  await expect(page.getByLabel('Practice name', { exact: true })).toBeVisible();
  await page.goto('/app#brightmart');
  await expect(page.getByRole('heading', { name: 'Every delivery is a decision.' })).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Operations overview', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Team performance', exact: false }).first().click();
  await expect(
    page.getByRole('heading', { name: 'People behind the progress', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Operations overview', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'People behind the progress', exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
