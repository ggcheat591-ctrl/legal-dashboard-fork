export function groupHearingsByDate(items) {
  return items.reduce((acc, item) => {
    acc[item.date] ||= [];
    acc[item.date].push(item);
    return acc;
  }, {});
}
