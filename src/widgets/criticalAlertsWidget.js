export function renderCriticalAlertsWidget() {
  return `
    <section class="critical-alerts-widget" data-critical-alerts-widget>
      <div class="critical-alerts-summary">
        <div>
          <span>Критические ситуации</span>
          <b data-critical-alerts-count>Загрузка...</b>
        </div>
        <button class="btn small" type="button" data-open-notifications>Все уведомления</button>
      </div>
      <div class="critical-alerts-list" data-critical-alerts-list>
        <div class="critical-alerts-empty">Загрузка уведомлений...</div>
      </div>
    </section>
  `;
}
