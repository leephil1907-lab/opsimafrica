import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/index.mjs';
import {
  BRIGHTMART_ID,
  brightConfig,
  brightManifest,
  brightScore,
  brightSeconds,
} from '../server/brightmart.mjs';
import { manifest as legacyManifest } from '../server/receiving.mjs';
const condition = (i) =>
  ({ none: 'Good', damage: 'Damaged', expiry: 'Expired', label: 'Mismatch' })[i.exception];
async function fixture(fn) {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  async function req(path, method = 'GET', body) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, data: await r.json() };
  }
  async function start(config = {}, memberId = 'ada') {
    const r = await req('/brightmart/runs', 'POST', { memberId, config });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
  }
  async function act(run, action) {
    return req(`/brightmart/runs/${run.id}/action`, 'POST', { ...action, version: run.version });
  }
  async function begin(run, readNote = true) {
    if (readNote) {
      const note = await act(run, { type: 'read-note' });
      assert.equal(note.status, 200);
      run = note.data.run;
    }
    return (await req(`/brightmart/runs/${run.id}/begin`, 'POST')).data;
  }
  async function sort(run) {
    for (const item of brightManifest(run.config.variant).items) {
      for (const action of [
        { type: 'inspect' },
        { type: 'labels' },
        {
          type: 'record-line',
          record: {
            receivedUnits: item.actualUnits,
            condition: condition(item),
            disposition: item.exception === 'none' ? 'accept' : 'quarantine',
            note: 'No extra note',
          },
        },
        { type: 'place', zone: item.zone },
      ]) {
        if (
          (action.type === 'inspect' && run.inspected.includes(item.id)) ||
          (action.type === 'labels' && run.labels.includes(item.id)) ||
          (action.type === 'record-line' && run.records[item.id]) ||
          (action.type === 'place' && run.placements[item.id])
        )
          continue;
        const r = await act(run, { ...action, itemId: item.id });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        assert.equal(r.data.correct, true, JSON.stringify(r.data));
        run = r.data.run;
      }
    }
    return run;
  }
  async function finish(run) {
    run = await sort(run);
    const review = await act(run, { type: 'review' });
    assert.equal(review.status, 200, JSON.stringify(review.data));
    run = review.data.run;
    const r = await act(run, {
      type: 'submit',
      reviewToken: run.reviewToken,
      score: 999,
      elapsedSeconds: 0,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.completed, true);
    return r.data.run;
  }
  try {
    await fn({ db, req, start, act, begin, sort, finish });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}

test('BrightMart standard is exactly eight physical cartons with a sound 22/24 partial delivery', () =>
  fixture(async ({ req, start }) => {
    const b = (await req('/bootstrap')).data;
    assert.equal(b.scenarios.find((s) => s.id === BRIGHTMART_ID).engine, 'brightmart-v2');
    const r = await start();
    assert.equal(r.engineVersion, 2);
    assert.equal(r.manifest.items.length, 8);
    assert.equal(r.manifest.expectedUnits, 108);
    assert.equal(r.manifest.actualUnits, 106);
    assert.equal(r.manifest.items[6].expectedUnits, 24);
    assert.equal(r.manifest.items[6].actualUnits, 22);
    assert.ok(r.manifest.items.every((i) => i.zone === undefined && i.exception === undefined));
    assert.equal(r.manifest.items[7].printedSku, 'HHD-04');
    assert.equal(r.manifest.items[5].expiry, '2026-10-31');
    assert.equal(r.paused, true);
    assert.equal(r.started, false);
    assert.equal(r.elapsedSeconds, 0);
    assert.equal(
      brightManifest().items.filter(
        (i) => i.exception === 'none' && i.expectedUnits === i.actualUnits,
      ).length,
      4,
    );
  }));
test('a perfect eight-carton delivery requires review and confirm and saves 100 in fixed dimensions', () =>
  fixture(async ({ start, begin, sort, act, req }) => {
    let r = await begin(await start());
    r = await sort(r);
    assert.equal(r.status, 'in_progress');
    const notReviewed = await act(r, { type: 'submit', reviewToken: 'not-reviewed' });
    assert.equal(notReviewed.status, 409);
    const reviewed = (await act(r, { type: 'review' })).data.run;
    assert.equal(reviewed.status, 'in_progress');
    assert.match(reviewed.reviewToken, /^[a-f0-9-]{36}$/);
    const done = (await act(reviewed, { type: 'submit', reviewToken: reviewed.reviewToken })).data
      .run;
    assert.equal(done.score, 100);
    assert.equal(done.scorecard.total, 100);
    assert.equal(done.scorecard.band, 'Excellent');
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(done.scorecard.dimensions).map(([k, v]) => [k, [v.points, v.max]]),
      ),
      { accuracy: [35, 35], exceptions: [25, 25], process: [25, 25], efficiency: [15, 15] },
    );
    assert.deepEqual(done.totals, {
      acceptedCartons: 5,
      quarantinedCartons: 3,
      receivedUnits: 106,
      acceptedUnits: 76,
      quarantinedUnits: 30,
      shortageUnits: 2,
      overageUnits: 0,
    });
    assert.equal(done.exceptionsCaught, 4);
    assert.equal(done.exceptionsTotal, 4);
    assert.equal(done.coaching.length, 2);
    const saved = (await req(`/brightmart/runs/${done.id}`)).data;
    assert.deepEqual(saved.scorecard, done.scorecard);
    assert.equal(saved.elapsedSeconds, done.elapsedSeconds);
    assert.equal((await act(done, { type: 'submit', reviewToken: done.reviewToken })).status, 409);
  }));
