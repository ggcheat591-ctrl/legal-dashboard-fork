import { dbApi } from '../../api/dbApi.js';
import { showNotification } from '../../layout/notifications.js';

const COLOR_STORAGE_KEYS = {
  material: 'enforcementMaterialColor',
  nonMaterial: 'enforcementNonMaterialColor'
};

let state = {
  initialized: false,
  mode: '',
  archived: false,
  productionCharacter: '',
  characterFilter: 'all',
  viewMode: localStorage.getItem('enforcementViewMode') || 'cards',
  currentId: null,
  rows: [],
  filteredRows: [],
  search: '',
  payments: [],
  formCache: null,
  colors: {
    material: localStorage.getItem(COLOR_STORAGE_KEYS.material) || '#22c55e',
    nonMaterial: localStorage.getItem(COLOR_STORAGE_KEYS.nonMaterial) || '#8b5cf6'
  }
};

const searchableFields = [
  'case_number', 'ip_number', 'subject_execution', 'date_start', 'start_date',
  'basis', 'start_basis', 'appeal_info', 'deadline', 'execution_deadline',
  'amount_claimed', 'claim_sum', 'payment_info', 'payments_json', 'total_paid',
  'debt', 'production_character'
];

export function initEnforcementPage() {
  if (state.initialized) return;
  state.initialized = true;

  document.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-enforcement-mode]');
    if (modeButton) {
      state.mode = modeButton.dataset.enforcementMode || '';
      state.currentId = null;
      resetForm();
      renderModeButtons();
      syncWorkspaceVisibility();
      closeModeDialog();
      loadEnforcement();
      return;
    }

    if (event.target.closest('[data-enforcement-mode-close]')) {
      if (!state.mode) {
        showNotification('Сначала выберите: должники или взыскатели');
        return;
      }
      closeModeDialog();
      return;
    }

    const viewButton = event.target.closest('[data-enforcement-view]');
    if (viewButton) {
      setViewMode(viewButton.dataset.enforcementView || 'table');
      return;
    }

    const characterButton = event.target.closest('[data-enforcement-character]');
    if (characterButton) {
      selectCharacter(characterButton.dataset.enforcementCharacter);
      return;
    }

    if (event.target.closest('[data-enforcement-refresh]')) {
      if (!state.mode) {
        showNotification('Сначала выберите: должники или взыскатели');
        return;
      }
      loadEnforcement();
      return;
    }

    if (event.target.closest('[data-enforcement-new]')) {
      if (!ensureModeSelected()) return;
      resetForm();
      openEnforcementEditor();
      return;
    }

    if (event.target.closest('[data-enforcement-open]')) {
      if (!ensureModeSelected()) return;
      const editor = document.querySelector('[data-enforcement-editor]');
      if (!editor?.classList.contains('is-open') && !state.currentId) resetForm();
      toggleEnforcementEditor();
      return;
    }

    if (event.target.closest('[data-enforcement-clear]')) {
      resetForm();
      openEnforcementEditor();
      return;
    }

    const archiveToggle = event.target.closest('[data-enforcement-archive-toggle]');
    if (archiveToggle) {
      state.archived = !state.archived;
      archiveToggle.classList.toggle('primary', state.archived);
      archiveToggle.textContent = state.archived ? 'Активные записи' : 'Архив';
      state.currentId = null;
      resetForm();
      if (state.mode) loadEnforcement();
      return;
    }

    const row = event.target.closest('[data-enforcement-row]');
    if (row) {
      const id = Number(row.dataset.enforcementRow);
      const found = findByDisplayId(id);
      if (found) openEnforcementEditorFromCard(found, row);
      return;
    }

    const card = event.target.closest('[data-enforcement-card]');
    if (card) {
      const id = Number(card.dataset.enforcementCard);
      const found = findByDisplayId(id);
      if (found) openEnforcementEditorFromCard(found, card);
      return;
    }

    const todayButton = event.target.closest('[data-date-today]');
    if (todayButton) {
      const form = document.querySelector('[data-enforcement-form]');
      const input = form?.elements[todayButton.dataset.dateToday];
      if (input) input.value = formatToday();
      return;
    }

    if (event.target.closest('[data-payment-add]')) { addPaymentRow(); return; }
    if (event.target.closest('[data-payment-remove]')) { removePaymentRow(); return; }

    if (event.target.closest('[data-enforcement-delete]')) { deleteCurrent(); return; }
    if (event.target.closest('[data-enforcement-to-archive]')) { archiveCurrent(); return; }
    if (event.target.closest('[data-enforcement-restore]')) { restoreCurrentArchive(); return; }
    if (event.target.closest('[data-enforcement-delete-archive]')) { deleteCurrentArchive(); return; }

    if (event.target.closest('[data-enforcement-debt-sum]')) { calculateVisibleDebtTotal(); return; }

    if (event.target.closest('[data-enforcement-export]')) { openExportDialog(); return; }
    if (event.target.closest('[data-enforcement-export-close]')) { closeExportDialog(); return; }
    if (event.target.closest('[data-enforcement-export-run]')) { runExport(); return; }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-enforcement-search]')) {
      state.search = event.target.value;
      clearTimeout(window.__enforcementSearchTimer);
      window.__enforcementSearchTimer = setTimeout(applySearchAndRender, 160);
    }

    if (event.target.matches('[data-enforcement-date], [data-payment-date]')) {
      formatDateInput(event.target);
    }

    if (event.target.matches('[data-enforcement-money], [data-payment-amount]')) {
      event.target.value = digitsOnly(event.target.value);
      recalculatePayments();
    }

    if (event.target.matches('[data-payment-receipt], [data-payment-date], [data-payment-amount]')) {
      syncPaymentsFromDom();
      recalculatePayments();
    }

    if (event.target.matches('[data-enforcement-color]')) {
      const key = event.target.dataset.enforcementColor;
      if (key === 'material' || key === 'nonMaterial') {
        state.colors[key] = event.target.value || state.colors[key];
        localStorage.setItem(COLOR_STORAGE_KEYS[key], state.colors[key]);
        applySavedColors();
        renderTable();
        renderCards();
      }
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-enforcement-character-filter]')) {
      state.characterFilter = event.target.value || 'all';
      applySearchAndRender();
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.matches('[data-enforcement-form]')) {
      event.preventDefault();
      if (!state.archived) saveCurrent(event.target);
    }
  });

  window.addEventListener('enforcement:reload', loadEnforcement);
  window.addEventListener('app:view-changed', event => {
    if (event.detail?.viewId === 'enforcement') {
      showModeDialog();
    }
  });

  checkDb();
  applySavedColors();
  syncColorInputs();
  renderModeButtons();
  syncWorkspaceVisibility();
  resetForm();
  syncViewMode();
  setTimeout(() => {
    if (document.body.dataset.currentView === 'enforcement') showModeDialog();
  }, 80);
}

