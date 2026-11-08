import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(120),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(32).default(''),
  industry: z.enum(['Retail', 'Pharmacy', 'Warehouse', 'Logistics', 'Other']),
  teamSize: z.enum(['1–5', '6–20', '21–50', '51–200', '201+']),
  challenge: z.string().trim().min(10).max(1500),
  purpose: z.enum(['demo', 'waitlist']).default('demo'),
  consent: z.literal(true),
  website: z.string().max(200).default(''),
});
export function leadRouter(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS demo_requests (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL,
    business_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
    industry TEXT NOT NULL, team_size TEXT NOT NULL, challenge TEXT NOT NULL,
    purpose TEXT NOT NULL, consent_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS demo_requests_date ON demo_requests(created_at);`);
  const router = Router(),
    limits = new Map();
  const purge = () =>
    db
      .prepare('DELETE FROM demo_requests WHERE created_at<?')
      .run(new Date(Date.now() - 90 * 86400000).toISOString());
  purge();
  router.post('/', (req, res) => {
    const now = Date.now(),
      ip = req.ip || 'unknown';
    for (const [k, v] of limits) if (now - v.at > 300000) limits.delete(k);
    const counter = limits.get(ip) || { at: now, count: 0 };
    if (counter.count >= 5) {
      res.set('Retry-After', String(Math.ceil((300000 - (now - counter.at)) / 1000)));
      return res
        .status(429)
        .json({ error: 'Too many requests. Please wait a few minutes before trying again.' });
    }
    counter.count++;
    limits.set(ip, counter);
    if (limits.size > 10000) limits.delete(limits.keys().next().value);
    const data = leadSchema.parse(req.body);
    const id = randomUUID();
    if (!data.website) {
      purge();
      const at = new Date().toISOString();
      db.prepare('INSERT INTO demo_requests VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        id,
        at,
        data.name,
        data.businessName,
        data.email,
        data.phone,
        data.industry,
        data.teamSize,
        data.challenge,
        data.purpose,
        at,
      );
    }
    res.status(201).json({
      requestId: id,
      status: 'received',
      message:
        data.purpose === 'demo'
          ? 'Your demo request has been received. A session is not booked until the team confirms it.'
          : 'Your waitlist request has been received.',
    });
  });
  // Contact data is deliberately not listed through a public or demo-role API.
  router.all('/', (_req, res) =>
    res.status(405).json({ error: 'This endpoint only accepts new requests.' }),
  );
  return router;
}
