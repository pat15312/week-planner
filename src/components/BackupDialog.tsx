import { useRef, useState } from 'react';
import { Modal } from './Modal';

type Status = { type: 'ok' | 'error'; message: string } | null;
type Props = {
  recovery: boolean; initialMode: 'export' | 'import'; json: string; status: Status;
  setJson: (json: string) => void; setStatus: (status: Status) => void;
  onClose: () => void; onImport: () => void; onRestore: () => void; canRestore: boolean;
};

export function BackupDialog({ recovery, initialMode, json, status, setJson, setStatus, onClose, onImport, onRestore, canRestore }: Props) {
  const mode = initialMode;
  const fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const title = recovery ? 'Recover plans' : 'Back up and restore';
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `week-planner-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ type: 'ok', message: 'Backup download started.' });
  }
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(json);
      setStatus({ type: 'ok', message: 'Copied to clipboard.' });
    } catch {
      setStatus({ type: 'error', message: 'Copy failed. Download a backup file or select and copy the text manually.' });
    }
  }
  return <Modal title={title} onClose={onClose}>
    {mode === 'export' && !recovery ? <>
      <p className="mb-4 text-sm text-zinc-300">Download all your plans as a portable backup. Keep a copy outside this browser.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="action-button primary" onClick={download}>Download backup</button>
        <button className="action-button" onClick={copy}>Copy JSON</button>
      </div>
    </> : <>
      <p className="mb-4 text-sm text-zinc-300">Choose a Week Planner backup or paste its JSON below. Import replaces all current plans.{!recovery && ' Your current plans will be backed up first, so you can restore them.'}</p>
      <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Backup file" onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        setReading(true);
        try {
          if (file.size > 10 * 1024 * 1024) throw new Error('This file is larger than 10 MB. Use a smaller backup.');
          setJson(await file.text());
          setStatus({ type: 'ok', message: `${file.name} is ready. Select Import plans to continue.` });
        } catch (error) {
          setStatus({ type: 'error', message: error instanceof Error ? error.message : 'The file could not be read.' });
        } finally { setReading(false); if (fileInput.current) fileInput.current.value = ''; }
      }} />
      <button className="action-button mb-4" disabled={reading} onClick={() => fileInput.current?.click()}>Choose backup file</button>
    </>}
    <details open={mode === 'import' || recovery}>
      <summary className="mb-2 cursor-pointer text-sm text-zinc-300">Backup JSON</summary>
      <label className="sr-only" htmlFor="backup-json">Backup JSON</label>
      <textarea id="backup-json" readOnly={mode === 'export' && !recovery} value={json} onChange={e => { setJson(e.target.value); setStatus(null); }} spellCheck={false} className="h-44 w-full rounded-xl bg-zinc-900 p-3 font-mono text-xs sm:h-64" />
    </details>
    {status && <p role={status.type === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${status.type === 'error' ? 'text-rose-200' : 'text-emerald-200'}`}>{status.message}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {(mode === 'import' || recovery) && <button className="action-button primary" disabled={reading || !json.trim()} onClick={onImport}>Import plans</button>}
      {canRestore && <button className="action-button" onClick={onRestore}>Restore previous plans</button>}
    </div>
  </Modal>;
}
