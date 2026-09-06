import type { PlannerState } from './planner';

export type History = { present: PlannerState; past: PlannerState[]; future: PlannerState[]; group: string | null };
export type HistoryAction =
  | { type: 'set'; update: PlannerState | ((state: PlannerState) => PlannerState); group?: string | null; transient?: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; state: PlannerState };

export function createHistory(present: PlannerState): History {
  return { present, past: [], future: [], group: null };
}

export function historyReducer(history: History, action: HistoryAction): History {
  if (action.type === 'reset') return createHistory(action.state);
  if (action.type === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future], group: null } : history;
  }
  if (action.type === 'redo') {
    const next = history.future[0];
    return next ? { present: next, past: [...history.past, history.present].slice(-50), future: history.future.slice(1), group: null } : history;
  }
  const present = typeof action.update === 'function' ? action.update(history.present) : action.update;
  if (JSON.stringify(present) === JSON.stringify(history.present)) return history;
  if (action.transient) return { ...history, present, group: null };
  const sameGesture = action.group != null && action.group === history.group;
  return {
    present,
    past: sameGesture ? history.past : [...history.past, history.present].slice(-50),
    future: [],
    group: action.group ?? null,
  };
}