test('harder replay has twelve cartons and separately records a shortage and an overage', () =>
  fixture(async ({ start, begin, finish }) => {
    const done = await finish(await begin(await start({ variant: 'harder' })));
    assert.equal(done.config.targetSeconds, 300);
    assert.equal(done.manifest.items.length, 12);
    assert.equal(done.scorecard.total, 100);
    assert.equal(done.totals.acceptedCartons, 8);
    assert.equal(done.totals.quarantinedCartons, 4);
    assert.equal(done.totals.acceptedUnits, 114);
    assert.equal(done.totals.quarantinedUnits, 42);
    assert.equal(done.manifest.expectedUnits, 156);
    assert.equal(done.totals.receivedUnits, 156);
    assert.equal(done.totals.shortageUnits, 2);
    assert.equal(done.totals.overageUnits, 2);
    assert.equal(done.exceptionsTotal, 6);
  }));
test('wrong quantity deducts exactly five accuracy points without quarantining missing stock', () =>
  fixture(async ({ start, begin, act, finish }) => {
    let r = await begin(await start());
    for (const type of ['inspect', 'labels']) r = (await act(r, { type, itemId: 'C07' })).data.run;
    const wrong = await act(r, {
      type: 'record-line',
      itemId: 'C07',
      record: { receivedUnits: 24, condition: 'Good', disposition: 'accept' },
    });
    assert.equal(wrong.data.correct, false);
    assert.match(wrong.data.message, /shortage of 2/);
    assert.equal(wrong.data.run.records.C07, undefined);
    r = await finish(wrong.data.run);
    assert.equal(r.score, 95);
    assert.equal(r.scorecard.dimensions.accuracy.points, 30);
    assert.equal(r.scorecard.dimensions.exceptions.points, 25);
    assert.equal(r.records.C07.receivedUnits, 22);
    assert.equal(r.placements.C07.zone, 'health');
    assert.match(r.coaching[0], /Count the actual units/);
  }));
test('one unnecessary quarantine event costs exactly two, not four, exception points', () =>
  fixture(async ({ start, begin, act, finish }) => {
    let r = await begin(await start());
    for (const type of ['inspect', 'labels']) r = (await act(r, { type, itemId: 'C07' })).data.run;
    r = (
      await act(r, {
        type: 'record-line',
        itemId: 'C07',
        record: { receivedUnits: 22, condition: 'Good', disposition: 'accept' },
      })
    ).data.run;
    const wrong = await act(r, { type: 'place', itemId: 'C07', zone: 'quarantine' });
    assert.equal(wrong.data.correct, false);
    assert.match(wrong.data.message, /sound units/);
    const done = await finish(wrong.data.run);
    assert.equal(done.score, 98);
    assert.equal(done.scorecard.dimensions.exceptions.points, 23);
    assert.equal(done.scorecard.dimensions.exceptions.deductions, 2);
    assert.match(done.coaching[0], /missing units cannot be quarantined/);
  }));
