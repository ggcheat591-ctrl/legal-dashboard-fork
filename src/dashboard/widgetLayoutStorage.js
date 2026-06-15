import { readStorage, writeStorage, removeStorage } from '../core/storage.js';
import { widgetRegistry } from './widgetRegistry.js';

const LAYOUT_KEY = 'legal_dashboard_layout_v1';

export const defaultLayout = [
  'criticalAlerts',
  'cases',
  'calendar',
  'calendarKanban',
  'calendarTodayTasks',
  'schedule'
].filter(id => widgetRegistry[id]).map(id => ({
  id,
  ...widgetRegistry[id].defaultLayout
}));

export function loadLayout() {
  const saved = readStorage(LAYOUT_KEY, null);

  if (Array.isArray(saved) && saved.length) {
    const layout = [...saved];
    for (const id of ['criticalAlerts', 'calendarKanban', 'calendarTodayTasks']) {
      if (widgetRegistry[id] && !layout.some(item => item.id === id)) {
        const item = { id, ...widgetRegistry[id].defaultLayout };
        if (id === 'criticalAlerts') layout.unshift(item);
        else layout.push(item);
      }
    }
    return layout;
  }

  return defaultLayout;
}

export function saveLayout(grid) {
  const layout = grid.save(false).map(item => ({
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h
  }));

  writeStorage(LAYOUT_KEY, layout);
}

export function resetLayoutStorage() {
  removeStorage(LAYOUT_KEY);
}
