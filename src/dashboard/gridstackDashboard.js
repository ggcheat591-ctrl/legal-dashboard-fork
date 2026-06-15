import { GridStack } from 'gridstack';
import { saveLayout } from './widgetLayoutStorage.js';

export function initGridstackDashboard(selector) {
  const grid = GridStack.init({
    column: 12,
    cellHeight: 82,
    margin: 8,
    float: false,
    animate: true,
    minRow: 12,
    draggable: {
      handle: '.widget-dragbar'
    },
    resizable: {
      handles: 'se,e,s'
    }
  }, selector);

  grid.enableMove(false);
  grid.enableResize(false);

  grid.on('change dragstop resizestop added removed', () => {
    saveLayout(grid);
    window.dispatchEvent(new CustomEvent('dashboard:layout-change'));
  });

  return grid;
}
