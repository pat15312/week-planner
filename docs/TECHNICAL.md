# Technical context

Last reviewed: 6 September 2026

## Stack and runtime

React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 and Lucide icons. The application is a client-side web app with no backend, account requirement or telemetry.

Node.js 24.19.0 is pinned in `.nvmrc` and used by both GitHub workflows. Install locked dependencies with `npm ci`.

Commands:

- `npm run dev`: development server
- `npm run lint`: ESLint
- `npm run test`: Vitest unit tests under src
- `npm run build`: TypeScript check and production bundle
- `npm run check`: lint, unit tests and production build
- `npm run test:e2e`: Playwright journeys against the built app
- `npm run preview`: preview the production bundle

Playwright covers browser event, focus, file and responsive-layout behaviour that pure function tests cannot exercise. The development-only `@axe-core/playwright` dependency adds automated accessibility checks; it is not bundled with the application.

## Responsibility boundaries

- `src/App.tsx`: application composition, plan/activity controls, browser persistence and recovery state.
- `src/domain/planner.ts`: plan types and pure calculations, plan operations, grid operations and grouped summaries.
- `src/domain/persistence.ts`: untrusted version 3 validation, startup recovery, verified writes, pre-import backup and restoration.
- `src/domain/history.ts`: immutable undo/redo reducer.
- `src/domain/preferences.ts`: independently versioned, optional view preferences.
- `src/hooks/usePlannerHistory.ts`: React history integration and edit grouping.
- `src/components/PlannerGrid.tsx`: measured day windows, grid presentation and mouse/touch/keyboard interactions.
- `src/components/PlannerToolbar.tsx`: plan operations, scale and history controls.
- `src/components/Modal.tsx`: native HTML dialog with focus management.
- `src/components/BackupDialog.tsx`: backup files, JSON text and copy feedback.

The activity editor remains in App.tsx. Further extraction should support a concrete change, not a speculative rewrite.

## Portable plan data

The plan schema is unchanged:

```ts
type Activity = { id: string; name: string; colour: string; icon: string };
type Plan = {
  id: string;
  name: string;
  activities: Activity[];
  grid: (string | null)[][];
  selectedActivityId: string | null;
  tool: 'paint' | 'erase';
};
type Payload = { version: 3; activePlanId: string | null; plans: Plan[] };
```

The grid is `grid[day][row]`, Monday to Sunday, with 288 five-minute cells per day. It represents 2,016 cells, 10,080 minutes, or 168 hours.

Five-minute, 15-minute and hourly views group 1, 3 and 12 underlying cells. Painting a displayed block overwrites its entire underlying range. Mixed blocks retain proportional colour summaries and expose activity durations through their accessible labels and titles. They do not imply chronological ordering within the displayed block.

## Storage and recovery

Main key: `week_planner_5min_store_v3`.

Pre-import backup: `week_planner_5min_pre_import_backup_v3`.

No existing key is renamed or abandoned. Schema version 3 is maintained, so existing valid browser data and exports remain readable. Future schema evolution requires explicit validation, migration, historical fixtures and recovery. Historical versions 1 and 2 are not supported without evidence of real data.

Imports, startup data and backups use the same validation boundary. It checks versions, plan/activity types, duplicate IDs, tools, selected activities, six-digit colours, all grid dimensions and references. Unknown icon strings use the established fallback icon. Validation does not impose plan-count or string-length limits on existing saved data.

Invalid startup data enters recovery without automatic overwriting. Original text can be downloaded before replacement or reset. The storage facade resolves window.localStorage inside guarded operations, including browsers that deny access to the storage property itself.

Successful imports first write and verify a backup of current plans, then write and verify the replacement. The UI only adopts successful replacements. Failed imports retain current in-memory plans. Restoration validates the backup before writing it. A write verification failure can mean the browser accepted a write but did not permit the confirming read; the pre-import backup remains the recovery path.

Normal changes save the full payload and verify it by reading it back. Failed saves show a visible warning. Startup read failure disables automatic persistence to avoid overwriting inaccessible existing data.

## View preferences

`week_planner_preferences` stores `{ version: 1, timeScale: '5' | '15' | '60' }` separately from plan data. Missing, malformed or unsupported preferences fall back to the hourly view. Preference failures do not prevent plan use. Plan exports remain version 3 and intentionally do not include device presentation preferences.

## Undo and redo

History stores up to 50 immutable planner-state snapshots in memory. A new content edit discards redo. Tool and activity selection changes do not add undo entries. Mouse down begins a paint group; release, cancellation or loss of focus ends it. Name editing groups between focus and blur. A multi-cell paint gesture is one undo step.

Plan deletion and activity deletion can be undone within the session. Successful import, restoration or explicit reset clears edit history because those operations establish a new data baseline. Import recovery uses its separate persisted backup. Reload deliberately clears history.

## Interaction and accessibility

