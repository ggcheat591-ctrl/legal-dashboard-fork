import { dbApi } from '../../api/dbApi.js';
import { showNotification } from '../../layout/notifications.js';

const COURT_FALLBACK_VALUES = [
  'Железнодорожный районный суд г.Барнаула',
  'Октябрьский районный суд г.Барнаула',
  'Индустриальный районный суд г.Барнаула',
  'Арбитражный суд Алтайского края',
  'Центральный районный суд г.Барнаула'
];

let state = {
  initialized: false,
  archived: false,
  rows: [],
  filteredRows: [],
  currentId: null,
  search: '',
  historyRows: [],
  viewMode: localStorage.getItem('controlledCasesViewMode') || 'cards',
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  calendarFocusDate: null,
  calendarFocusIds: []
};

const fields = [
  'case_number',
  'plaintiff',
  'defendant',
  'subject',
  'representative',
  'court_case_number',
  'court'
];

export function initControlledCasesPage() {
  if (state.initialized) return;
  state.initialized = true;

  document.addEventListener('click', event => {
    if (event.target.closest('[data-controlled-refresh]')) loadControlledCases();

    if (event.target.closest('[data-controlled-new]')) {
      event.preventDefault();
      resetForm();
      openControlledEditor();
      return;
    }

    if (event.target.closest('[data-controlled-open]')) {
      event.preventDefault();
      const editor = document.querySelector('[data-controlled-editor]');
      if (editor?.classList.contains('is-open')) {
        setControlledEditorOpen(false);
      } else {
        resetForm();
        openControlledEditor();
      }
      return;
    }

    if (event.target.closest('[data-controlled-clear]')) {
      event.preventDefault();
      resetForm();
      openControlledEditor();
      return;
    }

    const toggleArchive = event.target.closest('[data-controlled-archive-toggle]');
    if (toggleArchive) {
      state.archived = !state.archived;
      toggleArchive.classList.toggle('primary', state.archived);
      toggleArchive.textContent = state.archived ? 'Активные дела' : 'Архив';
      resetForm();
      loadControlledCases();
    }


    const rowButton = event.target.closest('[data-controlled-row]');
    if (rowButton) {
      const id = Number(rowButton.dataset.controlledRow);
      const row = state.filteredRows.find(item => Number(item.id) === id);
      if (row) { fillForm(row); openControlledEditor(); scrollOpenedEditorIntoView(); }
    }

    if (event.target.closest('[data-history-add]')) addHistoryRow();
    if (event.target.closest('[data-history-remove]')) removeNewestHistoryRow();

    if (event.target.closest('[data-controlled-archive-selected]')) archiveCurrentCase();
    if (event.target.closest('[data-controlled-restore]')) restoreCurrentArchiveCase();
    if (event.target.closest('[data-controlled-delete-archive]')) deleteCurrentArchiveCase();

    if (event.target.closest('[data-controlled-full-table]')) openFullTable();
    if (event.target.closest('[data-controlled-full-close]')) closeFullTable();
    if (event.target.closest('[data-controlled-view-close]')) closeControlledViewCard();

    if (event.target.closest('[data-controlled-calendar-filter-clear]')) {
      clearCalendarCardFilter();
      return;
    }
    if (event.target.closest('[data-controlled-export]')) exportFullTableToR7();
    if (event.target.closest('[data-controlled-export-inline]')) exportFullTableToR7();

    const viewButton = event.target.closest('[data-controlled-view]');
    if (viewButton) {
      setViewMode(viewButton.dataset.controlledView || 'table');
      return;
    }

    const cardButton = event.target.closest('[data-controlled-card]');
    if (cardButton) {
      const id = Number(cardButton.dataset.controlledCard);
      const row = state.filteredRows.find(item => Number((state.archived ? (item.id || normalizeArchiveRow(item).archive_id) : normalizeArchiveRow(item).id)) === id);
      if (row) openControlledEditorFromCard(row, cardButton);
      return;
    }

    if (event.target.closest('[data-controlled-month-prev]')) {
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
      renderCalendar();
      return;
    }

    if (event.target.closest('[data-controlled-month-next]')) {
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
      renderCalendar();
      return;
    }

    const calendarDay = event.target.closest('[data-controlled-calendar-day]');
    if (calendarDay) {
      openCasesByDate(calendarDay.dataset.controlledCalendarDay, calendarDay);
      return;
    }

    const calendarCase = event.target.closest('[data-controlled-calendar-case]');
    if (calendarCase) {
      const id = Number(calendarCase.dataset.controlledCalendarCase);
      const row = state.filteredRows.find(item => Number((state.archived ? (item.id || normalizeArchiveRow(item).archive_id) : normalizeArchiveRow(item).id)) === id);
      document.querySelector('[data-controlled-calendar-popover]')?.setAttribute('hidden', '');
      if (row) openControlledEditorFromCard(row);
      return;
    }

    if (event.target.closest('[data-controlled-open-calendar]')) {
      location.hash = '#calendar';
      return;
    }
  });

  document.addEventListener('dblclick', event => {
    const row = event.target.closest('[data-controlled-row], [data-controlled-card]');
    if (!row) return;

    const id = Number(row.dataset.controlledRow || row.dataset.controlledCard);
    const item = state.filteredRows.find(record => Number(record.id) === id);
    if (item) { fillForm(item); openControlledEditor(); scrollOpenedEditorIntoView(); }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-controlled-search]')) {
      state.search = event.target.value;
      state.calendarFocusDate = null;
      state.calendarFocusIds = [];
      clearTimeout(window.__controlledSearchTimer);
      window.__controlledSearchTimer = setTimeout(applySearchAndRender, 160);
    }

    if (event.target.matches('[data-control-pk]')) {
      formatControlPkInput(event.target);
    }

    if (event.target.matches('[data-history-time]')) {
      formatHistoryTime(event.target);
    }

    if (event.target.matches('[data-history-date]')) {
      formatHistoryDate(event.target);
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.matches('[data-controlled-form]')) {
      event.preventDefault();
      if (!state.archived) saveControlledCase(event.target);
    }
  });

  window.addEventListener('controlled-cases:reload', loadControlledCases);

  fillDatalists();
  checkDb();
  resetForm();
  syncViewMode();
  loadControlledCases();
}

