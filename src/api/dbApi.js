function getSessionToken() {
  try {
    const raw = sessionStorage.getItem('legal-dashboard-auth-session-v1');
    return raw ? JSON.parse(raw)?.token || '' : '';
  } catch {
    return '';
  }
}

async function request(path, options = {}) {
  const token = getSessionToken();
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(`API базы данных недоступен. Проверьте, что приложение запущено в одном экземпляре, затем обновите страницу. ${error?.message || ''}`.trim());
  }

  const contentType = String(response.headers.get('content-type') || '');
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') {
      sessionStorage.removeItem('legal-dashboard-auth-session-v1');
      setTimeout(() => window.location.reload(), 0);
      throw new Error('Сеанс входа истёк. Выполняется повторный вход.');
    }
    const message = typeof payload === 'string'
      ? payload
      : payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(message || `HTTP ${response.status}`);
  }

  return payload;
}

async function requestBlob(path, options = {}) {
  const token = getSessionToken();
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(`API базы данных недоступен. ${error?.message || ''}`.trim());
  }
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem('legal-dashboard-auth-session-v1');
      setTimeout(() => window.location.reload(), 0);
    }
    throw new Error(await response.text() || `HTTP ${response.status}`);
  }
  return response.blob();
}

export const dbApi = {
  health: () => request('/api/health'),
  login: password => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: '{}' }),
  getOptions: category => request(`/api/options?category=${encodeURIComponent(category)}`),
  getUsers: () => request('/api/users'),
  getNotifications: () => request('/api/notifications'),
  markNotificationsRead: keys => request('/api/notifications/read', { method: 'POST', body: JSON.stringify({ keys }) }),

  getGeneralCases: ({ search = '' } = {}) => request(`/api/general-cases${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getArchivedGeneralCases: ({ search = '' } = {}) => request(`/api/general-cases?archived=1${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  createGeneralCase: data => request('/api/general-cases', { method: 'POST', body: JSON.stringify(data) }),
  updateGeneralCase: (id, data) => request(`/api/general-cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  uploadGeneralCaseDocument: data => request('/api/general-case-files', { method: 'POST', body: JSON.stringify(data) }),
  previewGeneralCaseDocument: filePath => requestBlob(`/api/general-case-files/preview?path=${encodeURIComponent(filePath)}`),
  openGeneralCaseDocument: filePath => request('/api/general-case-files/open', { method: 'POST', body: JSON.stringify({ path: filePath }) }),
  archiveGeneralCase: id => request(`/api/general-cases/${id}`, { method: 'DELETE' }),
  restoreGeneralCase: archiveId => request(`/api/general-cases/archive/${archiveId}/restore`, { method: 'POST' }),
  createControlledFromGeneral: (id, history_text = '') => request(`/api/general-cases/${id}/controlled-link`, { method: 'POST', body: JSON.stringify({ history_text }) }),
  addGeneralCaseAttendance: (id, data) => request(`/api/general-cases/${id}/attendance-hearing`, { method: 'POST', body: JSON.stringify(data) }),

  getControlledCases: ({ search = '' } = {}) => request(`/api/controlled-cases${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getArchivedControlledCases: () => request('/api/controlled-cases/archive'),
  createControlledCase: data => request('/api/controlled-cases', { method: 'POST', body: JSON.stringify(data) }),
  updateControlledCase: (id, data) => request(`/api/controlled-cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  archiveControlledCase: id => request(`/api/controlled-cases/${id}`, { method: 'DELETE' }),
  restoreControlledCase: archiveId => request(`/api/controlled-cases/archive/${archiveId}/restore`, { method: 'POST' }),
  deleteControlledArchiveCase: archiveId => request(`/api/controlled-cases/archive/${archiveId}`, { method: 'DELETE' }),


  getEnforcement: (mode = 'debtor') => request(`/api/enforcement?mode=${encodeURIComponent(mode)}`),
  getArchivedEnforcement: (mode = 'debtor') => request(`/api/enforcement/archive?mode=${encodeURIComponent(mode)}`),
  createEnforcement: data => request('/api/enforcement', { method: 'POST', body: JSON.stringify(data) }),
  updateEnforcement: (id, data) => request(`/api/enforcement/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEnforcement: id => request(`/api/enforcement/${id}`, { method: 'DELETE' }),
  archiveEnforcement: id => request(`/api/enforcement/${id}/archive`, { method: 'POST' }),
  restoreEnforcement: archiveId => request(`/api/enforcement/archive/${archiveId}/restore`, { method: 'POST' }),
  deleteEnforcementArchive: archiveId => request(`/api/enforcement/archive/${archiveId}`, { method: 'DELETE' }),

  getMeetings: () => request('/api/meetings'),
  getMeetingParticipants: category => request(`/api/meeting-participants${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  createMeeting: data => request('/api/meetings', { method: 'POST', body: JSON.stringify(data) }),
  updateMeeting: (id, data) => request(`/api/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMeeting: id => request(`/api/meetings/${id}`, { method: 'DELETE' }),

  getMunicipalRegistry: ({ search = '' } = {}) => request(`/api/municipal-registry${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createMunicipalRegistry: data => request('/api/municipal-registry', { method: 'POST', body: JSON.stringify(data) }),
  updateMunicipalRegistry: (id, data) => request(`/api/municipal-registry/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMunicipalRegistry: id => request(`/api/municipal-registry/${id}`, { method: 'DELETE' }),
  archiveMunicipalRegistry: id => request(`/api/municipal-registry/${id}/archive`, { method: 'POST' }),
  getMunicipalRegistryArchive: () => request('/api/municipal-registry/archive'),
  restoreMunicipalRegistryArchive: archiveId => request(`/api/municipal-registry/archive/${archiveId}/restore`, { method: 'POST' }),
  deleteMunicipalRegistryArchive: archiveId => request(`/api/municipal-registry/archive/${archiveId}`, { method: 'DELETE' }),

  getEmergencyFund: ({ search = '' } = {}) => request(`/api/emergency-fund${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createEmergencyFund: data => request('/api/emergency-fund', { method: 'POST', body: JSON.stringify(data) }),
  updateEmergencyFund: (id, data) => request(`/api/emergency-fund/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmergencyFund: id => request(`/api/emergency-fund/${id}`, { method: 'DELETE' }),
  archiveEmergencyFund: id => request(`/api/emergency-fund/${id}/archive`, { method: 'POST' }),
  getEmergencyFundArchive: () => request('/api/emergency-fund/archive'),
  restoreEmergencyFundArchive: archiveId => request(`/api/emergency-fund/archive/${archiveId}/restore`, { method: 'POST' }),
  deleteEmergencyFundArchive: archiveId => request(`/api/emergency-fund/archive/${archiveId}`, { method: 'DELETE' }),

  getCourtSchedule: () => request('/api/court-schedule'),
  createCourtScheduleDate: data => request('/api/court-schedule/date', { method: 'POST', body: JSON.stringify(data) }),
  createCourtScheduleCase: data => request('/api/court-schedule/case', { method: 'POST', body: JSON.stringify(data) }),
  updateCourtSchedule: (id, data) => request(`/api/court-schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCourtSchedule: id => request(`/api/court-schedule/${id}`, { method: 'DELETE' }),

  getCalendarTasks: ({ date = '', start = '', end = '', user = '', generalCaseId = '' } = {}) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (user) params.set('user', user);
    if (generalCaseId) params.set('general_case_id', generalCaseId);
    const query = params.toString();
    return request(`/api/calendar-tasks${query ? `?${query}` : ''}`);
  },
  createCalendarTask: data => request('/api/calendar-tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateCalendarTask: (id, data) => request(`/api/calendar-tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delegateCalendarTasks: data => request('/api/calendar-tasks/delegate', { method: 'POST', body: JSON.stringify(data) }),
  deleteCalendarTask: id => request(`/api/calendar-tasks/${id}`, { method: 'DELETE' })
};
