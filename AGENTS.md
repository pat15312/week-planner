# Instructions for AI coding agents

Read this file before changing the repository.

Then read, in order:

1. `HUMAN.md`
2. `docs/PRODUCT.md`
3. `docs/TECHNICAL.md`
4. `docs/STATUS.md`
5. the relevant source code

Do not rely on chat history as the sole source of truth when the repository documentation or current code provides a more recent answer.

## Project purpose

Week Planner is a personal time allocation application.

It helps a user design an intentional, repeating week across the fixed total of 168 hours.

It is deliberately not:

- a calendar
- a task manager
- a project management system
- an appointment scheduler
- a productivity system built around reminders, overdue items or pressure

Proposed features should reinforce intentional time allocation. Pause and discuss any feature that would move the product towards a generic productivity application.

## Sources of truth

Use the following ownership rules to avoid duplicated or conflicting documentation:

- `docs/PRODUCT.md` owns product purpose, scope, principles and user experience.
- `docs/TECHNICAL.md` owns architecture, data formats, technical constraints and engineering direction.
- `docs/STATUS.md` owns current priorities, known issues, completed work and open decisions.
- `HUMAN.md` owns collaboration preferences.
- this file owns agent behaviour and delivery standards.

When a change affects one of those areas, update the file that owns the information. Do not copy the same detailed information into several documents.

## Before making changes

For every task:

1. Inspect the relevant code and documentation.
2. Confirm the current behaviour.
3. Separate verified facts from assumptions.
4. Explain any material trade-offs in plain English.
5. Identify effects on saved user data.
6. Keep the proposed scope small and coherent.

Discussion is not automatically permission to implement. Make changes when the human explicitly requests implementation or has clearly approved the proposed approach.

Routine implementation details within an approved task do not require repeated confirmation.

## Protect existing behaviour and data

Treat the existing application as a working product, not disposable scaffolding.

Users may have substantial plans stored in their browsers.

Do not:

- change or remove the current storage key casually
- change the persisted schema without a migration
- replace saved data before validating it
- remove existing behaviour without explaining the reason
- combine a refactor with unrelated product changes

Any persisted-data change must include:

- a documented schema version
- validation
- a migration or backwards-compatible reader
- tests using representative older data
- a safe failure path
- an explanation of user impact

Where practical, preserve an export or backup before a destructive migration.

## Development approach

Prefer:

- small, reviewable changes
- simple, readable TypeScript
- clear component and module responsibilities
- pure functions for domain logic
- explicit data validation
- accessible controls
- mouse, touch and keyboard support
- maintainability over novelty

Avoid:

- broad rewrites without a demonstrated need
- new dependencies without clear value
- premature abstraction
- clever code that obscures behaviour
- visual redesign during a behaviour-preserving refactor
- large formatting changes mixed with functional changes

## Verification

For code changes, run the relevant checks available in the repository.

At minimum, aim to run:

```bash
npm run lint
npm run build
```

When automated tests are available, run them as well.

Do not state that a check passed unless it was actually executed. Report commands that could not be run and explain why.

For changes affecting interactions or layout, also describe the manual checks performed and the screen sizes or input methods considered.

## Testing expectations

New behaviour should normally include automated tests.

Prioritise tests for:

- time and allocation calculations
- persisted data and migrations
- import validation
- plan and activity operations
- pointer, touch and keyboard interactions where practical
- regressions discovered during development

Tests should protect meaningful behaviour rather than pursue coverage numbers for their own sake.

## Documentation responsibilities

Update documentation as part of the same task when the underlying truth changes.

- Update `docs/PRODUCT.md` only when product scope, principles or confirmed behaviour changes.
- Update `docs/TECHNICAL.md` when architecture, data formats, dependencies, build processes or technical constraints change.
- Update `docs/STATUS.md` after meaningful completed work, priority changes, newly discovered issues or decisions.
- Update `README.md` when public setup, usage or deployment information changes.
- Update this file or `HUMAN.md` only when the working conventions themselves change.

Do not add speculative features to documentation as though they are committed. Label future ideas clearly.

## Privacy and public repository safety

Assume all committed files are public.

Never add:

- personal names or biographical details
- employer or family information
- addresses or precise locations
- private email addresses
- credentials, tokens, keys or secrets
- private chat excerpts
- commercially sensitive information
- analytics or user data that could identify a person

Use neutral terms such as `the human`, `the project lead` or `the user`.

Before committing documentation, scan it for personal or sensitive information.

## Language and communication

Use British English in documentation and user-facing text.

Avoid em dashes. Use commas, brackets or full stops instead.

Be concise but complete.

When recommending an approach:

- state the recommendation
- explain why
- explain material alternatives
- explain consequences and risks

Constructive disagreement is welcome. Do not agree with an idea merely because the human proposed it.

## Completion standard

A task is complete only when:

- the requested scope is implemented
- relevant checks have been run or limitations reported
- existing saved data has been considered
- documentation has been updated where necessary
- the result and any remaining issues are summarised clearly