function openControlledEditor() {
  setControlledEditorOpen(true);
}

function toggleControlledEditor() {
  const editor = document.querySelector('[data-controlled-editor]');
  setControlledEditorOpen(!editor?.classList.contains('is-open'));
}

function setControlledEditorOpen(open) {
  const editor = document.querySelector('[data-controlled-editor]');
  const root = document.querySelector('#controlledCases');
  editor?.classList.toggle('is-open', open);
  root?.classList.toggle('controlled-editor-sheet-open', Boolean(open));
  document.body.classList.toggle('controlled-editor-sheet-open', Boolean(open));
  const button = document.querySelector('[data-controlled-open]');
  if (button) button.textContent = open ? '−' : '＋';
}

function openControlledEditorFromCard(rawRow, cardElement = null) {
  if (cardElement) {
    cardElement.classList.add('is-opening');
    window.setTimeout(() => cardElement.classList.remove('is-opening'), 360);
  }

  window.setTimeout(() => {
    fillForm(rawRow);
    openControlledEditor();
  }, cardElement ? 130 : 0);
}

function scrollOpenedEditorIntoView() {
  const editor = document.querySelector('[data-controlled-editor]');
  if (editor?.classList.contains('is-open')) return;
  requestAnimationFrame(() => {
    editor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function checkDb() {
  const node = document.querySelector('[data-controlled-db-status]');
  if (!node) return;

  try {
    await dbApi.health();
    node.textContent = 'База подключена';
  } catch {
    node.textContent = 'API базы недоступен';
  }
}

async function fillDatalists() {
  const courtsNode = document.querySelector('#controlledCourtsList');
  const representativesNode = document.querySelector('#controlledRepresentativesList');

  if (courtsNode) {
    try {
      const courts = await dbApi.getOptions('court');
      const values = courts?.length ? courts : COURT_FALLBACK_VALUES;
      courtsNode.innerHTML = values.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    } catch {
      courtsNode.innerHTML = COURT_FALLBACK_VALUES.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    }
  }

  if (representativesNode) {
    try {
      const representatives = await dbApi.getOptions('representatives');
      representativesNode.innerHTML = representatives.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    } catch {
      representativesNode.innerHTML = '';
    }
  }
}

async function loadControlledCases() {
  const body = document.querySelector('[data-controlled-table-body]');
  if (!body) return;

  body.innerHTML = '<tr><td colspan="5" class="empty-cell">Загрузка...</td></tr>';

  try {
    state.rows = state.archived
      ? await dbApi.getArchivedControlledCases()
      : await dbApi.getControlledCases();

    applySearchAndRender();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="empty-cell error">Не удалось загрузить данные: ${escapeHtml(error.message)}</td></tr>`;
    state.filteredRows = [];
    updateCount();
  }
}

function applySearchAndRender() {
  state.filteredRows = filterRows(state.rows, state.search);
  renderTable();
  renderCards();
  renderCalendar();
  renderMiniTasks();
  renderFullTable();
  syncViewMode();
  updateCount();

  window.dispatchEvent(new CustomEvent('controlled-cases:updated', { detail: state.filteredRows }));
}

function filterRows(rows, rawSearch) {
  const parts = String(rawSearch || '')
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);

  if (!parts.length) return [...rows];

  return rows.filter(row => {
    const data = normalizeArchiveRow(row);
    const haystack = [
      data.case_number,
      data.plaintiff,
      data.defendant,
      data.subject,
      data.representative,
      data.result,
      data.court_case_number,
      data.court
    ].map(value => String(value ?? '').toLowerCase()).join(' | ');

    return parts.every(part => haystack.includes(part));
  });
}

function normalizeArchiveRow(row) {
  if (!state.archived) return row || {};

  if (row?.data && typeof row.data === 'object') {
    return { ...row.data, id: row.id, archive_id: row.id };
  }

  if (typeof row?.data === 'string') {
    try {
      return { ...JSON.parse(row.data), id: row.id, archive_id: row.id };
    } catch {
      return row || {};
    }
  }

  return row || {};
}

function renderTable() {
  const body = document.querySelector('[data-controlled-table-body]');
  const title = document.querySelector('[data-controlled-table-title]');
  if (!body) return;

  if (title) title.textContent = state.archived ? 'Архив контрольных дел' : 'Общий перечень дел';

  if (!state.filteredRows.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-cell">${state.archived ? 'В архиве записей нет' : 'Контрольные дела не найдены'}</td></tr>`;
    return;
  }

  body.innerHTML = state.filteredRows.map(row => {
    const data = normalizeArchiveRow(row);
    const id = state.archived ? (row.id || data.archive_id) : data.id;
    return `
      <tr data-controlled-row="${id}">
        <td class="center strong">${formatText(data.case_number)}</td>
        <td>${formatText(data.plaintiff)}</td>
        <td>${formatText(data.defendant)}</td>
        <td>${formatText(data.subject)}</td>
        <td>${formatText(getLastTwoResultLinesForTable(data.result))}</td>
      </tr>
    `;
  }).join('');
}

function renderFullTable() {
  const body = document.querySelector('[data-controlled-full-table-body]');
  const title = document.querySelector('[data-controlled-full-title]');
  if (!body) return;

  if (title) title.textContent = state.archived ? 'Архив контрольных дел' : 'Общий перечень дел';

  body.innerHTML = state.filteredRows.map(row => {
    const data = normalizeArchiveRow(row);
    const id = state.archived ? (row.id || data.archive_id) : data.id;
    return `
      <tr data-controlled-row="${id}">
        <td class="center strong">${formatText(data.case_number)}</td>
        <td>${formatText(data.plaintiff)}</td>
        <td>${formatText(data.defendant)}</td>
        <td>${formatText(data.subject)}</td>
        <td>${formatText(getLastTwoResultLinesForTable(data.result))}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="5" class="empty-cell">${state.archived ? 'В архиве записей нет' : 'Контрольные дела не найдены'}</td></tr>`;
}


function setViewMode(mode) {
  state.viewMode = mode === 'cards' ? 'cards' : 'table';
  if (state.viewMode !== 'cards') {
    state.calendarFocusDate = null;
    state.calendarFocusIds = [];
  }
  localStorage.setItem('controlledCasesViewMode', state.viewMode);
  syncViewMode();
  renderCards();
}

function syncViewMode() {
  const tablePane = document.querySelector('[data-controlled-table-pane]');
  const cardsPane = document.querySelector('[data-controlled-cards-pane]');
  const exportButton = document.querySelector('[data-controlled-export-inline]');
  const sidePanel = document.querySelector('[data-controlled-side-panel]');

  document.querySelectorAll('[data-controlled-view]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.controlledView === state.viewMode);
  });

  if (tablePane) tablePane.hidden = state.viewMode !== 'table';
  if (cardsPane) cardsPane.hidden = state.viewMode !== 'cards';
  if (exportButton) exportButton.hidden = state.viewMode !== 'table';
  if (sidePanel) sidePanel.hidden = state.viewMode !== 'cards';
}

function getFocusedCardRows() {
  if (!state.calendarFocusIds?.length) return state.filteredRows;
  const ids = new Set(state.calendarFocusIds.map(Number));
  return state.filteredRows.filter(row => {
    const data = normalizeArchiveRow(row);
    const id = Number(state.archived ? (row.id || data.archive_id) : data.id);
    return ids.has(id);
  });
}

function renderCards() {
  const grid = document.querySelector('[data-controlled-cards-grid]');
  if (!grid) return;

  const rows = getFocusedCardRows();
  const hasCalendarFilter = Boolean(state.calendarFocusDate && state.calendarFocusIds?.length);
  const calendarNote = hasCalendarFilter ? `
    <div class="controlled-calendar-filter-note">
      <div>
        <b>Дела на ${displayDateFromKey(state.calendarFocusDate)}</b>
        <span>Открыто из календаря. Нажмите карточку, чтобы раскрыть дело для заполнения/редактирования.</span>
      </div>
      <button class="btn small" data-controlled-calendar-filter-clear type="button">Показать все карточки</button>
    </div>
  ` : '';

  if (!rows.length) {
    grid.innerHTML = `${calendarNote}<div class="empty-card">${state.archived ? 'В архиве записей нет' : 'Контрольные дела не найдены'}</div>`;
    return;
  }

  grid.innerHTML = calendarNote + rows.map(row => {
    const data = normalizeArchiveRow(row);
    const id = state.archived ? (row.id || data.archive_id) : data.id;
    const lastHistory = getLatestHistoryEntry(data.result);
    const cardDate = lastHistory.date || '';
    return `
      <article class="controlled-case-card" data-controlled-card="${id}" tabindex="0">
        <div class="controlled-case-card-head">
          <div class="controlled-case-icon" aria-hidden="true">⚖</div>
          <div>
            <span class="controlled-case-kicker">№ ПК</span>
            <h4>${formatText(data.case_number || 'Без номера')}</h4>
          </div>
          <span class="controlled-case-badge">Контроль</span>
        </div>

        <div class="controlled-case-fields">
          ${renderCardField('№ дела в суде', data.court_case_number)}
          ${renderCardField('Суд', data.court)}
          ${renderCardField('Представитель', data.representative)}
          ${renderCardField('Истец', data.plaintiff)}
          ${renderCardField('Ответчик', data.defendant)}
          ${renderCardField('Предмет спора', data.subject, true)}
          ${renderCardField('История результатов', getLastTwoResultLinesForTable(data.result), true)}
        </div>

        <div class="controlled-case-card-footer">
          <span class="controlled-card-date">${escapeHtml(cardDate)}</span>
          <span class="controlled-card-open-hint">Нажмите, чтобы открыть</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderCardField(label, value, wide = false) {
  return `
    <div class="controlled-card-field ${wide ? 'wide' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${formatText(value)}</strong>
    </div>
  `;
}

function getLatestHistoryEntry(result) {
  const lines = String(result || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const parsed = lines.map(line => parseResultLine(line)).filter(row => row.date || row.time || row.note);

  const withDate = parsed.filter(row => normalizeDateKey(row.date));
  if (!withDate.length) return parsed[parsed.length - 1] || { date: '', time: '', note: '' };

  return withDate.sort((a, b) => {
    const aKey = normalizeDateKey(a.date);
    const bKey = normalizeDateKey(b.date);
    return aKey.localeCompare(bKey);
  }).at(-1) || { date: '', time: '', note: '' };
}

function normalizeDateKey(value) {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayDateFromKey(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function getRowsByLatestHistoryDate() {
  const map = new Map();

  for (const row of state.filteredRows) {
    const data = normalizeArchiveRow(row);
    const id = state.archived ? (row.id || data.archive_id) : data.id;
    const latest = getLatestHistoryEntry(data.result);
    const key = normalizeDateKey(latest.date);
    if (!key) continue;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ row, data, id, latest });
  }

  return map;
}

function renderCalendar() {
  const grid = document.querySelector('[data-controlled-calendar-grid]');
  const label = document.querySelector('[data-controlled-month-label]');
  if (!grid) return;

  const monthDate = state.calendarMonth || new Date();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  if (label) label.textContent = monthDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  const casesByDate = getRowsByLatestHistoryDate();
  const todayKey = normalizeDateKey(formatToday());
  const selectedKey = todayKey;
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const items = casesByDate.get(key) || [];
    cells.push(`
      <button class="controlled-calendar-day ${day.getMonth() === month ? '' : 'muted'} ${key === selectedKey ? 'today' : ''} ${items.length ? 'has-cases' : ''}"
        data-controlled-calendar-day="${key}"
        type="button"
        title="${items.length ? `${items.length} дел на ${displayDateFromKey(key)}` : displayDateFromKey(key)}">
        <span>${day.getDate()}</span>
        ${items.length ? `<i>${items.length > 9 ? '9+' : items.length}</i>` : ''}
      </button>
    `);
  }

  grid.innerHTML = cells.join('');
  document.querySelector('[data-controlled-calendar-popover]')?.setAttribute('hidden', '');
}

function openCasesByDate(dateKey, anchor) {
  const casesByDate = getRowsByLatestHistoryDate();
  const items = casesByDate.get(dateKey) || [];

  if (!items.length) {
    showNotification('На выбранную дату контрольных дел нет');
    return;
  }

  state.calendarFocusDate = dateKey;
  state.calendarFocusIds = items.map(item => Number(item.id)).filter(Boolean);
  setViewMode('cards');
  renderCards();
  document.querySelector('[data-controlled-calendar-popover]')?.setAttribute('hidden', '');

  requestAnimationFrame(() => {
    document.querySelector('[data-controlled-cards-pane]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function clearCalendarCardFilter() {
  state.calendarFocusDate = null;
  state.calendarFocusIds = [];
  renderCards();
}

function renderMiniTasks() {
  const node = document.querySelector('[data-controlled-mini-tasks]');
  if (!node) return;

  const items = [];
  const todayKey = normalizeDateKey(formatToday());

  for (const row of state.filteredRows) {
    const data = normalizeArchiveRow(row);
    const latest = getLatestHistoryEntry(data.result);
    const key = normalizeDateKey(latest.date);
    if (!key) continue;
    items.push({ data, key, latest });
  }

  items.sort((a, b) => a.key.localeCompare(b.key));
  const visible = items.filter(item => item.key >= todayKey).slice(0, 5);

  if (!visible.length) {
    node.innerHTML = '<div class="controlled-mini-empty">Ближайших задач по датам истории нет</div>';
    return;
  }

  node.innerHTML = visible.map(item => `
    <div class="controlled-mini-task">
      <span></span>
      <div>
        <b>${formatText(item.latest.note || item.data.subject || 'Контрольное дело')}</b>
        <small>${formatText(item.data.case_number)} · ${displayDateFromKey(item.key)}</small>
      </div>
    </div>
  `).join('');
}

function updateCount() {
  const node = document.querySelector('[data-controlled-count]');
  if (node) node.textContent = `${state.filteredRows.length} ${declineCases(state.filteredRows.length)}`;
}

function declineCases(n) {
  const last = Math.abs(n) % 10;
  const lastTwo = Math.abs(n) % 100;

  if (last === 1 && lastTwo !== 11) return 'дело';
  if ([2, 3, 4].includes(last) && ![12, 13, 14].includes(lastTwo)) return 'дела';
  return 'дел';
}

function resetForm() {
  const form = document.querySelector('[data-controlled-form]');
  if (!form) return;

  form.reset();
  state.currentId = null;
  state.historyRows = [];

  form.elements.id.value = '';
  form.elements.case_number.value = '№';
  form.elements.case_number.focus?.();

  addHistoryRow();
  syncFormMode();
}

function fillForm(rawRow) {
  const row = normalizeArchiveRow(rawRow);
  const form = document.querySelector('[data-controlled-form]');
  if (!form) return;

  state.currentId = state.archived ? (rawRow.id || row.archive_id) : row.id;

  form.elements.id.value = state.currentId || '';

  fields.forEach(field => {
    if (form.elements[field]) {
      form.elements[field].value = row[field] || '';
    }
  });

  if (!form.elements.case_number.value) {
    form.elements.case_number.value = '№';
  } else {
    form.elements.case_number.value = normalizeControlPkValue(form.elements.case_number.value, true);
  }

  state.historyRows = [];
  const lines = String(row.result || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  if (lines.length) {
    lines.forEach((line, index) => {
      const parsed = parseResultLine(line);
      state.historyRows.push({
        id: makeId(),
        number: index + 1,
        date: parsed.date,
        time: parsed.time,
        note: parsed.note
      });
    });
  } else {
    state.historyRows.push({ id: makeId(), number: 1, date: '', time: '', note: '' });
  }

  renderHistoryRows();
  syncFormMode();

  const head = document.querySelector('[data-controlled-form-title]');
  if (head) head.textContent = state.archived ? 'Архивное контрольное дело' : 'Карточка контрольного дела';

  const idNode = document.querySelector('[data-controlled-current-id]');
  if (idNode) idNode.textContent = state.currentId ? `ID ${state.currentId}` : '';
}

function syncFormMode() {
  const form = document.querySelector('[data-controlled-form]');
  if (!form) return;

  const title = document.querySelector('[data-controlled-form-title]');
  const idNode = document.querySelector('[data-controlled-current-id]');
  const archiveButton = document.querySelector('[data-controlled-archive-selected]');
  const restoreButton = document.querySelector('[data-controlled-restore]');
  const deleteArchiveButton = document.querySelector('[data-controlled-delete-archive]');
  const saveButton = document.querySelector('[data-controlled-save]');

  if (title && !state.currentId) title.textContent = state.archived ? 'Выберите архивное дело' : 'Новое контрольное дело';
  if (idNode && !state.currentId) idNode.textContent = '';

  if (archiveButton) archiveButton.hidden = state.archived || !state.currentId;
  if (restoreButton) restoreButton.hidden = !state.archived || !state.currentId;
  if (deleteArchiveButton) deleteArchiveButton.hidden = !state.archived || !state.currentId;
  if (saveButton) saveButton.hidden = state.archived;

  Array.from(form.elements).forEach(element => {
    if (!element.name) return;
    if (element.name === 'id') return;
    element.disabled = state.archived;
  });

  document.querySelectorAll('[data-history-add], [data-history-remove]').forEach(button => {
    button.disabled = state.archived;
  });
}

function addHistoryRow(date = '', note = '', time = '') {
  const maxNumber = state.historyRows.reduce((max, row) => Math.max(max, row.number || 0), 0);
  state.historyRows.unshift({
    id: makeId(),
    number: maxNumber + 1,
    date,
    time,
    note
  });

  renderHistoryRows();
}

function removeNewestHistoryRow() {
  if (!state.historyRows.length) return;

  state.historyRows.shift();

  if (!state.historyRows.length) {
    addHistoryRow();
    return;
  }

  renderHistoryRows();
}

function renderHistoryRows() {
  const list = document.querySelector('[data-controlled-history-rows]');
  if (!list) return;

  list.innerHTML = state.historyRows.map(row => `
    <div class="controlled-history-row" data-history-id="${row.id}">
      <span class="history-number">${row.number}.</span>
      <input data-history-note value="${escapeAttr(row.note)}" placeholder="Примечание">
      <input data-history-time value="${escapeAttr(row.time)}" placeholder="ЧЧ:ММ" maxlength="5">
      <input data-history-date value="${escapeAttr(row.date)}" placeholder="ДД.ММ.ГГГГ" maxlength="10">
      <button class="btn small" data-history-pick-today="${row.id}" type="button">сегодня</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-history-note], [data-history-time], [data-history-date]').forEach(input => {
    input.addEventListener('input', syncHistoryFromDom);
  });

  list.querySelectorAll('[data-history-pick-today]').forEach(button => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-history-id]');
      const input = row?.querySelector('[data-history-date]');
      if (input) {
        input.value = formatToday();
        syncHistoryFromDom();
      }
    });
  });

  syncFormMode();
}

