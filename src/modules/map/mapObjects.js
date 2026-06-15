export function getMapObjectIcon(type) {
  const icons = {
    court: '⚖️',
    client: '🏢',
    bailiff: '📌'
  };

  return icons[type] || '📍';
}

export function getMapObjectTypeLabel(type) {
  const labels = {
    court: 'Суд',
    client: 'Клиент',
    bailiff: 'ФССП'
  };

  return labels[type] || 'Объект';
}

export function renderMapObjectCard(object) {
  return `
    <button class="map-object-card" data-map-object="${object.id}" type="button">
      <span class="map-object-type">${getMapObjectTypeLabel(object.type)}</span>
      <b>${object.name}</b>
      <small>${object.address}</small>
    </button>
  `;
}
