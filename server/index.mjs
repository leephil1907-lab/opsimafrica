import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z, ZodError } from 'zod';
import { openDatabase, getSettings, scenarioFromRow, sessionFromRow } from './db.mjs';
import { publicScenario } from './scenarios.mjs';
import { installReceiving, receivingRouter } from './receiving.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sessionQuery = `SELECT s.*, m.name AS member_name, m.color AS member_color FROM sessions s JOIN members m ON m.id=s.member_id`;
const optionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
});
const stepSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(150),
    instruction: z.string().min(1).max(1000),
    type: z.enum(['number', 'choice', 'object']),
    options: z.array(optionSchema).min(2).max(8).optional(),
    unit: z.string().max(50).optional(),
    answer: z.string().min(1).max(200),
    hint: z.string().min(1).max(500),
    explanation: z.string().min(1).max(700),
  })
  .superRefine((step, ctx) => {
    if (step.type !== 'number' && !step.options?.some((o) => o.value === step.answer))
      ctx.addIssue({ code: 'custom', message: 'Correct answer must match an option.' });
    if (step.type === 'number' && !Number.isFinite(Number(step.answer)))
      ctx.addIssue({ code: 'custom', message: 'Numeric steps require a numeric answer.' });
  });
const scenarioSchema = z
  .object({
    title: z.string().trim().min(3).max(100),
    subtitle: z.string().max(150),
    description: z.string().min(10).max(1000),
    category: z.enum(['Warehouse', 'Logistics', 'Retail', 'Safety']),
    industry: z.string().min(1).max(100),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    duration: z.number().int().min(1).max(60),
    color: z.enum(['sage', 'sand', 'lavender', 'peach']),
    icon: z.enum(['package', 'truck', 'wallet', 'shield']),
    skills: z.array(z.string().min(1).max(60)).min(1).max(8),
    scene: z.enum(['receiving', 'picking', 'cash', 'safety']),
    briefing: z.string().min(10).max(2000),
    document: z.array(z.object({ label: z.string().max(100), value: z.string().max(200) })).max(10),
    steps: z.array(stepSchema).min(1).max(12),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.steps.map((x) => x.id)).size !== s.steps.length)
      ctx.addIssue({ code: 'custom', message: 'Task IDs must be unique.' });
  });

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function normalize(value) {
  return String(value)
    .trim()
    .replace(/[,₦\s]/g, '')
    .toLowerCase();
}

