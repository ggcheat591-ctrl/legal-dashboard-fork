import { request } from './httpClient.js';

export const scheduleApi = {
  list: () => request('/hearings')
};
