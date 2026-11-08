import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leadRouter } from '../server/leads.mjs';
import { exportLeads } from '../scripts/leads.mjs';

test('owner-only lead CSV exports recent consented requests privately and neutralises formulas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'opssim-leads-'));
  const path = join(dir, 'requests.sqlite');
  const now = Date.now();
  try {
    const db = new Database(path);
    leadRouter(db);
    const insert = db.prepare('INSERT INTO demo_requests VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const at = new Date(now).toISOString();
    insert.run(
      'recent',
      at,
      '=NOT_A_FORMULA()',
      'Fictional shop',
      'owner@example.invalid',
      '+234 000 000 0000',
      'Retail',
      '6–20',
      'Improve expiry checks, safely.',
      'demo',
      at,
    );
    const old = new Date(now - 91 * 86400000).toISOString();
    insert.run(
      'old',
      old,
      'Old example',
      'Fictional shop',
      'old@example.invalid',
      '',
      'Retail',
      '1–5',
      'Old fictional challenge',
      'waitlist',
      old,
    );
    db.close();
    const result = exportLeads({ dbPath: path, backupDir: join(dir, 'private'), now });
    assert.equal(result.count, 1);
    const csv = readFileSync(result.path, 'utf8');
    assert.match(csv, /"'=NOT_A_FORMULA\(\)"/);
    assert.match(csv, /"'\+234 000 000 0000"/);
    assert.match(csv, /"Improve expiry checks, safely\."/);
    assert.ok(!csv.includes('old@example.invalid'));
    assert.equal(statSync(result.path).mode & 0o777, 0o600);
    assert.throws(
      () => exportLeads({ dbPath: path, backupDir: join(process.cwd(), 'public', 'exports') }),
      /public or source/,
    );
    for (const folder of ['.', 'scripts', 'server', 'docs', '..private-exports'])
      assert.throws(
        () => exportLeads({ dbPath: path, backupDir: join(process.cwd(), folder) }),
        /public or source/,
      );
    assert.throws(() => exportLeads({ dbPath: path, days: 91 }), /1 to 90/);
    assert.throws(() => exportLeads({ dbPath: join(dir, 'missing.sqlite') }), /Database not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
