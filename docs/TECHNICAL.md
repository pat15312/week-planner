# Technical context

Last reviewed: 16 July 2026

This document describes the current implementation and the agreed engineering direction. It should contain verified technical information, not speculative product requirements.

## Current stack

The repository currently declares:

- React `^19.2.3`
- React DOM `^19.2.3`
- TypeScript `~5.9.3`
- Vite `^7.3.1`
- Vitest `^4.1.10`
- Tailwind CSS `^4.1.18`
- Lucide React `^0.562.0`
- ESLint `^9.39.2`

The application is a client-side React application with no current backend.

## Repository entry points

- `index.html` provides the root element and page metadata.
- `src/main.tsx` creates the React root in `StrictMode`.
- `src/App.tsx` contains the React state, interactions and most of the rendered interface.
- `src/domain/planner.ts` contains shared planner types and extracted pure helper logic.
- `src/domain/persistence.ts` contains version 3 payload validation, storage keys and pure persistence safety operations.
- `src/domain/planner.test.ts` contains Vitest unit tests for the extracted planner helpers.
- `src/domain/persistence.test.ts` contains Vitest unit tests for validation, import, backup, recovery and storage failure behaviour.
- `src/index.css` imports Tailwind and globally hides scrollbars.
- `vite.config.ts` configures React and the `/week-planner/` base path.

At the time of the unit-test extraction, `src/App.tsx` is 1,316 lines and still has too many responsibilities. This is a maintainability concern, but it is not by itself justification for a broad rewrite.

The repository also retains unused starter files and metadata, including `src/App.css`, `src/assets/react.svg` and the package name `vite-react-typescript-starter`.

## Available scripts and verified baseline

The repository declares:

```json
{
  "dev": "vite",
  "build": "tsc -b --noEmit && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run"
}
```

The automated unit-test command is `npm run test`, which runs Vitest once.

The baseline review on 16 July 2026 verified:

- dependency installation succeeds with `npm ci`
- `npm run build` succeeds
- the production output serves successfully at `/week-planner/`
- `npm run lint` passes after the data-safety change removed the remaining explicit `any` usage

The review used Node.js `24.14.0` and npm `11.9.0`. The initial install attempt failed because the review environment did not permit npm to create `/root/.npm`; the same clean install succeeded when an explicit writable npm cache was supplied. This was an environment restriction, not a repository dependency failure.


## Current data model

### Activity

An activity currently contains:

```ts
type Activity = {
  id: string;
  name: string;
  colour: string;
  icon: string;
};
```

### Plan

A plan currently contains:

```ts
type Plan = {
  id: string;
  name: string;
  activities: Activity[];
  grid: (string | null)[][];
  selectedActivityId: string | null;
  tool: "paint" | "erase";
};
```

### Weekly grid

The grid is stored as:

```text
grid[day][row]
```

It contains:

- 7 day arrays
- 288 rows per day
- one row for every five minutes
- an activity identifier or `null` in each cell

The full week therefore contains 2,016 cells and represents 10,080 minutes, or 168 hours.

This model is simple and explicit. It is suitable for accurate allocation and portable serialisation, although storage and rendering concerns should be separated from the domain model during refactoring.

## View scales

The underlying data always remains at five-minute resolution.

The displayed scale groups cells as follows:

- 5-minute view: 1 stored cell
- 15-minute view: 3 stored cells
- 1-hour view: 12 stored cells

Mixed grouped blocks are rendered as proportional colour stripes.

Painting in a grouped view overwrites every underlying five-minute cell represented by that block. This is established behaviour and must be preserved or deliberately changed as a product decision.

The baseline review verified that the 15-minute view renders 96 displayed blocks per day, from `00:00-00:15` through `23:45-24:00`.

## Persistence

### Browser storage

The application continues to use the established storage key:

```text
week_planner_5min_store_v3
```

This key was deliberately preserved during the data-safety change. It is still tied to schema version 3, and that is not the intended long-term design, but no storage-key migration has been introduced yet.

The pre-import backup key is:

```text
week_planner_5min_pre_import_backup_v3
```

The backup key stores a complete version 3 payload. It is not a replacement for the main storage key.

The stored payload is:

```ts
{
  version: 3,
  activePlanId: string | null,
  plans: Plan[]
}
```

The application writes the full payload whenever plans or the active plan change, unless start-up has detected invalid stored data, or browser storage could not be read at start-up. Normal automatic persistence verifies the write by reading the value back. A failed save keeps the application usable and shows a persistent warning that changes are not being saved.

### Version 3 validation boundary

`src/domain/persistence.ts` owns the shared validation boundary for untrusted version 3 data. It accepts `unknown` input and either returns a fully validated payload or a structured validation error with a user-facing message. The same validator is used for JSON imports, browser-stored data and pre-import backups.

The validator checks the top-level object, exact version `3`, non-empty `plans`, `activePlanId`, unique plan identifiers, complete plan structure, activity fields, unique activity identifiers within a plan, six-digit hex colours, 7 by 288 grids, valid grid cells, valid `selectedActivityId` values and `tool` values of only `paint` or `erase`. Plans may have no activities, but only when their grid is empty and `selectedActivityId` is `null`.

