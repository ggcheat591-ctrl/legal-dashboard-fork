# API Map

## Scope

This map is based on read-only inspection of:

- `server/sqliteApi.cjs`
- `src/api/dbApi.js`
- `src/api/*.js`
- frontend imports/usages of `dbApi`
- direct `fetch(` calls

The active application API is the `/api/*` layer exposed by `server/sqliteApi.cjs` and called through `src/api/dbApi.js`.

## API Runtime

- Dev/browser mode: `vite.config.js` routes `/api/*` to `handleApiRequest` from `server/sqliteApi.cjs`.
- Electron desktop mode: `electron/main.cjs` starts a local HTTP server and routes `/api/*` to the same `handleApiRequest`.
- SQLite database: `data/app.db`.
- SQLite logic: `server/sqliteApi.cjs`.

## Frontend API Layers

### Active API Facade

- `src/api/dbApi.js`

This file calls `/api/*` endpoints with `fetch(path, ...)`.

### Secondary / Legacy API Wrappers

These wrappers use `src/api/httpClient.js`, which applies `VITE_API_BASE_URL` and calls non-`/api` paths:

- `src/api/casesApi.js` -> `/cases`, `/cases/:id`
- `src/api/calendarApi.js` -> `/calendar-events`
- `src/api/scheduleApi.js` -> `/hearings`
- `src/api/enforcementApi.js` -> `/enforcement`
- `src/api/mapApi.js` -> `/map-objects`

Read-only search found no imports of these wrapper exports outside their own files. They appear unused or legacy in the current source tree.

## Endpoint Map