function ensureModeSelected() {
  if (state.mode) return true;
  alert('Сначала выберите раздел: Должники или Взыскатели.');
  return false;
}

function showModeDialog() {
  const dialog = document.querySelector('[data-enforcement-mode-dialog]');
  if (!dialog || dialog.open) return;
  dialog.oncancel = event => event.preventDefault();
  renderModeButtons();
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeModeDialog() {
  const dialog = document.querySelector('[data-enforcement-mode-dialog]');
  if (!dialog) return;
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function syncWorkspaceVisibility() {
  const workspace = document.querySelector('[data-enforcement-workspace]');
  const headActions = document.querySelectorAll('[data-enforcement-refresh], [data-enforcement-export], [data-enforcement-archive-toggle]');
  if (workspace) workspace.hidden = !state.mode;
  headActions.forEach(button => { button.disabled = !state.mode; });
  renderModeButtons();
}

function openEnforcementEditor() {
  setEnforcementEditorOpen(true);
}

function toggleEnforcementEditor() {
  const editor = document.querySelector('[data-enforcement-editor]');
  setEnforcementEditorOpen(!editor?.classList.contains('is-open'));
}

function setEnforcementEditorOpen(open) {
  const editor = document.querySelector('[data-enforcement-editor]');
  const root = document.querySelector('#enforcement');
  editor?.classList.toggle('is-open', open);
  root?.classList.toggle('enforcement-editor-sheet-open', Boolean(open));
  document.body.classList.toggle('enforcement-editor-sheet-open', Boolean(open));
  const button = document.querySelector('[data-enforcement-open]');
  if (button) button.textContent = open ? '−' : '＋';
}

function openEnforcementEditorFromCard(rawRow, cardElement = null) {
  if (cardElement) {
    cardElement.classList.add('is-opening');
    window.setTimeout(() => cardElement.classList.remove('is-opening'), 360);
  }

  window.setTimeout(() => {
    fillForm(rawRow);
    openEnforcementEditor();
  }, cardElement ? 130 : 0);
}

async function checkDb() {
  const node = document.querySelector('[data-enforcement-db-status]');
  if (!node) return;

  try {
    await dbApi.health();
    node.textContent = 'База подключена';
  } catch {
    node.textContent = 'API базы недоступен';
  }
}

async function loadEnforcement() {
  const body = document.querySelector('[data-enforcement-table-body]');
  if (!body) return;

  if (!state.mode) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">Выберите раздел: должники или взыскатели.</td></tr>';
    state.rows = [];
    state.filteredRows = [];
    renderCards();
    updateCount();
    return;
  }

  body.innerHTML = '<tr><td colspan="7" class="empty-cell">Загрузка...</td></tr>';

  try {
    state.rows = state.archived
      ? await dbApi.getArchivedEnforcement(state.mode)
      : await dbApi.getEnforcement(state.mode);

    applySearchAndRender();
  } catch (error) {
    console.warn('Не удалось загрузить исполнительные производства:', error);
    state.rows = [];
    state.filteredRows = [];
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">Данные исполнительных производств недоступны. Проверьте, что запущен backend/API.</td></tr>';
    renderCards();
    updateCount();
  }
}

function applySearchAndRender() {
  state.filteredRows = filterRows(state.rows, state.search);
  renderTable();
  renderCards();
  syncViewMode();
  updateCount();
  resetDebtTotalLabel();
  window.dispatchEvent(new CustomEvent('enforcement:updated', { detail: state.filteredRows }));
}

function filterRows(rows, rawSearch) {
  const parts = String(rawSearch || '')
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  return rows
    .map(normalizeArchiveRow)
    .filter(row => {
      if (state.mode && row.mode && row.mode !== state.mode) return false;

      const character = getCharacter(row);
      if (state.characterFilter !== 'all' && character !== state.characterFilter) return false;

      if (!parts.length) return true;

      const haystack = searchableFields
        .map(field => String(row[field] ?? '').toLowerCase())
        .join(' | ');

      return parts.every(part => haystack.includes(part));
    });
}

function normalizeArchiveRow(row) {
  if (!state.archived) return row || {};

  if (row?.data && typeof row.data === 'object') {
    return { ...row.data, id: row.id, archive_id: row.id, original_id: row.record_id };
  }

  if (typeof row?.data === 'string') {
    try {
      return { ...JSON.parse(row.data), id: row.id, archive_id: row.id, original_id: row.record_id };
    } catch {
      return row || {};
    }
  }

  return row || {};
}

function renderTable() {
  const body = document.querySelector('[data-enforcement-table-body]');
  const title = document.querySelector('[data-enforcement-table-title]');
  const claimHead = document.querySelector('[data-enforcement-claim-head]');
  if (!body) return;

  const modeTitle = state.mode === 'debtor' ? 'Должники' : state.mode === 'creditor' ? 'Взыскатели' : 'не выбран раздел';
  if (title) title.textContent = `${state.archived ? 'Архив ИП' : 'Исполнительные производства'}: ${modeTitle}`;
  if (claimHead) claimHead.textContent = 'Сумма требований / предмет';

  if (!state.mode) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">Сначала выберите: должники или взыскатели.</td></tr>';
    return;
  }

  if (!state.filteredRows.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell">${state.archived ? 'В архиве записей нет' : 'Записей пока нет или они скрыты фильтрами.'}</td></tr>`;
    return;
  }

  body.innerHTML = state.filteredRows.map(row => {
    const character = getCharacter(row);
    const claim = character === 'Нематериальное'
      ? value(row.subject_execution)
      : money(value(row.amount_claimed || row.claim_sum || row.claim_amount));
    const debt = character === 'Материальное' ? money(row.debt || row.debt_amount) : '';

    return `
      <tr data-enforcement-row="${row.id}" class="${Number(row.id) === Number(state.currentId) ? 'selected' : ''}">
        <td class="center strong">${formatText(row.case_number || row.ip_number)}</td>
        <td class="center">${renderCharacterBadge(character)}</td>
        <td class="center">${formatText(row.date_start || row.start_date)}</td>
        <td>${formatText(row.basis || row.start_basis)}</td>
        <td class="${character === 'Нематериальное' ? '' : 'center'}">${formatText(claim)}</td>
        <td class="center">${formatText(debt)}</td>
        <td class="center">${formatText(row.deadline || row.execution_deadline || row.term_execution)}</td>
      </tr>
    `;
  }).join('');
}

