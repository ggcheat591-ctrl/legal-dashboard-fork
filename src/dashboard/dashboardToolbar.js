import { widgetRegistry } from './widgetRegistry.js';
import { createWidget } from './widgetFactory.js';
import { resetLayoutStorage, saveLayout } from './widgetLayoutStorage.js';
import { resetDashboard } from './dashboard.js';
import { showNotification } from '../layout/notifications.js';

export function initDashboardToolbar(grid) {
  const addButton = document.querySelector('#addWidgetBtn');
  const saveButton = document.querySelector('#saveLayoutBtn');
  const resetButton = document.querySelector('#resetLayoutBtn');
  const addMenu = document.querySelector('#floatingAddMenu');
  const floatingMenu = document.querySelector('#floatingEditMenu');
  const mainEditButton = document.querySelector('#editDashboardBtn');

  initPreciseFloatingReveal(floatingMenu, mainEditButton, addMenu);

  addButton.addEventListener('click', event => {
    event.stopPropagation();
    enableEditMode(grid);
    renderAddMenu(grid);
    addMenu.classList.toggle('active');
    floatingMenu?.classList.toggle('add-menu-visible', addMenu.classList.contains('active'));
  });

  saveButton.addEventListener('click', () => {
    saveLayout(grid);
    showNotification('Расположение сохранено');
  });

  resetButton.addEventListener('click', () => {
    resetLayoutStorage();
    resetDashboard(grid);
    renderAddMenu(grid);
    showNotification('Расположение сброшено');
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('#floatingEditMenu')) {
      addMenu.classList.remove('active');
      floatingMenu?.classList.remove('add-menu-visible');
      floatingMenu?.classList.remove('add-menu-visible');
    }

    const removeButton = event.target.closest('[data-remove-widget]');
    if (removeButton) {
      if (!document.body.classList.contains('dashboard-edit-mode')) return;

      const item = removeButton.closest('.grid-stack-item');
      if (item) {
        grid.removeWidget(item);
        saveLayout(grid);
      }

      renderAddMenu(grid);
    }

    const addWidgetButton = event.target.closest('[data-add-widget]');
    if (addWidgetButton) {
      const id = addWidgetButton.dataset.addWidget;
      if (!widgetRegistry[id]) return;

      enableEditMode(grid);

      grid.addWidget({
        id,
        ...widgetRegistry[id].defaultLayout,
        autoPosition: true,
        content: createWidget(id)
      });

      saveLayout(grid);
      addMenu.classList.remove('active');
      floatingMenu?.classList.remove('add-menu-visible');
      renderAddMenu(grid);
    }
  });

  function enableEditMode(gridInstance) {
    document.body.classList.add('dashboard-edit-mode');
    floatingMenu?.classList.add('open');
    gridInstance.enableMove(true);
    gridInstance.enableResize(true);
  }

  renderAddMenu(grid);
}

function renderAddMenu(grid) {
  const menu = document.querySelector('#floatingAddMenu');
  const existing = new Set(
    Array.from(document.querySelectorAll('.grid-stack-item')).map(item => item.getAttribute('gs-id'))
  );

  const available = Object.entries(widgetRegistry)
    .filter(([id, config]) => config.selectable !== false && !existing.has(id));

  if (!available.length) {
    menu.innerHTML = `<div class="empty">Все доступные виджеты уже добавлены</div>`;
    return;
  }

  menu.innerHTML = available.map(([id, config]) => `
    <button class="add-option" data-add-widget="${id}" type="button">
      <span>${config.icon}</span>
      <span>${config.title}</span>
    </button>
  `).join('');
}


function initPreciseFloatingReveal(floatingMenu, mainEditButton, addMenu) {
  if (!floatingMenu || !mainEditButton) return;

  let hideTimer = null;

  const show = () => {
    clearTimeout(hideTimer);
    floatingMenu.classList.add('actions-visible');
  };

  const hide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (addMenu?.classList.contains('active')) return;
      floatingMenu.classList.remove('actions-visible');
    }, 140);
  };

  // ВАЖНО: раскрываем только от самого карандашика.
  // Наведение на пустую область над ним больше не открывает кнопки.
  mainEditButton.addEventListener('mouseenter', show);

  floatingMenu.addEventListener('mouseleave', hide);

  floatingMenu.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      addMenu?.classList.remove('active');
      floatingMenu.classList.remove('add-menu-visible');
      floatingMenu.classList.remove('actions-visible');
    }
  });
}
