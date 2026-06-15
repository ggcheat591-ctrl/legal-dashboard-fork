import { dbApi } from '../api/dbApi.js';
import { getCurrentUserName } from '../auth/session.js';

let state = {
  tasks: [],
  monthDate: new Date()
};

export function renderCalendarWidget() {
  requestAnimationFrame(loadCalendarWidget);

  return `
    <div class="calendar-mini-widget" data-calendar-mini-widget>
      <div class="calendar-mini-widget-head">
        <button data-calendar-mini-month="-1" type="button">‹</button>
        <strong data-calendar-mini-title>Календарь</strong>
        <button data-calendar-mini-month="1" type="button">›</button>
      </div>
      <div class="calendar-mini-widget-weekdays">
        <span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span>
      </div>
      <div class="calendar-mini-widget-grid" data-calendar-mini-grid>
        <div class="muted">Загрузка...</div>
      </div>
    </div>
  `;
}

document.addEventListener('click', event => {
  const monthButton = event.target.closest('[data-calendar-mini-month]');
  if (monthButton) {
    const shift = Number(monthButton.dataset.calendarMiniMonth || 0);
    state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + shift, 1);
    loadCalendarWidget();
  }

  const dayButton = event.target.closest('[data-calendar-mini-day]');
  if (dayButton) {
    const date = dayButton.dataset.calendarMiniDay;
    if (!date) return;
    window.openView?.('calendar');
    window.dispatchEvent(new CustomEvent('calendar:select-date', { detail: { date } }));
  }
});

window.addEventListener('calendar:updated', event => {
  const detail = event.detail || {};
  if (Array.isArray(detail.tasks)) {
    state.tasks = detail.tasks;
    renderMiniCalendar();
  }
});

async function loadCalendarWidget() {
  if (!document.querySelector('[data-calendar-mini-widget]')) return;

  const start = toIsoDate(new Date(state.monthDate.getFullYear(), state.monthDate.getMonth(), 1));
  const end = toIsoDate(new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 0));

  try {
    state.tasks = await dbApi.getCalendarTasks({ start, end, user: getCurrentUserName() });
    renderMiniCalendar();
  } catch {
    const grid = document.querySelector('[data-calendar-mini-grid]');
    if (grid) grid.innerHTML = '<div class="muted">Данные загрузятся после открытия календаря.</div>';
  }
}

function renderMiniCalendar() {
  const grid = document.querySelector('[data-calendar-mini-grid]');
  const title = document.querySelector('[data-calendar-mini-title]');
  if (!grid) return;

  const year = state.monthDate.getFullYear();
  const month = state.monthDate.getMonth();
  const today = toIsoDate(new Date());

  if (title) title.textContent = `${monthName(month)} ${year}`;

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) cells.push('<div class="calendar-mini-widget-day empty"></div>');

  for (let day = 1; day <= last.getDate(); day += 1) {
    const iso = toIsoDate(new Date(year, month, day));
    const tasks = state.tasks.filter(task => getTaskDate(task) === iso);
    cells.push(`
      <button class="calendar-mini-widget-day ${iso === today ? 'today' : ''} ${tasks.length ? 'has-tasks' : ''}" data-calendar-mini-day="${iso}" type="button">
        <b>${day}</b>
        ${tasks.length ? `<span>${tasks.length}</span>` : ''}
      </button>
    `);
  }

  grid.innerHTML = cells.join('');
}

function getTaskDate(task) { return task?.date_str || task?.date || ''; }

function toIsoDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function monthName(month) {
  return ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][month] || '';
}
