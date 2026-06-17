import { readStorage, writeStorage, removeStorage } from '../core/storage.js';
import { allowedWidgetIds, widgetRegistry } from './widgetRegistry.js';

const LAYOUT_KEY = 'legal_dashboard_layout_v1';
const REQUIRED_WIDGET_IDS = ['calendarKanban', 'calendarTodayTasks'];

export const defaultLayout = [
  'cases',
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
    const layout = normalizeLayout(saved);

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
