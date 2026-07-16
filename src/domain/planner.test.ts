import { describe, expect, it } from "vitest";
import {
  buildEmptyWeek,
  clearGridForActivity,
  formatMinutes,
  hexWithAlpha,
  iconLabel,
  reorderByIndex,
  safeParseJSON,
  timeLabelForRow,
  timeRangeLabel,
} from "./planner";

describe("planner helpers", () => {
  it("creates an empty seven-day week at five-minute resolution", () => {
    const empty = buildEmptyWeek();

    expect(empty).toHaveLength(7);
    expect(empty.every((day) => Array.isArray(day) && day.length === 288)).toBe(true);
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
    expect(reorderByIndex(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("clamps array reorder targets and ignores invalid source indexes", () => {
    expect(reorderByIndex(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(reorderByIndex(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
    expect(reorderByIndex(["a", "b", "c"], -1, 1)).toEqual(["a", "b", "c"]);
  });

  it("clears an activity from the grid", () => {
    const grid = [["x", "y"], ["y", null]];

    expect(clearGridForActivity(grid, "y")).toEqual([["x", null], [null, null]]);
    expect(grid).toEqual([["x", "y"], ["y", null]]);
  });

  it("formats icon labels", () => {
    expect(iconLabel("briefcase")).toBe("Briefcase");
    expect(iconLabel("gamepad2")).toBe("Gamepad 2");
    expect(iconLabel("book_open")).toBe("Book Open");
  });
});
