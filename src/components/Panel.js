export function Panel(title, body) {
  return `
    <div class="panel">
      <div class="panel-head"><h3>${title}</h3></div>
      <div class="panel-body">${body}</div>
    </div>
  `;
}
