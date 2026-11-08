import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

test.use({
  viewport: { width: 1100, height: 800 },
  // Automatic per-action GPU screenshots distort software-rendered XR timings.
  // Keep DOM traces and the explicit acceptance screenshots instead.
  trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true },
});
let init = '';
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [resolve('tests/fixtures/xr-device.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
  });
  init = result.outputFiles[0].text;
});
const errors = new Map<Page, string[]>();
test.beforeEach(async ({ page, request }) => {
  errors.set(page, []);
  page.on('pageerror', (e) => errors.get(page)!.push(e.message));
  await request.put('/api/receiving/defaults', {
    data: {
      variant: 'standard',
      targetSeconds: 360,
      businessType: 'Supermarket',
      jobRole: 'Shop attendant',
      focus: 'complete',
    },
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function remote(page: Page, method: string, params: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ method, params }) => (window as any).__xr.remote.dispatch(method, params),
    { method, params },
  );
}
async function snapshot(page: Page) {
  return JSON.parse(
    (await page.getByTestId('receiving-scene').getAttribute('data-xr-state')) || '{}',
  );
}
// Batch the browser-protocol roundtrip, not the emulated input frames. Each raw
// device command is still awaited, so app gesture detection runs normally.
async function input(page: Page, ...steps: [string, Record<string, unknown>][]) {
  await page.evaluate(async (steps) => {
    for (const [method, params] of steps)
      await (window as any).__xr.remote.dispatch(method, params);
  }, steps);
}
async function point(page: Page, label: string) {
  let position: number[] = [];
  await expect
    .poll(
      async () => {
        const s = await snapshot(page);
        const b = s.buttons?.find((b: any) => b.label === label && !b.disabled);
        if (b) position = b.position;
        return Boolean(b);
      },
      { message: `Usable in-world control: ${label}` },
    )
    .toBe(true);
  return position;
}
async function pinch(page: Page, label: string) {
  const p = await point(page, label);
  try {
    await input(
      page,
      ['set_select_value', { device: 'hand-right', value: 0 }],
      ['set_hand_pose', { device: 'hand-right', poseId: 'open' }],
      ['set_transform', { device: 'hand-right', position: { x: 0.38, y: 1.25, z: -0.25 } }],
      ['look_at', { device: 'hand-right', target: { x: p[0], y: p[1], z: p[2] - 2.12 } }],
      ['select', { device: 'hand-right', duration: 0.15 }],
    );
  } catch (e) {
    if (label !== 'Exit XR' || !String(e).includes('XR session ended')) throw e;
  }
}
async function boot(page: Page, mr = false) {
  await page.addInitScript({ content: init });
  await page.goto('/?xrDebug=1#receiving');
  await expect(page.locator('.receiving-canvas canvas')).toBeVisible({ timeout: 30_000 });
  const entry = page.getByRole('button', {
    name: mr ? 'Mixed reality' : 'Enter hands VR',
    exact: true,
  });
  await expect(entry).toBeEnabled({ timeout: 30_000 });
  await entry.click();
  await expect(page.locator('.receiving-lab')).toHaveClass(/is-immersive/);
  await page.evaluate(() => {
    (window as any).__firstXR = (window as any).__xr.activeSession;
  });
  await expect.poll(async () => (await snapshot(page)).immersive).toBe(true);
}
async function sameHandsSession(page: Page) {
  expect(
    await page.evaluate(() => {
      const d = (window as any).__xr;
      return {
        same: d.activeSession === (window as any).__firstXR,
        inputSources: d.activeSession.inputSources.length,
        allHands: Array.from(d.activeSession.inputSources).every((s: any) => Boolean(s.hand)),
        pairedControllers: Object.values(d.controllers).filter((c: any) => c.connected).length,
      };
    }),
  ).toEqual({ same: true, inputSources: 1, allHands: true, pairedControllers: 0 });
}
async function readDetails(page: Page) {
  for (let i = 0; i < 8; i++) {
    const b = (await snapshot(page)).buttons.find((b: any) => b.id === 'detail-next');
    if (!b || b.label === 'First details') break;
    await pinch(page, b.label);
  }
}
async function enterStockroom(page: Page) {
  await pinch(page, 'Retail Stock Receiving');
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Inspect. Sort. Record. Submit.');
  await readDetails(page);
  await page.screenshot({ path: 'artifacts/receiving-xr-briefing.png' });
  await pinch(page, 'Enter stockroom');
  await expect(page.locator('.receiving-tablet h2')).toContainText('C01');
}
async function dragCarton(page: Page, id: string, zone: 'dry' | 'cold' | 'quarantine') {
  const s = await snapshot(page);
  const from = s.objects[id].position;
  await input(
    page,
    ['set_select_value', { device: 'hand-right', value: 0 }],
    ['set_hand_pose', { device: 'hand-right', poseId: 'open' }],
    ['set_transform', { device: 'hand-right', position: { x: 0.38, y: 1.25, z: -0.25 } }],
    [
      'look_at',
      { device: 'hand-right', target: { x: from[0], y: from[1] + 0.125, z: from[2] - 2.12 } },
    ],
    ['set_select_value', { device: 'hand-right', value: 1, duration: 0.12 }],
  );
  await expect
    .poll(async () => (await snapshot(page)).objects[id].held, { message: `Hand grabbed ${id}` })
    .toBe(true);
  const to =
    zone === 'dry'
      ? [-1.52, 0.95, -1.12]
      : zone === 'cold'
        ? [1.52, 0.95, -1.12]
        : [1.55, 0.95, 0.83];
  await remote(page, 'look_at', {
    device: 'hand-right',
    target: { x: to[0], y: to[1], z: to[2] - 2.12 },
  });
  await expect
    .poll(
      async () => {
        const p = (await snapshot(page)).objects[id].position;
        return Math.hypot(p[0] - to[0], p[2] - to[2]);
      },
      { message: `${id} physically moved into ${zone}` },
    )
    .toBeLessThan(0.13);
  await remote(page, 'set_select_value', { device: 'hand-right', value: 0, duration: 0.12 });
}
async function poke(page: Page, label: string) {
  const p = await point(page, label);
  const board = (await snapshot(page)).board;
  const q = board.rotation;
  const nx = 2 * (q[0] * q[2] + q[3] * q[1]),
    ny = 2 * (q[1] * q[2] - q[3] * q[0]),
    nz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
  await remote(page, 'set_select_value', { device: 'hand-right', value: 0 });
  await remote(page, 'set_hand_pose', { device: 'hand-right', poseId: 'point' });
  await remote(page, 'set_transform', {
    device: 'hand-right',
    anchor: 'index-tip',
    position: { x: p[0] + nx * 0.1, y: p[1] + ny * 0.1, z: p[2] - 2.12 + nz * 0.1 },
    orientation: { fingers: [-nx, -ny, -nz], palm: [0, -1, 0] },
  });
  await remote(page, 'animate_to', {
    device: 'hand-right',
    anchor: 'index-tip',
    position: { x: p[0] + nx * 0.009, y: p[1] + ny * 0.009, z: p[2] - 2.12 + nz * 0.009 },
    duration: 0.18,
  });
}

test('one controller-free XR session covers roles, tutorial, briefing, ten real hand-dragged cartons, numeric form, explicit submission, scorecard and harder replay', async ({
  page,
}) => {
  test.setTimeout(360000);
  await boot(page);
  await pinch(page, 'Manager');
  await expect(page.locator('.receiving-tablet')).toContainText('MANAGER / SHARED DEMO WORKSPACE');
  await pinch(page, 'Trainee');
  await pinch(page, 'How hands work');
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Your hands are the controls');
  await readDetails(page);
  await pinch(page, 'Back');
  await enterStockroom(page);
  await pinch(page, 'Purchase order');
  await expect(page.locator('.receiving-tablet h2')).toContainText('NG-2047');
  await readDetails(page);
  await pinch(page, 'Back');
  await expect(page.locator('.receiving-tablet h2')).toContainText('C01');
  for (let n = 1; n <= 10; n++) {
    const id = `C${String(n).padStart(2, '0')}`;
    await expect(page.locator('.receiving-tablet h2')).toContainText(id);
    await pinch(page, 'Confirm inspection');
    await expect(
      page.locator('.receiving-tablet').getByRole('button', { name: 'Inspected ✓', exact: true }),
    ).toBeDisabled();
    if (n === 5) await pinch(page, 'Damaged seal');
    if (n === 8) await pinch(page, 'Expired goods');
    await dragCarton(
      page,
      id,
      n === 5 || n === 8 ? 'quarantine' : n === 3 || n === 4 ? 'cold' : 'dry',
    );
    await expect(page.locator('.receiving-carton.placed')).toHaveCount(n);
  }
  await page.screenshot({ path: 'artifacts/receiving-xr-sorted.png' });
  await pinch(page, 'Receiving form');
  await pinch(page, '8');
  await pinch(page, 'Quarantined');
  await pinch(page, '2');
  await pinch(page, 'Shortfall');
  await pinch(page, '0');
  await pinch(page, 'Review & submit');
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Submit this receiving report?');
  expect(
    (
      await (
        await page.request.get(
          `/api/receiving/runs/${new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run')}`,
        )
      ).json()
    ).status,
  ).toBe('in_progress');
  await pinch(page, 'Confirm & submit');
  await expect(page.locator('.receiving-score-title .score-badge')).toContainText('100');
  await expect(page.locator('.receiving-score-metrics')).toContainText('2/2');
  await readDetails(page);
  if ((await snapshot(page)).buttons.some((b: any) => b.label === 'First details'))
    await pinch(page, 'First details');
  await page.screenshot({ path: 'artifacts/receiving-xr-scorecard.png' });
  await sameHandsSession(page);
  await pinch(page, 'Harder variation');
  await readDetails(page);
  await pinch(page, 'Enter stockroom');
  await expect(page.locator('.receiving-carton')).toHaveCount(12);
  await sameHandsSession(page);
  const runId = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  await writeFile(
    'artifacts/xr-emulation.json',
    JSON.stringify(
      {
        runtime: 'Meta IWER 2.8.0, Quest 3 preset, one emulated right hand',
        controllers: 0,
        fullStandardFlow: true,
        physicallyDragged: 10,
        score: 100,
        harderReplayItems: 12,
        sameXRSession: true,
        runId,
        physicalQuestVerified: false,
      },
      null,
      2,
    ),
  );
  await pinch(page, 'Exit XR');
  await expect(page.locator('.receiving-lab')).not.toHaveClass(/is-immersive/);
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Your shift is paused');
});

test('near poke latches, a near hand grab moves/rotates a carton, tracking loss cancels safely, focus loss pauses, and manager text entry remains immersive', async ({
  page,
}) => {
  test.setTimeout(240000);
  await boot(page);
  await enterStockroom(page);
  await pinch(page, 'Tablet closer');
  await pinch(page, 'Receiving form');
  await poke(page, '1');
  await expect(page.getByLabel('Accepted carton count')).toHaveValue('1');
  await page.waitForTimeout(700);
  await expect(page.getByLabel('Accepted carton count')).toHaveValue('1');
  await poke(page, '1');
  await expect(page.getByLabel('Accepted carton count')).toHaveValue('11');
  await pinch(page, 'Back to floor');
  await pinch(page, 'Closer inspection');
  await expect
    .poll(async () => {
      const p = (await snapshot(page)).objects.C01.position;
      return Math.hypot(p[0] - 0.18, p[1] - 1.28, p[2] - 1.64);
    })
    .toBeLessThan(0.05);
  const before = (await snapshot(page)).objects.C01.position;
  await remote(page, 'set_hand_pose', { device: 'hand-right', poseId: 'open' });
  await remote(page, 'set_transform', {
    device: 'hand-right',
    anchor: 'grip',
    position: { x: before[0], y: before[1], z: before[2] - 2.12 },
    orientation: { fingers: [0, 0, -1], palm: [0, -1, 0] },
  });
  await remote(page, 'set_hand_pose', { device: 'hand-right', poseId: 'fist' });
  await expect.poll(async () => (await snapshot(page)).objects.C01.held).toBe(true);
  await remote(page, 'animate_to', {
    device: 'hand-right',
    anchor: 'grip',
    position: { x: before[0] + 0.18, y: before[1] + 0.06, z: before[2] - 2.12 + 0.1 },
    orientation: { fingers: [-0.6, 0.2, -1], palm: [0, -1, 0] },
    duration: 0.35,
  });
  await expect
    .poll(async () => {
      const p = (await snapshot(page)).objects.C01.position;
      return Math.hypot(p[0] - before[0], p[1] - before[1], p[2] - before[2]);
    })
    .toBeGreaterThan(0.12);
  expect(Math.abs((await snapshot(page)).objects.C01.rotation[1])).toBeGreaterThan(0.1);
  await page.screenshot({ path: 'artifacts/receiving-xr-near-grab.png' });
  await remote(page, 'set_connected', { device: 'hand-right', connected: false });
  await expect.poll(async () => (await snapshot(page)).objects.C01.held).toBe(false);
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Your shift is paused');
  await expect(page.locator('.receiving-carton.placed')).toHaveCount(0);
  await remote(page, 'set_connected', { device: 'hand-right', connected: true });
  await remote(page, 'set_hand_pose', { device: 'hand-right', poseId: 'open' });
  await pinch(page, 'Resume shift');
  await page.evaluate(() => (window as any).__xr.updateVisibilityState('visible-blurred'));
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Your shift is paused');
  await page.evaluate(() => (window as any).__xr.updateVisibilityState('visible'));
  await pinch(page, 'Resume shift');
  await pinch(page, 'Pause shift');
  await pinch(page, 'Profile & team');
  await pinch(page, 'Manager');
  await pinch(page, 'Name the team');
  await pinch(page, 'Clear');
  for (const letter of ['H', 'A', 'N', 'D', 'S', 'Space', 'L', 'A', 'B']) await pinch(page, letter);
  await pinch(page, 'Save');
  await expect(page.locator('.receiving-tablet h2')).toHaveText('HANDS LAB');
  await sameHandsSession(page);
  await pinch(page, 'Exit XR');
});

test('supported immersive-ar selects the transparent virtual-room rendering path with hands', async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page, true);
  await sameHandsSession(page);
  expect((await snapshot(page)).transparent).toBe(true);
  expect((await snapshot(page)).roomVisible).toBe(false);
  expect(await page.evaluate(() => (window as any).__xr.activeSession.environmentBlendMode)).toBe(
    'alpha-blend',
  );
  await pinch(page, 'Retail Stock Receiving');
  await expect(page.locator('.receiving-tablet h2')).toHaveText('Inspect. Sort. Record. Submit.');
  await pinch(page, 'Exit XR');
  await expect(page.locator('.receiving-lab')).not.toHaveClass(/is-immersive/);
});
