import { widgetRegistry } from './widgetRegistry.js';

export function createWidget(id) {
  const widget = widgetRegistry[id];

  if (!widget) {
    return '';
  }

  const openButton = widget.action === 'notifications'
    ? '<button class="btn primary" data-open-notifications type="button">Открыть</button>'
    : `<button class="btn primary" data-view="${widget.view}" type="button">Открыть</button>`;

  return `
    <div class="widget-shell" data-widget="${id}">
      <div class="widget-dragbar">
        <span class="widget-title">
          <button class="widget-remove-btn" data-remove-widget="${id}" type="button">×</button>
          <span>${widget.icon} ${widget.title}</span>
        </span>

        <small>переместить / изменить размер</small>
      </div>

      <div class="widget-head">
        <h3>${widget.title}</h3>
        ${openButton}
      </div>

      <div class="widget-content">
        ${widget.render()}
      </div>
    </div>
  `;
}
