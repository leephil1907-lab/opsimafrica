import type { Session } from '../types';
export const LAB_ID = 'retail-receiving-lab';
export type Zone = 'dry' | 'cold' | 'quarantine';
export type Reason = 'none' | 'damage' | 'expiry' | 'label';
export type AccessRole = 'trainee' | 'manager' | 'trainer';
export type Phase =
  | 'profile'
  | 'briefing'
  | 'active'
  | 'record'
  | 'scorecard'
  | 'manager'
  | 'guide'
  | 'keyboard'
  | 'invite';
export interface LabConfig {
  variant: 'standard' | 'harder';
  targetSeconds: number;
  businessType: string;
  jobRole: string;
  focus: 'complete' | 'exceptions' | 'recording';
}
export interface Carton {
  id: string;
  name: string;
  sku: string;
  printedSku: string;
  storage: 'dry' | 'cold';
  condition: string;
  expiry: string;
}
export interface Manifest {
  items: Carton[];
  invoice: { sku: string; name: string; expected: number }[];
  deliveryId: string;
  supplier: string;
  inspectionDate: string;
  expected: number;
  delivered: number;
}
export interface LabEvent {
  type: 'inspect' | 'place' | 'submit';
  itemId: string | null;
  zone: Zone | null;
  reason: Reason | null;
  correct: boolean;
  failure: string | null;
  message: string;
  at: string;
}
export interface ReceivingRecord {
  accepted: number;
  quarantined: number;
  shortfall: number;
}
export interface LabRun extends Session {
  engine: 'receiving-lab';
  config: LabConfig;
  manifest: Manifest;
  inspected: string[];
  placements: Record<string, { zone: Zone; reason: Reason; at: string }>;
  record: ReceivingRecord | null;
  events: LabEvent[];
  version: number;
  paused: boolean;
  exceptionsCaught: number;
  exceptionsTotal: number;
  firstPassExceptions: number;
  recommendations: string[];
  previous: { score: number; accuracy: number; elapsedSeconds: number; completedAt: string } | null;
}
export interface LabAssignment {
  id: string;
  memberId: string;
  dueDate: string;
  status: string;
  config: LabConfig;
}
export interface LabBootstrap {
  workspaceName: string;
  inviteCode: string;
  defaults: LabConfig;
  roles: string[];
  businessTypes: string[];
  runs: Session[];
  failures: Record<string, number>;
  assignments: LabAssignment[];
}
export interface BoardButton {
  id: string;
  label: string;
  style?: 'primary' | 'warning' | 'active' | 'subtle';
  disabled?: boolean;
}
export interface BoardView {
  phase: Phase;
  title: string;
  eyebrow: string;
  lines: string[];
  fullLines?: string[];
  buttons: BoardButton[];
  columns?: number;
  feedback?: { correct: boolean; message: string } | null;
  paused?: boolean;
  busy?: boolean;
  clock?: string;
}
export interface SceneState {
  view: BoardView;
  run: LabRun | null;
  selectedId: string | null;
  reason: Reason;
  interactive: boolean;
}
export interface LabSceneHandle {
  bringCloser: () => void;
  enter: (mode: 'immersive-vr' | 'immersive-ar') => Promise<void>;
  exit: () => Promise<void>;
  reset: () => void;
}
export type SceneAction = (id: string) => void;
