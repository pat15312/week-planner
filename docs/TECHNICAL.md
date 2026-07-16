# Technical context

Last reviewed: 16 July 2026

This document describes the current implementation and the agreed engineering direction. It should contain verified technical information, not speculative product requirements.

## Current stack

The repository currently declares:

- React `^19.2.3`
- React DOM `^19.2.3`
- TypeScript `~5.9.3`
- Vite `^7.3.1`
- Tailwind CSS `^4.1.18`
- Lucide React `^0.562.0`
- ESLint `^9.39.2`

The application is a client-side React application with no current backend.

## Repository entry points

- `index.html` provides the root element and page metadata.
- `src/main.tsx` creates the React root in `StrictMode`.
- `src/App.tsx` contains the application data types, state, domain operations, storage handling, interactions and most of the rendered interface.
- `src/index.css` imports Tailwind and globally hides scrollbars.
- `vite.config.ts` configures React and the `/week-planner/` base path.

At the time of review, `src/App.tsx` is 1,461 lines and has too many responsibilities. This is a maintainability concern, but it is not by itself justification for a broad rewrite.

The repository also retains unused starter files and metadata, including `src/App.css`, `src/assets/react.svg` and the package name `vite-react-typescript-starter`.

## Available scripts and verified baseline

The repository declares:

```json
{
  "dev": "vite",
  "build": "tsc -b --noEmit && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

There is currently no automated test command.

The baseline review on 16 July 2026 verified:

- dependency installation succeeds with `npm ci`
- `npm run build` succeeds
- the production output serves successfully at `/week-planner/`
- `npm run lint` runs but fails with seven errors

The review used Node.js `24.14.0` and npm `11.9.0`. The initial install attempt failed because the review environment did not permit npm to create `/root/.npm`; the same clean install succeeded when an explicit writable npm cache was supplied. This was an environment restriction, not a repository dependency failure.

All seven lint failures are `@typescript-eslint/no-explicit-any` errors in `src/App.tsx`. They occur in development assertions, storage parsing, mouse-button handling and import validation. The production build does not run ESLint, so a build can pass while linting fails.

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

The application currently uses the legacy storage key:

```text
week_planner_5min_store_v3
```

Embedding the schema version in the storage key is not the intended long-term design. It risks leaving older data stranded whenever the schema version changes.

The preferred target is a stable key, provisionally:

```text
week_planner_store
```

The schema version should remain inside the stored payload.

The stored payload is shaped approximately as:

```ts
{
  version: 3,
  activePlanId: string | null,
  plans: Plan[]
}
```

The application writes the full payload whenever plans or the active plan change.

### Start-up ordering and active-plan bug

The current application uses separate effects to:

1. read saved data
2. persist the current state
3. keep the active plan identifier valid

All three effects run after the first render, which begins with a newly created default plan. This creates competing initialisation updates.

The baseline review confirmed that:

- saved plans survive a reload
- the stored active plan does not
- after selecting a second plan and reloading, the application returns to the first plan

The application must restore the previously active plan after reload. The current behaviour is a confirmed bug, not an open product decision.

The persistence effect also writes the initial default state before the saved state has fully settled. With valid test data, plan content was restored successfully. However, the ordering creates an unnecessary overwrite risk, particularly if stored data is malformed or rendering fails before the validated value is safely re-persisted.

A future fix should load and validate storage before enabling automatic writes, then restore a valid saved active plan or fall back deliberately to the first valid plan.

### Storage-reader validation

The storage reader performs less validation than the import flow.

It currently confirms only that:

- JSON parsing succeeds
- the top-level value is an object
- `plans` is a non-empty array

It does not validate the structure of individual plans before placing them into application state.

### Import validation

Import validation currently confirms that:

- the top-level value is an object
- `plans` is a non-empty array
- each plan has string `id` and `name` values
- each plan has `activities` and `grid` arrays
- each grid has 7 columns
- each column has 288 cells

It does not fully validate:

- activity structure
- unique identifiers
- cell values referring to valid activities
- `selectedActivityId`
- tool values
- colours or icon keys
- payload version compatibility
- unexpectedly large strings or arrays
- duplicate plan identifiers

This difference matters because malformed persisted data can reach rendering with even fewer checks than imported data.

Unknown activity identifiers in grid cells are treated as occupied when free time is calculated, but do not appear in the visible total for any known activity. Invalid data can therefore prevent displayed totals from reconciling to 168 hours.

### Import recovery

A successful import currently replaces the in-memory plan set and is then automatically persisted.

A future import-safety change must preserve a recoverable copy of the pre-import data before replacement. Validation must complete before current plans are changed, and a failed import must leave the existing data untouched.

### Storage-key migration

A future storage-hardening change should:

1. look first for valid data under the stable key
2. fall back to `week_planner_5min_store_v3` when the stable key is absent
3. validate the legacy payload fully
4. migrate it to the current schema if required
5. write the validated result to the stable key
6. verify the new value before considering removal of the legacy key
7. preserve a recoverable path if migration fails

The exact stable key should be confirmed before implementation. `week_planner_store` is the current provisional recommendation.

Do not change the key until validation, migration and representative fixture tests are in place.

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

The application currently contains development-only `console.assert` checks inside `App.tsx`.

They cover several helper behaviours, including:

- week dimensions
- time labels
- time-range labels
- minute formatting
- JSON parsing
- array reordering
- clearing activity cells
- icon labels

These checks are useful evidence of intended behaviour, but they are not a formal automated test suite.

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

A schema validation library may be justified because imported and persisted data is untrusted, but the choice should be discussed before implementation.

## Deployment

The application is live at:

https://pat15312.github.io/week-planner/

`vite.config.ts` sets:

```ts
base: "/week-planner/"
```

This matches the GitHub Pages project path.

Deployment is defined in `.github/workflows/deploy-pages.yml`. The workflow:

1. runs on pushes to `main` and manual dispatches
2. checks out the repository
3. installs Node.js 20 and enables the npm cache
4. installs locked dependencies with `npm ci`
5. runs `npm run build`
6. uploads `dist` as a GitHub Pages artifact
7. deploys the artifact to the `github-pages` environment

The workflow does not currently run linting or automated tests.

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