function renderCards() {
  const grid = document.querySelector('[data-enforcement-cards-grid]');
  if (!grid) return;

  if (!state.mode) {
    grid.innerHTML = '<div class="empty-card">Сначала выберите: должники или взыскатели.</div>';
    return;
  }

  if (!state.filteredRows.length) {
    grid.innerHTML = `<div class="empty-card">${state.archived ? 'В архиве записей нет' : 'Записей пока нет или они скрыты фильтрами.'}</div>`;
    return;
  }

  grid.innerHTML = state.filteredRows.map(row => {
    const character = getCharacter(row);
    const claimLabel = character === 'Нематериальное' ? 'Предмет исполнения' : 'Сумма требований';
    const claimValue = character === 'Нематериальное'
      ? row.subject_execution
      : money(row.amount_claimed || row.claim_sum || row.claim_amount);
    const debtValue = character === 'Материальное' ? money(row.debt || row.debt_amount) : '—';

    return `
      <article class="enforcement-case-card" data-enforcement-card="${row.id}" tabindex="0">
        <div class="enforcement-case-card-head">
          <div class="enforcement-case-icon" aria-hidden="true">⚙</div>
          <div>
            <span class="enforcement-case-kicker">№ ИП</span>
            <h4>${formatText(row.case_number || row.ip_number || 'Без номера')}</h4>
          </div>
          ${renderCharacterBadge(character)}
        </div>

        <div class="enforcement-case-fields">
          ${renderCardField('Дата возбуждения', row.date_start || row.start_date)}
          ${renderCardField('Срок исполнения', row.deadline || row.execution_deadline || row.term_execution)}
          ${renderCardField('Основание', row.basis || row.start_basis, true)}
          ${renderCardField(claimLabel, claimValue)}
          ${renderCardField('Сумма долга', debtValue)}
          ${renderCardField('Обжалование', row.appeal_info, true)}
        </div>
      </article>
    `;
  }).join('');
}

