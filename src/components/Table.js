export function Table(columns, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${columns.map(column => `<th>${column}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
