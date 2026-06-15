# Smoke Test Checklist

This checklist is for manual verification after small frontend refactoring steps. It does not cover automated tests.

## Start Frontend

Run from the project root in cmd:

```cmd
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

```text
http://localhost:5173/
```

If the port is busy, Vite may choose the next available port.

## Pages To Check

- Dashboard
- General cases
- Controlled cases
- Calendar
- Schedule
- Map
- Enforcement
- Meetings
- Municipal registry
- Emergency fund
- Settings

## Dashboard

- Page opens without blank screen or console errors.
- Widgets render with expected titles and content.
- Dashboard layout is stable after refresh.
- Edit mode opens and closes.
- Widget controls remain clickable.
- Gridstack drag/resize behavior still works if available for the current user mode.
- Saved widget layout is restored after refresh.

## Cases

- Cases page opens.
- Table/list renders existing data.
- Search and filters update visible rows.
- Case details modal opens and closes.
- Status tags, dates, and responsible users render correctly.
- Empty state still appears when filters return no rows.

## Calendar

- Calendar page opens.
- Events/tasks render on expected dates.
- Date navigation works.
- Filters update visible calendar items.
- Event/task modal opens and closes.
- Today/current date highlighting still works.

## Map

- Map page opens without layout overlap.
- Leaflet map initializes and accepts pan/zoom.
- Base tiles or configured overlays load when available.
- Map markers/objects render if data exists.
- Layer controls and fullscreen controls work.
- Proxy-backed map requests should be checked separately if the network requires a corporate proxy.

## Schedule

- Schedule page opens.
- Groups/tables render existing rows.
- Filters and search work.
- KPI blocks update consistently with visible data.
- Date/time formatting remains readable.
- Empty state appears when filters return no rows.

## Browser DevTools

- Open DevTools with `F12` or `Ctrl+Shift+I`.
- Check the Console tab for runtime errors.
- Check the Network tab for failed API requests.
- Reload the page with DevTools open and confirm there are no new unexpected errors.
- For layout changes, inspect elements at desktop and narrow viewport widths.

## Git Verification

Before and after each small change, check:

```cmd
git status
git diff
```

Expected result for a narrow frontend refactor:

- Only intended files are changed.
- No generated files are added.
- No local database files are added.
- No unrelated docs, Electron, backend, or config files are changed.

## Electron Note

Electron currently has a separate startup issue related to the runtime environment. Desktop/Electron smoke testing is deferred until that issue is fixed and verified separately.