function renderCardField(label, value, wide = false) {
  return `
    <div class="enforcement-card-field ${wide ? 'wide' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${formatText(value)}</strong>
    </div>
  `;
}

function renderCharacterBadge(character) {
  const normalized = character === 'Нематериальное' ? 'Нематериальное' : 'Материальное';
  const color = normalized === 'Нематериальное' ? state.colors.nonMaterial : state.colors.material;
  const className = normalized === 'Нематериальное' ? 'non-material' : 'material';
  return `<span class="enforcement-character-badge ${className}" style="--badge-color:${escapeAttr(color)}">${escapeHtml(normalized)}</span>`;
}

function getCharacter(row = {}) {
  const explicit = value(row.production_character);
  if (explicit === 'Нематериальное') return 'Нематериальное';
  if (explicit === 'Материальное') return 'Материальное';
  if (value(row.nature) === 'non_material') return 'Нематериальное';
  return 'Материальное';
}

function findByDisplayId(id) {
  return state.filteredRows.find(item => Number((state.archived ? (item.id || item.archive_id) : item.id)) === Number(id));
}

function updateCount() {
  const node = document.querySelector('[data-enforcement-count]');
  if (node) node.textContent = `${state.filteredRows.length} ${declineRecords(state.filteredRows.length)}`;
}

function declineRecords(n) {
  const last = Math.abs(n) % 10;
  const lastTwo = Math.abs(n) % 100;

  if (last === 1 && lastTwo !== 11) return 'запись';
  if ([2, 3, 4].includes(last) && ![12, 13, 14].includes(lastTwo)) return 'записи';
  return 'записей';
}

function renderModeButtons() {
  document.querySelectorAll('[data-enforcement-mode]').forEach(button => {
    button.classList.toggle('active', Boolean(state.mode) && button.dataset.enforcementMode === state.mode);
  });
}

function setViewMode(mode) {
  state.viewMode = mode === 'cards' ? 'cards' : 'table';
  localStorage.setItem('enforcementViewMode', state.viewMode);
  syncViewMode();
}

function syncViewMode() {
  const tablePane = document.querySelector('[data-enforcement-table-pane]');
  const cardsPane = document.querySelector('[data-enforcement-cards-pane]');
  document.querySelectorAll('[data-enforcement-view]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.enforcementView === state.viewMode);
  });
  if (tablePane) tablePane.hidden = state.viewMode !== 'table';
  if (cardsPane) cardsPane.hidden = state.viewMode !== 'cards';
}

function selectCharacter(character) {
  const changed = Boolean(state.productionCharacter) && state.productionCharacter !== character;
  state.productionCharacter = character;

  const form = document.querySelector('[data-enforcement-form]');
  if (form) {
    form.elements.production_character.value = character;
    form.elements.nature.value = character === 'Нематериальное' ? 'non_material' : 'material';
  }

  document.querySelectorAll('[data-enforcement-character]').forEach(button => {
    button.classList.toggle('active', button.dataset.enforcementCharacter === character);
  });

  if (changed && !state.currentId) {
    clearMainFields();
  }

  renderExtraFields();
}

