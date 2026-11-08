import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';
import { openDatabase } from '../server/db.mjs';
import { LAB_ID, installReceiving, manifest } from '../server/receiving.mjs';

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
    const r = await req('/receiving/runs', 'POST', { memberId, config });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
  }
  async function act(run, body) {
    return req(`/receiving/runs/${run.id}/action`, 'POST', { ...body, version: run.version });
  }
  async function sort(run) {
    for (const item of manifest(run.config.variant).items) {
      if (!run.inspected.includes(item.id)) {
        const r = await act(run, { type: 'inspect', itemId: item.id });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        run = r.data.run;
      }
      if (!run.placements[item.id]) {
        const r = await act(run, {
          type: 'place',
          itemId: item.id,
          zone: item.zone,
          reason: item.exception,
        });
        assert.equal(r.data.correct, true, JSON.stringify(r.data));
        run = r.data.run;
      }
    }
    return run;
  }
  async function finish(run) {
    run = await sort(run);
    const record =
      run.config.variant === 'harder'
        ? { accepted: 9, quarantined: 3, shortfall: 1 }
        : { accepted: 8, quarantined: 2, shortfall: 0 };
    const r = await act(run, { type: 'submit', record, score: 100, elapsedSeconds: 0 });
    assert.equal(r.data.completed, true, JSON.stringify(r.data));
    return r.data.run;
  }
  try {
    await fn({ db, req, start, act, sort, finish });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}

test('receiving installation is idempotent and manifests expose inspection facts, not correct destinations', () =>
  fixture(async ({ db, req, start }) => {
    installReceiving(db);
    assert.equal(db.prepare('SELECT count(*) n FROM scenarios WHERE id=?').get(LAB_ID).n, 1);
    const b = (await req('/receiving/bootstrap')).data;
    assert.equal(b.roles.length, 5);
    assert.equal(b.businessTypes.length, 5);
    assert.match(b.inviteCode, /^[A-F0-9]{10}$/);
    assert.equal(b.runs.length, 0);
    const run = await start();
    assert.equal(run.manifest.items.length, 10);
    assert.equal(run.manifest.expected, 10);
    assert.equal(run.manifest.inspectionDate, '2026-11-08');
    assert.ok(run.manifest.items.every((i) => i.exception === undefined && i.zone === undefined));
    assert.equal(run.manifest.items[4].condition, 'crushed seal');
    assert.equal(run.manifest.items[7].expiry, '2026-10-31');
    assert.equal(run.engine, 'receiving-lab');
  }));

test('standard ten-carton run requires inspection, correct sorting, manual reconciliation and explicit final submission', () =>
  fixture(async ({ start, act, sort, req }) => {
    let run = await start();
    let r = await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'none' });
    assert.equal(r.data.correct, false);
    assert.equal(r.data.run.errors, 1);
    assert.match(r.data.message, /Inspect/);
    run = r.data.run;
    run = await sort(run);
    assert.equal(run.status, 'in_progress');
    assert.equal(run.score, null);
    assert.equal(Object.keys(run.placements).length, 10);
    assert.equal(run.exceptionsCaught, 2);
    assert.equal(run.record, null);
    r = await act(run, {
      type: 'submit',
      record: { accepted: 8, quarantined: 2, shortfall: 0 },
      score: 100,
    });
    run = r.data.run;
    assert.equal(run.status, 'completed');
    assert.equal(run.score, 92);
    assert.equal(run.accuracy, 92);
    assert.equal(run.record.accepted, 8);
    assert.ok(run.record.submittedAt);
    assert.equal(run.totalSteps, 4);
    assert.equal(run.stepIndex, 4);
    assert.equal(run.firstPassExceptions, 2);
    assert.match(run.recommendations.join(' '), /Inspect/);
    assert.equal((await req(`/sessions/${run.id}`)).data.engine, 'receiving-lab');
    assert.equal((await req('/bootstrap')).data.sessions.find((s) => s.id === run.id).score, 92);
  }));

test('harder delivery adds a SKU mismatch and a real one-carton shortage', () =>
  fixture(async ({ start, finish }) => {
    const run = await finish(await start({ variant: 'harder' }));
    assert.equal(run.manifest.delivered, 12);
    assert.equal(run.manifest.expected, 13);
    assert.equal(run.manifest.items[10].sku, 'OIL-04');
    assert.equal(run.manifest.items[10].printedSku, 'FLR-06');
    assert.equal(run.record.accepted, 9);
    assert.equal(run.record.quarantined, 3);
    assert.equal(run.record.shortfall, 1);
    assert.equal(run.exceptionsCaught, 3);
    assert.equal(run.firstPassExceptions, 3);
    assert.equal(run.score, 100);
    assert.equal(run.accuracy, 100);
    assert.match(run.recommendations[0], /clean harder delivery/);
  }));

