# Week Planner

Week Planner is a local-first, visual time allocation application for designing a repeating week.

Every week contains 168 hours. Week Planner helps a user decide intentionally how those hours should be allocated before they are consumed by default.

It is not intended to become a calendar, task manager or project management system. Its purpose is to make priorities visible across the whole week.

## Current capabilities

The current web application supports:

- multiple named weekly plans
- a seven-day planning grid
- allocation in five-minute units
- 5-minute, 15-minute and 1-hour views
- custom activities with names, colours and icons
- paint and erase tools
- drag-to-reorder activities
- total allocated time for each activity
- a calculated free-time total
- duplication, renaming and deletion of plans
- JSON export and import
- automatic saving in the browser

## Technology

The application currently uses:

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons

It is a client-side application. There is currently no account system, server-side application, database or cloud synchronisation service.

## Getting started

### Requirements

Install a current Node.js release and npm.

The repository does not yet pin a specific Node.js version for local development. GitHub Pages deployment currently uses Node.js 20.

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Run linting

```bash
npm run lint
```

### Create a production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Data and privacy

Week Planner stores plans in the user's browser using `localStorage`.

Clearing browser data, changing browser profile, changing the deployed origin or using a different device may make locally stored plans unavailable. Users can copy their data through the application's JSON export function.

Imported JSON must be treated as untrusted data and validated before it replaces existing plans. See [Technical context](docs/TECHNICAL.md) for the current storage format, known risks and migration direction.

## Deployment

The web application is live at:

https://pat15312.github.io/week-planner/

Deployment is performed through GitHub Actions using [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). See [Technical context](docs/TECHNICAL.md) for the verified workflow and current deployment checks.

## Project documentation

Before making changes, read:

1. [AGENTS.md](AGENTS.md)
2. [HUMAN.md](HUMAN.md)
3. [docs/PRODUCT.md](docs/PRODUCT.md)
4. [docs/TECHNICAL.md](docs/TECHNICAL.md)
5. [docs/STATUS.md](docs/STATUS.md)

Each document has a distinct responsibility:

- `AGENTS.md` explains how coding agents should work on the repository.
- `HUMAN.md` explains how an AI collaborator should work with the human project lead.
- `PRODUCT.md` is the source of truth for product purpose, boundaries and experience.
- `TECHNICAL.md` is the source of truth for architecture, data and engineering constraints.
- `STATUS.md` records the current state, priorities, decisions and next work.

## Project status

The existing application is a working product and should not be treated as disposable scaffolding.

The immediate objective is to strengthen the web application and establish an effective Codex development workflow. A native SwiftUI application is a longer-term direction, not the current implementation task.

See [docs/STATUS.md](docs/STATUS.md) for current priorities and known issues.

## Licence

No software licence is currently declared in the repository. Do not assume permission for redistribution or reuse until a licence is deliberately selected and added.