function renderExtraFields() {
  const panel = document.querySelector('[data-enforcement-extra-panel]');
  if (!panel) return;

  if (state.productionCharacter === 'Материальное') {
    panel.innerHTML = `
      <div class="material-grid">
        <label>
          <span>Сумма требований(руб.)</span>
          <input name="amount_claimed" data-enforcement-money autocomplete="off">
        </label>
        <label>
          <span>Сумма долга</span>
          <input name="debt" data-enforcement-debt readonly>
        </label>
      </div>

      <div class="payment-block">
        <div class="payment-title">
          <b>Сведения об оплате</b>
          <div>
            <button class="btn small" data-payment-add type="button">+</button>
            <button class="btn small" data-payment-remove type="button">−</button>
          </div>
        </div>

        <div class="payment-header">
          <span>№</span>
          <span>Квитанция об оплате</span>
          <span>Дата</span>
          <span>Сумма</span>
        </div>

        <div class="payment-rows" data-payment-rows></div>
      </div>

      <label class="total-paid-field">
        <span>Итого оплачено</span>
        <input name="total_paid" data-enforcement-total readonly>
      </label>
    `;

    if (!state.payments.length) {
      state.payments = [
        { id: makeId(), receipt: '', date: '', amount: '' },
        { id: makeId(), receipt: '', date: '', amount: '' }
      ];
    }

    renderPaymentRows();
    setMaterialValuesFromFormCache();
    recalculatePayments();
  } else if (state.productionCharacter === 'Нематериальное') {
    panel.innerHTML = '';
    state.payments = [];
  } else {
    panel.innerHTML = '<div class="enforcement-empty-hint">Выберите характер производства: материальное или нематериальное.</div>';
  }
}

function setMaterialValuesFromFormCache() {
  const form = document.querySelector('[data-enforcement-form]');
  if (!form || !state.formCache) return;

  if (form.elements.amount_claimed) form.elements.amount_claimed.value = digitsOnly(state.formCache.amount_claimed || state.formCache.claim_sum || '');
  if (form.elements.total_paid) form.elements.total_paid.value = digitsOnly(state.formCache.total_paid || state.formCache.amount_paid_total || '');
  if (form.elements.debt) form.elements.debt.value = digitsOnly(state.formCache.debt || state.formCache.debt_amount || '');
}

function renderPaymentRows() {
  const list = document.querySelector('[data-payment-rows]');
  if (!list) return;

  list.innerHTML = state.payments.map((payment, index) => `
    <div class="payment-row" data-payment-id="${payment.id}">
      <span class="payment-number">${index + 1}.</span>
      <input data-payment-receipt value="${escapeAttr(payment.receipt)}" placeholder="Квитанция">
      <input data-payment-date value="${escapeAttr(payment.date)}" placeholder="ДД.ММ.ГГГГ" maxlength="10">
      <input data-payment-amount value="${escapeAttr(payment.amount)}" placeholder="0">
    </div>
  `).join('');
}

function addPaymentRow(receipt = '', date = '', amount = '') {
  state.payments.push({ id: makeId(), receipt, date, amount: digitsOnly(amount) });
  renderPaymentRows();
  recalculatePayments();
}

function removePaymentRow() {
  if (!state.payments.length) return;
  state.payments.pop();

  if (!state.payments.length && state.productionCharacter === 'Материальное') {
    addPaymentRow();
    return;
  }

  renderPaymentRows();
  recalculatePayments();
}

function syncPaymentsFromDom() {
  const payments = [];
  document.querySelectorAll('[data-payment-id]').forEach(row => {
    payments.push({
      id: row.dataset.paymentId,
      receipt: row.querySelector('[data-payment-receipt]')?.value || '',
      date: row.querySelector('[data-payment-date]')?.value || '',
      amount: digitsOnly(row.querySelector('[data-payment-amount]')?.value || '')
    });
  });
  state.payments = payments;
}

function recalculatePayments() {
  const form = document.querySelector('[data-enforcement-form]');
  if (!form || state.productionCharacter !== 'Материальное') return;

  syncPaymentsFromDom();

  const amountClaimed = parseIntSafe(form.elements.amount_claimed?.value || '');
  const totalPaid = state.payments.reduce((sum, payment) => sum + parseIntSafe(payment.amount), 0);
  const debt = Math.max(amountClaimed - totalPaid, 0);

  if (form.elements.total_paid) form.elements.total_paid.value = String(totalPaid);
  if (form.elements.debt) form.elements.debt.value = String(debt);
}

function resetForm() {
  const form = document.querySelector('[data-enforcement-form]');
  if (!form) return;

  form.reset();
  state.currentId = null;
  state.productionCharacter = '';
  state.payments = [];
  state.formCache = null;

  form.elements.id.value = '';
  form.elements.production_character.value = '';
  form.elements.nature.value = '';
  renderCharacterButtons();
  renderExtraFields();
  syncFormMode();

  const title = document.querySelector('[data-enforcement-form-title]');
  const sub = document.querySelector('[data-enforcement-form-subtitle]');
  if (title) title.textContent = state.archived ? 'Выберите архивную запись' : 'Новое исполнительное производство';
  if (sub) sub.textContent = 'Выберите характер производства и заполните основные поля.';
}

