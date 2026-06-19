import { dbApi } from '../api/dbApi.js';

let cachedRows = [];
let rowsLoaded = false;
let loadFailed = false;
let loadPromise = null;

export function renderCasesStatsWidget() {
  requestAnimationFrame(() => {
    if (rowsLoaded) renderCasesStats(cachedRows);
    ensureCasesData();
  });

  return `
    <div class="cases-stats-widget" data-cases-stats-widget>
      <div class="widget-stat-row cases-stats-grid">
        <div>
          <span class="stat-label">Всего дел</span>
          <b data-cases-widget-count aria-live="polite">—</b>
        </div>
        <div>
          <span class="stat-label">Явка</span>
          <b data-cases-widget-attendance aria-live="polite">—</b>
        </div>
        <div>
          <span class="stat-label">Контроль</span>
          <b data-cases-widget-control aria-live="polite">—</b>
        </div>
      </div>
    </div>
  `;
}

export function renderCasesTableWidget() {
  requestAnimationFrame(() => {
    if (rowsLoaded) renderCasesTable(cachedRows);
    ensureCasesData();
  });

  return `
    <div class="cases-table-widget" data-cases-table-widget>
      <div class="cases-table-scroll" tabindex="0" aria-label="Краткий общий перечень дел">
        <table class="cases-widget-table">
          <colgroup>
            <col class="cases-widget-col-pk">
            <col class="cases-widget-col-court-no">
            <col class="cases-widget-col-category">
            <col class="cases-widget-col-subject">
            <col class="cases-widget-col-plaintiff">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">№ ПК</th>
              <th scope="col">№ дела в суде</th>
              <th scope="col">Категория спора</th>
              <th scope="col">Предмет спора</th>
              <th scope="col">Истец</th>
            </tr>
          </thead>
          <tbody data-cases-widget-table-body>
            <tr>
              <td colspan="5" class="cases-widget-table-message">Загрузка данных...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Сохраняем экспорт для обратной совместимости со старыми импортами.
export function renderCasesWidget() {
  return renderCasesStatsWidget();
}

window.addEventListener('general-cases:updated', event => {
  setCasesRows(event.detail || []);
});

async function ensureCasesData() {
  if (rowsLoaded) {
    renderAllCasesWidgets();
    return cachedRows;
  }

  if (loadPromise) return loadPromise;

  loadPromise = dbApi.getGeneralCases()
    .then(rows => {
      setCasesRows(rows);
      return cachedRows;
    })
    .catch(() => {
      loadFailed = true;
      renderCasesTable(cachedRows);
      return cachedRows;
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

function setCasesRows(rows) {
  cachedRows = Array.isArray(rows) ? rows : [];
  rowsLoaded = true;
  loadFailed = false;
  renderAllCasesWidgets();
}

function renderAllCasesWidgets() {
  renderCasesStats(cachedRows);
  renderCasesTable(cachedRows);
}

function renderCasesStats(rows = []) {
  const count = document.querySelector('[data-cases-widget-count]');
  const attendance = document.querySelector('[data-cases-widget-attendance]');
  const control = document.querySelector('[data-cases-widget-control]');

  if (count) count.textContent = String(rows.length);
  if (attendance) attendance.textContent = String(rows.filter(row => Number(row.attendance_flag) === 1).length);
  if (control) control.textContent = String(rows.filter(row => Number(row.control_flag) === 1).length);
}

function renderCasesTable(rows = []) {
  const body = document.querySelector('[data-cases-widget-table-body]');
  if (!body) return;

  if (loadFailed && !rowsLoaded) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="cases-widget-table-message">Данные загрузятся после открытия раздела.</td>
      </tr>
    `;
    return;
  }

  if (!rowsLoaded) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="cases-widget-table-message">Дел нет</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows.slice(0, 30).map(row => {
    const caseNo = row.case_no || 'Без № ПК';
    const courtNo = row.court_no || '—';
    const category = row.category || '—';
    const subject = row.claim_subject || '—';
    const plaintiff = row.plaintiff || '—';
    const id = Number(row.id || 0);

    return `
      <tr>
        <td title="${escapeHtml(caseNo)}">${renderCaseNumber(caseNo, id)}</td>
        <td title="${escapeHtml(courtNo)}">${escapeHtml(courtNo)}</td>
        <td title="${escapeHtml(category)}">${escapeHtml(category)}</td>
        <td title="${escapeHtml(subject)}">${escapeHtml(subject)}</td>
        <td title="${escapeHtml(plaintiff)}">${escapeHtml(plaintiff)}</td>
      </tr>
    `;
  }).join('');
}

function renderCaseNumber(caseNo, id) {
  const label = escapeHtml(caseNo);
  if (!id) return label;

  return `
    <button
      class="cases-widget-case-link"
      data-general-open="${id}"
      type="button"
      title="Открыть дело ${label}"
    >${label}</button>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
