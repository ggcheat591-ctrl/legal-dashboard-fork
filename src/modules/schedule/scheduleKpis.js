export function getScheduleKpis(items) {
  return {
    total: items.length,
    today: items.filter(item => item.date === '31.05.2026').length
  };
}