test('wrong accepted shelf and missed physical exception each deduct five in their own dimension', () =>
  fixture(async ({ start, begin, act, finish }) => {
    let r = await begin(await start());
    for (const type of ['inspect', 'labels']) r = (await act(r, { type, itemId: 'C01' })).data.run;
    r = (
      await act(r, {
        type: 'record-line',
        itemId: 'C01',
        record: { receivedUnits: 24, condition: 'Good', disposition: 'accept' },
      })
    ).data.run;
    r = (await act(r, { type: 'place', itemId: 'C01', zone: 'grocery' })).data.run;
    r = (await act(r, { type: 'inspect', itemId: 'C06' })).data.run;
    const expired = await act(r, { type: 'place', itemId: 'C06', zone: 'health' });
    assert.equal(expired.data.correct, false);
    assert.match(expired.data.message, /expired/);
    const done = await finish(expired.data.run);
    assert.equal(done.score, 90);
    assert.equal(done.scorecard.dimensions.accuracy.points, 30);
    assert.equal(done.scorecard.dimensions.exceptions.points, 20);
  }));
test('damaged physical stock can be isolated immediately after condition inspection, then recorded', () =>
  fixture(async ({ start, begin, act, finish }) => {
    let r = await begin(await start());
    r = (await act(r, { type: 'inspect', itemId: 'C05' })).data.run;
    const isolated = await act(r, { type: 'place', itemId: 'C05', zone: 'quarantine' });
    assert.equal(isolated.data.correct, true);
    assert.equal(isolated.data.run.records.C05, undefined);
    const done = await finish(isolated.data.run);
    assert.equal(done.score, 100);
    assert.equal(done.records.C05.condition, 'Damaged');
    assert.equal(done.totals.quarantinedUnits, 30);
  }));
test('process points enforce note before handling, inspection before placement and label checks', () =>
  fixture(async ({ start, begin, act, finish }) => {
    let r = await begin(await start(), false);
    r = (await act(r, { type: 'place', itemId: 'C01', zone: 'health' })).data.run;
    r = (await act(r, { type: 'inspect', itemId: 'C01' })).data.run;
    r = (await act(r, { type: 'place', itemId: 'C01', zone: 'health' })).data.run;
    r = (await act(r, { type: 'read-note' })).data.run;
    const done = await finish(r);
    assert.equal(done.scorecard.dimensions.process.points, 10);
    assert.equal(done.score, 85);
    assert.equal(done.noteBeforeHandling, false);
  }));
test('versions, duplicate inspection, paused writes and completed writes cannot double-count work', () =>
  fixture(async ({ start, begin, act, req }) => {
    let r = await start();
    assert.equal((await act(r, { type: 'inspect', itemId: 'C01' })).status, 409);
    r = await begin(r);
    const old = r;
    r = (await act(r, { type: 'inspect', itemId: 'C01' })).data.run;
    assert.equal((await act(old, { type: 'inspect', itemId: 'C02' })).status, 409);
    assert.equal((await act(r, { type: 'inspect', itemId: 'C01' })).status, 409);
    const saved = (await req(`/brightmart/runs/${r.id}`)).data;
    assert.deepEqual(saved.inspected, ['C01']);
    assert.equal(saved.events.length, r.events.length);
  }));
test('review tokens are invalidated by record edits and cannot be reused for another run', () =>
  fixture(async ({ start, begin, sort, act }) => {
    let r = await sort(await begin(await start()));
    r = (await act(r, { type: 'review' })).data.run;
    const token = r.reviewToken;
    assert.equal((await act(r, { type: 'submit', reviewToken: 'wrong-token' })).status, 409);
    r = (
      await act(r, {
        type: 'record-line',
        itemId: 'C01',
        record: {
          receivedUnits: 24,
          condition: 'Good',
          disposition: 'accept',
          note: 'Counted twice',
        },
      })
    ).data.run;
    assert.equal(r.reviewToken, null);
    assert.equal((await act(r, { type: 'submit', reviewToken: token })).status, 409);
    r = (await act(r, { type: 'review' })).data.run;
    assert.notEqual(r.reviewToken, token);
    assert.equal(
      (await act(r, { type: 'submit', reviewToken: r.reviewToken })).data.completed,
      true,
    );
    const other = await begin(await start());
    assert.equal((await act(other, { type: 'submit', reviewToken: r.reviewToken })).status, 409);
  }));
