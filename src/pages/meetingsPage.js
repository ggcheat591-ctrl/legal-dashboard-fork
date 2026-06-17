export function renderMeetingsPage() {
  const iconCalendar = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3"></rect>
      <path d="M8 2v4M16 2v4M3 9h18"></path>
      <path d="M12 12v6M9 15h6"></path>
    </svg>`;
  const iconFolder = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"></path>
      <path d="M8 12h8"></path>
      <path d="M12 9v6"></path>
    </svg>`;
  const iconUsers = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
      <circle cx="9.5" cy="7" r="3"></circle>
      <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16.5 4.13a3 3 0 0 1 0 5.74"></path>
    </svg>`;
  const iconList = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13"></path>
      <path d="M3 6h.01M3 12h.01M3 18h.01"></path>
    </svg>`;
  const iconPhone = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.89.33 1.76.63 2.59a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.49-1.28a2 2 0 0 1 2.11-.45c.83.3 1.7.51 2.59.63A2 2 0 0 1 22 16.92z"></path>
    </svg>`;
  const iconDocument = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path>
      <path d="M14 2v5h5"></path>
      <path d="M9 13h6M9 17h6M9 9h2"></path>
    </svg>`;
  const iconPin = `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l9.19-9.2a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 1 1-2.12-2.12l7.78-7.78"></path>
    </svg>`;

  return `
    <section class="view meetings-view" id="meetings">
      <div class="meetings-shell" data-meetings-shell data-meetings-flow="landing">
        <header class="meetings-main-head" data-meetings-main-head>
          <div>
            <h2>Совещания</h2>
            <p>Выберите, что вы хотите сделать</p>
          </div>
        </header>

        <section class="meetings-entry-panel" data-meetings-entry-panel>
          <button class="meetings-entry-card" data-meetings-launch-create type="button">
            <span class="meetings-entry-icon">${iconCalendar}</span>
            <strong>Создать новое совещание</strong>
            <span>Создание нового пакета документов: список участников, повестка, телефонограмма, протокол.</span>
          </button>
          <button class="meetings-entry-card" data-meetings-launch-archive type="button">
            <span class="meetings-entry-icon">${iconFolder}</span>
            <strong>Открыть архив совещаний</strong>
            <span>Просмотр и открытие ранее сохранённых совещаний и связанных документов.</span>
          </button>
        </section>

        <div class="meetings-preloader" data-meetings-preloader hidden>
          <div class="meetings-preloader-card">
            <span class="meetings-preloader-spinner" aria-hidden="true"></span>
            <strong data-meetings-preloader-text>Загрузка...</strong>
          </div>
        </div>

        <article class="meetings-editor-card" data-meetings-editor>
          <div class="meetings-editor-topline">
            <nav class="meetings-breadcrumbs" aria-label="Хлебные крошки">
              <button class="meetings-breadcrumb-link" data-meetings-breadcrumb-action="home" type="button">Совещания</button>
              <span class="meetings-breadcrumb-separator">/</span>
              <button class="meetings-breadcrumb-link" data-meetings-breadcrumb-action="type-select" data-meetings-breadcrumb-parent type="button">Новое совещание</button>
              <span class="meetings-breadcrumb-separator">/</span>
              <span class="meetings-breadcrumb-current" data-meetings-breadcrumb-current>Выбор типа документа</span>
            </nav>
            <button class="meetings-inline-back" data-meetings-back-home type="button">← Назад</button>
          </div>

          <div class="meetings-editor-head">
            <div>
              <h3 data-meetings-editor-title>Новое совещание</h3>
              <p data-meetings-current-id>Нажмите «+» и выберите тип совещания</p>
            </div>
            <div class="meetings-head-actions">
              <button class="btn danger meetings-delete-btn" data-meetings-delete type="button">🗑️ Удалить</button>
              <button class="meetings-mini-toggle in-card" data-meetings-open type="button" title="Свернуть форму">−</button>
            </div>
          </div>

          <form class="meetings-form" data-meetings-form>
            <input type="hidden" name="id">
            <input type="hidden" name="attachment_type" value="participants">

            <section class="meetings-form-block">
              <div class="meetings-block-head">
                <div>
                  <h4>Параметры совещания</h4>
                  <p>Заполните основные сведения по совещанию и выбранному документу.</p>
                </div>
              </div>

              <div class="meetings-form-grid top">
                <label class="wide">
                  <span>По вопросу</span>
                  <textarea name="title" rows="2"></textarea>
                </label>
                <label><span>Дата</span><input name="date_val" data-meetings-date maxlength="10" placeholder="ДД.ММ.ГГГГ"></label>
                <label><span>Время</span><input name="time_val" data-meetings-time maxlength="5" placeholder="ЧЧ:ММ"></label>
                <label><span>Кабинет</span><input name="cabinet_number" value="213"></label>
              </div>
            </section>

            <div class="meetings-doc-type-row" role="tablist" aria-label="Разделы совещания">
              <button class="btn small selected" data-meetings-doc-type="participants" type="button" role="tab" aria-selected="true" aria-current="page">${iconUsers}<span>Список участников</span></button>
              <button class="btn small" data-meetings-doc-type="agenda" type="button" role="tab" aria-selected="false">${iconList}<span>Повестка</span></button>
              <button class="btn small" data-meetings-doc-type="telegram" type="button" role="tab" aria-selected="false">${iconPhone}<span>Телефонограмма</span></button>
              <button class="btn small" data-meetings-doc-type="protocol" type="button" role="tab" aria-selected="false">${iconDocument}<span>Протокол</span></button>
              <button class="btn small" data-meetings-doc-type="documents" type="button" role="tab" aria-selected="false">${iconPin}<span>Документы</span></button>
            </div>

            <div class="meetings-split">
              <section class="meetings-inner-panel" data-meetings-agenda-panel>
                <div class="meetings-panel-head">
                  <div>
                    <h4 data-meetings-agenda-title>Вопросы повестки</h4>
                    <p>Список вопросов и подписантов документа.</p>
                  </div>
                </div>
                <div class="meetings-list-box" data-meetings-agenda-rows></div>
                <div class="meetings-row-tools">
                  <button class="btn small" data-meetings-agenda-add type="button">＋ Добавить</button>
                  <button class="btn small" data-meetings-agenda-remove type="button">− Удалить</button>
                </div>

                <label class="meetings-field" data-meetings-agenda-sign>
                  <span>Должность</span>
                  <input name="agenda_sign_position" value="Председатель правового комитета">
                </label>
                <label class="meetings-field" data-meetings-agenda-sign>
                  <span>ФИО</span>
                  <input name="agenda_sign_fio" value="О.И. Насыров">
                </label>

                <label class="meetings-field" data-meetings-protocol-field>
                  <span>Председательствующий</span>
                  <input name="protocol_chair_fio" value="О.А. Финк">
                </label>
                <label class="meetings-field" data-meetings-protocol-field>
                  <span>Должность председательствующего</span>
                  <input name="protocol_chair_position" value="заместитель главы администрации города, руководитель аппарата">
                </label>
              </section>

              <section class="meetings-inner-panel" data-meetings-side-panel>
                <div class="meetings-panel-head">
                  <div>
                    <h4 data-meetings-tasks-title>Поручения / участники</h4>
                    <p>Выберите участников или заполните поручения по совещанию.</p>
                  </div>
                </div>

                <input type="hidden" name="participants">
                <input type="hidden" name="invited_participants">

                <div class="meetings-participants-tools" data-meetings-people-selectors>
                  <button class="btn small" data-meetings-toggle-people="msu_ip" type="button">${iconUsers}<span>Органы МСУ</span></button>
                  <button class="btn small" data-meetings-toggle-people="invited_ip" type="button">${iconUsers}<span>Приглашённые</span></button>
                </div>

                <div class="meetings-selected-summary" data-meetings-people-counters>
                  <div><span>Органы МСУ:</span> <b data-meetings-selected-count="msu_ip">0</b></div>
                  <div><span>Приглашённые:</span> <b data-meetings-selected-count="invited_ip">0</b></div>
                </div>

                <section class="meetings-people-panel" data-meetings-people-panel="msu_ip" data-meetings-people-chooser hidden>
                  <div class="meetings-people-panel-head">
                    <strong>Органы МСУ</strong>
                    <button class="btn tiny" data-meetings-collapse-people="msu_ip" type="button">Скрыть</button>
                  </div>
                  <div class="meetings-people-tree" data-meetings-people-tree="msu_ip">Загрузка...</div>
                </section>

                <section class="meetings-people-panel" data-meetings-people-panel="invited_ip" data-meetings-people-chooser hidden>
                  <div class="meetings-people-panel-head">
                    <strong>Приглашённые</strong>
                    <button class="btn tiny" data-meetings-collapse-people="invited_ip" type="button">Скрыть</button>
                  </div>
                  <div class="meetings-people-tree" data-meetings-people-tree="invited_ip">Загрузка...</div>
                </section>

                <div class="meetings-field meetings-selected-list" data-meetings-selected-list>
                  <span>Выбранные участники совещания</span>
                  <div data-meetings-selected-names>Список пока пуст</div>
                </div>

                <label class="meetings-field" data-meetings-keeper-field>
                  <span>Протокол ведет</span>
                  <input name="protocol_keeper" value="Иванова Елена Николаевна">
                </label>

                <label class="meetings-field" data-meetings-protocol-field>
                  <span>№ протокола</span>
                  <input name="protocol_number" value="200/05/ПРОТ-___">
                </label>

                <div class="meetings-list-box tasks" data-meetings-task-rows></div>
                <div class="meetings-row-tools">
                  <button class="btn small" data-meetings-task-add type="button">＋ Добавить</button>
                  <button class="btn small" data-meetings-task-remove type="button">− Удалить</button>
                </div>

                <div class="meetings-report-row" data-meetings-protocol-field>
                  <input name="protocol_report_text" value="О проделанной работе проинформировать правовой комитет администрации города Барнаула до ">
                  <input name="protocol_report_date" data-meetings-date maxlength="10" placeholder="ДД.ММ.ГГГГ">
                  <label><input type="checkbox" name="protocol_report_enabled"> <span>Включить</span></label>
                </div>
              </section>
            </div>

            <section class="meetings-inner-panel meetings-telegram-panel" data-meetings-telegram-panel hidden>
              <div class="meetings-panel-head">
                <div>
                  <h4>Телефонограмма</h4>
                  <p>Заполните параметры отправки телефонограммы.</p>
                </div>
              </div>

              <div class="meetings-extra-grid">
                <label data-meetings-telegram-field><span>№ телефонограммы</span><input name="telegram_number" value="№ 200/05/ИТФ___"></label>
                <label data-meetings-telegram-field class="telegram-email-field"><span>Электронная почта</span><input name="transfer_email" value="fedorova-en@barnaul-adm.ru"></label>
                <label data-meetings-telegram-field class="telegram-transfer-field"><span>Передала</span><input name="transfer_fio" value="Иванова Елена Николаевна"></label>
                <label data-meetings-telegram-field class="telegram-phone-field"><span>Телефон</span><input name="transfer_phone"></label>
                <label data-meetings-telegram-field><span>ФИО подписи</span><input name="telegram_sign_fio" value="О.А. Финк"></label>
              </div>
            </section>

            <section class="meetings-inner-panel meetings-documents-panel" data-meetings-documents-panel hidden>
              <div class="meetings-panel-head">
                <div>
                  <h4>Документы</h4>
                  <p>Прикрепите файл совещания или откройте уже сохранённый документ.</p>
                </div>
              </div>

              <div class="meetings-extra-grid">
                <label class="wide meetings-attachment-path"><span>Документы</span><input name="attachment_path" placeholder="Файл не прикреплен"></label>
                <div class="meetings-attachment-actions">
                  <input data-meetings-file-input type="file" hidden>
                  <button class="btn small" data-meetings-attach type="button">${iconPin}<span>Прикрепить</span></button>
                  <button class="btn small" data-meetings-open-file type="button">${iconFolder}<span>Открыть</span></button>
                </div>
              </div>
            </section>

            <div class="meetings-editor-actions">
              <button class="btn meetings-clear-btn" data-meetings-clear type="button">Очистить</button>
              <div class="case-dialog-buttons">
                <button class="btn meetings-generate-btn" data-meetings-generate type="button">${iconDocument}<span>Сформировать документ</span></button>
                <button class="btn primary meetings-save-btn" type="submit">${iconDocument}<span>Сохранить</span></button>
              </div>
            </div>
            <datalist id="meetingsCommitteesList"></datalist>
          </form>
        </article>

        <section class="meetings-archive-zone" data-meetings-archive>
          <div class="meetings-archive-topline" data-meetings-archive-topline hidden>
            <nav class="meetings-breadcrumbs" aria-label="Хлебные крошки архива совещаний">
              <button class="meetings-breadcrumb-link" data-meetings-breadcrumb-action="home" type="button">Совещания</button>
              <span class="meetings-breadcrumb-separator">/</span>
              <span class="meetings-breadcrumb-current">Архив совещаний</span>
            </nav>
          </div>
          <div class="meetings-archive-head">
            <div>
              <h3>Архив совещаний</h3>
              <p>Открывайте сохранённые совещания и связанные документы</p>
            </div>
            <button class="meetings-mini-toggle archive-toggle" data-meetings-launch-archive type="button" title="Прокрутить к архиву">−</button>
          </div>

          <div class="meetings-archive-toolbar">
            <div class="search-field-wrap meetings-search-wrap">
              <input class="search-input" data-meetings-search type="search" placeholder="Поиск по теме, участнику или документу">
              <span class="search-field-icon" aria-hidden="true">🔍</span>
            </div>
            <button class="btn meetings-refresh-btn" data-meetings-refresh type="button">↻ Обновить</button>
            <div class="meetings-archive-status">
              <span data-meetings-count>0 записей</span>
              <span data-meetings-db-status>База не проверена</span>
            </div>
          </div>

          <article class="meetings-table-card">
            <div class="meetings-table-title">
              <div>
                <h3>Всего совещаний: <span data-meetings-total>0</span></h3>
                <p>Двойной клик открывает совещание</p>
              </div>
            </div>
            <div class="meetings-table-wrap">
              <table class="meetings-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Дата</th>
                    <th>Время</th>
                    <th>По вопросу</th>
                    <th>Участники</th>
                    <th>Документ</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody data-meetings-table-body><tr><td colspan="7" class="empty-cell">Загрузка...</td></tr></tbody>
              </table>
            </div>
          </article>
        </section>
      </div>

      <dialog class="meetings-type-dialog" data-meetings-type-dialog>
        <div class="meetings-type-dialog-shell">
          <div class="meetings-type-dialog-head">
            <div class="meetings-breadcrumbs meetings-breadcrumbs-light">
              <button class="meetings-breadcrumb-link" data-meetings-breadcrumb-action="home" type="button">Совещания</button>
              <span class="meetings-breadcrumb-separator">/</span>
              <button class="meetings-breadcrumb-link" data-meetings-breadcrumb-action="type-select" type="button">Новое совещание</button>
              <span class="meetings-breadcrumb-separator">/</span>
              <span class="meetings-breadcrumb-current">Выбор типа документа</span>
            </div>
            <button class="icon-button" data-meetings-type-cancel type="button">×</button>
          </div>
          <div class="meetings-type-dialog-body">
            <button class="meetings-dialog-back" data-meetings-type-cancel type="button">← Назад</button>
            <h3>Выберите тип документа для совещания</h3>
            <p>Определите, какой документ нужно подготовить</p>
            <div class="meetings-type-grid">
              <button data-meetings-type-pick="participants" type="button">
                <span class="meetings-type-icon">${iconUsers}</span>
                <div>
                  <b>Список участников</b>
                  <span>Участники, приглашённые, документы</span>
                </div>
                <i>→</i>
              </button>
              <button data-meetings-type-pick="agenda" type="button">
                <span class="meetings-type-icon">${iconList}</span>
                <div>
                  <b>Повестка</b>
                  <span>Вопросы, докладчики, информирующие</span>
                </div>
                <i>→</i>
              </button>
              <button data-meetings-type-pick="telegram" type="button">
                <span class="meetings-type-icon">${iconPhone}</span>
                <div>
                  <b>Телефонограмма</b>
                  <span>№, почта, передала, телефон, адресаты</span>
                </div>
                <i>→</i>
              </button>
              <button data-meetings-type-pick="protocol" type="button">
                <span class="meetings-type-icon">${iconDocument}</span>
                <div>
                  <b>Протокол</b>
                  <span>Председательствующий, поручения, сроки</span>
                </div>
                <i>→</i>
              </button>
              <button data-meetings-type-pick="documents" type="button">
                <span class="meetings-type-icon">${iconPin}</span>
                <div>
                  <b>Документы</b>
                  <span>Прикрепление и открытие файлов совещания</span>
                </div>
                <i>→</i>
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </section>
  `;
}
