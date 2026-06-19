import { readStorage, writeStorage, removeStorage } from '../core/storage.js';
import { allowedWidgetIds, widgetRegistry } from './widgetRegistry.js';

const LAYOUT_KEY = 'legal_dashboard_layout_v1';
const REQUIRED_WIDGET_IDS = ['calendarKanban', 'calendarTodayTasks'];
const LEGACY_CASES_WIDGET_ID = 'cases';
const CASES_STATS_WIDGET_ID = 'casesStats';
const CASES_TABLE_WIDGET_ID = 'casesTable';

export const defaultLayout = [
  CASES_STATS_WIDGET_ID,
  CASES_TABLE_WIDGET_ID,
  'calendarKanban',
  'calendar',
  'calendarTodayTasks'
].filter(id => widgetRegistry[id]).map(id => ({
  id,
  ...widgetRegistry[id].defaultLayout
}));

export function loadLayout() {
  const saved = readStorage(LAYOUT_KEY, null);

  if (Array.isArray(saved) && saved.length) {
    const migrated = migrateLegacyCasesLayout(saved);
    const layout = normalizeLayout(migrated);

    if (!layout.length) {
      writeStorage(LAYOUT_KEY, defaultLayout);
      return defaultLayout;
    }

    for (const id of REQUIRED_WIDGET_IDS) {
      if (widgetRegistry[id] && !layout.some(item => item.id === id)) {
        layout.push({ id, ...widgetRegistry[id].defaultLayout });
      }
    }

    if (JSON.stringify(layout) !== JSON.stringify(saved)) {
      writeStorage(LAYOUT_KEY, layout);
    }

    return layout;
  }

  return defaultLayout;
}

export function saveLayout(grid) {
  const layout = normalizeLayout(grid.save(false).map(item => ({
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h
  })));

  writeStorage(LAYOUT_KEY, layout);
}

export function resetLayoutStorage() {
  removeStorage(LAYOUT_KEY);
}

export function normalizeLayout(layout = []) {
  const seen = new Set();
  const allowed = new Set(allowedWidgetIds);
  const normalized = [];

  for (const item of layout) {
    const id = item?.id;
    if (!allowed.has(id) || seen.has(id) || !widgetRegistry[id]) continue;
    seen.add(id);
    normalized.push({
      id,
      ...normalizeLayoutMetrics(item, widgetRegistry[id].defaultLayout)
    });
  }

  return normalized;
}

function migrateLegacyCasesLayout(layout = []) {
  const legacy = layout.find(item => item?.id === LEGACY_CASES_WIDGET_ID);
  if (!legacy) return layout;

  const migrated = layout.filter(item => item?.id !== LEGACY_CASES_WIDGET_ID);

  if (!migrated.some(item => item?.id === CASES_STATS_WIDGET_ID)) {
    const fallback = widgetRegistry[CASES_STATS_WIDGET_ID].defaultLayout;
    migrated.push({
      id: CASES_STATS_WIDGET_ID,
      x: readNumber(legacy.x, fallback.x),
      y: readNumber(legacy.y, fallback.y),
      w: readNumber(legacy.w, fallback.w),
      h: Math.max(3, readNumber(legacy.h, fallback.h))
    });
  }

  if (!migrated.some(item => item?.id === CASES_TABLE_WIDGET_ID)) {
    const fallback = widgetRegistry[CASES_TABLE_WIDGET_ID].defaultLayout;
    const bottom = migrated.reduce((max, item) => {
      const y = readNumber(item?.y, 0);
      const h = readNumber(item?.h, 1);
      return Math.max(max, y + h);
    }, 0);

    migrated.push({
      id: CASES_TABLE_WIDGET_ID,
      x: 0,
      y: bottom,
      w: fallback.w,
      h: fallback.h
    });
  }

  return migrated;
}

function normalizeLayoutMetrics(item, fallback) {
  return {
    x: readNumber(item.x, fallback.x),
    y: readNumber(item.y, fallback.y),
    w: readNumber(item.w, fallback.w),
    h: readNumber(item.h, fallback.h)
  };
}

function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