test('damaged, expired, mislabelled and wrong-temperature stock produce specific explanations', () =>
  fixture(async ({ start, act }) => {
    let run = await start({ variant: 'harder' });
    for (const [id, zone, failure, word] of [
      ['C05', 'cold', 'damage', 'crushed seal'],
      ['C08', 'dry', 'expiry', 'expired'],
      ['C11', 'dry', 'label', 'printed SKU'],
      ['C03', 'dry', 'storage', 'cold storage'],
    ]) {
      run = (await act(run, { type: 'inspect', itemId: id })).data.run;
      const r = await act(run, { type: 'place', itemId: id, zone, reason: 'none' });
      assert.equal(r.data.correct, false);
      assert.equal(r.data.run.events.at(-1).failure, failure);
      assert.ok(r.data.message.toLowerCase().includes(word.toLowerCase()));
      assert.equal(r.data.run.placements[id], undefined);
      run = r.data.run;
    }
    assert.equal(run.errors, 4);
    assert.ok(run.recommendations.length >= 4);
  }));

test('a quarantined carton needs a matching reason; accepted cartons cannot retain exception reasons', () =>
  fixture(async ({ start, act }) => {
    let run = await start();
    run = (await act(run, { type: 'inspect', itemId: 'C05' })).data.run;
    let r = await act(run, { type: 'place', itemId: 'C05', zone: 'quarantine', reason: 'expiry' });
    assert.equal(r.data.correct, false);
    assert.equal(r.data.run.events.at(-1).failure, 'reason');
    run = r.data.run;
    run = (await act(run, { type: 'place', itemId: 'C05', zone: 'quarantine', reason: 'damage' }))
      .data.run;
    assert.equal(run.firstPassExceptions, 0);
    assert.equal(run.exceptionsCaught, 1);
    run = (await act(run, { type: 'inspect', itemId: 'C01' })).data.run;
    r = await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'damage' });
    assert.equal(r.data.correct, false);
    assert.match(r.data.message, /no exception reason/);
  }));

test('versions and duplicate guards make actions transactional and prevent double counting', () =>
  fixture(async ({ start, act, req }) => {
    let run = await start();
    const body = { type: 'inspect', itemId: 'C01' };
    const responses = await Promise.all([act(run, body), act(run, body)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    run = responses.find((r) => r.status === 200).data.run;
    assert.equal(run.version, 1);
    assert.equal(run.events.length, 1);
    assert.equal((await act(run, body)).status, 409);
    let r = await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'none' });
    run = r.data.run;
    assert.equal(
      (await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'none' })).status,
      409,
    );
    assert.equal((await req(`/receiving/runs/${run.id}`)).data.version, 2);
  }));

test('the final form is gated by all sorted cartons and rejects wrong counts without completing', () =>
  fixture(async ({ start, act, sort }) => {
    let run = await start();
    assert.equal(
      (await act(run, { type: 'submit', record: { accepted: 8, quarantined: 2, shortfall: 0 } }))
        .status,
      409,
    );
    run = await sort(run);
    let r = await act(run, {
      type: 'submit',
      record: { accepted: 10, quarantined: 0, shortfall: 0 },
    });
    assert.equal(r.data.correct, false);
    assert.equal(r.data.completed, false);
    assert.equal(r.data.run.status, 'in_progress');
    assert.equal(r.data.run.events.at(-1).failure, 'record');
    assert.equal(r.data.run.record, null);
    assert.match(r.data.message, /does not reconcile/);
    run = r.data.run;
    r = await act(run, { type: 'submit', record: { accepted: 8, quarantined: 2, shortfall: 0 } });
    assert.equal(r.data.completed, true);
    assert.equal(r.data.run.score, 92);
    assert.equal((await act(r.data.run, { type: 'inspect', itemId: 'C01' })).status, 409);
  }));

