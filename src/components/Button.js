export function Button({ label, variant = '', attrs = '' }) {
  return `<button class="btn ${variant}" ${attrs}>${label}</button>`;
}
