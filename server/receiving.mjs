import { Router } from 'express';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getSettings, sessionFromRow } from './db.mjs';

export const LAB_ID = 'retail-receiving-lab';
export const jobRoles = [
  'Warehouse assistant',
  'Shop attendant',
  'Cashier',
  'Dispatcher',
  'Supervisor',
];
export const businessTypes = [
  'Supermarket',
  'Pharmacy',
  'Spare-parts store',
  'Restaurant',
  'Logistics depot',
];
const configSchema = z.object({
  variant: z.enum(['standard', 'harder']).default('standard'),
  targetSeconds: z
    .union([z.literal(300), z.literal(360), z.literal(600), z.literal(900)])
    .default(360),
  businessType: z.enum(businessTypes).default('Supermarket'),
  jobRole: z.enum(jobRoles).default('Shop attendant'),
  focus: z.enum(['complete', 'exceptions', 'recording']).default('complete'),
});
const metadata = {
  id: LAB_ID,
  engine: 'receiving-lab',
  title: 'Retail Stock Receiving & Shelf Audit',
  subtitle: 'Inspect it. Sort it. Record it. Own your next shift.',
  description:
    'Receive ten physical cartons, inspect their labels and condition, sort accepted stock, quarantine exceptions, and submit a reconciled receiving report. Includes a twelve-item harder replay.',
  category: 'Retail',
  industry: 'Supermarket',
  difficulty: 'Beginner',
  duration: 6,
  color: 'sage',
  icon: 'package',
  scene: 'receiving',
  skills: ['Physical sorting', 'Exception handling', 'Receiving records'],
  briefing:
    'Receive the delivery, inspect every carton, place sellable stock in the correct storage zone, quarantine exceptions with a reason, and submit an accurate receiving form.',
  document: [
    { label: 'Delivery', value: 'NG-2047' },
    { label: 'Standard run', value: '10 cartons · 2 exceptions' },
  ],
  steps: [
    'Inspect each carton',
    'Sort and quarantine',
    'Reconcile the receiving form',
    'Submit and review',
  ].map((title, i) => ({
    id: `lab-${i}`,
    title,
    instruction: title,
    type: 'choice',
    answer: 'complete',
    options: [
      { value: 'complete', label: 'Complete the physical task' },
      { value: 'review', label: 'Review the briefing' },
    ],
    hint: 'Follow the receiving workflow.',
    explanation: 'An accountable receiving process protects inventory accuracy.',
  })),
};

