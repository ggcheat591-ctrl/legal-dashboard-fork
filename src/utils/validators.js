export function required(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}