function clearMainFields() {
  const form = document.querySelector('[data-enforcement-form]');
  if (!form) return;

  ['case_number', 'subject_execution', 'date_start', 'deadline', 'basis', 'appeal_info'].forEach(name => {
    if (form.elements[name]) form.elements[name].value = '';
  });
  state.currentId = null;
}

function renderCharacterButtons() {
  document.querySelectorAll('[data-enforcement-character]').forEach(button => {
    button.classList.toggle('active', button.dataset.enforcementCharacter === state.productionCharacter);
  });
}

function fillForm(raw) {
  const row = normalizeArchiveRow(raw);
  const form = document.querySelector('[data-enforcement-form]');
  if (!form) return;

  state.currentId = row.id;
  state.formCache = row;

  form.elements.id.value = row.id || '';
  form.elements.case_number.value = value(row.case_number || row.ip_number);
  form.elements.subject_execution.value = value(row.subject_execution);
  form.elements.date_start.value = value(row.date_start || row.start_date);
  form.elements.deadline.value = value(row.deadline || row.execution_deadline || row.term_execution);
  form.elements.basis.value = value(row.basis || row.start_basis);
  form.elements.appeal_info.value = value(row.appeal_info);

  selectCharacter(getCharacter(row));

  if (state.productionCharacter === 'Материальное') {
    state.payments = parsePaymentInfo(row.payment_info || row.payments_json);
    if (!state.payments.length) {
      state.payments = [
        { id: makeId(), receipt: '', date: '', amount: '' },
        { id: makeId(), receipt: '', date: '', amount: '' }
      ];
    }

    renderPaymentRows();
    if (form.elements.amount_claimed) form.elements.amount_claimed.value = digitsOnly(row.amount_claimed || row.claim_sum || row.claim_amount);
    if (form.elements.total_paid) form.elements.total_paid.value = digitsOnly(row.total_paid || row.amount_paid_total);
    if (form.elements.debt) form.elements.debt.value = digitsOnly(row.debt || row.debt_amount);
    recalculatePayments();
  }

  syncFormMode();

  const title = document.querySelector('[data-enforcement-form-title]');
  const sub = document.querySelector('[data-enforcement-form-subtitle]');

  if (title) title.textContent = state.archived ? 'Архивное исполнительное производство' : 'Карточка исполнительного производства';
  if (sub) sub.textContent = `${state.mode === 'debtor' ? 'Должники' : 'Взыскатели'} · ${state.productionCharacter || 'без характера'}`;
}

function syncFormMode() {
  const form = document.querySelector('[data-enforcement-form]');
  if (!form) return;

  const deleteButton = document.querySelector('[data-enforcement-delete]');
  const archiveButton = document.querySelector('[data-enforcement-to-archive]');
  const restoreButton = document.querySelector('[data-enforcement-restore]');
  const deleteArchiveButton = document.querySelector('[data-enforcement-delete-archive]');
  const saveButton = document.querySelector('[data-enforcement-save]');

  if (deleteButton) deleteButton.hidden = state.archived || !state.currentId;
  if (archiveButton) archiveButton.hidden = state.archived || !state.currentId;
  if (restoreButton) restoreButton.hidden = !state.archived || !state.currentId;
  if (deleteArchiveButton) deleteArchiveButton.hidden = !state.archived || !state.currentId;
  if (saveButton) saveButton.hidden = state.archived;

  Array.from(form.elements).forEach(element => {
    if (!element.name) return;
    if (element.name === 'id') return;
    element.disabled = state.archived;
  });

  document.querySelectorAll('[data-payment-add], [data-payment-remove], [data-date-today], [data-enforcement-character]').forEach(button => {
    button.disabled = state.archived;
  });
}

function getFormData(form) {
  syncPaymentsFromDom();
  recalculatePayments();

  const raw = Object.fromEntries(new FormData(form).entries());
  const character = raw.production_character || state.productionCharacter;

  const paymentInfo = character === 'Материальное' ? buildPaymentText() : '';
  const amountClaimed = character === 'Материальное' ? digitsOnly(raw.amount_claimed) : '';
  const totalPaid = character === 'Материальное' ? digitsOnly(raw.total_paid) : '';
  const debt = character === 'Материальное' ? digitsOnly(raw.debt) : '';

  return {
    id: raw.id || '',
    mode: state.mode || 'debtor',
    nature: character === 'Нематериальное' ? 'non_material' : 'material',
    production_character: character,

    case_number: value(raw.case_number),
    ip_number: value(raw.case_number),
    subject_execution: value(raw.subject_execution),

    date_start: value(raw.date_start),
    start_date: value(raw.date_start),

    basis: value(raw.basis),
    start_basis: value(raw.basis),

    appeal_info: value(raw.appeal_info),

    deadline: value(raw.deadline),
    execution_deadline: value(raw.deadline),
    term_execution: value(raw.deadline),

    amount_claimed: amountClaimed,
    claim_sum: amountClaimed,
    claim_amount: amountClaimed,

    payment_info: paymentInfo,
    payments_json: paymentInfo,

    total_paid: totalPaid,
    amount_paid_total: totalPaid,

    debt,
    debt_amount: debt
  };
}

