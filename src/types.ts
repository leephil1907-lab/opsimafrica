export type Page =
  'brightmart' | 'receiving' | 'overview' | 'library' | 'team' | 'reports' | 'builder' | 'settings';
export type ScenarioColor = 'sage' | 'sand' | 'lavender' | 'peach';
export interface TaskOption {
  value: string;
  label: string;
}
export interface Task {
  id: string;
  title: string;
  instruction: string;
  type: 'object' | 'choice' | 'number';
  options?: TaskOption[];
  unit?: string;
  hint: string;
  explanation: string;
  answer?: string;
}
export interface Scenario {
  id: string;
  engine?: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  industry: string;
  difficulty: string;
  duration: number;
  color: ScenarioColor;
  icon: string;
  skills: string[];
  scene: 'receiving' | 'picking' | 'cash' | 'safety';
  briefing: string;
  document: { label: string; value: string }[];
  steps: Task[];
  custom?: boolean;
}
export interface Member {
  id: string;
  name: string;
  role: string;
  color: string;
}
export interface SessionAction {
  stepId: string;
  stepTitle: string;
  answer: string;
  correct: boolean;
  at: string;
  explanation: string;
}
export interface Session {
  id: string;
  engine?: string;
  scenarioId: string;
  memberId: string;
  memberName: string;
  memberColor: string;
  scenarioTitle: string;
  category: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt: string | null;
  elapsedSeconds: number;
  score: number | null;
  accuracy: number | null;
  errors: number;
  stepIndex: number;
  totalSteps: number;
  duration: number;
  actions: SessionAction[];
  demo: boolean;
  scenario?: Scenario;
  currentTask?: Task | null;
}
export interface ActiveSession extends Session {
  scenario: Scenario;
  currentTask: Task | null;
}
export interface Assignment {
  id: string;
  memberId: string;
  scenarioId: string;
  dueDate: string;
  status: string;
}
export interface Settings {
  workspaceName: string;
  managerName: string;
  currency: string;
  sound: boolean;
  reduceMotion: boolean;
}
export interface AppData {
  settings: Settings;
  scenarios: Scenario[];
  members: Member[];
  sessions: Session[];
  assignments: Assignment[];
}
export type ToastFunction = (message: string, type?: 'success' | 'error') => void;