test('pause and resume are persistent, idempotent and exclude real paused time', () =>
  fixture(async ({ db, start, begin, req, act }) => {
    let r = await begin(await start());
    db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
      new Date(Date.now() - 120000).toISOString(),
      r.id,
    );
    r = (await req(`/brightmart/runs/${r.id}/pause`, 'POST')).data;
    assert.ok(r.elapsedSeconds >= 120 && r.elapsedSeconds < 122);
    const seconds = r.elapsedSeconds;
    const state = JSON.parse(
      db.prepare('SELECT state FROM brightmart_runs WHERE session_id=?').get(r.id).state,
    );
    state.pausedAt = new Date(Date.now() - 60000).toISOString();
    db.prepare('UPDATE brightmart_runs SET state=? WHERE session_id=?').run(
      JSON.stringify(state),
      r.id,
    );
    r = (await req(`/brightmart/runs/${r.id}/pause`, 'POST')).data;
    assert.ok(r.elapsedSeconds >= 60 && r.elapsedSeconds < 62);
    assert.equal((await act(r, { type: 'inspect', itemId: 'C01' })).status, 409);
    r = (await req(`/brightmart/runs/${r.id}/resume`, 'POST')).data;
    assert.ok(r.elapsedSeconds >= 60 && r.elapsedSeconds < 62);
    const v = r.version;
    assert.equal((await req(`/brightmart/runs/${r.id}/resume`, 'POST')).data.version, v);
    assert.ok(seconds > r.elapsedSeconds);
  }));
test('fixed rubric caps each dimension and uses exact efficiency thresholds and score bands', () =>
  fixture(async ({ db, start, begin, sort }) => {
    const r = await sort(await begin(await start()));
    const state = JSON.parse(
      db.prepare('SELECT state FROM brightmart_runs WHERE session_id=?').get(r.id).state,
    );
    for (const [t, points] of [
      [360, 15],
      [361, 10],
      [420, 10],
      [421, 5],
      [480, 5],
      [481, 0],
    ])
      assert.equal(brightScore(state, t, true).dimensions.efficiency.points, points);
    for (const [penalties, total, band] of [
      [0, 100, 'Excellent'],
      [3, 85, 'Good'],
      [6, 70, 'Developing'],
      [10, 65, 'Developing'],
    ]) {
      const s = {
        ...state,
        events: [
          ...state.events,
          ...Array.from({ length: penalties }, () => ({ correct: false, failure: 'quantity' })),
        ],
      };
      const score = brightScore(s, 0, true);
      assert.equal(score.total, total);
      assert.equal(score.band, band);
      assert.ok(score.dimensions.accuracy.points >= 0 && score.dimensions.accuracy.points <= 35);
    }
    const extreme = {
      ...state,
      events: [
        ...Array.from({ length: 100 }, () => ({ correct: false, failure: 'storage' })),
        ...Array.from({ length: 100 }, () => ({ correct: false, failure: 'damage' })),
      ],
      noteBeforeHandling: false,
      orderMistakes: { inspection: true, labels: true },
    };
    const score = brightScore(extreme, 1000, true);
    assert.equal(score.dimensions.accuracy.points, 0);
    assert.equal(score.dimensions.exceptions.points, 0);
    assert.equal(score.total, 10);
    assert.equal(score.band, 'Needs practice');
    assert.equal(score.dimensions.process.max, 25);
    assert.equal(score.dimensions.efficiency.max, 15);
    assert.equal(brightConfig.parse({ variant: 'harder' }).targetSeconds, 300);
  }));
test('server completion freezes one elapsed value and ignores spoofed score and duration', () =>
  fixture(async ({ db, start, begin, sort, act, req }) => {
    let r = await sort(await begin(await start()));
    db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
      new Date(Date.now() - 505000).toISOString(),
      r.id,
    );
    r = (await act(r, { type: 'review' })).data.run;
    r = (
      await act(r, { type: 'submit', reviewToken: r.reviewToken, score: 100, elapsedSeconds: 1 })
    ).data.run;
    assert.equal(r.score, 85);
    assert.equal(r.scorecard.dimensions.efficiency.points, 0);
    assert.equal(
      r.elapsedSeconds,
      db.prepare('SELECT elapsed_seconds FROM sessions WHERE id=?').get(r.id).elapsed_seconds,
    );
    assert.equal((await req(`/brightmart/runs/${r.id}`)).data.elapsedSeconds, r.elapsedSeconds);
  }));