function requiredErrors(data) {
  const empty = [];

  if (!data.case_number) empty.push('Номер ИП');
  if (!data.basis) empty.push('Основание возбуждения ИП');
  if (!data.production_character) empty.push('Характер производства');
  if (data.production_character === 'Материальное' && !data.amount_claimed) empty.push('Сумма требований');

  return empty;
}

async function saveCurrent(form) {
  const data = getFormData(form);
  const errors = requiredErrors(data);

  if (errors.length) {
    alert(`Заполните обязательные поля:\n${errors.join(', ')}`);
    return;
  }

  try {
    if (data.id) {
      await dbApi.updateEnforcement(data.id, data);
      showNotification('Исполнительное производство обновлено');
    } else {
      const created = await dbApi.createEnforcement(data);
      state.currentId = created.id;
      showNotification('Исполнительное производство сохранено');
    }

    await loadEnforcement();

    const selected = state.rows.map(normalizeArchiveRow).find(item => Number(item.id) === Number(state.currentId || data.id));
    if (selected) fillForm(selected);
  } catch (error) {
    alert('Не удалось сохранить:\n' + error.message);
  }
}

async function deleteCurrent() {
  if (!state.currentId) {
    alert('Выберите строку для удаления');
    return;
  }

  if (!confirm('Удалить выбранную запись?')) return;

  try {
    await dbApi.deleteEnforcement(state.currentId);
    showNotification('Запись удалена');
    resetForm();
    setEnforcementEditorOpen(false);
    await loadEnforcement();
  } catch (error) {
    alert('Не удалось удалить запись:\n' + error.message);
  }
}

async function archiveCurrent() {
  if (!state.currentId) {
    alert('Выберите строку для архивации');
    return;
  }

  if (!confirm('Перенести выбранную запись в архив?')) return;

  try {
    await dbApi.archiveEnforcement(state.currentId);
    showNotification('Запись перенесена в архив');
    resetForm();
    setEnforcementEditorOpen(false);
    await loadEnforcement();
  } catch (error) {
    alert('Не удалось перенести в архив:\n' + error.message);
  }
}

async function restoreCurrentArchive() {
  if (!state.currentId) {
    alert('Выберите запись в архиве');
    return;
  }

  if (!confirm('Восстановить запись из архива?')) return;

  try {
    await dbApi.restoreEnforcement(state.currentId);
    showNotification('Запись восстановлена');
    resetForm();
    setEnforcementEditorOpen(false);
    await loadEnforcement();
  } catch (error) {
    alert('Не удалось восстановить:\n' + error.message);
  }
}

async function deleteCurrentArchive() {
  if (!state.currentId) {
    alert('Выберите запись в архиве');
    return;
  }

  if (!confirm('Удалить запись НАВСЕГДА?')) return;

  try {
    await dbApi.deleteEnforcementArchive(state.currentId);
    showNotification('Запись удалена навсегда');
    resetForm();
    setEnforcementEditorOpen(false);
    await loadEnforcement();
  } catch (error) {
    alert('Не удалось удалить:\n' + error.message);
  }
}

function calculateVisibleDebtTotal() {
  const rows = state.filteredRows.filter(row => getCharacter(row) === 'Материальное');
  const sum = rows.reduce((total, row) => total + parseIntSafe(row.debt || row.debt_amount), 0);
  const node = document.querySelector('[data-enforcement-debt-total]');
  if (node) node.textContent = `Сумма долга: ${sum.toLocaleString('ru-RU')} руб. (${rows.length} ${declineRecords(rows.length)})`;
  showNotification('Сумма долга рассчитана по текущей выборке');
}

function resetDebtTotalLabel() {
  const node = document.querySelector('[data-enforcement-debt-total]');
  if (node) node.textContent = 'Сумма долга: —';
}

function openExportDialog() {
  const dialog = document.querySelector('[data-enforcement-export-dialog]');
  const material = document.querySelector('[data-export-material]');
  const nonMaterial = document.querySelector('[data-export-non-material]');

  if (material) material.checked = true;
  if (nonMaterial) nonMaterial.checked = true;
  dialog?.showModal();
}

function closeExportDialog() {
  document.querySelector('[data-enforcement-export-dialog]')?.close();
}

function runExport() {
  const selected = [];
  if (document.querySelector('[data-export-material]')?.checked) selected.push('Материальное');
  if (document.querySelector('[data-export-non-material]')?.checked) selected.push('Нематериальное');

  if (!selected.length) {
    alert('Выберите хотя бы одну таблицу для экспорта.');
    return;
  }

  exportSelectedTables(selected);
  closeExportDialog();
}

