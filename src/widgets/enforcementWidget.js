import { dbApi } from '../api/dbApi.js';

export function renderEnforcementWidget() {
  requestAnimationFrame(loadEnforcementWidget);

  return `
    <div class="enforcement-widget-real">
      <div class="enforcement-widget-stats">
        <div><span>Должники</span><b data-enforcement-widget-debtor>—</b></div>
        <div><span>Взыскатели</span><b data-enforcement-widget-creditor>—</b></div>
        <div><span>Материальные</span><b data-enforcement-widget-material>—</b></div>
      </div>
      <div class="enforcement-widget-list" data-enforcement-widget-list>
        <div class="muted">Загрузка данных...</div>
      </div>
    </div>
  `;
}

window.addEventListener('enforcement:updated', event => renderEnforcementRows(event.detail || []));

async function loadEnforcementWidget() {
  if (!document.querySelector('[data-enforcement-widget-list]')) return;
  try {
    const [debtorRows, creditorRows] = await Promise.all([
      dbApi.getEnforcement('debtor'),
      dbApi.getEnforcement('creditor')
    ]);
    renderEnforcementRows([...debtorRows, ...creditorRows]);
  } catch {
    const list = document.querySelector('[data-enforcement-widget-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия раздела.</div>';
  }
}

function renderEnforcementRows(rows = []) {
  const debtor = document.querySelector('[data-enforcement-widget-debtor]');
  const creditor = document.querySelector('[data-enforcement-widget-creditor]');
  const material = document.querySelector('[data-enforcement-widget-material]');
  const list = document.querySelector('[data-enforcement-widget-list]');

  if (debtor) debtor.textContent = rows.filter(row => row.mode === 'debtor').length || rows.length;
  if (creditor) creditor.textContent = rows.filter(row => row.mode === 'creditor').length;
  if (material) material.textContent = rows.filter(row => row.production_character === 'Материальное' || row.nature === 'material').length;

  if (list) {
    list.innerHTML = rows.slice(0, 8).map(row => `
      <article class="enforcement-widget-item">
        <b>${escapeHtml(row.case_number || row.ip_number || 'Без № ИП')}</b>
        <span>${escapeHtml(row.date_start || row.start_date || '—')} · ${escapeHtml(row.production_character || '—')}</span>
        <p>${escapeHtml(row.basis || row.start_basis || '—')}</p>
      </article>
    `).join('') || '<div class="muted">Записей нет</div>';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
