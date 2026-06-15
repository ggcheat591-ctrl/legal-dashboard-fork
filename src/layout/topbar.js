export function renderTopbar(session = null) {
  const fullName = session?.full_name || session?.user || 'ФИО1';
  const role = session?.is_admin ? 'Администратор' : 'Юрист';

  return `
    <header class="topbar topbar-modern">
      <div class="topbar-title-wrap">
        <span class="topbar-title-icon" aria-hidden="true">${iconGrid()}</span>
        <div class="topbar-title-text">
          <h1>Панель управления</h1>
        </div>
      </div>

      <div class="topbar-user-zone">
        <button class="topbar-notify-btn" id="openNotificationsBtn" type="button" title="Уведомления">
          ${iconBell()}
          <span class="topbar-notify-badge" hidden>0</span>
        </button>

        <button class="topbar-note-btn" id="openNotesBtn" type="button" title="Заметки">
          ${iconNotes()}
        </button>

        <span class="topbar-divider" aria-hidden="true"></span>

        <div class="topbar-profile-card" tabindex="0">
          <div class="topbar-profile-avatar">${iconUser()}</div>
          <div class="topbar-profile-text">
            <b>${escapeHtml(fullName)}</b>
            <small>${escapeHtml(role)}</small>
          </div>
          <span class="topbar-profile-chevron" aria-hidden="true">${iconChevronDown()}</span>

          <div class="topbar-profile-dropdown">
            <button class="btn small" data-auth-logout type="button">Выйти</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function iconGrid() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.6"></rect><rect x="14" y="4" width="6" height="6" rx="1.6"></rect><rect x="4" y="14" width="6" height="6" rx="1.6"></rect><rect x="14" y="14" width="6" height="6" rx="1.6"></rect></svg>`;
}
function iconBell() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17H5a2 2 0 0 0 1.6-3.2A6 6 0 1 1 18 10v3a2 2 0 0 0 1 1.7"></path><path d="M9 21a3 3 0 0 0 6 0"></path></svg>`;
}
function iconNotes() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"></path><path d="M16 4v4h4"></path><path d="M8 12h8M8 16h6"></path></svg>`;
}

function iconUser() {
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2.25c-4.15 0-7.5 2.48-7.5 5.55 0 .66.54 1.2 1.2 1.2h12.6c.66 0 1.2-.54 1.2-1.2 0-3.07-3.35-5.55-7.5-5.55z"></path></svg>`;
}
function iconChevronDown() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>`;
}
