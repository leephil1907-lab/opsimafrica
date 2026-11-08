import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSettings, sessionFromRow } from './db.mjs';

export const BRIGHTMART_ID = 'retail-receiving-lab';
export const brightConfig = z.preprocess(
  (value) =>
    value && typeof value === 'object' && value.variant === 'harder' && value.targetSeconds == null
      ? { ...value, targetSeconds: 300 }
      : value,
  z.object({
    variant: z.enum(['standard', 'harder']).default('standard'),
    targetSeconds: z
      .union([z.literal(300), z.literal(360), z.literal(600), z.literal(900)])
      .default(360),
    focus: z.enum(['complete', 'exceptions', 'recording']).default('complete'),
  }),
);
const notes = ['No extra note', 'Supplier follow-up', 'Counted twice', 'Seal issue', 'Label issue'];
const conditions = ['Good', 'Damaged', 'Expired', 'Mismatch'];
const lineSchema = z.object({
  receivedUnits: z.number().int().min(0).max(9999),
  condition: z.enum(conditions),
  disposition: z.enum(['accept', 'quarantine', 'return']),
  note: z.enum(notes).default('No extra note'),
});
export const brightMetadata = {
  id: BRIGHTMART_ID,
  engine: 'brightmart-v2',
  title: 'Retail Stock Receiving & Shelf Audit',
  subtitle: 'Receive and Shelf-Check a Supplier Delivery',
  description:
    'Receive eight cartons at BrightMart Mini Store. Inspect condition, labels, batch and expiry; count units, isolate exceptions and submit a receiving report. Includes a twelve-carton harder replay.',
  category: 'Retail',
  industry: 'Retail / pharmacy-style store',
  difficulty: 'Beginner',
  duration: 6,
  color: 'sage',
  icon: 'package',
  scene: 'receiving',
  skills: ['Stock inspection', 'Unit reconciliation', 'Exception handling'],
  briefing:
    'Receive a BrightMart delivery. Protect sellable stock, hold unsafe items, record actual units and submit for review.',
  document: [
    { label: 'Business', value: 'BrightMart Mini Store' },
    { label: 'Delivery', value: 'BM-2047 · 8 cartons' },
  ],
  steps: [
    'Read delivery note',
    'Inspect cartons',
    'Verify labels and units',
    'Sort accepted stock',
    'Isolate exceptions',
    'Record quantities',
    'Review report',
    'Confirm submission',
  ].map((title, i) => ({
    id: `bm-${i}`,
    title,
    instruction: title,
    type: 'choice',
    answer: 'complete',
    options: [
      { value: 'complete', label: 'Complete the practical step' },
      { value: 'review', label: 'Review the instruction' },
    ],
    hint: 'Use the task panel and delivery evidence.',
    explanation: 'Safe receiving protects people, stock and inventory records.',
  })),
};

