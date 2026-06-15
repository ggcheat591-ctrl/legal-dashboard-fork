export function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}