test('pause/resume is persistent and idempotent, excludes paused time, and blocks paused actions', () =>
  fixture(async ({ start, db, req, act }) => {
    let run = await start();
    db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
      new Date(Date.now() - 120000).toISOString(),
      run.id,
    );
    run = (await req(`/receiving/runs/${run.id}/pause`, 'POST', {})).data;
    assert.equal(run.paused, true);
    const version = run.version;
    assert.equal((await act(run, { type: 'inspect', itemId: 'C01' })).status, 409);
    assert.equal((await req(`/receiving/runs/${run.id}/pause`, 'POST', {})).data.version, version);
    const state = JSON.parse(
      db.prepare('SELECT state FROM receiving_runs WHERE session_id=?').get(run.id).state,
    );
    state.pausedAt = new Date(Date.now() - 60000).toISOString();
    db.prepare('UPDATE receiving_runs SET state=? WHERE session_id=?').run(
      JSON.stringify(state),
      run.id,
    );
    const frozen = (await req(`/receiving/runs/${run.id}`)).data.elapsedSeconds;
    assert.ok(frozen >= 59 && frozen <= 60);
    run = (await req(`/receiving/runs/${run.id}/resume`, 'POST', {})).data;
    assert.equal(run.paused, false);
    assert.equal(run.version, version + 1);
    assert.ok(run.elapsedSeconds >= 59 && run.elapsedSeconds <= 60);
    assert.equal(
      (await req(`/receiving/runs/${run.id}/resume`, 'POST', {})).data.version,
      run.version,
    );
    assert.equal((await act(run, { type: 'inspect', itemId: 'C01' })).data.correct, true);
  }));

test('active overtime is server-calculated and its penalty is capped; spoofed client scores and times are ignored', () =>
  fixture(async ({ start, db, finish }) => {
    const run = await start({ targetSeconds: 300 });
    db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
      new Date(Date.now() - 3600000).toISOString(),
      run.id,
    );
    const final = await finish(run);
    assert.equal(final.score, 80);
    assert.equal(final.accuracy, 100);
    assert.ok(final.elapsedSeconds >= 3600);
    assert.match(final.recommendations.join(' '), /5-minute target/);
  }));

test('legacy endpoints cannot start, advance or abandon a receiving-engine run', () =>
  fixture(async ({ start, req }) => {
    assert.equal(
      (await req('/sessions', 'POST', { scenarioId: LAB_ID, memberId: 'ada' })).status,
      409,
    );
    const run = await start();
    assert.equal(
      (await req(`/sessions/${run.id}/action`, 'POST', { stepId: 'lab-0', answer: 'complete' }))
        .status,
      409,
    );
    assert.equal((await req(`/sessions/${run.id}/abandon`, 'POST', {})).status, 409);
    assert.equal((await req(`/receiving/runs/${run.id}`)).data.version, 0);
  }));

test('manager workspace naming, demo invitations and trainer defaults persist and validate', () =>
  fixture(async ({ req }) => {
    const b = (await req('/receiving/bootstrap')).data;
    assert.equal(
      (await req('/receiving/workspace', 'PUT', { name: 'Shift Ready Team' })).status,
      200,
    );
    assert.equal((await req('/receiving/workspace', 'PUT', { name: ' ' })).status, 400);
    assert.equal(
      (await req('/receiving/join', 'POST', { code: 'WRONG', name: 'Kemi', jobRole: 'Cashier' }))
        .status,
      403,
    );
    const m = await req('/receiving/join', 'POST', {
      code: b.inviteCode.toLowerCase(),
      name: 'Kemi',
      jobRole: 'Cashier',
    });
    assert.equal(m.status, 201);
    assert.equal(
      (await req('/bootstrap')).data.members.find((x) => x.id === m.data.id).role,
      'Cashier',
    );
    assert.equal(
      (
        await req('/receiving/defaults', 'PUT', {
          variant: 'harder',
          targetSeconds: 600,
          focus: 'recording',
          businessType: 'Pharmacy',
          jobRole: 'Supervisor',
        })
      ).status,
      200,
    );
    const after = (await req('/receiving/bootstrap')).data;
    assert.equal(after.workspaceName, 'Shift Ready Team');
    assert.equal(after.defaults.focus, 'recording');
    assert.equal(after.defaults.variant, 'harder');
    assert.equal(after.inviteCode, b.inviteCode);
  }));

test('variant-specific remedial assignments carry coaching/deadline and complete only with the matching delivery', () =>
  fixture(async ({ req, start, finish }) => {
    const assignment = (variant, focus) =>
      req('/receiving/assignments', 'POST', {
        memberId: 'ada',
        dueDate: '2026-11-18',
        config: { variant, focus },
      });
    assert.equal((await assignment('standard', 'exceptions')).status, 201);
    assert.equal((await assignment('harder', 'recording')).status, 201);
    assert.equal((await assignment('standard', 'complete')).status, 409);
    assert.equal(
      (
        await req('/receiving/assignments', 'POST', {
          memberId: 'ada',
          dueDate: '2026-02-30',
          config: {},
        })
      ).status,
      400,
    );
    await finish(await start());
    assert.ok(
      (await req('/receiving/bootstrap')).data.assignments.every((a) => a.status === 'pending'),
      'A different coaching mode must not fulfil a remedial assignment.',
    );
    await finish(await start({ focus: 'exceptions' }));
    let b = (await req('/receiving/bootstrap')).data;
    assert.equal(b.assignments.find((a) => a.config.variant === 'standard').status, 'completed');
    assert.equal(b.assignments.find((a) => a.config.variant === 'harder').status, 'pending');
    assert.equal(
      b.assignments.find((a) => a.config.variant === 'harder').config.focus,
      'recording',
    );
    await finish(await start({ variant: 'harder', focus: 'recording' }));
    b = (await req('/receiving/bootstrap')).data;
    assert.ok(b.assignments.every((a) => a.status === 'completed'));
  }));

