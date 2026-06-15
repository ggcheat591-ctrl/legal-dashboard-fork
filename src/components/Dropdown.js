export function Dropdown(items) {
  return `
    <div class="dropdown">
      ${items.map(item => `<button type="button" ${item.attrs || ''}>${item.label}</button>`).join('')}
    </div>
  `;
}
