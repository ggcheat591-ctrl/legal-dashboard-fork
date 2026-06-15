export function renderEnforcementTable(items) {
  return `
    <table>
      <thead>
        <tr><th>№ ИП</th><th>Должник</th><th>Сумма</th><th>Статус</th></tr>
      </thead>
      <tbody>
        ${items.map(item => `<tr><td>${item.number}</td><td>${item.debtor}</td><td>${item.amount}</td><td>${item.status}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}
