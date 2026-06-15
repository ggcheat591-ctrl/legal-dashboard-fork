export function renderMapPage() {
  return `
    <section class="view" id="map">
      <div class="page-head map-page-head">
        <div>
          <h2>Карта</h2>
          <p>Готовый вариант карты подключён из переданного архива.</p>
        </div>

        <div class="map-page-actions">
          <button class="btn primary" data-open-map-fullscreen type="button">
            Открыть карту на весь экран
          </button>
        </div>
      </div>

      <div class="embedded-map-shell">
        <iframe
          id="embeddedUserMap"
          class="embedded-user-map"
          src="/map/index.html"
          title="Карта"
          loading="eager"
        ></iframe>
      </div>
    </section>
  `;
}
