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
  return Array.from({ length: 7 }, () => Array.from({ length: 288 }, () => null as string | null));
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

export function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
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
