import type { Plan } from '../domain/planner';
import type { TimeScale } from '../domain/preferences';

type Props = {
  plans: Plan[]; plan: Plan; onSelect: (id: string) => void;
  onPlanAction: (action: 'new' | 'rename' | 'duplicate' | 'delete') => void;
  onExport: () => void; onImport: () => void;
  timeScale: TimeScale; onScale: (scale: TimeScale) => void;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
};
export function PlannerToolbar(props: Props) {
  return <div className="mb-3 flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">Plan
        <select aria-label="Plan" value={props.plan.id} onChange={event => props.onSelect(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-2">
          {props.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
      </label>
      <details className="relative shrink-0" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
        <summary data-plan-options className="action-button flex items-center">Plan options</summary>
        <div className="absolute right-0 top-full z-20 mt-2 grid w-52 gap-2 rounded-xl border border-zinc-600 bg-zinc-950 p-3 shadow-xl" onClick={event => { const details = event.currentTarget.closest('details'); if (details) details.open = false; }}>
          <button className="action-button" onClick={() => props.onPlanAction('new')}>New plan</button>
          <button className="action-button" onClick={() => props.onPlanAction('rename')}>Rename plan</button>
          <button className="action-button" onClick={() => props.onPlanAction('duplicate')}>Duplicate plan</button>
          <button className="action-button" disabled={props.plans.length <= 1} onClick={() => props.onPlanAction('delete')}>Delete plan</button>
          <button className="action-button" onClick={props.onExport}>Export backup</button>
          <button className="action-button" onClick={props.onImport}>Import backup</button>
        </div>
      </details>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1" aria-label="Time resolution">
        {(['60', '15', '5'] as const).map(scale => <button key={scale} className="action-button" aria-pressed={props.timeScale === scale} onClick={() => props.onScale(scale)}>{scale === '60' ? '1h' : `${scale}m`}</button>)}
      </div>
      <div className="flex gap-1">
        <button className="action-button" disabled={!props.canUndo} onClick={props.undo} title="Undo (Ctrl or Command Z)">Undo</button>
        <button className="action-button" disabled={!props.canRedo} onClick={props.redo} title="Redo (Ctrl or Command Shift Z)">Redo</button>
      </div>
    </div>
  </div>;
}
