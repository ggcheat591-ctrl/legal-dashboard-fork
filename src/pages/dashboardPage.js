export function renderDashboardPage() {
  return `
    <section class="view active" id="dashboard">
      <div class="dashboard-edit-hint">
        Перемещай виджеты за верхнюю плашку. Меняй размер за правый нижний угол.
        Gridstack сам не даёт виджетам накладываться друг на друга.
      </div>

      <div class="grid-stack" id="dashboardGrid"></div>
    </section>
  `;
}
