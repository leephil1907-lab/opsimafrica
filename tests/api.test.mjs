import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/index.mjs';
import { openDatabase } from '../server/db.mjs';
import { workflows } from '../server/scenarios.mjs';

async function setup() {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  async function close() {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  }
  async function start(scenarioId = 'receiving', memberId = 'tola') {
    const result = await request('/sessions', 'POST', { scenarioId, memberId });
    assert.equal(result.status, 201);
    return result.data;
  }
  async function finish(scenarioId = 'receiving', memberId = 'tola') {
    let s = await start(scenarioId, memberId);
    const workflow = workflows.find((w) => w.id === scenarioId);
    for (const step of workflow.steps) {
      const r = await request(`/sessions/${s.id}/action`, 'POST', {
        stepId: step.id,
        answer: step.answer,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.correct, true);
      s = r.data.session;
    }
    return s;
  }
  return { db, request, close, start, finish };
}

async function withApp(fn) {
  const ctx = await setup();
  try {
    await fn(ctx);
  } finally {
    await ctx.close();
  }
}

test('health and bootstrap expose a complete, labelled demo workspace without correct answers', () =>
  withApp(async ({ request }) => {
    assert.equal((await request('/health')).data.status, 'ok');
    const { data, status } = await request('/bootstrap');
    assert.equal(status, 200);
    assert.equal(data.scenarios.length, 5);
    assert.equal(data.members.length, 5);
    assert.ok(data.sessions.length > 80);
    assert.ok(data.sessions.every((s) => s.demo));
    assert.equal(data.scenarios[0].steps[0].answer, undefined);
  }));

test('receiving workflow records mistakes, blocks stale steps, and saves server-calculated results', () =>
  withApp(async ({ start, request }) => {
    let s = await start();
    let r = await request(`/sessions/${s.id}/action`, 'POST', {
      stepId: 'inspect',
      answer: 'good-carton',
      score: 100,
    });
    assert.equal(r.data.correct, false);
    assert.equal(r.data.session.errors, 1);
    assert.equal(r.data.session.stepIndex, 0);
    for (const step of workflows[0].steps) {
      r = await request(`/sessions/${s.id}/action`, 'POST', {
        stepId: step.id,
        answer: step.answer,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.correct, true);
    }
    s = r.data.session;
    assert.equal(s.status, 'completed');
    assert.equal(s.score, 92);
    assert.equal(s.accuracy, 83);
    assert.equal(s.actions.length, 6);
    assert.equal((await request(`/sessions/${s.id}`)).data.score, 92);
    assert.equal(
      (
        await request(`/sessions/${s.id}/action`, 'POST', {
          stepId: 'inspect',
          answer: 'damaged-carton',
        })
      ).status,
      409,
    );
  }));

test('all four built-in workflows can be completed and automatically fulfil assignments', () =>
  withApp(async ({ finish, request }) => {
    for (const workflow of workflows) {
      const member =
        workflow.id === 'receiving'
          ? 'ada'
          : workflow.id === 'picking'
            ? 'chidi'
            : workflow.id === 'cash'
              ? 'amina'
              : 'tola';
      const s = await finish(workflow.id, member);
      assert.equal(s.score, 100);
      assert.equal(s.accuracy, 100);
      assert.equal(s.stepIndex, 5);
    }
    const { data } = await request('/bootstrap');
    assert.ok(data.assignments.every((a) => a.status === 'completed'));
  }));

test('stale or duplicated task submissions do not double-count successful actions', () =>
  withApp(async ({ start, request }) => {
    const s = await start();
    const body = { stepId: 'inspect', answer: 'damaged-carton' };
    assert.equal((await request(`/sessions/${s.id}/action`, 'POST', body)).status, 200);
    assert.equal((await request(`/sessions/${s.id}/action`, 'POST', body)).status, 409);
    assert.equal((await request(`/sessions/${s.id}`)).data.actions.length, 1);
  }));

test('numeric answers support currency formatting and reject empty answers', () =>
  withApp(async ({ start, request }) => {
    const s = await start('cash');
    const empty = await request(`/sessions/${s.id}/action`, 'POST', {
      stepId: 'expected',
      answer: '',
    });
    assert.equal(empty.data.correct, false);
    const valid = await request(`/sessions/${s.id}/action`, 'POST', {
      stepId: 'expected',
      answer: '₦90,000',
    });
    assert.equal(valid.data.correct, true);
  }));

test('the server enforces overtime penalties, capped at twenty points', () =>
  withApp(async ({ db, start, request }) => {
    const s = await start('safety');
    db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(
      new Date(Date.now() - 3600_000).toISOString(),
      s.id,
    );
    let last;
    for (const step of workflows[3].steps)
      last = await request(`/sessions/${s.id}/action`, 'POST', {
        stepId: step.id,
        answer: step.answer,
        elapsedSeconds: 1,
      });
    assert.equal(last.data.session.score, 80);
    assert.ok(last.data.session.elapsedSeconds >= 3600);
  }));

test('learner creation validates names and persists new profiles', () =>
  withApp(async ({ request }) => {
    assert.equal((await request('/members', 'POST', { name: ' ', role: 'Worker' })).status, 400);
    const r = await request('/members', 'POST', { name: 'Kemi Johnson', role: 'Stock associate' });
    assert.equal(r.status, 201);
    assert.equal(
      (await request('/bootstrap')).data.members.find((m) => m.id === r.data.id).role,
      'Stock associate',
    );
  }));

test('assignments validate references and dates, reject duplicates, and can be removed', () =>
  withApp(async ({ request }) => {
    assert.equal(
      (
        await request('/assignments', 'POST', {
          memberId: 'tola',
          scenarioId: 'safety',
          dueDate: '2026-02-30',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request('/assignments', 'POST', {
          memberId: 'unknown',
          scenarioId: 'safety',
          dueDate: '2027-01-01',
        })
      ).status,
      404,
    );
    const body = { memberId: 'tola', scenarioId: 'safety', dueDate: '2027-01-01' };
    const created = await request('/assignments', 'POST', body);
    assert.equal(created.status, 201);
    assert.equal((await request('/assignments', 'POST', body)).status, 409);
    assert.equal((await request(`/assignments/${created.data.id}`, 'DELETE')).status, 200);
    assert.equal((await request(`/assignments/${created.data.id}`, 'DELETE')).status, 404);
  }));

test('custom scenarios are validated, published, playable, and independent of built-ins', () =>
  withApp(async ({ request }) => {
    const original = (await request('/scenarios/receiving?edit=true')).data;
    const body = {
      ...original,
      title: 'Pharmacy receiving check',
      industry: 'Pharmacy',
      steps: original.steps.slice(0, 1),
    };
    const result = await request('/scenarios', 'POST', body);
    assert.equal(result.status, 201);
    assert.equal(result.data.custom, true);
    assert.equal((await request('/scenarios/receiving')).data.title, 'Receiving & stock checks');
    const s = (await request('/sessions', 'POST', { scenarioId: result.data.id, memberId: 'tola' }))
      .data;
    const done = await request(`/sessions/${s.id}/action`, 'POST', {
      stepId: 'inspect',
      answer: 'damaged-carton',
    });
    assert.equal(done.data.session.status, 'completed');
    assert.equal((await request(`/scenarios/${result.data.id}`, 'DELETE')).status, 409);
    const invalid = { ...body, steps: [{ ...original.steps[0], answer: 'not-an-option' }] };
    assert.equal((await request('/scenarios', 'POST', invalid)).status, 400);
  }));

test('unused custom scenarios can be deleted; built-in scenarios are protected', () =>
  withApp(async ({ request }) => {
    const original = (await request('/scenarios/safety?edit=true')).data;
    const created = await request('/scenarios', 'POST', {
      ...original,
      title: 'Custom safety check',
    });
    assert.equal((await request(`/scenarios/${created.data.id}`, 'DELETE')).status, 200);
    assert.equal((await request('/scenarios/safety', 'DELETE')).status, 400);
  }));

test('workspace settings persist and reject invalid input', () =>
  withApp(async ({ request }) => {
    const settings = {
      workspaceName: 'Lagos Training Lab',
      managerName: 'Kemi Johnson',
      currency: 'NGN',
      sound: true,
      reduceMotion: true,
    };
    assert.equal((await request('/settings', 'PUT', settings)).status, 200);
    assert.deepEqual((await request('/bootstrap')).data.settings, settings);
    assert.equal(
      (await request('/settings', 'PUT', { ...settings, workspaceName: '' })).status,
      400,
    );
  }));

test('removing sample sessions preserves real sessions and other workspace records', () =>
  withApp(async ({ request, finish }) => {
    const s = await finish();
    const deleted = await request('/demo-data', 'DELETE');
    assert.ok(deleted.data.removed > 80);
    const { data } = await request('/bootstrap');
    assert.equal(data.sessions.length, 1);
    assert.equal(data.sessions[0].id, s.id);
    assert.equal(data.sessions[0].demo, false);
    assert.equal(data.members.length, 5);
  }));

test('CSV export is downloadable, labelled, date-filtered, and protected against formula injection', () =>
  withApp(async ({ request, start }) => {
    const csv = await request('/export/sessions.csv?days=30');
    assert.equal(csv.status, 200);
    assert.ok(csv.headers.get('content-type').includes('text/csv'));
    assert.ok(csv.data.includes('Sample data'));
    assert.ok(csv.data.includes('"Yes"'));
    assert.equal((await request('/export/sessions.csv?days=-5')).status, 400);
    const m = (await request('/members', 'POST', { name: '=SUM(1+1)', role: 'Test learner' })).data;
    const s = await start('safety', m.id);
    for (const step of workflows[3].steps)
      await request(`/sessions/${s.id}/action`, 'POST', { stepId: step.id, answer: step.answer });
    assert.ok((await request('/export/sessions.csv?days=7')).data.includes("'=SUM(1+1)"));
  }));

test('sessions can resume after fetching and abandoned sessions cannot accept actions', () =>
  withApp(async ({ start, request }) => {
    const s = await start();
    await request(`/sessions/${s.id}/action`, 'POST', {
      stepId: 'inspect',
      answer: 'damaged-carton',
    });
    assert.equal((await request(`/sessions/${s.id}`)).data.currentTask.id, 'count');
    assert.equal((await request(`/sessions/${s.id}/abandon`, 'POST', {})).data.status, 'abandoned');
    assert.equal(
      (await request(`/sessions/${s.id}/action`, 'POST', { stepId: 'count', answer: '12' })).status,
      409,
    );
  }));

test('invalid references, missing sessions, malformed input, and unknown endpoints have useful errors', () =>
  withApp(async ({ request }) => {
    assert.equal(
      (await request('/sessions', 'POST', { scenarioId: 'missing', memberId: 'tola' })).status,
      404,
    );
    assert.equal(
      (await request('/sessions', 'POST', { scenarioId: 'cash', memberId: 'missing' })).status,
      404,
    );
    assert.equal((await request('/sessions/missing')).status, 404);
    assert.equal((await request('/sessions', 'POST', {})).status, 400);
    assert.equal((await request('/unknown')).status, 404);
  }));

test('SQLite data survives closing and reopening the database', () => {
  const folder = mkdtempSync(join(tmpdir(), 'opssim-test-'));
  const path = join(folder, 'workspace.sqlite');
  try {
    let db = openDatabase(path);
    db.prepare('INSERT INTO members VALUES (?,?,?,?,?)').run(
      'persist-test',
      'Persistent Learner',
      'Test role',
      'green',
      new Date().toISOString(),
    );
    db.close();
    db = openDatabase(path);
    assert.equal(
      db.prepare('SELECT name FROM members WHERE id=?').get('persist-test').name,
      'Persistent Learner',
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM scenarios').get().n, 4);
    db.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
