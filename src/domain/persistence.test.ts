import { describe, expect, it } from "vitest";
import { buildEmptyWeek, makeDefaultPlan, type Plan } from "./planner";
import {
  PRE_IMPORT_BACKUP_KEY,
  STORAGE_KEY,
  applyValidatedImport,
  createPlannerPayload,
  loadStartupState,
  parsePlannerPayloadJSON,
  resetAfterRecovery,
  restoreBackup,
  validatePlannerPayloadV3,
  type PlannerPayloadV3,
  type StorageLike,
} from "./persistence";

function makePlan(id: string, name: string): Plan {
  const plan = makeDefaultPlan(name);
  return { ...plan, id };
}

function validPayload(): PlannerPayloadV3 {
  const first = makePlan("plan-one", "Working Week");
  const second = makePlan("plan-two", "Quiet Week");
  second.grid[0][0] = "a_sleep";
  return { version: 3, activePlanId: "plan-two", plans: [first, second] };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function memoryStorage(options: { failRead?: boolean; failWrite?: boolean } = {}): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key: string) {
      if (options.failRead) throw new Error("read failed");
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.failWrite) throw new Error("write failed");
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("validatePlannerPayloadV3", () => {
  it("accepts a valid payload with two plans and a non-first active plan", () => {
    const result = validatePlannerPayloadV3(validPayload());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.activePlanId).toBe("plan-two");
  });

  it("falls back to the first plan when the active plan is missing or unmatched", () => {
    const missing = validatePlannerPayloadV3({ ...validPayload(), activePlanId: null });
    const unmatched = validatePlannerPayloadV3({ ...validPayload(), activePlanId: "missing" });
    expect(missing.ok && missing.value.activePlanId).toBe("plan-one");
    expect(unmatched.ok && unmatched.value.activePlanId).toBe("plan-one");
  });

  it("reports malformed JSON", () => {
    const result = parsePlannerPayloadJSON("{");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("JSON could not be read");
  });

  it("rejects missing or unsupported versions", () => {
    expect(validatePlannerPayloadV3({ plans: [] }).ok).toBe(false);
    expect(validatePlannerPayloadV3({ ...validPayload(), version: 2 }).ok).toBe(false);
  });

  it("rejects duplicate plan identifiers", () => {
    const payload = validPayload();
    payload.plans[1].id = payload.plans[0].id;
    expect(validatePlannerPayloadV3(payload).ok).toBe(false);
  });

  it("rejects duplicate activity identifiers", () => {
    const payload = validPayload();
    payload.plans[0].activities[1].id = payload.plans[0].activities[0].id;
    expect(validatePlannerPayloadV3(payload).ok).toBe(false);
  });

  it("rejects invalid plan, activity and tool fields", () => {
    expect(validatePlannerPayloadV3({ ...validPayload(), plans: [{ ...validPayload().plans[0], name: 1 }] }).ok).toBe(false);
    const badActivity = validPayload();
    badActivity.plans[0].activities[0].colour = "red";
    expect(validatePlannerPayloadV3(badActivity).ok).toBe(false);
    expect(validatePlannerPayloadV3({ ...validPayload(), plans: [{ ...validPayload().plans[0], tool: "fill" }] }).ok).toBe(false);
  });

  it("rejects incorrect grid dimensions", () => {
    const badDays = validPayload();
    badDays.plans[0].grid = badDays.plans[0].grid.slice(0, 6);
    expect(validatePlannerPayloadV3(badDays).ok).toBe(false);
    const badCells = validPayload();
    badCells.plans[0].grid[0] = badCells.plans[0].grid[0].slice(0, 287);
    expect(validatePlannerPayloadV3(badCells).ok).toBe(false);
  });

  it("rejects invalid grid-cell values and missing activity references", () => {
    const invalidCell = validPayload();
    (invalidCell.plans[0].grid[0] as unknown[])[0] = 5;
    expect(validatePlannerPayloadV3(invalidCell).ok).toBe(false);
    const missingActivity = validPayload();
    missingActivity.plans[0].grid[0][0] = "missing";
    expect(validatePlannerPayloadV3(missingActivity).ok).toBe(false);
  });

  it("rejects invalid selectedActivityId", () => {
    const payload = validPayload();
    payload.plans[0].selectedActivityId = "missing";
    expect(validatePlannerPayloadV3(payload).ok).toBe(false);
  });

  it("accepts a valid plan with no activities when the grid and selection are empty", () => {
    const emptyPlan: Plan = { id: "empty", name: "Empty", activities: [], grid: buildEmptyWeek(), selectedActivityId: null, tool: "paint" };
    expect(validatePlannerPayloadV3({ version: 3, activePlanId: "empty", plans: [emptyPlan] }).ok).toBe(true);
  });
});