A missing or unmatched `activePlanId` remains valid and falls back to the first valid plan. This preserves the active-plan restoration behaviour fixed earlier. Malformed plans are not silently repaired or discarded.

### Start-up ordering and recovery

The application initialises `plans` and `activePlanId` together before the first render by reading the version 3 payload from `localStorage` and validating it.

Start-up behaviour is now:

- valid stored data with an `activePlanId` matching an existing plan restores that plan, even when it is not the first plan
- valid stored data with a missing or unmatched `activePlanId` falls back deliberately to the first stored plan
- absent stored data creates and selects the normal default plan
- malformed, unsupported or structurally invalid stored data enters a recovery state before normal editing begins
- storage read failure starts from a temporary default plan with automatic persistence disabled for that session, so unknown existing stored data is not overwritten

Recovery mode preserves the original stored text exactly and prevents automatic persistence from overwriting it. The user can download the preserved text, open an empty replacement-import field, import a valid replacement JSON payload, restore a valid pre-import backup when one exists, or explicitly reset Week Planner to a new default plan. Invalid replacement JSON stays in the field for correction. A valid replacement import writes the replacement directly to the main key without creating a backup from the temporary default plan. Resetting requires confirmation and is the only recovery action that intentionally replaces the invalid main stored value with a default payload.

### Import, backup and restore

Imports are validated completely before current in-memory plans are changed. Invalid imports are rejected as a whole, leave the current plans and active plan unchanged, do not create or replace a backup, retain the entered JSON and report the first useful user-facing validation problem.

Before a successful import is applied, the application writes and verifies a complete copy of the current valid payload to `week_planner_5min_pre_import_backup_v3`. If the backup write fails, the import is cancelled and the current plans remain unchanged. The imported payload is then written and verified under `week_planner_5min_store_v3` before the in-memory planner state is replaced.

The import/export interface shows a `Restore previous plans` action when a valid pre-import backup exists. Restoring validates the backup before use, writes and verifies it to the main storage key, leaves current plans unchanged on failure and removes the used backup after a successful restoration where possible.

### Storage-key migration

A future storage-hardening change should migrate from the versioned key to a stable key only after the stable-key behaviour is explicitly agreed and tested. A safe migration would need to preserve a recoverable copy, validate the legacy payload fully, write and verify the new value, and avoid removing the legacy value until recovery is proven.

Do not add migration code for hypothetical versions 1 or 2 unless real historical data is identified.

### Repository history and older versions

The full repository history was inspected during the baseline review.

The initial commit already used:

- `week_planner_5min_store_v3`
- payload version `3`

No evidence of version 1 or version 2 storage formats exists in repository history. Support for those versions should be added only if real historical data or a pre-repository build is identified. Do not assume that migrations for hypothetical versions are required.

### Schema migration policy

Any future schema change should:

1. retain the version number inside the payload
2. parse into an unknown or untrusted input type
3. validate the complete structure
4. migrate older supported versions through explicit functions
5. avoid overwriting the original value until migration succeeds
6. test representative historical payloads
7. provide a clear recovery path when data cannot be migrated

Do not create a new storage key for each schema version merely to avoid writing a migration.

## State and domain logic

The application currently uses React hooks directly in `App.tsx`:

- `useState` for plans, modal state, tools and interaction state
- `useEffect` for storage, global listeners and modal behaviour
- `useMemo` for active-plan lookup, summaries and derived rendering data
- `useRef` for painting and pointer interaction state

Pure helper functions already exist for operations such as:

- creating an empty week
- formatting time
- parsing JSON safely
- reordering arrays
- clearing an activity from the grid
- cloning data
- converting colour values

These functions are good candidates for extraction into tested domain modules.

## Current interactions

### Grid editing

Grid painting currently uses mouse-oriented handlers and global mouse-up listeners.

Right-click always erases.

This is effective on desktop but does not define a complete touch or keyboard interaction model.

### Activity ordering

Activity reordering uses pointer events and pointer capture. This is a better cross-input foundation, although it still requires mobile and accessibility testing.

### Modals and destructive actions

Plan operations use in-app modals.

Activity clearing and deletion use inline confirmation states.

Escape closes open plan and import/export modals.

## Layout and styling

The application uses a fixed dark visual theme.

The main content includes:

- an activity sidebar with a fixed width of approximately 360 pixels
- a planner area with a minimum width of approximately 1,100 pixels
- a maximum overall width of approximately 1,400 pixels
- a full-height viewport layout
- hidden scrollbars

This is strongly desktop-first.

The minimum planner width and hidden scrollbar treatment are likely to cause discoverability and usability problems on phones and smaller tablets. Responsive behaviour should be designed deliberately rather than applied as a superficial CSS adjustment.

## Accessibility considerations

Known areas requiring review include:

- full keyboard editing of the grid
- screen-reader representation of 2,016 time cells
- labelled modal semantics
- focus trapping and focus restoration
- colour contrast
- reliance on colour to communicate allocations
- accessible activity reordering
- touch target sizing
- hidden scrollbars
- right-click-only convenience behaviour
- user feedback after save, export and import

Accessibility should be designed alongside interaction changes rather than added after a visual redesign.

## Testing

The application now has a formal Vitest unit-test foundation for extracted planner helpers.

The initial helper tests cover:

- week dimensions
- time labels
- time-range labels
- minute formatting
- JSON parsing
- array reordering
- clearing activity cells
- icon labels

These tests replace the previous development-only `console.assert` checks in `App.tsx`.

### Recommended testing layers

#### Unit tests

Extract and test:

- time calculations
- weekly totals
- grouped-block calculations
- plan creation and duplication
- activity deletion and clearing
- import validation
- schema migration
- identifier handling

#### Component tests

Test:

- plan management
- activity editing
- paint and erase tool selection
- grouped-view behaviour
- confirmation flows
- import and export interaction
- active-plan restoration after reload

#### End-to-end tests

Once the structure is stable, cover a small number of critical journeys:

- create and save a plan
- reload and restore it, including the active plan
- export and re-import it
- preserve a recoverable copy before destructive import replacement
- preserve data across a schema migration
- edit the grid with supported input methods

## Recommended target structure

The exact folder names should be agreed during refactoring, but responsibilities should move towards a structure similar to:

```text
src/
  app/
  components/
  domain/
  storage/
  test/
```

A suitable separation would be:

- domain types and pure planner operations
- schema validation and migration
- browser persistence
- reusable interface components
- plan management
- activity management
- weekly grid rendering and interactions
- application composition

The first refactor should preserve behaviour and visual appearance. Confirmed bugs should be fixed in separate, tested increments rather than hidden inside structural extraction.

## Dependency policy

Do not add a dependency merely to avoid writing a small, clear function.

A new dependency should provide material value in one or more of these areas:

- correctness
- accessibility
- data validation
- testing
- maintainability
- a difficult interaction that is unsafe to implement ad hoc

Document the reason for significant additions.

A schema validation library should not be added for the current version 3 boundary. The implemented validator is clear TypeScript and has focused unit coverage.

## Deployment

The application is live at:

https://pat15312.github.io/week-planner/

`vite.config.ts` sets:

```ts
base: "/week-planner/"
```

This matches the GitHub Pages project path.

Pull-request quality gates are defined in `.github/workflows/ci.yml`. The workflow runs for pull requests targeting `main` with read-only repository permissions. It checks out the repository, installs Node.js 20 with the npm cache enabled, installs locked dependencies with `npm ci`, then runs `npm run lint`, `npm run test` and `npm run build`. A failing command stops the workflow and reports the pull-request check as failed. It does not deploy anything.

Deployment is defined in `.github/workflows/deploy-pages.yml`. The workflow:

1. runs on pushes to `main` and manual dispatches
2. checks out the repository
3. installs Node.js 20 and enables the npm cache
4. installs locked dependencies with `npm ci`
5. runs `npm run lint`
6. runs `npm run test`
7. runs `npm run build`
8. uploads `dist` as a GitHub Pages artifact
9. deploys the artifact to the `github-pages` environment

Linting, automated tests and the production build all run before artifact upload. Any failure prevents the Pages artifact from being uploaded and stops deployment.

During the baseline review, the live application rendered successfully and its generated JavaScript and CSS asset names matched the local production build exactly. This verifies that the reviewed source revision and live deployment produced the same build output.

Do not change the base path without considering the deployed URL and the effect of any origin change on locally stored user data.

## Runtime version policy

GitHub Pages deployment uses Node.js 20. The repository does not currently pin a specific local development version through `engines`, `.nvmrc` or an equivalent file.

A future runtime-policy task should select and document a supported local Node.js version that remains compatible with the deployment environment.

## Security and privacy

The current application:

- has no authentication
- sends no application data to a project backend
- stores plan data in the browser
- accepts user-supplied JSON imports

The absence of a backend reduces the current attack surface, but imported and persisted data must still be validated and bounded.

Do not add analytics, remote logging or cloud storage without an explicit product and privacy decision.

Never commit credentials or personal information to the public repository.

## Native iOS considerations

The current domain can map naturally to Swift:

- `Activity` and `Plan` become Swift models
- the 7 by 288 allocation grid can remain the portable logical representation
- browser persistence becomes SwiftData, a file format or another deliberately chosen local store
- JSON export can provide a compatibility bridge
- React state becomes observable SwiftUI state

The native application should not translate desktop interactions literally.

In particular:

- right-click erase needs a touch-appropriate replacement
- a full-week grid needs responsive navigation and zooming
- drag painting needs careful gesture design
- context menus, toolbars, haptics and accessibility should use native patterns

The web application should first become a clear, tested specification for the product's behaviour.

## Known unknowns

The following items remain to be confirmed:

- supported browser versions
- current behaviour across representative phones and tablets
- exact touch and keyboard interaction models
- the appropriate long-term local Node.js version
- whether any real pre-repository storage format exists outside repository history
