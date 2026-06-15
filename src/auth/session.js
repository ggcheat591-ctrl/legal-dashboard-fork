const SESSION_KEY = 'legal-dashboard-auth-session-v1';

export function getAuthSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.legalDashboardSession = session;
}

export function clearAuthSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.legalDashboardSession = null;
}

export function getCurrentUserName() {
  const session = getAuthSession();
  return session?.full_name || session?.user || session?.name || 'Администратор';
}

export function isCurrentUserAdmin() {
  const session = getAuthSession();
  return Boolean(session?.is_admin);
}
