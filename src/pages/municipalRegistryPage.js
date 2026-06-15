export function renderMunicipalRegistryPage() {
  return `
    <section class="view" id="municipalRegistry">
      <div class="page-head cases-head registry-head">
        <div class="registry-title-row">
          <h2>Реестр муниципальной собственности</h2>
          <button class="icon-button registry-refresh-icon" data-registry-refresh type="button" title="Обновить реестр" aria-label="Обновить реестр">🔄</button>
        </div>
        <div class="cases-actions">
          <button class="btn" data-registry-archive-open type="button">📁 Архив</button>
        </div>
      </div>

      <div class="cases-toolbar">
        <div class="search-field-wrap">
          <input class="search-input" data-registry-search type="search" placeholder="Поиск через запятую: № ПК, адрес, собственник, суд, стадия...">
          <span class="search-field-icon" aria-hidden="true">🔍</span>
        </div>
        <div class="cases-toolbar-status">
          <span data-registry-count>0 записей</span>
          <span data-registry-db-status>База не проверена</span>
        </div>
      </div>


      <div class="registry-workspace">
        <div class="registry-viewbar">
          <div class="registry-new-inline">
            <button class="btn primary registry-new-btn" data-registry-new type="button">Новая запись</button>
            <button class="btn small primary registry-new-plus" data-registry-new type="button" title="Создать запись" aria-label="Создать запись">＋</button>
          </div>
          <div class="registry-view-switch" role="group" aria-label="Вид отображения реестра">
            <button class="registry-view-btn" data-registry-view="table" type="button">📋 Таблица</button>
            <button class="registry-view-btn" data-registry-view="cards" type="button">🗂️ Карточки</button>
          </div>
        </div>

        <article class="registry-editor-card" data-registry-editor>
          <div class="registry-editor-head">
            <div><h3 data-registry-editor-title>Новая запись</h3><p data-registry-current-id>Форма закрыта</p></div>
            <div class="registry-head-actions">
              <button class="btn small primary editor-toggle" data-registry-open type="button" title="Показать/скрыть карточку">＋</button>
            </div>
          </div>

          <form class="registry-form" data-registry-form id="registryFormMarker">
            <input type="hidden" name="id">
            <input type="hidden" name="general_case_id">
            <input type="hidden" name="attachments_json">
            <div class="registry-form-shell">
              <aside class="registry-section-nav" aria-label="Разделы формы реестра">
                <button class="registry-section-btn is-active" data-registry-section="object" type="button">
                  <span>1</span><b>Информация по объекту</b>
                </button>
                <button class="registry-section-btn" data-registry-section="case" type="button">
                  <span>2</span><b>Информация по гражданскому делу</b>
                </button>
              </aside>

              <div class="registry-section-panels">
                <section class="registry-inner-panel is-active" data-registry-panel="object">
                  <h4>Информация по объекту</h4>
                  <div class="registry-form-grid">
                    <label><span>№ ПК</span><input name="pk_number" data-registry-pk autocomplete="off"></label>
                    <label><span>Квартал</span><input name="kvartal" readonly></label>
                    <label class="wide"><span>Адрес объекта</span><input name="address" autocomplete="off"></label>
                    <label><span>Объект недвижимости</span><select name="property_type"><option></option><option>жилой дом</option><option>жилой дом и земельный участок</option><option>жилое помещение</option></select></label>
                    <label><span>Собственник объекта</span><input name="fio" autocomplete="off"></label>
                    <label class="wide"><span>Примечание</span><input name="notes" autocomplete="off"></label>
                    <div class="registry-documents-panel wide">
                      <div class="registry-documents-toolbar">
                        <button class="btn small" data-registry-attach-document type="button">📎 Прикрепить документ</button>
                        <input data-registry-document-input type="file" multiple hidden>
                      </div>
                      <div class="registry-documents-list" data-registry-documents-list>Документы не прикреплены</div>
                    </div>
                  </div>
                </section>

                <section class="registry-inner-panel" data-registry-panel="case">
                  <h4>Информация по гражданскому делу</h4>
                  <div class="registry-form-grid">
                    <label><span>Суд</span><input name="court" list="registryCourtList" autocomplete="off"></label>
                    <label><span>Стадии рассмотрения</span><input name="stage" list="registryStageList" autocomplete="off"></label>
                    <label><span>Дата судебного акта</span><input name="court_act_date" data-registry-date maxlength="10" placeholder="ДД.ММ.ГГГГ"></label>
                    <label><span>№ дела в суде</span><input name="court_act_number" autocomplete="off"></label>
                    <label class="wide"><span>Предмет / требования</span><textarea name="requirements" rows="3"></textarea></label>
                    <label><span>Обжалование</span><textarea name="appeal" rows="2"></textarea></label>
                    <label><span>Представители</span><input name="execution" list="registryUsersList" autocomplete="off"></label>
                    <label><span>Дата регистрации объекта в муниципальную собственность</span><input name="collected" data-registry-date maxlength="10" placeholder="ДД.ММ.ГГГГ"></label>
                    <label class="registry-check-card wide"><input type="checkbox" name="review_ready"> <span>Отзыв готов</span></label>
                  </div>
                </section>
              </div>
            </div>

            <datalist id="registryCourtList"></datalist>
            <datalist id="registryStageList"></datalist>
            <datalist id="registryUsersList"></datalist>

            <div class="registry-editor-actions">
              <div class="registry-editor-left-actions">
                <button class="btn danger" data-registry-archive type="button" hidden>📦 Добавить в архив</button>
                <button class="btn danger" data-registry-delete type="button" hidden>🗑️ Удалить</button>
              </div>
              <button class="btn primary registry-save-btn" type="submit">💾 Сохранить</button>
            </div>
          </form>
        </article>

        <article class="registry-table-card" data-registry-table-view>
          <div class="registry-table-title"><div><h3>Список объектов</h3></div></div>
          <div class="registry-table-wrap">
            <table class="registry-table">
              <thead><tr><th>№ ПК</th><th>Адрес объекта</th><th>Собственник объекта</th><th>Суд</th><th>Стадия</th><th>Дата регистрации</th></tr></thead>
              <tbody data-registry-table-body><tr><td colspan="6" class="empty-cell">Загрузка...</td></tr></tbody>
            </table>
          </div>
        </article>

        <div class="registry-cards-list" data-registry-cards-list hidden>
          <div class="empty-card">Загрузка...</div>
        </div>
      </div>

      <dialog class="registry-archive-dialog" data-registry-archive-dialog>
        <div class="registry-archive-head">
          <div><h3>Архив реестра</h3><p>Записи, перенесённые в архив.</p></div>
          <button class="icon-button" data-registry-archive-close type="button">×</button>
        </div>
        <div class="registry-archive-body">
          <table class="registry-table archive">
            <thead><tr><th>№ ПК</th><th>Адрес объекта</th><th>Собственник</th><th>Суд</th><th>Дата</th><th>№ судебного акта</th><th>Дата регистрации</th><th></th></tr></thead>
            <tbody data-registry-archive-body><tr><td colspan="8" class="empty-cell">Загрузка...</td></tr></tbody>
          </table>
        </div>
      </dialog>
    </section>
  `;
}