describe("storage safety operations", () => {
  it("invalid import leaves current state untouched and does not create a backup", () => {
    const storage = memoryStorage();
    const current = validPayload();
    const result = applyValidatedImport(storage, current, "{");
    expect(result.ok).toBe(false);
    expect(storage.values.has(PRE_IMPORT_BACKUP_KEY)).toBe(false);
    expect(current.activePlanId).toBe("plan-two");
  });

  it("successful import creates a backup before replacement", () => {
    const storage = memoryStorage();
    const current = validPayload();
    const next = { ...clone(validPayload()), activePlanId: "plan-one" };
    const result = applyValidatedImport(storage, current, JSON.stringify(next));
    expect(result.ok).toBe(true);
    expect(parsePlannerPayloadJSON(storage.values.get(PRE_IMPORT_BACKUP_KEY) ?? "").ok).toBe(true);
    expect(parsePlannerPayloadJSON(storage.values.get(STORAGE_KEY) ?? "").ok).toBe(true);
  });

  it("backup-write failure prevents import", () => {
    const storage = memoryStorage({ failWrite: true });
    const result = applyValidatedImport(storage, validPayload(), JSON.stringify(validPayload()));
    expect(result.ok).toBe(false);
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  it("restores a valid backup", () => {
    const storage = memoryStorage();
    storage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(validPayload()));
    const result = restoreBackup(storage);
    expect(result.ok).toBe(true);
    expect(storage.values.has(PRE_IMPORT_BACKUP_KEY)).toBe(false);
    expect(parsePlannerPayloadJSON(storage.values.get(STORAGE_KEY) ?? "").ok).toBe(true);
  });

  it("invalid backup restoration leaves current state untouched", () => {
    const storage = memoryStorage();
    const current = createPlannerPayload([makePlan("current", "Current")], "current");
    storage.setItem(STORAGE_KEY, JSON.stringify(current));
    storage.setItem(PRE_IMPORT_BACKUP_KEY, "not json");
    const result = restoreBackup(storage);
    expect(result.ok).toBe(false);
    expect(parsePlannerPayloadJSON(storage.values.get(STORAGE_KEY) ?? "").ok).toBe(true);
  });

  it("invalid startup data enters recovery without overwriting the original value", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "not json");
    const result = loadStartupState(storage, makeDefaultPlan("Default"));
    expect(result.status).toBe("recovery");
    expect(storage.values.get(STORAGE_KEY)).toBe("not json");
  });

  it("explicit reset is required before invalid stored data is replaced", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "not json");
    loadStartupState(storage, makeDefaultPlan("Default"));
    expect(storage.values.get(STORAGE_KEY)).toBe("not json");
    const replacement = createPlannerPayload([makePlan("reset", "Reset")], "reset");
    expect(resetAfterRecovery(storage, replacement).ok).toBe(true);
    expect(parsePlannerPayloadJSON(storage.values.get(STORAGE_KEY) ?? "").ok).toBe(true);
  });

  it("storage read and write failures produce safe outcomes", () => {
    expect(loadStartupState(memoryStorage({ failRead: true }), makeDefaultPlan("Default")).warning).toContain("could not be read");
    expect(applyValidatedImport(memoryStorage({ failWrite: true }), validPayload(), JSON.stringify(validPayload())).ok).toBe(false);
  });
});
