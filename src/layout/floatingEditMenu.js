export function renderFloatingEditMenu() {
  return `
    <div class="floating-edit-menu" id="floatingEditMenu">
      <div class="floating-add-menu" id="floatingAddMenu"></div>

      <div class="floating-edit-actions">
        <div class="floating-edit-item">
          <span class="floating-edit-label">Добавить виджет</span>
          <button class="floating-edit-btn add" id="addWidgetBtn" type="button">＋</button>
        </div>

        <div class="floating-edit-item">
          <span class="floating-edit-label">Сохранить расположение</span>
          <button class="floating-edit-btn save" id="saveLayoutBtn" type="button">💾</button>
        </div>

        <div class="floating-edit-item">
          <span class="floating-edit-label">Сбросить</span>
          <button class="floating-edit-btn reset" id="resetLayoutBtn" type="button">↺</button>
        </div>
      </div>

      <button class="floating-edit-btn main" id="editDashboardBtn" type="button" title="Редактирование главного меню">✎</button>
    </div>
  `;
}
