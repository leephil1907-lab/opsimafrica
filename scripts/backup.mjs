import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const source = process.env.DB_PATH || 'data/opssim.sqlite';
if (!existsSync(source)) {
  console.error(`No database found at ${source}. Start the app once before backing up.`);
  process.exit(1);
}
const destination = resolve(process.env.BACKUP_DIR || 'backups');
mkdirSync(destination, { recursive: true });
const name = `opssim-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
const db = new Database(source, { readonly: true });
try {
  await db.backup(resolve(destination, name));
  console.log(`Consistent SQLite backup saved to ${resolve(destination, name)}`);
} finally {
  db.close();
}
