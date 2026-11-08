// Owner-only, local export. Contact data is never listed by the public API.
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
function within(parent, child) {
  const r = relative(parent, child);
  return r === '' || (r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r));
}
function cell(value) {
  let text = String(value ?? '');
  // Quoting alone does not prevent spreadsheet-formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportLeads({
  dbPath = process.env.DB_PATH || 'data/opssim.sqlite',
  backupDir = process.env.BACKUP_DIR || 'backups',
  days = 90,
  now = Date.now(),
} = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 90)
    throw new Error('Choose an integer --days value from 1 to 90.');
  if (!existsSync(dbPath)) throw new Error('Database not found. Start the app before exporting.');
  const destination = resolve(backupDir);
  const privateDestination = (directory) => {
    const checkout = realpathSync(project);
    if (within(checkout, directory) && !within(resolve(checkout, 'backups'), directory))
      throw new Error(
        'Contact exports must not be saved in public or source directories. Use backups/ or a private directory outside the checkout.',
      );
  };
  privateDestination(destination);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  let rows;
  try {
    rows = db
      .prepare('SELECT * FROM demo_requests WHERE created_at>=? ORDER BY created_at DESC')
      .all(new Date(now - days * 86400000).toISOString());
  } finally {
    db.close();
  }
  const columns = [
    ['Request ID', 'id'],
    ['Created at', 'created_at'],
    ['Name', 'name'],
    ['Business', 'business_name'],
    ['Email', 'email'],
    ['Phone', 'phone'],
    ['Industry', 'industry'],
    ['Team size', 'team_size'],
    ['Main challenge', 'challenge'],
    ['Request type', 'purpose'],
    ['Consent at', 'consent_at'],
  ];
  const csv =
    [columns.map(([title]) => cell(title)).join(',')]
      .concat(rows.map((r) => columns.map(([, key]) => cell(r[key])).join(',')))
      .join('\r\n') + '\r\n';
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  privateDestination(realpathSync(destination));
  const filename = resolve(
    destination,
    `demo-requests-${new Date(now).toISOString().replace(/[:.]/g, '-')}.csv`,
  );
  writeFileSync(filename, '\uFEFF' + csv, { mode: 0o600, flag: 'wx' });
  return { count: rows.length, path: filename, days };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    try {
      process.loadEnvFile('.env');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--days'))
      throw new Error('Usage: npm run leads:export -- [--days 1..90]');
    const result = exportLeads(args.length ? { days: Number(args[1]) } : {});
    console.log(
      `Exported ${result.count} request(s) from the last ${result.days} days to ${result.path}`,
    );
    console.log(
      'Private contact data: restrict access, follow up manually, and delete exports according to your retention policy.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
