import { useCallback, useReducer, useRef } from 'react';
import type { PlannerState } from '../domain/planner';
import { createHistory, historyReducer } from '../domain/history';

export function usePlannerHistory(initial: PlannerState) {
  const [history, dispatch] = useReducer(historyReducer, initial, createHistory);
  const group = useRef<string | null>(null);
  const sequence = useRef(0);
  const beginGesture = useCallback(() => { group.current = String(++sequence.current); }, []);
  const endGesture = useCallback(() => { group.current = null; }, []);
  const setState = useCallback((update: PlannerState | ((state: PlannerState) => PlannerState), transient = false) => {
    dispatch({ type: 'set', update, group: group.current, transient });
  }, []);
  const undo = useCallback(() => { group.current = null; dispatch({ type: 'undo' }); }, []);
  const redo = useCallback(() => { group.current = null; dispatch({ type: 'redo' }); }, []);
  const reset = useCallback((state: PlannerState) => { group.current = null; dispatch({ type: 'reset', state }); }, []);
  return { state: history.present, setState, reset, beginGesture, endGesture, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
