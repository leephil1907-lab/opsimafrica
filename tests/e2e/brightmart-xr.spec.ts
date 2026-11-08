import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
test.use({
  viewport: { width: 1100, height: 800 },
  trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true },
  actionTimeout: 20000,
});
let init = '';
test.beforeAll(async () => {
  const b = await build({
    entryPoints: [resolve('tests/fixtures/xr-device.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
  });
  init = b.outputFiles[0].text;
});
const errors = new Map<Page, string[]>();
test.beforeEach(async ({ page, request }) => {
  errors.set(page, []);
  page.on('pageerror', (e) => errors.get(page)!.push(e.message));
  await request.put('/api/brightmart/defaults', {
    data: { variant: 'standard', targetSeconds: 900, focus: 'complete' },
  });
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
const panel = (p: Page) => p.locator('.bm-control-panel');
async function remote(p: Page, method: string, params: Record<string, unknown> = {}) {
  return p.evaluate(
    async ({ method, params }) => (window as any).__xr.remote.dispatch(method, params),
    { method, params },
  );
}
async function input(p: Page, ...steps: [string, Record<string, unknown>][]) {
  await p.evaluate(async (steps) => {
    for (const [method, params] of steps)
      await (window as any).__xr.remote.dispatch(method, params);
  }, steps);
}
async function snapshot(p: Page) {
  return JSON.parse((await p.getByTestId('receiving-scene').getAttribute('data-xr-state')) || '{}');
}
async function point(p: Page, label: string) {
  let position: number[] = [];
  await expect
    .poll(
      async () => {
        const b = (await snapshot(p)).buttons?.find((b: any) => b.label === label && !b.disabled);
        if (b) position = b.position;
        return !!b;
      },
      { timeout: 15000, message: 'Usable in-world control: ' + label },
    )
    .toBe(true);
  return position;
}
async function pinch(p: Page, label: string) {
  const pos = await point(p, label);
  try {
    await input(
      p,
      ['set_select_value', { device: 'hand-right', value: 0 }],
      ['set_hand_pose', { device: 'hand-right', poseId: 'open' }],
      ['set_transform', { device: 'hand-right', position: { x: 0.38, y: 1.25, z: -0.25 } }],
      ['look_at', { device: 'hand-right', target: { x: pos[0], y: pos[1], z: pos[2] - 2.12 } }],
      ['select', { device: 'hand-right', duration: 0.15 }],
    );
  } catch (e) {
    if (label !== 'Exit immersive' || !String(e).includes('XR session ended')) throw e;
  }
}
async function pages(p: Page) {
  await expect(panel(p)).not.toHaveAttribute('aria-busy', 'true');
  await expect
    .poll(async () => (await snapshot(p)).buttons?.some((b: any) => !b.disabled))
    .toBe(true);
  for (let i = 0; i < 15; i++) {
    const next = (await snapshot(p)).buttons?.find((b: any) => b.id === 'text-next');
    if (!next || next.disabled) return;
    await pinch(p, 'Next page');
  }
  throw Error('In-world page navigation did not terminate.');
}
async function poke(p: Page, label: string) {
  const pos = await point(p, label),
    q = (await snapshot(p)).board.rotation;
  const nx = 2 * (q[0] * q[2] + q[3] * q[1]),
    ny = 2 * (q[1] * q[2] - q[3] * q[0]),
    nz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
  await input(
    p,
    ['set_select_value', { device: 'hand-right', value: 0 }],
    ['set_hand_pose', { device: 'hand-right', poseId: 'point' }],
    [
      'set_transform',
      {
        device: 'hand-right',
        anchor: 'index-tip',
        position: { x: pos[0] + nx * 0.1, y: pos[1] + ny * 0.1, z: pos[2] - 2.12 + nz * 0.1 },
        orientation: { fingers: [-nx, -ny, -nz], palm: [0, -1, 0] },
      },
    ],
    [
      'animate_to',
      {
        device: 'hand-right',
        anchor: 'index-tip',
        position: { x: pos[0] + nx * 0.009, y: pos[1] + ny * 0.009, z: pos[2] - 2.12 + nz * 0.009 },
        duration: 0.18,
      },
    ],
  );
}
async function drag(p: Page, id: string, zone: 'dry' | 'cold' | 'quarantine') {
  const from = (await snapshot(p)).objects[id].position;
  await input(
    p,
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
    .poll(async () => (await snapshot(p)).objects[id].held, { message: 'Right hand grabbed ' + id })
    .toBe(true);
  const to =
    zone === 'dry'
      ? [-1.52, 0.95, -1.12]
      : zone === 'cold'
        ? [1.52, 0.95, -1.12]
        : [1.55, 0.95, 0.83];
  await remote(p, 'look_at', {
    device: 'hand-right',
    target: { x: to[0], y: to[1], z: to[2] - 2.12 },
  });
  await expect
    .poll(
      async () => {
        const pos = (await snapshot(p)).objects[id].position;
        return Math.hypot(pos[0] - to[0], pos[2] - to[2]);
      },
      { message: id + ' physically dragged into ' + zone },
    )
    .toBeLessThan(0.13);
  await remote(p, 'set_select_value', { device: 'hand-right', value: 0, duration: 0.12 });
}
async function boot(p: Page, ar = false) {
  await p.addInitScript({ content: init });
  await p.goto('/app?xrDebug=1#brightmart');
  await expect(p.locator('.receiving-canvas canvas')).toBeVisible({ timeout: 30000 });
  const entry = p.getByRole('button', {
    name: ar ? 'Try passthrough' : 'Enter hands-only VR',
    exact: true,
  });
  await expect(entry).toBeEnabled({ timeout: 30000 });
  await entry.click();
  await expect(p.locator('.brightmart-lab')).toHaveClass(/bm-xr-active/);
  await p.evaluate(() => ((window as any).__firstBM = (window as any).__xr.activeSession));
  await expect.poll(async () => (await snapshot(p)).immersive).toBe(true);
}
async function sameSession(p: Page) {
  expect(
    await p.evaluate(() => {
      const d = (window as any).__xr;
      return {
        same: d.activeSession === (window as any).__firstBM,
        allHands: d.activeSession.inputSources.every((s: any) => !!s.hand),
        inputs: d.activeSession.inputSources.length,
        controllers: Object.values(d.controllers).filter((c: any) => c.connected).length,
      };
    }),
  ).toEqual({ same: true, allHands: true, inputs: 1, controllers: 0 });
}

test('one right hand completes BrightMart menus, documents, eight real drags, quantity pokes, Review → Confirm, coaching and harder replay', async ({
  page,
  request,
}) => {
  test.setTimeout(600000);
  await mkdir('artifacts/brightmart', { recursive: true });
  await boot(page);
  await pinch(page, 'Manager');
  await expect(panel(page)).toContainText('LIGHTWEIGHT TEAM WORKSPACE');
  await pinch(page, 'Back to practice');
  await pinch(page, 'Hands guide');
  await pages(page);
  await pinch(page, 'Comfort');
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Comfort before speed.');
  await pinch(page, 'Back');
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
    'One hand. A clear next step.',
  );
  await pinch(page, 'Back');
  await pinch(page, 'Start practice');
  await expect(panel(page).getByRole('heading', { level: 2 })).toContainText(
    'Receive and Shelf-Check',
  );
  await pinch(page, 'Read delivery note');
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('BM-2047');
  await pages(page);
  await pinch(page, 'Begin receiving');
  await expect(panel(page)).toContainText('CARTON INSPECTOR · C01');
  for (let n = 1; n <= 8; n++) {
    const id = 'C' + String(n).padStart(2, '0');
    await expect(panel(page)).toContainText('CARTON INSPECTOR · ' + id);
    await pinch(page, 'Confirm condition inspection');
    await expect(
      panel(page).getByRole('button', { name: 'Check label, batch & expiry', exact: true }),
    ).toBeVisible();
    await pinch(page, 'Check label, batch & expiry');
    await expect(
      panel(page).getByRole('button', { name: 'Record received units', exact: true }),
    ).toBeVisible();
    await pinch(page, 'Record received units');
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
      'Record the actual units.',
    );
    if (n === 5 || n === 6 || n === 8) {
      await pinch(page, n === 5 ? 'Damaged' : n === 6 ? 'Expired' : 'Mismatch');
      await pinch(page, 'Quarantine');
    }
    if (n === 7) {
      await pinch(page, 'Tablet closer');
      await poke(page, 'Quantity −');
      await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('23');
      await poke(page, 'Quantity −');
      await expect(panel(page).getByLabel('Received units', { exact: true })).toHaveText('22');
    }
    await pinch(page, 'Save item record');
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
      'Where does this stock belong?',
    );
    await drag(
      page,
      id,
      [5, 6, 8].includes(n) ? 'quarantine' : [3, 4].includes(n) ? 'cold' : 'dry',
    );
    await expect(page.locator('.bm-carton-grid button.done')).toHaveCount(n);
  }
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
    'Every carton has a decision.',
  );
  await page.screenshot({ path: 'artifacts/brightmart/xr-eight-sorted.png' });
  await pinch(page, 'Review receiving report');
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(
    'Check it. Then confirm.',
  );
  await pages(page);
  const id = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('run');
  expect((await (await request.get(`/api/brightmart/runs/${id}`)).json()).status).toBe(
    'in_progress',
  );
  await pinch(page, 'Confirm & submit');
  await expect(page.locator('.bm-final-score>strong')).toHaveText('100/100');
  await pages(page);
  await sameSession(page);
  const run = await (await request.get(`/api/brightmart/runs/${id}`)).json();
  expect(run.records.C07.receivedUnits).toBe(22);
  expect(run.totals.shortageUnits).toBe(2);
  expect(run.totals.quarantinedCartons).toBe(3);
  expect(run.exceptionsCaught).toBe(4);
  await page.screenshot({ path: 'artifacts/brightmart/xr-scorecard.png' });
  await pinch(page, 'Try harder delivery');
  await expect(panel(page)).toContainText('12 cartons');
  await pinch(page, 'Read delivery note');
  await pages(page);
  await pinch(page, 'Begin receiving');
  await expect(page.locator('.bm-carton-grid button')).toHaveCount(12);
  await sameSession(page);
  await writeFile(
    'artifacts/brightmart/xr-emulation.json',
    JSON.stringify(
      {
        runtime: 'Meta IWER 2.8.0 / Quest 3 preset, software-rendered Chromium',
        physicalQuestVerified: false,
        controllerCount: 0,
        handCount: 1,
        hand: 'right',
        sameXRSession: true,
        physicallyDraggedCartons: 8,
        quantityControls: 'near poked',
        twoStepSubmission: true,
        score: run.score,
        config: run.config,
        shortageUnits: run.totals.shortageUnits,
        acceptedUnits: run.totals.acceptedUnits,
        quarantinedUnits: run.totals.quarantinedUnits,
        harderReplayCartons: 12,
        performanceBenchmark: false,
      },
      null,
      2,
    ),
  );
  await pinch(page, 'Exit immersive');
  await expect(page.locator('.brightmart-lab')).not.toHaveClass(/bm-xr-active/);
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Your shift is paused.');
});

test('BrightMart hand tracking loss pauses safely and immersive-ar uses the transparent-room path', async ({
  page,
}) => {
  test.setTimeout(150000);
  await boot(page, true);
  expect((await snapshot(page)).transparent).toBe(true);
  expect((await snapshot(page)).roomVisible).toBe(false);
  await pinch(page, 'Start practice');
  await expect(panel(page).getByRole('heading', { level: 2 })).toContainText(
    'Receive and Shelf-Check',
  );
  await expect(panel(page)).not.toHaveAttribute('aria-busy', 'true');
  const before = (await snapshot(page)).document;
  await input(
    page,
    ['set_hand_pose', { device: 'hand-right', poseId: 'open' }],
    [
      'set_transform',
      {
        device: 'hand-right',
        anchor: 'grip',
        position: { x: before.position[0], y: before.position[1], z: before.position[2] - 2.12 },
        orientation: { fingers: [0, 0, -1], palm: [0, -1, 0] },
      },
    ],
    ['set_hand_pose', { device: 'hand-right', poseId: 'fist' }],
  );
  await expect.poll(async () => (await snapshot(page)).document.held).toBe(true);
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('BM-2047');
  await remote(page, 'animate_to', {
    device: 'hand-right',
    anchor: 'grip',
    position: {
      x: before.position[0] + 0.18,
      y: before.position[1] + 0.06,
      z: before.position[2] - 2.12 + 0.1,
    },
    orientation: { fingers: [-0.6, 0.2, -1], palm: [0, -1, 0] },
    duration: 0.35,
  });
  await expect
    .poll(async () => {
      const d = (await snapshot(page)).document;
      return Math.hypot(...d.position.map((v: number, i: number) => v - before.position[i]));
    })
    .toBeGreaterThan(0.12);
  await expect
    .poll(async () => Math.abs((await snapshot(page)).document.rotation[1]))
    .toBeGreaterThan(0.1);
  await page.screenshot({ path: 'artifacts/brightmart/xr-document-held.png' });
  const held = (await snapshot(page)).document;
  await remote(page, 'set_hand_pose', { device: 'hand-right', poseId: 'open' });
  await expect.poll(async () => (await snapshot(page)).document.held).toBe(false);
  await writeFile(
    'artifacts/brightmart/xr-document-emulation.json',
    JSON.stringify(
      {
        physicalQuestVerified: false,
        runtime: 'IWER 2.8.0',
        hand: 'right',
        controllerCount: 0,
        grabbed: true,
        rotated: true,
        releasedAndReplaced: true,
        before,
        held,
        after: (await snapshot(page)).document,
      },
      null,
      2,
    ),
  );
  await pinch(page, 'Begin receiving');
  await expect(panel(page)).toContainText('CARTON INSPECTOR · C01');
  await remote(page, 'set_connected', { device: 'hand-right', connected: false });
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText('Your shift is paused.', {
    timeout: 12000,
  });
  await remote(page, 'set_connected', { device: 'hand-right', connected: true });
  await pinch(page, 'Resume shift');
  await expect(panel(page)).toContainText('CARTON INSPECTOR · C01');
  await sameSession(page);
  await pinch(page, 'Exit immersive');
});
