import { dbApi } from '../api/dbApi.js';

export function renderScheduleWidget() {
  requestAnimationFrame(loadScheduleWidget);

  return `
    <div class="schedule-widget-real schedule-widget-today">
      <div class="schedule-widget-head">
        <span>График заседаний на сегодня</span>
        <b data-schedule-widget-count>—</b>
      </div>

      <div class="schedule-widget-list" data-schedule-widget-list>
        <div class="muted">Загрузка данных...</div>
      </div>
    </div>
  `;
}

window.addEventListener('schedule:updated', event => renderScheduleRows(filterToday(event.detail || [])));

async function loadScheduleWidget() {
  if (!document.querySelector('[data-schedule-widget-list]')) return;
  try {
    const rows = (await dbApi.getCourtSchedule()).filter(row => Number(row.is_date_row) !== 1);
    renderScheduleRows(filterToday(rows));
  } catch {
    const list = document.querySelector('[data-schedule-widget-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия графика.</div>';
  }
}

function filterToday(rows = []) {
  const today = formatTodayRu();
  return rows
    .filter(row => String(row.session_date || '').trim() === today)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}

function renderScheduleRows(rows = []) {
  const count = document.querySelector('[data-schedule-widget-count]');
  const list = document.querySelector('[data-schedule-widget-list]');

  if (count) count.textContent = rows.length;
  if (!list) return;

  list.innerHTML = rows.map(row => `
    <article class="schedule-widget-item today-card">
      <div class="schedule-widget-time">${escapeHtml(row.time || '—')}</div>
      <b>${escapeHtml(row.court || 'Суд не указан')}</b>
      <span>${escapeHtml(row.representative || '—')}</span>
      <p>${escapeHtml(row.plaintiff || '—')} / ${escapeHtml(row.defendant || '—')}</p>
      <small>${escapeHtml(row.result || row.category || '—')}</small>
    </article>
  `).join('') || `<div class="muted">На сегодня (${formatTodayRu()}) заседаний нет</div>`;
}

function formatTodayRu() {
  const date = new Date();
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear()
  ].join('.');
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
