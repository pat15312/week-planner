export type ToolMode = "paint" | "erase";

export type Activity = {
  id: string;
  name: string;
  colour: string;
  icon: string;
};

export type WeekGrid = (string | null)[][];

export type Plan = {
  id: string;
  name: string;
  activities: Activity[];
  grid: WeekGrid;
  selectedActivityId: string | null;
  tool: ToolMode;
};

export const DAYS_PER_WEEK = 7;
export const CELLS_PER_DAY = 288;
export const MINUTES_PER_CELL = 5;
export const WEEK_TOTAL_MINUTES = DAYS_PER_WEEK * CELLS_PER_DAY * MINUTES_PER_CELL;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function timeLabelForRow(rowIndex: number) {
  const totalMins = rowIndex * 5;
  const hh = Math.floor(totalMins / 60);
  const mm = totalMins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function timeRangeLabel(startRow: number, numRows: number) {
  const startMins = startRow * 5;
  const endMins = (startRow + numRows) * 5;
  const startHH = Math.floor(startMins / 60);
  const startMM = startMins % 60;
  const endHH = Math.floor(endMins / 60);
  const endMM = endMins % 60;
  return `${String(startHH).padStart(2, "0")}:${String(startMM).padStart(2, "0")}-${String(endHH).padStart(2, "0")}:${String(endMM).padStart(2, "0")}`;
}

export function buildEmptyWeek(): WeekGrid {
  return Array.from({ length: DAYS_PER_WEEK }, () => Array.from({ length: CELLS_PER_DAY }, () => null as string | null));
}

export function safeParseJSON(s: string) {
  try {
    return { ok: true as const, value: JSON.parse(s) as unknown };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
}

export function iconLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/(\d+)/g, " $1")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function hexWithAlpha(hex: string, alpha = 0.16) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function clearGridForActivity(grid: WeekGrid, activityId: string) {
  return grid.map((col) => col.map((cell) => (cell === activityId ? null : cell)));
}

export function reorderByIndex<T>(list: T[], fromIndex: number, toIndex: number) {
  if (!Array.isArray(list)) return list;
  const n = list.length;
  if (fromIndex < 0 || fromIndex >= n) return list;
  if (toIndex < 0) toIndex = 0;
  if (toIndex >= n) toIndex = n - 1;
  if (fromIndex === toIndex) return list;

  const next = list.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export type PlannerState = {
  plans: Plan[];
  activePlanId: string | null;
};

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function initialisePlannerState(storedValue: unknown, defaultPlan: Plan): PlannerState {
  if (isObjectRecord(storedValue) && Array.isArray(storedValue.plans) && storedValue.plans.length > 0) {
    const plans = storedValue.plans as Plan[];
    const storedActivePlanId = storedValue.activePlanId;
    const activePlanId =
      typeof storedActivePlanId === "string" && plans.some((plan) => plan.id === storedActivePlanId)
        ? storedActivePlanId
        : plans[0]?.id ?? null;

    return { plans, activePlanId };
  }

  return { plans: [defaultPlan], activePlanId: defaultPlan.id };
}

export type AllocationSummary = {
  minutesById: Map<string, number>;
  freeMinutes: number;
  totalMinutes: number;
};

export function calculateAllocationSummary(plan: Pick<Plan, "activities" | "grid">): AllocationSummary {
  const counts = new Map<string, number>();
  let freeCells = 0;

  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    const col = plan.grid?.[day] ?? [];
    for (let row = 0; row < CELLS_PER_DAY; row++) {
      const v = col[row] ?? null;
      if (!v) {
        freeCells++;
        continue;
      }
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }

  const minutesById = new Map<string, number>();
  for (const activity of plan.activities) {
    const cells = counts.get(activity.id) ?? 0;
    minutesById.set(activity.id, cells * MINUTES_PER_CELL);
  }

  return {
    minutesById,
    freeMinutes: freeCells * MINUTES_PER_CELL,
    totalMinutes: WEEK_TOTAL_MINUTES,
  };
}

export function addPlanAndSelect(state: PlannerState, plan: Plan): PlannerState {
  return { plans: [...state.plans, plan], activePlanId: plan.id };
}

export function renamePlan(state: PlannerState, planId: string, name: string): PlannerState {
  if (!state.plans.some((plan) => plan.id === planId)) return state;

  return {
    ...state,
    plans: state.plans.map((plan) => (plan.id === planId ? { ...plan, name } : plan)),
  };
}

export function duplicatePlanAndSelect(state: PlannerState, targetPlanId: string, newPlanId: string, newName: string): PlannerState {
  const targetPlan = state.plans.find((plan) => plan.id === targetPlanId);
  if (!targetPlan) return state;

  const duplicate: Plan = {
    ...targetPlan,
    id: newPlanId,
    name: newName,
    activities: targetPlan.activities.map((activity) => ({ ...activity })),
    grid: targetPlan.grid.map((day) => day.slice()),
  };

  return { plans: [...state.plans, duplicate], activePlanId: duplicate.id };
}

export function deletePlanAndSelectFallback(state: PlannerState, planId: string): PlannerState {
  if (state.plans.length <= 1) return state;
  if (!state.plans.some((plan) => plan.id === planId)) return state;

  const remaining = state.plans.filter((plan) => plan.id !== planId);
  return {
    plans: remaining,
    activePlanId: state.activePlanId === planId ? (remaining[0]?.id ?? null) : state.activePlanId,
  };
}

export function makeDefaultPlan(name = "Default"): Plan {
  return {
    id: `p_${uid()}`,
    name,
    activities: [
      { id: "a_work", name: "Work", colour: "#E11D48", icon: "briefcase" },
      { id: "a_family", name: "Family", colour: "#0EA5E9", icon: "users" },
      { id: "a_sleep", name: "Sleep", colour: "#64748B", icon: "bed" },
      { id: "a_admin", name: "Admin", colour: "#22C55E", icon: "laptop" },
    ],
    grid: buildEmptyWeek(),
    selectedActivityId: "a_work",
    tool: "paint",
  };
}
