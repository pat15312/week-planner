# Project status

Last updated: 6 September 2026

## Current stage

Version 1.0 release candidate. The existing React web application remains the product foundation. Native SwiftUI and synchronisation remain future work.

## Implemented in the release candidate

- Fixed downward activity drops landing beyond the indicated gap.
- Cancelled activity drags no longer commit a reorder.
- Added Move up and Move down alternatives for touch and keyboard use.
- Added bounded, session-only undo and redo for planner changes. Mouse paint gestures and activity-name editing sessions are grouped into single undo steps.
- Added keyboard grid navigation, painting and erasing, readable cell labels and focus indication.
- Added accessible native modal dialogs with focus containment and restoration.
- Added JSON file download and upload alongside copy and paste, with clipboard failure reporting.
- Preserved schema version 3, existing storage and pre-import backup keys, validation and recovery.
- Added separately versioned view preferences, with the hourly overview as the initial default.
- Increased touch cell heights to at least 44 CSS pixels, retained swipe scrolling and tap editing, and added a time jump control.
- Simplified narrow-screen controls and retained the approved minimum three-day model.
- Added visible scrollbars, dynamic viewport height and a mobile free-time summary.
- Extracted grid, toolbar, backup dialog, shared modal and history responsibilities from App.tsx.
- Replaced starter branding and standardised Node.js through .nvmrc.
- Added browser regression tests and made them part of pull-request and deployment checks.

## Verification

Local checks completed during implementation:

- dependency installation
- linting
- 87 unit tests
- production build

Browser checks are run through GitHub Actions against the production build. Results are recorded on the pull request and in the browser-results workflow artifact. The matrix covers Chromium and WebKit at 375, 768, 1024 and 1440 CSS pixels, including touch contexts.

A cloud browser could open the existing public deployment but could not connect to the local development server. This is an environment limitation. Real iPhone and iPad hardware have not been tested in this session.

## Release gate

Before labelling version 1.0 final:

1. Require a successful pull-request workflow, including browser journeys.
2. Review screenshots at phone, tablet and desktop sizes.
3. Verify actual iPhone/iPad scrolling, touch reordering, virtual-keyboard behaviour and backup downloads.
4. Review the prepared change before merging. Main deploys automatically after all checks pass.
5. Replace the release-candidate version with 1.0.0 and create the v1.0.0 release tag on the verified main commit.

## Remaining limitations

- Plans are local to a browser. Clearing browser data removes them unless an external backup exists.
- There is no cross-tab conflict handling or device synchronisation.
- Undo history is limited to 50 changes and is cleared on reload or successful import/restore/reset. A pre-import backup remains the recovery path across those boundaries.
- A browser engine test does not establish real-device comfort or full screen-reader conformance.
- No software licence has been selected. Do not infer redistribution rights.

## Approved direction

The project lead approved implementing the review recommendations on 6 September 2026, with particular attention to mobile usability. This includes the hourly initial view, remembered scale, reversible editing, keyboard accessibility and file backups.

The existing versioned storage key is deliberately retained. A future data-format change must include a tested migration. No migration is needed for this release because the plan format is unchanged.

## Next task

Complete release-candidate verification, address concrete findings and obtain the project lead's review of the finished interface before the final release.
