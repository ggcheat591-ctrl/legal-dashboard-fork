export function initMapFullscreenButton() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-open-map-fullscreen]');
    if (!button) return;

    const frame = document.querySelector('#embeddedUserMap');
    const shell = document.querySelector('.embedded-map-shell');
    const target = frame || shell;

    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch {
      window.open('/map/index.html', '_blank', 'noopener,noreferrer');
    }
  });
}
