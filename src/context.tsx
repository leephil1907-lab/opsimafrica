import { createContext, useContext } from 'react';
import type { AppData, Page, Scenario, ToastFunction } from './types';
export interface OpsContext {
  data: AppData;
  days: number;
  setDays: (days: number) => void;
  page: Page;
  navigate: (page: Page) => void;
  refresh: () => Promise<void>;
  openScenario: (scenario: Scenario, memberId?: string) => void;
  viewSession: (id: string) => void;
  toast: ToastFunction;
  customize: (id: string) => void;
  templateId: string;
  assign: (memberId?: string) => void;
}
export const Context = createContext<OpsContext | null>(null);
export function useOps() {
  const value = useContext(Context);
  if (!value) throw new Error('OpsSim context is missing.');
  return value;
}
