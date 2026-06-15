export function renderCasesTable(items) {
  return `
    <table>
      <thead>
        <tr><th>№ дела</th><th>Истец</th><th>Ответчик</th><th>Статус</th></tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.number}</td>
            <td>${item.claimant}</td>
            <td>${item.defendant}</td>
            <td>${item.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
