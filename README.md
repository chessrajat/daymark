# Daymark

A single-user task workspace built with Next.js App Router, TypeScript, PostgreSQL, shadcn-style Radix UI components, Tailwind CSS, and a provider-scoped Zustand store. A single environment-configured account protects the workspace. Members are people you track, not login accounts.

## Run

Install Docker with Compose, then run from this directory:

```sh
docker compose -f compose.yaml -f compose.local.yaml up --build -d
```

Open http://localhost:3000. The database schema initializes automatically on the first API request. The app starts empty, with prompts to create your first project.

```sh
docker compose logs -f app
docker compose down
```

Stopping containers preserves data. `docker compose down -v` deletes the database volume and all tasks and attachments. The local override binds the app to localhost. The base Compose file publishes no host ports.

## Workflows

- Create projects, then add tasks with a description and priority.
- Click any task to open its dedicated page with details on the left and a chronological activity timeline, updates, and attachments on the right.
- Add updates or download attachments (10 MB per file), reassign work, edit details, or change status.
- Statuses: To do, In progress, Blocked, Completed, Dropped. Dropped keeps history when you decide not to finish a task. Any task can be reopened.
- Create teams and members from People & teams. Assign a task to a team queue, a member, or a member within a selected team.
- Assignment age counts elapsed 24-hour days since the most recent assignment change, including for completed and dropped tasks. Open workload counts exclude those two statuses.
- Add tasks to My Day with the sun button. The My Day page can plan any calendar date; today's list starts fresh each day without removing older plans. Dates use your browser's local calendar, and event timestamps display in your browser's timezone.
- Search task titles and descriptions, and filter by status.

Changes and timeline events are saved together in database transactions. Repeating the same assignment, status, or My Day action does not add duplicate events. PostgreSQL stores attachments as binary data, so one database backup includes everything.

## Development

Use Node.js 22+ and a PostgreSQL database. Set `DATABASE_URL` (see `.env.example`), then:

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The default Compose database is internal to the Docker network. For host development, use a separate local PostgreSQL database or add a localhost-only database port mapping in a Compose override.

## Integration verification

With the app running and `DATABASE_URL` pointing to its database:

```sh
node tests/integration.mjs
```

Optional `TEST_BASE_URL` changes the target URL. The integration check creates its own records, verifies the task lifecycle and attachment download, and removes only those records afterward.

## Structure

- `app/api/`: database-backed JSON endpoints and attachment downloads.
- `lib/db.ts`: PostgreSQL pool and idempotent schema initialization under an advisory lock.
- `lib/validation.ts`: validated mutation contracts.
- `lib/store.tsx`: scoped Zustand state, selection, search, and API synchronization.
- `components/workspace.tsx`: responsive project, task, team, and daily planning views.
- `components/ui/`: locally owned shadcn/Radix Button and Dialog components; `components.json` supports extending the component set.

The API uses parameterized queries. File downloads are served as attachments, never rendered as executable content. Use HTTPS and AUTH_COOKIE_SECURE=true when hosting beyond localhost.

Browser smoke tests are available in tests/browser.mjs (requires Playwright and Chromium). Desktop and mobile screenshots from verification are in verification/.

In People & teams, use Remove from team to make a member independent while keeping their tasks. Delete team preserves members and tasks; team-only tasks become unassigned. Both actions record affected task assignment changes in the timeline, and require confirmation in the app.

## Project modules and deletion

Open a project to use its Modules sidebar. New module creates a module inside that project. Select a module, then New task to create a task there; All project tasks includes every module, and No module contains existing or unfiled tasks. Module links show task counts and completed progress. The task detail Module selector moves existing tasks and records the move in the timeline. My Day and team assignments continue to work across modules.

Delete project appears at the bottom of the module sidebar. Type the exact project name to confirm permanent deletion of its modules, tasks, timelines, attachments, and My Day entries. Other projects, teams, and members remain intact. Existing databases upgrade automatically without resetting data.

Run node tests/modules.mjs for module and deletion integration checks. The optional tests/modules-browser.mjs uses Playwright/Chromium to verify the sidebar, task moves, responsive layout, and deletion flow.

## Authentication

Credentials are set in `.env`: `AUTH_USERNAME=admin` and `AUTH_PASSWORD=Daymark@123` are the initial defaults. Change them to your preferred credentials. A random `JWT_SECRET` was generated in the local `.env`; keep it private. For a fresh installation, copy `.env.example` to `.env` and replace the JWT_SECRET placeholder with at least 32 random characters before starting Compose.

Run `docker compose up -d --force-recreate app` after changing credentials or the signing secret. Existing tokens become invalid when any of these values change. Sessions use HS256 JWTs with issuer/audience checks, an eight-hour expiry, and HttpOnly, SameSite=Strict cookies. Set `AUTH_COOKIE_SECURE=true` when using HTTPS; false supports the local HTTP setup. Passwords and signing keys stay on the server and are never NEXT_PUBLIC variables.

Use Sign out in the top bar to clear the browser session. JWT logout clears the cookie; a separately copied token remains valid until expiry or credential/secret rotation. Login is throttled to 10 attempts per minute per app process (resets on restart). The app and every data route independently check authentication.

Run `node tests/auth.mjs` with AUTH_USERNAME, AUTH_PASSWORD, and JWT_SECRET set to test access controls and expiry. Existing API integration tests also require AUTH_USERNAME and AUTH_PASSWORD.

## People table and task filters

People & teams lists teams and members in a table with open/total task counts and View tasks links. Member links open All tasks with that member selected; team links include the team queue and tasks owned by its current members. Existing team deletion and member removal controls are available in the Actions column.

All tasks supports combined status, project, module, team, member, priority, and assignment-age filters. No member assigned includes team-queue tasks. No team excludes both explicit team assignments and members belonging to a team. Filters persist in the URL for sharing, reload, and browser navigation. Changing project clears the module filter. Clear filters resets filters and search.

## Component organization and task pages

Workspace navigation, overview, people table, module sidebar, task rows, filters, creation dialogs, and team/project actions live in `components/workspace/`. `components/workspace.tsx` composes these views. Task pages use `app/tasks/[id]/page.tsx` and the components in `components/tasks/`: page loading/navigation, detail controls, timeline, and update/attachment composer. The obsolete selected-task dialog state has been removed from Zustand.

Task links support direct navigation and reload. Back to tasks preserves the originating list URL, including filters. Activity sits on the right on desktop and below task details on mobile. The route requires authentication and handles missing or deleted tasks. Run `tests/task-page-browser.mjs` with the documented Playwright environment to verify these workflows.

## Dokploy deployment

Deploy `compose.yaml` only. The app exposes internal port 3000 without binding host port 3000, avoiding conflicts with Dokploy or other services. In Dokploy Domains, select service `app`, container port `3000`, and your domain; enable HTTPS. Set `AUTH_COOKIE_SECURE=true` for HTTPS and configure AUTH_USERNAME, AUTH_PASSWORD, JWT_SECRET, and POSTGRES_PASSWORD in Dokploy's environment settings. Redeploy after saving the domain and environment.

PostgreSQL uses the default Compose-managed `postgres_data` named volume, scoped to the deployment's project name. No external volume needs to be created. An existing external `stmnf_postgres_data` volume is not deleted or migrated automatically: back up and restore its data into the new managed volume if you need to retain that database. Do not run `down -v` on data you want to keep.

For local access use `docker compose -f compose.yaml -f compose.local.yaml up --build -d`. If local port 3000 is occupied, set APP_PORT to a free port (for example 3001). Do not include `compose.local.yaml` in Dokploy.