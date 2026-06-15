export function renderMapWidget() {
  return `
    <div class="map-widget-preview">
      <div class="map-widget-hero">
        <div class="map-widget-grid"></div>
        <span class="map-widget-pin pin-1">📍</span>
        <span class="map-widget-pin pin-2">⚖️</span>
        <span class="map-widget-pin pin-3">🏙️</span>
      </div>

      <div class="map-widget-info">
        <b>Карта + НСПД</b>
        <span>Функциональные зоны, WMS-слои, объекты и инструменты работы с картой.</span>
        <small>Нажми «Открыть», чтобы перейти в полноценный раздел карты.</small>
      </div>
    </div>
  `;
}
