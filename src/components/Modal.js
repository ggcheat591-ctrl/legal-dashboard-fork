export function Modal(id, title, body) {
  return `
    <div class="modal-layer" id="${id}">
      <div class="modal">
        <div class="modal-head">
          <h3>${title}</h3>
          <button data-close-modal="${id}">×</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    </div>
  `;
}
