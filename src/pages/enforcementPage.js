export function renderEnforcementPage() {
  return `
    <section class="view" id="enforcement">
      <div class="page-head cases-head enforcement-head">
        <div>
          <h2>Перечень исполнительных производств</h2>
                  </div>
        <div class="cases-actions">
          <button class="btn" data-enforcement-refresh type="button">Обновить</button>
          <button class="btn" data-enforcement-export type="button">Экспорт таблицы</button>
          <button class="btn" data-enforcement-archive-toggle type="button">Архив</button>
          <div class="enforcement-section-switch" aria-label="Выбор раздела исполнительных производств">
            <button class="enforcement-section-tab" data-enforcement-mode="debtor" type="button">Должники</button>
            <button class="enforcement-section-tab" data-enforcement-mode="creditor" type="button">Взыскатели</button>
          </div>
        </div>
      </div>

      <dialog class="enforcement-mode-dialog" data-enforcement-mode-dialog>
        <div class="enforcement-mode-dialog-head">
          <div>
            <h3>Выберите раздел</h3>
            <p>Откроется перечень исполнительных производств.</p>
          </div>
        </div>
        <div class="enforcement-mode-panel" data-enforcement-mode-panel>
          <button class="mode-card" data-enforcement-mode="debtor" type="button">
            <span>👤</span>
            <b>Должники</b>
          </button>
          <button class="mode-card" data-enforcement-mode="creditor" type="button">
            <span>💰</span>
            <b>Взыскатели</b>
          </button>
        </div>
      </dialog>

      <div class="enforcement-workspace" data-enforcement-workspace hidden>
        <div class="cases-toolbar enforcement-toolbar">
          <div class="search-field-wrap">
            <input
              class="search-input"
              data-enforcement-search
              type="search"
              placeholder="Можно искать через запятую: № ИП, дата, основание, срок, сумма, предмет, обжалование."
            >
            <span class="search-field-icon" aria-hidden="true">🔍</span>
          </div>
          <div class="cases-toolbar-status">
            <span data-enforcement-count>0 записей</span>
            <span data-enforcement-db-status>База не проверена</span>
          </div>
        </div>

        <div class="record-createbar enforcement-createbar">
          <div class="record-create-inline">
            <button class="btn primary record-create-btn" data-enforcement-new type="button">Новая запись</button>
            <button class="btn small primary record-create-plus" data-enforcement-new type="button" title="Создать запись" aria-label="Создать запись">＋</button>
          </div>
        </div>

        <div class="enforcement-filters-row">
          <label class="enforcement-filter-field">
            <span>Характер производства</span>
            <select data-enforcement-character-filter>
              <option value="all">Все производства</option>
              <option value="Материальное">Материальное</option>
              <option value="Нематериальное">Нематериальное</option>
            </select>
          </label>

          <label class="enforcement-color-field">
            <span>Материальное</span>
            <input type="color" data-enforcement-color="material" value="#22c55e">
          </label>

          <label class="enforcement-color-field">
            <span>Нематериальное</span>
            <input type="color" data-enforcement-color="nonMaterial" value="#8b5cf6">
          </label>

          <button class="btn" data-enforcement-debt-sum type="button">Рассчитать общую сумму долга</button>
          <strong class="enforcement-debt-total" data-enforcement-debt-total>Сумма долга: —</strong>
        </div>

        <form class="enforcement-editor-card" data-enforcement-form data-enforcement-editor>
          <div class="enforcement-editor-head">
            <div>
              <h3 data-enforcement-form-title>Новое исполнительное производство</h3>
              <p data-enforcement-form-subtitle>Выберите характер производства и заполните основные поля.</p>
            </div>
            <button class="btn small primary editor-toggle" data-enforcement-open type="button" title="Показать/скрыть карточку">＋</button>
          </div>

          <input type="hidden" name="id">

          <div class="enforcement-editor-grid">
            <fieldset class="enforcement-fieldset">
              <legend>📋 Основная информация</legend>

              <div class="enforcement-form-grid">
                <label>
                  <span>№ исполнительного производства</span>
                  <input name="case_number" autocomplete="off">
                </label>

                <label>
                  <span>Предмет исполнения</span>
                  <input name="subject_execution" autocomplete="off">
                </label>

                <label>
                  <span>Дата возбуждения</span>
                  <div class="date-input-wrap">
                    <input name="date_start" data-enforcement-date autocomplete="off" placeholder="ДД.ММ.ГГГГ">
                    <button class="btn small" data-date-today="date_start" type="button">сегодня</button>
                  </div>
                </label>

                <label>
                  <span>Срок исполнения</span>
                  <div class="date-input-wrap">
                    <input name="deadline" data-enforcement-date autocomplete="off" placeholder="ДД.ММ.ГГГГ">
                    <button class="btn small" data-date-today="deadline" type="button">сегодня</button>
                  </div>
                </label>

                <label class="wide">
                  <span>Основание возбуждения исполнительного производства</span>
                  <textarea name="basis" rows="2"></textarea>
                </label>

                <label class="wide">
                  <span>Сведения об обжаловании</span>
                  <textarea name="appeal_info" rows="2"></textarea>
                </label>
              </div>
            </fieldset>

            <fieldset class="enforcement-fieldset">
              <legend>Характер производства</legend>

              <div class="enforcement-character-buttons">
                <button class="character-button" data-enforcement-character="Материальное" type="button">Материальное</button>
                <button class="character-button" data-enforcement-character="Нематериальное" type="button">Нематериальное</button>
              </div>

              <input type="hidden" name="production_character">
              <input type="hidden" name="nature">

              <div class="enforcement-extra-panel" data-enforcement-extra-panel>
                <div class="enforcement-empty-hint">Выберите характер производства: материальное или нематериальное.</div>
              </div>
            </fieldset>
          </div>

          <div class="enforcement-editor-actions">
            <div class="enforcement-left-actions">
              <button class="btn" data-enforcement-clear type="button">Очистить</button>
              <button class="btn danger" data-enforcement-delete type="button" hidden>Удалить</button>
              <button class="btn danger" data-enforcement-to-archive type="button" hidden>В архив</button>
              <button class="btn restore" data-enforcement-restore type="button" hidden>Восстановить из архива</button>
              <button class="btn danger" data-enforcement-delete-archive type="button" hidden>Удалить навсегда</button>
            </div>

            <button class="btn primary" data-enforcement-save type="submit">Сохранить</button>
          </div>
        </form>

        <div class="enforcement-table-card">
          <div class="enforcement-table-title">
            <div>
              <h3 data-enforcement-table-title>Исполнительные производства</h3>
            </div>
            <div class="enforcement-view-switch">
              <button class="enforcement-view-btn is-active" data-enforcement-view="table" type="button">📋 Таблица</button>
              <button class="enforcement-view-btn" data-enforcement-view="cards" type="button">🗂 Карточки</button>
            </div>
          </div>

          <div class="enforcement-table-wrap" data-enforcement-table-pane>
            <table class="enforcement-table">
              <colgroup>
                <col class="enf-col-number">
                <col class="enf-col-character">
                <col class="enf-col-date">
                <col class="enf-col-basis">
                <col class="enf-col-claim">
                <col class="enf-col-debt">
                <col class="enf-col-deadline">
              </colgroup>
              <thead>
                <tr>
                  <th>№ ИП</th>
                  <th>Характер</th>
                  <th>Дата возбуждения</th>
                  <th>Основания возбуждения ИП</th>
                  <th data-enforcement-claim-head>Сумма требований</th>
                  <th>Сумма долга</th>
                  <th>Срок исполнения</th>
                </tr>
              </thead>
              <tbody data-enforcement-table-body>
                <tr><td colspan="7" class="empty-cell">Выберите раздел: должники или взыскатели.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="enforcement-cards-pane" data-enforcement-cards-pane hidden>
            <div class="enforcement-cards-grid" data-enforcement-cards-grid>
              <div class="empty-card">Выберите раздел: должники или взыскатели.</div>
            </div>
          </div>
        </div>
      </div>

      <dialog class="enforcement-export-dialog" data-enforcement-export-dialog>
        <div class="enforcement-export-head">
          <h3>Экспорт таблицы</h3>
          <button class="icon-button" data-enforcement-export-close type="button">×</button>
        </div>

        <div class="enforcement-export-body">
          <p>Какую таблицу хотите экспортировать?</p>

          <label class="export-check">
            <span>Перечень ИП материального характера</span>
            <input type="checkbox" data-export-material>
          </label>

          <label class="export-check">
            <span>Перечень ИП нематериального характера</span>
            <input type="checkbox" data-export-non-material>
          </label>
        </div>

        <div class="enforcement-export-actions">
          <button class="btn" data-enforcement-export-close type="button">Отмена</button>
          <button class="btn primary" data-enforcement-export-run type="button">Экспортировать</button>
        </div>
      </dialog>
    </section>
  `;
}
