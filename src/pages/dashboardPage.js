export function renderDashboardPage() {
  return `
    <section class="view active dashboard-modern" id="dashboard">
      <header class="dashboard-modern-intro">
        <div class="dashboard-modern-intro-copy">
          <span class="dashboard-modern-eyebrow">Рабочее пространство</span>
          <h2>Панель управления</h2>
          <p>Главный экран собран из существующих рабочих виджетов. Их можно перемещать, изменять по размеру и сохранять в удобной раскладке.</p>
        </div>

        <div class="dashboard-modern-widget-count" aria-label="Количество доступных виджетов">
          <strong>4</strong>
          <span>рабочих виджета</span>
        </div>
      </header>

      <div class="dashboard-edit-hint">
        Перемещай виджеты за верхнюю плашку. Меняй размер за правый нижний угол.
        Gridstack сам не даёт виджетам накладываться друг на друга.
      </div>

      <div class="dashboard-modern-grid-shell">
        <div class="grid-stack" id="dashboardGrid"></div>
      </div>
    </section>
  `;
}
