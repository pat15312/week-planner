export const PREFERENCES_KEY = 'week_planner_preferences';
export type TimeScale = '5' | '15' | '60';
export function readTimeScale(): TimeScale {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
    if (value && typeof value === 'object' && 'version' in value && value.version === 1 && 'timeScale' in value && (value.timeScale === '5' || value.timeScale === '15' || value.timeScale === '60')) return value.timeScale;
  } catch { /* Preferences must never prevent plans from loading. */ }
  return '60';
}
export function writeTimeScale(timeScale: TimeScale): boolean {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, timeScale })); return true; } catch { return false; }
}
