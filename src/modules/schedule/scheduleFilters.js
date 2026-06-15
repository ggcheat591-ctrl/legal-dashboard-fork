export function filterHearings(items, court = '') {
  return court ? items.filter(item => item.court.includes(court)) : items;
}
