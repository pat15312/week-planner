# Week Planner

A private, visual time allocation app for designing your repeating 168-hour week.

[Open Week Planner](https://pat15312.github.io/week-planner/)

## Plan your week

1. Select an activity and tap or paint the time you want to allocate.
2. Start with the hourly overview, then use 15-minute or five-minute precision where needed.
3. Use Undo and Redo to revise your plan, and check activity totals and free time.
4. Open Plan options to create alternative weeks or export a backup.

On phones, open Activities to select or edit an activity. Tap cells to edit and swipe the grid to scroll. Previous and Next move between visible days. Jump to time takes you directly to an hour. Move up and Move down in an activity editor offer an alternative to dragging.

Keyboard users can tab into the grid and use arrow keys to move, Enter or Space to paint, and Delete to erase. Ctrl/Command Z undoes a change; Ctrl/Command Shift Z redoes it.

## Your data

Plans are automatically saved in the current browser, without an account or backend. Export backup downloads all plans as a portable JSON file. Import backup validates a file before replacement and preserves a pre-import copy that you can restore.

Clearing browser data, switching browser profiles or changing device does not transfer your plans. Keep an external backup. Undo history lasts for the current session, up to 50 changes. Reloading or successfully importing/restoring plans clears undo history.

This release preserves the existing version 3 plan format and storage keys.

## Development

Use Node.js 24.19.0, pinned in `.nvmrc`:

```bash
nvm use
npm ci
npm run dev
```

Quality checks:

```bash
npm run check
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

`npm run check` runs lint, unit tests and a production build. Browser tests then exercise that build, run axe accessibility audits and check a large synthetic plan collection. Reports are retained as workflow artifacts. `npm run benchmark` measures the undo reducer separately from browser rendering and storage. Use `npm run preview` to inspect it manually.

## Browser and device targets

The automated test matrix covers Chromium and WebKit at 375, 768, 1024 and 1440 CSS pixels, including touch contexts. These represent phone, tablet and desktop layouts. Automated WebKit checks do not replace testing on an actual iPhone or iPad, particularly for touch scrolling, the virtual keyboard and file downloads.

## Deployment and releases

Pull requests run the full quality checks. Main deploys to GitHub Pages only after lint, unit tests, build and browser tests pass. The Vite base remains `/week-planner/`.

Version `1.0.0` is the first stable web release. A limited iPhone check was successful; physical iPad and full screen-reader acceptance remain outstanding. See [release notes](CHANGELOG.md) and [status](docs/STATUS.md).

After a successful main deployment, the workflow creates a release for a new stable package version at that exact commit. Existing release tags are never moved. Prerelease package versions do not create stable releases.

## Project context

Read [AGENTS.md](AGENTS.md), [HUMAN.md](HUMAN.md), [product](docs/PRODUCT.md), [technical context](docs/TECHNICAL.md) and [status](docs/STATUS.md) before changes.

Week Planner remains distinct from calendars and task managers. Web development precedes any native SwiftUI version.

## Licence

MIT. See [LICENSE](LICENSE). Third-party dependencies retain their respective licences.
