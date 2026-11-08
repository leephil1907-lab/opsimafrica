// Restore validation on a private copy only. Never mutates the supplied backup.
// node scripts/verify-backup.mjs backups/current.sqlite [backups/pre-update.sqlite]
import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { createApp } from '../server/index.mjs';
const [backup, previous] = process.argv.slice(2);
if (!backup || !existsSync(backup)) throw new Error('Provide an existing SQLite backup path.');
const cache = resolve('.cache');
mkdirSync(cache, { recursive: true });
const directory = mkdtempSync(resolve(cache, 'restore-verification-'));
const copy = resolve(directory, 'restored.sqlite');
const tableExists = (db, name) =>
  Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const rows = (db, name) =>
  db
    .prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"')
    .all()
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const tables = [
  'members',
  'sessions',
  'assignments',
  'receiving_runs',
  'receiving_assignments',
  'brightmart_runs',
  'brightmart_assignments',
];
const report = {
  passed: false,
  date: new Date().toISOString(),
  backup: backup.replaceAll('\\', '/'),
  isolatedRestore: true,
  privateRowsIncludedInReport: false,
  tables: [],
};
let db;
try {
  const snapshot = new Database(backup, { readonly: true, fileMustExist: true });
  assert.equal(snapshot.pragma('integrity_check', { simple: true }), 'ok');
  const frozen = Object.fromEntries(
    tables
      .filter((name) => tableExists(snapshot, name))
      .map((name) => [name, rows(snapshot, name)]),
  );
  const contactCount = tableExists(snapshot, 'demo_requests')
    ? snapshot.prepare('SELECT count(*) n FROM demo_requests').get().n
    : 0;
  snapshot.close();
  copyFileSync(backup, copy);
  db = openDatabase(copy);
  createApp(db); // Idempotent current migrations / engines, without starting a server.
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
  for (const [name, expected] of Object.entries(frozen)) {
    assert.deepEqual(rows(db, name), expected, 'Restore must preserve ' + name);
    report.tables.push({ name, rows: expected.length, preserved: true });
  }
  // Only retention-eligible records can be expected after normal startup cleanup.
  const eligible = new Database(backup, { readonly: true, fileMustExist: true });
  const recent = tableExists(eligible, 'demo_requests')
    ? eligible
        .prepare('SELECT * FROM demo_requests WHERE created_at>=? ORDER BY id')
        .all(new Date(Date.now() - 90 * 86400000).toISOString())
    : [];
  eligible.close();
  const restoredContacts = db.prepare('SELECT * FROM demo_requests ORDER BY id').all();
  assert.deepEqual(restoredContacts, recent);
  report.contactRequests = {
    snapshotCount: contactCount,
    recentCountPreserved: recent.length,
    equal: true,
    detailsExposed: false,
  };
  if (previous) {
    assert.ok(existsSync(previous), 'Pre-update backup must exist.');
    const old = new Database(previous, { readonly: true, fileMustExist: true });
    const completed = old.prepare("SELECT * FROM sessions WHERE status='completed'").all();
    const lookup = db.prepare('SELECT * FROM sessions WHERE id=?');
    for (const row of completed)
      assert.deepEqual(
        lookup.get(row.id),
        row,
        'A pre-update completed result must not be rewritten.',
      );
    let manifests = 0;
    for (const name of ['receiving_runs', 'brightmart_runs']) {
      if (!tableExists(old, name)) continue;
      const find = db.prepare('SELECT state FROM ' + name + ' WHERE session_id=?');
      for (const row of rows(old, name)) {
        const saved = find.get(row.session_id);
        assert.ok(saved, 'A pre-update receiving run must remain present.');
        const before = JSON.parse(row.state).manifest;
        if (before) {
          assert.deepEqual(JSON.parse(saved.state).manifest, before);
          manifests++;
        }
      }
    }
    old.close();
    report.preUpdate = {
      completedResultsPreservedExactly: completed.length,
      frozenManifestsPreserved: manifests,
      equal: true,
    };
  }
  db.close();
  db = null;
  // Reopen again, proving the checks weren't only an in-memory installation.
  const reopened = new Database(copy, { readonly: true });
  assert.equal(reopened.pragma('integrity_check', { simple: true }), 'ok');
  reopened.close();
  report.integrity = 'ok';
  report.reopened = true;
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // Do not print assertion actual/expected rows, which can contain private data.
  report.error = error.message.split('\n')[0];
  console.error('Backup validation failed: ' + report.error);
  process.exitCode = 1;
} finally {
  db?.close();
  const destination = resolve(
    process.env.REPORT_PATH || 'artifacts/brightmart/backup-verification.json',
  );
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  rmSync(directory, { recursive: true, force: true });
}
