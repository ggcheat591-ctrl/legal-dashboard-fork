const colors = {
  'В процессе': 'orange',
  'Контрольное': 'purple',
  'Явка': 'red',
  'Завершено': 'green'
};

export function StatusTag(status) {
  return `<span class="status-tag ${colors[status] || 'blue'}">${status}</span>`;
}
