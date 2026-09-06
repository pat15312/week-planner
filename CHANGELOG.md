# Release notes

## 1.0.0

First stable web release of Week Planner, a browser-local visual planner for a repeating 168-hour week.

### Planning and editing

- Multiple plans, custom activities, allocation totals and free time.
- Hourly overview with remembered 15-minute and five-minute views.
- Mouse painting, touch tap editing and keyboard navigation.
- Session undo and redo, with one step per mouse paint gesture.
- Responsive three-to-seven-day view, mobile Activities drawer, day navigation and Jump to time.
- Activity reordering through drag handles or Move up and Move down.

### Data and reliability

- Validated JSON backup downloads and imports, with a recoverable pre-import backup.
- Visible storage failures and recovery from malformed saved data.
- Existing version 3 plans and browser storage keys are retained. No data migration is needed.
- Automated unit and browser checks gate deployment. Stable releases are tagged only after deployment succeeds.
- MIT licence.

### Maintenance in this release

- Automated accessibility audits of the fine grid, activity editor, icon picker and plan/backup dialogs.
- Improved time-label contrast, landmarks, keyboard focus and icon-picker announcements.
- Prevented hidden grid labels from creating blank page overflow below the planner.
- Stress coverage for 50 plans with 100 activities per plan, including editing, undo, persistence and reload.
- Reduced undo comparison work by checking changed plans instead of serialising the entire collection twice.

### Verification limits

A limited iPhone check was reported as successful. This is not exhaustive iPhone acceptance. Physical iPad testing and full screen-reader testing remain outstanding. Automated Chromium and WebKit touch contexts do not establish real-device comfort or accessibility conformance.

Plans remain local to the current browser. Keep external backups. There is no cross-device synchronisation, cross-tab conflict resolution or offline service worker. Undo history lasts for the session, up to 50 changes, and resets after reload or successful import, restore or reset.
