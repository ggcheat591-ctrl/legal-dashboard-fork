import { request } from './httpClient.js';

export const enforcementApi = {
  list: () => request('/enforcement')
};
