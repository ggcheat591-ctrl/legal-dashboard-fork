export function renderUtilityPanels() {
  return `
    <div class="utility-backdrop" id="utilityBackdrop" hidden></div>

    <aside class="utility-panel" id="notesPanel" hidden>
      <div class="utility-panel-head">
        <div>
          <h3>Рабочие заметки</h3>
          <p>Заметки сохраняются автоматически на этом компьютере.</p>
        </div>
        <button class="icon-button" type="button" data-close-utility>×</button>
      </div>

      <div class="notes-tools">
        <button class="btn small" id="newNoteBtn" type="button">Новая заметка</button>
        <button class="btn small danger" id="deleteNoteBtn" type="button">Удалить</button>
      </div>

      <div class="notes-layout">
        <div class="notes-list" id="notesList"></div>

        <div class="note-editor">
          <input id="noteTitleInput" class="note-title-input" placeholder="Название заметки">
          <textarea id="noteTextInput" class="note-text-input" placeholder="Текст рабочей заметки..."></textarea>
          <div class="note-save-state" id="noteSaveState">Готово</div>
        </div>
      </div>
    </aside>

    <aside class="utility-panel compact" id="notificationsPanel" hidden>
      <div class="utility-panel-head">
        <div>
          <h3>Уведомления</h3>
          <p>Заседания, процессуальные сроки и критические ситуации по делам.</p>
        </div>
        <button class="icon-button" type="button" data-close-utility>×</button>
      </div>

      <div class="notifications-toolbar">
        <div class="notifications-tabs" role="tablist" aria-label="Разделы уведомлений">
          <button class="notifications-tab is-active" type="button" data-notification-tab="active">
            Актуальные <span data-notification-active-count>0</span>
          </button>
          <button class="notifications-tab" type="button" data-notification-tab="overdue">
            Просроченные <span data-notification-overdue-count>0</span>
          </button>
        </div>
        <button class="btn small" type="button" data-notifications-mark-all>Отметить все прочитанными</button>
      </div>

      <div class="notifications-status" data-notifications-status>Загрузка...</div>
      <div class="notifications-list" data-notifications-list></div>
    </aside>
  `;
}