export function installBrightMart(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS brightmart_runs(session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS brightmart_assignments(assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,config TEXT NOT NULL);`);
  db.prepare('UPDATE scenarios SET data=? WHERE id=?').run(
    JSON.stringify(brightMetadata),
    BRIGHTMART_ID,
  );
}
export function markBrightAssignment(db, id, config = brightConfig.parse({})) {
  db.prepare('INSERT OR REPLACE INTO brightmart_assignments VALUES (?,?)').run(
    id,
    JSON.stringify(brightConfig.parse(config)),
  );
}
const at = () => new Date().toISOString();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
const base = [
  ['C01', 'Paracetamol packs', 'HLT-01', 'health', 'Sealed and dry', '2027-08-31', 24, 24, 'none'],
  ['C02', 'Hand sanitiser', 'HLT-02', 'health', 'Sealed and dry', '2027-05-31', 12, 12, 'none'],
  ['C03', 'Golden grain rice', 'GRC-03', 'grocery', 'Sealed and dry', '2027-06-30', 6, 6, 'none'],
  ['C04', 'Laundry soap', 'HHD-04', 'grocery', 'Sealed and dry', '2028-03-31', 12, 12, 'none'],
  [
    'C05',
    'Antiseptic bottles',
    'HLT-05',
    'health',
    'Crushed carton, broken seal',
    '2027-02-28',
    12,
    12,
    'damage',
  ],
  ['C06', 'Vitamin C packs', 'HLT-06', 'health', 'Sealed and dry', '2026-10-31', 12, 12, 'expiry'],
  ['C07', 'Disposable gloves', 'HLT-07', 'health', 'Sealed and dry', '2028-05-31', 24, 22, 'none'],
  ['C08', 'Cooking oil', 'GRC-08', 'grocery', 'Sealed and dry', '2027-09-30', 6, 6, 'label'],
];
export function brightManifest(variant = 'standard') {
  const rows =
    variant === 'harder'
      ? [
          ...base,
          ['C09', 'Toothpaste', 'HLT-09', 'health', 'Sealed and dry', '2027-10-31', 12, 12, 'none'],
          [
            'C10',
            'Household batteries',
            'HHD-10',
            'grocery',
            'Sealed and dry',
            '2029-01-31',
            12,
            12,
            'none',
          ],
          [
            'C11',
            'Breakfast oats',
            'GRC-11',
            'grocery',
            'Sealed and dry',
            '2027-05-31',
            12,
            14,
            'none',
          ],
          [
            'C12',
            'Hand sanitiser',
            'HLT-12',
            'health',
            'Wet corner, opened seal',
            '2027-05-31',
            12,
            12,
            'damage',
          ],
        ]
      : base;
  const items = rows.map(
    ([id, name, sku, category, condition, expiry, expectedUnits, actualUnits, exception]) => ({
      id,
      name,
      sku,
      printedSku: exception === 'label' ? 'HHD-04' : sku,
      category,
      condition,
      expiry,
      expectedUnits,
      actualUnits,
      exception,
      batch: `BM261108-${id.slice(1)}`,
      zone: exception === 'none' ? category : 'quarantine',
    }),
  );
  return {
    business: 'BrightMart Mini Store',
    role: 'Stock Receiving Assistant',
    deliveryId: variant === 'harder' ? 'BM-2048' : 'BM-2047',
    supplier: 'Coastal Supply Partners',
    inspectionDate: '2026-11-08',
    items,
    expectedCartons: items.length,
    deliveredCartons: items.length,
    expectedUnits: items.reduce((n, i) => n + i.expectedUnits, 0),
    actualUnits: items.reduce((n, i) => n + i.actualUnits, 0),
    invoice: items.map((i) => ({
      id: i.id,
      sku: i.sku,
      name: i.name,
      category: i.category,
      expectedUnits: i.expectedUnits,
    })),
    instructions: [
      'Check the delivery note before handling stock.',
      'Health & Wellness is the left shelf. Grocery & Household is the right shelf.',
      'Keep damaged, expired and mismatched stock out of sellable inventory.',
      'Accept sound partial stock; record shortages per item. Do not quarantine missing units.',
      'This is non-clinical stock-handling practice, not medicine-use advice.',
    ],
  };
}
function publicManifest(m) {
  return { ...m, items: m.items.map(({ zone, exception, ...i }) => i) };
}
const expectedCondition = (i) =>
  ({ none: 'Good', damage: 'Damaged', expiry: 'Expired', label: 'Mismatch' })[i.exception];
const joined = `SELECT s.*,m.name AS member_name,m.color AS member_color FROM sessions s JOIN members m ON m.id=s.member_id`;
function read(db, id) {
  const row = db.prepare(`${joined} WHERE s.id=?`).get(id),
    saved = db.prepare('SELECT state FROM brightmart_runs WHERE session_id=?').get(id);
  if (!row || !saved) fail(404, 'BrightMart receiving run not found.');
  return { row, state: JSON.parse(saved.state) };
}
export function brightSeconds(row, s) {
  if (!s.started) return 0;
  const end = s.pausedAt
    ? Date.parse(s.pausedAt)
    : row.completed_at
      ? Date.parse(row.completed_at)
      : Date.now();
  return Math.max(0, Math.floor((end - Date.parse(row.started_at) - (s.pausedMs || 0)) / 1000));
}
function isAccepted(i) {
  return i.exception === 'none';
}
function lineCorrect(i, r) {
  return (
    !!r &&
    r.receivedUnits === i.actualUnits &&
    r.condition === expectedCondition(i) &&
    (isAccepted(i) ? r.disposition === 'accept' : ['quarantine', 'return'].includes(r.disposition))
  );
}
const cap = (v, max) => Math.max(0, Math.min(max, v));
export function brightScore(s, elapsed, completed = false) {
  const items = s.manifest.items,
    events = s.events,
    errors = events.filter((e) => !e.correct);
  const allRecords = items.every((i) => lineCorrect(i, s.records[i.id]));
  const accepted = items.filter(isAccepted),
    bad = items.filter((i) => !isAccepted(i));
  const qty = items.filter((i) => i.expectedUnits !== i.actualUnits);
  const placementPoints =
    Math.min(5, accepted.filter((i) => s.placements[i.id]?.zone === i.category).length) * 5;
  const quantityPoints = allRecords ? 5 : 0;
  const identificationPoints = items.every(
    (i) => s.labels.includes(i.id) && s.records[i.id]?.condition === expectedCondition(i),
  )
    ? 5
    : 0;
  const accuracyPenalty =
    errors.filter((e) => ['storage', 'quantity'].includes(e.failure)).length * 5;
  const exceptionChecks = ['damage', 'expiry', 'label'].map((kind) => ({
    name: kind,
    points: items
      .filter((i) => i.exception === kind)
      .every(
        (i) =>
          s.placements[i.id]?.zone === 'quarantine' &&
          s.records[i.id]?.condition === expectedCondition(i),
      )
      ? 5
      : 0,
    max: 5,
  }));
  exceptionChecks.push({
    name: 'Quantity discrepancies',
    points: qty.every((i) => s.records[i.id]?.receivedUnits === i.actualUnits) ? 5 : 0,
    max: 5,
  });
  exceptionChecks.push({
    name: 'Safe quarantine',
    points: bad.every((i) => s.placements[i.id]?.zone === 'quarantine') ? 3 : 0,
    max: 3,
  });
  exceptionChecks.push({
    name: 'Sound stock kept sellable',
    points: accepted.every((i) => s.placements[i.id]?.zone === i.category) ? 2 : 0,
    max: 2,
  });
  const exceptionPenalty =
    errors.filter((e) => ['damage', 'expiry', 'label'].includes(e.failure)).length * 5;
  const unnecessaryPenalty = errors.filter((e) => e.failure === 'unnecessary').length * 2;
  const processChecks = [
    { name: 'Delivery note before handling', points: s.noteBeforeHandling ? 5 : 0, max: 5 },
    {
      name: 'Inspect all cartons',
      points: items.every((i) => s.inspected.includes(i.id)) && !s.orderMistakes.inspection ? 5 : 0,
      max: 5,
    },
    {
      name: 'Check labels and dates',
      points: items.every((i) => s.labels.includes(i.id)) && !s.orderMistakes.labels ? 5 : 0,
      max: 5,
    },
    { name: 'Complete receiving records', points: allRecords ? 5 : 0, max: 5 },
    { name: 'Explicit final submission', points: completed ? 5 : 0, max: 5 },
  ];
  const efficiency =
    elapsed <= s.config.targetSeconds
      ? 15
      : elapsed <= s.config.targetSeconds + 60
        ? 10
        : elapsed <= s.config.targetSeconds + 120
          ? 5
          : 0;
  const dimensions = {
    accuracy: {
      points: cap(placementPoints + quantityPoints + identificationPoints - accuracyPenalty, 35),
      max: 35,
      checks: [
        { name: 'Accepted placements (up to 5 × 5)', points: placementPoints, max: 25 },
        { name: 'Accurate unit records', points: quantityPoints, max: 5 },
        { name: 'Product identification', points: identificationPoints, max: 5 },
      ],
      deductions: accuracyPenalty,
    },
    exceptions: {
      points: cap(
        exceptionChecks.reduce((n, c) => n + c.points, 0) - exceptionPenalty - unnecessaryPenalty,
        25,
      ),
      max: 25,
      checks: exceptionChecks,
      deductions: exceptionPenalty + unnecessaryPenalty,
    },
    process: {
      points: processChecks.reduce((n, c) => n + c.points, 0),
      max: 25,
      checks: processChecks,
      deductions: 0,
    },
    efficiency: {
      points: efficiency,
      max: 15,
      checks: [
        {
          name: `Within ${s.config.targetSeconds / 60} min: 15; +1 min: 10; +2 min: 5`,
          points: efficiency,
          max: 15,
        },
      ],
      deductions: 15 - efficiency,
    },
  };
  const total = Object.values(dimensions).reduce((n, d) => n + d.points, 0);
  const band =
    total >= 90
      ? 'Excellent'
      : total >= 75
        ? 'Good'
        : total >= 55
          ? 'Developing'
          : 'Needs practice';
  const bandMessage =
    total >= 90
      ? 'You handled the delivery like a trained receiving assistant.'
      : total >= 75
        ? 'Strong work. Review the one or two steps that caused errors.'
        : total >= 55
          ? 'You completed the task, but several items need closer inspection.'
          : 'Let’s repeat this scenario and focus on checking labels and quantities.';
  return { total, band, bandMessage, dimensions };
}
function totals(s) {
  const items = s.manifest.items;
  return {
    acceptedCartons: items.filter(
      (i) => s.placements[i.id] && s.placements[i.id].zone !== 'quarantine',
    ).length,
    quarantinedCartons: items.filter((i) => s.placements[i.id]?.zone === 'quarantine').length,
    receivedUnits: Object.values(s.records).reduce((n, r) => n + r.receivedUnits, 0),
    acceptedUnits: items
      .filter((i) => s.records[i.id]?.disposition === 'accept')
      .reduce((n, i) => n + s.records[i.id].receivedUnits, 0),
    quarantinedUnits: items
      .filter((i) => s.records[i.id] && s.records[i.id].disposition !== 'accept')
      .reduce((n, i) => n + s.records[i.id].receivedUnits, 0),
    shortageUnits: items.reduce(
      (n, i) =>
        n + (s.records[i.id] ? Math.max(0, i.expectedUnits - s.records[i.id].receivedUnits) : 0),
      0,
    ),
    overageUnits: items.reduce(
      (n, i) =>
        n + (s.records[i.id] ? Math.max(0, s.records[i.id].receivedUnits - i.expectedUnits) : 0),
      0,
    ),
  };
}
function coaching(s, elapsed) {
  const counts = {};
  for (const e of s.events) if (!e.correct) counts[e.failure] = (counts[e.failure] || 0) + 1;
  const map = {
    quantity:
      'Count the actual units against each delivery-note line. Record 22 received against 24 expected as a two-unit shortage; never net shortages against another product’s overage.',
    storage:
      'Read the product category before shelving: Health & Wellness on the left, Grocery & Household on the right.',
    damage:
      'Inspect corners and seals. Hold crushed, wet or opened stock in quarantine before it reaches sellable inventory.',
    expiry: 'Compare every expiry date with the exercise date before accepting the product.',
    label:
      'Match the printed SKU, batch and product type to the delivery note. Isolate a mismatch.',
    unnecessary:
      'Keep sound stock sellable. Accept the 22 good units and record the shortage separately; missing units cannot be quarantined.',
    process:
      'Read the delivery note first, then inspect the carton and check its label before shelving.',
  };
  const result = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .map((k) => map[k])
    .filter(Boolean);
  if (elapsed > s.config.targetSeconds)
    result.push(
      'Use a steady inspect–check–record–sort rhythm to meet the target without skipping safety checks.',
    );
  if (!s.noteBeforeHandling)
    result.push('Open the delivery note before handling the first carton.');
  return [
    ...new Set([
      ...result,
      'Keep checking condition, batch and expiry even when the packaging looks familiar.',
      s.config.variant === 'harder'
        ? 'Coach a teammate through per-product shortage and overage reconciliation.'
        : 'Try the harder twelve-carton delivery with a shorter five-minute target.',
    ]),
  ].slice(0, 2);
}
function summary(db, id) {
  const { row, state: s } = read(db, id),
    items = s.manifest.items,
    physical = items.filter((i) => !isAccepted(i)),
    quantity = items.filter((i) => i.expectedUnits !== i.actualUnits);
  let previous = null;
  for (const old of db
    .prepare(
      `${joined} JOIN brightmart_runs b ON b.session_id=s.id WHERE s.member_id=? AND s.id<>? AND s.status='completed' AND s.completed_at<? ORDER BY s.completed_at DESC`,
    )
    .all(row.member_id, id, row.completed_at || at())) {
    const prev = JSON.parse(
      db.prepare('SELECT state FROM brightmart_runs WHERE session_id=?').get(old.id).state,
    );
    if (
      prev.config.variant === s.config.variant &&
      prev.config.targetSeconds === s.config.targetSeconds &&
      prev.config.focus === s.config.focus
    ) {
      previous = {
        score: old.score,
        completedAt: old.completed_at,
        elapsedSeconds: old.elapsed_seconds,
      };
      break;
    }
  }
  const elapsed = brightSeconds(row, s);
  return {
    ...sessionFromRow(row),
    engine: 'brightmart-v2',
    engineVersion: 2,
    config: s.config,
    manifest: publicManifest(s.manifest),
    inspected: s.inspected,
    labels: s.labels,
    records: s.records,
    placements: s.placements,
    events: s.events,
    version: s.version,
    started: s.started,
    paused: !!s.pausedAt,
    noteRead: s.noteRead,
    noteBeforeHandling: s.noteBeforeHandling,
    elapsedSeconds: elapsed,
    reviewToken: s.reviewToken,
    totals: totals(s),
    physicalExceptionsCaught: physical.filter((i) => s.placements[i.id]?.zone === 'quarantine')
      .length,
    physicalExceptionsTotal: physical.length,
    quantityExceptionsCaught: quantity.filter(
      (i) => s.records[i.id]?.receivedUnits === i.actualUnits,
    ).length,
    quantityExceptionsTotal: quantity.length,
    exceptionsCaught:
      physical.filter((i) => s.placements[i.id]?.zone === 'quarantine').length +
      quantity.filter((i) => s.records[i.id]?.receivedUnits === i.actualUnits).length,
    exceptionsTotal: physical.length + quantity.length,
    scorecard: s.scorecard,
    coaching: coaching(s, elapsed),
    previous,
    noteOptions: notes,
    conditionOptions: conditions,
  };
}
function persist(db, row, s, completed = false) {
  const completedAt = completed ? at() : null;
  const elapsed = brightSeconds(completed ? { ...row, completed_at: completedAt } : row, s),
    score = completed ? brightScore(s, elapsed, true) : null;
  if (completed) s.scorecard = score;
  db.prepare('UPDATE brightmart_runs SET state=? WHERE session_id=?').run(
    JSON.stringify(s),
    row.id,
  );
  const decisions = s.events.filter((e) => ['place', 'record-line'].includes(e.type));
  const errors = s.events.filter((e) => !e.correct).length;
  db.prepare(
    'UPDATE sessions SET status=?,completed_at=?,elapsed_seconds=?,score=?,accuracy=?,errors=?,step_index=?,actions=? WHERE id=?',
  ).run(
    completed ? 'completed' : 'in_progress',
    completedAt,
    elapsed,
    score?.total ?? null,
    decisions.length
      ? Math.round((100 * decisions.filter((e) => e.correct).length) / decisions.length)
      : 100,
    errors,
    completed
      ? 8
      : Object.keys(s.placements).length === s.manifest.items.length
        ? 6
        : Math.min(5, s.inspected.length ? 2 : 0),
    JSON.stringify(
      s.events.map((e) => ({
        stepId: e.failure || e.type,
        stepTitle: {
          inspect: 'Inspect carton',
          labels: 'Check labels and dates',
          'record-line': 'Record item units',
          place: 'Sort and isolate',
          'read-note': 'Read delivery note',
          review: 'Review receiving report',
          submit: 'Confirm receiving report',
          hint: 'Get coaching hint',
        }[e.type],
        answer: [e.itemId, e.zone].filter(Boolean).join(' · '),
        correct: e.correct,
        at: e.at,
        explanation: e.message,
      })),
    ),
    row.id,
  );
}
export function brightmartRouter(db) {
  const router = Router();
  router.get('/bootstrap', (_req, res) => {
    const settings = getSettings(db),
      failures = {};
    for (const r of db.prepare('SELECT state FROM brightmart_runs').all())
      for (const e of JSON.parse(r.state).events)
        if (!e.correct) failures[e.failure] = (failures[e.failure] || 0) + 1;
    res.json({
      defaults: settings.brightmartDefaults || brightConfig.parse({}),
      notes,
      conditions,
      failures,
      runs: db
        .prepare(`${joined} JOIN brightmart_runs b ON b.session_id=s.id ORDER BY s.started_at DESC`)
        .all()
        .map(sessionFromRow),
      assignments: db
        .prepare(
          'SELECT a.*,b.config FROM assignments a JOIN brightmart_assignments b ON b.assignment_id=a.id ORDER BY a.due_date',
        )
        .all()
        .map((a) => ({
          id: a.id,
          memberId: a.member_id,
          dueDate: a.due_date,
          status: a.status,
          config: JSON.parse(a.config),
        })),
    });
  });
  router.put('/defaults', (req, res) => {
    const c = brightConfig.parse(req.body);
    db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(
      'brightmartDefaults',
      JSON.stringify(c),
    );
    res.json(c);
  });
  router.post('/assignments', (req, res) => {
    const { memberId, dueDate, config } = z
      .object({ memberId: z.string(), dueDate: z.iso.date(), config: brightConfig })
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
        "SELECT b.config FROM assignments a JOIN brightmart_assignments b ON b.assignment_id=a.id WHERE a.member_id=? AND a.status='pending'",
      )
      .all(memberId);
    if (pending.some((a) => JSON.parse(a.config).variant === config.variant))
      fail(409, 'This learner already has this BrightMart variant assigned.');
    const id = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO assignments VALUES (?,?,?,?,?,?)').run(
        id,
        memberId,
        BRIGHTMART_ID,
        dueDate,
        'pending',
        at(),
      );
      markBrightAssignment(db, id, config);
    })();
    res.status(201).json({ id, memberId, dueDate, config, status: 'pending' });
  });
  router.post('/runs', (req, res) => {
    const { memberId, config } = z
      .object({ memberId: z.string(), config: brightConfig })
      .parse(req.body);
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(memberId))
      fail(404, 'Choose an existing learner.');
    const id = randomUUID(),
      s = {
        engineVersion: 2,
        config,
        manifest: brightManifest(config.variant),
        inspected: [],
        labels: [],
        records: {},
        placements: {},
        events: [],
        version: 0,
        pausedAt: at(),
        pausedMs: 0,
        started: false,
        noteRead: false,
        noteBeforeHandling: false,
        orderMistakes: { inspection: false, labels: false },
        reviewToken: null,
        scorecard: null,
      };
    db.transaction(() => {
      db.prepare(
        "INSERT INTO sessions(id,scenario_id,member_id,status,started_at,snapshot) VALUES (?,?,?,'in_progress',?,?)",
      ).run(
        id,
        BRIGHTMART_ID,
        memberId,
        at(),
        JSON.stringify({ ...brightMetadata, duration: config.targetSeconds / 60 }),
      );
      db.prepare('INSERT INTO brightmart_runs VALUES (?,?)').run(id, JSON.stringify(s));
    })();
    res.status(201).json(summary(db, id));
  });
  router.get('/runs/:id', (req, res) => res.json(summary(db, req.params.id)));
  router.post('/runs/:id/:mode', (req, res, next) => {
    if (!['pause', 'resume', 'begin'].includes(req.params.mode)) return next();
    db.transaction(() => {
      const { row, state: s } = read(db, req.params.id);
      if (row.status !== 'in_progress') return;
      if (req.params.mode === 'pause') {
        if (!s.pausedAt) {
          s.pausedAt = at();
          s.version++;
        }
      } else if (!s.started) {
        s.started = true;
        s.pausedAt = null;
        s.pausedMs = 0;
        s.version++;
        db.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(at(), row.id);
      } else if (s.pausedAt) {
        s.pausedMs += Date.now() - Date.parse(s.pausedAt);
        s.pausedAt = null;
        s.version++;
      }
      db.prepare('UPDATE brightmart_runs SET state=? WHERE session_id=?').run(
        JSON.stringify(s),
        row.id,
      );
    })();
    res.json(summary(db, req.params.id));
  });
  router.post('/runs/:id/action', (req, res) => {
    const action = z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('read-note'), version: z.number().int().min(0) }),
        z.object({
          type: z.literal('inspect'),
          itemId: z.string(),
          version: z.number().int().min(0),
        }),
        z.object({
          type: z.literal('labels'),
          itemId: z.string(),
          version: z.number().int().min(0),
        }),
        z.object({
          type: z.literal('record-line'),
          itemId: z.string(),
          record: lineSchema,
          version: z.number().int().min(0),
        }),
        z.object({
          type: z.literal('place'),
          itemId: z.string(),
          zone: z.enum(['health', 'grocery', 'quarantine']),
          version: z.number().int().min(0),
        }),
        z.object({ type: z.literal('review'), version: z.number().int().min(0) }),
        z.object({
          type: z.literal('submit'),
          reviewToken: z.string(),
          version: z.number().int().min(0),
        }),
        z.object({ type: z.literal('hint'), version: z.number().int().min(0) }),
      ])
      .parse(req.body);
    const outcome = db.transaction(() => {
      const { row, state: s } = read(db, req.params.id);
      if (row.status !== 'in_progress')
        fail(409, 'This run is complete. Start another delivery to practise.');
      if (s.version !== action.version) fail(409, 'The run changed. Refresh it before retrying.');
      if (s.pausedAt && !(action.type === 'read-note' && !s.started))
        fail(409, 'Resume the shift before continuing.');
      const item = 'itemId' in action ? s.manifest.items.find((i) => i.id === action.itemId) : null;
      if ('itemId' in action && !item) fail(404, 'Carton not found.');
      let correct = true,
        message = '',
        failure = null,
        completed = false;
      const wrong = (kind, text) => {
        correct = false;
        failure = kind;
        message = text;
      };
      if (action.type === 'read-note') {
        if (!s.noteRead)
          s.noteBeforeHandling =
            s.inspected.length === 0 && !s.events.some((e) => e.type === 'place');
        s.noteRead = true;
        message =
          'Delivery note checked. Inspect the carton, compare labels and count units before shelving.';
      } else if (action.type === 'inspect') {
        if (s.inspected.includes(item.id)) fail(409, 'This carton is already inspected.');
        s.inspected.push(item.id);
        message = `${item.id} inspected. ${s.inspected.length} of ${s.manifest.items.length} cartons inspected.${s.noteRead ? '' : ' Check the delivery note before handling stock.'}`;
      } else if (action.type === 'labels') {
        if (!s.inspected.includes(item.id)) fail(409, 'Inspect this carton first.');
        if (s.labels.includes(item.id)) fail(409, 'These labels are already checked.');
        s.labels.push(item.id);
        message = `Label, batch and expiry checked for ${item.id}. Record the actual unit count and condition.`;
      } else if (action.type === 'record-line') {
        if (!s.inspected.includes(item.id) || !s.labels.includes(item.id))
          fail(409, 'Inspect the carton and check its label before recording it.');
        const r = action.record;
        const existing = s.records[item.id];
        if (
          existing &&
          ['receivedUnits', 'condition', 'disposition', 'note'].every((k) => existing[k] === r[k])
        )
          fail(409, 'This item record is already saved with these values.');
        if (r.receivedUnits !== item.actualUnits)
          wrong(
            'quantity',
            `Expected ${item.expectedUnits} units; this carton contains ${item.actualUnits}. Record ${item.actualUnits} received${item.actualUnits < item.expectedUnits ? ` and a shortage of ${item.expectedUnits - item.actualUnits}` : item.actualUnits > item.expectedUnits ? ` and an overage of ${item.actualUnits - item.expectedUnits}` : ''}.`,
          );
        else if (r.condition !== expectedCondition(item))
          wrong(
            isAccepted(item) ? 'unnecessary' : item.exception,
            isAccepted(item)
              ? 'The units are sound. Record Good; a quantity shortage is not damage.'
              : `This item is ${expectedCondition(item).toLowerCase()} and cannot enter sellable stock. Record the correct condition and flag it.`,
          );
        else if (isAccepted(item) ? r.disposition !== 'accept' : r.disposition === 'accept')
          wrong(
            isAccepted(item) ? 'unnecessary' : item.exception,
            isAccepted(item)
              ? 'Accept sound units. Record shortages separately; do not quarantine missing stock.'
              : 'Move damaged, expired or mismatched physical stock to quarantine / returns.',
          );
        else {
          s.records[item.id] = { ...r, at: at() };
          const difference = item.expectedUnits - r.receivedUnits;
          message =
            difference > 0
              ? `Expected ${item.expectedUnits} units; you counted ${r.receivedUnits}. Shortage of ${difference} recorded; accept the sound units.`
              : difference < 0
                ? `Overage of ${-difference} recorded for ${item.name}; do not offset it against another product’s shortage.`
                : 'Your item record matches the delivery evidence.';
        }
      } else if (action.type === 'place') {
        if (s.placements[item.id]) fail(409, 'This carton is already correctly placed.');
        if (!s.inspected.includes(item.id)) {
          s.orderMistakes.inspection = true;
          wrong('process', 'Inspect and confirm the carton before placing it.');
        } else if (isAccepted(item) && !s.labels.includes(item.id)) {
          s.orderMistakes.labels = true;
          wrong('process', 'Check the label and expiry date before shelving accepted stock.');
        } else if (isAccepted(item) && !s.records[item.id])
          wrong('process', 'Verify and record the actual quantity before shelving accepted stock.');
        else if (action.zone !== item.zone)
          wrong(
            !isAccepted(item)
              ? item.exception
              : action.zone === 'quarantine'
                ? 'unnecessary'
                : 'storage',
            !isAccepted(item)
              ? `This item is ${expectedCondition(item).toLowerCase()}—move it to quarantine, not sellable stock.`
              : action.zone === 'quarantine'
                ? 'These are sound units. Accept them and record any shortage separately.'
                : `Correct category: ${item.category === 'health' ? 'Health & Wellness, left shelf' : 'Grocery & Household, right shelf'}.`,
          );
        else {
          s.placements[item.id] = { zone: action.zone, at: at() };
          message =
            action.zone === 'quarantine'
              ? 'Good catch—this item is now quarantined.'
              : `Correct: ${item.name} belongs in ${item.category === 'health' ? 'Health & Wellness' : 'Grocery & Household'}.`;
        }
      } else if (action.type === 'hint') {
        message = coaching(s, brightSeconds(row, s))[0];
      } else if (action.type === 'review') {
        if (!s.manifest.items.every((i) => s.placements[i.id] && lineCorrect(i, s.records[i.id])))
          fail(409, 'Inspect, record and correctly place all cartons before reviewing.');
        s.reviewToken = randomUUID();
        message =
          'Your receiving form is ready for review. Check every line, then explicitly confirm.';
      } else {
        if (!s.reviewToken || action.reviewToken !== s.reviewToken)
          fail(409, 'Review the current receiving report before confirming it.');
        if (!s.manifest.items.every((i) => s.placements[i.id] && lineCorrect(i, s.records[i.id])))
          fail(409, 'The receiving report is not complete.');
        completed = true;
        message = 'Receiving report submitted.';
      }
      if (!['review', 'submit', 'hint'].includes(action.type)) s.reviewToken = null;
      s.version++;
      s.events.push({
        type: action.type,
        itemId: item?.id || null,
        zone: action.zone || null,
        correct,
        failure,
        message,
        at: at(),
      });
      persist(db, row, s, completed);
      if (completed) {
        for (const a of db
          .prepare(
            "SELECT a.id,b.config FROM assignments a JOIN brightmart_assignments b ON b.assignment_id=a.id WHERE a.member_id=? AND a.status='pending'",
          )
          .all(row.member_id)) {
          const c = JSON.parse(a.config);
          if (
            c.variant === s.config.variant &&
            c.targetSeconds === s.config.targetSeconds &&
            c.focus === s.config.focus
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
