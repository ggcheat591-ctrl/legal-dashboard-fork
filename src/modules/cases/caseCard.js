export function renderCaseCard(item) {
  return `
    <article class="case-card">
      <b>${item.number}</b>
      <p>${item.claimant} → ${item.defendant}</p>
      <small>${item.subject}</small>
    </article>
  `;
}
