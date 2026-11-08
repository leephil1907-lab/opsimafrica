import type { Session } from '../types';
export type BrightZone = 'health' | 'grocery' | 'quarantine';
export type BrightCondition = 'Good' | 'Damaged' | 'Expired' | 'Mismatch';
export interface BrightConfig {
  variant: 'standard' | 'harder';
  targetSeconds: 300 | 360 | 600 | 900;
  focus: 'complete' | 'exceptions' | 'recording';
}
export interface BrightItem {
  id: string;
  name: string;
  sku: string;
  printedSku: string;
  category: 'health' | 'grocery';
  condition: string;
  expiry: string;
  batch: string;
  expectedUnits: number;
  actualUnits: number;
}
export interface ItemRecord {
  receivedUnits: number;
  condition: BrightCondition;
  disposition: 'accept' | 'quarantine' | 'return';
  note: string;
  at?: string;
}
export interface Dimension {
  points: number;
  max: number;
  checks: { name: string; points: number; max: number }[];
  deductions: number;
}
export interface Scorecard {
  total: number;
  band: string;
  bandMessage: string;
  dimensions: {
    accuracy: Dimension;
    exceptions: Dimension;
    process: Dimension;
    efficiency: Dimension;
  };
}
export interface BrightRun extends Session {
  engine: 'brightmart-v2';
  engineVersion: number;
  config: BrightConfig;
  manifest: {
    business: string;
    role: string;
    deliveryId: string;
    supplier: string;
    inspectionDate: string;
    items: BrightItem[];
    expectedCartons: number;
    deliveredCartons: number;
    expectedUnits: number;
    actualUnits: number;
    invoice: { id: string; sku: string; name: string; category: string; expectedUnits: number }[];
    instructions: string[];
  };
  inspected: string[];
  labels: string[];
  records: Record<string, ItemRecord>;
  placements: Record<string, { zone: BrightZone; at: string }>;
  events: {
    type: string;
    itemId: string | null;
    zone: BrightZone | null;
    correct: boolean;
    failure: string | null;
    message: string;
    at: string;
  }[];
  version: number;
  started: boolean;
  paused: boolean;
  noteRead: boolean;
  noteBeforeHandling: boolean;
  reviewToken: string | null;
  totals: {
    acceptedCartons: number;
    quarantinedCartons: number;
    receivedUnits: number;
    acceptedUnits: number;
    quarantinedUnits: number;
    shortageUnits: number;
    overageUnits: number;
  };
  exceptionsCaught: number;
  exceptionsTotal: number;
  physicalExceptionsCaught: number;
  physicalExceptionsTotal: number;
  quantityExceptionsCaught: number;
  quantityExceptionsTotal: number;
  scorecard: Scorecard | null;
  coaching: string[];
  previous: { score: number; completedAt: string; elapsedSeconds: number } | null;
  noteOptions: string[];
  conditionOptions: BrightCondition[];
}
export interface BrightAssignment {
  id: string;
  memberId: string;
  dueDate: string;
  status: string;
  config: BrightConfig;
}
export interface BrightBootstrap {
  defaults: BrightConfig;
  notes: string[];
  conditions: BrightCondition[];
  failures: Record<string, number>;
  runs: Session[];
  assignments: BrightAssignment[];
}
export type BrightPhase =
  | 'profile'
  | 'briefing'
  | 'note'
  | 'active'
  | 'record'
  | 'sort'
  | 'summary'
  | 'review'
  | 'scorecard'
  | 'manager'
  | 'trainer'
  | 'guide'
  | 'comfort'
  | 'keyboard'
  | 'invite';
