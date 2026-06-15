import { cases } from '../../data/cases.js';

export function getCases() {
  return cases;
}

export function getCaseById(id) {
  return cases.find(item => item.id === id);
}
