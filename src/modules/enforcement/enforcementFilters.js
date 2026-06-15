export function filterEnforcement(items, query = '') {
  return items.filter(item => item.debtor.toLowerCase().includes(query.toLowerCase()));
}
