import { request } from './httpClient.js';

export const mapApi = {
  objects: () => request('/map-objects')
};