test('generic session endpoints cannot start, advance or abandon a BrightMart run', () =>
  fixture(async ({ req, start, begin }) => {
    assert.equal(
      (await req('/sessions', 'POST', { scenarioId: BRIGHTMART_ID, memberId: 'ada' })).status,
      409,
    );
    const r = await begin(await start());
    assert.equal(
      (await req(`/sessions/${r.id}/action`, 'POST', { stepId: 'bm-0', answer: 'complete' }))
        .status,
      409,
    );
    assert.equal((await req(`/sessions/${r.id}/abandon`, 'POST')).status, 409);
    assert.equal((await req(`/sessions/${r.id}`)).data.engine, 'brightmart-v2');
    assert.equal((await req(`/receiving/runs/${r.id}`)).status, 404);
  }));
test('assignments require variant, target and focus, and legacy completions cannot satisfy them', () =>
  fixture(async ({ db, req, start, begin, finish }) => {
    const cfg = { variant: 'standard', targetSeconds: 360, focus: 'exceptions' };
    const a = await req('/brightmart/assignments', 'POST', {
      memberId: 'ada',
      dueDate: '2026-11-15',
      config: cfg,
    });
    assert.equal(a.status, 201);
    assert.equal(
      (
        await req('/brightmart/assignments', 'POST', {
          memberId: 'ada',
          dueDate: '2026-11-16',
          config: cfg,
        })
      ).status,
      409,
    );
    let old = (await req('/receiving/runs', 'POST', { memberId: 'ada', config: {} })).data;
    for (const i of legacyManifest().items) {
      old = (
        await req(`/receiving/runs/${old.id}/action`, 'POST', {
          type: 'inspect',
          itemId: i.id,
          version: old.version,
        })
      ).data.run;
      old = (
        await req(`/receiving/runs/${old.id}/action`, 'POST', {
          type: 'place',
          itemId: i.id,
          zone: i.zone,
          reason: i.exception,
          version: old.version,
        })
      ).data.run;
    }
    assert.equal(
      (
        await req(`/receiving/runs/${old.id}/action`, 'POST', {
          type: 'submit',
          record: { accepted: 8, quarantined: 2, shortfall: 0 },
          version: old.version,
        })
      ).data.completed,
      true,
    );
    assert.equal(
      db.prepare('SELECT status FROM assignments WHERE id=?').get(a.data.id).status,
      'pending',
    );
    await finish(await begin(await start()));
    assert.equal(
      db.prepare('SELECT status FROM assignments WHERE id=?').get(a.data.id).status,
      'pending',
    );
    await finish(await begin(await start({ ...cfg, targetSeconds: 600 })));
    assert.equal(
      db.prepare('SELECT status FROM assignments WHERE id=?').get(a.data.id).status,
      'pending',
    );
    await finish(await begin(await start(cfg)));
    assert.equal(
      db.prepare('SELECT status FROM assignments WHERE id=?').get(a.data.id).status,
      'completed',
    );
  }));
test('generic team assignments are marked BrightMart and trainer changes do not rewrite saved configs', () =>
  fixture(async ({ db, req, start }) => {
    const r = await start();
    await req('/brightmart/defaults', 'PUT', {
      variant: 'harder',
      focus: 'recording',
      targetSeconds: 600,
    });
    assert.equal((await req('/brightmart/bootstrap')).data.defaults.targetSeconds, 600);
    assert.equal((await req(`/brightmart/runs/${r.id}`)).data.config.variant, 'standard');
    const a = await req('/assignments', 'POST', {
      memberId: 'amina',
      scenarioId: BRIGHTMART_ID,
      dueDate: '2026-11-16',
    });
    assert.equal(a.status, 201);
    assert.ok(
      db.prepare('SELECT config FROM brightmart_assignments WHERE assignment_id=?').get(a.data.id),
    );
    assert.ok(
      !(await req('/receiving/bootstrap')).data.assignments.some((x) => x.id === a.data.id),
    );
  }));
test('previous comparisons use only matching variant, time target and focus and persist across reloads', () =>
  fixture(async ({ start, begin, finish, req }) => {
    const first = await finish(await begin(await start()));
    await finish(await begin(await start({ variant: 'harder' })));
    const second = await finish(await begin(await start()));
    assert.equal(second.previous.score, 100);
    assert.equal(second.previous.completedAt, first.completedAt);
    const changed = await finish(await begin(await start({ focus: 'recording' })));
    assert.equal(changed.previous, null);
    assert.deepEqual((await req(`/brightmart/runs/${second.id}`)).data.previous, second.previous);
  }));
