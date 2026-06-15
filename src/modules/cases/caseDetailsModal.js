export function renderCaseDetailsModal(item) {
  return `
    <div class="case-details">
      <h3>${item.number}</h3>
      <p>${item.subject}</p>
    </div>
  `;
}
