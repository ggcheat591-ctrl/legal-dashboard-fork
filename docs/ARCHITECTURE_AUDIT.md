# Architecture Audit

## 1. Project Summary

`legal-dashboard` is a desktop-capable legal dashboard application. The frontend is built with Vite and vanilla JavaScript ES modules. The desktop runtime is Electron. The backend/API layer is implemented as a local HTTP handler that serves SQLite-backed endpoints in both Vite dev mode and Electron desktop mode.

The application includes dashboard widgets, legal case management, calendar/schedule modules, enforcement and registry modules, and map functionality.

## 2. Stack

- Vite
- Electron
- Vanilla JS / ES modules
- SQLite
- Gridstack
- Leaflet
- proxy-agent
- http-proxy-agent
- https-proxy-agent

## 3. Entry Points

### Frontend

- `index.html`
- `src/main.js`
- `src/app.js`

`index.html` mounts the app into `#app` and loads `/src/main.js`. `src/main.js` imports styles and calls `initApp()` from `src/app.js`.

### Electron

- `electron/main.cjs`

`package.json` points to this file via `"main": "electron/main.cjs"`.

### API / Backend

- `server/sqliteApi.cjs`
- `vite.config.js`
- `electron/main.cjs`

`server/sqliteApi.cjs` exports `handleApiRequest` and `ensureSchema`. In dev mode, `vite.config.js` registers this API handler as Vite middleware for `/api/*`. In desktop mode, `electron/main.cjs` starts a local HTTP server and routes `/api/*` requests to the same handler.

### SQLite

- `data/app.db`
- `server/sqliteApi.cjs`

The SQLite database file is `data/app.db`. SQLite connection helpers, schema creation/migrations, SQL queries, and CRUD endpoints are implemented in `server/sqliteApi.cjs`.

## 4. Frontend Location

Frontend source code is under `src/`.

Key areas:

- `src/layout/` - application layout, sidebar, topbar, utility panels
- `src/pages/` - page-level views
- `src/modules/` - feature modules
- `src/widgets/` - dashboard widgets
- `src/dashboard/` - Gridstack dashboard logic
- `src/components/` - reusable UI components
- `src/styles/` - CSS
- `src/auth/` - authentication UI/session logic
- `src/api/` - frontend API wrappers

## 5. Backend / API Location

Backend/API code is concentrated in:

- `server/sqliteApi.cjs`

This file contains the request router, endpoint handlers, response helpers, request body parsing, data normalization helpers, schema initialization, migrations, and SQL operations.

The API handler is wired into runtime environments by:

- `vite.config.js` for browser/dev mode
- `electron/main.cjs` for desktop mode

## 6. SQLite Logic Location

SQLite logic is in:

- `server/sqliteApi.cjs`

Important responsibilities in this file:

- opens SQLite connections
- runs `all`, `get`, and `run` queries
- creates and migrates tables through `ensureSchema`
- handles CRUD endpoints
- handles archive/restore flows
- handles authentication lookup by password

The working database file is:

- `data/app.db`

## 7. Realtime Audit

Realtime logic was not found in the reviewed source files.

Confirmed search results:

- `WebSocket` not found
- `SSE` not found
- `EventSource` not found
- `BroadcastChannel` not found
- `ipcRenderer` / `ipcMain` not found
- `setInterval` polling not found
- fetch-based polling loop not found

`fetch` is used for normal HTTP API calls through `src/api/dbApi.js` and `src/api/httpClient.js`, but no polling interval or realtime update loop was found.

## 8. Security Findings

### Hardcoded Admin Password

`server/sqliteApi.cjs` creates a default admin user with a hardcoded plain-text password:

- password: `[REDACTED_DEFAULT_PASSWORD]`
- admin flag: `is_admin = 1`

The login endpoint checks users by plain-text password with a SQL lookup. This is a security risk and should be replaced with a safer credential/bootstrap strategy.

### Hardcoded Corporate Proxy URLs

The corporate proxy URL is hardcoded in multiple places:

- `[REDACTED_CORPORATE_PROXY_URL]`

Locations found:

- `package.json`
- `vite.config.js`
- `electron/main.cjs`

In Electron, this proxy is also assigned to environment variables such as `MAP_PROXY_URL`, `HTTP_PROXY`, and `HTTPS_PROXY`.

### Other Password / Token / Secret / API Key Findings

Searches for password/token/secret/API key related terms found the auth password flow and default admin password. No separate hardcoded token, secret, bearer authorization value, or API key was identified in the reviewed source files.

## 9. Risky Files

These files should not be changed without explicit confirmation:

- `electron/main.cjs` - desktop runtime, local HTTP server, static serving, proxying, DB preparation
- `server/sqliteApi.cjs` - schema, migrations, SQL, auth, endpoints
- `src/app.js` - frontend app bootstrap and module initialization
- `src/api/dbApi.js` - frontend/backend API contract
- `vite.config.js` - dev server, API middleware, proxy config
- `data/app.db` - working SQLite database

Additional caution:

- `package.json` / `package-lock.json` affect scripts, dependencies, and packaging
- `dist/` and `release/` are build artifacts and should not be manually edited
- nested `legal-dashboard/` appears to be a project copy and should be handled only after confirming intended workspace scope

## 10. Safe Refactoring Plan

### Phase 0: Audit / Docs / Backup

- Keep a written architecture audit.
- Confirm the active project root and whether the nested `legal-dashboard/` copy is relevant.
- Back up `data/app.db` before any DB-affecting work.
- Avoid changing runtime logic in this phase.

### Phase 1: Lint / Format Configs

- Add or confirm formatting/linting rules with minimal scope.
- Do not auto-format the full project initially.
- Apply formatting only to files touched by later changes.

### Phase 2: API Endpoints Map

- Create an explicit endpoint map for `/api/*`.
- Document request methods, request bodies, response shapes, and SQLite tables used.
- Keep this documentation separate from behavior changes.

### Phase 3: Split Electron Main

- Extract small helpers from `electron/main.cjs`.
- Suggested boundaries: proxy config, static file serving, DB preparation, local server startup, window creation.
- Keep behavior unchanged after each step.

### Phase 4: Split SQLite API

- Break `server/sqliteApi.cjs` into smaller modules.
- Suggested boundaries: DB helpers, schema/migrations, auth endpoints, cases endpoints, schedule/calendar endpoints, registry/emergency/enforcement endpoints.
- Preserve endpoint paths and response shapes during the split.

### Phase 5: Security / Auth

- Replace hardcoded `admin` bootstrap with a safer initialization flow.
- Stop storing plain-text passwords.
- Introduce password hashing and a controlled first-run admin setup.
- Move proxy defaults to environment/config with clear fallback behavior.

### Phase 6: Realtime Layer

- Add realtime only if needed by product requirements.
- Choose one approach deliberately: polling, SSE, WebSocket, or Electron IPC.
- Define event contracts before implementation.
- Keep existing CRUD API stable while introducing realtime updates.
