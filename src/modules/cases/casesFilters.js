export function filterCases(items, query = '') {
  const value = query.toLowerCase();
  return items.filter(item =>
    item.number.toLowerCase().includes(value) ||
    item.claimant.toLowerCase().includes(value) ||
    item.defendant.toLowerCase().includes(value)
  );
}