test('previous-attempt comparison and common failure points use real saved receiving attempts', () =>
  fixture(async ({ start, act, finish, req }) => {
    let run = await start();
    run = (await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'none' })).data.run;
    const first = await finish(run);
    await finish(await start({ variant: 'harder' }));
    const second = await finish(await start());
    assert.equal(second.previous.score, first.score);
    assert.equal(second.previous.score, 92);
    assert.equal(second.score, 100);
    assert.equal(second.previous.accuracy, 92);
    const b = (await req('/receiving/bootstrap')).data;
    assert.equal(b.failures.inspection, 1);
    assert.equal(b.runs.length, 3);
    assert.equal(
      b.runs.every((r) => !r.demo),
      true,
    );
  }));

test('invalid receiving requests fail without mutating progress', () =>
  fixture(async ({ start, req, act }) => {
    const run = await start();
    assert.equal((await act(run, { type: 'inspect', itemId: 'unknown' })).status, 404);
    assert.equal(
      (await act(run, { type: 'place', itemId: 'C01', zone: 'fridge', reason: 'none' })).status,
      400,
    );
    assert.equal(
      (await req('/receiving/runs', 'POST', { memberId: 'unknown', config: {} })).status,
      404,
    );
    assert.equal(
      (await req('/receiving/runs', 'POST', { memberId: 'ada', config: { targetSeconds: 1 } }))
        .status,
      400,
    );
    assert.equal((await req('/receiving/runs/unknown')).status, 404);
    assert.equal(
      (await req(`/receiving/runs/${run.id}/action`, 'POST', { type: 'inspect', itemId: 'C01' }))
        .status,
      400,
    );
    assert.equal((await req(`/receiving/runs/${run.id}`)).data.version, 0);
  }));

test('receiving table state survives closing and reopening a real SQLite file', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'opssim-receiving-'));
  const file = join(folder, 'practice.sqlite');
  try {
    let db = openDatabase(file);
    installReceiving(db);
    db.prepare('INSERT INTO settings VALUES (?,?)').run(
      'receivingDefaults',
      JSON.stringify({ focus: 'recording' }),
    );
    const code = db.prepare("SELECT value FROM settings WHERE key='receivingInvite'").get().value;
    db.close();
    db = openDatabase(file);
    installReceiving(db);
    assert.equal(
      db.prepare("SELECT value FROM settings WHERE key='receivingInvite'").get().value,
      code,
    );
    assert.equal(
      JSON.parse(db.prepare("SELECT value FROM settings WHERE key='receivingDefaults'").get().value)
        .focus,
      'recording',
    );
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='receiving_runs'").get());
    db.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('receiving actions and reports use the persisted lesson manifest, not a newly regenerated definition', () =>
  fixture(async ({ db, start, act, req }) => {
    let run = await start();
    const state = JSON.parse(
      db.prepare('SELECT state FROM receiving_runs WHERE session_id=?').get(run.id).state,
    );
    assert.equal(state.engineVersion, 1);
    assert.equal(state.manifest.items[4].exception, 'damage');
    state.manifest.items[0].storage = 'cold';
    state.manifest.items[0].zone = 'cold';
    db.prepare('UPDATE receiving_runs SET state=? WHERE session_id=?').run(
      JSON.stringify(state),
      run.id,
    );
    assert.equal((await req(`/receiving/runs/${run.id}`)).data.manifest.items[0].storage, 'cold');
    run = (await act(run, { type: 'inspect', itemId: 'C01' })).data.run;
    const wrong = await act(run, { type: 'place', itemId: 'C01', zone: 'dry', reason: 'none' });
    assert.equal(wrong.data.correct, false);
    assert.match(wrong.data.message, /cold storage/);
    run = wrong.data.run;
    assert.equal(
      (await act(run, { type: 'place', itemId: 'C01', zone: 'cold', reason: 'none' })).data.correct,
      true,
    );
  }));
