import { describe, expect, it } from 'vitest';
import { createHistory, historyReducer } from './history';
import { makeDefaultPlan, updateGridRange, type PlannerState } from './planner';

function initial() { const plan = makeDefaultPlan(); return { plans: [plan], activePlanId: plan.id }; }
const paint = (row: number) => (state: PlannerState): PlannerState => ({ ...state, plans: state.plans.map(plan => ({ ...plan, grid: updateGridRange(plan.grid, 0, row, 1, 'a_work') })) });

describe('editing history', () => {
  it('reverses and restores a whole drag as one operation', () => {
    const start = initial();
    let history = createHistory(start);
    for (let row = 0; row < 8; row++) history = historyReducer(history, { type: 'set', update: paint(row), group: 'drag-1' });
    expect(history.past).toHaveLength(1);
    const painted = history.present;
    history = historyReducer(history, { type: 'undo' });
    expect(history.present).toEqual(start);
    history = historyReducer(history, { type: 'redo' });
    expect(history.present).toEqual(painted);
    expect(start.plans[0].grid[0][0]).toBeNull();
  });
  it('keeps separate taps separate and discards redo after a new edit', () => {
    let history = createHistory(initial());
    history = historyReducer(history, { type: 'set', update: paint(0) });
    history = historyReducer(history, { type: 'set', update: paint(1) });
    history = historyReducer(history, { type: 'undo' });
    expect(history.present.plans[0].grid[0].slice(0, 2)).toEqual(['a_work', null]);
    history = historyReducer(history, { type: 'set', update: paint(2) });
    expect(history.future).toHaveLength(0);
  });
  it('does not record selection changes or unchanged paint', () => {
    let history = createHistory(initial());
    history = historyReducer(history, { type: 'set', update: paint(0) });
    history = historyReducer(history, { type: 'set', update: paint(0) });
    history = historyReducer(history, { type: 'set', transient: true, update: state => ({ ...state, plans: state.plans.map(plan => ({ ...plan, tool: 'erase' })) }) });
    expect(history.past).toHaveLength(1);
  });
  it('restores a deleted plan and clears history at an import boundary', () => {
    const state = initial();
    const second = makeDefaultPlan('Second');
    state.plans.push(second);
    let history = createHistory(state);
    history = historyReducer(history, { type: 'set', update: { plans: [second], activePlanId: second.id } });
    history = historyReducer(history, { type: 'undo' });
    expect(history.present.plans).toHaveLength(2);
    history = historyReducer(history, { type: 'reset', state: initial() });
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
  });
  it('bounds retained history to fifty edits', () => {
    let history = createHistory(initial());
    for (let row = 0; row < 65; row++) history = historyReducer(history, { type: 'set', update: paint(row) });
    expect(history.past).toHaveLength(50);
  });
});
