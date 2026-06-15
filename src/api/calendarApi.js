import { request } from './httpClient.js';

export const calendarApi = {
  list: () => request('/calendar-events')
};
