import { initGridstackDashboard } from './gridstackDashboard.js';
import { initEditMode } from './editMode.js';
import { initDashboardToolbar } from './dashboardToolbar.js';
import { loadLayout, defaultLayout } from './widgetLayoutStorage.js';
import { createWidget } from './widgetFactory.js';
import { widgetRegistry } from './widgetRegistry.js';
import { initCalendarWidgetScaling } from '../widgets/scaleCalendarWidgets.js';

let grid;

export function initDashboard() {
  grid = initGridstackDashboard('#dashboardGrid');

  const layout = loadLayout();

  layout.forEach(item => {
    const config = widgetRegistry[item.id];
    if (!config) return;

    grid.addWidget({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      content: createWidget(item.id)
    });
  });

  initEditMode(grid);
  initDashboardToolbar(grid);
  initCalendarWidgetScaling();

  grid.on('change added removed resizestop dragstop', () => {
    window.dispatchEvent(new CustomEvent('dashboard:layout-change'));
  });
}

export function resetDashboard(gridInstance = grid) {
  gridInstance.removeAll();

  defaultLayout.forEach(item => {
    gridInstance.addWidget({
      ...item,
      content: createWidget(item.id)
    });
  });

  window.dispatchEvent(new CustomEvent('dashboard:layout-change'));
}