function syncHistoryFromDom() {
  const rows = [];
  document.querySelectorAll('[data-history-id]').forEach(row => {
    rows.push({
      id: row.dataset.historyId,
      number: Number(row.querySelector('.history-number')?.textContent.replace('.', '') || 0),
      note: row.querySelector('[data-history-note]')?.value || '',
      time: row.querySelector('[data-history-time]')?.value || '',
      date: row.querySelector('[data-history-date]')?.value || ''
    });
  });
  state.historyRows = rows;
}

function getFormData(form) {
  syncHistoryFromDom();

  const data = Object.fromEntries(new FormData(form).entries());
  data.case_number = normalizeControlPkValue(data.case_number || '№', true);
  data.result = buildHistoryText();
  return data;
}

function buildHistoryText() {
  return [...state.historyRows]
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map(row => {
      const left = [row.time, row.date].map(value => String(value || '').trim()).filter(Boolean).join(' ');
      const note = String(row.note || '').trim();

      if (left && note) return `${left} - ${note}`;
      if (left) return left;
      return note;
    })
    .filter(Boolean)
    .join('\n');
}

async function saveControlledCase(form) {
  const data = getFormData(form);
  const required = [
    ['case_number', '№ ПК'],
    ['plaintiff', 'Истец'],
    ['defendant', 'Ответчик'],
    ['subject', 'Предмет спора']
  ];

  const empty = required.filter(([key]) => !String(data[key] || '').trim() || data[key] === '№').map(([, label]) => label);

  if (empty.length) {
    alert(`Заполните обязательные поля:\n${empty.join(', ')}`);
    return;
  }

  try {
    if (data.id) {
      await dbApi.updateControlledCase(data.id, data);
      showNotification('Контрольное дело обновлено');
    } else {
      const created = await dbApi.createControlledCase(data);
      state.currentId = created.id;
      showNotification('Контрольное дело добавлено');
    }

    await loadControlledCases();
    const row = state.rows.find(item => Number(item.id) === Number(state.currentId || data.id));
    if (row) fillForm(row);
    setControlledEditorOpen(false);
  } catch (error) {
    alert('Не удалось сохранить:\n' + error.message);
  }
}


