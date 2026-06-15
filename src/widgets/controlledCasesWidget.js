import { dbApi } from '../api/dbApi.js';

export function renderControlledCasesWidget() {
  requestAnimationFrame(loadControlledWidget);

  return `
    <div class="controlled-widget-real">
      <div class="controlled-widget-stats">
        <div><span>Контрольных дел</span><b data-controlled-widget-count>—</b></div>
        <div><span>С историей</span><b data-controlled-widget-history>—</b></div>
      </div>
      <div class="controlled-widget-list" data-controlled-widget-list>
        <div class="muted">Загрузка данных...</div>
      </div>
    </div>
  `;
}

window.addEventListener('controlled-cases:updated', event => renderControlledRows(event.detail || []));

async function loadControlledWidget() {
  if (!document.querySelector('[data-controlled-widget-list]')) return;
  try {
    renderControlledRows(await dbApi.getControlledCases());
  } catch {
    const list = document.querySelector('[data-controlled-widget-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия раздела.</div>';
  }
}

function renderControlledRows(rows = []) {
  const count = document.querySelector('[data-controlled-widget-count]');
  const history = document.querySelector('[data-controlled-widget-history]');
  const list = document.querySelector('[data-controlled-widget-list]');

  if (count) count.textContent = rows.length;
  if (history) history.textContent = rows.filter(row => String(row.result || '').trim()).length;

  if (list) {
    list.innerHTML = rows.slice(0, 8).map(row => `
      <article class="controlled-widget-item">
        <b>${escapeHtml(row.case_number || '№')}</b>
        <span>${escapeHtml(row.plaintiff || '—')} / ${escapeHtml(row.defendant || '—')}</span>
        <p>${escapeHtml(row.subject || '—')}</p>
      </article>
    `).join('') || '<div class="muted">Дел нет</div>';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
