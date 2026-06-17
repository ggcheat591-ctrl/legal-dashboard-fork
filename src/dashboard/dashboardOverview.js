import { dbApi } from '../api/dbApi.js';
import { getCurrentUserName } from '../auth/session.js';

let initialized = false;
let refreshTimer = 0;

export function initDashboardOverview() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-dashboard-action]');
    if (!action) return;

    if (action.dataset.dashboardAction === 'new-case') {
      event.preventDefault();
      window.openView?.('cases');
      window.setTimeout(() => document.querySelector('[data-general-new]')?.click(), 50);
    }

    if (action.dataset.dashboardAction === 'new-task') {
      event.preventDefault();
      window.openView?.('calendar');
      window.setTimeout(() => document.querySelector('[data-calendar-new]')?.click(), 50);
    }
  });

  window.addEventListener('app:view-changed', event => {
    if (event.detail?.viewId === 'dashboard') scheduleRefresh();
  });
  window.addEventListener('general-cases:updated', scheduleRefresh);
  window.addEventListener('calendar:updated', scheduleRefresh);
  window.addEventListener('schedule:updated', scheduleRefresh);

  scheduleRefresh();
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(loadOverview, 80);
}

async function loadOverview() {
  if (!document.querySelector('#dashboard.dashboard-modern')) return;

  const today = toIsoDate(new Date());
  const weekEnd = offsetIso(7);
  const overdueStart = offsetIso(-365);

  const [casesResult, tasksResult, scheduleResult] = await Promise.allSettled([
    dbApi.getGeneralCases(),
    dbApi.getCalendarTasks({ start: overdueStart, end: weekEnd, user: getCurrentUserName() }),
    dbApi.getCourtSchedule(),
  ]);

  const cases = casesResult.status === 'fulfilled' && Array.isArray(casesResult.value) ? casesResult.value : [];
  const tasks = tasksResult.status === 'fulfilled' && Array.isArray(tasksResult.value) ? tasksResult.value : [];
  const schedule = scheduleResult.status === 'fulfilled' && Array.isArray(scheduleResult.value) ? scheduleResult.value : [];

  const unfinishedTasks = tasks.filter(task => !isDone(task));
  const weekTasks = unfinishedTasks.filter(task => {
    const date = getTaskDate(task);
    return date && date >= today && date <= weekEnd;
  });
  const overdueTasks = unfinishedTasks.filter(task => isTaskOverdue(task, today));
  const todayHearings = schedule
    .filter(row => Number(row?.is_date_row || 0) !== 1)
    .filter(row => normalizeDate(row?.session_date || row?.hearing_date || '') === today)
    .sort((a, b) => String(a?.time || '').localeCompare(String(b?.time || '')));

  setText('[data-dashboard-active-cases]', String(cases.length));
  setText('[data-dashboard-active-cases-note]', casesResult.status === 'fulfilled' ? `${countFlag(cases, 'control_flag')} на контроле` : 'Не удалось загрузить данные');
  setText('[data-dashboard-today-hearings]', String(todayHearings.length));
  setText('[data-dashboard-today-hearings-note]', scheduleResult.status === 'fulfilled' ? getNextHearingNote(todayHearings) : 'Не удалось загрузить данные');
  setText('[data-dashboard-week-deadlines]', String(weekTasks.length));
  setText('[data-dashboard-week-deadlines-note]', tasksResult.status === 'fulfilled' ? `${weekTasks.filter(task => getTaskDate(task) === today).length} на сегодня` : 'Не удалось загрузить данные');
  setText('[data-dashboard-overdue-tasks]', String(overdueTasks.length));
  setText('[data-dashboard-overdue-tasks-note]', tasksResult.status === 'fulfilled' ? (overdueTasks.length ? 'Требуют внимания' : 'Просроченных задач нет') : 'Не удалось загрузить данные');
  setText('[data-dashboard-today-label]', formatLongRuDate(today));

  renderRecentCases(cases, casesResult.status === 'fulfilled');
  renderDeadlines(weekTasks, tasksResult.status === 'fulfilled');
  renderHearings(todayHearings, scheduleResult.status === 'fulfilled');
}

