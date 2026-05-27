# Caseworker Task Manager

A simple full-stack task management application that lets caseworkers create, view,
update and delete tasks. Built for the DTS Developer Technical Test.

> **This is not an official government service, this is a simple Task Management Tool for DTS Developer Technical Test that uses GOV.UK Design System.**
> It uses the GOV.UK Design System for styling only and does not use the GOV.UK
> crown or imply any official status.

---

## Overview

The application provides a JSON API and a server-rendered web interface for
managing tasks. A task has a title, an optional description, a status
(`NOT_STARTED`, `IN_PROGRESS` or `COMPLETED`) and a due date/time. Tasks are persisted in a database via Prisma.

Both the API and the web pages are served by a single Koa server, so the whole
application runs from one process on one port.

## Tech stack

| Concern       | Choice                                                       |
| ------------- | ------------------------------------------------------------ |
| Runtime       | Node.js + TypeScript                                         |
| Web server    | Koa (`@koa/router`, `@koa/bodyparser`, `koa-static`)         |
| Templating    | Nunjucks + GOV.UK Frontend macros/components                 |
| Styling       | GOV.UK Frontend, compiled from SCSS with Dart Sass            |
| Interactivity | Alpine.js plus small vanilla JS progressive enhancements      |
| Data access   | Prisma ORM                                                   |
| Database      | SQLite for local development and tests                        |
| Validation    | Zod shared by API handlers and server-rendered page handlers  |
| Testing       | Jest, ts-jest and Supertest                                  |


## The web interface (UX)

The web interface is designed to feel like a realistic caseworker service for
managing a workload, rather than a CRUD database screen.

- **Workload view (`GET /`)** — the main page is focused on _viewing and
  managing_ work, not creating it. It shows a heading, a short intro, a
  **Create task** button, filter/sort controls and a paginated task list. Tasks
  are rendered with the **GOV.UK Task List** component: each item links to the
  task, shows the due date/time as hint text (e.g. _“Due 28 May 2026 at 14:30”_)
  and has a single, most-important status indicator on the right.
- **Grouped by urgency** — tasks are grouped, in this order: **Overdue**, **Due
  today**, **Upcoming**, **Completed**. The groups are derived from the stored
  status and due date/time; `OVERDUE` and `DUE_TODAY` are never stored. Empty
  states are shown when there are no tasks, or when a selected filter has no
  matches.
- **Status display** — tasks due on today's calendar date show a yellow Due
  today tag, overdue tasks show a red tag, In progress a blue tag, Not started
  a grey tag, and Completed is shown as neutral text. Each task shows only one
  tag to avoid clutter.
- **Create (`GET /tasks/new`, `POST /tasks`)** — a dedicated page using GOV.UK
  form components.
- **Detail (`GET /tasks/:id`)** — a **GOV.UK Summary List** showing the title,
  description, status, due date/time, created and last-updated dates, with clear
  actions to edit the task, change its status, delete it or return to the list.
- **Edit (`GET/POST /tasks/:id/edit`)** — the same GOV.UK form as create.
- **Delete (`POST /tasks/:id/delete`)** — deletion is never immediate from the
  list. The detail page opens a confirmation modal with the task title and a
  GOV.UK warning before the red **Delete task** button. The legacy
  `GET /tasks/:id/delete` URL redirects back to the detail page.
- **Filter and sort** — a **Status filter** and a user-friendly **Sort by**
  dropdown (_Due soonest first_, _Due latest first_, _Recently created_,
  _Recently updated_), with an **Apply filters** button (the no-JS fallback) and
  a **Clear filters** link when filters are active. Pagination shows 10 matching
  tasks per page and preserves the active filter and sort.
- **Success toasts** — after a successful create, update, status change or
  delete, a server-rendered success notification is shown via the
  `success-toast` component. It uses GOV.UK Notification Banner markup as the
  accessible no-JS baseline, then becomes a timed toast when JavaScript is
  available.
- **Validation** — accessible throughout: a GOV.UK error summary at the top,
  inline field errors, error-summary links that jump to the invalid field, and
  submitted values preserved on re-render.


### GOV.UK Frontend components used

Task List (workload overview), Summary List (task detail), Notification Banner
(server-rendered success toasts), Error Summary and inline error messages
(validation), Tag (status), Button, Warning Text, Inset Text and Pagination.

## Project structure

```
src/
  backend/        Koa app, routes (API + pages), controllers, services, validators, middleware, Prisma client
  frontend/
    views/
      layouts/    base layout (header, footer, scripts)
      pages/      index, task-new, task-detail, task-edit, not-found
      components/ task-list (filter bar + grouped Task List), task-form-fields, success-toast
    public/       SCSS, compiled CSS, Alpine.js enhancement
  shared/         Types shared between backend and frontend
tests/
  api/            Jest + Supertest tests for the JSON API
  pages/          Jest + Supertest tests for the server-rendered pages
  setup/          Test database setup
prisma/           Prisma schema and migrations
```

## API documentation

Base path: `/api/tasks`. All requests and responses use JSON.

| Method   | Path                              | Description                       | Success |
| -------- | --------------------------------- | --------------------------------- | ------- |
| `POST`   | `/api/tasks`                      | Create a task                     | `201`   |
| `GET`    | `/api/tasks`                      | Retrieve all tasks                | `200`   |
| `GET`    | `/api/tasks?status=&sort=&order=` | Retrieve filtered/sorted tasks    | `200`   |
| `GET`    | `/api/tasks/:id`                  | Retrieve a task by id             | `200`   |
| `PUT`    | `/api/tasks/:id`                  | Fully update a task               | `200`   |
| `PATCH`  | `/api/tasks/:id/status`           | Update only a task's status       | `200`   |
| `DELETE` | `/api/tasks/:id`                  | Delete a task                     | `204`   |