export function installReceiving(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS receiving_runs (session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, state TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS receiving_assignments (assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE, config TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO scenarios VALUES (?,?,0,?)').run(
    LAB_ID,
    JSON.stringify(metadata),
    new Date().toISOString(),
  );
  if (!db.prepare("SELECT key FROM settings WHERE key='receivingInvite'").get())
    db.prepare('INSERT INTO settings VALUES (?,?)').run(
      'receivingInvite',
      JSON.stringify(randomBytes(5).toString('hex').toUpperCase()),
    );
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
const date = () => new Date().toISOString();
const itemsBase = [
  ['C01', 'Golden Grain Rice', 'RCE-01', 'dry', 'sealed', '2027-06-30', 'none'],
  ['C02', 'Golden Grain Rice', 'RCE-01', 'dry', 'sealed', '2027-06-30', 'none'],
  ['C03', 'Fresh Milk', 'MLK-02', 'cold', 'sealed', '2026-11-15', 'none'],
  ['C04', 'Fresh Milk', 'MLK-02', 'cold', 'sealed', '2026-11-15', 'none'],
  ['C05', 'Fresh Milk', 'MLK-02', 'cold', 'crushed seal', '2026-11-15', 'damage'],
  ['C06', 'Honey Beans', 'BNS-03', 'dry', 'sealed', '2027-04-30', 'none'],
  ['C07', 'Honey Beans', 'BNS-03', 'dry', 'sealed', '2027-04-30', 'none'],
  ['C08', 'Honey Beans', 'BNS-03', 'dry', 'sealed', '2026-10-31', 'expiry'],
  ['C09', 'SunGold Oil', 'OIL-04', 'dry', 'sealed', '2027-07-31', 'none'],
  ['C10', 'Atlantic Sardines', 'SRD-05', 'dry', 'sealed', '2027-03-31', 'none'],
];
export function manifest(variant = 'standard') {
  const rows =
    variant === 'harder'
      ? [
          ...itemsBase,
          ['C11', 'SunGold Oil', 'OIL-04', 'dry', 'sealed', '2027-07-31', 'label'],
          ['C12', 'Bakers Flour', 'FLR-06', 'dry', 'sealed', '2027-05-31', 'none'],
        ]
      : itemsBase;
  const items = rows.map(([id, name, sku, storage, condition, expiry, exception]) => ({
    id,
    name,
    sku,
    printedSku: exception === 'label' ? 'FLR-06' : sku,
    storage,
    condition,
    expiry,
    exception,
    zone: exception === 'none' ? storage : 'quarantine',
  }));
  const invoice = [];
  for (const item of items) {
    let row = invoice.find((r) => r.sku === item.sku);
    if (!row) {
      row = { sku: item.sku, name: item.name, expected: 0 };
      invoice.push(row);
    }
    row.expected++;
  }
  if (variant === 'harder') invoice.find((r) => r.sku === 'FLR-06').expected++;
  return {
    items,
    invoice,
    deliveryId: variant === 'harder' ? 'NG-2048' : 'NG-2047',
    supplier: 'Mainland Foods',
    inspectionDate: '2026-11-08',
    expected: variant === 'harder' ? 13 : 10,
    delivered: items.length,
  };
}
function publicManifest(m) {
  return { ...m, items: m.items.map(({ zone, exception, ...item }) => item) };
}
function seconds(row, state) {
  const end = state.pausedAt
    ? Date.parse(state.pausedAt)
    : row.completed_at
      ? Date.parse(row.completed_at)
      : Date.now();
  return Math.max(0, Math.floor((end - Date.parse(row.started_at) - (state.pausedMs || 0)) / 1000));
}
const joined = `SELECT s.*,m.name AS member_name,m.color AS member_color FROM sessions s JOIN members m ON m.id=s.member_id`;
function read(db, id) {
  const row = db.prepare(`${joined} WHERE s.id=?`).get(id);
  const saved = db.prepare('SELECT state FROM receiving_runs WHERE session_id=?').get(id);
  if (!row || !saved) fail(404, 'Receiving run not found.');
  return { row, state: JSON.parse(saved.state) };
}
function summary(db, id) {
  const { row, state } = read(db, id);
  const m = state.manifest || manifest(state.config.variant);
  const exceptionItems = m.items.filter((i) => i.exception !== 'none');
  const prior = db
    .prepare(
      `${joined} WHERE s.member_id=? AND s.scenario_id=? AND s.status='completed' AND s.id<>? AND s.completed_at<? ORDER BY s.completed_at DESC`,
    )
    .all(row.member_id, LAB_ID, id, row.completed_at || date())
    .find((r) => {
      const saved = db.prepare('SELECT state FROM receiving_runs WHERE session_id=?').get(r.id);
      if (!saved) return false;
      const c = JSON.parse(saved.state).config;
      return (
        c.variant === state.config.variant &&
        c.targetSeconds === state.config.targetSeconds &&
        c.focus === state.config.focus
      );
    });
  return {
    ...sessionFromRow(row),
    engine: 'receiving-lab',
    config: state.config,
    manifest: publicManifest(m),
    inspected: state.inspected,
    placements: state.placements,
    record: state.record,
    events: state.events,
    version: state.version,
    paused: Boolean(state.pausedAt),
    elapsedSeconds: seconds(row, state),
    exceptionsCaught: exceptionItems.filter((i) => state.placements[i.id]?.zone === 'quarantine')
      .length,
    exceptionsTotal: exceptionItems.length,
    firstPassExceptions: exceptionItems.filter(
      (i) =>
        state.placements[i.id]?.zone === 'quarantine' &&
        !state.events.some((e) => e.itemId === i.id && e.correct === false),
    ).length,
    recommendations: recommendations(
      state.events,
      state.config.variant,
      seconds(row, state),
      state.config.targetSeconds,
    ),
    previous: prior
      ? {
          score: prior.score,
          accuracy: prior.accuracy,
          elapsedSeconds: prior.elapsed_seconds,
          completedAt: prior.completed_at,
        }
      : null,
  };
}
export function recommendations(
  events,
  variant = 'standard',
  elapsedSeconds = 0,
  targetSeconds = Infinity,
) {
  const keys = new Set(events.filter((e) => e.correct === false).map((e) => e.failure));
  const messages = [];
  if (keys.has('inspection'))
    messages.push('Inspect the label, seal, expiry, and storage requirement before moving stock.');
  if (keys.has('damage'))
    messages.push(
      'Check corners and seals: quarantine damaged cartons before adding available stock.',
    );
  if (keys.has('expiry'))
    messages.push(
      'Compare expiry dates with the inspection date; do not place expired goods on a sellable shelf.',
    );
  if (keys.has('label'))
    messages.push(
      'Match the printed SKU to the invoice and product; quarantine a mislabelled carton.',
    );
  if (keys.has('storage'))
    messages.push('Keep chilled goods in cold storage and dry goods on the dry rack.');
  if (keys.has('reason')) messages.push('Record a specific reason for every quarantined carton.');
  if (keys.has('record'))
    messages.push(
      'Reconcile accepted plus quarantined stock to delivered cartons, then compare delivered to ordered.',
    );
  if (elapsedSeconds > targetSeconds)
    messages.push(
      `Practise a fluent inspect–sort–record sequence to meet the ${targetSeconds / 60}-minute target. Never skip safety checks to save time.`,
    );
  return messages.length
    ? messages
    : [
        variant === 'harder'
          ? 'A clean harder delivery. Repeat without hints, or coach a teammate through SKU checks and shortage reconciliation.'
          : 'A clean receiving run. Try the harder twelve-carton delivery to practise label mismatches and a short shipment.',
      ];
}
export function receivingRouter(db) {
  const router = Router();
  router.get('/bootstrap', (_req, res) => {
    const settings = getSettings(db);
    const runs = db
      .prepare(`${joined} JOIN receiving_runs r ON r.session_id=s.id ORDER BY s.started_at DESC`)
      .all()
      .map(sessionFromRow);
    const failures = {};
    for (const row of db.prepare('SELECT state FROM receiving_runs').all())
      for (const e of JSON.parse(row.state).events) {
        if (e.correct === false && e.failure) failures[e.failure] = (failures[e.failure] || 0) + 1;
      }
    res.json({
      workspaceName: settings.workspaceName,
      inviteCode: settings.receivingInvite,
      defaults: settings.receivingDefaults || configSchema.parse({}),
      roles: jobRoles,
      businessTypes,
      runs,
      failures,
      assignments: db
        .prepare(
          `SELECT a.*,r.config FROM assignments a LEFT JOIN receiving_assignments r ON a.id=r.assignment_id WHERE a.scenario_id=? ORDER BY a.due_date`,
        )
        .all(LAB_ID)
        .map((a) => ({
          id: a.id,
          memberId: a.member_id,
          dueDate: a.due_date,
          status: a.status,
          config: a.config ? JSON.parse(a.config) : configSchema.parse({}),
        })),
    });
  });
  router.put('/workspace', (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(2).max(70) }).parse(req.body);
    db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(
      'workspaceName',
      JSON.stringify(name),
    );
    res.json({ name });
  });
  router.put('/defaults', (req, res) => {
    const config = configSchema.parse(req.body);
    db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(
      'receivingDefaults',
      JSON.stringify(config),
    );
    res.json(config);
  });
  router.post('/join', (req, res) => {
    const { code, name, jobRole } = z
      .object({
        code: z.string().min(1).max(40),
        name: z.string().trim().min(2).max(70),
        jobRole: z.enum(jobRoles),
      })
      .parse(req.body);
    const expected = Buffer.from(getSettings(db).receivingInvite);
    const supplied = Buffer.from(code.toUpperCase().trim());
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      fail(403, 'This practice invite code does not match this workspace.');
    const id = randomUUID();
    db.prepare('INSERT INTO members VALUES (?,?,?,?,?)').run(id, name, jobRole, 'green', date());
    res.status(201).json({ id, name, role: jobRole, color: 'green' });
  });
  router.post('/assignments', (req, res) => {
    const { memberId, dueDate, config } = z
      .object({
        memberId: z.string(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        config: configSchema,
      })
      .parse(req.body);
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(memberId))
      fail(404, 'Learner not found.');
    if (
      !Number.isFinite(Date.parse(dueDate)) ||
      new Date(dueDate).toISOString().slice(0, 10) !== dueDate
    )
      fail(400, 'Choose a valid deadline.');
    const pending = db
      .prepare(
        "SELECT a.id,r.config FROM assignments a LEFT JOIN receiving_assignments r ON r.assignment_id=a.id WHERE a.member_id=? AND a.scenario_id=? AND a.status='pending'",
      )
      .all(memberId, LAB_ID);
    if (
      pending.some((a) => (a.config ? JSON.parse(a.config).variant : 'standard') === config.variant)
    )
      fail(409, 'This learner already has this receiving variant assigned.');
    const id = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?)').run(
        id,
        memberId,
        LAB_ID,
        dueDate,
        'pending',
        date(),
      );
      db.prepare('INSERT INTO receiving_assignments VALUES (?,?)').run(id, JSON.stringify(config));
    })();
    res.status(201).json({ id, memberId, dueDate, config, status: 'pending' });
  });
  router.post('/runs', (req, res) => {
    const { memberId, config } = z
      .object({ memberId: z.string(), config: configSchema })
      .parse(req.body);
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(memberId))
      fail(404, 'Choose an existing learner.');
    const id = randomUUID();
    const snapshot = {
      ...metadata,
      duration: config.targetSeconds / 60,
      title: metadata.title + (config.variant === 'harder' ? ' · Harder delivery' : ''),
    };
    const state = {
      config,
      engineVersion: 1,
      manifest: manifest(config.variant),
      inspected: [],
      placements: {},
      record: null,
      events: [],
      version: 0,
      pausedAt: null,
      pausedMs: 0,
    };
    db.transaction(() => {
      db.prepare(
        "INSERT INTO sessions (id,scenario_id,member_id,status,started_at,snapshot) VALUES (?,?,?,'in_progress',?,?)",
      ).run(id, LAB_ID, memberId, date(), JSON.stringify(snapshot));
      db.prepare('INSERT INTO receiving_runs VALUES (?,?)').run(id, JSON.stringify(state));
    })();
    res.status(201).json(summary(db, id));
  });
  router.get('/runs/:id', (req, res) => res.json(summary(db, req.params.id)));
  router.post('/runs/:id/pause', (req, res) => {
    db.transaction(() => {
      const { row, state } = read(db, req.params.id);
      if (row.status === 'in_progress' && !state.pausedAt) {
        state.pausedAt = date();
        state.version++;
        db.prepare('UPDATE receiving_runs SET state=? WHERE session_id=?').run(
          JSON.stringify(state),
          row.id,
        );
      }
    })();
    res.json(summary(db, req.params.id));
  });
  router.post('/runs/:id/resume', (req, res) => {
    db.transaction(() => {
      const { row, state } = read(db, req.params.id);
      if (row.status === 'in_progress' && state.pausedAt) {
        state.pausedMs += Date.now() - Date.parse(state.pausedAt);
        state.pausedAt = null;
        state.version++;
        db.prepare('UPDATE receiving_runs SET state=? WHERE session_id=?').run(
          JSON.stringify(state),
          row.id,
        );
      }
    })();
    res.json(summary(db, req.params.id));
  });
  router.post('/runs/:id/action', (req, res) => {
    const action = z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('inspect'),
          itemId: z.string(),
          version: z.number().int().nonnegative(),
        }),
        z.object({
          type: z.literal('place'),
          itemId: z.string(),
          zone: z.enum(['dry', 'cold', 'quarantine']),
          reason: z.enum(['none', 'damage', 'expiry', 'label']).default('none'),
          version: z.number().int().nonnegative(),
        }),
        z.object({
          type: z.literal('submit'),
          record: z.object({
            accepted: z.number().int().nonnegative().max(1000),
            quarantined: z.number().int().nonnegative().max(1000),
            shortfall: z.number().int().nonnegative().max(1000),
          }),
          version: z.number().int().nonnegative(),
        }),
      ])
      .parse(req.body);
    const outcome = db.transaction(() => {
      const { row, state } = read(db, req.params.id);
      if (row.status !== 'in_progress')
        fail(409, 'This receiving run is complete. Start another run to practise again.');
      if (state.pausedAt) fail(409, 'Resume your receiving run before continuing.');
      if (state.version !== action.version)
        fail(409, 'This receiving run changed. Refresh it before retrying.');
      const m = state.manifest || manifest(state.config.variant);
      const item = 'itemId' in action ? m.items.find((i) => i.id === action.itemId) : null;
      if ('itemId' in action && !item) fail(404, 'Carton not found.');
      let correct = true,
        message = '',
        failure = null;
      let completed = false;
      if (action.type === 'inspect') {
        if (state.inspected.includes(item.id)) fail(409, 'This carton has already been inspected.');
        state.inspected.push(item.id);
        message = `${item.id} inspected. Check its condition, SKU, expiry, and storage requirement before placing it.`;
      } else if (action.type === 'place') {
        if (state.placements[item.id]) fail(409, 'This carton is already correctly placed.');
        if (!state.inspected.includes(item.id)) {
          correct = false;
          failure = 'inspection';
          message = 'Inspect and confirm this carton before choosing its destination.';
        } else if (action.zone !== item.zone) {
          correct = false;
          failure = item.exception === 'none' ? 'storage' : item.exception;
          message =
            item.exception === 'damage'
              ? 'This carton has a crushed seal. Keep it out of sellable stock and quarantine it.'
              : item.exception === 'expiry'
                ? 'This carton expired before the inspection date. Quarantine it; do not add it to sellable stock.'
                : item.exception === 'label'
                  ? 'The printed SKU does not match the product and purchase order. Quarantine this label mismatch.'
                  : `This product requires ${item.storage === 'cold' ? 'cold storage' : 'the dry storage rack'}. Follow the storage label.`;
        } else if (action.reason !== item.exception) {
          correct = false;
          failure = 'reason';
          message =
            item.exception === 'none'
              ? 'Accepted stock should have no exception reason.'
              : 'Choose the matching damage, expiry, or label-mismatch reason before quarantining this carton.';
        } else {
          state.placements[item.id] = { zone: action.zone, reason: action.reason, at: date() };
          message =
            action.zone === 'quarantine'
              ? `Exception recorded. ${item.id} is safely quarantined with its reason.`
              : `Correct shelf assigned. ${item.id} is now accepted stock.`;
        }
      } else {
        if (Object.keys(state.placements).length !== m.items.length)
          fail(
            409,
            'Inspect and correctly sort every carton before submitting the receiving form.',
          );
        const quarantined = m.items.filter((i) => i.exception !== 'none').length;
        const accepted = m.delivered - quarantined;
        const shortfall = m.expected - m.delivered;
        if (
          action.record.accepted !== accepted ||
          action.record.quarantined !== quarantined ||
          action.record.shortfall !== shortfall
        ) {
          correct = false;
          failure = 'record';
          message =
            'The form does not reconcile. Accepted + quarantined must equal delivered cartons. Shortfall = ordered − delivered. Check the shelf audit and invoice.';
        } else {
          state.record = { ...action.record, submittedAt: date(), deliveryId: m.deliveryId };
          completed = true;
          message =
            'Receiving report submitted. Stock, exceptions, and the delivery discrepancy are reconciled.';
        }
      }
      state.version++;
      state.events.push({
        type: action.type,
        itemId: item?.id || null,
        zone: 'zone' in action ? action.zone : null,
        reason: 'reason' in action ? action.reason : null,
        correct,
        failure,
        message,
        at: date(),
      });
      const scored = state.events.filter((e) => e.type !== 'inspect');
      const errors = scored.filter((e) => !e.correct).length;
      const elapsed = seconds(row, state);
      const accuracy = scored.length
        ? Math.round((scored.filter((e) => e.correct).length / scored.length) * 100)
        : 100;
      const penalty = Math.min(
        20,
        Math.max(0, (elapsed - state.config.targetSeconds) / state.config.targetSeconds) * 15,
      );
      const score = Math.max(0, Math.round(100 - errors * 8 - penalty));
      db.prepare('UPDATE receiving_runs SET state=? WHERE session_id=?').run(
        JSON.stringify(state),
        row.id,
      );
      const actions = state.events.map((e) => ({
        stepId: e.failure || e.type,
        stepTitle:
          e.type === 'inspect'
            ? 'Inspect carton'
            : e.type === 'place'
              ? 'Sort carton'
              : 'Submit receiving report',
        answer: [e.itemId, e.zone, e.reason].filter(Boolean).join(' · '),
        correct: e.correct,
        at: e.at,
        explanation: e.message,
      }));
      const index = completed
        ? 4
        : Object.keys(state.placements).length === m.items.length
          ? 2
          : state.inspected.length
            ? 1
            : 0;
      db.prepare(
        'UPDATE sessions SET status=?,completed_at=?,elapsed_seconds=?,score=?,accuracy=?,errors=?,step_index=?,actions=? WHERE id=?',
      ).run(
        completed ? 'completed' : 'in_progress',
        completed ? date() : null,
        elapsed,
        completed ? score : null,
        accuracy,
        errors,
        index,
        JSON.stringify(actions),
        row.id,
      );
      if (completed) {
        const pending = db
          .prepare(
            "SELECT a.id,r.config FROM assignments a LEFT JOIN receiving_assignments r ON r.assignment_id=a.id WHERE a.member_id=? AND a.scenario_id=? AND a.status='pending'",
          )
          .all(row.member_id, LAB_ID);
        for (const a of pending) {
          const expected = a.config ? JSON.parse(a.config) : configSchema.parse({});
          if (
            expected.variant === state.config.variant &&
            expected.focus === state.config.focus &&
            expected.targetSeconds === state.config.targetSeconds
          )
            db.prepare("UPDATE assignments SET status='completed' WHERE id=?").run(a.id);
        }
      }
      return { correct, message, completed, run: summary(db, row.id) };
    })();
    res.json(outcome);
  });
  return router;
}
