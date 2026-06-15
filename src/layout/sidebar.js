const NAV_ITEMS = [
  ["dashboard", iconDashboard(), "Главная"],
  ["cases", iconCaseList(), "Общий перечень дел"],
  ["controlledCases", iconControlledList(), "Контрольные дела"],
  ["enforcement", iconScales(), "Исполнительные производства"],
  ["calendar", iconCalendar(), "Календарь"],
  ["schedule", iconClock(), "График заседаний"],
  ["map", iconMap(), "Карта"],
  ["emergencyFund", iconChart(), "Аварийный фонд"],
  ["municipalRegistry", iconBuilding(), "Реестр"],
  ["meetings", iconMeeting(), "Совещания"]
];

export function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">${iconScales()}</div>
      </div>

      <nav class="nav">
        ${NAV_ITEMS.map(([view, icon, label]) => `
          <button class="nav-btn ${view === 'dashboard' ? 'active' : ''}" data-view="${view}" title="${label}">
            <span class="ico" aria-hidden="true">${icon}</span>
            <span class="label">${label}</span>
          </button>
        `).join('')}
      </nav>

      <div class="sidebar-bottom">
        <button class="sidebar-collapse-btn" id="sidebarCollapseBtn" type="button" title="Свернуть меню">
          <span class="collapse-icon" aria-hidden="true">${iconChevronLeft()}</span>
          <span class="collapse-label">Свернуть</span>
        </button>
      </div>
    </aside>
  `;
}

function iconDashboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.8"></rect><rect x="14" y="4" width="6" height="6" rx="1.8"></rect><rect x="4" y="14" width="6" height="6" rx="1.8"></rect><rect x="14" y="14" width="6" height="6" rx="1.8"></rect></svg>`;
}

function iconCaseList() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6z"></path><path d="M15 3v4h4"></path><path d="M9 11h6M9 15h6M9 19h4"></path></svg>`;
}
function iconControlledList() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8 9h8M8 13h5M8 17h7"></path><path d="M17.5 6.5l1 1 2-2"></path></svg>`;
}
function iconShield() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.2-2.6 8-7 10-4.4-2-7-5.8-7-10V6l7-3z"></path></svg>`;
}
function iconPin() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-3 1-4-4-1 3 3 3-7 7-2-2 7-7-3-3 1-3-4-4 1-3z"></path></svg>`;
}
function iconScales() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M5 7h14"></path><path d="M8.5 7L5.5 13h6L8.5 7z"></path><path d="M18.5 7l-3 6h6l-3-6z"></path><path d="M7 20h10"></path></svg>`;
}
function iconCalendar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg>`;
}
function iconClock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>`;
}
function iconMap() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"></path><path d="M9 3v15M15 6v15"></path></svg>`;
}
function iconChart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20v-12"></path></svg>`;
}
function iconBuilding() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M6 21V7l6-4 6 4v14"></path><path d="M9 11h.01M9 15h.01M12 11h.01M12 15h.01M15 11h.01M15 15h.01"></path></svg>`;
}
function iconMeeting() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7a3 3 0 1 0 0-.01zM16 7a3 3 0 1 0 0-.01zM12 14a3 3 0 1 0 0-.01z"></path><path d="M5 19c.4-2 1.9-3 4-3"></path><path d="M19 19c-.4-2-1.9-3-4-3"></path><path d="M8 18c.6-2 2-3 4-3s3.4 1 4 3"></path></svg>`;
}
function iconChevronLeft() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>`;
}
