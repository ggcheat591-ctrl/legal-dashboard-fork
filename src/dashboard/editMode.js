let dashboardGridRef = null;

export function initEditMode(grid) {
  dashboardGridRef = grid;
  const button = document.querySelector('#editDashboardBtn');

  button.addEventListener('click', () => {
    if (document.body.dataset.currentView !== 'dashboard') return;
    setDashboardEditMode(!document.body.classList.contains('dashboard-edit-mode'));
  });
}

export function setDashboardEditMode(enabled) {
  document.body.classList.toggle('dashboard-edit-mode', enabled);

  if (dashboardGridRef) {
    dashboardGridRef.enableMove(enabled);
    dashboardGridRef.enableResize(enabled);
  }

  document.querySelector('#floatingEditMenu')?.classList.toggle('open', enabled);

  if (!enabled) {
    document.querySelector('#floatingAddMenu')?.classList.remove('active');
    document.querySelector('#floatingEditMenu')?.classList.remove('actions-visible');
    document.querySelector('#floatingEditMenu')?.classList.remove('add-menu-visible');
  }
}

window.setDashboardEditMode = setDashboardEditMode;
