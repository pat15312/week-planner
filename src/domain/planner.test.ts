import { describe, expect, it } from "vitest";
import {
  addPlanAndSelect,
  buildEmptyWeek,
  calculateVisibleDayCount,
  clearEndedMouseDragInteraction,
  clampDayWindowStart,
  dayWindowIndices,
  isMouseDragButtonHeld,
  moveDayWindow,
  calculateAllocationSummary,
  CELLS_PER_DAY,
  clearGridForActivity,
  formatMinutes,
  hexWithAlpha,
  iconLabel,
  deletePlanAndSelectFallback,
  duplicatePlanAndSelect,
  initialisePlannerState,
  renamePlan,
  reorderByIndex,
  safeParseJSON,
  summariseGroupedBlock,
  timeLabelForRow,
  timeRangeLabel,
  updateGridRange,
} from "./planner";

describe("planner helpers", () => {
  it("creates an empty seven-day week at five-minute resolution", () => {
    const empty = buildEmptyWeek();

    expect(empty).toHaveLength(7);
    expect(empty.every((day) => Array.isArray(day) && day.length === 288)).toBe(
      true,
    );
    expect(empty.every((day) => day.every((cell) => cell === null))).toBe(true);
  });

  it("formats row indices as time labels", () => {
    expect(timeLabelForRow(0)).toBe("00:00");
    expect(timeLabelForRow(12)).toBe("01:00");
    expect(timeLabelForRow(287)).toBe("23:55");
  });

  it("formats time ranges from five-minute rows", () => {
    expect(timeRangeLabel(0, 1)).toBe("00:00-00:05");
    expect(timeRangeLabel(0, 3)).toBe("00:00-00:15");
    expect(timeRangeLabel(0, 12)).toBe("00:00-01:00");
    expect(timeRangeLabel(285, 3)).toBe("23:45-24:00");
  });

  it("formats minute totals", () => {
    expect(formatMinutes(0)).toBe("0h 00m");
    expect(formatMinutes(65)).toBe("1h 05m");
  });

  it("adds an alpha channel to hex colours", () => {
    expect(hexWithAlpha("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("parses valid JSON and reports invalid JSON", () => {
    const parsedOk = safeParseJSON('{"a":1}');
    expect(parsedOk).toMatchObject({ ok: true, value: { a: 1 } });

    const parsedBad = safeParseJSON("{");
    expect(parsedBad.ok).toBe(false);
  });

  it("reorders arrays by index", () => {
    expect(reorderByIndex(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorderByIndex(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(reorderByIndex(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
    expect(reorderByIndex(["a", "b", "c", "d"], 1, 3)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("clamps array reorder targets and ignores invalid source indexes", () => {
    expect(reorderByIndex(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(reorderByIndex(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
    expect(reorderByIndex(["a", "b", "c"], -1, 1)).toEqual(["a", "b", "c"]);
  });

  it("clears an activity from the grid", () => {
    const grid = [
      ["x", "y"],
      ["y", null],
    ];

    expect(clearGridForActivity(grid, "y")).toEqual([
      ["x", null],
      [null, null],
    ]);
    expect(grid).toEqual([
      ["x", "y"],
      ["y", null],
    ]);
  });

  it("formats icon labels", () => {
    expect(iconLabel("briefcase")).toBe("Briefcase");
    expect(iconLabel("gamepad2")).toBe("Gamepad 2");
    expect(iconLabel("book_open")).toBe("Book Open");
  });
});

describe("planner storage initialisation", () => {
  const makePlan = (id: string) => ({
    id,
    name: id,
    activities: [],
    grid: buildEmptyWeek(),
    selectedActivityId: null,
    tool: "paint" as const,
  });

  it("restores a valid active plan that is not the first stored plan", () => {
    const first = makePlan("first-plan");
    const second = makePlan("second-plan");

    const state = initialisePlannerState(
      { version: 3, activePlanId: second.id, plans: [first, second] },
      makePlan("default-plan"),
    );

    expect(state.plans).toEqual([first, second]);
    expect(state.activePlanId).toBe(second.id);
  });

  it("falls back to the first stored plan when activePlanId is missing", () => {
    const first = makePlan("first-plan");
    const second = makePlan("second-plan");

    const state = initialisePlannerState(
      { version: 3, plans: [first, second] },
      makePlan("default-plan"),
    );

    expect(state.plans).toEqual([first, second]);
    expect(state.activePlanId).toBe(first.id);
  });

  it("falls back to the first stored plan when activePlanId does not match an existing plan", () => {
    const first = makePlan("first-plan");
    const second = makePlan("second-plan");

    const state = initialisePlannerState(
      { version: 3, activePlanId: "missing-plan", plans: [first, second] },
      makePlan("default-plan"),
    );

    expect(state.plans).toEqual([first, second]);
    expect(state.activePlanId).toBe(first.id);
  });

  it("creates and selects the default plan when stored data is absent or malformed", () => {
    const defaultPlan = makePlan("default-plan");

    expect(initialisePlannerState(null, defaultPlan)).toEqual({
      plans: [defaultPlan],
      activePlanId: defaultPlan.id,
    });
    expect(initialisePlannerState("not an object", defaultPlan)).toEqual({
      plans: [defaultPlan],
      activePlanId: defaultPlan.id,
    });
    expect(
      initialisePlannerState({ version: 3, plans: [] }, defaultPlan),
    ).toEqual({ plans: [defaultPlan], activePlanId: defaultPlan.id });
    expect(
      initialisePlannerState({ version: 3, plans: "bad" }, defaultPlan),
    ).toEqual({ plans: [defaultPlan], activePlanId: defaultPlan.id });
  });
});

describe("allocation summaries", () => {
  const makePlan = () => ({
    id: "plan-1",
    name: "Plan 1",
    activities: [
      {
        id: "activity-a",
        name: "Activity A",
        colour: "#000000",
        icon: "calendar",
      },
      { id: "activity-b", name: "Activity B", colour: "#ffffff", icon: "book" },
    ],
    grid: buildEmptyWeek(),
    selectedActivityId: "activity-a",
    tool: "paint" as const,
  });

  it("reports an empty week as 10,080 free minutes", () => {
    const summary = calculateAllocationSummary(makePlan());

    expect(summary.freeMinutes).toBe(10080);
    expect(summary.totalMinutes).toBe(10080);
    expect(summary.minutesById.get("activity-a")).toBe(0);
  });

  it("counts allocations across more than one day", () => {
    const plan = makePlan();
    plan.grid[0][0] = "activity-a";
    plan.grid[0][1] = "activity-a";
    plan.grid[2][10] = "activity-a";

    const summary = calculateAllocationSummary(plan);

    expect(summary.minutesById.get("activity-a")).toBe(15);
    expect(summary.freeMinutes).toBe(10065);
  });

  it("reports separate totals for multiple activities", () => {
    const plan = makePlan();
    plan.grid[1][0] = "activity-a";
    plan.grid[1][1] = "activity-b";
    plan.grid[1][2] = "activity-b";

    const summary = calculateAllocationSummary(plan);

    expect(summary.minutesById.get("activity-a")).toBe(5);
    expect(summary.minutesById.get("activity-b")).toBe(10);
  });

  it("does not mutate the supplied plan", () => {
    const plan = makePlan();
    plan.grid[0][0] = "activity-a";
    const before = JSON.stringify(plan);

    calculateAllocationSummary(plan);

    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe("plan operations", () => {
  const makePlan = (id: string, name = id) => ({
    id,
    name,
    activities: [
      {
        id: `${id}-activity`,
        name: `${name} activity`,
        colour: "#000000",
        icon: "calendar",
      },
    ],
    grid: buildEmptyWeek(),
    selectedActivityId: `${id}-activity`,
    tool: "paint" as const,
  });

  it("adds a plan and selects it", () => {
    const first = makePlan("first");
    const added = makePlan("added");

    expect(
      addPlanAndSelect({ plans: [first], activePlanId: first.id }, added),
    ).toEqual({ plans: [first, added], activePlanId: added.id });
  });

  it("renames only the requested plan", () => {
    const first = makePlan("first", "First");
    const second = makePlan("second", "Second");

    const state = renamePlan(
      { plans: [first, second], activePlanId: first.id },
      second.id,
      "Renamed",
    );

    expect(state.plans.map((plan) => plan.name)).toEqual(["First", "Renamed"]);
    expect(state.activePlanId).toBe(first.id);
  });

  it("duplicates a plan with the supplied identifier and name", () => {
    const first = makePlan("first", "First");
    first.grid[0][0] = first.activities[0].id;

    const state = duplicatePlanAndSelect(
      { plans: [first], activePlanId: first.id },
      first.id,
      "duplicate",
      "Duplicate",
    );

    expect(state.plans).toHaveLength(2);
    expect(state.activePlanId).toBe("duplicate");
    expect(state.plans[1]).toMatchObject({
      id: "duplicate",
      name: "Duplicate",
      selectedActivityId: first.selectedActivityId,
      tool: first.tool,
    });
    expect(state.plans[1].activities).toEqual(first.activities);
    expect(state.plans[1].grid).toEqual(first.grid);
  });

  it("creates independent duplicate grid and activity copies", () => {
    const first = makePlan("first", "First");
    const state = duplicatePlanAndSelect(
      { plans: [first], activePlanId: first.id },
      first.id,
      "duplicate",
      "Duplicate",
    );
    const duplicate = state.plans[1];

    duplicate.grid[0][0] = "changed";
    duplicate.activities[0].name = "Changed";

    expect(first.grid[0][0]).toBeNull();
    expect(first.activities[0].name).toBe("First activity");
  });

  it("deletes the active plan and selects the first remaining plan", () => {
    const first = makePlan("first");
    const second = makePlan("second");
    const third = makePlan("third");

    expect(
      deletePlanAndSelectFallback(
        { plans: [first, second, third], activePlanId: second.id },
        second.id,
      ),
    ).toEqual({
      plans: [first, third],
      activePlanId: first.id,
    });
  });

  it("prevents deletion of the final remaining plan", () => {
    const first = makePlan("first");
    const state = { plans: [first], activePlanId: first.id };

    expect(deletePlanAndSelectFallback(state, first.id)).toBe(state);
  });

  it("handles missing requested plan identifiers safely", () => {
    const first = makePlan("first");
    const state = { plans: [first], activePlanId: first.id };

    expect(renamePlan(state, "missing", "Ignored")).toBe(state);
    expect(
      duplicatePlanAndSelect(state, "missing", "duplicate", "Duplicate"),
    ).toBe(state);
    expect(deletePlanAndSelectFallback(state, "missing")).toBe(state);
  });

  it("does not mutate input state", () => {
    const first = makePlan("first", "First");
    const second = makePlan("second", "Second");
    const state = { plans: [first, second], activePlanId: first.id };
    const before = JSON.stringify(state);

    addPlanAndSelect(state, makePlan("added"));
    renamePlan(state, second.id, "Renamed");
    duplicatePlanAndSelect(state, first.id, "duplicate", "Duplicate");
    deletePlanAndSelectFallback(state, first.id);

    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("day windows", () => {
  it("calculates visible day count with a minimum of three and maximum of seven", () => {
    expect(calculateVisibleDayCount(-1)).toBe(3);
    expect(calculateVisibleDayCount(0)).toBe(3);
    expect(calculateVisibleDayCount(119)).toBe(3);
    expect(calculateVisibleDayCount(360)).toBe(3);
    expect(calculateVisibleDayCount(480)).toBe(4);
    expect(calculateVisibleDayCount(600)).toBe(5);
    expect(calculateVisibleDayCount(720)).toBe(6);
    expect(calculateVisibleDayCount(840)).toBe(7);
    expect(calculateVisibleDayCount(1200)).toBe(7);
  });

  it("falls back safely for invalid width inputs", () => {
    expect(calculateVisibleDayCount(Number.NaN)).toBe(3);
    expect(calculateVisibleDayCount(Number.POSITIVE_INFINITY)).toBe(3);
    expect(calculateVisibleDayCount(480, 0)).toBe(3);
    expect(calculateVisibleDayCount(480, Number.NaN)).toBe(3);
  });

  it("returns all valid consecutive windows for differing visible counts", () => {
    expect(Array.from({ length: 5 }, (_, start) => dayWindowIndices(start, 3))).toEqual([
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
      [4, 5, 6],
    ]);
    expect(Array.from({ length: 4 }, (_, start) => dayWindowIndices(start, 4))).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 4],
      [2, 3, 4, 5],
      [3, 4, 5, 6],
    ]);
    expect(Array.from({ length: 3 }, (_, start) => dayWindowIndices(start, 5))).toEqual([
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
    ]);
    expect(Array.from({ length: 2 }, (_, start) => dayWindowIndices(start, 6))).toEqual([
      [0, 1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5, 6],
    ]);
    expect(dayWindowIndices(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("moves previous and next by one day and clamps at Monday and Sunday", () => {
    expect(moveDayWindow(2, 4, -1)).toBe(1);
    expect(moveDayWindow(2, 4, 1)).toBe(3);
    expect(moveDayWindow(0, 4, -1)).toBe(0);
    expect(moveDayWindow(3, 4, 1)).toBe(3);
  });

  it("clamps current starts when resizing changes the visible count", () => {
    expect(clampDayWindowStart(4, 3)).toBe(4);
    expect(clampDayWindowStart(4, 4)).toBe(3);
    expect(clampDayWindowStart(4, 5)).toBe(2);
    expect(clampDayWindowStart(4, 6)).toBe(1);
    expect(clampDayWindowStart(4, 7)).toBe(0);
    expect(clampDayWindowStart(-10, 5)).toBe(0);
    expect(clampDayWindowStart(Number.NaN, 5)).toBe(0);
  });

  it("does not produce invalid day indices for unexpected inputs", () => {
    expect(dayWindowIndices(99, 99)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dayWindowIndices(99, Number.NaN)).toEqual([4, 5, 6]);
    expect(dayWindowIndices(Number.NaN, 4)).toEqual([0, 1, 2, 3]);
  });
});

describe("mouse drag button checks", () => {
  it("detects the primary mouse button", () => {
    expect(isMouseDragButtonHeld(1, "primary")).toBe(true);
    expect(isMouseDragButtonHeld(3, "primary")).toBe(true);
  });

  it("detects the secondary mouse button", () => {
    expect(isMouseDragButtonHeld(2, "secondary")).toBe(true);
    expect(isMouseDragButtonHeld(3, "secondary")).toBe(true);
  });

  it("rejects no buttons and unrelated buttons", () => {
    expect(isMouseDragButtonHeld(0, "primary")).toBe(false);
    expect(isMouseDragButtonHeld(0, "secondary")).toBe(false);
    expect(isMouseDragButtonHeld(4, "primary")).toBe(false);
    expect(isMouseDragButtonHeld(4, "secondary")).toBe(false);
  });

  it("treats invalid button state as released", () => {
    expect(isMouseDragButtonHeld(Number.NaN, "primary")).toBe(false);
    expect(isMouseDragButtonHeld(Number.POSITIVE_INFINITY, "secondary")).toBe(false);
  });

  it("clears release and cancellation for the active pointer only", () => {
    const state = { pointerId: 7 };
    expect(clearEndedMouseDragInteraction(state, { kind: "pointerend", pointerId: 7 })).toBeNull();
    expect(clearEndedMouseDragInteraction(state, { kind: "pointerend", pointerId: 8 })).toBe(state);
  });

  it("clears active mouse drags on loss of focus", () => {
    expect(clearEndedMouseDragInteraction({ pointerId: 7 }, { kind: "blur" })).toBeNull();
    expect(clearEndedMouseDragInteraction(null, { kind: "blur" })).toBeNull();
  });
});

describe("grid range updates", () => {
  it("paints one five-minute cell", () => {
    const grid = buildEmptyWeek();
    const next = updateGridRange(grid, 0, 10, 1, "activity-a");

    expect(next[0][10]).toBe("activity-a");
    expect(next[0][9]).toBeNull();
    expect(next[0][11]).toBeNull();
  });

  it("paints a three-cell 15-minute range", () => {
    const next = updateGridRange(buildEmptyWeek(), 1, 12, 3, "activity-a");

    expect(next[1].slice(12, 15)).toEqual([
      "activity-a",
      "activity-a",
      "activity-a",
    ]);
    expect(next[1][15]).toBeNull();
  });

  it("paints a 12-cell one-hour range", () => {
    const next = updateGridRange(buildEmptyWeek(), 2, 24, 12, "activity-a");

    expect(next[2].slice(24, 36)).toEqual(
      Array.from({ length: 12 }, () => "activity-a"),
    );
    expect(next[2][36]).toBeNull();
  });

  it("overwrites existing allocations", () => {
    const grid = buildEmptyWeek();
    grid[0][5] = "activity-a";
    grid[0][6] = "activity-a";

    const next = updateGridRange(grid, 0, 5, 2, "activity-b");

    expect(next[0].slice(5, 7)).toEqual(["activity-b", "activity-b"]);
  });

  it("erases a range", () => {
    const grid = buildEmptyWeek();
    grid[3][30] = "activity-a";
    grid[3][31] = "activity-a";

    const next = updateGridRange(grid, 3, 30, 2, null);

    expect(next[3].slice(30, 32)).toEqual([null, null]);
  });

  it("clamps a range at the final row of a day", () => {
    const next = updateGridRange(
      buildEmptyWeek(),
      4,
      CELLS_PER_DAY - 1,
      12,
      "activity-a",
    );

    expect(next[4][CELLS_PER_DAY - 1]).toBe("activity-a");
    expect(next[4]).toHaveLength(CELLS_PER_DAY);
  });

  it("changes only the requested day and range", () => {
    const grid = buildEmptyWeek();
    grid[0][1] = "unchanged-a";
    grid[2][1] = "unchanged-b";

    const next = updateGridRange(grid, 1, 2, 2, "activity-a");

    expect(next[0]).toEqual(grid[0]);
    expect(next[2]).toEqual(grid[2]);
    expect(next[1][1]).toBeNull();
    expect(next[1].slice(2, 4)).toEqual(["activity-a", "activity-a"]);
    expect(next[1][4]).toBeNull();
  });

  it("does not mutate the supplied grid", () => {
    const grid = buildEmptyWeek();
    grid[0][0] = "activity-a";
    const before = JSON.stringify(grid);

    const next = updateGridRange(grid, 0, 0, 3, "activity-b");

    expect(JSON.stringify(grid)).toBe(before);
    expect(next).not.toBe(grid);
    expect(next[0]).not.toBe(grid[0]);
  });
});

describe("grouped-block summaries", () => {
  it("summarises a completely free block", () => {
    expect(summariseGroupedBlock(buildEmptyWeek(), 0, 0, 3)).toEqual({
      kind: "free",
    });
  });

  it("summarises a block containing one activity throughout", () => {
    const grid = updateGridRange(buildEmptyWeek(), 0, 0, 3, "activity-a");

    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({
      kind: "single",
      activityId: "activity-a",
    });
  });

  it("summarises one activity mixed with free time", () => {
    const grid = buildEmptyWeek();
    grid[0][0] = "activity-a";
    grid[0][1] = "activity-a";

    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-a", cellCount: 2 },
        { activityId: null, cellCount: 1 },
      ],
    });
  });

  it("summarises multiple activities with correct cell counts", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(
      0,
      6,
      "activity-a",
      "activity-b",
      "activity-b",
      "activity-c",
      "activity-c",
      "activity-c",
    );

    expect(summariseGroupedBlock(grid, 0, 0, 6)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-c", cellCount: 3 },
        { activityId: "activity-b", cellCount: 2 },
        { activityId: "activity-a", cellCount: 1 },
      ],
    });
  });

  it("orders segments by descending cell count", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(
      0,
      6,
      "activity-a",
      "activity-b",
      "activity-b",
      "activity-b",
      "activity-c",
      "activity-c",
    );

    expect(summariseGroupedBlock(grid, 0, 0, 6)).toMatchObject({
      kind: "mixed",
      segments: [
        { activityId: "activity-b", cellCount: 3 },
        { activityId: "activity-c", cellCount: 2 },
        { activityId: "activity-a", cellCount: 1 },
      ],
    });
  });

  it("retains first-seen order for tied segments", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(
      0,
      6,
      "activity-b",
      "activity-a",
      "activity-c",
      "activity-a",
      "activity-c",
      "activity-b",
    );

    expect(summariseGroupedBlock(grid, 0, 0, 6)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-b", cellCount: 2 },
        { activityId: "activity-a", cellCount: 2 },
        { activityId: "activity-c", cellCount: 2 },
      ],
    });
  });

  it("orders tied activity time before free time even when free cells appear first", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(0, 2, null, "activity-a");

    expect(summariseGroupedBlock(grid, 0, 0, 2)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-a", cellCount: 1 },
        { activityId: null, cellCount: 1 },
      ],
    });
  });

  it("includes free time in mixed proportions", () => {
    const grid = buildEmptyWeek();
    grid[0][0] = "activity-a";

    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: null, cellCount: 2 },
        { activityId: "activity-a", cellCount: 1 },
      ],
    });
  });

  it("treats a block containing only empty-string cells as free", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(0, 3, "", "", "");

    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({ kind: "free" });
  });

  it("treats empty-string cells as free time in a mixed block", () => {
    const grid = buildEmptyWeek();
    grid[0].splice(0, 3, "", "activity-a", "");

    const summary = summariseGroupedBlock(grid, 0, 0, 3);

    expect(summary).toEqual({
      kind: "mixed",
      segments: [
        { activityId: null, cellCount: 2 },
        { activityId: "activity-a", cellCount: 1 },
      ],
    });
    expect(summary.kind === "mixed" && summary.segments.some((segment) => segment.activityId === "")).toBe(false);
  });

  it("retains an unknown activity identifier", () => {
    const grid = updateGridRange(buildEmptyWeek(), 0, 0, 3, "unknown-activity");

    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({
      kind: "single",
      activityId: "unknown-activity",
    });
  });

  it("operates at 1, 3 and 12-cell view sizes", () => {
    const grid = buildEmptyWeek();
    grid[0][0] = "activity-a";
    grid[0][1] = "activity-a";
    grid[0][2] = "activity-b";
    for (let row = 12; row < 24; row++)
      grid[0][row] = row < 18 ? "activity-a" : "activity-b";

    expect(summariseGroupedBlock(grid, 0, 0, 1)).toEqual({
      kind: "single",
      activityId: "activity-a",
    });
    expect(summariseGroupedBlock(grid, 0, 0, 3)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-a", cellCount: 2 },
        { activityId: "activity-b", cellCount: 1 },
      ],
    });
    expect(summariseGroupedBlock(grid, 0, 12, 12)).toEqual({
      kind: "mixed",
      segments: [
        { activityId: "activity-a", cellCount: 6 },
        { activityId: "activity-b", cellCount: 6 },
      ],
    });
  });

  it("does not mutate the supplied grid", () => {
    const grid = buildEmptyWeek();
    grid[0][0] = "activity-a";
    const before = JSON.stringify(grid);

    summariseGroupedBlock(grid, 0, 0, 3);

    expect(JSON.stringify(grid)).toBe(before);
  });
});
