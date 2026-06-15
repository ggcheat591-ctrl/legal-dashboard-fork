export function renderCalendarGrid(days) {
  return `
    <div class="calendar-page-grid">
      ${days.map(day => `<div class="calendar-page-cell">${day}</div>`).join('')}
    </div>
  `;
}
