import { dbApi } from '../api/dbApi.js';

export function renderEmergencyFundWidget() {
  requestAnimationFrame(loadEmergencyWidget);

  return `
    <div class="emergency-widget-real">
      <div class="emergency-widget-stats">
        <div><span>Записей</span><b data-emergency-widget-count>—</b></div>
        <div><span>Исполнено</span><b data-emergency-widget-done>—</b></div>
      </div>
      <div class="emergency-widget-list" data-emergency-widget-list>
        <div class="muted">Загрузка данных...</div>
      </div>
    </div>
  `;
}

window.addEventListener('emergency:updated', event => renderEmergencyRows(event.detail || []));

async function loadEmergencyWidget() {
  if (!document.querySelector('[data-emergency-widget-list]')) return;
  try {
    renderEmergencyRows(await dbApi.getEmergencyFund());
  } catch {
    const list = document.querySelector('[data-emergency-widget-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия раздела.</div>';
  }
}

function renderEmergencyRows(rows = []) {
  const count = document.querySelector('[data-emergency-widget-count]');
  const done = document.querySelector('[data-emergency-widget-done]');
  const list = document.querySelector('[data-emergency-widget-list]');

  if (count) count.textContent = rows.length;
  if (done) done.textContent = rows.filter(row => String(row.execution || '').toLowerCase().includes('исполнено')).length;

  if (list) {
    list.innerHTML = rows.slice(0, 8).map(row => `
      <article class="emergency-widget-item">
        <b>${escapeHtml(row.pk_number || row.fio || 'Без № ПК')}</b>
        <span>${escapeHtml(row.kvartal || '—')} · ${escapeHtml(row.stage || '—')}</span>
        <p>${escapeHtml(row.address || '—')}</p>
      </article>
    `).join('') || '<div class="muted">Записей нет</div>';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
