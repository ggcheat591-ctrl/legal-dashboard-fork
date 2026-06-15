export function cloneTemplate(selector) {
  const template = document.querySelector(selector);
  return template?.content?.cloneNode(true);
}
