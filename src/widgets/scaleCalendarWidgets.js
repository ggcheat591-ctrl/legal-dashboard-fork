export function initCalendarWidgetScaling() {
  const scale = () => scaleCalendarWidgets();

  window.addEventListener('resize', scale);
  window.addEventListener('dashboard:layout-change', () => {
    requestAnimationFrame(scale);
  });

  const observer = new ResizeObserver(scale);
  const dashboardGrid = document.querySelector('#dashboardGrid');
  if (dashboardGrid) observer.observe(dashboardGrid);

  requestAnimationFrame(scale);
}

export function scaleCalendarWidgets() {
  document.querySelectorAll('.calendar-fit').forEach(host => {
    const inner = host.querySelector('.calendar-inner');
    if (!inner) return;

    const baseW = 520;
    const baseH = 430;
    const hostW = Math.max(host.clientWidth, 1);
    const hostH = Math.max(host.clientHeight, 1);
    const scale = Math.max(0.45, Math.min(2.4, Math.min(hostW / baseW, hostH / baseH)));

    inner.style.transform = `scale(${scale})`;
  });
}