function exportSelectedTables(selectedCharacters) {
  const rows = state.rows.map(normalizeArchiveRow);
  const modeTitle = state.mode === 'debtor' ? 'Должники' : 'Взыскатели';
  const sections = [];

  selectedCharacters.forEach(character => {
    const filtered = rows.filter(row => getCharacter(row) === character);
    if (!filtered.length) return;

    const title = character === 'Материальное'
      ? `Перечень ИП материального характера (${modeTitle})`
      : `Перечень ИП нематериального характера (${modeTitle})`;

    const headers = character === 'Нематериальное'
      ? ['№', '№ ИП', 'Дата возбуждения', 'Основания возбуждения ИП', 'Предмет исполнения', 'Срок исполнения']
      : ['№', '№ ИП', 'Дата возбуждения', 'Основания возбуждения ИП', 'Сведения об обжаловании', 'Сумма требований', 'Сумма долга', 'Срок исполнения'];

    const tableRows = filtered.map((row, index) => {
      const values = character === 'Нематериальное'
        ? [
            index + 1,
            row.case_number || row.ip_number,
            row.date_start || row.start_date,
            row.basis || row.start_basis,
            row.subject_execution,
            row.deadline || row.execution_deadline || row.term_execution
          ]
        : [
            index + 1,
            row.case_number || row.ip_number,
            row.date_start || row.start_date,
            row.basis || row.start_basis,
            row.appeal_info,
            row.amount_claimed || row.claim_sum || row.claim_amount,
            row.debt || row.debt_amount,
            row.deadline || row.execution_deadline || row.term_execution
          ];

      return `<tr>${values.map(value => `<td>${formatExportCell(value)}</td>`).join('')}</tr>`;
    }).join('');

    sections.push(`
      <h1>${escapeHtml(title)}</h1>
      <table>
        <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `);
  });

  if (!sections.length) {
    alert('Нет записей для выбранных таблиц.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page Section1 { size: 29.7cm 21cm; margin: 1.2cm; mso-page-orientation: landscape; }
  body { font-family: "PT Astra Serif", "Times New Roman", serif; font-size: 9pt; color: #000; }
  div.Section1 { page: Section1; }
  h1 { text-align: center; font-size: 12pt; margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 16pt; }
  th, td { border: 1px solid #000; padding: 3pt 4pt; vertical-align: top; line-height: 1.08; white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
  th { text-align: center; font-weight: bold; }
  td:nth-child(1), td:nth-child(2), td:nth-child(3), td:nth-last-child(1) { text-align: center; }
</style>
</head>
<body><div class="Section1">${sections.join('<br>')}</div></body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = formatToday().replaceAll('.', '_');
  a.href = url;
  a.download = `Экспорт_таблицы_ИП_${date}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildPaymentText() {
  return state.payments
    .map(payment => {
      const parts = [payment.receipt, payment.date, payment.amount]
        .map(value => String(value || '').trim())
        .filter(Boolean);
      return parts.join(' | ');
    })
    .filter(Boolean)
    .join('\n');
}

function parsePaymentInfo(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|').map(part => part.trim());
    return {
      id: makeId(),
      receipt: parts[0] || '',
      date: parts[1] || '',
      amount: digitsOnly(parts[2] || '')
    };
  });
}

function formatDateInput(input) {
  let digits = digitsOnly(input.value).slice(0, 8);

  if (digits.length > 4) input.value = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  else if (digits.length > 2) input.value = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  else input.value = digits;
}

function formatToday() {
  const date = new Date();
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear()
  ].join('.');
}

function parseIntSafe(value) {
  const digits = digitsOnly(value);
  return digits ? Number(digits) : 0;
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function money(value) {
  const digits = digitsOnly(value);
  return digits ? Number(digits).toLocaleString('ru-RU') : '';
}

function value(input) {
  return String(input ?? '').trim();
}

function makeId() {
  return `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatText(value) {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text).replace(/\n/g, '<br>') : '<span class="muted">—</span>';
}

function formatExportCell(value) {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text).replace(/\r?\n/g, '<br>') : '';
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('\n', '&#10;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function applySavedColors() {
  document.documentElement.style.setProperty('--enforcement-material-color', state.colors.material);
  document.documentElement.style.setProperty('--enforcement-non-material-color', state.colors.nonMaterial);
}

function syncColorInputs() {
  const material = document.querySelector('[data-enforcement-color="material"]');
  const nonMaterial = document.querySelector('[data-enforcement-color="nonMaterial"]');
  if (material) material.value = state.colors.material;
  if (nonMaterial) nonMaterial.value = state.colors.nonMaterial;
}
