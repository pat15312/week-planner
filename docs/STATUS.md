# Project status

Last updated: 16 July 2026

## Current stage

Week Planner is in a structured improvement phase.

The immediate objective is to establish a reliable Codex workflow, document the current product and strengthen the existing React application before considering a native SwiftUI rebuild.

No application behaviour is intentionally changed by this documentation baseline.

## Current baseline

The repository contains a working client-side application with:

- React, TypeScript, Vite and Tailwind CSS
- multiple locally saved weekly plans
- five-minute allocation data for all seven days
- 5-minute, 15-minute and 1-hour views
- custom activities
- desktop paint and erase interactions
- activity totals and free-time calculation
- JSON import and export
- browser `localStorage` persistence

The current architecture is still concentrated heavily in `src/App.tsx`, but shared planner types and the first pure helper functions now live in `src/domain/planner.ts`.

The application is deployed through GitHub Actions to:

https://pat15312.github.io/week-planner/

## Completed baseline review

The initial Codex review was completed on 16 July 2026.

It included:

- reading the complete six-document project context
- inspecting every tracked file in the repository
- reviewing repository history for older storage formats
- installing locked dependencies
- running linting and the production build
- serving the production output locally
- checking the live GitHub Pages application
- exercising representative plan, view, export and reload behaviour
- confirming that no repository changes were made during the review

Verified results:

- dependency installation passes
- the production build passes
- the live deployment is reachable and matches the local build output
- linting ran and failed with seven existing errors at that time
- plans survive reload
- the previously active plan is not restored after reload
- repository history contains no evidence of storage versions 1 or 2

Detailed technical findings belong in [TECHNICAL.md](TECHNICAL.md).


## Completed data-safety hardening

Saved-data and JSON import hardening was completed on 16 July 2026.

The change included:

- adding a shared version 3 validation boundary for imports, browser-stored data and pre-import backups
- preserving the existing `week_planner_5min_store_v3` main storage key and version 3 payload
- adding a versioned pre-import backup at `week_planner_5min_pre_import_backup_v3`
- rejecting invalid imports without changing current plans or replacing the backup
- validating and writing a pre-import backup before successful imports replace current plans
- adding a visible restore action for valid pre-import backups
- entering recovery mode when browser-stored data is malformed, unsupported or structurally invalid
- preserving invalid stored text exactly until the user imports a valid replacement or explicitly confirms a reset
- disabling automatic persistence for the session when browser storage cannot be read at start-up
- opening recovery replacement import with an empty field and without backing up the temporary default plan
- warning when browser storage reads or writes fail
- removing the remaining explicit `any` lint failures from `src/App.tsx`

Verified results after the change:

- `npm ci` passes
- `npm run test` passes with 37 tests
- `npm run lint` passes
- `npm run build` passes

## Completed active-plan restoration fix

The active-plan restoration bug was fixed on 16 July 2026.

The change included:

- initialising stored plans and the active plan identifier together before automatic persistence begins
- restoring a valid stored active plan after reload
- deliberately falling back to the first stored plan when the stored active plan is missing or invalid
- keeping absent or malformed storage on the normal default-plan path
- adding Vitest coverage for the storage initialisation helper

Verified results after the change:

- `npm ci` passes
- `npm run test` passes
- `npm run build` passes
- `npm run lint` still ran and failed with five remaining pre-existing explicit-`any` errors in `src/App.tsx` at that time

## Completed test foundation

The initial unit-test foundation was completed on 16 July 2026.

It included:

- adding Vitest and an `npm run test` script
- extracting shared planner types and pure helper logic into `src/domain/planner.ts`
- replacing development-only helper assertions with formal unit tests
- preserving the existing storage key, persisted schema, visual interface and established planner behaviour

Verified results after the change:

- `npm ci` passes
- `npm run test` passes
- `npm run build` passes
- `npm run lint` still ran and failed with six remaining pre-existing explicit-`any` errors in `src/App.tsx` at that time

## Completed preparation

The following preparation has been completed:

- reviewed the repository structure and complete current source
- identified Week Planner as a time allocation product rather than a generic time-management application
- agreed that the product should remain distinct from calendars and task managers
- agreed a local-first direction
- agreed to strengthen the web application before beginning a native iOS version
- agreed that public repository documentation must contain no personal information
- reduced the context system to six harmonised files
- defined ownership boundaries between product, technical and status information
- added the six-document baseline to the repository
- verified the current build, deployment and representative behaviour

## Current priorities

### 1. Establish behavioural safety

Before substantial refactoring:

- select and add an automated unit-test framework
- move the existing self-tests into formal unit tests
- add characterisation tests for current planner behaviour
- capture representative version 3 saved data as anonymous test fixtures
- test export and import boundaries
- test destructive plan and activity operations

### 2. Extract pure planner logic

With the test setup in place, extract pure logic from `App.tsx`, including:

- types
- week creation
- time formatting
- plan operations
- grid operations
- allocation summaries
- current import validation

This stage should not alter the product's appearance, storage key, persisted schema or established planner behaviour.

### 3. Continue storage safety towards migration

The current version 3 data contract is now validated and recoverable. Before changing storage keys or schemas:

- decide the future stable storage key
- design and test a migration from `week_planner_5min_store_v3`
- preserve a recoverable copy before any destructive migration
- keep the versioned backup and recovery behaviour intact

Do not add version 1 or version 2 migration code unless real historical data is identified.

