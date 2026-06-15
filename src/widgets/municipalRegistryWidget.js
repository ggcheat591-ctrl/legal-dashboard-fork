import { dbApi } from '../api/dbApi.js';

export function renderMunicipalRegistryWidget() {
  requestAnimationFrame(loadWidget);
  return `<div class="registry-widget-real"><div class="registry-widget-stats"><div><span>Объектов</span><b data-registry-widget-count>—</b></div></div><div class="registry-widget-list" data-registry-widget-list><div class="muted">Загрузка данных...</div></div></div>`;
}
async function loadWidget() {
  const list = document.querySelector('[data-registry-widget-list]');
  if (!list) return;
  try { renderRows(await dbApi.getMunicipalRegistry()); }
  catch { list.innerHTML = '<div class="muted">Данные загрузятся после открытия раздела.</div>'; }
}
function renderRows(rows=[]) {
  const count = document.querySelector('[data-registry-widget-count]');
  const list = document.querySelector('[data-registry-widget-list]');
  if (count) count.textContent = rows.length;
  if (list) list.innerHTML = rows.slice(0,8).map(row => `<article class="registry-widget-item"><b>${escapeHtml(row.pk_number || 'Без № ПК')}</b><span>${escapeHtml(row.address || '—')}</span><p>${escapeHtml(row.requirements || '—')}</p></article>`).join('') || '<div class="muted">Объектов нет</div>';
}
function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;"); }
