import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Download,
  Upload,
  Paintbrush,
  Eraser,
  Calendar,
  Coffee,
  Dumbbell,
  BookOpen,
  Briefcase,
  Car,
  Utensils,
  Heart,
  Home,
  Users,
  Music,
  Phone,
  Bed,
  Laptop,
  Gamepad2,
  Droplets,
  Route,
  Copy,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
} from "lucide-react";
import {
  addPlanAndSelect,
  calculateAllocationSummary,
  CELLS_PER_DAY,
  clearGridForActivity,
  formatMinutes,
  hexWithAlpha,
  iconLabel,
  deletePlanAndSelectFallback,
  duplicatePlanAndSelect,
  makeDefaultPlan,
  renamePlan,
  reorderByIndex,
  summariseGroupedBlock,
  timeLabelForRow,
  timeRangeLabel,
  uid,
  updateGridRange,
  type Activity,
  type Plan,
  type ToolMode,
} from "./domain/planner";
import {
  PRE_IMPORT_BACKUP_KEY,
  STORAGE_KEY,
  applyRecoveryReplacement,
  applyValidatedImport,
  createPlannerPayload,
  loadStartupState,
  parsePlannerPayloadJSON,
  resetAfterRecovery,
  restoreBackup,
  savePayload,
} from "./domain/persistence";

// Weekly 5-minute Planner v3
// - Multiple saved plans (localStorage)
// - In-app plan manager (no window.prompt/confirm)
// - Export/Import as JSON (all plans)
// - 5-minute data model (7 x 288)
// - View scale: 5m / 15m / 1h (rendering groups)
// - Mixed blocks rendered as proportional stripes
// - Block painting in collapsed views (overwrites the whole block)
// - Activity customisation (name, colour, icon)
// - Pointer-based drag-to-reorder activities
// - Right click ALWAYS erases

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRESET_COLOURS = [
  "#E11D48",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#64748B",
  "#A3A3A3",
  "#F4F4F5",
];

// Note: Some lucide-react builds (and some CDNs) do not expose every icon.
// We map "Shower" -> Droplets and "Walking" -> Route to avoid missing-icon builds.
const ICONS = [
  { key: "calendar", Icon: Calendar },
  { key: "coffee", Icon: Coffee },
  { key: "dumbbell", Icon: Dumbbell },
  { key: "book", Icon: BookOpen },
  { key: "briefcase", Icon: Briefcase },
  { key: "car", Icon: Car },
  { key: "utensils", Icon: Utensils },
  { key: "heart", Icon: Heart },
  { key: "home", Icon: Home },
  { key: "users", Icon: Users },
  { key: "music", Icon: Music },
  { key: "phone", Icon: Phone },
  { key: "bed", Icon: Bed },
  { key: "laptop", Icon: Laptop },
  { key: "gaming", Icon: Gamepad2 },
  { key: "shower", Icon: Droplets },
  { key: "walking", Icon: Route },
];

function getIconComponent(iconKey: string) {
  return ICONS.find((i) => i.key === iconKey)?.Icon ?? Calendar;
}

type PlanModalMode = "new" | "rename" | "duplicate" | "delete";

