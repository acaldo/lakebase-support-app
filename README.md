# Lakebase Support Board

An internal support-ticket Kanban built with React, TypeScript, Vite, Express, and PostgreSQL 17. It runs against a local Docker database during development and switches to Databricks Lakebase with OAuth credential rotation when deployed as a Databricks App.

## Features

- Four-column Kanban for open, in-progress, resolved, and archived tickets
- Pointer and keyboard drag-and-drop, plus an accessible status selector
- Ticket creation, conversations, priorities, categories, filtering, and statistics
- Automatic authorship from the Databricks user email
- Confirmed deletion for statuses configured to allow it (archived by default); related messages are removed by the database foreign-key cascade
- Database-backed status, priority, and category dimensions with shared structural validation
- Idempotent schema migrations and sample data

There is intentionally no endpoint or UI control for deleting individual messages.

## Local development

Requirements: Node.js 22.16 or newer and Docker.

Run the complete local stack. The Node application, the Vite production build, and PostgreSQL 17 all run through Docker:

```bash
docker compose up --build
```

Open `http://localhost:3001`.

After source changes, rebuild the application container so the new bundle is served:

```bash
docker compose up -d --build app
```

The PostgreSQL data is stored in the named Docker volume `support_postgres_data`. Rebuilding or restarting either container does not remove tickets:

```bash
docker compose restart postgres
```

The application image uses a multi-stage `Dockerfile`: Node 22 builds the Vite client and TypeScript server, then a smaller runtime stage installs production dependencies and runs Express as the non-root `node` user.

The server runs all unapplied SQL migrations on startup. They can also be run explicitly with `npm run db:migrate`.

## Database selection

`DB_PROVIDER` is the only mode switch:

- `local`: uses `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` from `.env`; authors use `LOCAL_DEV_USER`.
- `lakebase`: uses the PostgreSQL parameters and Databricks service-principal identity injected by Databricks Apps. The server exchanges `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` for a workspace OAuth token, then requests a short-lived Lakebase database credential. Credentials are cached, refreshed before expiry, and never sent to the browser or written to logs.

Both providers use the same `support_board` schema, migrations, repository, and API.

Tickets store foreign keys to `dim_ticket_status`, `dim_ticket_priority`, and
`dim_ticket_category`. The dimensions own catalog labels, ordering, defaults,
status progress, and deletion policy; API payloads continue to expose their
stable string codes rather than internal numeric IDs.

## Databricks Apps deployment

1. In Free Edition, create or open the Lakebase project and keep PostgreSQL 17 with its production branch/database.
2. Create a custom Databricks App named `lakebase-support-board`.
3. Add the Lakebase Autoscaling database as an App resource with resource key `database` and **Can connect and create** permission.
4. Select this repository's Databricks Git folder as the deployment source.
5. Deploy. Databricks detects `package.json`, installs dependencies, runs `npm run build`, and starts the command in `app.yaml`.

`app.yaml` sets `DB_PROVIDER=lakebase` and resolves `LAKEBASE_ENDPOINT_NAME` from the `database` resource key configured in the App. Databricks injects `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID`, and `DATABRICKS_CLIENT_SECRET` at runtime. No Lakebase password or OAuth secret belongs in source control.

After deployment, verify this sequence and refresh the App after every mutation:

1. Existing sample tickets load.
2. A new ticket can be created.
3. A message can be added.
4. The ticket can move to another status.
5. Only archived tickets can be deleted, and deletion always requires confirmation.
6. All changes remain after refresh.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Database readiness |
| `GET` | `/api/ticket-catalogs` | Database-backed ticket catalogs |
| `GET` | `/api/tickets` | List tickets and message counts |
| `GET` | `/api/tickets/:ticketId` | Ticket detail and messages |
| `POST` | `/api/tickets` | Create a ticket |
| `POST` | `/api/tickets/:ticketId/messages` | Add a message |
| `PATCH` | `/api/tickets/:ticketId/status` | Update status |
| `DELETE` | `/api/tickets/:ticketId` | Delete an archived ticket and cascade its messages |

In Databricks, `created_by` and `author` come from the trusted `X-Forwarded-Email` request header. In local mode the backend ignores that header and uses `LOCAL_DEV_USER`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Database integration tests use an isolated temporary schema and only run when `TEST_DATABASE_URL` is supplied:

```bash
TEST_DATABASE_URL=postgresql://support_app:support_app_dev@localhost:5434/support_board npm test
```

The integration suite verifies sample data, validation, authorship, messages, status changes, confirmed-delete API behavior, the foreign-key cascade, and 404 responses.
