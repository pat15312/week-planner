import React, { useEffect, useMemo, useRef, useState } from "react";
import { PlannerToolbar } from './components/PlannerToolbar';
import { PlannerGrid } from './components/PlannerGrid';
import { Modal } from './components/Modal';
import { BackupDialog } from './components/BackupDialog';
import { usePlannerHistory } from './hooks/usePlannerHistory';
import { readTimeScale, writeTimeScale } from './domain/preferences';
import {
  Plus,
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
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import {
  addPlanAndSelect,
  calculateAllocationSummary,
  clearGridForActivity,
  formatMinutes,
  hexWithAlpha,
  iconLabel,
  deletePlanAndSelectFallback,
  duplicatePlanAndSelect,
  makeDefaultPlan,
  renamePlan,
  reorderByIndex,
  uid,
  updateGridRange,
  type Activity,
  type Plan,
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
// - Planner grid shows a 3-to-7-day window based on measured available width

const TAILWIND_XL_MEDIA_QUERY = "(min-width: 1280px)";
// Resolve storage inside the guarded persistence helpers, including browsers
// where obtaining window.localStorage itself throws.
const browserStorage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};

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
  const [startup] = useState(() => loadStartupState(browserStorage, makeDefaultPlan("Default")));
  const [startupRecovery, setStartupRecovery] = useState<{ originalText: string; error: string } | null>(
    startup.status === "recovery" ? { originalText: startup.originalText, error: startup.error } : null
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(startup.warning);
  const [autoPersistenceEnabled, setAutoPersistenceEnabled] = useState(startup.autoPersistenceEnabled);
  const [canRestorePreviousPlans, setCanRestorePreviousPlans] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const history = usePlannerHistory(startup.state);
  const { state: { plans, activePlanId }, setState: setPlannerState, beginGesture, endGesture, undo, redo } = history;
  const [actionMessage, setActionMessage] = useState('');

  const setActivePlanId: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
    setPlannerState((prev) => ({
      ...prev,
      activePlanId: typeof value === "function" ? value(prev.activePlanId) : value,
    }), true);
  };

  const [importExportOpen, setImportExportOpen] = useState(false);
  const [backupMode, setBackupMode] = useState<"export" | "import">("export");
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
  const [activitiesDrawerOpen, setActivitiesDrawerOpen] = useState(false);
  const activitiesDrawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const activitiesDrawerOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const activitiesDrawerRef = useRef<HTMLDivElement | null>(null);
  const plannerAppRef = useRef<HTMLDivElement | null>(null);
  const activityDrawerPreviousFocusRef = useRef<HTMLElement | null>(null);
  const activityDrawerWasOpenRef = useRef(false);
  const activityDrawerShouldRestoreFocusRef = useRef(true);
  const [timeScale, setTimeScale] = useState(readTimeScale);
  const viewStep = timeScale === "5" ? 1 : timeScale === "15" ? 3 : 12;
  useEffect(() => {
    if (!writeTimeScale(timeScale)) setActionMessage('View preference could not be saved in this browser.');
  }, [timeScale]);

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

  function getDrawerFocusableElements() {
    const drawer = activitiesDrawerRef.current;
    if (!drawer) return [];

    const selectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ];

    return Array.from(drawer.querySelectorAll<HTMLElement>(selectors.join(","))).filter((element) => {
      if (element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") return false;
      return element.offsetParent !== null || element === document.activeElement;
    });
  }

  function restoreActivitiesDrawerFocus() {
    const previousFocus = activityDrawerPreviousFocusRef.current;
    activityDrawerPreviousFocusRef.current = null;

    if (previousFocus?.isConnected && previousFocus.offsetParent !== null) {
      previousFocus.focus();
      return;
    }

    const openButton = activitiesDrawerOpenButtonRef.current;
    if (openButton?.isConnected && openButton.offsetParent !== null) openButton.focus();
  }

  function openActivitiesDrawer() {
    const activeElement = document.activeElement;
    activityDrawerPreviousFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    setActivitiesDrawerOpen(true);
  }

  function closeActivitiesDrawer({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
    activityDrawerShouldRestoreFocusRef.current = restoreFocus;
    setActivitiesDrawerOpen(false);
  }

  function onActivitiesDrawerKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;

    const focusableElements = getDrawerFocusableElements();
    if (focusableElements.length === 0) {
      e.preventDefault();
      activitiesDrawerCloseButtonRef.current?.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (e.shiftKey) {
      if (activeElement === first || !activitiesDrawerRef.current?.contains(activeElement)) {
        e.preventDefault();
        last.focus();
      }
      return;
    }

    if (activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Persist to storage
  useEffect(() => {
    if (!plans || plans.length === 0 || startupRecovery || !autoPersistenceEnabled) return;
    const saved = savePayload(browserStorage, STORAGE_KEY, createPlannerPayload(plans, activePlanId));
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activitiesDrawerOpen) closeActivitiesDrawer();
      const target = event.target;
      if (planModalOpen || importExportOpen || (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activitiesDrawerOpen, planModalOpen, importExportOpen, undo, redo]);

  useEffect(() => {
    const desktopQuery = window.matchMedia(TAILWIND_XL_MEDIA_QUERY);

    const closeDrawerForDesktop = () => {
      if (!desktopQuery.matches) return;
      if (activitiesDrawerRef.current?.contains(document.activeElement)) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
      closeActivitiesDrawer({ restoreFocus: false });
    };

    closeDrawerForDesktop();
    desktopQuery.addEventListener("change", closeDrawerForDesktop);
    return () => desktopQuery.removeEventListener("change", closeDrawerForDesktop);
  }, []);

  useEffect(() => {
    const background = plannerAppRef.current;

    if (!activitiesDrawerOpen) {
      if (activityDrawerWasOpenRef.current) {
        activityDrawerWasOpenRef.current = false;
        background?.removeAttribute("inert");
        if (activityDrawerShouldRestoreFocusRef.current) restoreActivitiesDrawerFocus();
        else activityDrawerPreviousFocusRef.current = null;
        activityDrawerShouldRestoreFocusRef.current = true;
      }
      return;
    }

    activityDrawerWasOpenRef.current = true;
    background?.setAttribute("inert", "");
    const focusFrame = window.requestAnimationFrame(() => activitiesDrawerCloseButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      background?.removeAttribute("inert");
    };
  }, [activitiesDrawerOpen]);

  // When switching plan, collapse any open activity editors
  useEffect(() => {
    setExpandedActivityId(null);
    setOpenIconPickerFor(null);
    setPendingDeleteActivityId(null);
    setPendingClearActivityId(null);
  }, [activePlan?.id]);

  function updateActivePlan(patchOrUpdater: Partial<Plan> | ((p: Plan) => Partial<Plan>), transient = false) {
    setPlannerState((state) => {
      const prev = state.plans;
      const idx = prev.findIndex((p) => p.id === activePlan.id);
      if (idx < 0) return state;
      const next = prev.slice();
      const current = next[idx];
      const patch = typeof patchOrUpdater === "function" ? patchOrUpdater(current) : patchOrUpdater;
      next[idx] = { ...current, ...patch };
      return { ...state, plans: next };
    }, transient);
  }

  const allocationSummary = useMemo(() => calculateAllocationSummary(activePlan), [activePlan]);
  const selectedActivity = activePlan.activities.find(activity => activity.id === activePlan.selectedActivityId) ?? null;

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
    setBackupMode("export");
    setJsonBuffer(JSON.stringify(createPlannerPayload(plans, activePlan.id), null, 2));
    setJsonStatus(null);
    setImportExportOpen(true);
  }

  function openRecoveryImport() {
    setBackupMode("import");
    setJsonBuffer("");
    setJsonStatus(null);
    setRecoveryStatus(null);
    setImportExportOpen(true);
  }

  function applyImport() {
    if (startupRecovery) {
      const replacement = applyRecoveryReplacement(browserStorage, jsonBuffer);
      if (!replacement.ok) {
        setJsonStatus({ type: "error", message: replacement.error.message });
        return;
      }
      history.reset({ plans: replacement.value.plans, activePlanId: replacement.value.activePlanId });
      setStartupRecovery(null);
      setAutoPersistenceEnabled(true);
      setResetConfirmation(false);
      setRecoveryStatus(null);
      setStorageWarning(null);
      setJsonStatus({ type: "ok", message: "Replacement plans imported successfully." });
      return;
    }

    const currentPayload = createPlannerPayload(plans, activePlanId);
    const imported = applyValidatedImport(browserStorage, currentPayload, jsonBuffer);
    if (!imported.ok) {
      setJsonStatus({ type: "error", message: imported.error.message });
      return;
    }

    history.reset({ plans: imported.value.plans, activePlanId: imported.value.activePlanId });
    setStartupRecovery(null);
    setAutoPersistenceEnabled(true);
    setResetConfirmation(false);
    setCanRestorePreviousPlans(true);
    setStorageWarning(null);
    setJsonStatus({ type: "ok", message: "Imported successfully. A pre-import backup was saved." });
  }

  function restorePreviousPlans() {
    setRecoveryStatus(null);
    const restored = restoreBackup(browserStorage);
    if (!restored.ok) {
      if (startupRecovery) setRecoveryStatus({ type: "error", message: restored.error.message });
      else setJsonStatus({ type: "error", message: restored.error.message });
      return;
    }
    history.reset({ plans: restored.value.plans, activePlanId: restored.value.activePlanId });
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
    const reset = resetAfterRecovery(browserStorage, payload);
    if (!reset.ok) {
      setRecoveryStatus({ type: "error", message: "Week Planner could not reset because browser storage could not be written." });
      return;
    }
    history.reset({ plans: payload.plans, activePlanId: payload.activePlanId });
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
      const { insertIndex: toIndex } = computeInsertIndex(ev.clientY, draggedId);

      setReorderDrag(null);

      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        updateActivePlan((p) => ({ activities: reorderByIndex(p.activities, fromIndex, toIndex) }));
      }
    };

    const cancel = () => setReorderDrag(null);
    window.addEventListener("blur", cancel);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
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

        {importExportOpen && <BackupDialog recovery={!!startupRecovery} initialMode={backupMode} json={jsonBuffer} status={jsonStatus}
          setJson={setJsonBuffer} setStatus={setJsonStatus} onClose={() => setImportExportOpen(false)} onImport={applyImport}
          onRestore={restorePreviousPlans} canRestore={canRestorePreviousPlans} />}
      </div>
    );
  }

  function renderActivitiesPanel() {
    return (
      <>
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
                      <button type="button" aria-label={`Drag ${a.name} to reorder`} title="Drag to reorder" onPointerDown={e => startReorder(e, a.id)}
                        className="drag-handle touch-none rounded-lg p-2 text-zinc-400"><GripVertical className="h-4 w-4" /></button>
                      <button
                        onClick={() => { updateActivePlan({ selectedActivityId: a.id }, true); if (activitiesDrawerOpen) closeActivitiesDrawer(); }}
                        aria-pressed={selected}
                        className="flex flex-1 items-center gap-3 text-left"
                        title="Select activity"
                      >
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
                          aria-label={`${expanded ? "Collapse" : "Edit"} ${a.name}`} aria-expanded={expanded}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <div className="flex gap-2">
                          <button className="action-button flex-1" disabled={activePlan.activities[0].id === a.id} onClick={() => { const index = activePlan.activities.findIndex(x => x.id === a.id); updateActivePlan(p => ({ activities: reorderByIndex(p.activities, index, index - 1) })); }}>Move up</button>
                          <button className="action-button flex-1" disabled={activePlan.activities.at(-1)?.id === a.id} onClick={() => { const index = activePlan.activities.findIndex(x => x.id === a.id); updateActivePlan(p => ({ activities: reorderByIndex(p.activities, index, index + 1) })); }}>Move down</button>
                        </div>
                        <label className="grid gap-1">
                          <span className="text-xs text-zinc-400">Name</span>
                          <input
                            value={a.name}
                            onFocus={beginGesture} onBlur={endGesture}
                            onChange={(e) => updateActivity(a.id, { name: e.target.value })}
                            className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                          />
                        </label>

                        <div className="grid gap-1">
                          <span className="text-xs text-zinc-400">Colour</span>
                          <div className="rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
                            <div className="mb-2 grid grid-cols-5 gap-2">
                              {PRESET_COLOURS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => updateActivity(a.id, { colour: c })}
                                  aria-label={`Colour ${c}`} aria-pressed={a.colour?.toUpperCase() === c.toUpperCase()}
                                  className={`h-10 w-full rounded-lg ring-1 transition ${
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
      </>
    );
  }

  return (
    <div className="app-shell bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex h-full min-h-0 max-w-[1600px] gap-3 p-2 sm:p-4 xl:gap-4">
        <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden rounded-3xl bg-zinc-900/60 p-2 ring-1 ring-zinc-800 xl:flex">
          {renderActivitiesPanel()}
        </aside>

        {activitiesDrawerOpen ? (
          <div
            className="fixed inset-0 z-40 xl:hidden"
            aria-modal="true"
            role="dialog"
            aria-label="Activities drawer"
            onKeyDown={onActivitiesDrawerKeyDown}
          >
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0 h-full w-full bg-black/70"
              aria-label="Close activities drawer"
              onClick={() => closeActivitiesDrawer()}
            />
            <div
              ref={activitiesDrawerRef}
              id="activities-drawer"
              className="absolute inset-y-0 left-0 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800"
            >
              <div className="mb-2 flex shrink-0 justify-end">
                <button
                  ref={activitiesDrawerCloseButtonRef}
                  type="button"
                  onClick={() => closeActivitiesDrawer()}
                  className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-3 py-2 text-sm ring-1 ring-zinc-800 hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
              {renderActivitiesPanel()}
            </div>
          </div>
        ) : null}

        <div ref={plannerAppRef} className="flex min-w-0 flex-1 flex-col overflow-hidden p-1">
          <div className="mb-2 hidden shrink-0 flex-col items-center text-center sm:flex">
            <div className="text-xl font-semibold tracking-tight sm:text-2xl">Week Planner</div>
            <div className="text-sm text-zinc-400">Repeating weekly time plan, saved in your browser.</div>
          </div>
          {storageWarning ? (
            <div className="mb-3 rounded-2xl bg-amber-950/60 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-800">
              {storageWarning}
            </div>
          ) : null}

          <div className="mb-2 flex shrink-0 items-center gap-2">
            <button ref={activitiesDrawerOpenButtonRef} type="button" onClick={openActivitiesDrawer} aria-expanded={activitiesDrawerOpen} aria-controls="activities-drawer"
              className="action-button min-w-0 flex-1 text-left xl:hidden"><span className="block text-xs">Activities</span><span className="block truncate text-sm">{selectedActivity?.name ?? 'Choose activity'}</span></button>
            <span className="hidden min-w-0 flex-1 truncate text-sm text-zinc-300 xl:block">{selectedActivity?.name ?? 'Choose an activity'}</span>
            <button className="action-button" aria-pressed={activePlan.tool === 'paint'} onClick={() => updateActivePlan({ tool: 'paint' }, true)}>Paint</button>
            <button className="action-button" aria-pressed={activePlan.tool === 'erase'} onClick={() => updateActivePlan({ tool: 'erase' }, true)}>Erase</button>
          </div>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-zinc-900/60 p-2 ring-1 ring-zinc-800">
            <PlannerToolbar plans={plans} plan={activePlan} onSelect={setActivePlanId} onPlanAction={openPlanModal}
              onExport={openExport} onImport={() => { setBackupMode('import'); setJsonBuffer(''); setJsonStatus(null); setImportExportOpen(true); }}
              timeScale={timeScale} onScale={setTimeScale} undo={undo} redo={redo} canUndo={history.canUndo} canRedo={history.canRedo} />
            <PlannerGrid plan={activePlan} step={viewStep} beginGesture={beginGesture} endGesture={endGesture}
              onPaint={(day, row, length, activity) => updateActivePlan(p => ({ grid: updateGridRange(p.grid, day, row, length, activity) }))} />
        {importExportOpen && <BackupDialog recovery={!!startupRecovery} initialMode={backupMode} json={jsonBuffer} status={jsonStatus}
          setJson={setJsonBuffer} setStatus={setJsonStatus} onClose={() => setImportExportOpen(false)} onImport={applyImport}
          onRestore={restorePreviousPlans} canRestore={canRestorePreviousPlans} />}
          </main>

          <footer className="mt-2 shrink-0 text-center text-xs text-zinc-400"><span role="status">{storageWarning ? 'Unsaved changes' : autoPersistenceEnabled ? 'Saved in this browser' : 'Saving unavailable'}</span> · <span>{formatMinutes(allocationSummary.freeMinutes)} free</span></footer>
          <p role="status" className="sr-only">{actionMessage}</p>
        </div>
      </div>

      {planModalOpen && <Modal title={planModalTitle} onClose={() => setPlanModalOpen(false)}>
        <p className="mb-4 text-sm text-zinc-300">{planModalMode === 'delete' ? `Delete “${activePlan.name}” and its allocations? You can undo this until you reload.` : 'Plans are saved in this browser.'}</p>
        {planModalMode !== 'delete' && <label className="grid gap-2 text-sm">Plan name
          <input autoFocus value={planNameDraft} maxLength={60} onChange={event => { setPlanNameDraft(event.target.value); setPlanModalError(null); }}
            onKeyDown={event => { if (event.key === 'Enter') commitPlanModal(); }} className="rounded-xl bg-zinc-900 px-3 py-3" />
        </label>}
        {planModalError && <p role="alert" className="mt-2 text-sm text-rose-200">{planModalError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="action-button" onClick={() => setPlanModalOpen(false)}>Cancel</button>
          <button className="action-button primary" onClick={commitPlanModal}>{planModalMode === 'delete' ? 'Delete plan' : 'Save plan'}</button>
        </div>
      </Modal>}

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
