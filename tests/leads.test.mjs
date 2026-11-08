import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/index.mjs';
const lead = {
  name: 'Example Manager',
  businessName: 'Fictional Retail Store',
  email: 'DEMO@example.invalid',
  phone: '',
  industry: 'Retail',
  teamSize: '6–20',
  challenge: 'We want a repeatable way to practise expiry and receiving checks.',
  purpose: 'demo',
  consent: true,
};
async function fixture(fn) {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  async function req(body = lead, method = 'POST', extra = {}) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/demo-requests`, {
      method,
      headers: { 'Content-Type': 'application/json', ...extra },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  try {
    await fn({ db, req });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}
test('demo request persists essential contact fields and returns a receipt, not a booking', () =>
  fixture(async ({ db, req }) => {
    const r = await req();
    assert.equal(r.status, 201);
    assert.equal(r.data.status, 'received');
    assert.match(r.data.requestId, /^[a-f0-9-]{36}$/);
    assert.match(r.data.message, /not booked/);
    const saved = db.prepare('SELECT * FROM demo_requests WHERE id=?').get(r.data.requestId);
    assert.equal(saved.business_name, lead.businessName);
    assert.equal(saved.email, 'demo@example.invalid');
    assert.equal(saved.phone, '');
    assert.equal(saved.team_size, '6–20');
    assert.equal(saved.purpose, 'demo');
    assert.equal(saved.consent_at, saved.created_at);
    assert.equal(r.data.email, undefined);
    assert.equal(r.data.calendarUrl, undefined);
  }));
test('waitlist intent is stored separately and does not pretend to send external messages', () =>
  fixture(async ({ db, req }) => {
    const r = await req({ ...lead, purpose: 'waitlist', phone: '+234 000 000 0000' });
    assert.equal(r.status, 201);
    assert.match(r.data.message, /waitlist/);
    assert.equal(
      db.prepare('SELECT purpose FROM demo_requests WHERE id=?').get(r.data.requestId).purpose,
      'waitlist',
    );
    assert.equal(r.data.sent, undefined);
  }));
test('consent, email, minimum challenge and enumerated fields are validated server-side', () =>
  fixture(async ({ db, req }) => {
    for (const body of [
      { ...lead, consent: false },
      { ...lead, email: 'not-email' },
      { ...lead, challenge: 'short' },
      { ...lead, industry: 'fake' },
      { ...lead, teamSize: 'unknown' },
    ]) {
      const r = await req(body);
      assert.equal(r.status, 400, JSON.stringify(r.data));
    }
    assert.equal(db.prepare('SELECT count(*) n FROM demo_requests').get().n, 0);
  }));
test('honeypot submissions receive a generic receipt but never persist contact information', () =>
  fixture(async ({ db, req }) => {
    const r = await req({ ...lead, website: 'https://spam.invalid' });
    assert.equal(r.status, 201);
    assert.equal(db.prepare('SELECT count(*) n FROM demo_requests').get().n, 0);
  }));
test('basic rate limiting caps requests and ignores untrusted forwarded-IP headers', () =>
  fixture(async ({ db, req }) => {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await req({ ...lead, email: `demo${i}@example.invalid` }, 'POST', {
            'X-Forwarded-For': `198.51.100.${i}`,
          })
        ).status,
        201,
      );
    const limited = await req(lead, 'POST', { 'X-Forwarded-For': '203.0.113.9' });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal(db.prepare('SELECT count(*) n FROM demo_requests').get().n, 5);
  }));
test('contact requests are not exposed through a public list or demo-role endpoint', () =>
  fixture(async ({ req }) => {
    await req();
    const r = await req(undefined, 'GET');
    assert.equal(r.status, 405);
    assert.equal(r.data.requestId, undefined);
    assert.equal(r.data.requests, undefined);
  }));
test('ninety-day cleanup removes expired requests while preserving recent ones', () =>
  fixture(async ({ db, req }) => {
    const first = await req();
    db.prepare('UPDATE demo_requests SET created_at=? WHERE id=?').run(
      new Date(Date.now() - 91 * 86400000).toISOString(),
      first.data.requestId,
    );
    const recent = await req({ ...lead, email: 'recent@example.invalid' });
    assert.equal(db.prepare('SELECT count(*) n FROM demo_requests').get().n, 1);
    assert.ok(db.prepare('SELECT id FROM demo_requests WHERE id=?').get(recent.data.requestId));
    assert.equal(
      db.prepare('SELECT id FROM demo_requests WHERE id=?').get(first.data.requestId),
      undefined,
    );
  }));
test('strings are stored as plain data without executing SQL or reflecting contact details', () =>
  fixture(async ({ db, req }) => {
    const name = "<script>alert('test')</script>";
    const r = await req({ ...lead, name, challenge: "Robert'); DROP TABLE members; --" });
    assert.equal(r.status, 201);
    assert.ok(db.prepare('SELECT count(*) n FROM members').get().n > 0);
    assert.equal(
      db.prepare('SELECT name FROM demo_requests WHERE id=?').get(r.data.requestId).name,
      name,
    );
    assert.equal(JSON.stringify(r.data).includes(name), false);
  }));
