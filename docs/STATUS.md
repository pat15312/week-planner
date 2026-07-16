# Project status

Last updated: 16 July 2026

## Current stage

Week Planner is entering a structured improvement phase.

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

The current architecture is concentrated heavily in `src/App.tsx`.

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
- linting runs but fails with seven existing errors
- plans survive reload
- the previously active plan is not restored after reload
- repository history contains no evidence of storage versions 1 or 2

Detailed technical findings belong in [TECHNICAL.md](TECHNICAL.md).

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

### 3. Fix active-plan restoration

After a test protects the intended behaviour, correct start-up ordering so the previously active valid plan is restored after reload.

This should be a small, explicit bug fix rather than an incidental side effect of refactoring.

### 4. Harden storage and import

After the domain and persistence boundaries are testable:

- validate the complete persisted structure
- isolate browser persistence from React rendering
- prevent automatic writes until loading and validation complete
- preserve a recoverable pre-import copy
- introduce an explicit safe migration path before changing the storage key
- handle storage write failures

Do not add version 1 or version 2 migration code unless real historical data is identified.

### 5. Split the interface into coherent components

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

### 6. Design mobile and touch behaviour

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

### 7. Consider product enhancements

Only after the foundation is stable should new features be prioritised.

New features must support intentional weekly allocation and should not turn the product into a generic productivity suite.

## Known issues and risks

### High priority

#### No formal automated test suite

Development-only assertions do not provide a repeatable CI safety net.

#### Active plan is not restored

Saved plans survive reload, but the application returns to the first plan rather than restoring the stored active plan.

#### Start-up persistence ordering is unsafe

Automatic persistence begins before saved state has fully loaded and been validated.

#### Saved data has insufficient validation

The storage reader validates less than the already limited import validator. Malformed data can enter application state and may be written back.

#### The storage key embeds the schema version

The current key, `week_planner_5min_store_v3`, is tied to one schema version. It must not be changed until a tested migration and recovery path exists.

#### Destructive import lacks recovery

A successful import replaces the current plans. A future safety change must preserve a recoverable pre-import copy.

#### `App.tsx` has too many responsibilities

The application is difficult to change safely because domain, persistence, interactions and presentation are combined.

### Medium priority

#### Linting currently fails

There are seven existing explicit-`any` errors in `src/App.tsx`. The production build and deployment workflow do not run linting.

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

> Introduce a formal unit-test setup and extract the pure planner helper functions from `App.tsx` without changing visual appearance, established planner behaviour, the storage key or the persisted schema.

This should come first because it creates a safety net for later bug fixes and persistence work.

The active-plan restoration bug should then be fixed as a separate tested increment.

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

A future import-safety change should preserve a recoverable copy of the current data before a successful import replaces it.

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