### 4. Split the interface into coherent components

After tests protect behaviour, separate:

- application shell
- activity sidebar
- activity editor
- plan controls
- planner toolbar
- weekly grid
- import and export
- modal components

Avoid a rewrite. Use incremental extraction.

### 5. Design mobile and touch behaviour

Treat mobile usability as a product-design task, not only a responsive CSS task.

Decisions are needed for:

- navigating days on a small screen
- zooming or changing time resolution
- painting and erasing by touch
- undo and recovery
- activity selection
- grid scrolling
- tablet layouts
- keyboard and accessibility support

### 6. Consider product enhancements

Only after the foundation is stable should new features be prioritised.

New features must support intentional weekly allocation and should not turn the product into a generic productivity suite.

## Known issues and risks

### High priority

#### The storage key embeds the schema version

The current key, `week_planner_5min_store_v3`, is tied to one schema version. It must not be changed until a tested migration and recovery path exists.

#### `App.tsx` has too many responsibilities

The application is difficult to change safely because persistence, interactions and presentation are still combined. The first shared planner types and pure helpers have been extracted.

### Medium priority

#### Linting currently passes

`npm run lint` passes after the data-safety change removed the remaining explicit `any` usage. The deployment workflow still does not run linting.

#### Deployment has no test or lint gate

The GitHub Pages workflow installs dependencies and builds the application, but it does not run linting or automated tests.

#### Mobile interaction is not designed

The fixed-width layout, mouse painting and right-click erase behaviour are desktop-oriented.

#### Accessibility is incomplete

Keyboard, screen-reader, focus and non-colour communication require deliberate design.

#### Hidden scrollbars reduce discoverability

Scrolling remains possible, but users may not realise that more content exists.

#### Runtime version is only partially defined

Deployment uses Node.js 20, but local development does not have a pinned version.

### Low priority

#### Starter metadata remains

The default Vite icon, starter package name and unused starter files remain.

#### Commit descriptions provide limited history

More descriptive commit messages will make future changes easier to understand and reverse.

#### No licence is declared

The repository does not currently state reuse or redistribution terms.

## Recommended next Codex task

The next implementation task should be:

> Add test and lint gates to the GitHub Pages deployment workflow.

Storage and import validation are now hardened for the existing version 3 payload. The next safety improvement should prevent regressions by running the existing automated checks in CI before deployment.

## Roadmap

### Phase 1: Establish the baseline

- add project documentation
- verify install, lint, build and deployment
- introduce automated tests
- capture current behaviour
- agree supported environments

### Phase 2: Strengthen the web architecture

- extract domain logic
- fix active-plan restoration
- add full schema validation and migration
- migrate the legacy versioned storage key to a stable key
- isolate persistence
- componentise the interface
- add CI checks
- improve commit and release discipline

### Phase 3: Improve the web experience

- design responsive layouts
- add touch interaction
- improve accessibility
- improve recovery and undo
- refine visual feedback
- assess performance

### Phase 4: Evolve the product

- prioritise selected product enhancements
- validate the time allocation philosophy through use
- stabilise a portable data contract
- decide whether cloud synchronisation is justified

### Phase 5: Prepare the native application

- define the native scope
- select the Swift data and persistence approach
- map established web behaviour to native interaction patterns
- create a SwiftUI prototype
- establish TestFlight review workflows

## Recorded decisions

### 16 July 2026: Product category

Week Planner is defined as a time allocation application.

This wording should guide product and interface decisions.

### 16 July 2026: Product boundary

The application should remain distinct from calendars, task managers and generic productivity suites.

### 16 July 2026: Local-first direction

Core use should not require an account or cloud service.

### 16 July 2026: Web before native

The existing web application will be strengthened and used as a behavioural specification before a native SwiftUI version is developed.

### 16 July 2026: Public documentation privacy

Repository documentation must not contain personal information, private chat context or commercially sensitive details.

### 16 July 2026: Documentation structure

Project context is deliberately limited to:

- `README.md`
- `AGENTS.md`
- `HUMAN.md`
- `docs/PRODUCT.md`
- `docs/TECHNICAL.md`
- `docs/STATUS.md`

Detailed information should have one owning document to minimise duplication and conflict.

### 16 July 2026: Active-plan restoration

The application should restore the previously active valid plan after reload. Current failure to do so is a confirmed bug.

### 16 July 2026: Historical storage versions

Repository history contains no evidence of storage versions 1 or 2. Migration support for those versions should be added only if real historical data is identified.

### 16 July 2026: Import recovery

Successful imports preserve a recoverable version 3 copy of the current data before replacing plans. Invalid imports leave current plans unchanged.

## Open decisions

The following decisions are not yet settled:

- supported desktop browsers
- minimum supported phone and tablet sizes
- exact touch-editing model
- whether the web application is a permanent product or primarily a route to native
- whether cloud synchronisation will ever be needed
- whether planned-versus-actual comparison belongs within the product boundary
- the appropriate open-source or private licence
- the long-term release and quality-gate process
- the supported local Node.js version

Do not treat an open decision as an approved requirement.

## Documentation maintenance

After each meaningful task:

- record completed work briefly
- update known issues when evidence changes
- keep the next priorities current
- add a dated decision when a material choice is approved
- remove obsolete status rather than allowing the document to grow indefinitely

Product details belong in `PRODUCT.md`.

Architecture and data details belong in `TECHNICAL.md`.

This file should remain focused on the current state and direction.