### Task shape (response)

```json
{
  "id": "e3e2d8f6-d226-4e49-97fc-3aa6c474bb05",
  "title": "Review case bundle",
  "description": "Check all documents are present",
  "status": "NOT_STARTED",
  "dueDateTime": "2026-07-01T13:30:00.000Z",
  "createdAt": "2026-05-26T18:53:41.337Z",
  "updatedAt": "2026-05-26T18:53:41.337Z",
  "overdue": false,
  "group": "UPCOMING"
}
```

`overdue` and `group` are computed from the stored status and due date/time.
Completed tasks are always grouped as `COMPLETED`; incomplete tasks due on
today's calendar date are grouped as `DUE_TODAY`; past incomplete tasks are
`OVERDUE`; everything else is `UPCOMING`.

`GET /api/tasks` accepts optional query parameters:

- `status` — `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` or `OVERDUE` (the derived
  state). Omit for all tasks.
- `sort` — `dueDateTime` (default), `title`, `status`, `createdAt` or
  `updatedAt`.
- `order` — `asc` (default) or `desc`.

Unrecognised values fall back to the defaults rather than erroring.

The web workload view uses friendlier query values for its single sort dropdown:
`/?sort=due_asc`, `due_desc`, `created_desc` or `updated_desc`. It also accepts
`status` and `page`, and renders 10 matching tasks per page.

### Example requests

**Create a task**

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Review case bundle",
    "description": "Check all documents are present",
    "status": "NOT_STARTED",
    "dueDateTime": "2026-07-01T14:30"
  }'
```

**Update status**

```bash
curl -X PATCH http://localhost:3000/api/tasks/<id>/status \
  -H 'Content-Type: application/json' \
  -d '{ "status": "COMPLETED" }'
```

**Validation error response (`400`)**

```json
{
  "error": "Validation failed",
  "details": { "title": "Enter a task title" }
}
```

**Not found response (`404`)**

```json
{ "error": "Task not found" }
```

## Validation and error handling

- All input is validated with **Zod** at the API boundary
  (`src/backend/validators/task.schema.ts`):
  - `title` — required, trimmed, 1–100 characters
  - `description` — optional, up to 500 characters
  - `status` — must be one of `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`
  - `dueDateTime` — must be a valid date/time
- A single **central error handling middleware**
  (`src/backend/middleware/errorHandler.ts`) converts:
  - `ZodError` → `400` with a `details` map of field → message
  - `NotFoundError` → `404`
  - anything else → `500`
- The web pages reuse the same schemas, so a submission without JavaScript gets
  the same validation, rendered with the GOV.UK error summary and inline messages.

## Getting started

### Prerequisites

- Node.js 18+ and npm

### Install and run

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Then open <http://localhost:3000>.

- `npm install` installs dependencies and runs `prisma generate` (via `postinstall`).
- `cp .env.example .env` creates your local environment file
  (`DATABASE_URL="file:./dev.db"` and `PORT=3000`).
- `npm run db:migrate` applies the Prisma migrations and creates the SQLite database.
- `npm run dev` compiles the SCSS (in watch mode) and starts the server with live reload.

### Run the tests

```bash
npm test
```

Tests use **Supertest** against the Koa app and run against an **isolated test
database** (`prisma/test.db`). The schema is created from the committed
migrations before the suite runs, and every test starts from an empty table, so
tests never depend on each other or on your local development data.

There are two suites:

- `tests/api/` — the JSON API (create, list, filter/sort, get, update, status,
  delete, the derived overdue flag and web pagination).
- `tests/pages/` — the server-rendered pages (workload view loads and groups
  tasks; create page loads and validates; detail, edit and delete pages load;
  updating and deleting work; missing tasks return 404; success toasts appear).

## Available scripts

| Script               | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Watch SCSS and run the server with live reload (tsx) |
| `npm run build`      | Generate the Prisma client, build CSS and compile TS |
| `npm start`          | Run the compiled server from `dist/`                 |
| `npm test`           | Run the Jest test suite                              |
| `npm run test:watch` | Run Jest in watch mode                               |
| `npm run db:migrate` | Apply Prisma migrations (`prisma migrate dev`)       |
| `npm run db:reset`   | Reset the database (`prisma migrate reset`)          |
| `npm run db:studio`  | Open Prisma Studio                                   |

## Accessibility

- Built on the GOV.UK Design System, which is designed to meet WCAG 2.1 AA.
- All form fields have associated labels and hints; errors are linked to fields
  with `aria-describedby` and summarised in a GOV.UK error summary.
- The interface is fully keyboard operable and works without JavaScript.

## Assumptions

- A single shared task list is sufficient for the test scenario — there are no
  user accounts, authentication or per-user task ownership (these were explicitly
  out of scope).
- `dueDateTime` values submitted from the browser are interpreted in the server's
  local timezone and stored as UTC.
- A task can be created with any of the three statuses; new tasks default to `NOT_STARTED`.

## Future improvements

- Move filtering, sorting and pagination into the database layer (currently done
  in memory, which is fine for modest data but would not scale to large tables).
- Authentication and per-caseworker task ownership.
- Switch the datasource to PostgreSQL for production (Prisma makes this a config
  and migration change).
- Component and end-to-end tests for the frontend in addition to the API tests.
- Audit history of status changes.