async function deleteControlledCard(id) {
  if (!id) return;

  const message = state.archived
    ? 'Удалить архивное контрольное дело навсегда?'
    : 'Удалить контрольное дело из активного перечня? Оно будет перенесено в архив.';
  if (!confirm(message)) return;

  try {
    if (state.archived) {
      await dbApi.deleteControlledArchiveCase(id);
      showNotification('Архивное контрольное дело удалено');
    } else {
      await dbApi.archiveControlledCase(id);
      showNotification('Контрольное дело удалено из активного перечня');
    }

    if (Number(state.currentId) === Number(id)) resetForm();
    await loadControlledCases();
  } catch (error) {
    alert('Не удалось удалить контрольное дело\n' + error.message);
  }
}
async function archiveCurrentCase() {
  if (!state.currentId) {
    alert('Выберите запись в таблице');
    return;
  }

  if (!confirm('Перенести выбранную запись в архив?')) return;

  try {
    await dbApi.archiveControlledCase(state.currentId);
    showNotification('Запись перенесена в архив');
    resetForm();
    await loadControlledCases();
  } catch (error) {
    alert('Не удалось перенести в архив:\n' + error.message);
  }
}

async function restoreCurrentArchiveCase() {
  if (!state.currentId) {
    alert('Выберите запись в архиве');
    return;
  }

  if (!confirm('Восстановить дело из архива?')) return;

  try {
    await dbApi.restoreControlledCase(state.currentId);
    showNotification('Запись восстановлена');
    resetForm();
    await loadControlledCases();
  } catch (error) {
    alert('Не удалось восстановить:\n' + error.message);
  }
}

