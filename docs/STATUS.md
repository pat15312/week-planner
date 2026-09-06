# Project status

Last updated: 6 September 2026

## Current stage

Version 1.0.0 web application, with publication controlled by the deployment workflow. The project lead authorised finalising the first stable release and undertaking the maintenance review after a limited successful iPhone check. The existing React web app remains the product foundation.

The release workflow publishes a stable version only after its main deployment and all preceding checks succeed. The release tag and GitHub release are the authoritative publication record. See CHANGELOG.md for the user-facing release notes.

## Completed work

- Reversible planner editing, keyboard grid controls, file backups and recovery.
- Responsive three-to-seven-day layout, touch editing, activity drawer and time jumping.
- Extracted domain, storage, grid, toolbar, backup, dialog and history responsibilities.
- Version 1.0.0 package metadata, MIT licence and release notes.
- Release automation tied to the successfully deployed main revision, with existing tags preserved.
- Accessibility regression audits using axe, including the fine grid, activity editor, icon picker and plan/backup dialogs.
- Fixed icon-picker focus loss, selected-button hover contrast, faint time labels, missing page semantics and suppressed input focus indication.
- Large synthetic collection checks covering 50 plans and 100 activities per plan.
- Optimised history comparisons to avoid serialising unchanged plans on every edit.
- Guarded cleanup of named completed work branches after release publication. Branches whose current heads are not covered by a merged PR are retained.

## Verification evidence and limits

The project lead reported that the app seemed OK on an iPhone, while explicitly describing the testing as limited. This is recorded as a limited successful check, not full device acceptance. Physical iPad and full VoiceOver/screen-reader testing remain outstanding.

Local lint, all 89 unit tests, TypeScript and production build pass. The unit suite includes planner, persistence and history checks. Browser CI covers Chromium and WebKit at 375, 768, 1024 and 1440 CSS pixels, including touch contexts. Accessibility and performance results are attached to browser reports. The final checks are recorded on pull request #10 and the main deployment workflow.

The normal local browser download endpoint timed out. Local Chromium checks use an isolated temporary Chromium 149 executable; it is not an application dependency. GitHub Actions uses the configured Playwright Chromium and WebKit engines and remains the release gate.

A local Node 24.19.0 benchmark measured history edit/comparison median time falling from 5.21 ms to 0.11 ms for 50 plans with 100 activities each. This excludes rendering and browser storage. See TECHNICAL.md for the method and repeatable command.

## Maintenance decisions

- Keep schema version 3 and both existing storage keys. There is no migration in this release. Future schema changes require historical fixtures, validation, migration and recovery tests.
- Keep the activity editor in App.tsx until an actual feature or maintenance need justifies extraction. No broad refactor is required to deliver the audited fixes.
- No current usage evidence justifies cross-tab conflict handling. Keep it as a documented constraint and revisit if simultaneous-tab use becomes a requirement.
- Native SwiftUI, device synchronisation, iCloud and product expansion remain future decisions.

## Remaining limitations

- Plans belong to a browser. Clearing browser data removes them unless an external backup exists.
- There is no cross-tab conflict resolution, cross-device synchronisation or offline service worker.
- Undo history is limited to 50 changes and clears on reload or successful import/restore/reset.
- Automated accessibility checks do not prove screen-reader conformance, and touch simulation does not prove real-device comfort.
- Large collections still cause synchronous browser storage writes; the synthetic benchmark is not a mobile performance guarantee.

## Next priorities

Record any defects encountered in normal use and fix them in small patches. Complete broader iPhone/iPad and assistive-technology acceptance when devices are available. After several weeks of use, review which editing or comparison improvements would most help intentional allocation before approving new features.
