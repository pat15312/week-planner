import { safeParseJSON, type Plan, type PlannerState } from "./planner";

export const STORAGE_KEY = "week_planner_5min_store_v3";
export const PRE_IMPORT_BACKUP_KEY = "week_planner_5min_pre_import_backup_v3";
export const PAYLOAD_VERSION = 3;
export const DAYS_PER_WEEK = 7;
export const CELLS_PER_DAY = 288;

type ValidationIssue = { message: string; path?: string };
export type ValidationError = { message: string; issues: ValidationIssue[] };
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ValidationError };
export type PlannerPayloadV3 = { version: 3; activePlanId: string | null; plans: Plan[] };

const hexColourPattern = /^#[0-9A-Fa-f]{6}$/;

function fail(message: string, path?: string): ValidationResult<never> {
  return { ok: false, error: { message, issues: [{ message, path }] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function planLabel(plan: Record<string, unknown>, index: number) {
  return typeof plan.name === "string" && plan.name.trim() ? `The plan '${plan.name}'` : `Plan ${index + 1}`;
}

export function validatePlannerPayloadV3(value: unknown): ValidationResult<PlannerPayloadV3> {
  if (!isRecord(value)) return fail("The imported data must be a JSON object.");
  if (value.version !== PAYLOAD_VERSION) return fail("This data is not a supported Week Planner version 3 export.", "version");
  if (!Array.isArray(value.plans) || value.plans.length === 0) return fail("The data must include at least one plan.", "plans");
  if ("activePlanId" in value && !(typeof value.activePlanId === "string" || value.activePlanId === null)) {
    return fail("The active plan identifier must be text or null.", "activePlanId");
  }

  const planIds = new Set<string>();
  const plans: Plan[] = [];

  for (let planIndex = 0; planIndex < value.plans.length; planIndex++) {
    const rawPlan = value.plans[planIndex];
    if (!isRecord(rawPlan)) return fail(`Plan ${planIndex + 1} must be an object.`, `plans[${planIndex}]`);
    const label = planLabel(rawPlan, planIndex);

    if (typeof rawPlan.id !== "string") return fail(`${label} is missing a valid plan identifier.`, `plans[${planIndex}].id`);
    if (planIds.has(rawPlan.id)) return fail(`The plan identifier '${rawPlan.id}' is used more than once.`, `plans[${planIndex}].id`);
    planIds.add(rawPlan.id);
    if (typeof rawPlan.name !== "string") return fail(`${label} is missing a valid name.`, `plans[${planIndex}].name`);
    if (!Array.isArray(rawPlan.activities)) return fail(`${label} must include an activities array.`, `plans[${planIndex}].activities`);
    if (!Array.isArray(rawPlan.grid)) return fail(`${label} must include a weekly allocation grid.`, `plans[${planIndex}].grid`);
    if (rawPlan.grid.length !== DAYS_PER_WEEK) return fail(`${label} must contain exactly 7 days.`, `plans[${planIndex}].grid`);
    if (!(rawPlan.tool === "paint" || rawPlan.tool === "erase")) return fail(`${label} has an invalid tool.`, `plans[${planIndex}].tool`);

    const activityIds = new Set<string>();
    const activities = [] as Plan["activities"];
    for (let activityIndex = 0; activityIndex < rawPlan.activities.length; activityIndex++) {
      const rawActivity = rawPlan.activities[activityIndex];
      if (!isRecord(rawActivity)) return fail(`${label} contains an invalid activity.`, `plans[${planIndex}].activities[${activityIndex}]`);
      if (typeof rawActivity.id !== "string") return fail(`${label} contains an activity without a valid identifier.`, `plans[${planIndex}].activities[${activityIndex}].id`);
      if (activityIds.has(rawActivity.id)) return fail(`${label} uses the activity identifier '${rawActivity.id}' more than once.`, `plans[${planIndex}].activities[${activityIndex}].id`);
      if (typeof rawActivity.name !== "string") return fail(`${label} contains an activity without a valid name.`, `plans[${planIndex}].activities[${activityIndex}].name`);
      if (typeof rawActivity.colour !== "string" || !hexColourPattern.test(rawActivity.colour)) return fail(`${label} contains an activity with an invalid six-digit hex colour.`, `plans[${planIndex}].activities[${activityIndex}].colour`);
      if (typeof rawActivity.icon !== "string") return fail(`${label} contains an activity without a valid icon.`, `plans[${planIndex}].activities[${activityIndex}].icon`);
      activityIds.add(rawActivity.id);
      activities.push({ id: rawActivity.id, name: rawActivity.name, colour: rawActivity.colour, icon: rawActivity.icon });
    }

    if (!(typeof rawPlan.selectedActivityId === "string" || rawPlan.selectedActivityId === null)) return fail(`${label} has an invalid selected activity.`, `plans[${planIndex}].selectedActivityId`);
    if (rawPlan.selectedActivityId !== null && !activityIds.has(rawPlan.selectedActivityId)) return fail(`${label} selects an activity that does not exist.`, `plans[${planIndex}].selectedActivityId`);
    if (activities.length === 0 && rawPlan.selectedActivityId !== null) return fail(`${label} has no activities, so the selected activity must be empty.`, `plans[${planIndex}].selectedActivityId`);

    const grid: Plan["grid"] = [];
    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex++) {
      const rawDay = rawPlan.grid[dayIndex];
      if (!Array.isArray(rawDay)) return fail(`${label} has an invalid day in its allocation grid.`, `plans[${planIndex}].grid[${dayIndex}]`);
      if (rawDay.length !== CELLS_PER_DAY) return fail(`${label} must contain exactly 288 five-minute cells for each day.`, `plans[${planIndex}].grid[${dayIndex}]`);
      const day: (string | null)[] = [];
      for (let cellIndex = 0; cellIndex < CELLS_PER_DAY; cellIndex++) {
        const cell = rawDay[cellIndex];
        if (!(typeof cell === "string" || cell === null)) return fail(`${label} contains an allocation cell that is not text or empty.`, `plans[${planIndex}].grid[${dayIndex}][${cellIndex}]`);
        if (cell !== null && !activityIds.has(cell)) return fail(`${label} contains an allocation for an activity that does not exist.`, `plans[${planIndex}].grid[${dayIndex}][${cellIndex}]`);
        day.push(cell);
      }
      grid.push(day);
    }

    plans.push({ id: rawPlan.id, name: rawPlan.name, activities, grid, selectedActivityId: rawPlan.selectedActivityId, tool: rawPlan.tool });
  }

  const activePlanId = typeof value.activePlanId === "string" && plans.some((plan) => plan.id === value.activePlanId) ? value.activePlanId : plans[0].id;
  return { ok: true, value: { version: PAYLOAD_VERSION, activePlanId, plans } };
}

export function parsePlannerPayloadJSON(text: string): ValidationResult<PlannerPayloadV3> {
  const parsed = safeParseJSON(text);
  if (!parsed.ok) return fail("The JSON could not be read. Check for missing commas, brackets or quotes.");
  return validatePlannerPayloadV3(parsed.value);
}

export function createPlannerPayload(plans: Plan[], activePlanId: string | null): PlannerPayloadV3 {
  return { version: PAYLOAD_VERSION, activePlanId: activePlanId && plans.some((plan) => plan.id === activePlanId) ? activePlanId : plans[0]?.id ?? null, plans };
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StartupResult =
  | { status: "ready"; state: PlannerState; warning: string | null; autoPersistenceEnabled: boolean }
  | { status: "recovery"; originalText: string; error: string; state: PlannerState; warning: string | null; autoPersistenceEnabled: boolean };

export function loadStartupState(storage: StorageLike, defaultPlan: Plan): StartupResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: "ready", state: { plans: [defaultPlan], activePlanId: defaultPlan.id }, warning: "Browser storage could not be read. Changes may not be saved.", autoPersistenceEnabled: false };
  }
  if (raw === null) return { status: "ready", state: { plans: [defaultPlan], activePlanId: defaultPlan.id }, warning: null, autoPersistenceEnabled: true };
  const validated = parsePlannerPayloadJSON(raw);
  if (!validated.ok) {
    return { status: "recovery", originalText: raw, error: validated.error.message, state: { plans: [defaultPlan], activePlanId: defaultPlan.id }, warning: null, autoPersistenceEnabled: false };
  }
  return { status: "ready", state: { plans: validated.value.plans, activePlanId: validated.value.activePlanId }, warning: null, autoPersistenceEnabled: true };
}

