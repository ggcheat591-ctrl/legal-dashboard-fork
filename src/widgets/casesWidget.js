import { dbApi } from '../api/dbApi.js';

export function renderCasesWidget() {
  requestAnimationFrame(loadCasesWidget);

  return `
    <div class="cases-widget-real">
      <div class="widget-stat-row">
        <div><span class="stat-label">Всего дел</span><b data-cases-widget-count>—</b></div>
        <div><span class="stat-label">Контроль</span><b data-cases-widget-control>—</b></div>
        <div><span class="stat-label">Явка</span><b data-cases-widget-attendance>—</b></div>
      </div>

      <div class="cases-widget-list" data-cases-widget-list>
        <div class="muted">Загрузка данных...</div>
      </div>
    </div>
  `;
}

window.addEventListener('general-cases:updated', event => renderCasesWidgetRows(event.detail || []));

async function loadCasesWidget() {
  if (!document.querySelector('[data-cases-widget-list]')) return;
  try {
    renderCasesWidgetRows(await dbApi.getGeneralCases());
  } catch {
    const list = document.querySelector('[data-cases-widget-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия раздела.</div>';
  }
}

function renderCasesWidgetRows(rows = []) {
  const count = document.querySelector('[data-cases-widget-count]');
  const control = document.querySelector('[data-cases-widget-control]');
  const attendance = document.querySelector('[data-cases-widget-attendance]');
  const list = document.querySelector('[data-cases-widget-list]');

  if (count) count.textContent = rows.length;
  if (control) control.textContent = rows.filter(row => Number(row.control_flag) === 1).length;
  if (attendance) attendance.textContent = rows.filter(row => Number(row.attendance_flag) === 1).length;

  if (list) {
    list.innerHTML = rows.slice(0, 20).map(row => `
      <article class="cases-widget-card">
        <div class="cases-widget-card-head">
          <b>${escapeHtml(row.case_no || 'Без № ПК')}</b>
          <span>${renderFlags(row)}</span>
        </div>
        <div class="cases-widget-card-line"><span>Суд</span><p>${escapeHtml(row.court || '—')}</p></div>
        <div class="cases-widget-card-line"><span>Истец / Ответчик</span><p>${escapeHtml(row.plaintiff || '—')} / ${escapeHtml(row.defendant || '—')}</p></div>
        <div class="cases-widget-card-line"><span>Предмет</span><p>${escapeHtml(row.claim_subject || '—')}</p></div>
      </article>
    `).join('') || '<div class="muted">Дел нет</div>';
  }
}

function renderFlags(row) {
  const flags = [];
  if (Number(row.attendance_flag) === 1) flags.push('<i class="mini-flag attendance">Явка</i>');
  if (Number(row.control_flag) === 1) flags.push('<i class="mini-flag control">Контроль</i>');
  return flags.join('') || '<i class="mini-flag neutral">Обычное</i>';
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