function renderRecentCases(rows, loaded) {
  const node = document.querySelector('[data-dashboard-recent-cases]');
  if (!node) return;
  if (!loaded) {
    node.innerHTML = '<div class="dashboard-modern-empty error">Не удалось загрузить дела.</div>';
    return;
  }

  const recent = [...rows]
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
    .slice(0, 5);

  node.innerHTML = recent.map(row => {
    const title = row.claim_subject || `${row.plaintiff || '—'} / ${row.defendant || '—'}`;
    const subtitle = [row.court, row.plaintiff, row.defendant].filter(Boolean).join(' · ') || 'Сведения не заполнены';
    const status = Number(row.control_flag) === 1 ? 'Контроль' : Number(row.attendance_flag) === 1 ? 'Явка' : 'В работе';
    const statusClass = Number(row.control_flag) === 1 ? 'control' : Number(row.attendance_flag) === 1 ? 'attendance' : 'work';
    return `
      <button class="dashboard-modern-case-row" data-view="cases" type="button">
        <span class="dashboard-modern-case-number">${escapeHtml(row.case_no || 'Без №')}</span>
        <span class="dashboard-modern-case-copy">
          <b>${escapeHtml(title)}</b>
          <small>${escapeHtml(subtitle)}</small>
        </span>
        <span class="dashboard-modern-status ${statusClass}">${status}</span>
      </button>
    `;
  }).join('') || '<div class="dashboard-modern-empty">Дел пока нет.</div>';
}

function renderDeadlines(rows, loaded) {
  const node = document.querySelector('[data-dashboard-deadlines]');
  if (!node) return;
  if (!loaded) {
    node.innerHTML = '<div class="dashboard-modern-empty error">Не удалось загрузить сроки.</div>';
    return;
  }

  const items = [...rows]
    .sort((a, b) => `${getTaskDate(a)} ${getTaskTime(a)}`.localeCompare(`${getTaskDate(b)} ${getTaskTime(b)}`))
    .slice(0, 4);

  node.innerHTML = items.map(task => {
    const date = getTaskDate(task);
    const dateParts = formatDateBadge(date);
    const title = getTaskDescription(task) || getTaskType(task) || task.assignment || task.subject || 'Задача';
    const subtitle = task.court || task.subject || task.assignment || 'Календарь';
    return `
      <button class="dashboard-modern-list-item" data-view="calendar" type="button">
        <span class="dashboard-modern-date-badge"><b>${dateParts.day}</b><small>${dateParts.month}</small></span>
        <span class="dashboard-modern-list-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(subtitle)}</small></span>
        <span class="dashboard-modern-list-time">${escapeHtml(getTaskTime(task) || formatRuDate(date))}</span>
      </button>
    `;
  }).join('') || '<div class="dashboard-modern-empty">Сроков на ближайшую неделю нет.</div>';
}

function renderHearings(rows, loaded) {
  const node = document.querySelector('[data-dashboard-hearings]');
  if (!node) return;
  if (!loaded) {
    node.innerHTML = '<div class="dashboard-modern-empty error">Не удалось загрузить заседания.</div>';
    return;
  }

  node.innerHTML = rows.slice(0, 4).map(row => {
    const title = row.court || row.category || 'Судебное заседание';
    const subtitle = [row.plaintiff, row.defendant].filter(Boolean).join(' / ') || row.representative || 'График заседаний';
    return `
      <button class="dashboard-modern-list-item" data-view="schedule" type="button">
        <span class="dashboard-modern-time-badge">${escapeHtml(row.time || '—')}</span>
        <span class="dashboard-modern-list-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(subtitle)}</small></span>
        <span class="dashboard-modern-list-time cyan">Сегодня</span>
      </button>
    `;
  }).join('') || '<div class="dashboard-modern-empty">На сегодня заседаний нет.</div>';
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function countFlag(rows, field) {
  return rows.filter(row => Number(row?.[field] || 0) === 1).length;
}

function getNextHearingNote(rows) {
  if (!rows.length) return 'Заседаний нет';
  return rows[0]?.time ? `Ближайшее в ${rows[0].time}` : 'Есть записи без времени';
}

function getTaskDate(task) { return normalizeDate(task?.date_str || task?.date || ''); }
function getTaskTime(task) { return String(task?.time_val || task?.time || '').trim(); }
function getTaskType(task) { return String(task?.task_type || task?.type || '').trim(); }
function getTaskDescription(task) { return String(task?.description || task?.desc || '').trim(); }
function isDone(task) { return Number(task?.done || task?.is_done || 0) === 1 || String(task?.done).toLowerCase() === 'true'; }

function isTaskOverdue(task, today) {
  const date = getTaskDate(task);
  if (!date) return false;
  if (date < today) return true;
  if (date !== today) return false;
  const time = getTaskTime(task);
  if (!/^\d{1,2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(':').map(Number);
  const due = new Date();
  due.setHours(hours, minutes, 0, 0);
  return due < new Date();
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function toIsoDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function offsetIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function formatRuDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return day && month && year ? `${day}.${month}.${year}` : '—';
}

function formatLongRuDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function formatDateBadge(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return { day: '—', month: '' };
  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(new Date(year, month - 1, day)).replace('.', '');
  return { day: String(day).padStart(2, '0'), month: monthName };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
