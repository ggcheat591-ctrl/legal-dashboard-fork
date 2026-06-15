export function initSidebarCollapse() {
  const button = document.querySelector('#sidebarCollapseBtn');
  if (!button) return;

  const saved = localStorage.getItem('legal-dashboard-sidebar-collapsed') === '1';
  setSidebarCollapsed(saved);

  button.addEventListener('click', () => {
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  });
}

export function setSidebarCollapsed(collapsed, persist = true) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  if (persist) localStorage.setItem('legal-dashboard-sidebar-collapsed', collapsed ? '1' : '0');

  const button = document.querySelector('#sidebarCollapseBtn');
  if (!button) return;

  const icon = button.querySelector('.collapse-icon');
  const label = button.querySelector('.collapse-label');

  if (icon) icon.innerHTML = collapsed ? chevronRightIcon() : chevronLeftIcon();
  if (label) label.textContent = collapsed ? 'Развернуть' : 'Свернуть';
  button.title = collapsed ? 'Развернуть меню' : 'Свернуть меню';
}

function chevronLeftIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>`;
}

function chevronRightIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>`;
}
