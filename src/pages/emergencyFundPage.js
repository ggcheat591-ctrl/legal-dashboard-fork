export function renderEmergencyFundPage() {
  return `
    <section class="view" id="emergencyFund">
      <div class="page-head cases-head emergency-head">
        <div class="emergency-title-row">
          <h2>Аварийный фонд</h2>
          <button class="icon-button emergency-refresh-icon" data-emergency-refresh type="button" aria-label="Обновить" title="Обновить">↻</button>
        </div>
        <div class="cases-actions emergency-head-controls">
          <button class="btn" data-emergency-upload type="button">📥 Загрузить таблицу</button>
          <button class="btn" data-emergency-reports-open type="button">📊 Отчеты</button>
          <button class="btn" data-emergency-archive-open type="button">📁 Архив</button>
        </div>
      </div>

      <input data-emergency-upload-input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" hidden>

      <div class="cases-toolbar">
        <div class="search-field-wrap">
          <input class="search-input" data-emergency-search type="search" placeholder="Поиск через запятую: № ПК, ФИО, адрес, требования, стадия, квартал...">
          <span class="search-field-icon" aria-hidden="true">🔍</span>
        </div>
        <div class="cases-toolbar-status">
          <span data-emergency-count>0 записей</span>
          <span data-emergency-db-status>База не проверена</span>
        </div>
      </div>

      <div class="emergency-obligation-summary emergency-obligation-summary-page" data-emergency-obligation-summary aria-live="polite">
        <div class="emergency-obligation-summary-title">
          <strong>Итоги по обязательствам</strong>
          <span title="Суммы считаются по всем сохранённым записям аварийного фонда">ⓘ</span>
        </div>
        <div class="emergency-obligation-summary-grid">
          <div class="emergency-obligation-stat"><span>Σ неисполненных обязательств по выкупу ЖП, руб.</span><strong data-emergency-summary="total_unfulfilled_sum">0,00</strong></div>
          <div class="emergency-obligation-stat"><span>Σ исполненных обязательств по выкупу ЖП, руб.</span><strong data-emergency-summary="total_fulfilled_sum">0,00</strong></div>
          <div class="emergency-obligation-stat"><span>S ЖП неисполненных обязательств, м²</span><strong data-emergency-summary="total_unfulfilled_area">0,00</strong></div>
          <div class="emergency-obligation-stat"><span>S предоставленных ЖП, м²</span><strong data-emergency-summary="total_provided_area">0,00</strong></div>
        </div>
      </div>

      <div class="emergency-workspace">
        <div class="record-createbar emergency-createbar">
          <div class="record-create-inline">
            <button class="btn primary record-create-btn" data-emergency-new type="button">Новая запись</button>
            <button class="btn small primary record-create-plus" data-emergency-new type="button" title="Создать запись" aria-label="Создать запись">＋</button>
          </div>
        </div>

        <article class="emergency-table-card">
          <div class="emergency-table-title">
            <div><h3>Общий перечень дел</h3><p>Клик по записи открывает карточку редактирования.</p></div>
            <div class="emergency-view-switch" role="group" aria-label="Вид аварийного фонда">
              <button class="emergency-view-btn" data-emergency-view="table" type="button">📋 Таблица</button>
              <button class="emergency-view-btn" data-emergency-view="cards" type="button">🗂 Карточки</button>
            </div>
          </div>
          <div class="emergency-table-wrap" data-emergency-table-pane>
            <table class="emergency-table">
              <thead>
                <tr>
                  <th>№ ПК</th><th>ФИО</th><th>Адрес объекта</th><th>Требования</th><th>Квартал исполнения</th><th></th>
                </tr>
              </thead>
              <tbody data-emergency-table-body><tr><td colspan="6" class="empty-cell">Загрузка...</td></tr></tbody>
            </table>
          </div>
          <div class="emergency-cards-pane" data-emergency-cards-pane hidden>
            <div class="emergency-cards-grid" data-emergency-cards-grid>
              <div class="empty-card">Загрузка...</div>
            </div>
          </div>
        </article>

        <article class="emergency-editor-card" data-emergency-editor>
          <div class="emergency-editor-head">
            <div>
              <h3 data-emergency-editor-title>Новая запись</h3>
              <p data-emergency-current-id>Заполните поля и нажмите «Сохранить»</p>
            </div>
            <div class="emergency-head-actions">
              <button class="btn small primary editor-toggle" data-emergency-open type="button" title="Показать/скрыть карточку">＋</button>
            </div>
          </div>

          <form class="emergency-form" id="emergencyFundForm" data-emergency-form>
            <input type="hidden" name="id">
            <input type="hidden" name="general_case_id">
            <input type="hidden" name="total_unfulfilled_sum">
            <input type="hidden" name="total_unfulfilled_area">

            <div class="emergency-editor-actions emergency-editor-actions-top">
              <div class="emergency-left-actions">
                <button class="btn" data-emergency-archive type="button" hidden>📦 Добавить в архив</button>
                <button class="btn danger" data-emergency-delete type="button" hidden>🗑️ Удалить</button>
              </div>
              <div class="case-dialog-buttons">
                <label class="review-ready-check">
                  <span>Отзыв готов</span>
                  <input name="review_ready" data-emergency-review-ready type="checkbox">
                </label>
                <button class="btn primary" type="submit">💾 Сохранить</button>
              </div>
            </div>

            <div class="emergency-form-shell">
              <aside class="emergency-form-nav" aria-label="Разделы карточки аварийного фонда">
                <button class="emergency-form-nav-item is-active" data-emergency-form-section="basic" type="button"><span>1</span><b>Основные данные</b><small>Сведения о деле и участниках</small></button>
                <button class="emergency-form-nav-item" data-emergency-form-section="court" type="button"><span>2</span><b>Суд</b><small>Судебное производство</small></button>
                <button class="emergency-form-nav-item" data-emergency-form-section="claim" type="button"><span>3</span><b>Исковые требования</b><small>Суммы и площади по иску</small></button>
                <button class="emergency-form-nav-item" data-emergency-form-section="execution" type="button"><span>4</span><b>Исполнение обязательств</b><small>Данные об исполнении</small></button>
                <button class="emergency-form-nav-item" data-emergency-form-section="deadlines" type="button"><span>5</span><b>Сроки расселения</b><small>Контроль аварийных домов</small></button>
              </aside>

              <div class="emergency-form-content">
                <section class="emergency-inner-panel is-active" data-emergency-section-panel="basic">
                  <h4>Основные данные</h4>
                  <p class="emergency-section-hint">Заполните основную информацию о деле.</p>
                  <div class="emergency-form-grid compact">
                    <label><span>№ ПК</span><input name="pk_number" data-emergency-pk autocomplete="off"></label>
                    <label><span>Квартал поступления</span><input name="kvartal" data-emergency-quarter readonly></label>
                    <label><span>ФИО</span><textarea name="fio" rows="2" placeholder="Несколько ФИО указывайте через запятую"></textarea><small class="emergency-field-hint">Например: Иванов Иван Иванович, Петров Петр Петрович</small></label>
                    <label><span>Прокурор</span><input name="prosecutor" list="emergencyProsecutorList" autocomplete="off"></label>
                    <label><span>Адрес ЖП</span><textarea name="address" rows="2"></textarea></label>
                    <label><span>Район</span><input name="district" list="emergencyDistrictList" autocomplete="off"></label>
                  </div>
                </section>

                <section class="emergency-inner-panel" data-emergency-section-panel="court">
                  <h4>Суд</h4>
                  <p class="emergency-section-hint">Информация о судебном производстве.</p>
                  <div class="emergency-form-grid compact">
                    <label><span>Суд</span><input name="court" list="emergencyCourtList" autocomplete="off"></label>
                    <label><span>№ дела</span><input name="case_num" data-emergency-case autocomplete="off"></label>
                    <label><span>Дата судебного акта</span><input name="judicial_act_date" data-emergency-date maxlength="10" placeholder="ДД.ММ.ГГГГ" autocomplete="off"></label>
                    <label><span>Стадия рассмотрения</span><input name="stage" list="emergencyStageList" autocomplete="off"></label>
                    <label class="wide"><span>Обжалование</span><textarea name="appeal" rows="2"></textarea></label>
                  </div>
                </section>

                <section class="emergency-inner-panel" data-emergency-section-panel="claim">
                  <h4>Исковые требования</h4>
                  <p class="emergency-section-hint">Заявленные требования и сумма/площадь, удовлетворённые судом.</p>
                  <div class="emergency-form-grid compact">
                    <label class="wide"><span>Требования</span><input name="requirements" list="emergencyRequirementsList" autocomplete="off"></label>
                    <label><span>Заявленная сумма по иску, руб.</span><input name="sum_claim" data-emergency-money autocomplete="off"></label>
                    <label><span>Заявленная S по иску, м²</span><input name="sum_property_claim" data-emergency-money autocomplete="off"></label>
                    <label><span>Взыскать, руб.</span><input name="collected" data-emergency-money autocomplete="off"></label>
                    <label><span>Предоставить ЖП, м²</span><input name="provided_area" data-emergency-money autocomplete="off"></label>
                  </div>
                </section>

                <section class="emergency-inner-panel obligation" data-emergency-section-panel="execution">
                  <h4>Исполнение обязательств</h4>
                  <p class="emergency-section-hint">Фактически исполненные обязательства и квартал исполнения.</p>
                  <input type="hidden" name="execution_people_json" value="">
                  <div class="emergency-form-grid compact">
                    <label><span>Итоговая сумма изъятия, руб.</span><input name="total_fulfilled_sum" data-emergency-money autocomplete="off"></label>
                    <label><span>S предоставленного ЖП, м²</span><input name="total_provided_area" data-emergency-money autocomplete="off"></label>
                    <label class="wide"><span>Примечания</span><textarea name="notes" rows="2"></textarea></label>
                    <label><span>Квартал исполнения</span><input name="execution_quarter" autocomplete="off"></label>
                  </div>
                  <div class="emergency-execution-people" data-emergency-execution-people>
                    <div class="empty-card">Отдельные ФИО пока не отмечены исполненными.</div>
                  </div>
                </section>

                <section class="emergency-inner-panel" data-emergency-section-panel="deadlines">
                  <h4>Сроки расселения</h4>
                  <p class="emergency-section-hint">Поля используются для анализа просрочек и критических адресов.</p>
                  <div class="emergency-form-grid compact">
                    <label><span>Дата признания дома аварийным</span><input name="condemned_date" data-emergency-date maxlength="10" placeholder="ДД.ММ.ГГГГ" autocomplete="off"></label>
                    <label><span>Срок расселения по распоряжению</span><input name="resettlement_deadline" data-emergency-date maxlength="10" placeholder="ДД.ММ.ГГГГ" autocomplete="off"></label>
                  </div>
                </section>
              </div>
            </div>

            <datalist id="emergencyCourtList"></datalist>
            <datalist id="emergencyStageList"></datalist>
            <datalist id="emergencyRequirementsList"></datalist>
            <datalist id="emergencyProsecutorList"></datalist>
            <datalist id="emergencyDistrictList"></datalist>

          </form>
        </article>
      </div>

      <dialog class="emergency-import-dialog" data-emergency-import-dialog>
        <div class="emergency-archive-head">
          <div><h3>Результаты совпадений</h3><p>Проверены записи из загруженной таблицы по фамилии.</p></div>
          <button class="icon-button" data-emergency-import-close type="button">×</button>
        </div>
        <div class="emergency-archive-body">
          <div data-emergency-import-body class="emergency-import-body">Загрузите таблицу.</div>
        </div>
        <div class="emergency-dialog-actions">
          <button class="btn" data-emergency-import-close type="button">Закрыть</button>
          <button class="btn primary" data-emergency-import-apply type="button">Отметить исполненными</button>
        </div>
      </dialog>

      <dialog class="emergency-reports-dialog" data-emergency-reports-dialog>
        <div class="emergency-archive-head">
          <div><h3>Отчеты аварийного фонда</h3><p>Квартальные и накопительные показатели по текущим данным.</p></div>
          <button class="icon-button" data-emergency-reports-close type="button">×</button>
        </div>
        <div class="emergency-reports-toolbar">
          <label><span>Отчетный квартал</span><select data-emergency-report-quarter><option value="1">I квартал</option><option value="2">II квартал</option><option value="3">III квартал</option><option value="4">IV квартал</option></select></label>
        </div>
        <div class="emergency-reports-body" data-emergency-reports-body></div>
      </dialog>

      <dialog class="emergency-archive-dialog" data-emergency-archive-dialog>
        <div class="emergency-archive-head">
          <div><h3>Архив аварийного фонда</h3><p>Записи, перенесённые в архив.</p></div>
          <button class="icon-button" data-emergency-archive-close type="button">×</button>
        </div>
        <div class="emergency-archive-body">
          <table class="emergency-table archive">
            <thead><tr><th>№ ПК</th><th>ФИО</th><th>Адрес</th><th>Требования</th><th>Суд</th><th>Дата/№ дела</th><th>Квартал исполнения</th><th></th></tr></thead>
            <tbody data-emergency-archive-body><tr><td colspan="8" class="empty-cell">Загрузка...</td></tr></tbody>
          </table>
        </div>
      </dialog>
    </section>
  `;
}