test('invalid item lines, nonexistent references and premature review leave state unchanged', () =>
  fixture(async ({ req, start, begin, act }) => {
    assert.equal(
      (await req('/brightmart/runs', 'POST', { memberId: 'missing', config: {} })).status,
      404,
    );
    assert.equal(
      (await req('/brightmart/runs', 'POST', { memberId: 'ada', config: { targetSeconds: 1 } }))
        .status,
      400,
    );
    let r = await begin(await start());
    for (const body of [
      { type: 'inspect', itemId: 'missing' },
      {
        type: 'record-line',
        itemId: 'C01',
        record: { receivedUnits: -1, condition: 'Good', disposition: 'accept' },
      },
      { type: 'review' },
    ]) {
      const response = await act(r, body);
      assert.ok(response.status >= 400);
      assert.equal((await req(`/brightmart/runs/${r.id}`)).data.version, r.version);
    }
    assert.equal(
      (
        await req('/brightmart/assignments', 'POST', {
          memberId: 'ada',
          dueDate: '2026-02-31',
          config: {},
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req('/brightmart/assignments', 'POST', {
          memberId: 'missing',
          dueDate: '2026-11-12',
          config: {},
        })
      ).status,
      404,
    );
  }));
test('BrightMart state, frozen manifest, and private contact data survive database reopen without mixing engines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opssim-bm-'));
  try {
    const path = join(dir, 'test.sqlite');
    let db = openDatabase(path);
    createApp(db);
    const contactAt = new Date().toISOString();
    db.prepare('INSERT INTO demo_requests VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'frozen-contact',
      contactAt,
      'Fictional Owner',
      'Fictional Reopen Shop',
      'reopen@example.invalid',
      '',
      'Retail',
      '1–5',
      'Fictional receiving practice request',
      'demo',
      contactAt,
    );
    const id = 'frozen-brightmart';
    const snapshot = { engine: 'brightmart-v2', title: 'Saved v2', steps: [] };
    db.prepare(
      "INSERT INTO sessions(id,scenario_id,member_id,status,started_at,snapshot) VALUES(?,?,?,'in_progress',?,?)",
    ).run(id, BRIGHTMART_ID, 'ada', '2026-11-08T12:00:00.000Z', JSON.stringify(snapshot));
    const state = {
      config: brightConfig.parse({}),
      manifest: brightManifest(),
      version: 7,
      records: { C07: { receivedUnits: 22, condition: 'Good', disposition: 'accept' } },
      inspected: ['C07'],
      started: true,
      pausedAt: '2026-11-08T12:00:10.000Z',
      pausedMs: 0,
    };
    state.manifest.items[0].name = 'Frozen custom carton';
    db.prepare('INSERT INTO brightmart_runs VALUES (?,?)').run(id, JSON.stringify(state));
    db.close();
    db = openDatabase(path);
    createApp(db);
    const saved = JSON.parse(
      db.prepare('SELECT state FROM brightmart_runs WHERE session_id=?').get(id).state,
    );
    assert.equal(
      db.prepare('SELECT email FROM demo_requests WHERE id=?').get('frozen-contact').email,
      'reopen@example.invalid',
    );
    assert.equal(saved.records.C07.receivedUnits, 22);
    assert.equal(saved.manifest.items[0].name, 'Frozen custom carton');
    assert.equal(saved.version, 7);
    assert.equal(brightSeconds({ started_at: '2026-11-08T12:00:00.000Z' }, saved), 10);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an identical saved item record cannot double-count correct work or invalidate review', () =>
  fixture(async ({ start, begin, act, req }) => {
    let r = await begin(await start());
    for (const type of ['inspect', 'labels']) r = (await act(r, { type, itemId: 'C01' })).data.run;
    const record = {
      receivedUnits: 24,
      condition: 'Good',
      disposition: 'accept',
      note: 'No extra note',
    };
    r = (await act(r, { type: 'record-line', itemId: 'C01', record })).data.run;
    const before = await req(`/brightmart/runs/${r.id}`);
    const duplicate = await act(r, { type: 'record-line', itemId: 'C01', record });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.data.error, /already saved/);
    const after = await req(`/brightmart/runs/${r.id}`);
    assert.equal(after.data.version, before.data.version);
    assert.deepEqual(after.data.events, before.data.events);
    assert.deepEqual(after.data.records, before.data.records);
  }));
