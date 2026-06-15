import { dbApi } from '../api/dbApi.js';
import { getCurrentUserName } from '../auth/session.js';

let state = { tasks: [], clickTimer: null };

export function renderCalendarTodayTasksWidget() {
  requestAnimationFrame(loadTodayWidget);

  return `
    <div class="calendar-today-only-widget" data-calendar-today-widget>
      <div class="calendar-today-only-head">
        <div>
          <b>Задачи на сегодня</b>
          <span>${formatRuDate(toIsoDate(new Date()))}</span>
        </div>
        <strong data-calendar-today-only-count>—</strong>
      </div>

      <div class="calendar-today-only-list" data-calendar-today-only-list>
        <div class="muted">Загрузка задач...</div>
      </div>
    </div>
  `;
}

document.addEventListener('click', event => {
  const card = event.target.closest('[data-calendar-today-task]');
  if (!card) return;
  const id = Number(card.dataset.calendarTodayTask);
  clearTimeout(state.clickTimer);
  state.clickTimer = setTimeout(() => editTask(id), 180);
});

window.addEventListener('calendar:updated', event => {
  const detail = event.detail || {};
  if (Array.isArray(detail.tasks)) {
    state.tasks = detail.tasks.filter(task => getTaskDate(task) === toIsoDate(new Date()));
    renderTodayTasks();
  } else {
    loadTodayWidget();
  }
});

async function loadTodayWidget() {
  if (!document.querySelector('[data-calendar-today-widget]')) return;

  const today = toIsoDate(new Date());

  try {
    state.tasks = await dbApi.getCalendarTasks({ date: today, user: getCurrentUserName() });
    renderTodayTasks();
  } catch {
    const list = document.querySelector('[data-calendar-today-only-list]');
    if (list) list.innerHTML = '<div class="muted">Данные загрузятся после открытия календаря.</div>';
  }
}

function renderTodayTasks() {
  const count = document.querySelector('[data-calendar-today-only-count]');
  const list = document.querySelector('[data-calendar-today-only-list]');
  if (count) count.textContent = state.tasks.length;
  if (!list) return;

  const tasks = [...state.tasks].sort((a, b) => String(getTaskTime(a)).localeCompare(String(getTaskTime(b))));

  list.innerHTML = tasks.map(task => `
    <article class="calendar-today-only-task" data-calendar-today-task="${task.id}">
      <b>${escapeHtml(getTaskTime(task) || '—')}</b>
      <div>
        <strong>${escapeHtml(getTaskDescription(task) || getTaskType(task) || 'Задача')}</strong>
        <span>${escapeHtml(task.court || task.subject || task.assignment || '—')}</span>
      </div>
    </article>
  `).join('') || '<div class="muted">На сегодня задач нет</div>';
}

function editTask(id) {
  const task = state.tasks.find(item => Number(item.id) === Number(id));
  if (!task) return;
  window.openView?.('calendar');
  window.dispatchEvent(new CustomEvent('calendar:edit-task', { detail: { task } }));
}

function getTaskDate(task) { return task?.date_str || task?.date || ''; }
function getTaskTime(task) { return task?.time_val || task?.time || ''; }
function getTaskType(task) { return task?.task_type || task?.type || ''; }
function getTaskDescription(task) { return task?.description || task?.desc || ''; }

function toIsoDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function formatRuDate(value) {
  const [y, m, d] = String(value || '').split('-');
  return d && m && y ? `${d}.${m}.${y}` : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
