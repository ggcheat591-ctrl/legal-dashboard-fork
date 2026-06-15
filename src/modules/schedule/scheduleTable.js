export function renderScheduleTable(items) {
  return `
    <table>
      <thead>
        <tr><th>Дата</th><th>Суд</th><th>Время</th><th>Истец</th><th>Ответчик</th></tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.date}</td>
            <td>${item.court}</td>
            <td>${item.time}</td>
            <td>${item.claimant}</td>
            <td>${item.defendant}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
