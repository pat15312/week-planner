import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { calculateVisibleDayCount, clampDayWindowStart, dayWindowIndices, formatMinutes, hexWithAlpha, isMouseDragButtonHeld, summariseGroupedBlock, timeRangeLabel, type Plan, type MouseDragButton } from '../domain/planner';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Props = {
  plan: Plan; step: number;
  onPaint: (day: number, row: number, length: number, activity: string | null) => void;
  beginGesture: () => void; endGesture: () => void;
};

export function PlannerGrid({ plan, step, onPaint, beginGesture, endGesture }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(3);
  const [start, setStart] = useState(0);
  const [focused, setFocused] = useState({ day: 0, row: 0 });
  const [announcement, setAnnouncement] = useState('');
  const focusRequested = useRef(false);
  const drag = useRef<{ pointerId: number; button: MouseDragButton; value: string | null; day: number; row: number } | null>(null);
  const touch = useRef<{ pointerId: number; day: number; row: number; x: number; y: number; cancelled: boolean } | null>(null);
  const dayStart = clampDayWindowStart(start, count);
  const days = dayWindowIndices(dayStart, count);
  const activeDay = Math.min(dayStart + count - 1, Math.max(dayStart, focused.day));
  const activeRow = Math.min(288 - step, Math.floor(focused.row / step) * step);
  const activities = useMemo(() => new Map(plan.activities.map(a => [a.id, a])), [plan.activities]);
  const columns = `56px repeat(${count}, minmax(0, 1fr))`;

  const finishDrag = useCallback(() => { drag.current = null; touch.current = null; endGesture(); }, [endGesture]);
  useEffect(() => {
    const end = (event: globalThis.PointerEvent) => {
      if (drag.current?.pointerId === event.pointerId) finishDrag();
      if (touch.current?.pointerId === event.pointerId) touch.current = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', finishDrag);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', finishDrag);
    };
  }, [finishDrag]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setCount(calculateVisibleDayCount(element.clientWidth - 56));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    viewport.current?.querySelector<HTMLElement>(`[data-day="${activeDay}"][data-row="${activeRow}"]`)?.focus();
  }, [focused, activeDay, activeRow, count, step]);

  function paint(day: number, row: number, erase = false) {
    const value = erase || plan.tool === 'erase' ? null : plan.selectedActivityId;
    if (!erase && plan.tool === 'paint' && !value) {
      setAnnouncement('Choose or add an activity before painting.');
      return;
    }
    onPaint(day, row, step, value);
    setAnnouncement(`${DAYS[day]} ${timeRangeLabel(row, step)}: ${value ? activities.get(value)?.name : 'Free time'}`);
  }
  function pointerDown(event: PointerEvent, day: number, row: number) {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      if (!event.isPrimary || event.button !== 0) return;
      touch.current = { pointerId: event.pointerId, day, row, x: event.clientX, y: event.clientY, cancelled: false };
      return;
    }
    if (event.pointerType !== 'mouse' || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true });
    const erase = event.button === 2 || plan.tool === 'erase';
    if (!erase && !plan.selectedActivityId) { paint(day, row); return; }
    beginGesture();
    drag.current = { pointerId: event.pointerId, button: event.button === 2 ? 'secondary' : 'primary', value: erase ? null : plan.selectedActivityId, day, row };
    paint(day, row, event.button === 2);
  }
  function pointerEnter(event: PointerEvent, day: number, row: number) {
    const current = drag.current;
    if (event.pointerType !== 'mouse' || !current || current.pointerId !== event.pointerId) return;
    if (!isMouseDragButtonHeld(event.buttons, current.button)) { finishDrag(); return; }
    if (current.day === day && current.row === row) return;
    const first = current.day === day ? Math.min(current.row, row) : row;
    const length = current.day === day ? Math.abs(current.row - row) + step : step;
    onPaint(day, first, length, current.value);
    drag.current = { ...current, day, row };
  }
  function keyDown(event: KeyboardEvent, day: number, row: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let nextDay = day;
    let nextRow = row;
    switch (event.key) {
      case 'Enter': case ' ': event.preventDefault(); beginGesture(); paint(day, row); endGesture(); return;
      case 'ArrowUp': nextRow -= step; break;
      case 'ArrowDown': nextRow += step; break;
      case 'ArrowLeft': nextDay--; break;
      case 'ArrowRight': nextDay++; break;
      case 'Home': nextRow = 0; break;
      case 'End': nextRow = 288 - step; break;
      case 'PageUp': nextRow -= Math.max(step, 12); break;
      case 'PageDown': nextRow += Math.max(step, 12); break;
      case 'Delete': case 'Backspace': event.preventDefault(); paint(day, row, true); return;
      default: return;
    }
    event.preventDefault();
    nextDay = Math.max(0, Math.min(6, nextDay));
    nextRow = Math.max(0, Math.min(288 - step, nextRow));
    if (nextDay < dayStart) setStart(nextDay);
    if (nextDay >= dayStart + count) setStart(nextDay - count + 1);
    focusRequested.current = true;
    setFocused({ day: nextDay, row: nextRow });
  }

  return <>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
      <p id="grid-help">Tap to edit · Swipe to scroll<span className="hidden lg:inline"> · Arrow keys to move, Enter to paint, Delete to erase</span></p>
      <label className="flex items-center gap-2">Jump to
        <select aria-label="Jump to time" className="rounded-lg bg-zinc-950 p-2" defaultValue="0" onChange={event => {
          const row = Math.floor(Number(event.target.value) / step) * step;
          viewport.current?.querySelector<HTMLElement>(`[data-day="${dayStart}"][data-row="${row}"]`)?.scrollIntoView({ block: 'start' });
        }}>
          {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour * 12}>{String(hour).padStart(2, '0')}:00</option>)}
        </select>
      </label>
    </div>
    {count < 7 && <nav aria-label="Visible days" className="mb-2 flex items-center justify-between gap-2">
      <button className="action-button" disabled={dayStart === 0} onClick={() => setStart(dayStart - 1)}>Previous</button>
      <span className="text-sm" aria-live="polite">{DAYS[dayStart]}–{DAYS[dayStart + count - 1]}</span>
      <button className="action-button" disabled={dayStart + count === 7} onClick={() => setStart(dayStart + 1)}>Next</button>
    </nav>}
    <div ref={viewport} className="planner-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950" onScroll={() => { if (touch.current) touch.current.cancelled = true; }}>
      <div role="grid" aria-label="Weekly allocations" aria-describedby="grid-help" aria-rowcount={288 / step + 1} aria-colcount={8}>
        <div role="row" aria-rowindex={1} className="sticky top-0 z-10 grid bg-zinc-900" style={{ gridTemplateColumns: columns }}>
          <div role="columnheader" aria-colindex={1} className="px-1 py-3 text-xs text-zinc-400">Time</div>
          {days.map(day => <div role="columnheader" aria-colindex={day + 2} key={day} className="border-l border-zinc-800 px-2 py-3 text-sm font-medium">{DAYS[day]}</div>)}
        </div>
        {Array.from({ length: 288 / step }, (_, index) => {
          const row = index * step;
          const range = timeRangeLabel(row, step);
          return <div role="row" aria-rowindex={index + 2} key={row} className="grid" style={{ gridTemplateColumns: columns }}>
            <div role="rowheader" aria-colindex={1} className={`flex items-start px-1 pt-2 text-[11px] ${row % 12 === 0 ? 'text-zinc-200' : 'text-zinc-400'}`}>{range.slice(0, 5)}</div>
            {days.map(day => {
              const summary = summariseGroupedBlock(plan.grid, day, row, step);
              const activity = summary.kind === 'single' ? activities.get(summary.activityId) : null;
              const label = summary.kind === 'mixed' ? summary.segments.map(s => `${s.activityId ? activities.get(s.activityId)?.name : 'Free'} ${formatMinutes(s.cellCount * 5)}`).join(', ') : activity?.name ?? 'Free';
              let backgroundImage: string | undefined;
              if (summary.kind === 'mixed') {
                let offset = 0;
                backgroundImage = `linear-gradient(to right, ${summary.segments.map(segment => {
                  const from = offset; offset += segment.cellCount / step * 100;
                  return `${segment.activityId ? activities.get(segment.activityId)?.colour : '#27272a'} ${from}% ${offset}%`;
                }).join(', ')})`;
              }
              return <button key={day} type="button" role="gridcell" aria-colindex={day + 2} aria-label={`${DAYS[day]} ${range}: ${label}`}
                data-day={day} data-row={row} tabIndex={day === activeDay && row === activeRow ? 0 : -1}
                onFocus={() => setFocused({ day, row })} onKeyDown={event => keyDown(event, day, row)}
                onClick={event => { if (event.detail === 0) paint(day, row); }}
                onContextMenu={event => event.preventDefault()} onPointerDown={event => pointerDown(event, day, row)} onPointerEnter={event => pointerEnter(event, day, row)}
                onPointerMove={event => { const pending = touch.current; if (pending?.pointerId === event.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 10) pending.cancelled = true; }}
                onPointerUp={event => {
                  const pending = touch.current;
                  if (pending?.pointerId === event.pointerId) { touch.current = null; if (!pending.cancelled) paint(pending.day, pending.row); }
                  if (drag.current?.pointerId === event.pointerId) finishDrag();
                }} onPointerCancel={finishDrag}
                className={`planner-cell touch-pan-y select-none border-b border-l border-zinc-800 px-1 text-left text-xs ${row % 12 === 0 ? 'border-t border-t-zinc-600' : ''} ${step === 1 ? 'fine-cell' : step === 3 ? 'quarter-cell' : 'hour-cell'}`}
                style={{ backgroundColor: activity ? hexWithAlpha(activity.colour, 0.28) : undefined, backgroundImage }} title={`${DAYS[day]} ${range}: ${label}`}>
                {activity ? <span className="block truncate border-l-2 pl-1" style={{ borderColor: activity.colour }}>{activity.name}</span> : summary.kind === 'mixed' ? <span className="rounded bg-zinc-950/90 px-1 text-[10px] text-white">Mixed</span> : <span className="sr-only">Free</span>}
              </button>;
            })}
          </div>;
        })}
      </div>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </>;
}
