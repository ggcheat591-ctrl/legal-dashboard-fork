export function renderControlledCasesPage() {
  return `
    <section class="view" id="controlledCases">
      <div class="page-head cases-head controlled-head">
        <div>
          <h2>Перечень контрольных дел</h2>
        </div>
        <div class="cases-actions">
          <button class="btn" data-controlled-refresh type="button">Обновить</button>
          <button class="btn" data-controlled-full-table type="button">Открыть таблицу</button>
          <button class="btn" data-controlled-archive-toggle type="button">Архив</button>
        </div>
      </div>

      <div class="cases-toolbar">
        <div class="search-field-wrap">
          <input
            class="search-input"
            data-controlled-search
            type="search"
            placeholder="Можно искать через запятую: № ПК, суд, истец, ответчик, предмет, представитель, результат."
          >
          <span class="search-field-icon" aria-hidden="true">🔍</span>
        </div>
        <div class="cases-toolbar-status">
          <span data-controlled-count>0 дел</span>
          <span data-controlled-db-status>База не проверена</span>
        </div>
      </div>

      <div class="controlled-workspace">
        <div class="record-createbar controlled-createbar">
          <div class="record-create-inline">
            <button class="btn primary record-create-btn" data-controlled-new type="button">Новая запись</button>
            <button class="btn small primary record-create-plus" data-controlled-new type="button" title="Создать запись" aria-label="Создать запись">＋</button>
          </div>
        </div>

        <form class="controlled-editor-card" data-controlled-form data-controlled-editor>
          <div class="controlled-editor-head">
            <div>
              <h3 data-controlled-form-title>Новое контрольное дело</h3>
              <div class="controlled-current-id" data-controlled-current-id></div>
            </div>
            <button class="btn small primary editor-toggle" data-controlled-open type="button" title="Показать/скрыть карточку">＋</button>
          </div>

          <input type="hidden" name="id">

          <div class="controlled-form-grid">
            <label>
              <span>№ ПК</span>
              <input name="case_number" data-control-pk autocomplete="off" value="№">
            </label>

            <label>
              <span>№ дела в суде</span>
              <input name="court_case_number" autocomplete="off">
            </label>

            <label>
              <span>Суд</span>
              <input name="court" list="controlledCourtsList" autocomplete="off">
            </label>

            <label>
              <span>Представитель</span>
              <input name="representative" list="controlledRepresentativesList" autocomplete="off">
            </label>

            <label>
              <span>Истец</span>
              <textarea name="plaintiff" rows="2"></textarea>
            </label>

            <label>
              <span>Ответчик</span>
              <textarea name="defendant" rows="2"></textarea>
            </label>

            <label class="wide">
              <span>Предмет спора</span>
              <textarea name="subject" rows="3"></textarea>
            </label>
          </div>

          <div class="controlled-history-block">
            <div class="controlled-history-title">
              <h4>История результатов</h4>
              <div class="controlled-history-actions">
                <button class="btn small" data-history-add type="button">+</button>
                <button class="btn small" data-history-remove type="button">−</button>
              </div>
            </div>

            <div class="controlled-history-header">
              <span>№</span>
              <span>Примечания</span>
              <span>Время</span>
              <span>Дата</span>
              <span></span>
            </div>

            <div class="controlled-history-rows" data-controlled-history-rows></div>
          </div>

          <div class="controlled-editor-actions">
            <div class="controlled-left-actions">
              <button class="btn" data-controlled-clear type="button">Очистить</button>
              <button class="btn danger" data-controlled-archive-selected type="button" hidden>Удалить</button>
              <button class="btn restore" data-controlled-restore type="button" hidden>Восстановить из архива</button>
              <button class="btn danger" data-controlled-delete-archive type="button" hidden>Удалить навсегда</button>
            </div>
            <button class="btn primary" data-controlled-save type="submit">Сохранить</button>
          </div>

          <datalist id="controlledCourtsList"></datalist>
          <datalist id="controlledRepresentativesList"></datalist>
        </form>

        <div class="controlled-list-layout">
          <div class="controlled-main-panel">
            <div class="controlled-list-toolbar">
              <div>
                <h3 data-controlled-table-title>Перечень контрольных дел</h3>
                <p data-controlled-list-hint>Двойной клик по строке или карточке открывает дело в карточке заполнения. Календарь показывает карточки дел за выбранный день.</p>
              </div>

              <div class="controlled-list-actions">
                <div class="controlled-view-switch" role="group" aria-label="Вид перечня">
                  <button class="controlled-view-btn" data-controlled-view="table" type="button">📋 <span>Таблица</span></button>
                  <button class="controlled-view-btn" data-controlled-view="cards" type="button">🗂️ <span>Карточки</span></button>
                </div>
                <button class="btn small" data-controlled-export-inline type="button">Экспорт в Word</button>
              </div>
            </div>

            <div class="controlled-table-pane" data-controlled-table-pane>
              <div class="controlled-table-wrap">
                <table class="controlled-table">
                  <thead>
                    <tr>
                      <th>№ ПК</th>
                      <th>Истец</th>
                      <th>Ответчик</th>
                      <th>Предмет спора</th>
                      <th>История результатов</th>
                    </tr>
                  </thead>
                  <tbody data-controlled-table-body>
                    <tr><td colspan="5" class="empty-cell">Загрузка...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="controlled-cards-pane" data-controlled-cards-pane hidden>
              <div class="controlled-cards-grid" data-controlled-cards-grid>
                <div class="empty-card">Загрузка...</div>
              </div>
            </div>
          </div>

          <aside class="controlled-side-panel" data-controlled-side-panel>
            <div class="controlled-calendar-card">
              <div class="controlled-calendar-head">
                <h3>Календарь</h3>
                <div class="controlled-calendar-nav">
                  <button class="icon-button" data-controlled-month-prev type="button">‹</button>
                  <strong data-controlled-month-label></strong>
                  <button class="icon-button" data-controlled-month-next type="button">›</button>
                </div>
              </div>
              <div class="controlled-calendar-weekdays">
                <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
              </div>
              <div class="controlled-calendar-grid" data-controlled-calendar-grid></div>
              <div class="controlled-calendar-popover" data-controlled-calendar-popover hidden></div>
            </div>

            <div class="controlled-tasks-card">
              <div class="controlled-tasks-head">
                <h3>Ближайшие задачи</h3>
                <button class="link-button" data-controlled-open-calendar type="button">Календарь</button>
              </div>
              <div class="controlled-mini-tasks" data-controlled-mini-tasks></div>
            </div>
          </aside>
        </div>
      </div>

      <dialog class="controlled-full-dialog" data-controlled-full-dialog>
        <div class="controlled-full-head">
          <h3 data-controlled-full-title>Общий перечень дел</h3>
          <div class="cases-actions">
            <button class="btn" data-controlled-export type="button">Экспорт в Word</button>
            <button class="btn" data-controlled-full-close type="button">Закрыть</button>
          </div>
        </div>
        <div class="controlled-full-body">
          <table class="controlled-table full">
            <thead>
              <tr>
                <th>№ ПК</th>
                <th>Истец</th>
                <th>Ответчик</th>
                <th>Предмет спора</th>
                <th>История результатов</th>
              </tr>
            </thead>
            <tbody data-controlled-full-table-body></tbody>
          </table>
        </div>
      </dialog>

      <dialog class="controlled-view-dialog" data-controlled-view-dialog>
        <div class="controlled-view-dialog-head">
          <div>
            <span>Просмотр контрольного дела</span>
            <h3 data-controlled-view-title>Контрольное дело</h3>
          </div>
          <button class="icon-button" data-controlled-view-close type="button" aria-label="Закрыть">×</button>
        </div>
        <div class="controlled-view-dialog-body" data-controlled-view-body></div>
        <div class="controlled-view-dialog-actions">
          <button class="btn" data-controlled-view-close type="button">Закрыть</button>
        </div>
      </dialog>
    </section>
  `;
}
