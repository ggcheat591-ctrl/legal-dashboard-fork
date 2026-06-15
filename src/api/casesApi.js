import { request } from './httpClient.js';

export const casesApi = {
  list: () => request('/cases'),
  get: id => request(`/cases/${id}`)
};
