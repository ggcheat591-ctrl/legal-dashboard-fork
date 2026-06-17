export function renderDashboardPage() {
  return `
    <section class="view active dashboard-modern" id="dashboard">
      <section class="dashboard-modern-hero">
        <div class="dashboard-modern-hero-copy">
          <span class="dashboard-modern-eyebrow">Рабочее пространство</span>
          <h2>Добро пожаловать в ЮрСферу</h2>
          <p>Все юридические дела, сроки, заседания, документы и поручения собраны в единой панели.</p>
        </div>

        <div class="dashboard-modern-hero-actions">
          <button class="dashboard-modern-primary-action" data-dashboard-action="new-case" type="button">
            <span aria-hidden="true">＋</span>
            Новое дело
          </button>
          <button class="dashboard-modern-secondary-action" data-view="calendar" type="button">
            <span aria-hidden="true">▣</span>
            Календарь
          </button>
        </div>
      </section>

      <section class="dashboard-modern-metrics" aria-label="Ключевые показатели">
        <article class="dashboard-modern-metric">
          <div class="dashboard-modern-metric-head">
            <span>Активные дела</span>
            <i class="dashboard-modern-metric-icon primary" aria-hidden="true">▤</i>
          </div>
          <strong data-dashboard-active-cases>—</strong>
          <small data-dashboard-active-cases-note>Загрузка данных...</small>
        </article>

        <article class="dashboard-modern-metric">
          <div class="dashboard-modern-metric-head">
            <span>Заседания сегодня</span>
            <i class="dashboard-modern-metric-icon success" aria-hidden="true">◷</i>
          </div>
          <strong data-dashboard-today-hearings>—</strong>
          <small data-dashboard-today-hearings-note>Загрузка данных...</small>
        </article>

        <article class="dashboard-modern-metric">
          <div class="dashboard-modern-metric-head">
            <span>Сроки на неделю</span>
            <i class="dashboard-modern-metric-icon warning" aria-hidden="true">△</i>
          </div>
          <strong data-dashboard-week-deadlines>—</strong>
          <small data-dashboard-week-deadlines-note>Загрузка данных...</small>
        </article>

        <article class="dashboard-modern-metric">
          <div class="dashboard-modern-metric-head">
            <span>Просроченные задачи</span>
            <i class="dashboard-modern-metric-icon danger" aria-hidden="true">!</i>
          </div>
          <strong data-dashboard-overdue-tasks>—</strong>
          <small data-dashboard-overdue-tasks-note>Загрузка данных...</small>
        </article>
      </section>

      <section class="dashboard-modern-quick-actions" aria-label="Быстрые действия">
        <button class="dashboard-modern-quick-action" data-dashboard-action="new-case" type="button">
          <i class="primary" aria-hidden="true">＋</i>
          <span><b>Создать дело</b><small>Добавить новое юридическое дело</small></span>
        </button>

        <button class="dashboard-modern-quick-action" data-view="cases" type="button">
          <i class="cyan" aria-hidden="true">▤</i>
          <span><b>Открыть документы</b><small>Перейти к карточкам дел и файлам</small></span>
        </button>

        <button class="dashboard-modern-quick-action" data-dashboard-action="new-task" type="button">
          <i class="green" aria-hidden="true">✓</i>
          <span><b>Поставить задачу</b><small>Создать запись в календаре</small></span>
        </button>

        <button class="dashboard-modern-quick-action" data-view="schedule" type="button">
          <i class="yellow" aria-hidden="true">◷</i>
          <span><b>График заседаний</b><small>Открыть судебное расписание</small></span>
        </button>
      </section>

      <section class="dashboard-modern-overview-grid">
        <article class="dashboard-modern-panel dashboard-modern-cases-panel">
          <header class="dashboard-modern-panel-head">
            <div>
              <h3>Последние дела</h3>
              <p>Недавно добавленные или изменённые записи</p>
            </div>
            <button data-view="cases" type="button">Все дела →</button>
          </header>
          <div class="dashboard-modern-case-list" data-dashboard-recent-cases>
            <div class="dashboard-modern-empty">Загрузка дел...</div>
          </div>
        </article>

        <div class="dashboard-modern-side-stack">
          <article class="dashboard-modern-panel">
            <header class="dashboard-modern-panel-head">
              <div>
                <h3>Ближайшие сроки</h3>
                <p>Незавершённые задачи на ближайшие дни</p>
              </div>
              <button data-view="calendar" type="button">Календарь →</button>
            </header>
            <div class="dashboard-modern-list" data-dashboard-deadlines>
              <div class="dashboard-modern-empty">Загрузка сроков...</div>
            </div>
          </article>

          <article class="dashboard-modern-panel">
            <header class="dashboard-modern-panel-head">
              <div>
                <h3>Заседания сегодня</h3>
                <p data-dashboard-today-label>Сегодня</p>
              </div>
              <button data-view="schedule" type="button">График →</button>
            </header>
            <div class="dashboard-modern-list" data-dashboard-hearings>
              <div class="dashboard-modern-empty">Загрузка заседаний...</div>
            </div>
          </article>
        </div>
      </section>

      <section class="dashboard-modern-widgets-section">
        <div class="dashboard-modern-widgets-head">
          <div>
            <h3>Рабочие виджеты</h3>
            <p>Существующие интерактивные виджеты и сохранённая раскладка</p>
          </div>
        </div>

        <div class="dashboard-edit-hint">
          Перемещай виджеты за верхнюю плашку. Меняй размер за правый нижний угол.
          Gridstack сам не даёт виджетам накладываться друг на друга.
        </div>

        <div class="grid-stack" id="dashboardGrid"></div>
      </section>
    </section>
  `;
}