export function savePayload(storage: StorageLike, key: string, payload: PlannerPayloadV3): ValidationResult<void> {
  try {
    storage.setItem(key, JSON.stringify(payload));
    const verified = storage.getItem(key);
    if (verified !== JSON.stringify(payload)) return fail("Browser storage did not confirm the saved data.");
    return { ok: true, value: undefined };
  } catch {
    return fail("Browser storage could not save the data.");
  }
}

export function applyValidatedImport(storage: StorageLike, currentPayload: PlannerPayloadV3, importText: string): ValidationResult<PlannerPayloadV3> {
  const imported = parsePlannerPayloadJSON(importText);
  if (!imported.ok) return imported;
  const backup = savePayload(storage, PRE_IMPORT_BACKUP_KEY, currentPayload);
  if (!backup.ok) return fail("The import was cancelled because Week Planner could not save a pre-import backup.");
  const saved = savePayload(storage, STORAGE_KEY, imported.value);
  if (!saved.ok) return fail("The import was cancelled because Week Planner could not save the imported plans.");
  return imported;
}

export function applyRecoveryReplacement(storage: StorageLike, replacementText: string): ValidationResult<PlannerPayloadV3> {
  const replacement = parsePlannerPayloadJSON(replacementText);
  if (!replacement.ok) return replacement;
  const saved = savePayload(storage, STORAGE_KEY, replacement.value);
  if (!saved.ok) return fail("The replacement plans were valid, but Week Planner could not save them.");
  return replacement;
}

export function restoreBackup(storage: StorageLike): ValidationResult<PlannerPayloadV3> {
  let raw: string | null;
  try {
    raw = storage.getItem(PRE_IMPORT_BACKUP_KEY);
  } catch {
    return fail("The previous plans could not be read from browser storage.");
  }
  if (raw === null) return fail("There is no pre-import backup to restore.");
  const backup = parsePlannerPayloadJSON(raw);
  if (!backup.ok) return fail(`The previous plans could not be restored. ${backup.error.message}`);
  const saved = savePayload(storage, STORAGE_KEY, backup.value);
  if (!saved.ok) return fail("The previous plans were valid, but Week Planner could not save them.");
  try { storage.removeItem(PRE_IMPORT_BACKUP_KEY); } catch { /* safe to ignore after restore */ }
  return backup;
}

export function resetAfterRecovery(storage: StorageLike, payload: PlannerPayloadV3): ValidationResult<void> {
  return savePayload(storage, STORAGE_KEY, payload);
}
