import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { workflows } from './scenarios.mjs';

export function openDatabase(path = process.env.DB_PATH || 'data/opssim.sqlite', seed = true) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, data TEXT NOT NULL, custom INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id), member_id TEXT NOT NULL REFERENCES members(id),
      status TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      score INTEGER, accuracy INTEGER, errors INTEGER NOT NULL DEFAULT 0, step_index INTEGER NOT NULL DEFAULT 0,
      actions TEXT NOT NULL DEFAULT '[]', demo INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), scenario_id TEXT NOT NULL REFERENCES scenarios(id),
      due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_date ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS sessions_member ON sessions(member_id);
  `);
  if (seed && !db.prepare("SELECT value FROM settings WHERE key = 'initialized'").get())
    seedDatabase(db);
  return db;
}

function seedDatabase(db) {
  db.transaction(() => {
    const now = new Date();
    const settings = {
      initialized: true,
      workspaceName: 'Mainland Operations',
      managerName: 'Tola Adeyemi',
      currency: 'NGN',
      sound: false,
      reduceMotion: false,
    };
    const insertSetting = db.prepare('INSERT INTO settings (key,value) VALUES (?,?)');
    Object.entries(settings).forEach(([key, value]) =>
      insertSetting.run(key, JSON.stringify(value)),
    );
    const insertScenario = db.prepare(
      'INSERT INTO scenarios (id,data,custom,created_at) VALUES (?,?,0,?)',
    );
    workflows.forEach((s) => insertScenario.run(s.id, JSON.stringify(s), now.toISOString()));
    const members = [
      { id: 'tola', name: 'Tola Adeyemi', role: 'Operations manager', color: 'green' },
      { id: 'ada', name: 'Ada Okafor', role: 'Warehouse associate', color: 'purple' },
      { id: 'chidi', name: 'Chidi Eze', role: 'Dispatch lead', color: 'orange' },
      { id: 'amina', name: 'Amina Yusuf', role: 'Retail associate', color: 'blue' },
      { id: 'david', name: 'David Mensah', role: 'Stock controller', color: 'yellow' },
    ];
    const insertMember = db.prepare('INSERT INTO members VALUES (?,?,?,?,?)');
    members.forEach((m) => insertMember.run(m.id, m.name, m.role, m.color, now.toISOString()));
    const insertSession = db.prepare(
      `INSERT INTO sessions (id,scenario_id,member_id,status,started_at,completed_at,elapsed_seconds,score,accuracy,errors,step_index,actions,demo,snapshot) VALUES (?,?,?,'completed',?,?,?,?,?,?,?,'[]',1,?)`,
    );
    for (let day = 28; day >= 0; day--) {
      const count = day % 5 === 0 ? 4 : 3;
      for (let j = 0; j < count; j++) {
        const s = workflows[(day + j) % workflows.length];
        const m = members[(day * 2 + j) % members.length];
        const progress = (28 - day) / 28;
        const score = Math.min(100, Math.round(65 + progress * 24 + ((day * 7 + j * 3) % 15)));
        const elapsed = Math.round(s.duration * 60 * (1.18 - progress * 0.42 + (j % 3) * 0.06));
        const started = new Date(now);
        started.setDate(started.getDate() - day);
        started.setHours(8 + j * 2, (day * 7 + j * 13) % 60, 0, 0);
        if (started > now) started.setTime(now.getTime() - (j + 1) * 45 * 60000);
        const completed = new Date(started.getTime() + elapsed * 1000);
        insertSession.run(
          randomUUID(),
          s.id,
          m.id,
          started.toISOString(),
          completed.toISOString(),
          elapsed,
          score,
          Math.min(100, score + 3),
          Math.max(0, Math.round((100 - score) / 9)),
          s.steps.length,
          JSON.stringify(s),
        );
      }
    }
    const assignment = db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?)');
    [
      ['ada', 'receiving'],
      ['chidi', 'picking'],
      ['amina', 'cash'],
    ].forEach(([memberId, scenarioId], i) => {
      const due = new Date(now);
      due.setDate(due.getDate() + i + 1);
      assignment.run(
        randomUUID(),
        memberId,
        scenarioId,
        due.toISOString().slice(0, 10),
        'pending',
        now.toISOString(),
      );
    });
  })();
}

export function getSettings(db) {
  return Object.fromEntries(
    db
      .prepare('SELECT * FROM settings')
      .all()
      .map((row) => [row.key, JSON.parse(row.value)]),
  );
}

export function scenarioFromRow(row) {
  return row
    ? { ...JSON.parse(row.data), custom: Boolean(row.custom), createdAt: row.created_at }
    : null;
}

export function sessionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    engine: JSON.parse(row.snapshot).engine || undefined,
    memberId: row.member_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    elapsedSeconds: row.elapsed_seconds,
    score: row.score,
    accuracy: row.accuracy,
    errors: row.errors,
    stepIndex: row.step_index,
    actions: JSON.parse(row.actions),
    demo: Boolean(row.demo),
    scenarioTitle: row.scenario_title || JSON.parse(row.snapshot).title,
    memberName: row.member_name,
    memberColor: row.member_color,
    category: JSON.parse(row.snapshot).category,
    duration: JSON.parse(row.snapshot).duration,
    totalSteps: JSON.parse(row.snapshot).steps.length,
  };
}
