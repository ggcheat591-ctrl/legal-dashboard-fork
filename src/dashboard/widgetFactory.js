import { widgetRegistry } from './widgetRegistry.js';

const WIDGET_META = {
  cases: {
    subtitle: 'Дела, контроль и обязательная явка',
    icon: '<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"></path><path d="M15 3v4h4"></path><path d="M9 11h6M9 15h6M9 19h4"></path></svg>',
  },
  calendarKanban: {
    subtitle: 'Сегодня, завтра и просроченные записи',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 10h18"></path><path d="M8 14h.01M12 14h.01M16 14h.01"></path></svg>',
  },
  calendar: {
    subtitle: 'Месяц и количество задач по дням',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg>',
  },
  calendarTodayTasks: {
    subtitle: 'Персональный план на текущий день',
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>',
  },
};

export function createWidget(id) {
  const widget = widgetRegistry[id];
  if (!widget) return '';

  const meta = WIDGET_META[id] || {};
  const openButton = widget.action === 'notifications'
    ? '<button class="btn small widget-open-btn" data-open-notifications type="button">Открыть</button>'
    : `<button class="btn small widget-open-btn" data-view="${widget.view}" type="button">Открыть</button>`;

  return `
    <div class="widget-shell widget-shell-${id}" data-widget="${id}">
      <div class="widget-dragbar">
        <span class="widget-title">
          <button class="widget-remove-btn" data-remove-widget="${id}" type="button" aria-label="Удалить виджет">×</button>
          <span>${widget.title}</span>
        </span>
        <small>переместить / изменить размер</small>
      </div>

      <div class="widget-head">
        <div class="widget-head-main">
          <span class="widget-head-icon" aria-hidden="true">${meta.icon || ''}</span>
          <div class="widget-head-copy">
            <h3>${widget.title}</h3>
            <small>${meta.subtitle || ''}</small>
          </div>
        </div>
        ${openButton}
      </div>

      <div class="widget-content">
        ${widget.render()}
      </div>
    </div>
  `;
}