- Mouse: primary drag paints; secondary drag erases. Same-day gaps between pointer events are filled within the gesture.
- Touch/pen: primary tap edits on release. Movement beyond 10 CSS pixels, a scroll or cancellation suppresses the pending tap. `touch-action: pan-y` preserves vertical scrolling.
- Keyboard: the grid has a single roving tab stop. Arrow keys navigate, Home/End move to the start/end of the day, Page Up/Down move an hour, Enter/Space activate the current tool, and Delete/Backspace erase.
- Undo: Ctrl/Command Z; redo: Ctrl/Command Shift Z or Ctrl Y. Shortcuts do not intercept text inputs or modal editing.
- Activity reordering: dedicated drag handles plus Move up/down buttons in each activity editor. Pointer cancellation abandons a reorder.
- Native modal dialogs provide focus containment and Escape dismissal. Focus returns to a usable triggering control. The activities drawer retains its labelled modal role, background inertness and focus trap.
- Grid labels include day, time range and activity. Mixed labels list the allocation amounts. A live region announces edits.

## Responsive layout

The planner measures its own width and shows three to seven consecutive days. Previous/Next move the window one day without altering data. The fixed time column is 56 CSS pixels. A 120-pixel target day width determines expansion, with a minimum of three days retained at narrow widths.

At 1280 CSS pixels the activities panel is permanent. Below that width it opens as an overlay drawer. Selecting an activity closes the drawer and returns to the grid controls. Plan management and backups are collected under Plan options; view and undo controls remain visible.

Touch and narrow-screen cells are at least 44 CSS pixels tall at every scale. Desktop fine/quarter/hour cells are at least 28/36/44 pixels tall. This trades additional vertical scrolling for reliable selection. A Jump to time control offsets that cost. Visible scrollbars, overscroll containment, dynamic viewport height and safe-area padding improve navigation.

## Verification and deployment

Vitest covers planner calculations, persistence and history. Playwright covers production-build journeys in Chromium and WebKit at 375, 768, 1024 and 1440 pixels, including touch contexts. Browser tests cover save/reload, undo/redo, keyboard editing, modal focus, file backups, invalid imports, restoration, clipboard failure, responsive layout, drag ordering and recovery.

The synthetic swipe regression verifies cancellation logic; it is not a substitute for real-device inertial scrolling or OS gesture testing.

Both `.github/workflows/ci.yml` and `deploy-pages.yml` run installation, lint, unit tests, production build and browser journeys. Browser reports and screenshots are retained as workflow artifacts for 14 days. Deployment proceeds only after checks pass.

Vite base remains `/week-planner/`; the existing GitHub Pages origin is retained so saved browser data remains available. Merging to main triggers deployment. A final release should tag a verified main revision and update the package release version deliberately.

## Remaining constraints

No synchronisation, multi-tab conflict resolution or offline service worker is introduced. Large plan collections still require synchronous browser storage writes. The history bound limits growth but does not establish a device performance guarantee. Real-device and assistive-technology acceptance remain required before declaring those experiences verified.

## Version 1.0 maintenance verification

The icon picker exposes its expanded and selected states. Selecting an icon or pressing Escape returns focus to its trigger. Escape inside the picker does not also close the Activities drawer. Activity-name fields retain visible keyboard focus. The planner has a main landmark and a page heading at every viewport size; the time column has an explicit column index. Fine time labels use the higher-contrast secondary text colour. Grid cells establish a positioning boundary for their visually hidden labels, preventing off-screen rows from extending the document below the app. Responsive regressions check both horizontal and vertical page overflow.

The accessibility suite audits the five-minute planner, expanded activity editor, icon picker, new-plan dialog and both backup modes using axe. Reports retain incomplete/manual checks as well as violations. Automated results are not a WCAG conformance claim.

The stress journey uses synthetic data only: 50 plans, 100 activities per plan and 2,016 allocated cells per plan. It checks five-minute editing, undo, persistence, reload and preservation of an inactive plan. Browser timings are attached to test reports. The three-second ceiling catches severe CI regressions and is not a target for real-device latency.

`npm run benchmark` measures the undo reducer on the same large shape, after 20 warm-up edits and over 100 measured edits. In the local Node 24.19.0 run, median comparison/edit time changed from 5.21 ms to 0.11 ms; p95 changed from 6.06 ms to 0.17 ms. These are domain timings, excluding React rendering and browser storage. The optimisation compares only replaced plans, taking advantage of immutable state sharing, while preserving content-based no-op detection and the 50-entry history limit.

Stable release publication is the final job in `deploy-pages.yml`, after deployment succeeds. It reads the package version and the matching CHANGELOG section from the deployed SHA. It skips prerelease versions and already-published versions, refuses to move an existing tag, and creates a new release at the deployed commit. Only this job has repository-content write permission. It may remove the three named completed work branches only when each current branch head is covered by a merged pull request. Branches containing subsequent work are retained.