export default function App() {
  const [startup] = useState(() => loadStartupState(localStorage, makeDefaultPlan("Default")));
  const [startupRecovery, setStartupRecovery] = useState<{ originalText: string; error: string } | null>(
    startup.status === "recovery" ? { originalText: startup.originalText, error: startup.error } : null
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(startup.warning);
  const [autoPersistenceEnabled, setAutoPersistenceEnabled] = useState(startup.autoPersistenceEnabled);
  const [canRestorePreviousPlans, setCanRestorePreviousPlans] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [{ plans, activePlanId }, setPlannerState] = useState(startup.state);

  const setPlans: React.Dispatch<React.SetStateAction<Plan[]>> = (value) => {
    setPlannerState((prev) => ({
      ...prev,
      plans: typeof value === "function" ? value(prev.plans) : value,
    }));
  };

  const setActivePlanId: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    setPlannerState((prev) => ({
      ...prev,
      activePlanId: typeof value === "function" ? value(prev.activePlanId) : value,
    }));
  };

  const [importExportOpen, setImportExportOpen] = useState(false);
  const [jsonBuffer, setJsonBuffer] = useState("");
  const [jsonStatus, setJsonStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planModalMode, setPlanModalMode] = useState<PlanModalMode>("new");
  const [planNameDraft, setPlanNameDraft] = useState("");
  const [planModalError, setPlanModalError] = useState<string | null>(null);

  const [openIconPickerFor, setOpenIconPickerFor] = useState<string | null>(null);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [pendingDeleteActivityId, setPendingDeleteActivityId] = useState<string | null>(null);
  const [pendingClearActivityId, setPendingClearActivityId] = useState<string | null>(null);

  // Grid view scale
  const [timeScale, setTimeScale] = useState<"5" | "15" | "60">("5");
  const viewStep = timeScale === "5" ? 1 : timeScale === "15" ? 3 : 12;

  // Painting state
  const isMouseDownRef = useRef(false);
  const dragPaintModeRef = useRef<ToolMode>("paint");
  const lastPaintRef = useRef<{ day: number | null; row: number | null }>({ day: null, row: null });

  // Pointer-based activity reordering
  const activityRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [reorderDrag, setReorderDrag] = useState<
    | null
    | {
        id: string;
        pointerId: number;
        startIndex: number;
        insertIndex: number;
        indicatorId: string | null;
        indicatorPos: "above" | "below";
        clientX: number;
        clientY: number;
        offsetY: number;
        width: number;
        height: number;
      }
  >(null);

  const activePlan = useMemo<Plan>(() => plans.find((p) => p.id === activePlanId) ?? plans[0], [plans, activePlanId]);

  // Persist to storage
  useEffect(() => {
    if (!plans || plans.length === 0 || startupRecovery || !autoPersistenceEnabled) return;
    const saved = savePayload(localStorage, STORAGE_KEY, createPlannerPayload(plans, activePlanId));
    setStorageWarning(saved.ok ? null : "Changes are not being saved because browser storage is unavailable. Export your plans to keep a copy.");
  }, [plans, activePlanId, startupRecovery, autoPersistenceEnabled]);

  useEffect(() => {
    try {
      const rawBackup = localStorage.getItem(PRE_IMPORT_BACKUP_KEY);
      setCanRestorePreviousPlans(rawBackup !== null && parsePlannerPayloadJSON(rawBackup).ok);
    } catch {
      const message = "Browser storage could not be read. Changes may not be saved.";
      setCanRestorePreviousPlans(false);
      if (startupRecovery) setRecoveryStatus({ type: "error", message });
      else setStorageWarning(message);
    }
  }, [importExportOpen, startupRecovery]);

  // Keep activePlanId valid
  useEffect(() => {
    if (!plans || plans.length === 0) return;
    if (!activePlanId || !plans.some((p) => p.id === activePlanId)) setActivePlanId(plans[0].id);
  }, [plans, activePlanId]);

  // Global mouse up ends painting drag
  useEffect(() => {
    const onUp = () => {
      isMouseDownRef.current = false;
      dragPaintModeRef.current = "paint";
      lastPaintRef.current = { day: null, row: null };
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseleave", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onUp);
    };
  }, []);

  // Click outside icon picker closes it
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-icon-picker-root]") || t.closest("[data-icon-picker-button]")) return;
      setOpenIconPickerFor(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  // Escape closes modals
  useEffect(() => {
    if (!planModalOpen && !importExportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPlanModalOpen(false);
      setImportExportOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planModalOpen, importExportOpen]);

  // When switching plan, collapse any open activity editors
  useEffect(() => {
    setExpandedActivityId(null);
    setOpenIconPickerFor(null);
    setPendingDeleteActivityId(null);
    setPendingClearActivityId(null);
  }, [activePlan?.id]);

  function updateActivePlan(patchOrUpdater: Partial<Plan> | ((p: Plan) => Partial<Plan>)) {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === activePlan.id);
      if (idx < 0) return prev;
      const next = prev.slice();
      const current = next[idx];
      const patch = typeof patchOrUpdater === "function" ? patchOrUpdater(current) : patchOrUpdater;
      next[idx] = { ...current, ...patch };
      return next;
    });
  }

  const activityById = useMemo(() => {
    const m = new Map<string, Activity>();
    for (const a of activePlan.activities) m.set(a.id, a);
    return m;
  }, [activePlan.activities]);

  const allocationSummary = useMemo(() => calculateAllocationSummary(activePlan), [activePlan]);

  function applyRange(dayIndex: number, startRow: number, len: number, activityIdOrNull: string | null) {
    updateActivePlan((p) => ({ grid: updateGridRange(p.grid, dayIndex, startRow, len, activityIdOrNull) }));
  }

  function onCellPointerEnter(dayIndex: number, startRow: number) {
    if (!isMouseDownRef.current) return;
    const last = lastPaintRef.current;
    if (last.day === dayIndex && last.row === startRow) return;
    lastPaintRef.current = { day: dayIndex, row: startRow };

    const mode = dragPaintModeRef.current || "paint";
    if (mode === "erase") applyRange(dayIndex, startRow, viewStep, null);
    else applyRange(dayIndex, startRow, viewStep, activePlan.selectedActivityId ?? null);
  }

  function onCellPointerDown(e: React.MouseEvent, dayIndex: number, startRow: number) {
    e.preventDefault();

    const buttons = e.buttons;
    const isRightClick = e.button === 2 || (buttons & 2) === 2;

    isMouseDownRef.current = true;
    lastPaintRef.current = { day: dayIndex, row: startRow };
    dragPaintModeRef.current = isRightClick ? "erase" : activePlan.tool;

    if (dragPaintModeRef.current === "erase") applyRange(dayIndex, startRow, viewStep, null);
    else applyRange(dayIndex, startRow, viewStep, activePlan.selectedActivityId ?? null);
  }

  function getStripeBackground(dayIndex: number, startRow: number) {
    const summary = summariseGroupedBlock(activePlan.grid, dayIndex, startRow, viewStep);

    if (summary.kind === "free") return summary;

    if (summary.kind === "single") {
      const a = activityById.get(summary.activityId) ?? null;
      return { kind: "single" as const, activity: a };
    }

    const segments = summary.segments.map((segment) => {
      if (segment.activityId === null) {
        return { key: "__free__", colour: "rgba(255,255,255,0.06)", n: segment.cellCount, label: "Free" };
      }

      const a = activityById.get(segment.activityId);
      return {
        key: segment.activityId,
        colour: a?.colour ?? "#A3A3A3",
        n: segment.cellCount,
        label: a?.name ?? "Unknown",
      };
    });

    const total = viewStep;
    let acc = 0;
    const stops: string[] = [];
    for (const s of segments) {
      const from = (acc / total) * 100;
      acc += s.n;
      const to = (acc / total) * 100;
      stops.push(`${s.colour} ${from.toFixed(2)}% ${to.toFixed(2)}%`);
    }

    const gradient = `linear-gradient(to right, ${stops.join(", ")})`;
    const tip = segments
      .filter((s) => s.n > 0)
      .map((s) => `${s.label}: ${formatMinutes(s.n * 5)}`)
      .join("\n");

    return { kind: "mixed" as const, gradient, tip };
  }

  function addActivity() {
    const id = `a_${uid()}`;
    setExpandedActivityId(id);
    setOpenIconPickerFor(null);
    setPendingDeleteActivityId(null);
    setPendingClearActivityId(null);

    updateActivePlan((p) => {
      const next = [...p.activities, { id, name: "New activity", colour: "#8B5CF6", icon: "calendar" }];
      return { activities: next, selectedActivityId: id };
    });
  }

  function updateActivity(activityId: string, patch: Partial<Activity>) {
    updateActivePlan((p) => ({
      activities: p.activities.map((a) => (a.id === activityId ? { ...a, ...patch } : a)),
    }));
  }

  function clearActivityCells(activityId: string) {
    setPendingClearActivityId(null);
    updateActivePlan((p) => ({ grid: clearGridForActivity(p.grid, activityId) }));
  }

  function deleteActivity(activityId: string) {
    setExpandedActivityId((prev) => (prev === activityId ? null : prev));
    setOpenIconPickerFor((prev) => (prev === activityId ? null : prev));

    updateActivePlan((p) => {
      const nextActivities = p.activities.filter((a) => a.id !== activityId);
      const nextGrid = clearGridForActivity(p.grid, activityId);
      const nextSelected = p.selectedActivityId === activityId ? nextActivities[0]?.id ?? null : p.selectedActivityId;
      return { activities: nextActivities, grid: nextGrid, selectedActivityId: nextSelected };
    });
  }

  function openExport() {
    setJsonBuffer(JSON.stringify(createPlannerPayload(plans, activePlan.id), null, 2));
    setJsonStatus(null);
    setImportExportOpen(true);
  }

  function openRecoveryImport() {
    setJsonBuffer("");
    setJsonStatus(null);
    setRecoveryStatus(null);
    setImportExportOpen(true);
  }

  function applyImport() {
    if (startupRecovery) {
      const replacement = applyRecoveryReplacement(localStorage, jsonBuffer);
      if (!replacement.ok) {
        setJsonStatus({ type: "error", message: replacement.error.message });
        return;
      }
      setPlannerState({ plans: replacement.value.plans, activePlanId: replacement.value.activePlanId });
      setStartupRecovery(null);
      setAutoPersistenceEnabled(true);
      setResetConfirmation(false);
      setRecoveryStatus(null);
      setStorageWarning(null);
      setJsonStatus({ type: "ok", message: "Replacement plans imported successfully." });
      return;
    }

    const currentPayload = createPlannerPayload(plans, activePlanId);
    const imported = applyValidatedImport(localStorage, currentPayload, jsonBuffer);
    if (!imported.ok) {
      setJsonStatus({ type: "error", message: imported.error.message });
      return;
    }

    setPlannerState({ plans: imported.value.plans, activePlanId: imported.value.activePlanId });
    setStartupRecovery(null);
    setAutoPersistenceEnabled(true);
    setResetConfirmation(false);
    setCanRestorePreviousPlans(true);
    setStorageWarning(null);
    setJsonStatus({ type: "ok", message: "Imported successfully. A pre-import backup was saved." });
  }

  function restorePreviousPlans() {
    setRecoveryStatus(null);
    const restored = restoreBackup(localStorage);
    if (!restored.ok) {
      if (startupRecovery) setRecoveryStatus({ type: "error", message: restored.error.message });
      else setJsonStatus({ type: "error", message: restored.error.message });
      return;
    }
    setPlannerState({ plans: restored.value.plans, activePlanId: restored.value.activePlanId });
    setStartupRecovery(null);
    setAutoPersistenceEnabled(true);
    setCanRestorePreviousPlans(false);
    setRecoveryStatus(null);
    setStorageWarning(null);
    setJsonStatus({ type: "ok", message: "Previous plans restored." });
    setJsonBuffer(JSON.stringify(restored.value, null, 2));
  }

  function downloadRecoveredStorage() {
    if (!startupRecovery) return;
    const blob = new Blob([startupRecovery.originalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "week-planner-invalid-storage.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFromRecovery() {
    const defaultPlan = makeDefaultPlan("Default");
    const payload = createPlannerPayload([defaultPlan], defaultPlan.id);
    const reset = resetAfterRecovery(localStorage, payload);
    if (!reset.ok) {
      setRecoveryStatus({ type: "error", message: "Week Planner could not reset because browser storage could not be written." });
      return;
    }
    setPlannerState({ plans: payload.plans, activePlanId: payload.activePlanId });
    setStartupRecovery(null);
    setAutoPersistenceEnabled(true);
    setResetConfirmation(false);
    setRecoveryStatus(null);
    setStorageWarning(null);
  }

  function openPlanModal(mode: PlanModalMode) {
    setPlanModalMode(mode);
    setPlanModalError(null);

    if (mode === "new") setPlanNameDraft("New plan");
    if (mode === "rename") setPlanNameDraft(activePlan?.name ?? "");
    if (mode === "duplicate") setPlanNameDraft(`${activePlan?.name ?? "Plan"} (Copy)`);
    if (mode === "delete") setPlanNameDraft(activePlan?.name ?? "");

    setPlanModalOpen(true);
  }

  function commitPlanModal() {
    const trimmed = planNameDraft.trim();

    if (planModalMode !== "delete") {
      if (!trimmed) {
        setPlanModalError("Please enter a name.");
        return;
      }
      if (trimmed.length > 60) {
        setPlanModalError("Name is too long.");
        return;
      }
    }

    if (planModalMode === "new") {
      const p = makeDefaultPlan(trimmed);
      setPlannerState((prev) => addPlanAndSelect(prev, p));
      setPlanModalOpen(false);
      return;
    }

    if (planModalMode === "rename") {
      setPlannerState((prev) => renamePlan(prev, activePlan.id, trimmed));
      setPlanModalOpen(false);
      return;
    }

    if (planModalMode === "duplicate") {
      setPlannerState((prev) => duplicatePlanAndSelect(prev, activePlan.id, `p_${uid()}`, trimmed));
      setPlanModalOpen(false);
      return;
    }

    if (planModalMode === "delete") {
      if (plans.length <= 1) {
        setPlanModalOpen(false);
        return;
      }

      setPlannerState((prev) => deletePlanAndSelectFallback(prev, activePlan.id));
      setPlanModalOpen(false);
    }
  }

  function computeInsertIndex(clientY: number, draggedId: string) {
    const ordered = activePlan.activities.map((a) => a.id);
    const orderedWithout = ordered.filter((id) => id !== draggedId);

    const entries = orderedWithout
      .map((id) => {
        const el = activityRowRefs.current.get(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { id, midY: r.top + r.height / 2 };
      })
      .filter(Boolean) as { id: string; midY: number }[];

    const beforeId = entries.find((x) => clientY < x.midY)?.id ?? null;

    if (!beforeId) {
      const lastId = orderedWithout[orderedWithout.length - 1] ?? null;
      return {
        insertIndex: orderedWithout.length,
        indicatorId: lastId,
        indicatorPos: "below" as const,
      };
    }

    const beforeIndex = orderedWithout.findIndex((id) => id === beforeId);
    return { insertIndex: beforeIndex, indicatorId: beforeId, indicatorPos: "above" as const };
  }

  function startReorder(e: React.PointerEvent, activityId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rowEl = activityRowRefs.current.get(activityId);
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    const startIndex = activePlan.activities.findIndex((a) => a.id === activityId);
    const offsetY = e.clientY - rect.top;

    setReorderDrag({
      id: activityId,
      pointerId: e.pointerId,
      startIndex,
      insertIndex: startIndex,
      indicatorId: activityId,
      indicatorPos: "above",
      clientX: e.clientX,
      clientY: e.clientY,
      offsetY,
      width: rect.width,
      height: rect.height,
    });

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!reorderDrag) return;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== reorderDrag.pointerId) return;
      ev.preventDefault();
      const { insertIndex, indicatorId, indicatorPos } = computeInsertIndex(ev.clientY, reorderDrag.id);
      setReorderDrag((prev) =>
        prev
          ? {
              ...prev,
              clientX: ev.clientX,
              clientY: ev.clientY,
              insertIndex,
              indicatorId,
              indicatorPos,
            }
          : prev
      );
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== reorderDrag.pointerId) return;

      const draggedId = reorderDrag.id;
      const fromIndex = activePlan.activities.findIndex((a) => a.id === draggedId);
      let toIndex = reorderDrag.insertIndex;

      if (fromIndex >= 0) {
        const without = activePlan.activities.filter((a) => a.id !== draggedId);
        const clamped = Math.max(0, Math.min(without.length, toIndex));
        const beforeId = without[clamped]?.id ?? null;
        if (!beforeId) {
          toIndex = activePlan.activities.length - 1;
        } else {
          toIndex = activePlan.activities.findIndex((a) => a.id === beforeId);
        }
      }

      setReorderDrag(null);

      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        updateActivePlan((p) => ({ activities: reorderByIndex(p.activities, fromIndex, toIndex) }));
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorderDrag, activePlan.activities]);

  const reorderOverlay = useMemo(() => {
    if (!reorderDrag) return null;
    const a = activePlan.activities.find((x) => x.id === reorderDrag.id);
    if (!a) return null;
    const Icon = getIconComponent(a.icon);

    const top = reorderDrag.clientY - reorderDrag.offsetY;
    const x = Math.max(16, Math.min(window.innerWidth - reorderDrag.width - 16, reorderDrag.clientX - reorderDrag.width / 2));

    return { a, Icon, top, x, width: reorderDrag.width };
  }, [reorderDrag, activePlan.activities]);

  const planModalTitle =
    planModalMode === "new"
      ? "New plan"
      : planModalMode === "rename"
      ? "Rename plan"
      : planModalMode === "duplicate"
      ? "Duplicate plan"
      : "Delete plan";

  if (startupRecovery) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-3xl rounded-3xl bg-zinc-900/60 p-5 ring-1 ring-rose-900/60">
          <div className="mb-3 text-2xl font-semibold">Week Planner needs your help to recover saved data</div>
          <p className="mb-3 text-sm text-zinc-300">
            The saved browser data could not be used, so Week Planner has not started normal editing and has not overwritten the original stored
            value.
          </p>
          <div className="mb-4 rounded-2xl bg-zinc-950 p-3 text-sm text-rose-100 ring-1 ring-rose-900/60">{startupRecovery.error}</div>
          {recoveryStatus ? (
            <div
              className={`mb-4 rounded-2xl bg-zinc-950 p-3 text-sm ring-1 ${
                recoveryStatus.type === "ok" ? "text-zinc-100 ring-zinc-700" : "text-rose-100 ring-rose-900/60"
              }`}
            >
              {recoveryStatus.message}
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setRecoveryStatus(null);
                downloadRecoveredStorage();
              }}
              className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-950 hover:opacity-90"
            >
              Download original stored text
            </button>
            <button onClick={openRecoveryImport} className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-800 hover:bg-zinc-800">
              Supply replacement JSON
            </button>
            {canRestorePreviousPlans ? (
              <button onClick={restorePreviousPlans} className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-800 hover:bg-zinc-800">
                Restore previous plans
              </button>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
            <div className="mb-2 font-medium">Reset Week Planner</div>
            <p className="mb-3 text-sm text-zinc-400">Resetting replaces the invalid stored value with a new default plan. This is destructive.</p>
            {resetConfirmation ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setResetConfirmation(false)} className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800">
                  Cancel
                </button>
                <button onClick={resetFromRecovery} className="rounded-2xl bg-rose-200 px-3 py-2 text-sm text-rose-950 hover:opacity-90">
                  Confirm reset
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setRecoveryStatus(null);
                  setResetConfirmation(true);
                }}
                className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                I understand, reset Week Planner
              </button>
            )}
          </div>
        </div>

        {importExportOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Import replacement JSON</div>
                  <div className="text-xs text-zinc-400">Paste a valid version 3 Week Planner export to replace the unusable stored data.</div>
                </div>
                <button onClick={() => setImportExportOpen(false)} className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800">
                  Close
                </button>
              </div>
              <textarea
                value={jsonBuffer}
                onChange={(e) => setJsonBuffer(e.target.value)}
                className="h-[360px] w-full rounded-2xl bg-zinc-900 p-3 font-mono text-xs text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                spellCheck={false}
              />
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs text-rose-200">{jsonStatus?.message}</div>
                <button onClick={applyImport} className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-950 hover:opacity-90">
                  Import replacement
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex h-full max-w-[1400px] gap-4 p-4">
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-3xl bg-zinc-900/60 p-2 ring-1 ring-zinc-800">
          <div className="m-2 mb-4 shrink-0 rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Free time</span>
              <span className="rounded-xl bg-zinc-900 px-2 py-1 text-sm ring-1 ring-zinc-800">
                {formatMinutes(allocationSummary.freeMinutes)}
              </span>
            </div>
          </div>

          <div className="mb-3 flex shrink-0 items-center justify-between px-2">
            <div>
              <div className="text-lg font-semibold">Activities</div>
            </div>
            <button
              onClick={addActivity}
              className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-950 ring-1 ring-zinc-200 transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pt-1">
              {activePlan.activities.map((a) => {
                const Icon = getIconComponent(a.icon);
                const selected = a.id === activePlan.selectedActivityId;
                const expanded = a.id === expandedActivityId;
                const isDragging = reorderDrag?.id === a.id;
                const showIndicator = reorderDrag && reorderDrag.indicatorId === a.id && reorderDrag.id !== a.id;

                return (
                  <div
                    key={a.id}
                    ref={(el) => {
                      if (el) activityRowRefs.current.set(a.id, el);
                      else activityRowRefs.current.delete(a.id);
                    }}
                    className={`relative rounded-2xl p-3 ring-1 transition ${
                      selected ? "bg-zinc-950 ring-zinc-700" : "bg-zinc-900 ring-zinc-800 hover:bg-zinc-800"
                    } ${isDragging ? "opacity-40" : ""}`}
                  >
                    {showIndicator ? (
                      <div
                        className={`pointer-events-none absolute left-3 right-3 h-0.5 rounded-full ${
                          reorderDrag!.indicatorPos === "above" ? "top-1.5" : "bottom-1.5"
                        } bg-zinc-100`}
                      />
                    ) : null}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => updateActivePlan({ selectedActivityId: a.id })}
                        className="flex flex-1 items-center gap-3 text-left"
                        title="Select activity"
                      >
                        <div
                          onPointerDown={(e) => startReorder(e, a.id)}
                          className="flex items-center gap-2 rounded-xl px-1 py-1 text-zinc-500 hover:bg-zinc-950"
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: hexWithAlpha(a.colour, 0.22) }}>
                          <Icon className="h-5 w-5" style={{ color: a.colour }} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{a.name}</div>
                        </div>

                        <div className="ml-2 shrink-0 rounded-xl bg-zinc-950 px-2 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800">
                          {formatMinutes(allocationSummary.minutesById.get(a.id) ?? 0)}
                        </div>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedActivityId((prev) => (prev === a.id ? null : a.id));
                            setOpenIconPickerFor(null);
                            setPendingDeleteActivityId(null);
                            setPendingClearActivityId(null);
                          }}
                          className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-950 hover:text-zinc-100"
                          title={expanded ? "Collapse" : "Edit"}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <label className="grid gap-1">
                          <span className="text-xs text-zinc-400">Name</span>
                          <input
                            value={a.name}
                            onChange={(e) => updateActivity(a.id, { name: e.target.value })}
                            className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                          />
                        </label>

                        <div className="grid gap-1">
                          <span className="text-xs text-zinc-400">Colour</span>
                          <div className="rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
                            <div className="mb-2 grid grid-cols-10 gap-2">
                              {PRESET_COLOURS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => updateActivity(a.id, { colour: c })}
                                  className={`h-6 w-6 rounded-lg ring-1 transition ${
                                    a.colour?.toUpperCase() === c.toUpperCase() ? "ring-zinc-100" : "ring-zinc-800 hover:ring-zinc-600"
                                  }`}
                                  style={{ background: c }}
                                  title={c.toUpperCase()}
                                />
                              ))}
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-zinc-900 px-3 py-2 ring-1 ring-zinc-800">
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={a.colour}
                                  onChange={(e) => updateActivity(a.id, { colour: e.target.value })}
                                  className="h-6 w-10 cursor-pointer rounded"
                                  title="Custom colour"
                                />
                                <span className="text-xs text-zinc-400">Custom</span>
                              </div>
                              <span className="text-xs text-zinc-400">{(a.colour ?? "").toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-1">
                          <span className="text-xs text-zinc-400">Icon</span>
                          <div className="relative">
                            <button
                              type="button"
                              data-icon-picker-button
                              onClick={() => setOpenIconPickerFor(openIconPickerFor === a.id ? null : a.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-zinc-950 px-3 py-2 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {(() => {
                                  const I = getIconComponent(a.icon);
                                  return (
                                    <div className="flex min-w-0 items-center gap-2">
                                      <I className="h-6 w-6 shrink-0" style={{ color: a.colour }} />
                                      <span className="truncate text-sm text-zinc-200">{iconLabel(a.icon)}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <span className="text-zinc-400">▾</span>
                            </button>

                            {openIconPickerFor === a.id ? (
                              <div data-icon-picker-root className="absolute right-0 z-30 mt-2 w-full rounded-2xl bg-zinc-950 p-2 ring-1 ring-zinc-800">
                                <div className="grid grid-cols-6 gap-2">
                                  {ICONS.map((i) => {
                                    const I = i.Icon;
                                    const activeIcon = i.key === a.icon;
                                    return (
                                      <button
                                        key={i.key}
                                        type="button"
                                        onClick={() => {
                                          updateActivity(a.id, { icon: i.key });
                                          setOpenIconPickerFor(null);
                                        }}
                                        className={`flex items-center justify-center rounded-2xl px-2 py-3 ring-1 transition ${
                                          activeIcon ? "bg-zinc-900 ring-zinc-700" : "bg-zinc-950 ring-zinc-800 hover:bg-zinc-900 hover:ring-zinc-700"
                                        }`}
                                        title={iconLabel(i.key)}
                                      >
                                        <I className="h-7 w-7" style={{ color: a.colour }} />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="mb-2 border-t border-zinc-800" />

                          {pendingClearActivityId === a.id ? (
                            <div className="mb-2 grid gap-2">
                              <div className="rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ring-1 ring-zinc-800">
                                Clear all cells for this activity from the grid?
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPendingClearActivityId(null)}
                                  className="w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition hover:bg-zinc-900"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearActivityCells(a.id)}
                                  className="w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition hover:bg-zinc-900"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingClearActivityId(a.id);
                                setPendingDeleteActivityId(null);
                              }}
                              className="mb-2 w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition hover:bg-zinc-900"
                              title="Clear activity"
                            >
                              Clear activity
                            </button>
                          )}

                          {pendingDeleteActivityId === a.id ? (
                            <div className="grid gap-2">
                              <div className="rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-zinc-300 ring-1 ring-zinc-800">
                                Are you sure? This will remove the activity and clear it from the grid.
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteActivityId(null)}
                                  className="w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 transition hover:bg-zinc-900"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPendingDeleteActivityId(null);
                                    deleteActivity(a.id);
                                  }}
                                  className="w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-rose-900/60 transition hover:bg-zinc-900"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDeleteActivityId(a.id);
                                setPendingClearActivityId(null);
                              }}
                              className="w-full rounded-2xl bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ring-1 ring-rose-900/60 transition hover:bg-zinc-900"
                              title="Delete activity"
                            >
                              Delete activity
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

        <div className="flex min-w-[1100px] flex-1 flex-col overflow-hidden p-1">
          <div className="mb-3 flex shrink-0 flex-col items-center text-center">
            <div className="text-2xl font-semibold tracking-tight">Week Planner</div>
            <div className="text-sm text-zinc-400">Repeating weekly time plan, saved in your browser.</div>
          </div>
          {storageWarning ? (
            <div className="mb-3 rounded-2xl bg-amber-950/60 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-800">
              {storageWarning}
            </div>
          ) : null}

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-zinc-900/60 p-2 ring-1 ring-zinc-800">
            <div className="mb-3 ml-1 mr-1 mt-1 flex items-center justify-between rounded-2xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-zinc-300">Plan</span>
                <select
                  value={activePlan.id}
                  onChange={(e) => setActivePlanId(e.target.value)}
                  className="h-8 rounded-xl bg-zinc-950 px-2 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => openPlanModal("new")}
                  className="h-8 w-20 rounded-xl bg-zinc-950 text-xs ring-1 ring-zinc-800 transition hover:bg-zinc-800"
                  title="New plan"
                >
                  New
                </button>
                <button
                  onClick={() => openPlanModal("rename")}
                  className="h-8 w-20 rounded-xl bg-zinc-950 text-xs ring-1 ring-zinc-800 transition hover:bg-zinc-800"
                  title="Rename plan"
                >
                  Rename
                </button>
                <button
                  onClick={() => openPlanModal("duplicate")}
                  className="flex h-8 w-20 items-center justify-center gap-1 rounded-xl bg-zinc-950 text-xs ring-1 ring-zinc-800 transition hover:bg-zinc-800"
                  title="Duplicate plan"
                >
                  <Copy className="h-3 w-3" />
                  Duplicate
                </button>
                <button
                  onClick={() => openPlanModal("delete")}
                  disabled={plans.length <= 1}
                  className={`flex h-8 w-20 items-center justify-center gap-1 rounded-xl text-xs ring-1 transition ${
                    plans.length <= 1 ? "bg-zinc-950 text-zinc-500 ring-zinc-800" : "bg-zinc-950 text-zinc-100 ring-zinc-800 hover:bg-zinc-800"
                  }`}
                  title={plans.length <= 1 ? "You must keep at least one plan" : "Delete plan"}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button
                  onClick={openExport}
                  className="flex h-8 w-20 items-center justify-center gap-1 rounded-xl bg-zinc-950 text-xs ring-1 ring-zinc-800 transition hover:bg-zinc-800"
                  title="Export / Import"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateActivePlan({ tool: "paint" })}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                    activePlan.tool === "paint" ? "bg-zinc-100 text-zinc-950 ring-zinc-200" : "bg-zinc-950 text-zinc-100 ring-zinc-800 hover:bg-zinc-800"
                  }`}
                  title="Paint tool"
                >
                  <Paintbrush className="h-4 w-4" />
                  Paint
                </button>

                <button
                  onClick={() => updateActivePlan({ tool: "erase" })}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 transition ${
                    activePlan.tool === "erase" ? "bg-zinc-100 text-zinc-950 ring-zinc-200" : "bg-zinc-950 text-zinc-100 ring-zinc-800 hover:bg-zinc-800"
                  }`}
                  title="Eraser tool"
                >
                  <Eraser className="h-4 w-4" />
                  Erase
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-300">View</span>
                {([
                  { k: "5", label: "5m" },
                  { k: "15", label: "15m" },
                  { k: "60", label: "1h" },
                ] as const).map((opt) => (
                  <button
                    key={opt.k}
                    onClick={() => setTimeScale(opt.k)}
                    className={`w-16 rounded-xl py-1.5 text-sm ring-1 transition ${
                      timeScale === opt.k
                        ? "bg-zinc-100 text-zinc-950 ring-zinc-200"
                        : "bg-zinc-950 text-zinc-100 ring-zinc-800 hover:bg-zinc-800"
                    }`}
                    title={`Show ${opt.label} blocks`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-1 ml-1 mr-1 min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
              <div className="h-full overflow-auto">
                <div className="sticky top-0 z-10 grid grid-cols-[84px_repeat(7,1fr)] overflow-hidden rounded-t-2xl bg-zinc-950/95 backdrop-blur">
                  <div className="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">Time</div>
                  {DAYS.map((d) => (
                    <div key={d} className="border-b border-l border-zinc-800 px-3 py-2">
                      <div className="text-sm font-medium">{d}</div>
                    </div>
                  ))}
                </div>

                {Array.from({ length: CELLS_PER_DAY / viewStep }, (_, visIndex) => {
                  const startRow = visIndex * viewStep;
                  const showLabel = startRow % 12 === 0;
                  const time = timeLabelForRow(startRow);
                  const timeRange = timeRangeLabel(startRow, viewStep);
                  const rowHeight = viewStep === 1 ? 16 : viewStep === 3 ? 18 : 32;

                  return (
                    <div key={visIndex} className="grid grid-cols-[84px_repeat(7,1fr)]">
                      <div
                        className={`flex items-center border-b border-zinc-900 px-3 text-[11px] ${
                          showLabel ? "text-zinc-300" : "text-zinc-600"
                        } ${startRow % 12 === 0 ? "border-t-zinc-700 border-t" : ""}`}
                        style={{ height: rowHeight }}
                      >
                        {showLabel ? time : ""}
                      </div>

                      {Array.from({ length: DAYS.length }, (_, dayIndex) => {
                        const cellInfo = getStripeBackground(dayIndex, startRow);
                        const isQuarterHour = startRow % 3 === 0;
                        const isHour = startRow % 12 === 0;

                        if (cellInfo.kind === "single") {
                          const a = cellInfo.activity;
                          const Icon = a ? getIconComponent(a.icon) : null;
                          return (
                            <div
                              key={dayIndex}
                              onContextMenu={(e) => e.preventDefault()}
                              onMouseDown={(e) => onCellPointerDown(e, dayIndex, startRow)}
                              onMouseEnter={() => onCellPointerEnter(dayIndex, startRow)}
                              className={`relative cursor-crosshair select-none border-b border-l border-zinc-900 px-1 ${
                                isHour ? "border-t-zinc-700 border-t" : isQuarterHour ? "border-t-zinc-800 border-t" : ""
                              }`}
                              style={{
                                height: rowHeight,
                                background: a ? hexWithAlpha(a.colour, 0.22) : "transparent",
                              }}
                              title={a ? `${a.name} (${DAYS[dayIndex]} ${timeRange})` : `${DAYS[dayIndex]} ${timeRange}`}
                            >
                              {a && isQuarterHour && Icon ? (
                                <div className="absolute inset-y-0 left-1 flex items-center">
                                  <Icon className="h-3 w-3" style={{ color: a.colour }} />
                                </div>
                              ) : null}
                            </div>
                          );
                        }

                        if (cellInfo.kind === "mixed") {
                          return (
                            <div
                              key={dayIndex}
                              onContextMenu={(e) => e.preventDefault()}
                              onMouseDown={(e) => onCellPointerDown(e, dayIndex, startRow)}
                              onMouseEnter={() => onCellPointerEnter(dayIndex, startRow)}
                              className={`relative cursor-crosshair select-none border-b border-l border-zinc-900 ${
                                isHour ? "border-t-zinc-700 border-t" : isQuarterHour ? "border-t-zinc-800 border-t" : ""
                              }`}
                              style={{ height: rowHeight, backgroundImage: cellInfo.gradient }}
                              title={`${DAYS[dayIndex]} ${timeRange}\n${cellInfo.tip}`}
                            />
                          );
                        }

                        return (
                          <div
                            key={dayIndex}
                            onContextMenu={(e) => e.preventDefault()}
                            onMouseDown={(e) => onCellPointerDown(e, dayIndex, startRow)}
                            onMouseEnter={() => onCellPointerEnter(dayIndex, startRow)}
                            className={`relative cursor-crosshair select-none border-b border-l border-zinc-900 ${
                              isHour ? "border-t-zinc-700 border-t" : isQuarterHour ? "border-t-zinc-800 border-t" : ""
                            }`}
                            style={{ height: rowHeight, background: "transparent" }}
                            title={`${DAYS[dayIndex]} ${timeRange}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {importExportOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => {
                if (e.target === e.currentTarget) setImportExportOpen(false);
              }}>
                <div className="w-full max-w-3xl rounded-3xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">Export / Import</div>
                      <div className="text-xs text-zinc-400">Copy the JSON somewhere safe, or paste JSON here to import.</div>
                    </div>
                    <button onClick={() => setImportExportOpen(false)} className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800">
                      Close
                    </button>
                  </div>

                  <textarea
                    value={jsonBuffer}
                    onChange={(e) => setJsonBuffer(e.target.value)}
                    className="h-[360px] w-full rounded-2xl bg-zinc-900 p-3 font-mono text-xs text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                    spellCheck={false}
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      {jsonStatus ? (
                        <span
                          className={`rounded-xl px-2 py-1 ring-1 ${
                            jsonStatus.type === "ok" ? "bg-zinc-900 text-zinc-100 ring-zinc-700" : "bg-zinc-900 text-rose-200 ring-rose-900/60"
                          }`}
                        >
                          {jsonStatus.message}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Tip: Keep this JSON in a password manager note.</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canRestorePreviousPlans ? (
                        <button
                          onClick={restorePreviousPlans}
                          className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                          title="Restore previous plans"
                        >
                          Restore previous plans
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(jsonBuffer);
                          setJsonStatus({ type: "ok", message: "Copied to clipboard." });
                        }}
                        className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                      <button
                        onClick={applyImport}
                        className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-950 hover:opacity-90"
                        title="Import"
                      >
                        <Upload className="h-4 w-4" />
                        Import
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>

          <footer className="mt-3 shrink-0 text-center text-xs text-zinc-500">Stored locally in your browser via localStorage. No server required.</footer>
        </div>
      </div>

      {planModalOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPlanModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{planModalTitle}</div>
                <div className="text-xs text-zinc-400">
                  {planModalMode === "delete" ? "This will remove the plan and all its data." : "Plans are saved locally in your browser."}
                </div>
              </div>
              <button
                onClick={() => setPlanModalOpen(false)}
                className="rounded-2xl bg-zinc-900 p-2 text-zinc-200 hover:bg-zinc-800"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {planModalMode === "delete" ? (
              <div className="rounded-2xl bg-zinc-900 px-3 py-3 text-sm text-zinc-200 ring-1 ring-zinc-800">
                Delete plan <span className="font-semibold">{activePlan.name}</span>?
              </div>
            ) : (
              <label className="grid gap-1">
                <span className="text-xs text-zinc-400">Plan name</span>
                <input
                  autoFocus
                  value={planNameDraft}
                  onChange={(e) => {
                    setPlanNameDraft(e.target.value);
                    setPlanModalError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitPlanModal();
                  }}
                  className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                />
              </label>
            )}

            {planModalError ? <div className="mt-2 text-xs text-rose-200">{planModalError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPlanModalOpen(false)}
                className="rounded-2xl bg-zinc-900 px-3 py-2 text-sm ring-1 ring-zinc-800 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={commitPlanModal}
                disabled={planModalMode === "delete" && plans.length <= 1}
                className={`rounded-2xl px-3 py-2 text-sm ring-1 transition ${
                  planModalMode === "delete"
                    ? plans.length <= 1
                      ? "bg-zinc-900 text-zinc-500 ring-zinc-800"
                      : "bg-zinc-900 text-zinc-100 ring-rose-900/60 hover:bg-zinc-800"
                    : "bg-zinc-100 text-zinc-950 ring-zinc-200 hover:opacity-90"
                }`}
              >
                {planModalMode === "delete" ? "Delete" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reorderOverlay ? (
        <div className="pointer-events-none fixed z-[60]" style={{ top: reorderOverlay.top, left: reorderOverlay.x, width: reorderOverlay.width }}>
          <div className="rounded-2xl bg-zinc-950 ring-1 ring-zinc-700">
            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-zinc-500">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: hexWithAlpha(reorderOverlay.a.colour, 0.22) }}>
                  <reorderOverlay.Icon className="h-5 w-5" style={{ color: reorderOverlay.a.colour }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{reorderOverlay.a.name}</div>
                </div>
                <div className="ml-2 shrink-0 rounded-xl bg-zinc-900 px-2 py-1 text-xs text-zinc-200 ring-1 ring-zinc-800">
                  {formatMinutes(allocationSummary.minutesById.get(reorderOverlay.a.id) ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