async function deleteCurrentArchiveCase() {
  if (!state.currentId) {
    alert('Выберите запись в архиве');
    return;
  }

  if (!confirm('Удалить запись НАВСЕГДА?')) return;

  try {
    await dbApi.deleteControlledArchiveCase(state.currentId);
    showNotification('Запись удалена навсегда');
    resetForm();
    await loadControlledCases();
  } catch (error) {
    alert('Не удалось удалить:\n' + error.message);
  }
}


function openControlledViewCard(rawRow) {
  const data = normalizeArchiveRow(rawRow);
  const dialog = document.querySelector('[data-controlled-view-dialog]');
  const title = document.querySelector('[data-controlled-view-title]');
  const body = document.querySelector('[data-controlled-view-body]');
  if (!dialog || !body) return;

  if (title) title.textContent = data.case_number ? `Контрольное дело ${data.case_number}` : 'Контрольное дело';
  body.innerHTML = renderControlledReadonlyCard(data);

  try {
    if (dialog.open) dialog.close();
    dialog.showModal();
  } catch {
    dialog.setAttribute('open', '');
  }
}

function closeControlledViewCard() {
  const dialog = document.querySelector('[data-controlled-view-dialog]');
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function renderControlledReadonlyCard(data = {}) {
  const historyLines = String(data.result || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const latest = getLatestHistoryEntry(data.result);

  return `
    <article class="controlled-readonly-card">
      <div class="controlled-readonly-summary">
        <div class="controlled-case-icon" aria-hidden="true">⚖</div>
        <div>
          <span class="controlled-case-kicker">№ ПК</span>
          <h4>${formatText(data.case_number || 'Без номера')}</h4>
          <p>${formatText(data.subject || 'Предмет спора не указан')}</p>
        </div>
        <span class="controlled-case-badge">Просмотр</span>
      </div>

      <div class="controlled-readonly-grid">
        ${renderReadonlyField('№ дела в суде', data.court_case_number)}
        ${renderReadonlyField('Суд', data.court)}
        ${renderReadonlyField('Представитель', data.representative)}
        ${renderReadonlyField('Истец', data.plaintiff)}
        ${renderReadonlyField('Ответчик', data.defendant)}
        ${renderReadonlyField('Последняя дата контроля', [latest.time, latest.date].filter(Boolean).join(' ') || latest.note, true)}
        ${renderReadonlyField('Предмет спора', data.subject, true)}
      </div>

      <section class="controlled-readonly-history">
        <h4>История результатов</h4>
        ${historyLines.length ? `
          <div class="controlled-readonly-history-list">
            ${historyLines.map(line => {
              const parsed = parseResultLine(line);
              return `
                <div class="controlled-readonly-history-row">
                  <span>${formatText(parsed.date)}</span>
                  <span>${formatText(parsed.time)}</span>
                  <strong>${formatText(parsed.note || line)}</strong>
                </div>
              `;
            }).join('')}
          </div>
        ` : '<div class="controlled-readonly-empty">История результатов не заполнена</div>'}
      </section>
    </article>
  `;
}

function renderReadonlyField(label, value, wide = false) {
  return `
    <div class="controlled-readonly-field ${wide ? 'wide' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${formatText(value)}</strong>
    </div>
  `;
}

function openFullTable() {
  renderFullTable();
  document.querySelector('[data-controlled-full-dialog]')?.showModal();
}

function closeFullTable() {
  document.querySelector('[data-controlled-full-dialog]')?.close();
}

function exportFullTableToR7() {
  const rows = state.filteredRows.map(normalizeArchiveRow);
  if (!rows.length) {
    alert('В таблице нет данных для экспорта.');
    return;
  }

  const date = formatToday();
  const title = state.archived ? 'АРХИВ КОНТРОЛЬНЫХ ДЕЛ' : 'ПЕРЕЧЕНЬ КОНТРОЛЬНЫХ ДЕЛ';

  // Важно: Word/Р-7 иногда расширяет таблицу из-за длинных слов без пробелов.
  // Поэтому ставим фиксированную ширину, colgroup и принудительный перенос anywhere.
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page Section1 {
    size: 29.7cm 21cm;
    margin: 1.4cm 0.8cm 1.4cm 1.2cm;
    mso-page-orientation: landscape;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    font-family: "PT Astra Serif", "Times New Roman", serif;
    font-size: 11pt;
    color: #000;
    background: #fff;
  }

  div.Section1 {
    page: Section1;
    width: 27.7cm;
  }

  h1 {
    text-align: center;
    font-size: 12pt;
    margin: 0 0 10pt 0;
    font-weight: bold;
  }

  .date {
    text-align: right;
    font-size: 11pt;
    margin: 0 0 8pt 0;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 27.7cm;
    max-width: 27.7cm;
    mso-table-layout-alt: fixed;
  }

  col.col-num { width: 3.0cm; }
  col.col-party { width: 5.0cm; }
  col.col-party2 { width: 5.0cm; }
  col.col-subject { width: 9.2cm; }
  col.col-history { width: 5.5cm; }

  th, td {
    border: 1px solid #000;
    padding: 3pt 4pt;
    vertical-align: top;
    line-height: 1.08;
    font-size: 11pt;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
    mso-line-height-rule: exactly;
  }

  th {
    text-align: center;
    font-weight: bold;
  }

  td:nth-child(1), td:nth-child(5) {
    text-align: center;
  }

  td:nth-child(4) {
    text-align: justify;
  }

  .break-anywhere {
    word-break: break-word;
    overflow-wrap: anywhere;
  }
</style>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>90</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
</head>
<body>
<div class="Section1">
  <h1>${title}</h1>
  <div class="date">${date}</div>

  <table>
    <colgroup>
      <col class="col-num">
      <col class="col-party">
      <col class="col-party2">
      <col class="col-subject">
      <col class="col-history">
    </colgroup>
    <thead>
      <tr>
        <th>№ ПК</th>
        <th>Истец</th>
        <th>Ответчик</th>
        <th>Предмет спора</th>
        <th>История результатов</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>
          <td class="break-anywhere">${formatExportCell(row.case_number)}</td>
          <td class="break-anywhere">${formatExportCell(row.plaintiff)}</td>
          <td class="break-anywhere">${formatExportCell(row.defendant)}</td>
          <td class="break-anywhere">${formatExportCell(row.subject)}</td>
          <td class="break-anywhere">${formatExportCell(getLastTwoResultLinesForTable(row.result))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.archived ? 'Архив_контрольных_дел' : 'Перечень_контрольных_дел'}_${date.replaceAll('.', '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatExportCell(value) {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text).replace(/\r?\n/g, '<br>') : '';
}

function normalizeControlPkValue(value, preserveExistingYear = false) {
  const currentYear = String(new Date().getFullYear());
  let raw = String(value || '').trim();

  if (raw.startsWith('№')) raw = raw.slice(1).trim();
  if (raw.includes(' от ')) raw = raw.split(' от ', 1)[0].trim();

  const hasSlash = raw.includes('/');

  if (!hasSlash) {
    const digits = [...raw].filter(ch => /\d/.test(ch)).join('');
    return digits ? `№${digits}` : '№';
  }

  const [before, after] = raw.split('/', 2);
  const numberPart = [...before].filter(ch => /\d/.test(ch)).join('');
  if (!numberPart) return '№';

  const yearDigits = [...String(after || '')].filter(ch => /\d/.test(ch)).join('');
  const yearPart = preserveExistingYear && yearDigits.length >= 4 ? yearDigits.slice(0, 4) : currentYear;
  return `№${numberPart}/${yearPart}`;
}

function formatControlPkInput(input) {
  const formatted = normalizeControlPkValue(input.value, false);
  input.value = formatted;
  input.setSelectionRange(input.value.length, input.value.length);
}

function formatHistoryTime(input) {
  let digits = [...input.value].filter(ch => /\d/.test(ch)).join('').slice(0, 4);
  input.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function formatHistoryDate(input) {
  let digits = [...input.value].filter(ch => /\d/.test(ch)).join('').slice(0, 8);

  if (digits.length > 4) input.value = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  else if (digits.length > 2) input.value = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  else input.value = digits;
}

function parseResultLine(line) {
  line = String(line || '').trim();
  let date = '';
  let time = '';
  let note = line;

  if (!line) return { date, time, note };

  if (/^\d{2}:\d{2}/.test(line)) {
    time = line.slice(0, 5);
    let rest = line.slice(5).trim();

    if (/^\d{2}\.\d{2}\./.test(rest)) {
      date = rest.slice(0, 10);
      rest = rest.slice(10).trim();
    }

    note = rest.replace(/^[-–—/]\s*/, '');
    return { date, time, note };
  }

  if (/^\d{2}\.\d{2}\./.test(line)) {
    date = line.slice(0, 10);
    let rest = line.slice(10).trim();

    if (/^\d{2}:\d{2}/.test(rest)) {
      time = rest.slice(0, 5);
      rest = rest.slice(5).trim();
    }

    note = rest.replace(/^[-–—/]\s*/, '');
    return { date, time, note };
  }

  return { date, time, note };
}

function formatResultLineForTable(line) {
  const parsed = parseResultLine(line);
  return [parsed.time, parsed.date, parsed.note].map(value => String(value || '').trim()).filter(Boolean).join(' ');
}

function getLastTwoResultLinesForTable(resultText) {
  const lines = String(resultText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const formatted = lines.map(formatResultLineForTable).filter(Boolean);
  return formatted.slice(-2).reverse().join('\n');
}

function formatToday() {
  const date = new Date();
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear()
  ].join('.');
}

function makeId() {
  return `hist_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatText(value) {
  const text = String(value ?? '').trim();
  return text ? escapeHtml(text).replace(/\n/g, '<br>') : '<span class="muted">—</span>';
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