| Endpoint | Methods | SQLite tables / entities | Frontend callers |
| --- | --- | --- | --- |
| `/api/health` | GET | DB path / health only | `dbApi.health`; used by feature controllers |
| `/api/auth/login` | POST | `users` | `src/auth/authController.js` |
| `/api/users` | GET | `users` | schedule, calendar, municipal registry modules |
| `/api/options?category=...` | GET | `app_options` | cases, controlled cases, schedule, municipal registry, emergency fund, calendar modules |
| `/api/meeting-participants?category=...` | GET | `meeting_participants`, fallback `users` | `src/modules/meetings/meetingsController.js` |
| `/api/meetings` | GET, POST | `meetings` | `src/modules/meetings/meetingsController.js` |
| `/api/meetings/:id` | PUT, DELETE | `meetings` | `src/modules/meetings/meetingsController.js` |
| `/api/general-cases` | GET, POST | `general_cases`; GET can read `general_cases_archive` with `archived=1` | `src/modules/cases/generalCasesController.js`, `src/widgets/casesWidget.js`, calendar module |
| `/api/general-cases/:id` | GET, PUT, DELETE | `general_cases`, `general_cases_archive` | `src/modules/cases/generalCasesController.js` |
| `/api/general-cases/archive/:archiveId/restore` | POST | `general_cases_archive`, `general_cases` | `src/modules/cases/generalCasesController.js` |
| `/api/general-cases/:id/controlled-link` | POST | `general_cases`, `controlled_cases` | `src/modules/cases/generalCasesController.js` |
| `/api/general-cases/:id/attendance-hearing` | POST | `general_cases`, `court_schedule`, `calendar_tasks` | `src/modules/cases/generalCasesController.js` |
| `/api/controlled-cases` | GET, POST | `controlled_cases` | `src/modules/controlledCases/controlledCasesController.js`, `src/widgets/controlledCasesWidget.js` |
| `/api/controlled-cases/:id` | GET, PUT, DELETE | `controlled_cases`, `archive` | `src/modules/controlledCases/controlledCasesController.js` |
| `/api/controlled-cases/archive` | GET | `archive` where `table_name='controlled_cases'` | `src/modules/controlledCases/controlledCasesController.js` |
| `/api/controlled-cases/archive/:archiveId/restore` | POST | `archive`, `controlled_cases` | `src/modules/controlledCases/controlledCasesController.js` |
| `/api/controlled-cases/archive/:archiveId` | DELETE | `archive` | `src/modules/controlledCases/controlledCasesController.js` |
| `/api/enforcement?mode=...` | GET, POST | `enforcement_proceedings` | `src/modules/enforcement/enforcementController.js`, `src/widgets/enforcementWidget.js` |
| `/api/enforcement/:id` | GET, PUT, DELETE | `enforcement_proceedings` | `src/modules/enforcement/enforcementController.js` |
| `/api/enforcement/:id/archive` | POST | `enforcement_proceedings`, `archive` | `src/modules/enforcement/enforcementController.js` |
| `/api/enforcement/archive?mode=...` | GET | `archive` where `table_name='enforcement_proceedings'` | `src/modules/enforcement/enforcementController.js` |
| `/api/enforcement/archive/:archiveId/restore` | POST | `archive`, `enforcement_proceedings` | `src/modules/enforcement/enforcementController.js` |
| `/api/enforcement/archive/:archiveId` | DELETE | `archive` | `src/modules/enforcement/enforcementController.js` |
| `/api/municipal-registry` | GET, POST | `registry` | `src/modules/municipalRegistry/municipalRegistryController.js`, `src/widgets/municipalRegistryWidget.js` |
| `/api/municipal-registry/:id` | PUT, DELETE | `registry` | `src/modules/municipalRegistry/municipalRegistryController.js` |
| `/api/municipal-registry/:id/archive` | POST | `registry`, `archive` | `src/modules/municipalRegistry/municipalRegistryController.js` |
| `/api/municipal-registry/archive` | GET | `archive` where `table_name='registry'` | `src/modules/municipalRegistry/municipalRegistryController.js` |
| `/api/municipal-registry/archive/:archiveId/restore` | POST | `archive`, `registry` | `src/modules/municipalRegistry/municipalRegistryController.js` |
| `/api/municipal-registry/archive/:archiveId` | DELETE | `archive` | `src/modules/municipalRegistry/municipalRegistryController.js` |
| `/api/emergency-fund` | GET, POST | `emergency_fund` | `src/modules/emergencyFund/emergencyFundController.js`, `src/widgets/emergencyFundWidget.js` |
| `/api/emergency-fund/:id` | PUT, DELETE | `emergency_fund` | `src/modules/emergencyFund/emergencyFundController.js` |
| `/api/emergency-fund/:id/archive` | POST | `emergency_fund`, `archive` | `src/modules/emergencyFund/emergencyFundController.js` |
| `/api/emergency-fund/archive` | GET | `archive` where `table_name='emergency'` | `src/modules/emergencyFund/emergencyFundController.js` |
| `/api/emergency-fund/archive/:archiveId/restore` | POST | `archive`, `emergency_fund` | `src/modules/emergencyFund/emergencyFundController.js` |
| `/api/emergency-fund/archive/:archiveId` | DELETE | `archive` | `src/modules/emergencyFund/emergencyFundController.js` |
| `/api/court-schedule` | GET | `court_schedule` | `src/modules/schedule/scheduleController.js`, `src/widgets/scheduleWidget.js` |
| `/api/court-schedule/date` | POST | `court_schedule` date rows | `src/modules/schedule/scheduleController.js` |
| `/api/court-schedule/case` | POST | `court_schedule` case rows | `src/modules/schedule/scheduleController.js` |
| `/api/court-schedule/:id` | PUT, DELETE | `court_schedule` | `src/modules/schedule/scheduleController.js` |
| `/api/calendar-tasks?date/start/end/user` | GET | `calendar_tasks` | calendar module, cases module, schedule module, meetings module, calendar widgets |
| `/api/calendar-tasks` | POST | `calendar_tasks` | calendar module, cases module, schedule module, meetings module |
| `/api/calendar-tasks/:id` | PUT, DELETE | `calendar_tasks` | calendar module, cases module, calendar widgets |

## Dashboard / Widget Related Endpoints

Dashboard widgets call the same `dbApi` endpoints as full pages:

- `src/widgets/casesWidget.js` -> `/api/general-cases`
- `src/widgets/controlledCasesWidget.js` -> `/api/controlled-cases`
- `src/widgets/enforcementWidget.js` -> `/api/enforcement?mode=debtor`, `/api/enforcement?mode=creditor`
- `src/widgets/calendarWidget.js` -> `/api/calendar-tasks`
- `src/widgets/calendarTodayTasksWidget.js` -> `/api/calendar-tasks`
- `src/widgets/calendarKanbanWidget.js` -> `/api/calendar-tasks`
- `src/widgets/scheduleWidget.js` -> `/api/court-schedule`
- `src/widgets/municipalRegistryWidget.js` -> `/api/municipal-registry`
- `src/widgets/emergencyFundWidget.js` -> `/api/emergency-fund`

These endpoints are natural candidates for dashboard refresh events if a realtime layer is added.

## Endpoints That Should Emit Realtime Events

If realtime is introduced, events should be emitted after successful mutations.

Recommended event groups:

- `auth/session`: `/api/auth/login` only if session state needs app-wide notification.
- `users/options`: changes are not currently exposed through mutation endpoints; emit only if future write endpoints are added.
- `general-cases`: POST/PUT/DELETE, archive restore, controlled-link, attendance-hearing.
- `controlled-cases`: POST/PUT/DELETE, archive/restore/delete archive.
- `enforcement`: POST/PUT/DELETE, archive/restore/delete archive.
- `meetings`: POST/PUT/DELETE.
- `municipal-registry`: POST/PUT/DELETE, archive/restore/delete archive.
- `emergency-fund`: POST/PUT/DELETE, archive/restore/delete archive.
- `court-schedule`: date/case POST, PUT, DELETE.
- `calendar-tasks`: POST/PUT/DELETE.

Cross-entity mutations need multiple events:

- `/api/general-cases/:id/controlled-link` should update `general-cases` and `controlled-cases`.
- `/api/general-cases/:id/attendance-hearing` should update `general-cases`, `court-schedule`, and `calendar-tasks`.
- cases/schedule modules that create calendar tasks should update `calendar-tasks` consumers and dashboard widgets.

## Fetch / API Call Sites

Direct `fetch(` calls:

- `src/api/dbApi.js`
- `src/api/httpClient.js`

Primary frontend modules using `dbApi`:

- `src/auth/authController.js`
- `src/modules/cases/generalCasesController.js`
- `src/modules/controlledCases/controlledCasesController.js`
- `src/modules/enforcement/enforcementController.js`
- `src/modules/calendar/calendarController.js`
- `src/modules/schedule/scheduleController.js`
- `src/modules/meetings/meetingsController.js`
- `src/modules/municipalRegistry/municipalRegistryController.js`
- `src/modules/emergencyFund/emergencyFundController.js`
- `src/widgets/*Widget.js` files listed above

## Risks

### SQL Injection

- Most user values are passed through SQLite parameter binding.
- Dynamic SQL exists in places such as selecting the archive vs active general-cases table and assembling conditional `WHERE` clauses. The observed table selection appears constrained by code-controlled values, but this pattern should remain tightly guarded.
- Search filtering is often done in JavaScript after fetching rows, which reduces SQL injection exposure but may become a performance risk.

### Missing / Weak Validation

- Request body validation is mostly custom normalization with defaults.
- There is limited explicit schema validation for POST/PUT payloads.
- IDs are parsed from paths and converted to numbers, but broader payload constraints, required fields, enum validation, and date validation are inconsistent.

### Hardcoded Paths / Environment Coupling

- The database path is wired as `data/app.db` in dev mode and copied/prepared in Electron user data at runtime.
- Runtime API behavior depends on Vite middleware in dev and Electron local server in desktop.
- Proxy routes and external services are configured outside the API map but affect map-related requests.

### Weak Auth

- Authentication is password-only.
- The server checks a plain-text password in the `users` table.
- No session token, server-side session validation, roles middleware, CSRF protection, or per-endpoint authorization checks were found in the inspected API layer.

### API Maintainability

- `server/sqliteApi.cjs` combines schema creation, migrations, DB helpers, request routing, validation, SQL, and response handling in one large file.
- Some endpoint blocks appear duplicated, especially around meetings and meeting participants.
- Legacy `src/api/*.js` wrappers use non-`/api` paths and appear unused, which can confuse future refactors.