export function createApp(db = openDatabase()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  installReceiving(db);
  app.use('/api/receiving', receivingRouter(db));
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', app: 'OpsSim Africa', storage: 'sqlite' }),
  );
  app.get('/api/bootstrap', (_req, res) => {
    const settings = getSettings(db);
    delete settings.initialized;
    delete settings.receivingInvite;
    delete settings.receivingDefaults;
    res.json({
      settings,
      scenarios: db
        .prepare(
          "SELECT * FROM scenarios ORDER BY CASE WHEN id='retail-receiving-lab' THEN 0 ELSE 1 END,custom,created_at",
        )
        .all()
        .map(scenarioFromRow)
        .map((s) => publicScenario(s)),
      members: db
        .prepare('SELECT * FROM members ORDER BY created_at, name')
        .all()
        .map((m) => ({ ...m, createdAt: m.created_at })),
      sessions: db.prepare(`${sessionQuery} ORDER BY s.started_at DESC`).all().map(sessionFromRow),
      assignments: db
        .prepare('SELECT * FROM assignments ORDER BY due_date')
        .all()
        .map((a) => ({
          id: a.id,
          memberId: a.member_id,
          scenarioId: a.scenario_id,
          dueDate: a.due_date,
          status: a.status,
        })),
    });
  });
  app.get('/api/scenarios/:id', (req, res) => {
    const s = scenarioFromRow(db.prepare('SELECT * FROM scenarios WHERE id=?').get(req.params.id));
    if (!s) fail(404, 'Scenario not found.');
    res.json(publicScenario(s, req.query.edit === 'true'));
  });
  app.post('/api/scenarios', (req, res) => {
    const data = scenarioSchema.parse(req.body);
    const id = `custom-${randomUUID()}`;
    const scenario = { ...data, id };
    db.prepare('INSERT INTO scenarios VALUES (?,?,1,?)').run(
      id,
      JSON.stringify(scenario),
      new Date().toISOString(),
    );
    res.status(201).json(publicScenario({ ...scenario, custom: true }));
  });
  app.delete('/api/scenarios/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM scenarios WHERE id=?').get(req.params.id);
    if (!s) fail(404, 'Scenario not found.');
    if (!s.custom) fail(400, 'Built-in scenarios cannot be deleted.');
    if (db.prepare('SELECT id FROM sessions WHERE scenario_id=? LIMIT 1').get(req.params.id))
      fail(409, 'This scenario has training history and cannot be deleted.');
    db.transaction(() => {
      db.prepare('DELETE FROM assignments WHERE scenario_id=?').run(req.params.id);
      db.prepare('DELETE FROM scenarios WHERE id=?').run(req.params.id);
    })();
    res.json({ ok: true });
  });
  app.post('/api/members', (req, res) => {
    const data = z
      .object({ name: z.string().trim().min(2).max(80), role: z.string().trim().min(2).max(80) })
      .parse(req.body);
    const id = randomUUID();
    const color = ['green', 'purple', 'orange', 'blue', 'yellow'][
      db.prepare('SELECT COUNT(*) AS n FROM members').get().n % 5
    ];
    db.prepare('INSERT INTO members VALUES (?,?,?,?,?)').run(
      id,
      data.name,
      data.role,
      color,
      new Date().toISOString(),
    );
    res.status(201).json({ id, ...data, color });
  });
  app.post('/api/assignments', (req, res) => {
    const data = z
      .object({
        memberId: z.string(),
        scenarioId: z.string(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(req.body);
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(data.memberId))
      fail(404, 'Learner not found.');
    if (!db.prepare('SELECT id FROM scenarios WHERE id=?').get(data.scenarioId))
      fail(404, 'Scenario not found.');
    if (
      !Number.isFinite(Date.parse(data.dueDate)) ||
      new Date(data.dueDate).toISOString().slice(0, 10) !== data.dueDate
    )
      fail(400, 'Choose a valid due date.');
    if (
      db
        .prepare(
          "SELECT id FROM assignments WHERE member_id=? AND scenario_id=? AND status='pending'",
        )
        .get(data.memberId, data.scenarioId)
    )
      fail(409, 'This learner already has this training assigned.');
    const id = randomUUID();
    db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?)').run(
      id,
      data.memberId,
      data.scenarioId,
      data.dueDate,
      'pending',
      new Date().toISOString(),
    );
    res.status(201).json({ id, ...data, status: 'pending' });
  });
  app.delete('/api/assignments/:id', (req, res) => {
    const info = db.prepare('DELETE FROM assignments WHERE id=?').run(req.params.id);
    if (!info.changes) fail(404, 'Assignment not found.');
    res.json({ ok: true });
  });
  app.post('/api/sessions', (req, res) => {
    const { scenarioId, memberId } = z
      .object({ scenarioId: z.string(), memberId: z.string() })
      .parse(req.body);
    const scenario = scenarioFromRow(
      db.prepare('SELECT * FROM scenarios WHERE id=?').get(scenarioId),
    );
    if (!scenario) fail(404, 'Scenario not found.');
    if (scenario.engine === 'receiving-lab')
      fail(409, 'Start this scenario from the Receiving lab.');
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(memberId))
      fail(404, 'Learner not found.');
    const id = randomUUID();
    db.prepare(
      `INSERT INTO sessions (id,scenario_id,member_id,status,started_at,snapshot) VALUES (?,?,?,'in_progress',?,?)`,
    ).run(id, scenarioId, memberId, new Date().toISOString(), JSON.stringify(scenario));
    res.status(201).json(getSession(db, id));
  });
  app.get('/api/sessions/:id', (req, res) => res.json(getSession(db, req.params.id)));
  app.post('/api/sessions/:id/action', (req, res) => {
    const { answer, stepId } = z
      .object({ answer: z.union([z.string().max(200), z.number()]), stepId: z.string() })
      .parse(req.body);
    const outcome = db.transaction(() => {
      const row = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
      if (!row) fail(404, 'Session not found.');
      if (row.status !== 'in_progress') fail(409, 'This session is no longer in progress.');
      const scenario = JSON.parse(row.snapshot);
      if (scenario.engine === 'receiving-lab')
        fail(409, 'Use the receiving run actions for this scenario.');
      const step = scenario.steps[row.step_index];
      if (step.id !== stepId) fail(409, 'This task has already changed. Refresh the session.');
      const correct =
        step.type === 'number'
          ? Number(normalize(answer)) === Number(step.answer) && normalize(answer) !== ''
          : normalize(answer) === normalize(step.answer);
      const actions = JSON.parse(row.actions);
      const elapsed = Math.max(
        1,
        Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000),
      );
      actions.push({
        stepId: step.id,
        stepTitle: step.title,
        answer: String(answer),
        correct,
        at: new Date().toISOString(),
        explanation: correct ? step.explanation : step.hint,
      });
      const errors = row.errors + (correct ? 0 : 1);
      const stepIndex = row.step_index + (correct ? 1 : 0);
      const done = stepIndex === scenario.steps.length;
      const accuracy = Math.round((actions.filter((a) => a.correct).length / actions.length) * 100);
      const overtimePenalty = Math.min(
        20,
        Math.max(0, (elapsed - scenario.duration * 60) / (scenario.duration * 60)) * 15,
      );
      const score = Math.max(0, Math.round(100 - errors * 8 - overtimePenalty));
      db.prepare(
        'UPDATE sessions SET actions=?,errors=?,step_index=?,elapsed_seconds=?,status=?,completed_at=?,score=?,accuracy=? WHERE id=?',
      ).run(
        JSON.stringify(actions),
        errors,
        stepIndex,
        elapsed,
        done ? 'completed' : 'in_progress',
        done ? new Date().toISOString() : null,
        done ? score : null,
        accuracy,
        row.id,
      );
      if (done)
        db.prepare(
          "UPDATE assignments SET status='completed' WHERE member_id=? AND scenario_id=? AND status='pending'",
        ).run(row.member_id, row.scenario_id);
      return {
        correct,
        message: correct ? step.explanation : step.hint,
        completed: done,
        session: getSession(db, row.id),
      };
    })();
    res.json(outcome);
  });
  app.post('/api/sessions/:id/abandon', (req, res) => {
    const receiving = db
      .prepare('SELECT session_id FROM receiving_runs WHERE session_id=?')
      .get(req.params.id);
    if (receiving)
      fail(409, 'Pause receiving runs with the receiving API; their timing must stay consistent.');
    const row = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id);
    if (!row) fail(404, 'Session not found.');
    if (row.status === 'in_progress')
      db.prepare("UPDATE sessions SET status='abandoned',elapsed_seconds=? WHERE id=?").run(
        Math.max(0, Math.floor((Date.now() - Date.parse(row.started_at)) / 1000)),
        row.id,
      );
    res.json(getSession(db, row.id));
  });
  app.put('/api/settings', (req, res) => {
    const settings = z
      .object({
        workspaceName: z.string().trim().min(2).max(80),
        managerName: z.string().trim().min(2).max(80),
        currency: z.enum(['NGN', 'GHS', 'KES', 'USD']),
        sound: z.boolean(),
        reduceMotion: z.boolean(),
      })
      .parse(req.body);
    db.transaction(() =>
      Object.entries(settings).forEach(([key, value]) =>
        db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value)),
      ),
    )();
    res.json(settings);
  });
  app.delete('/api/demo-data', (_req, res) => {
    const info = db.prepare('DELETE FROM sessions WHERE demo=1').run();
    res.json({ removed: info.changes });
  });
  app.get('/api/export/sessions.csv', (req, res) => {
    const days = Number(req.query.days || 90);
    if (![7, 30, 90, 3650].includes(days)) fail(400, 'Invalid date range.');
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = db
      .prepare(
        `${sessionQuery} WHERE s.status='completed' AND s.started_at>=? ORDER BY s.started_at DESC`,
      )
      .all(since)
      .map(sessionFromRow);
    const header = [
      'Session ID',
      'Learner',
      'Scenario',
      'Completed at',
      'Score',
      'Accuracy (%)',
      'Errors',
      'Time (seconds)',
      'Sample data',
    ];
    const escape = (value) => {
      const str = String(value ?? '');
      return `"${/^[=+@\-\t\r]/.test(str) ? "'" : ''}${str.replace(/"/g, '""')}"`;
    };
    const csv = [
      header,
      ...rows.map((s) => [
        s.id,
        s.memberName,
        s.scenarioTitle,
        s.completedAt,
        s.score,
        s.accuracy,
        s.errors,
        s.elapsedSeconds,
        s.demo ? 'Yes' : 'No',
      ]),
    ]
      .map((row) => row.map(escape).join(','))
      .join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="OpsSim-training-report.csv"');
    res.send('\uFEFF' + csv);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ZodError)
      return res.status(400).json({ error: error.issues.map((i) => i.message).join(' ') });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Invalid JSON body.' });
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res
      .status(status)
      .json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.message });
  });
  return app;
}

function getSession(db, id) {
  const row = db.prepare(`${sessionQuery} WHERE s.id=?`).get(id);
  if (!row) fail(404, 'Session not found.');
  const scenario = JSON.parse(row.snapshot);
  return {
    ...sessionFromRow(row),
    scenario: publicScenario(scenario),
    currentTask:
      row.status === 'in_progress' ? publicScenario(scenario).steps[row.step_index] : null,
  };
}

async function main() {
  try {
    process.loadEnvFile(resolve(root, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const app = createApp();
  const server = createServer(app);
  if (process.env.NODE_ENV === 'production' || process.argv.includes('--production')) {
    app.use(express.static(resolve(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root,
      server: { middlewareMode: true, allowedHosts: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () =>
    console.log(`OpsSim Africa ready at http://0.0.0.0:${port}`),
  );
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
