// Repeatable domain benchmark. No user plans or browser storage are accessed.
import { makeDefaultPlan, updateGridRange } from '../src/domain/planner.ts';
import { createHistory, historyReducer } from '../src/domain/history.ts';

const plans = Array.from({ length: 50 }, (_, index) => {
  const plan = makeDefaultPlan(`Synthetic plan ${index}`);
  plan.id = `plan-${index}`;
  plan.activities = Array.from({ length: 100 }, (_, i) => ({ id: `a-${i}`, name: `Activity ${i}`, colour: '#8B5CF6', icon: 'calendar' }));
  plan.selectedActivityId = 'a-0';
  plan.grid = plan.grid.map(day => day.map((_, row) => `a-${row % 100}`));
  return plan;
});
let history = createHistory({ plans, activePlanId: plans[0].id });
const samples = [];
for (let i = 0; i < 120; i++) {
  const update = state => ({ ...state, plans: state.plans.map((plan, index) => index ? plan : { ...plan, grid: updateGridRange(plan.grid, 0, i % 288, 1, null) }) });
  const start = performance.now();
  history = historyReducer(history, { type: 'set', update });
  if (i >= 20) samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ node: process.version, plans: 50, activitiesPerPlan: 100, cellsPerPlan: 2016, payloadBytes: Buffer.byteLength(JSON.stringify(plans)), measuredEdits: samples.length, medianMs: samples[50], p95Ms: samples[95], historyEntries: history.past.length }, null, 2));
