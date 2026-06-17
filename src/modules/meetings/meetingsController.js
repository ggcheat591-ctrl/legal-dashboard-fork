import { dbApi } from '../../api/dbApi.js';
import { showNotification } from '../../layout/notifications.js';
import { getCurrentUserName } from '../../auth/session.js';

const DEFAULTS = {
  cabinet_number: '213',
  telegram_number: '№ 200/05/ИТФ___',
  protocol_number: '200/05/ПРОТ-___',
  protocol_keeper: 'Иванова Елена Николаевна',
  transfer_email: 'fedorova-en@barnaul-adm.ru',
  transfer_fio: 'Иванова Елена Николаевна',
  transfer_phone: '',
  telegram_sign_fio: 'О.А. Финк',
  protocol_chair_fio: 'О.А. Финк',
  protocol_chair_position: 'заместитель главы администрации города, руководитель аппарата',
  agenda_sign_position: 'Председатель правового комитета',
  agenda_sign_fio: 'О.И. Насыров',
  protocol_report_text: 'О проделанной работе проинформировать правовой комитет администрации города Барнаула до '
};

let state = {
  initialized: false,
  rows: [],
  filteredRows: [],
  selectedId: null,
  search: '',
  agendaRows: [''],
  taskRows: [{ committee: '', task: '', date: '', done: false }],
  docType: 'participants',
  people: { msu_ip: [], invited_ip: [] },
  peopleLoaded: { msu_ip: false, invited_ip: false },
  selectedPeople: { msu_ip: new Set(), invited_ip: new Set() },
  expandedPeople: { msu_ip: new Set(), invited_ip: new Set() },
  isFilling: false,
  flow: 'landing'
};

export function initMeetingsPage() {
  if (state.initialized) return;
  state.initialized = true;

  document.addEventListener('click', event => {
    const sectionToggleFirst = event.target.closest('[data-meetings-people-section-toggle]');
    if (sectionToggleFirst) {
      event.preventDefault();
      event.stopPropagation();
      togglePeopleSection(sectionToggleFirst.dataset.category, sectionToggleFirst.dataset.key);
      return;
    }

    if (event.target.closest('[data-meetings-refresh]')) loadMeetings();

    if (event.target.closest('[data-meetings-launch-create]')) {
      event.preventDefault();
      event.stopPropagation();
      state.flow = 'new-meeting';
      syncMeetingsFlowUi();
      setArchiveOpen(false);
      setEditorOpen(false);
      closeMeetingTypeDialog();
      showMeetingsPreloader('Открываю выбор типа документа...').then(() => {
        showMeetingTypeDialog();
      });
      return;
    }

    if (event.target.closest('[data-meetings-launch-archive]')) {
      event.preventDefault();
      event.stopPropagation();
      state.flow = 'archive';
      syncMeetingsFlowUi();
      setEditorOpen(false);
      closeMeetingTypeDialog();
      showMeetingsPreloader('Открываю архив совещаний...').then(() => {
        setArchiveOpen(true);
        document.querySelector('[data-meetings-archive]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (event.target.closest('[data-meetings-back-home]')) {
      event.preventDefault();
      event.stopPropagation();
      resetMeetingsHome(false);
      document.querySelector('.meetings-main-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (event.target.closest('[data-meetings-open]')) {
      event.preventDefault();
      event.stopPropagation();
      const editor = document.querySelector('[data-meetings-editor]');
      const form = document.querySelector('[data-meetings-form]');
      const hasCurrent = Boolean(form?.elements.id?.value);
      if (editor && !editor.classList.contains('is-open') && !hasCurrent) {
        setArchiveOpen(false);
        showMeetingsPreloader('Открываю выбор типа документа...').then(() => showMeetingTypeDialog());
      } else {
        toggleEditor();
      }
      return;
    }

    if (event.target.closest('[data-meetings-type-cancel]')) {
      const editorOpen = document.querySelector('[data-meetings-editor]')?.classList.contains('is-open');
      closeMeetingTypeDialog();
      if (state.flow === 'new-meeting' && !editorOpen) resetMeetingsHome(false);
    }

    const typePick = event.target.closest('[data-meetings-type-pick]');
    if (typePick) chooseMeetingType(typePick.dataset.meetingsTypePick);

    if (event.target.closest('[data-meetings-attach]')) {
      document.querySelector('[data-meetings-file-input]')?.click();
    }

    if (event.target.closest('[data-meetings-open-file]')) {
      openAttachedMeetingFile();
      return;
    }

    const breadcrumb = event.target.closest('[data-meetings-breadcrumb-action]');
    if (breadcrumb) {
      event.preventDefault();
      event.stopPropagation();
      handleMeetingBreadcrumbAction(breadcrumb.dataset.meetingsBreadcrumbAction);
      return;
    }

    if (event.target.closest('[data-meetings-clear]')) { clearForm(); openEditor(); }
    if (event.target.closest('[data-meetings-delete]')) deleteSelected();
    if (event.target.closest('[data-meetings-generate]')) generateSelectedDocument();

    const addCommittee = event.target.closest('[data-meetings-add-committee]');
    if (addCommittee) {
      const index = Number(addCommittee.dataset.meetingsAddCommittee);
      if (state.taskRows[index]) {
        state.taskRows[index].committees = normalizeCommitteeList(state.taskRows[index]);
        state.taskRows[index].committees.push('');
      }
      renderTaskRows();
      return;
    }

    const removeCommittee = event.target.closest('[data-meetings-remove-committee]');
    if (removeCommittee) {
      const index = Number(removeCommittee.dataset.meetingsRemoveCommittee);
      const committeeIndex = Number(removeCommittee.dataset.committeeIndex);
      if (state.taskRows[index]) {
        state.taskRows[index].committees = normalizeCommitteeList(state.taskRows[index]);
        state.taskRows[index].committees.splice(committeeIndex, 1);
        if (!state.taskRows[index].committees.length) state.taskRows[index].committees = [''];
        state.taskRows[index].committee = state.taskRows[index].committees.filter(Boolean).join('§§');
      }
      renderTaskRows();
      return;
    }

    const clearCommittee = event.target.closest('[data-meetings-clear-committee]');
    if (clearCommittee) {
      const index = Number(clearCommittee.dataset.meetingsClearCommittee);
      const committeeIndex = Number(clearCommittee.dataset.committeeIndex || 0);
      if (state.taskRows[index]) {
        state.taskRows[index].committees = normalizeCommitteeList(state.taskRows[index]);
        state.taskRows[index].committees[committeeIndex] = '';
        state.taskRows[index].committee = state.taskRows[index].committees.filter(Boolean).join('§§');
      }
      renderTaskRows();
      return;
    }

    const docBtn = event.target.closest('[data-meetings-doc-type]');
    if (docBtn) {
      const nextType = docBtn.dataset.meetingsDocType;
      if (nextType === 'documents') {
        showMeetingsPreloader('Загрузка документов...').then(() => setDocType(nextType));
      } else {
        setDocType(nextType);
      }
      return;
    }

    if (event.target.closest('[data-meetings-agenda-add]')) { state.agendaRows.push(''); renderAgendaRows(); }
    if (event.target.closest('[data-meetings-agenda-remove]')) { if (state.agendaRows.length > 1) state.agendaRows.pop(); renderAgendaRows(); }

    if (event.target.closest('[data-meetings-task-add]')) { state.taskRows.push({ committee: '', committees: [''], task: '', date: '', done: false }); renderTaskRows(); }
    if (event.target.closest('[data-meetings-task-remove]')) { if (state.taskRows.length > 1) state.taskRows.pop(); renderTaskRows(); }

    const openRowBtn = event.target.closest('[data-meetings-open-row]');
    if (openRowBtn) {
      event.preventDefault();
      event.stopPropagation();
      state.flow = 'archive';
      syncMeetingsFlowUi();
      selectRow(openRowBtn.dataset.meetingsOpenRow);
      showMeetingsPreloader('Открываю сохранённое совещание...').then(() => {
        fillSelected('documents');
      });
      return;
    }

    const row = event.target.closest('[data-meetings-row]');
    if (row) selectRow(row.dataset.meetingsRow);

    const togglePeople = event.target.closest('[data-meetings-toggle-people]');
    if (togglePeople) togglePeoplePanel(togglePeople.dataset.meetingsTogglePeople);

    const collapsePeople = event.target.closest('[data-meetings-collapse-people]');
    if (collapsePeople) setPeoplePanelOpen(collapsePeople.dataset.meetingsCollapsePeople, false);

    const sectionToggle = event.target.closest('[data-meetings-people-section-toggle]');
    if (sectionToggle) togglePeopleSection(sectionToggle.dataset.category, sectionToggle.dataset.key);
  });

  document.addEventListener('dblclick', event => {
    const row = event.target.closest('[data-meetings-row]');
    if (!row) return;
    state.flow = 'archive';
    syncMeetingsFlowUi();
    selectRow(row.dataset.meetingsRow);
    showMeetingsPreloader('Открываю сохранённое совещание...').then(() => {
      fillSelected();
    });
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-meetings-search]')) {
      state.search = event.target.value;
      clearTimeout(window.__meetingsSearchTimer);
      window.__meetingsSearchTimer = setTimeout(applySearchAndRender, 150);
    }

    if (event.target.matches('[data-meetings-date]')) formatDate(event.target);
    if (event.target.matches('[data-meetings-time]')) formatTime(event.target);

    const agendaInput = event.target.closest('[data-meetings-agenda-index]');
    if (agendaInput) state.agendaRows[Number(agendaInput.dataset.meetingsAgendaIndex)] = agendaInput.value;

    const committeeInput = event.target.closest('[data-meetings-committee-input]');
    if (committeeInput) {
      const index = Number(committeeInput.dataset.meetingsTaskIndex);
      const committeeIndex = Number(committeeInput.dataset.committeeIndex || 0);
      if (state.taskRows[index]) {
        state.taskRows[index].committees = normalizeCommitteeList(state.taskRows[index]);
        state.taskRows[index].committees[committeeIndex] = committeeInput.value;
        state.taskRows[index].committee = state.taskRows[index].committees.filter(Boolean).join('§§');
      }
      return;
    }

    const taskInput = event.target.closest('[data-meetings-task-field]');
    if (taskInput) {
      const index = Number(taskInput.dataset.meetingsTaskIndex);
      const field = taskInput.dataset.meetingsTaskField;
      if (state.taskRows[index]) state.taskRows[index][field] = taskInput.type === 'checkbox' ? taskInput.checked : taskInput.value;
    }

    const personCheck = event.target.closest('[data-meetings-person-check]');
    if (personCheck) {
      const category = personCheck.dataset.category;
      const name = personCheck.dataset.name;
      if (personCheck.checked) state.selectedPeople[category].add(name);
      else state.selectedPeople[category].delete(name);
      syncPeopleHiddenFields();
      renderSelectedCounters();
      if (state.docType === 'agenda') refreshAgendaParticipantRows();
    }
  });


document.addEventListener('change', event => {
  if (event.target.matches('[data-meetings-file-input]')) {
    const file = event.target.files?.[0];
    const form = document.querySelector('[data-meetings-form]');
    if (file && form?.elements.attachment_path) {
      form.elements.attachment_path.value = file.path || file.name;
    }
  }

  if (event.target.matches('[name="protocol_report_enabled"]')) {
    syncProtocolReportState();
  }
});

  document.addEventListener('submit', event => {
    if (event.target.matches('[data-meetings-form]')) {
      event.preventDefault();
      saveMeeting(event.target);
    }
  });


  window.addEventListener('meetings:open-meeting', event => {
    const id = Number(event.detail?.id || 0);
    if (!id) return;
    openMeetingById(id);
  });

  window.addEventListener('app:view-changed', event => {
    if (event.detail?.viewId !== 'meetings') return;
    resetMeetingsHome(true);
  });

  checkDb();
  clearForm(false);
  loadMeetings();
}

function openEditor() { setEditorOpen(true); }

function resetMeetingsHome(withPreloader = false) {
  const run = () => {
    state.flow = 'landing';
    syncMeetingsFlowUi();
    closeMeetingTypeDialog();
    clearForm(false);
    state.selectedId = null;
    state.docType = 'participants';
    state.selectedPeople.msu_ip = new Set();
    state.selectedPeople.invited_ip = new Set();
    state.expandedPeople.msu_ip = new Set();
    state.expandedPeople.invited_ip = new Set();
    state.agendaRows = [''];
    state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];
    setEditorOpen(false);
    setArchiveOpen(false);
    document.querySelectorAll('[data-meetings-people-panel]').forEach(panel => panel.hidden = true);
    updateMeetingsBreadcrumb('Выбор типа документа');
    renderTable();
  };

  if (withPreloader) {
    showMeetingsPreloader('Загрузка совещаний...').then(run);
  } else {
    run();
  }
}

function showMeetingsPreloader(text = 'Загрузка...', delay = 260) {
  const loader = document.querySelector('[data-meetings-preloader]');
  const label = document.querySelector('[data-meetings-preloader-text]');
  if (!loader) return Promise.resolve();

  if (label) label.textContent = text;
  loader.hidden = false;
  requestAnimationFrame(() => loader.classList.add('is-visible'));

  return new Promise(resolve => {
    setTimeout(() => {
      loader.classList.remove('is-visible');
      setTimeout(() => {
        loader.hidden = true;
        resolve();
      }, 180);
    }, delay);
  });
}

function showMeetingTypeDialog() {
  const dialog = document.querySelector('[data-meetings-type-dialog]');
  if (!dialog) { chooseMeetingType('participants'); return; }
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeMeetingTypeDialog() {
  const dialog = document.querySelector('[data-meetings-type-dialog]');
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}

function chooseMeetingType(type) {
  state.flow = 'new-meeting';
  syncMeetingsFlowUi();
  closeMeetingTypeDialog();
  clearForm(false);
  if (type === 'protocol') {
    state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];
  }
  setDocType(type || 'participants');
  openEditor();
  const title = document.querySelector('[data-meetings-editor-title]');
  const hint = document.querySelector('[data-meetings-current-id]');
  if (title) title.textContent = getDocTypeTitle(type);
  if (hint) hint.textContent = getDocTypeDescription(type);
  updateMeetingsBreadcrumb();
  document.querySelector('[data-meetings-editor]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getDocTypeTitle(type = state.docType) {
  return {
    participants: 'Список участников',
    agenda: 'Повестка',
    telegram: 'Телефонограмма',
    protocol: 'Протокол',
    documents: 'Документы'
  }[type] || 'Новое совещание';
}

function getDocTypeDescription(type = state.docType) {
  return {
    participants: 'Выберите участников и приглашённых для совещания.',
    agenda: 'Заполните вопросы повестки и участников совещания.',
    telegram: 'Заполните параметры телефонограммы и отправки.',
    protocol: 'Заполните поручения, сроки и данные протокола.',
    documents: 'Прикрепите файл совещания или откройте уже сохранённый документ.',
  }[type] || 'Заполните поля выбранного раздела совещания.';
}

function handleMeetingBreadcrumbAction(action) {
  if (action === 'home') {
    closeMeetingTypeDialog();
    resetMeetingsHome(false);
    document.querySelector('.meetings-main-head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (action === 'type-select') {
    closeMeetingTypeDialog();
    setEditorOpen(false);
    if (state.flow === 'archive') {
      showMeetingsPreloader('Открываю архив совещаний...').then(() => {
        setArchiveOpen(true);
        document.querySelector('[data-meetings-archive]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    state.flow = 'new-meeting';
    syncMeetingsFlowUi();
    setArchiveOpen(false);
    showMeetingsPreloader('Открываю выбор типа документа...').then(() => showMeetingTypeDialog());
  }
}

async function openAttachedMeetingFile() {
  const form = document.querySelector('[data-meetings-form]');
  const value = normalizeAttachmentPath(form?.elements.attachment_path?.value);
  if (!value) {
    alert('Файл не прикреплен. Сначала прикрепите документ.');
    return;
  }

  if (isLocalFilePath(value)) {
    const result = await openLocalFileViaElectron(value);
    if (result.handled) {
      if (!result.ok) alert(result.message || 'Не удалось открыть документ.');
      return;
    }
  }

  const url = buildOpenableFileUrl(value);
  if (!url) {
    alert('Локальный путь файла недоступен из браузера. Откройте приложение в desktop-режиме или прикрепите документ заново.');
    return;
  }

  try {
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) {
      alert('Не удалось открыть документ. Проверьте, не заблокированы ли всплывающие окна.');
    }
  } catch {
    alert('Не удалось открыть документ. Проверьте путь:\n' + value);
  }
}

function normalizeAttachmentPath(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed.replace(/^["']|["']$/g, '');
}

function isLocalFilePath(value = '') {
  return /^(file:\/\/|[a-zA-Z]:[\\/]|\\\\|\/)/.test(value);
}

function buildOpenableFileUrl(value = '') {
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  if (/^file:\/\//i.test(value)) return value;

  const normalized = value.replaceAll('\\', '/');
  if (/^[a-zA-Z]:\//.test(normalized)) return encodeURI(`file:///${normalized}`);
  if (normalized.startsWith('//')) return encodeURI(`file:${normalized}`);
  if (normalized.startsWith('/')) return encodeURI(`file://${normalized}`);
  return '';
}

async function openLocalFileViaElectron(value = '') {
  try {
    const response = await fetch(`/meetings/open-local-file?path=${encodeURIComponent(value)}`, {
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!contentType.includes('text/plain')) return { handled: false };
    return {
      handled: true,
      ok: response.ok,
      message: text || (response.ok ? '' : 'Не удалось открыть документ.'),
    };
  } catch {
    return { handled: false };
  }
}

function toggleEditor() { setEditorOpen(!document.querySelector('[data-meetings-editor]')?.classList.contains('is-open')); }
function setEditorOpen(open) {
  document.querySelector('[data-meetings-editor]')?.classList.toggle('is-open', open);
  document.querySelectorAll('[data-meetings-open]').forEach(btn => {
    btn.textContent = open ? '−' : '＋';
    btn.title = open ? 'Свернуть форму' : 'Показать / скрыть форму';
  });
}

function setArchiveOpen(open) {
  const archive = document.querySelector('[data-meetings-archive]');
  if (!archive) return;
  archive.classList.toggle('is-open', Boolean(open));
}


function syncMeetingsFlowUi() {
  const flow = state.flow || 'landing';
  const landing = flow === 'landing';
  const archive = flow === 'archive';
  const shell = document.querySelector('[data-meetings-shell]');
  const head = document.querySelector('[data-meetings-main-head]');
  const entry = document.querySelector('[data-meetings-entry-panel]');
  const archiveTopline = document.querySelector('[data-meetings-archive-topline]');

  if (shell) shell.dataset.meetingsFlow = flow;
  if (head) head.hidden = !landing;
  if (entry) entry.hidden = !landing;
  if (archiveTopline) archiveTopline.hidden = !archive;
}

function scrollOpenedEditorIntoView() {
  requestAnimationFrame(() => {
    document.querySelector('[data-meetings-editor]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function checkDb() {
  const node = document.querySelector('[data-meetings-db-status]');
  if (!node) return;
  try { await dbApi.health(); node.textContent = 'База подключена'; }
  catch { node.textContent = 'API базы недоступен'; }
}

async function loadMeetings() {
  const body = document.querySelector('[data-meetings-table-body]');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="7" class="empty-cell">Загрузка...</td></tr>';

  try {
    state.rows = await dbApi.getMeetings();
    applySearchAndRender();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="7" class="empty-cell error">Не удалось загрузить совещания: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function openMeetingById(id) {
  state.flow = 'archive';
  syncMeetingsFlowUi();

  if (!state.rows.length) {
    try {
      state.rows = await dbApi.getMeetings();
    } catch (error) {
      alert('Не удалось открыть совещание:\n' + error.message);
      return;
    }
  }

  const row = state.rows.find(item => Number(item.id) === Number(id));
  if (!row) {
    alert('Связанное совещание не найдено.');
    return;
  }

  state.selectedId = row.id;
  state.filteredRows = state.filteredRows?.length ? state.filteredRows : [...state.rows];
  renderTable();
  fillForm(row);
  openEditor();
  scrollOpenedEditorIntoView();
  const title = document.querySelector('[data-meetings-editor-title]');
  const hint = document.querySelector('[data-meetings-current-id]');
  if (title) title.textContent = 'Редактирование совещания';
  if (hint) hint.textContent = `ID ${row.id}`;
  updateMeetingSectionHeading();
  updateMeetingsBreadcrumb();
}

function applySearchAndRender() {
  const parts = String(state.search || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  state.filteredRows = !parts.length ? [...state.rows] : state.rows.filter(row => {
    const haystack = Object.values(row).map(v => String(v ?? '').toLowerCase()).join(' | ');
    return parts.every(part => haystack.includes(part));
  });

  renderTable();
  const count = document.querySelector('[data-meetings-count]');
  if (count) count.textContent = `${state.filteredRows.length} записей`;
  const total = document.querySelector('[data-meetings-total]');
  if (total) total.textContent = String(state.filteredRows.length);
}

function renderTable() {
  const body = document.querySelector('[data-meetings-table-body]');
  if (!body) return;

  if (!state.filteredRows.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">Совещаний нет</td></tr>';
    return;
  }

  body.innerHTML = state.filteredRows.map((row, index) => `
    <tr data-meetings-row="${row.id}" class="${String(state.selectedId) === String(row.id) ? 'selected' : ''}">
      <td>${index + 1}</td>
      <td>${formatText(row.date_val)}</td>
      <td>${formatText(row.time_val)}</td>
      <td class="strong">${formatText(row.title)}</td>
      <td>${formatParticipantsSummary(row)}</td>
      <td>${getDocTypeLabel(row)}</td>
      <td><button class="meetings-table-action" data-meetings-open-row="${row.id}" type="button">↗ Открыть</button></td>
    </tr>
  `).join('');
}

function getDocTypeLabel(row) {
  const type = row.attachment_type || (Number(row.has_participants_list) ? 'participants' : Number(row.has_telegram) ? 'telegram' : '');
  if (type === 'participants') return 'Список участников';
  if (type === 'agenda') return 'Повестка';
  if (type === 'telegram') return 'Телефонограмма';
  if (type === 'protocol') return 'Протокол';
  return '<span class="muted">—</span>';
}

function selectRow(id) { state.selectedId = id; renderTable(); }
function getSelected() { return state.rows.find(row => String(row.id) === String(state.selectedId)); }

function formatParticipantsSummary(row = {}) {
  const people = [
    ...splitLines(row.participants),
    ...splitLines(row.invited_participants)
  ].filter(Boolean);

  if (!people.length) return '<span class="muted">—</span>';
  if (people.length <= 2) return formatText(people.join(', '));
  return `${formatText(people.slice(0, 2).join(', '))} <span class="muted">+${people.length - 2}</span>`;
}

function fillSelected(targetDocType = null) {
  const row = getSelected();
  if (!row) { alert('Выберите совещание.'); return; }

  fillForm(row, targetDocType);
  openEditor();
  scrollOpenedEditorIntoView();
  document.querySelector('[data-meetings-editor-title]').textContent = 'Редактирование совещания';
  document.querySelector('[data-meetings-current-id]').textContent = `ID ${row.id}`;
  updateMeetingsBreadcrumb();
}

function fillForm(row = {}, targetDocType = null) {
  const form = document.querySelector('[data-meetings-form]');
  if (!form) return;

  for (const el of Array.from(form.elements)) {
    if (!el.name) continue;
    if (el.type === 'checkbox') el.checked = Number(row[el.name] || 0) === 1;
    else el.value = row[el.name] ?? '';
  }

  // Для старых записей выставляем значения по умолчанию, если колонки еще не были заполнены.
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (form.elements[key] && !form.elements[key].value) form.elements[key].value = value;
  }

  state.selectedPeople.msu_ip = new Set(splitLines(row.participants));
  state.selectedPeople.invited_ip = new Set(splitLines(row.invited_participants));
  state.agendaRows = parseAgenda(row.agenda || '');
  state.taskRows = parseProtocolTasks(row.protocol || '');

  state.isFilling = true;
  setDocType(targetDocType || row.attachment_type || (Number(row.has_participants_list) ? 'participants' : Number(row.has_telegram) ? 'telegram' : 'participants'));
  state.isFilling = false;
  renderAgendaRows();
  renderTaskRows();
  syncPeopleHiddenFields();
  renderSelectedCounters();
  if (state.docType === 'agenda') refreshAgendaParticipantRows();
  renderPeopleTree('msu_ip');
  renderPeopleTree('invited_ip');
}

function clearForm(keepOpen = true) {
  const form = document.querySelector('[data-meetings-form]');
  form?.reset();

  if (form?.elements.id) form.elements.id.value = '';
  if (form?.elements.date_val) form.elements.date_val.value = formatToday();
  if (form?.elements.time_val) form.elements.time_val.value = formatNowTime();

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (form?.elements[key]) form.elements[key].value = value;
  }

  state.selectedId = null;
  state.selectedPeople.msu_ip = new Set();
  state.selectedPeople.invited_ip = new Set();
  state.agendaRows = [''];
  state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];

  setDocType('participants');
  renderAgendaRows();
  renderTaskRows();
  syncPeopleHiddenFields();
  renderSelectedCounters();
  renderPeopleTree('msu_ip');
  renderPeopleTree('invited_ip');

  document.querySelector('[data-meetings-editor-title]').textContent = getDocTypeTitle(state.docType);
  document.querySelector('[data-meetings-current-id]').textContent = 'Заполните поля выбранного типа совещания';
  updateMeetingSectionHeading();
  updateMeetingsBreadcrumb();
  renderTable();

  if (keepOpen) openEditor();
}

function renderAgendaRows() {
  const box = document.querySelector('[data-meetings-agenda-rows]');
  if (!box) return;
  if (!state.agendaRows.length) state.agendaRows = [''];

  box.innerHTML = state.agendaRows.map((text, index) => `
    <div class="meetings-agenda-row">
      <span>${index + 1}.</span>
      <input data-meetings-agenda-index="${index}" value="${escapeAttr(text)}">
    </div>
  `).join('');
}


function renderTaskRows() {
  const box = document.querySelector('[data-meetings-task-rows]');
  if (!box) return;

  if (state.docType === 'participants' || state.docType === 'telegram' || state.docType === 'documents') {
    box.innerHTML = '';
    return;
  }

  if (state.docType === 'agenda') refreshAgendaParticipantRows(false);
  if (!state.taskRows.length) state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];

  const protocolMode = state.docType === 'protocol';
  const agendaMode = state.docType === 'agenda';

  if (protocolMode && state.taskRows.some(row => looksLikeAgendaParticipantRow(row))) {
    state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];
  }

  box.innerHTML = `
    ${protocolMode ? '<div class="meetings-task-header protocol"><span></span><span>Комитет</span><span>Поручение</span><span>Срок</span><span>✓</span></div>' : ''}
    ${agendaMode ? '<div class="meetings-task-header agenda-speakers"><span></span><span>ФИО</span><span>Должность</span><span>№</span><span>Информирует</span></div>' : ''}
    ${state.taskRows.map((row, index) => {
      const committees = normalizeCommitteeList(row);
      if (protocolMode) row.committees = committees;
      return `
        <div class="meetings-task-row ${protocolMode ? 'protocol' : ''} ${agendaMode ? 'agenda' : ''}">
          <span>${index + 1}.</span>
          ${protocolMode ? `<div class="committee-picker-multi">
            <button class="committee-add" data-meetings-add-committee="${index}" type="button" title="Добавить комитет">+</button>
            <div class="committee-lines">
              ${committees.map((committeeValue, committeeIndex) => `<div class="committee-line">
                <input list="meetingsCommitteesList" data-meetings-committee-input data-meetings-task-index="${index}" data-committee-index="${committeeIndex}" value="${escapeAttr(committeeValue || '')}" placeholder="Комитет">
                <button class="committee-clear" data-meetings-clear-committee="${index}" data-committee-index="${committeeIndex}" type="button" title="Очистить">×</button>
                ${committeeIndex > 0 ? `<button class="committee-remove" data-meetings-remove-committee="${index}" data-committee-index="${committeeIndex}" type="button" title="Удалить строку">−</button>` : ''}
              </div>`).join('')}
            </div>
          </div>` : ''}
          ${agendaMode ? `<input data-meetings-task-index="${index}" data-meetings-task-field="committee" value="${escapeAttr(row.committee || '')}" readonly placeholder="ФИО участника">` : ''}
          <input data-meetings-task-index="${index}" data-meetings-task-field="task" value="${escapeAttr(row.task || '')}" ${agendaMode ? 'readonly' : ''} placeholder="${protocolMode ? 'Поручение' : 'Должность'}">
          <input data-meetings-task-index="${index}" data-meetings-task-field="date" ${agendaMode ? 'maxlength="3"' : 'data-meetings-date maxlength="10"'} value="${escapeAttr(row.date || '')}" placeholder="${agendaMode ? '№' : 'ДД.ММ.ГГГГ'}">
          <label><input type="checkbox" data-meetings-task-index="${index}" data-meetings-task-field="done" ${row.done ? 'checked' : ''} ${agendaMode ? 'disabled' : ''}></label>
        </div>
      `;
    }).join('')}
  `;
}

function looksLikeAgendaParticipantRow(row = {}) {
  const numberOnly = /^\d{1,3}$/.test(String(row.date || '').trim());
  const committeeText = String(row.committee || '').trim();
  const taskText = String(row.task || '').trim();

  // В повестке строки выглядят как: ФИО / должность / № вопроса / признак приглашенного.
  // В протоколе поле "Комитет" должно содержать значение из справочника комитетов,
  // а не ФИО участника.
  return Boolean(
    numberOnly &&
    committeeText &&
    taskText &&
    !normalizeText(committeeText).includes('комитет') &&
    /[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+/.test(committeeText)
  );
}

function refreshAgendaParticipantRows(shouldRender = true) {
  if (state.docType !== 'agenda') return;

  const oldByKey = new Map();
  for (const row of state.taskRows || []) {
    const key = `${normalizeText(row.committee)}|${normalizeText(row.task)}|${row.done ? 'invited' : 'local'}`;
    oldByKey.set(key, row);
  }

  const local = getPersonRecordsByNames('msu_ip', [...state.selectedPeople.msu_ip]).map(person => ({
    committee: person.full_name,
    task: person.position || '',
    date: oldByKey.get(`${normalizeText(person.full_name)}|${normalizeText(person.position || '')}|local`)?.date || '1',
    done: false
  }));

  const invited = getPersonRecordsByNames('invited_ip', [...state.selectedPeople.invited_ip]).map(person => ({
    committee: person.full_name,
    task: person.position || '',
    date: oldByKey.get(`${normalizeText(person.full_name)}|${normalizeText(person.position || '')}|invited`)?.date || '1',
    done: true
  }));

  const nextRows = local.concat(invited);
  state.taskRows = nextRows.length ? nextRows : [{ committee: '', task: '', date: '1', done: false }];

  if (shouldRender) renderTaskRows();
}

function normalizeCommitteeList(row = {}) {
  if (Array.isArray(row.committees)) {
    const values = row.committees.map(value => String(value || ''));
    return values.length ? values : [''];
  }

  const raw = String(row.committee || '');
  if (raw.includes('§§')) return raw.split('§§').map(value => value.trim()).filter(Boolean).concat(['']).slice(0, raw.split('§§').filter(Boolean).length || 1);
  if (raw.includes('\n')) return raw.split('\n').map(value => value.trim()).filter(Boolean).concat(['']).slice(0, raw.split('\n').filter(Boolean).length || 1);
  return [raw];
}

function syncProtocolReportState() {
  const form = document.querySelector('[data-meetings-form]');
  const enabled = Boolean(form?.elements.protocol_report_enabled?.checked);
  const text = form?.elements.protocol_report_text;
  if (text) {
    text.readOnly = !enabled;
    text.classList.toggle('disabled-report-input', !enabled);
  }
}


function setDocType(type) {
  const previousDocType = state.docType;
  state.docType = type || 'participants';
  const form = document.querySelector('[data-meetings-form]');
  const editor = document.querySelector('[data-meetings-editor]');
  if (form?.elements.attachment_type) form.elements.attachment_type.value = state.docType;
  if (editor) editor.dataset.docType = state.docType;

  document.querySelectorAll('[data-meetings-doc-type]').forEach(button => {
    const selected = button.dataset.meetingsDocType === state.docType;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const participants = state.docType === 'participants';
  const agenda = state.docType === 'agenda';
  const telegram = state.docType === 'telegram';
  const protocol = state.docType === 'protocol';
  const documents = state.docType === 'documents';

  document.querySelectorAll('[data-meetings-telegram-field]').forEach(node => node.hidden = !telegram);
  document.querySelectorAll('[data-meetings-protocol-field]').forEach(node => node.hidden = !protocol);
  document.querySelectorAll('[data-meetings-agenda-sign]').forEach(node => node.hidden = !agenda);
  document.querySelectorAll('[data-meetings-keeper-field]').forEach(node => node.hidden = !participants);

  const chairPosition = form?.elements.protocol_chair_position?.closest('[data-meetings-protocol-field]');
  if (chairPosition) chairPosition.hidden = true;

  const agendaPanel = document.querySelector('[data-meetings-agenda-panel]');
  const agendaRows = document.querySelector('[data-meetings-agenda-rows]');
  const agendaTools = agendaRows?.nextElementSibling;
  const sidePanel = document.querySelector('[data-meetings-side-panel]');
  const taskRows = document.querySelector('[data-meetings-task-rows]');
  const taskTools = taskRows?.nextElementSibling;
  const reportRow = document.querySelector('.meetings-report-row[data-meetings-protocol-field]');
  const peopleSelectors = document.querySelector('[data-meetings-people-selectors]');
  const peopleCounters = document.querySelector('[data-meetings-people-counters]');
  const selectedList = document.querySelector('[data-meetings-selected-list]');
  const documentsPanel = document.querySelector('[data-meetings-documents-panel]');
  const telegramPanel = document.querySelector('[data-meetings-telegram-panel]');

  if (peopleSelectors) peopleSelectors.hidden = !participants;
  if (peopleCounters) peopleCounters.hidden = !participants;
  document.querySelectorAll('[data-meetings-people-panel]').forEach(panel => panel.hidden = true);
  if (selectedList) selectedList.hidden = !participants;
  if (documentsPanel) documentsPanel.hidden = !documents;
  if (telegramPanel) telegramPanel.hidden = !telegram;

  if (agendaPanel) agendaPanel.hidden = !agenda;
  if (agendaTools) agendaTools.hidden = !agenda;

  if (sidePanel) sidePanel.hidden = telegram || documents;
  if (taskRows) taskRows.hidden = !(agenda || protocol);
  if (taskTools) taskTools.hidden = !(agenda || protocol);
  if (reportRow) reportRow.hidden = !protocol;

  document.querySelector('[data-meetings-agenda-title]')?.replaceChildren(document.createTextNode('Вопросы'));
  document.querySelector('[data-meetings-tasks-title]')?.replaceChildren(document.createTextNode(
    participants ? 'Участники совещания' :
    agenda ? 'Выбранные участники совещания' :
    protocol ? 'Поручения' :
    documents ? 'Документы' : ''
  ));

  const keeperLabel = form?.elements.protocol_keeper?.closest('label')?.querySelector('span');
  if (keeperLabel) keeperLabel.textContent = 'Протокол ведет';
  const transferLabel = form?.elements.transfer_fio?.closest('label')?.querySelector('span');
  if (transferLabel) transferLabel.textContent = 'Передала';
  const chairLabel = form?.elements.protocol_chair_fio?.closest('label')?.querySelector('span');
  if (chairLabel) chairLabel.textContent = 'Председательствующий';

  updateMeetingSectionHeading();
  updateMeetingsBreadcrumb();

  if (protocol && !state.isFilling && !form?.elements.id?.value) {
    state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];
  }
  if (protocol) ensurePeopleLoaded('msu_ip').then(updateProtocolCommitteeDatalist).catch(() => {});
  if (agenda) refreshAgendaParticipantRows(false);
  syncProtocolReportState();
  renderTaskRows();
  renderSelectedNames();
}

function updateMeetingsBreadcrumb(forcedText = '') {
  const parent = document.querySelector('[data-meetings-breadcrumb-parent]');
  const current = document.querySelector('[data-meetings-breadcrumb-current]');
  if (!current) return;

  if (parent) {
    parent.textContent = state.flow === 'archive' ? 'Архив совещаний' : 'Новое совещание';
  }

  if (forcedText) {
    current.textContent = forcedText;
    return;
  }

  const form = document.querySelector('[data-meetings-form]');
  const isEditing = Boolean(form?.elements.id?.value);
  if (!isEditing && state.flow === 'new-meeting') {
    current.textContent = getDocTypeTitle(state.docType);
    return;
  }

  current.textContent = isEditing ? `Редактирование: ${getDocTypeTitle(state.docType)}` : 'Выбор типа документа';
}

function updateMeetingSectionHeading() {
  const form = document.querySelector('[data-meetings-form]');
  const title = document.querySelector('[data-meetings-editor-title]');
  const hint = document.querySelector('[data-meetings-current-id]');
  const id = form?.elements.id?.value;
  const description = getDocTypeDescription(state.docType);

  if (title) title.textContent = getDocTypeTitle(state.docType);
  if (hint) hint.textContent = id ? `ID ${id} · ${description}` : description;
}

async function saveMeeting(form) {
  const data = formToData(form);

  if (!data.title || !data.date_val || !data.time_val) {
    alert("Заполните 'По вопросу', дату и время.");
    return;
  }

  syncPeopleHiddenFields();
  data.participants = form.querySelector('input[name="participants"]')?.value || '';
  data.invited_participants = form.querySelector('input[name="invited_participants"]')?.value || '';
  data.agenda = state.agendaRows.map(item => String(item || '').trim()).filter(Boolean).join('\n');
  cleanProtocolTaskRows();
  data.protocol = serializeTasks();
  data.has_participants_list = state.docType === 'participants' ? 1 : 0;
  data.has_telegram = state.docType === 'telegram' ? 1 : 0;

  try {
    let saved;
    if (data.id) {
      saved = await dbApi.updateMeeting(data.id, data);
      state.selectedId = saved.id || data.id;
      showNotification('Совещание обновлено');
    } else {
      saved = await dbApi.createMeeting(data);
      state.selectedId = saved.id;
      showNotification('Совещание добавлено');
    }

    const added = await transferUncheckedTasksToCalendar(saved.id || state.selectedId, data);
    if (added) showNotification(`В календарь перенесено поручений: ${added}`);

    await loadMeetings();
    const row = getSelected();
    if (row) fillForm(row);
    openEditor();
    updateMeetingsBreadcrumb();
  } catch (error) {
    alert('Не удалось сохранить совещание:\n' + error.message);
  }
}

function formToData(form) {
  const data = {};

  for (const el of Array.from(form.elements)) {
    if (!el.name) continue;
    if (el.disabled) continue;
    if (el.name === 'participants' || el.name === 'invited_participants') continue;
    if (['button', 'submit', 'reset', 'file'].includes(el.type)) continue;

    if (el.type === 'checkbox') {
      data[el.name] = el.checked ? 1 : 0;
      continue;
    }

    data[el.name] = String(el.value ?? '').trim();
  }

  return data;
}

function cleanProtocolTaskRows() {
  if (state.docType !== 'protocol') return;

  state.taskRows = (state.taskRows || []).filter(row => !looksLikeAgendaParticipantRow(row));

  if (!state.taskRows.length) {
    state.taskRows = [{ committee: '', committees: [''], task: '', date: '', done: false }];
  }
}

function serializeTasks() {
  const rows = [];
  state.taskRows.forEach((row, index) => {
    const committeeList = normalizeCommitteeList(row).map(value => String(value || '').trim()).filter(Boolean);
    const committee = committeeList.join('§§');
    const task = String(row.task || '').trim();
    const date = String(row.date || '').trim();
    const done = row.done ? '☑' : '☐';
    if (!committee && !task && !date) return;
    if (committee) rows.push(`${index + 1}. ${committee} | ${task} | ${date} | ${done}`);
    else rows.push(`${index + 1}. ${task} | ${date} | ${done}`);
  });

  const form = document.querySelector('[data-meetings-form]');
  if (form?.elements.protocol_report_enabled?.checked) {
    rows.push(`__REPORT__ | ${form.elements.protocol_report_text.value.trim()} | ${form.elements.protocol_report_date.value.trim()} | ☑`);
  }

  return rows.join('\n');
}

function parseAgenda(text) {
  const rows = String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
  return rows.length ? rows : [''];
}

function parseProtocolTasks(text) {
  const rows = [];
  const form = document.querySelector('[data-meetings-form]');

  String(text || '').split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    if (line.startsWith('__REPORT__')) {
      const parts = line.split('|').map(part => part.trim());
      if (form) {
        if (form.elements.protocol_report_enabled) form.elements.protocol_report_enabled.checked = true;
        if (form.elements.protocol_report_text) form.elements.protocol_report_text.value = parts[1] || DEFAULTS.protocol_report_text;
        if (form.elements.protocol_report_date) form.elements.protocol_report_date.value = parts[2] || '';
      }
      return;
    }

    let clean = line;
    if (clean.includes('. ')) clean = clean.split('. ', 2)[1];
    const parts = clean.split('|').map(part => part.trim());

    if (parts.length >= 4) { const committees = parts[0].split('§§').map(value => value.trim()).filter(Boolean); rows.push({ committee: committees.join('§§'), committees: committees.length ? committees : [''], task: parts[1], date: parts[2], done: parts[3].includes('☑') }); }
    else rows.push({ committee: '', committees: [''], task: parts[0] || '', date: parts[1] || '', done: (parts[2] || '').includes('☑') });
  });

  return rows.length ? rows : [{ committee: '', committees: [''], task: '', date: '', done: false }];
}

async function transferUncheckedTasksToCalendar(meetingId, meetingData) {
  let count = 0;
  for (const row of state.taskRows) {
    const taskText = String(row.task || '').trim();
    if (!taskText || row.done) continue;
    const date = ruDateToIso(row.date);
    if (!date) continue;

    try {
      await dbApi.createCalendarTask({
        date,
        user: getCurrentUserName(),
        type: 'поручение',
        desc: `Поручение из совещания по вопросу ${meetingData.title}`,
        time: meetingData.time_val || '',
        court: '',
        subject: meetingData.title || '',
        assignment: taskText,
        meeting_id: meetingId,
        done: 0
      });
      count += 1;
    } catch (error) {
      console.warn('meeting calendar sync error', error);
    }
  }
  return count;
}

async function deleteSelected() {
  const row = getSelected();
  if (!row) { alert('Выберите совещание.'); return; }
  if (!confirm('Удалить выбранное совещание?')) return;

  try {
    await dbApi.deleteMeeting(row.id);
    showNotification('Совещание удалено');
    clearForm(false);
    await loadMeetings();
  } catch (error) {
    alert('Не удалось удалить совещание:\n' + error.message);
  }
}

/* ===== Участники: иерархия, раскрытие, выбор ===== */

async function togglePeoplePanel(category) {
  const panel = document.querySelector(`[data-meetings-people-panel="${category}"]`);
  if (!panel) return;
  const open = panel.hidden;
  setPeoplePanelOpen(category, open);
  if (open) await ensurePeopleLoaded(category);
}

function setPeoplePanelOpen(category, open) {
  const panel = document.querySelector(`[data-meetings-people-panel="${category}"]`);
  if (panel) panel.hidden = !open;
}

async function ensurePeopleLoaded(category) {
  if (state.peopleLoaded[category]) {
    renderPeopleTree(category);
    return;
  }

  const box = document.querySelector(`[data-meetings-people-tree="${category}"]`);
  if (box) box.innerHTML = '<div class="muted">Загрузка...</div>';

  try {
    const rows = await dbApi.getMeetingParticipants(category);
    state.people[category] = rows.map(normalizePerson).filter(person => person.full_name);
    state.peopleLoaded[category] = true;
    initDefaultExpanded(category);
    updateProtocolCommitteeDatalist();
    renderPeopleTree(category);
  } catch (error) {
    if (box) box.innerHTML = `<div class="empty-cell error">Не удалось загрузить список: ${escapeHtml(error.message)}</div>`;
  }
}

function normalizePerson(row = {}) {
  return {
    id: String(row.id ?? row.full_name ?? Math.random()),
    category: row.category || '',
    full_name: String(row.full_name || row.fio || row.name || '').trim(),
    position: String(row.position || row.dolzhnost || row.job_title || '').trim(),
    leadership: String(row.leadership || row.rukovodstvo || row.supervisor || row.boss || '').trim(),
    sort_order: Number(row.sort_order ?? 999)
  };
}



function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function extractCommitteeDirection(position) {
  const raw = String(position || '').trim();
  const norm = normalizeText(raw);

  if (!norm.includes('председатель') || !norm.includes('комитет')) return '';

  for (const marker of ['комитета', 'комитет']) {
    const index = norm.indexOf(marker);
    if (index === -1) continue;

    let direction = raw.slice(index + marker.length).trim().replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '');

    if (direction) {
      if (!normalizeText(direction).startsWith('по ')) direction = `по ${direction}`;
      return direction;
    }

    return 'по общим вопросам';
  }

  return '';
}

function updateProtocolCommitteeDatalist() {
  const list = document.querySelector('#meetingsCommitteesList');
  if (!list) return;

  const values = new Set();
  for (const person of state.people.msu_ip || []) {
    const direction = extractCommitteeDirection(person.position || '');
    if (!direction) continue;
    const fio = toSurnameInitials(person.full_name || '');
    values.add(fio ? `${direction} (${fio})` : direction);
  }

  if (!values.size) {
    ['по делам молодежи', 'по жилищно-коммунальному хозяйству', 'по дорожному хозяйству и транспорту', 'по образованию', 'по социальным вопросам'].forEach(v => values.add(v));
  }

  list.innerHTML = [...values].sort((a, b) => a.localeCompare(b, 'ru')).map(value => `<option value="${escapeAttr(value)}"></option>`).join('');
}


function initDefaultExpanded(category) {
  const hierarchy = buildPeopleHierarchy(state.people[category]);
  state.expandedPeople[category] = new Set(hierarchy.roots.map(person => person.id));
}

function renderPeopleTree(category) {
  const box = document.querySelector(`[data-meetings-people-tree="${category}"]`);
  if (!box || !state.peopleLoaded[category]) return;

  const hierarchy = buildPeopleHierarchy(state.people[category]);
  if (!hierarchy.roots.length) {
    box.innerHTML = '<div class="muted">Список пуст</div>';
    return;
  }

  box.innerHTML = hierarchy.roots.map(person => renderPersonNode(category, person, hierarchy, 0)).join('');
}

function buildPeopleHierarchy(people) {
  const byLeadership = new Map();
  const byId = new Map();

  const sorted = [...people].sort((a, b) => (a.sort_order - b.sort_order) || normalizeText(a.position).localeCompare(normalizeText(b.position), 'ru') || normalizeText(a.full_name).localeCompare(normalizeText(b.full_name), 'ru'));

  for (const person of sorted) {
    byId.set(person.id, person);
    const key = normalizeText(person.leadership);
    if (key) {
      if (!byLeadership.has(key)) byLeadership.set(key, []);
      byLeadership.get(key).push(person);
    }
  }

  const hasParent = new Set();
  const childrenById = new Map();

  for (const parent of sorted) {
    const keys = [normalizeText(parent.position), normalizeText(parent.full_name)].filter(Boolean);
    const children = [];
    for (const key of keys) {
      for (const child of byLeadership.get(key) || []) {
        if (child.id !== parent.id && !children.some(item => item.id === child.id)) {
          children.push(child);
          hasParent.add(child.id);
        }
      }
    }
    if (children.length) childrenById.set(parent.id, children);
  }

  const roots = sorted.filter(person => !hasParent.has(person.id));
  return { roots, childrenById, byId };
}

function renderPersonNode(category, person, hierarchy, level) {
  const children = hierarchy.childrenById.get(person.id) || [];
  const expanded = state.expandedPeople[category].has(person.id);
  const checked = state.selectedPeople[category].has(person.full_name);
  const isHeader = children.length > 0 || level === 0;
  const rowClass = isHeader ? 'person-header' : 'person-child';
  const arrow = children.length ? (expanded ? '▾' : '▸') : '';

  return `
    <div class="meetings-person-node level-${Math.min(level, 5)}">
      <div class="meetings-person-row ${rowClass}">
        <button class="meetings-person-arrow" data-meetings-people-section-toggle type="button" data-category="${category}" data-key="${escapeAttr(person.id)}" ${children.length ? '' : 'disabled'}>${arrow}</button>
        <label class="meetings-person-label">
          <input type="checkbox" data-meetings-person-check data-category="${category}" data-name="${escapeAttr(person.full_name)}" ${checked ? 'checked' : ''}>
          <span>${escapeHtml(person.full_name)}${person.position ? ` <em>— ${escapeHtml(person.position)}</em>` : ''}</span>
        </label>
      </div>
      ${children.length && expanded ? `<div class="meetings-person-children">${children.map(child => renderPersonNode(category, child, hierarchy, level + 1)).join('')}</div>` : ''}
    </div>
  `;
}

function togglePeopleSection(category, personId) {
  const set = state.expandedPeople[category];
  if (set.has(personId)) set.delete(personId);
  else set.add(personId);
  renderPeopleTree(category);
}

function syncPeopleHiddenFields() {
  const form = document.querySelector('[data-meetings-form]');
  if (!form) return;
  const participantsInput = form.querySelector('input[name="participants"]');
  const invitedInput = form.querySelector('input[name="invited_participants"]');
  if (participantsInput) participantsInput.value = [...state.selectedPeople.msu_ip].join('\n');
  if (invitedInput) invitedInput.value = [...state.selectedPeople.invited_ip].join('\n');
  renderSelectedNames();
}

function renderSelectedCounters() {
  document.querySelector('[data-meetings-selected-count="msu_ip"]')?.replaceChildren(document.createTextNode(String(state.selectedPeople.msu_ip.size)));
  document.querySelector('[data-meetings-selected-count="invited_ip"]')?.replaceChildren(document.createTextNode(String(state.selectedPeople.invited_ip.size)));
  renderSelectedNames();
}

function renderSelectedNames() {
  const node = document.querySelector('[data-meetings-selected-names]');
  if (!node) return;
  const names = [...state.selectedPeople.msu_ip, ...state.selectedPeople.invited_ip];
  node.innerHTML = names.length ? names.map(name => `<span>${escapeHtml(name)}</span>`).join('') : 'Список пока пуст';
}

function getPersonRecordsByNames(category, names) {
  const wanted = new Set(names);
  const records = state.people[category] || [];
  const found = [];
  for (const name of names) {
    const rec = records.find(person => person.full_name === name);
    found.push(rec || { full_name: name, position: '' });
  }
  return found.filter(person => wanted.has(person.full_name));
}

function sortPeopleForDocuments(people = []) {
  return [...people].sort((a, b) =>
    documentPositionRank(a) - documentPositionRank(b)
    || getPersonLastName(a).localeCompare(getPersonLastName(b), 'ru')
    || normalizeText(a.full_name).localeCompare(normalizeText(b.full_name), 'ru')
    || Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999)
  );
}

function documentPositionRank(person = {}) {
  const position = normalizeText(person.position);

  if (position.includes('первый заместитель главы администрации города')) return 1;
  if (position.includes('заместитель главы администрации города') && !position.includes('первый заместитель') && !position.includes('район')) return 2;
  if (position.includes('глава администрации') && position.includes('район') && !position.includes('заместитель')) return 3;
  if (position.includes('заместитель') && position.includes('глава администрации') && position.includes('район')) return 4;
  if (position.includes('председатель комитета') && !position.includes('заместитель')) return 5;
  if ((position.includes('начальник управления') || position.includes('начальник департамента') || position.includes('руководитель аппарата')) && !position.includes('заместитель')) return 6;
  if (position.includes('заместитель председателя') && position.includes('комитет')) return 7;
  if (position.includes('заместитель') && (position.includes('начальник управления') || position.includes('начальник департамента'))) return 8;
  if (position.includes('начальник отдела') || position.includes('заведующий отделом')) return 9;
  if (position.includes('главный специалист')) return 10;
  return 99;
}

function getPersonLastName(person = {}) {
  return normalizeText(String(person.full_name || '').trim().split(/\s+/)[0] || '');
}

function sortPeopleAlphabetically(people = []) {
  return [...people].sort((a, b) =>
    getPersonLastName(a).localeCompare(getPersonLastName(b), 'ru')
    || normalizeText(a.full_name).localeCompare(normalizeText(b.full_name), 'ru')
    || Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999)
  );
}

/* ===== Документы ===== */

async function generateSelectedDocument() {
  try {
    await Promise.all([ensurePeopleLoaded('msu_ip'), ensurePeopleLoaded('invited_ip')]);

    const form = document.querySelector('[data-meetings-form]');
    if (!form) return;
    const data = formToData(form);
    syncPeopleHiddenFields();
    data.participants = form.querySelector('input[name="participants"]')?.value || '';
    data.invited_participants = form.querySelector('input[name="invited_participants"]')?.value || '';
    data.agenda = state.agendaRows.map(item => String(item || '').trim()).filter(Boolean).join('\n');
    cleanProtocolTaskRows();
    data.protocol = serializeTasks();

    if (!data.title || !data.date_val || !data.time_val) {
      alert("Заполните 'По вопросу', дату и время.");
      return;
    }

    if (state.docType === 'participants') return exportParticipantsDoc(data);
    if (state.docType === 'agenda') return exportAgendaDoc(data);
    if (state.docType === 'telegram') return exportTelegramDoc(data);
    if (state.docType === 'protocol') return exportProtocolDoc(data);
  } catch (error) {
    console.error('meeting document generation error', error);
    alert('Не удалось сформировать документ:\n' + (error?.message || error));
  }
}

function exportParticipantsDoc(data) {
  const invited = sortPeopleAlphabetically(getPersonRecordsByNames('invited_ip', splitLines(data.invited_participants)));
  const local = sortPeopleForDocuments(getPersonRecordsByNames('msu_ip', splitLines(data.participants)));
  const peopleRows = [];

  if (invited.length) {
    peopleRows.push({ section: 'Приглашенные:' });
    for (const person of invited) peopleRows.push({ person });
  }
  if (local.length) {
    peopleRows.push({ section: 'Органы местного самоуправления:' });
    for (const person of local) peopleRows.push({ person });
  }

  const keeperName = String(data.protocol_keeper || DEFAULTS.protocol_keeper || '').trim();
  if (keeperName) {
    peopleRows.push({ section: 'Протокол ведет:' });
    peopleRows.push({ person: { full_name: keeperName, position: 'главный специалист отдела судебной работы правового комитета' } });
  }

  let number = 1;
  const personIndexes = peopleRows.map((row, idx) => row.person ? idx : -1).filter(idx => idx >= 0);
  const lastPersonIndex = personIndexes[personIndexes.length - 1];
  const rows = peopleRows.map((row, idx) => row.section
    ? { section: row.section }
    : { number: number++, person: row.person, isLast: idx === lastPersonIndex });

  const blocks = [
    ooxmlP(['СПИСОК', `приглашенных на совещание по вопросу ${data.title || ''}`], { size: 14, align: 'center' }),
    ooxmlBlankP(1, 14),
    ooxmlP([data.date_val || '', `${data.time_val || ''} час.`, `ул. Гоголя, 48, каб. ${data.cabinet_number || '213'}`], { size: 14, indentLeftCm: 10 }),
    ooxmlBlankP(1, 14),
    ooxmlParticipantsTable(rows),
  ];

  downloadDocxXml(ooxmlDocument(blocks.join(''), 'participants'), `Список_${fileDate(data.date_val)}.docx`);
}

function participantRow(number, person, isLast = false) {
  return `<tr class="person-row ${isLast ? 'last-person' : ''}"><td class="num">${number}.</td><td class="fio-cell">${formatParticipantNameForList(person.full_name)}</td><td class="position-cell">${typography(lowerFirstLetter(person.position || ''))}</td></tr>`;
}

function formatParticipantName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return escapeHtml(parts[0]);

  return `
    <span class="participant-last-name">${escapeHtml(parts[0])}</span><br>
    <span class="participant-first-middle-name">${escapeHtml(parts.slice(1).join(' '))}</span>
  `;
}

function formatParticipantNameInline(fullName) {
  const text = String(fullName || '').trim();
  return text ? typography(text) : '—';
}

function formatParticipantNameForList(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '<p>—</p><p></p><p class="participant-empty-line"></p>';
  if (parts.length === 1) return `<p>${typography(parts[0])}</p><p></p><p class="participant-empty-line"></p>`;

  return `
    <p><span class="participant-last-name">${typography(parts[0])}</span></p>
    <p><span class="participant-first-middle-name">${typography(parts.slice(1).join(' '))}</span></p>
    <p class="participant-empty-line"></p>
  `;
}

function getAgendaSpeakerRows(local = [], invited = [], options = {}) {
  const rows = options.onlyAgendaParticipantRows
    ? state.taskRows.filter(row => looksLikeAgendaParticipantRow(row))
    : state.taskRows;
  const explicitRows = rows
    .map(row => ({
      fio: String(row.committee || '').trim(),
      full_name: String(row.committee || '').trim(),
      position: String(row.task || '').trim(),
      question: Number(String(row.date || '').replace(/\D/g, '')) || 1,
      source: row.done ? 'invited' : 'msu',
    }))
    .filter(row => row.fio || row.position);

  if (explicitRows.length) return explicitRows;

  return local
    .map(person => ({ ...person, fio: person.full_name, question: 1, source: 'msu' }))
    .concat(invited.map(person => ({ ...person, fio: person.full_name, question: 1, source: 'invited' })));
}

function isInvitedRole(row = {}) {
  return row.invited === true || row.source === 'invited' || row.source === 'invited_ip';
}

function personRoleLine(person = {}) {
  const fio = person.full_name || person.fio || '';
  const position = String(person.position || '').trim();
  const positionText = position ? `     -     ${position}` : '';
  return `${typography(fio)}${typography(positionText)}`;
}

function protocolRoleLine(person = {}) {
  const fio = person.full_name || person.fio || '';
  const position = String(person.position || '').trim();
  const shortFio = toSurnameInitials(fio);
  const positionText = position ? `${position} - ` : '';
  return `${typography(positionText)}${typography(shortFio)}`;
}

function protocolRolesParagraph(speakers = [], informers = []) {
  const people = speakers.concat(informers);
  if (!people.length) return '';
  const label = people.length > 1 ? 'Докладывают' : 'Докладывает';
  return `<p class="protocol-question-roles">${label}: ${people.map(protocolRoleLine).join(', ')}</p>`;
}

function meetingPlaceBlock(data) {
  return [
    typography(data.date_val),
    `${typography(data.time_val)}&nbsp;час.`,
    `ул.&nbsp;Гоголя, 48, каб.&nbsp;${typography(data.cabinet_number || '213')}`,
  ].join('<br>');
}

function exportAgendaDoc(data) {
  const questions = splitLines(data.agenda);
  const local = sortPeopleForDocuments(getPersonRecordsByNames('msu_ip', splitLines(data.participants)));
  const invited = sortPeopleAlphabetically(getPersonRecordsByNames('invited_ip', splitLines(data.invited_participants)));
  const sourceRows = getAgendaSpeakerRows(local, invited);

  const blocks = [
    ooxmlP([
      'УТВЕРЖДАЮ',
      'Заместитель главы администрации',
      'города, руководитель аппарата',
      '',
      `«___» ______________ ${getYearFromDate(data.date_val)} г.`,
    ], { size: 13, indentLeftCm: 10 }),
    ooxmlBlankP(2, 13),
    ooxmlP('ПОВЕСТКА', { size: 13, align: 'center' }),
    ooxmlP(`совещание по вопросу ${data.title || ''}`, { size: 13, align: 'center' }),
    ooxmlBlankP(2, 13),
    ooxmlP([
      data.date_val || '',
      `${data.time_val || ''} час.`,
      `ул. Гоголя, 48, каб. ${data.cabinet_number || '213'}`,
    ], { size: 13, indentLeftCm: 10.7 }),
    ooxmlBlankP(2, 13),
  ];

  for (const [index, question] of (questions.length ? questions : ['']).entries()) {
    const number = index + 1;
    const speakers = sourceRows.filter(row => row.question === number && !isInvitedRole(row));
    const informers = sourceRows.filter(row => row.question === number && isInvitedRole(row));
    blocks.push(ooxmlP(`${number}.  ${question}`, { size: 13, align: 'both', firstLineCm: 1 }));
    if (speakers.length) blocks.push(ooxmlAgendaPeopleTable(speakers.length === 1 ? 'Докладывает:' : 'Докладывают:', speakers));
    if (speakers.length && informers.length) blocks.push(ooxmlBlankP(1, 13));
    if (informers.length) blocks.push(ooxmlAgendaPeopleTable(informers.length === 1 ? 'Информирует:' : 'Информируют:', informers));
    blocks.push(ooxmlBlankP(1, 13));
  }

  blocks.push(ooxmlBlankP(1, 13), ooxmlAgendaSignatureTable(data));
  downloadDocxXml(ooxmlDocument(blocks.join(''), 'agenda'), `Повестка_${fileDate(data.date_val)}.docx`);
}

function agendaApproveBlock(data) {
  const year = getYearFromDate(data.date_val);
  return `
    <div class="approve-block">
      УТВЕРЖДАЮ<br>
      Заместитель главы администрации<br>
      города, руководитель аппарата<br><br>
      «___» ______________ ${year} г.
    </div>
  `;
}

function peopleInlineBlock(label, people) {
  return agendaPeopleTable([{ label, people }]);
}

function agendaRolesBlock(speakers = [], informers = []) {
  const blocks = [];

  if (speakers.length) {
    blocks.push(peopleInlineBlock(speakers.length > 1 ? 'Докладывают:' : 'Докладывает:', speakers));
  }

  if (speakers.length && informers.length) {
    blocks.push(agendaRoleSeparatorParagraph());
  }

  if (informers.length) {
    blocks.push(peopleInlineBlock(informers.length > 1 ? 'Информируют:' : 'Информирует:', informers));
  }

  return blocks.join('');
}

function agendaPeopleTable(rows = []) {
  return `
    <table class="agenda-people-table" width="654" style="width:17.3cm;table-layout:fixed;mso-table-layout-alt:fixed;mso-width-source:userset;">
      <col style="width:4.4cm;mso-width-source:userset;">
      <col style="width:12.9cm;mso-width-source:userset;">
      ${rows.map(row => agendaPeopleRow(row.label, row.people)).join('')}
    </table>
  `;
}

function agendaPeopleRow(label, people) {
  return `
    <tr>
      <td class="agenda-people-label" width="166" style="width:4.4cm;mso-width-source:userset;">${escapeHtml(label)}</td>
      <td class="agenda-people-values" width="488" style="width:12.9cm;mso-width-source:userset;">
        ${people.map(person => `<p>${personRoleLine(person)}</p>`).join('')}
      </td>
    </tr>
  `;
}

function agendaRoleSeparatorParagraph() {
  return '<p class="agenda-role-separator"></p>';
}

function agendaSignatureBlock(data) {
  const position = String(data.agenda_sign_position || DEFAULTS.agenda_sign_position || '').trim();
  const fio = String(data.agenda_sign_fio || DEFAULTS.agenda_sign_fio || '').trim();
  const words = position.split(/\s+/).filter(Boolean);
  const positionHtml = words.length > 3
    ? `${escapeHtml(words.slice(0, 2).join(' '))}<br>${escapeHtml(words.slice(2).join(' '))}`
    : escapeHtml(position);

  return `
    <table class="agenda-sign-table" width="654" style="width:17.3cm;table-layout:fixed;mso-table-layout-alt:fixed;mso-width-source:userset;">
      <col style="width:12.8cm;mso-width-source:userset;">
      <col style="width:4.5cm;mso-width-source:userset;">
      <tr>
        <td width="484" style="width:12.8cm;mso-width-source:userset;">${positionHtml}</td>
        <td width="170" style="width:4.5cm;mso-width-source:userset;">${escapeHtml(fio)}</td>
      </tr>
    </table>
  `;
}

function protocolParticipantsTable(people) {
  return `
    <table class="protocol-participants-table">
      ${people.map(person => `
        <tr>
          <td class="protocol-participant-name">${formatParticipantName(person.full_name)}</td>
          <td class="protocol-participant-position">${typography(person.position || '')}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function protocolTopicTable(title) {
  const widthCm = '8.2cm';
  const widthTwips = '4649';
  const fixedWidthStyle = `width:${widthCm};mso-width-source:userset;mso-width-alt:${widthTwips};`;

  return `
    <table class="protocol-topic-table" width="308" style="${fixedWidthStyle}table-layout:fixed;mso-table-layout-alt:fixed;">
      <col style="${fixedWidthStyle}">
      <tr>
        <td width="308" style="${fixedWidthStyle}">совещания по вопросу ${typography(title)}</td>
      </tr>
    </table>
  `;
}

function protocolEmptyParagraph() {
  return '<p class="protocol-empty-paragraph"></p>';
}

function exportTelegramDoc(data) {
  const invited = getPersonRecordsByNames('invited_ip', splitLines(data.invited_participants));
  const local = getPersonRecordsByNames('msu_ip', splitLines(data.participants));
  const groups = buildTelegramGroups(local, invited);
  const telegramGroups = groups.length ? groups : [];
  if (!telegramGroups.length) {
    alert('Выберите хотя бы одного участника для телефонограммы.');
    return;
  }
  const blocks = telegramGroups.map((group, index) => ooxmlTelegramPage(data, group, index > 0)).join('');
  downloadDocxXml(ooxmlDocument(blocks, 'telegram'), `Телефонограммы_${fileDate(data.date_val)}.docx`);
}

function buildTelegramGroups(local, invited) {
  const all = dedupeTelegramPeople(local.concat(invited));
  const groups = new Map();

  for (const person of all) {
    const resolution = resolveTelegramRecipient(person, all);
    const baseKey = telegramPersonKey(resolution.recipient);
    const key = resolution.kind === 'deputy'
      ? `${baseKey}|deputy:${telegramPersonKey(person)}`
      : baseKey;
    if (!key) {
      throw new Error(`Не удалось определить адресата телефонограммы для участника: ${person.full_name || person.position || 'без имени'}.`);
    }
    if (!groups.has(key)) {
      groups.set(key, {
        recipient: resolution.recipient,
        recipientSelected: false,
        kind: resolution.kind || 'standard',
        invitees: [],
      });
    }

    const group = groups.get(key);
    if (resolution.recipientIsSelectedPerson) {
      group.recipientSelected = true;
      continue;
    }

    if (!group.invitees.some(item => isSameTelegramPerson(item, person))) {
      group.invitees.push(person);
    }
  }

  return [...groups.values()].sort((a, b) =>
    telegramPersonSortText(a.recipient).localeCompare(telegramPersonSortText(b.recipient), 'ru')
  );
}

function resolveTelegramRecipient(person = {}, selectedPeople = []) {
  if (isMsuParticipant(person) && isDistrictHeadPosition(person.position)) {
    return {
      recipient: person,
      recipientIsSelectedPerson: true,
      kind: 'standard',
    };
  }

  if (isMsuParticipant(person) && isDistrictDeputyHeadPosition(person.position)) {
    return {
      recipient: findDistrictHeadForDeputy(person, selectedPeople),
      recipientIsSelectedPerson: false,
      kind: 'standard',
    };
  }

  if (isDeputyHeadPosition(person.position)) {
    return {
      recipient: person,
      recipientIsSelectedPerson: true,
      kind: 'standard',
    };
  }

  if (isDeputyPosition(person.position)) {
    const leader = findTelegramLeader(person, selectedPeople, { throwOnMissing: true });
    return {
      recipient: leader,
      recipientIsSelectedPerson: false,
      kind: 'deputy',
    };
  }

  const leader = findTelegramLeader(person, selectedPeople);
  return {
    recipient: leader || person,
    recipientIsSelectedPerson: !leader || isSameTelegramPerson(leader, person),
    kind: 'standard',
  };
}

function findTelegramLeader(person = {}, selectedPeople = [], options = {}) {
  const leadership = normalizeText(person.leadership);
  if (!leadership) return null;

  const people = dedupeTelegramPeople(selectedPeople
    .concat(state.people.msu_ip || [])
    .concat(state.people.invited_ip || []));
  const candidates = people.filter(candidate =>
    candidate.full_name &&
    !isSameTelegramPerson(candidate, person)
  );

  const matchers = [
    candidate => normalizeText(candidate.position) === leadership,
    candidate => normalizeText(candidate.full_name) === leadership,
    candidate => normalizeText(`${candidate.position} ${candidate.full_name}`) === leadership,
    candidate => normalizeText(`${candidate.full_name} ${candidate.position}`) === leadership,
  ];

  for (const matcher of matchers) {
    const matches = candidates.filter(matcher);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`Неоднозначный руководитель для участника ${person.full_name || person.position}: ${person.leadership}.`);
    }
  }

  if (options.throwOnMissing) {
    throw new Error(`Не найден руководитель для участника ${person.full_name || person.position}: ${person.leadership}.`);
  }
  return null;
}

function dedupeTelegramPeople(people = []) {
  const result = [];
  const seen = new Set();
  for (const person of people) {
    const key = telegramPersonKey(person);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(person);
  }
  return result;
}

function telegramPersonKey(person = {}) {
  const id = String(person.id || '').trim();
  if (id) return `id:${id}`;
  const name = normalizeText(person.full_name);
  const position = normalizeText(person.position);
  return name || position ? `${name}|${position}` : '';
}

function telegramPersonSortText(person = {}) {
  return `${normalizeText(person.full_name)} ${normalizeText(person.position)}`.trim();
}

function isSameTelegramPerson(a = {}, b = {}) {
  const aId = String(a.id || '').trim();
  const bId = String(b.id || '').trim();
  if (aId && bId) return aId === bId;
  return normalizeText(a.full_name) === normalizeText(b.full_name)
    && normalizeText(a.position) === normalizeText(b.position);
}

function isDeputyHeadPosition(position = '') {
  const text = normalizeText(position);
  return /(^|[^а-яе])(?:перв(?:ый|ого)\s+)?заместител[ьяюем]*\s+глав/.test(text);
}

function isDistrictHeadPosition(position = '') {
  const text = normalizeText(position);
  if (!text.includes('район')) return false;
  if (/(^|[^а-яе])(заместител|помощник|советник)([^а-яе]|$)/.test(text)) return false;
  return /(^|[^а-яе])глава\s+(?:администрации\s+)?[а-яе\s-]+район[а-яе]*([^а-яе]|$)/.test(text);
}

function isDistrictDeputyHeadPosition(position = '') {
  const text = normalizeText(position);
  return text.includes('район')
    && /(^|[^а-яе])заместител[ьяюем]*\s+глав[а-яе]*\s+(?:администрации\s+)?[а-яе\s-]+район[а-яе]*([^а-яе]|$)/.test(text);
}

function extractDistrictKey(personOrPosition = '') {
  const position = typeof personOrPosition === 'string'
    ? personOrPosition
    : personOrPosition.position || '';
  const text = normalizeText(position);
  const match = text.match(/глав[а-яе]*\s+(?:администрации\s+)?([а-яе\s-]+?район[а-яе]*)(?:[^а-яе]|$)/);
  if (!match) return '';
  return normalizeText(match[1])
    .replace(/район[а-яе]*/g, 'район')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDistrictHeadForDeputy(person = {}, selectedPeople = []) {
  const explicitLeader = findTelegramLeader(person, selectedPeople);
  if (explicitLeader && isDistrictHeadPosition(explicitLeader.position)) return explicitLeader;

  const districtKey = extractDistrictKey(person);
  if (!districtKey) {
    throw new Error(`Не удалось определить район для заместителя главы: ${person.full_name || person.position || 'без имени'}.`);
  }

  const people = dedupeTelegramPeople(selectedPeople
    .concat(state.people.msu_ip || [])
    .concat(state.people.invited_ip || []));
  const matches = people.filter(candidate =>
    candidate.full_name
    && !isSameTelegramPerson(candidate, person)
    && isDistrictHeadPosition(candidate.position)
    && extractDistrictKey(candidate) === districtKey
  );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Неоднозначный глава района для участника ${person.full_name || person.position}: ${districtKey}.`);
  }
  throw new Error(`Не найден глава района для участника ${person.full_name || person.position}: ${districtKey}.`);
}

function isDeputyPosition(position = '') {
  return /(^|[^а-яе])депутат([^а-яе]|$)/.test(normalizeText(position));
}

function isMsuParticipant(person = {}) {
  if (normalizeText(person.category) === 'msu_ip') return true;
  return (state.people.msu_ip || []).some(item => isSameTelegramPerson(item, person));
}

function buildTelegramAddressBlock(person = {}) {
  const position = String(person.position || '').trim();
  const fullName = String(person.full_name || '').trim();
  if (!position || !fullName) {
    throw new Error(`Неполные данные адресата телефонограммы: ${fullName || position || 'без данных'}.`);
  }

  return {
    position: upperFirstLetter(declinePositionDative(position)),
    name: toInitialsFirstDativeSurname(fullName),
    greetingName: toNamePatronymic(fullName) || toInitialsFirst(fullName),
    greetingWord: isFemalePerson(fullName) ? 'Уважаемая' : 'Уважаемый',
  };
}

function buildTelegramBodyParagraphs(data, group = {}) {
  const recipient = group.recipient || {};
  if (group.kind === 'deputy') {
    const deputy = normalizeTelegramInvitees(group.invitees, recipient).find(person => isDeputyPosition(person.position));
    if (!deputy) {
      throw new Error(`Не найден депутат для специальной телефонограммы адресату ${recipient.full_name || recipient.position || 'без имени'}.`);
    }
    return buildTelegramDeputyBodyParagraphs(data, deputy);
  }

  const invitees = normalizeTelegramInvitees(group.invitees, recipient);
  const meetingInfo = `совещании по вопросу ${data.title || ''}, которое состоится ${data.date_val || ''} в ${data.time_val || ''} час. по адресу: ул. Гоголя, 48, каб. ${data.cabinet_number || '213'}`;
  const firstParagraph = group.recipientSelected
    ? `Приглашаем Вас${invitees.length ? `, а также ${formatTelegramInviteesAccusative(invitees)},` : ''} принять участие в ${meetingInfo}.`
    : `Просим Вас направить ${formatTelegramInviteesAccusative(invitees)} принять участие в ${meetingInfo}.`;

  if (!group.recipientSelected && !invitees.length) {
    throw new Error(`Для адресата ${recipient.full_name || recipient.position || 'без имени'} не найдены направляемые участники.`);
  }

  const paragraphs = [
    firstParagraph,
    'В целях конструктивной работы просим быть готовыми к докладу согласно повестке.',
  ];
  if (!(group.recipientSelected && isMsuParticipant(recipient) && isDistrictHeadPosition(recipient.position))) {
    paragraphs.push(`Доклады просим направить на адрес электронной почты: ${data.transfer_email || DEFAULTS.transfer_email} в срок до ${previousDay(data.date_val)}.`);
  }
  return paragraphs;
}

function buildTelegramDeputyBodyParagraphs(data, recipient = {}) {
  const position = String(recipient.position || '').trim();
  const fullName = String(recipient.full_name || '').trim();
  validateTelegramDeputyData(data, recipient);

  return [
    `${data.date_val || ''} в ${data.time_val || ''} час. по адресу: ул. Гоголя, 48, кабинет ${data.cabinet_number || ''} состоится совещание по вопросу ${data.title || ''}.`,
    `Просим направить для участия ${lowerFirstLetter(declinePositionAccusative(position))} ${declineFioAccusative(fullName)}.`,
  ];
}

function validateTelegramDeputyData(data = {}, recipient = {}) {
  const missing = [];
  if (!String(data.date_val || '').trim()) missing.push('дата');
  if (!String(data.time_val || '').trim()) missing.push('время');
  if (!String(data.cabinet_number || '').trim()) missing.push('кабинет');
  if (!String(data.title || '').trim()) missing.push('вопрос совещания');
  if (!String(recipient.position || '').trim()) missing.push('должность депутата');
  if (!String(recipient.full_name || '').trim()) missing.push('ФИО депутата');
  if (missing.length) {
    throw new Error(`Нельзя сформировать депутатскую телефонограмму: не заполнены ${missing.join(', ')}.`);
  }
}

function normalizeTelegramInvitees(invitees = [], recipient = {}) {
  return dedupeTelegramPeople(invitees)
    .filter(person => !isSameTelegramPerson(person, recipient))
    .sort((a, b) => telegramPersonSortText(a).localeCompare(telegramPersonSortText(b), 'ru'));
}

function formatTelegramInviteesAccusative(invitees = []) {
  return invitees
    .map(person => {
      const position = person.position ? `${lowerFirstLetter(declinePositionAccusative(person.position))} ` : '';
      const fio = isMsuParticipant(person) && !isDeputyPosition(person.position)
        ? toAccusativeSurnameInitials(person.full_name)
        : declineFioAccusative(person.full_name);
      return `${position}${fio}`.trim();
    })
    .filter(Boolean)
    .join(', ');
}

function telegramPage(data, group, index, total, hasNext = false) {
  const person = group.recipient || { full_name: '', position: '' };
  const address = buildTelegramAddressBlock(person);
  const telegramNumber = formatTelegramNumber(data.telegram_number || DEFAULTS.telegram_number);
  const bodyParagraphs = buildTelegramBodyParagraphs(data, group).map(typography);

  const pageBreak = hasNext
    ? `<p class="word-page-break" style="page-break-before:always;mso-page-break-before:always;">&nbsp;</p>`
    : '';

  return `
    <table class="telegram-page-table ${hasNext ? 'telegram-page-break-after' : ''}" cellspacing="0" cellpadding="0">
      <tr>
        <td class="telegram-top-cell">
          <div class="telegram-top">Заместитель главы администрации города, руководитель<br>аппарата</div>
          <div class="telegram-double-line"><p class="telegram-line-thin">&nbsp;</p><p class="telegram-line-thick">&nbsp;</p></div>
          <div class="telegram-number">ТЕЛЕФОНОГРАММА ${typography(telegramNumber)} от __________</div>
        </td>
      </tr>
      <tr>
        <td class="telegram-recipient-cell">
          <div class="telegram-recipient">${typography(address.position)}<br>${typography(address.name)}</div>
        </td>
      </tr>
      <tr>
        <td class="telegram-content-cell">
          <p class="telegram-greeting">${address.greetingWord} ${typography(address.greetingName)}!</p>
          <div class="telegram-body">${bodyParagraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}</div>
          <div class="telegram-sign">${typography(data.telegram_sign_fio || DEFAULTS.telegram_sign_fio)}</div>
        </td>
      </tr>
      <tr>
        <td class="telegram-spacer-cell">&nbsp;</td>
      </tr>
      <tr>
        <td class="telegram-bottom-cell">
          Передала:<br>${typography(data.transfer_fio || DEFAULTS.transfer_fio)}${data.transfer_phone ? `<br>${typography(data.transfer_phone)}` : ''}
        </td>
      </tr>
    </table>
    ${pageBreak}
  `;
}

function formatTelegramNumber(value = '') {
  const text = String(value || '').trim();
  if (!text) return '№';
  return text.startsWith('№') ? text : `№ ${text}`;
}


function exportProtocolDoc(data) {
  const questions = splitLines(data.agenda);
  const protocolLocal = sortPeopleForDocuments(getPersonRecordsByNames('msu_ip', splitLines(data.participants)));
  const protocolInvited = sortPeopleAlphabetically(getPersonRecordsByNames('invited_ip', splitLines(data.invited_participants))).map(person => ({ ...person, source: 'invited' }));
  const protocolParticipants = protocolLocal.concat(protocolInvited);
  const sourceRows = getAgendaSpeakerRows(protocolLocal, protocolInvited, { onlyAgendaParticipantRows: true });
  const tasks = state.taskRows.filter(row => !looksLikeAgendaParticipantRow(row) && (row.task || row.committee || row.date || normalizeCommitteeList(row).some(Boolean)));
  const formReportEnabled = Number(data.protocol_report_enabled) === 1 || data.protocol_report_enabled === true;
  const reportTextBase = String(data.protocol_report_text || DEFAULTS.protocol_report_text).trim();
  const reportDate = String(data.protocol_report_date || '').trim();
  const report = formReportEnabled ? `${reportTextBase}${reportDate ? ' ' + reportDate : ''}` : '';
  const keeper = data.protocol_keeper || DEFAULTS.protocol_keeper;
  const chairInput = data.protocol_chair_fio || DEFAULTS.protocol_chair_fio;
  const chairText = toSurnameInitials(chairInput);
  const chairSignature = toInitialsFirst(chairInput);
  const keeperText = toSurnameInitials(keeper);
  const keeperSignature = toInitialsFirst(keeper);

  const taskText = tasks.map((task, index) => {
    const committees = normalizeCommitteeList(task).map(value => value.trim()).filter(Boolean);
    const committeePrefix = formatProtocolCommitteeAssignment(committees, task);
    const due = task.date ? ` в срок до ${task.date}` : '';
    const taskBody = String(task.task || '').trim();
    let fullText = '';

    if (committeePrefix) {
      fullText = committeePrefix;
      if (due) fullText += due;
      if (taskBody) fullText += ` ${taskBody}`;
    } else {
      fullText = taskBody;
      if (due) fullText += due;
    }

    if (!fullText.trim()) return '';
    return `<p class="protocol-decision">1.${index + 2}.&nbsp;${typography(ensurePeriod(fullText))}</p>`;
  }).filter(Boolean).join('');

  const reportLine = report.trim() ? `<p class="protocol-decision">1.${tasks.length + 2}.&nbsp;${typography(ensurePeriod(report))}</p>` : '';
  const blocks = [
    ooxmlP('АДМИНИСТРАЦИЯ ГОРОДА БАРНАУЛА', { size: 14, align: 'center' }),
    ooxmlBlankP(1, 14),
    ooxmlP('ПРОТОКОЛ', { size: 14, align: 'center' }),
    ooxmlBlankP(1, 14),
    ooxmlTable([
      [
        { widthCm: 9, paragraphs: [ooxmlP(data.date_val || '', { size: 14, align: 'left' })] },
        { widthCm: 9, paragraphs: [ooxmlP(`№${data.protocol_number || DEFAULTS.protocol_number}`, { size: 14, align: 'right' })] },
      ],
    ], { widthCm: 18, colsCm: [9, 9], align: 'left', borders: false }),
    ooxmlBlankP(1, 14),
    ooxmlTable([[{ widthCm: 8.2, paragraphs: [ooxmlP(`совещания по вопросу ${data.title || ''}`, { size: 14, align: 'both' })] }]], {
      widthCm: 8.2,
      colsCm: [8.2],
      align: 'left',
      borders: false,
    }),
    ooxmlBlankP(1, 14),
    ooxmlP(`Председательствующий - ${chairText}, ${DEFAULTS.protocol_chair_position}`, { size: 14, align: 'both' }),
    ooxmlP(`Протокол вела - ${keeperText}, главный специалист отдела судебной работы правового комитета`, { size: 14, align: 'both' }),
    ooxmlBlankP(1, 14),
    ooxmlP('Присутствовали:', { size: 14, align: 'left' }),
    protocolParticipants.length ? ooxmlProtocolParticipantsTable(protocolParticipants) : '',
    ooxmlBlankP(1, 14),
    ooxmlP('ПОВЕСТКА ДНЯ:', { size: 14, align: 'left' }),
  ];

  for (const [i, q] of (questions.length ? questions : ['']).entries()) {
    const number = i + 1;
    const speakers = sourceRows.filter(row => row.question === number && !isInvitedRole(row));
    const informers = sourceRows.filter(row => row.question === number && isInvitedRole(row));
    const people = speakers.concat(informers);
    blocks.push(ooxmlP(`${number}.\t${q}`, { size: 14, align: 'both' }));
    if (people.length) {
      blocks.push(ooxmlP(`${people.length > 1 ? 'Докладывают' : 'Докладывает'}: ${people.map(person => `${person.position || ''} - ${toSurnameInitials(person.full_name || person.fio || '')}`).join(', ')}`, { size: 14, align: 'both' }));
    }
  }

  blocks.push(
    ooxmlBlankP(1, 14),
    ooxmlP('Заслушав информацию,', { size: 14, align: 'both' }),
    ooxmlBlankP(1, 14),
    ooxmlP('1.\tРЕШИЛИ:', { size: 14, align: 'both' }),
    ooxmlP('1.1.\tИнформацию принять к сведению.', { size: 14, align: 'both' }),
  );

  for (const text of taskText.match(/<p class="protocol-decision">([\s\S]*?)<\/p>/g) || []) {
    blocks.push(ooxmlP(stripHtml(text).replaceAll('&nbsp;', '\t'), { size: 14, align: 'both' }));
  }
  if (reportLine) blocks.push(ooxmlP(stripHtml(reportLine).replaceAll('&nbsp;', '\t'), { size: 14, align: 'both' }));

  blocks.push(
    ooxmlBlankP(2, 14),
    ooxmlSignatureTable('Председательствующий', chairSignature),
    ooxmlBlankP(2, 14),
    ooxmlSignatureTable('Протокол вела', keeperSignature),
  );

  downloadDocxXml(ooxmlDocument(blocks.join(''), 'protocol'), `Протокол_${fileDate(data.date_val)}.docx`);
}

function fileDate(value) {
  const text = String(value || '').trim();
  return text
    ? text.replace(/[^\dа-яА-Яa-zA-Z]+/g, '_').replace(/^_+|_+$/g, '')
    : new Date().toISOString().slice(0, 10);
}

function getYearFromDate(value) {
  const match = String(value || '').match(/\b(\d{4})\b/);
  return match ? match[1] : String(new Date().getFullYear());
}

function downloadDocxXml(documentXml, filename) {
  const safeName = String(filename || 'document.docx').replace(/\.doc$/i, '.docx');
  const blob = createDocxPackageBlob(documentXml);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);

  showNotification(`Документ сформирован: ${safeName}`);
}

function createDocxPackageBlob(documentXml) {
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    'word/document.xml': documentXml,
  };

  return new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function ooxmlDocument(body, type = 'protocol') {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    ${ooxmlSectPr(type)}
  </w:body>
</w:document>`;
}

function ooxmlSectPr(type) {
  const margin = {
    participants: [2, 1, 2, 2],
    agenda: [2, 1, 2, 2],
    telegram: [2, 1, 2, 2],
    protocol: [2, 1, 2, 2],
  }[type] || [2, 1, 2, 2];
  const [top, right, bottom, left] = margin.map(cmToTwips);
  return `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
}

function ooxmlP(text = '', options = {}) {
  const parts = Array.isArray(text) ? text : String(text ?? '').split('\n');
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
  const left = options.indentLeftCm ? ` w:left="${cmToTwips(options.indentLeftCm)}"` : '';
  const firstLine = options.firstLineCm ? ` w:firstLine="${cmToTwips(options.firstLineCm)}"` : '';
  const indent = left || firstLine ? `<w:ind${left}${firstLine}/>` : '';
  const keep = `${options.keepNext ? '<w:keepNext/>' : ''}${options.keepLines ? '<w:keepLines/>' : ''}`;
  const frame = options.framePr || '';
  const spacing = '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
  return `<w:p><w:pPr>${keep}${spacing}${indent}${align}${frame}</w:pPr>${ooxmlRunLines(parts, options)}</w:p>`;
}

function ooxmlTelegramP(text = '', options = {}) {
  const parts = Array.isArray(text)
    ? text.map(part => telegramDocText(part))
    : telegramDocText(text).split('\n');
  return ooxmlP(parts, options);
}

function ooxmlBlankP(count = 1, size = 14) {
  return Array.from({ length: count }, () => ooxmlP('', { size })).join('');
}

function ooxmlTelegramDoubleLine() {
  return [
    ooxmlParagraphBottomBorder(18),
    ooxmlParagraphBottomBorder(6),
  ].join('');
}

function ooxmlParagraphBottomBorder(size) {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="24" w:lineRule="auto"/><w:pBdr><w:bottom w:val="single" w:sz="${size}" w:space="0" w:color="000000"/></w:pBdr></w:pPr></w:p>`;
}

function ooxmlTelegramTransferFrame(data = {}) {
  const lines = ['Передала:', data.transfer_fio || DEFAULTS.transfer_fio, data.transfer_phone || ''].filter(Boolean);
  return ooxmlTelegramP(lines, {
    size: 10,
    align: 'left',
    keepLines: true,
    framePr: '<w:framePr w:w="9000" w:h="900" w:x="1134" w:y="14350" w:hAnchor="page" w:vAnchor="page" w:wrap="none" w:hRule="atLeast"/>',
  });
}

function ooxmlRunLines(lines, options = {}) {
  const size = Math.round((options.size || 14) * 2);
  const bold = options.bold ? '<w:b/>' : '';
  const rPr = `<w:rPr><w:rFonts w:ascii="PT Astra Serif" w:hAnsi="PT Astra Serif" w:cs="PT Astra Serif"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold}</w:rPr>`;
  return lines.map((line, index) => `<w:r>${rPr}${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`).join('');
}

function ooxmlTable(rows, options = {}) {
  const width = cmToTwips(options.widthCm || 18);
  const cols = options.colsCm || [];
  const align = options.align || 'left';
  const borders = options.borders === false
    ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
    : '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>';
  const grid = cols.map(cm => `<w:gridCol w:w="${cmToTwips(cm)}"/>`).join('');
  const body = rows.map(row => `<w:tr>${row.map(cell => ooxmlCell(cell)).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:jc w:val="${align}"/><w:tblLayout w:type="fixed"/>${borders}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function ooxmlCell(cell = {}) {
  const width = cmToTwips(cell.widthCm || 1);
  const gridSpan = cell.gridSpan ? `<w:gridSpan w:val="${cell.gridSpan}"/>` : '';
  const vAlign = '<w:vAlign w:val="top"/>';
  const borders = cell.borders === false ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>' : '';
  const paragraphs = (cell.paragraphs || [ooxmlP(cell.text || '', { size: cell.size || 14, align: cell.align || 'left' })]).join('');
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${vAlign}${borders}</w:tcPr>${paragraphs}</w:tc>`;
}

function ooxmlAgendaPeopleTable(label, people) {
  const paragraphs = [];
  people.forEach((person, index) => {
    paragraphs.push(ooxmlP(`${person.full_name || person.fio || ''}     -     ${person.position || ''}`, { size: 13, align: 'both' }));
    if (index !== people.length - 1) paragraphs.push(ooxmlP('', { size: 13 }));
  });
  return ooxmlTable([
    [
      { widthCm: 4.4, paragraphs: [ooxmlP(label, { size: 13, align: 'left' })] },
      { widthCm: 12.9, paragraphs },
    ],
  ], { widthCm: 17.3, colsCm: [4.4, 12.9], align: 'center', borders: false });
}

function ooxmlAgendaSignatureTable(data) {
  const position = String(data.agenda_sign_position || DEFAULTS.agenda_sign_position || '').trim();
  const fio = String(data.agenda_sign_fio || DEFAULTS.agenda_sign_fio || '').trim();
  const words = position.split(/\s+/).filter(Boolean);
  const leftParagraphs = words.length > 3
    ? [ooxmlP(words.slice(0, 2).join(' '), { size: 13, align: 'left' }), ooxmlP(words.slice(2).join(' '), { size: 13, align: 'left' })]
    : [ooxmlP(position, { size: 13, align: 'left' })];
  const rightParagraphs = words.length > 3
    ? [ooxmlP('', { size: 13, align: 'right' }), ooxmlP(fio, { size: 13, align: 'right' })]
    : [ooxmlP(fio, { size: 13, align: 'right' })];
  return ooxmlTable([[{ widthCm: 12.8, paragraphs: leftParagraphs }, { widthCm: 4.5, paragraphs: rightParagraphs }]], {
    widthCm: 17.3,
    colsCm: [12.8, 4.5],
    align: 'center',
    borders: false,
  });
}

function ooxmlParticipantsTable(rows) {
  const tableRows = [
    [
      { widthCm: 1.8, paragraphs: [ooxmlP(['№', 'п/п'], { size: 14, align: 'center', bold: true })] },
      { widthCm: 6.9, paragraphs: [ooxmlP('ФИО', { size: 14, align: 'center', bold: true })] },
      { widthCm: 9.3, paragraphs: [ooxmlP('Должность', { size: 14, align: 'center', bold: true })] },
    ],
  ];

  for (const row of rows) {
    if (row.section) {
      tableRows.push([{ widthCm: 18, gridSpan: 3, paragraphs: [ooxmlP(row.section, { size: 14, align: 'left', bold: true })] }]);
      continue;
    }

    tableRows.push([
      { widthCm: 1.8, paragraphs: [ooxmlP(`${row.number}.`, { size: 14, align: 'center' })] },
      { widthCm: 6.9, paragraphs: [ooxmlP((row.person?.full_name || '').replace(/\s+/, '\n'), { size: 14, align: 'both' }), ooxmlP('', { size: 14 })] },
      { widthCm: 9.3, paragraphs: [ooxmlP(row.person?.position || '', { size: 14, align: 'both' }), ooxmlP('', { size: 14 })] },
    ]);
  }

  return ooxmlTable(tableRows, { widthCm: 18, colsCm: [1.8, 6.9, 9.3], align: 'left', borders: true });
}

function ooxmlProtocolParticipantsTable(people) {
  const rows = people.map(person => {
    const parts = String(person.full_name || '').trim().split(/\s+/).filter(Boolean);
    return [
      { widthCm: 6.8, paragraphs: [ooxmlP(parts[0] || '', { size: 14, align: 'left' }), ooxmlP(parts.slice(1).join(' '), { size: 14, align: 'left' }), ooxmlP('', { size: 14 })] },
      { widthCm: 11.2, paragraphs: [ooxmlP(person.position || '', { size: 14, align: 'left' })] },
    ];
  });
  return ooxmlTable(rows, { widthCm: 18, colsCm: [6.8, 11.2], align: 'left', borders: false });
}

function ooxmlSignatureTable(label, value) {
  return ooxmlTable([[{ widthCm: 11, paragraphs: [ooxmlP(label, { size: 14, align: 'left' })] }, { widthCm: 7, paragraphs: [ooxmlP(value, { size: 14, align: 'right' })] }]], {
    widthCm: 18,
    colsCm: [11, 7],
    align: 'left',
    borders: false,
  });
}

function ooxmlTelegramPage(data, group, pageBreak = false) {
  const person = group.recipient || { full_name: '', position: '' };
  const address = buildTelegramAddressBlock(person);
  const telegramNumber = formatTelegramNumber(data.telegram_number || DEFAULTS.telegram_number);
  const body = buildTelegramBodyParagraphs(data, group);
  return [
    pageBreak ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '',
    ooxmlTable([[{ widthCm: 16.8, paragraphs: [ooxmlTelegramP(['Заместитель главы администрации города, руководитель', 'аппарата'], { size: 14, bold: true, align: 'center' })] }]], { widthCm: 16.8, colsCm: [16.8], align: 'center', borders: false }),
    ooxmlTelegramDoubleLine(),
    ooxmlBlankP(1, 14),
    ooxmlTelegramP(`ТЕЛЕФОНОГРАММА ${telegramNumber} от __________`, { size: 14, bold: true, align: 'center' }),
    ooxmlBlankP(1, 14),
    ooxmlTable([
      [
        { widthCm: 10.5, paragraphs: [ooxmlP('', { size: 14 })] },
        { widthCm: 0.5, paragraphs: [ooxmlP('', { size: 14 })] },
        { widthCm: 6.2, paragraphs: [ooxmlP('', { size: 14 }), ooxmlTelegramP([address.position, address.name], { size: 14, align: 'left' }), ooxmlP('', { size: 14 }), ooxmlP('', { size: 14 })] },
      ],
      [
        { widthCm: 17.2, gridSpan: 3, paragraphs: [ooxmlTelegramP(`${address.greetingWord} ${address.greetingName}!`, { size: 14, align: 'center' }), ooxmlP('', { size: 14 })] },
      ],
    ], { widthCm: 17.2, colsCm: [10.5, 0.5, 6.2], align: 'center', borders: false }),
    body.map(text => ooxmlTelegramP(text, { size: 14, align: 'both', firstLineCm: 1.25 })).join(''),
    ooxmlBlankP(2, 14),
    ooxmlTelegramP(data.telegram_sign_fio || DEFAULTS.telegram_sign_fio, { size: 14, align: 'right' }),
    ooxmlTelegramTransferFrame(data),
  ].join('');
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function telegramDocText(value) {
  return protectTelegramEmails(String(value ?? '').replace(/\s+/g, ' ').trim())
    .replace(/(^|[\s(«"„])((?:в|во|на|по|к|ко|с|со|о|об|от|до|для|при|из|за|у|и|а|но|же|ли|бы|или))\s+/gi, `$1$2\u00A0`)
    .replace(/(^|[\s(«"„])(а)\s+(также)(?=$|[\s,.!?;:])/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(по)\s+(вопросу)(?=$|[\s,.!?;:])/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(в)\s+(срок)(?=$|[\s,.!?;:])/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(до)\s+(\d{1,2}\.\d{1,2}\.\d{4})/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(ул\.)\s+([А-ЯЁA-Z0-9][^\s,]*)/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(каб\.)\s+([0-9А-ЯЁA-Z-]+)/gi, `$1$2\u00A0$3`)
    .replace(/(^|[\s(«"„])(кабинет)\s+([0-9А-ЯЁA-Z-]+)/gi, `$1$2\u00A0$3`)
    .replace(/№\s+([0-9А-ЯЁA-Z/_-]+)/gi, `№\u00A0$1`)
    .replace(/([А-ЯЁ]\.)\s*([А-ЯЁ]\.)\s+([А-ЯЁ][а-яё-]+)/g, `$1$2\u00A0$3`)
    .replace(/([А-ЯЁ][а-яё-]+)\s+([А-ЯЁ]\.)\s*([А-ЯЁ]\.)/g, `$1\u00A0$2\u00A0$3`)
    .replace(/(\d{1,2}:\d{2})\s+(час\.?)/gi, `$1\u00A0$2`)
    .replace(/:\s+([^\s<]+)/g, `:\u00A0$1`);
}

function protectTelegramEmails(value) {
  return String(value || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, email =>
    email
      .replace(/-/g, '\u2011')
      .replace(/([.@])/g, `$1\u2060`)
  );
}

function cmToTwips(value) {
  return Math.round(Number(value || 0) * 567);
}

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = zipLocalHeader(nameBytes, data.length, crc);
    const centralHeader = zipCentralHeader(nameBytes, data.length, crc, offset);

    localParts.push(localHeader, nameBytes, data);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(Object.keys(files).length, centralSize, offset);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;

  for (const part of localParts.concat(centralParts, [end])) {
    result.set(part, cursor);
    cursor += part.length;
  }

  return result;
}

function zipLocalHeader(nameBytes, size, crc) {
  const bytes = new Uint8Array(30);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  return bytes;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  return bytes;
}

function zipEndRecord(count, centralSize, centralOffset) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return bytes;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function docShell(body, type) {
  const margins = {
    participants: '2cm 1cm 2cm 2cm',
    agenda: '2cm 1cm 2cm 2cm',
    telegram: '2cm 1cm 2cm 2cm',
    protocol: '2cm 1cm 2cm 2cm'
  }[type] || '2cm 1cm 2cm 2cm';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: ${margins}; }
    * { box-sizing: border-box; }
    body { font-family: "PT Astra Serif", "Times New Roman", serif; font-size: 14pt; line-height: 1.12; color: #000; }
    body.agenda { font-size: 13pt; }
    h1 { text-align: center; font-size: 14pt; margin: 0 0 18pt; line-height: 1.12; font-weight: normal; }
    p { margin: 0 0 10pt; text-align: justify; white-space: pre-wrap; }

    .participants-meta { margin-left: 10.2cm; margin-bottom: 22pt; line-height: 1.15; }
    .participants-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .participants-table th, .participants-table td { border: 1px solid #000; padding: 3pt 6pt; vertical-align: top; line-height: 1.1; }
    .participants-table th { text-align: center; font-weight: bold; }
    .participants-table .num { width: 1.8cm; text-align: center; }
    .participants-table th:nth-child(2), .participants-table td:nth-child(2) { width: 6.9cm; }
    .participants-table th:nth-child(3), .participants-table td:nth-child(3) { width: auto; }
    .participants-table tr.section td { font-weight: bold; padding: 2pt 6pt; }
    .participants-table .fio-cell p { margin: 0; text-align: justify; }
    .participants-table .position-cell { text-align: justify; }
    .participants-table .fio-cell { white-space: nowrap; }
    .participants-table tr.last-person .fio-cell p { margin-bottom: 0; }
    .participants-table .participant-empty-line { height: 10pt; line-height: 10pt; margin: 0; }
    .participants-title span { text-transform: uppercase; }
    .participant-last-name { white-space: nowrap; }
    .participant-first-middle-name { white-space: nowrap; }

    .approve-block { margin-left: 10cm; margin-bottom: 48pt; line-height: 1; }
    .agenda-title { text-align: center; margin-bottom: 28pt; font-weight: normal; }
    .agenda-title-main { display: block; font-weight: normal; }
    .agenda-title-sub { display: block; font-weight: normal; text-transform: none; }
    .agenda-place { margin-left: 10.7cm; margin-bottom: 26pt; line-height: 1; }
    .agenda-question { margin-top: 18pt; page-break-inside: avoid; }
    .agenda-question-text { text-indent: 0; margin-bottom: 8pt; }
    .agenda-people-table { width: 17.3cm; border-collapse: collapse; table-layout: fixed; margin: 0 0 4pt; }
    .agenda-people-table td { border: 0; padding: 0; vertical-align: top; line-height: 1.15; }
    .agenda-people-label { width: 4.4cm; text-align: left; }
    .agenda-people-values { width: 12.9cm; text-align: justify; }
    .agenda-people-values p { margin: 0; text-align: justify; }
    .agenda-role-separator { margin: 0; height: 14pt; line-height: 14pt; mso-line-height-rule: exactly; }
    .agenda-sign-table { width: 17.3cm; border-collapse: collapse; table-layout: fixed; mso-table-layout-alt: fixed; margin-top: 24pt; }
    .agenda-sign-table td { border: 0; padding: 0; vertical-align: top; }
    .agenda-sign-table td:first-child { width: 12.8cm; text-align: left; }
    .agenda-sign-table td:last-child { width: 4.5cm; text-align: right; }
    .agenda-sign-table td:last-child { text-align: right; }

    .word-page-break { page-break-before: always; mso-page-break-before: always; break-before: page; height: 0; line-height: 0; font-size: 1pt; margin: 0; }
    .telegram-page-table { width: 17.2cm; height: 25.7cm; min-height: 25.7cm; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    .telegram-page-break-after { page-break-after: always; mso-page-break-after: always; break-after: page; }
    .telegram-page-table td { border: 0; padding: 0; vertical-align: top; }
    .telegram-top-cell { height: 3.65cm; }
    .telegram-top { width: 16.8cm; text-align: center; font-weight: bold; margin: 0 auto 4pt; line-height: 1.12; }
    .telegram-double-line { width: 100%; margin: 0 0 18pt; padding: 0; }
    .telegram-double-line p { margin: 0; padding: 0; height: 0; font-size: 1pt; line-height: 0.1pt; mso-line-height-rule: exactly; }
    .telegram-line-thin { border-bottom: 0.75pt solid #000; mso-border-bottom-alt: solid #000 0.75pt; margin-bottom: 4pt !important; }
    .telegram-line-thick { border-bottom: 2.25pt solid #000; mso-border-bottom-alt: solid #000 2.25pt; }
    .telegram-number { text-align: center; font-weight: bold; margin-bottom: 0; }
    .telegram-recipient-cell { height: 3.25cm; }
    .telegram-recipient { margin-left: 11cm; width: 6.2cm; line-height: 1.15; }
    .telegram-content-cell { height: 8.6cm; }
    .telegram-greeting { text-align: center; margin: 0 0 22pt; }
    .telegram-body { text-align: justify; margin: 0 0 24pt; }
    .telegram-body p { text-indent: 1.25cm; text-align: justify; margin: 0 0 0 0; margin-bottom: 0; line-height: 1.15; }
    .telegram-sign { text-align: right; margin-top: 30pt; }
    .telegram-spacer-cell { height: 8.1cm; font-size: 1pt; line-height: 1pt; }
    .telegram-bottom-cell { height: 1.25cm; vertical-align: bottom !important; font-size: 12pt; line-height: 1.15; }

    .protocol-org, .protocol-title { text-align: center; text-transform: uppercase; margin-bottom: 18pt; }
    .protocol-title { margin-bottom: 24pt; }
    .protocol-meta { width: 18cm; border-collapse: collapse; margin: 0 0 20pt; table-layout: fixed; }
    .protocol-meta tr { width: 100%; }
    .protocol-meta td { border: 0; padding: 0; width: 9cm; }
    .protocol-meta td:first-child { text-align: left; }
    .protocol-meta td:last-child, .protocol-meta .protocol-number { text-align: right; white-space: nowrap; }
    .protocol-topic-table { width: 8.2cm; border-collapse: collapse; table-layout: fixed; mso-table-layout-alt: fixed; mso-width-source: userset; mso-width-alt: 4649; margin: 0 0 20pt; }
    .protocol-topic-table td { border: 0; padding: 0; width: 8.2cm; mso-width-source: userset; mso-width-alt: 4649; text-align: justify; }
    .protocol-participants-table { width: 18cm; border-collapse: collapse; table-layout: fixed; margin: 0 0 16pt; }
    .protocol-participants-table td { border: 0; padding: 0 0 7pt; vertical-align: top; line-height: 1.12; page-break-inside: avoid; }
    .protocol-participant-name { width: 6.8cm; text-align: left; }
    .protocol-participant-position { width: 11.2cm; text-align: left; }
    .protocol-heading { margin: 18pt 0 0; text-align: left; }
    .protocol-question-block { page-break-inside: avoid; }
    .protocol-question { margin: 0 0 4pt; text-align: left; }
    .protocol-question-roles { margin: 0 0 4pt; text-align: justify; }
    .protocol-heard { margin: 16pt 0 18pt; text-align: left; }
    .protocol-decision-head { margin: 0 0 4pt; text-align: left; }
    .protocol-decision { margin: 0 0 4pt; text-align: justify; }
    .protocol-empty-paragraph { margin: 0; height: 14pt; line-height: 14pt; }
    .protocol-sign-table { width: 18cm; border-collapse: collapse; margin-top: 0; table-layout: fixed; }
    .protocol-sign-table td { border: 0; padding: 0; vertical-align: top; }
    .protocol-sign-table td:first-child { width: 11cm; text-align: left; }
    .protocol-sign-table td:last-child { width: 7cm; }
    .protocol-sign-spacer td { padding: 0; }
    .protocol-sign-table td:last-child { text-align: right; }
    .no-break { white-space: nowrap; }
    .muted { color: #000; }
  </style></head><body class="${type}">${body}</body></html>`;
}

function toSurnameInitials(fullName) {
  const p = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[0])) return `${p[1]} ${p[0]}`;
  if (p.length >= 3) return `${p[0]} ${p[1][0]}.${p[2][0]}.`;
  return String(fullName || '').trim();
}

function formatProtocolCommitteeAssignment(value, task = {}) {
  const values = Array.isArray(value) ? value : String(value || '').split('§§');
  const cleaned = values.map(v => cleanCommitteeValue(v)).filter(Boolean);
  if (!cleaned.length) return '';

  const first = `Комитету ${formatCommitteeWithLeader(cleaned[0], task)}`;
  const rest = cleaned.slice(1).map(item => `совместно с комитетом ${formatCommitteeWithLeader(item, task)}`).join(' ');
  return rest ? `${first} ${rest}` : first;
}

function formatCommitteeWithLeader(committee, task = {}) {
  const text = String(committee || '').trim();
  if (!text) return '';
  const leaderName = findTaskLeaderName(task) || findCommitteeLeader(text)?.full_name || '';
  return leaderName ? `${text} (${toSurnameInitials(leaderName)})` : text;
}

function findTaskLeaderName(task = {}) {
  const directFields = [
    'leader',
    'leader_fio',
    'leader_name',
    'head',
    'head_fio',
    'head_name',
    'controller',
    'controller_fio',
    'controller_name',
    'responsible',
    'responsible_fio',
    'responsible_name',
    'supervisor',
    'supervisor_fio',
    'boss',
    'boss_fio',
    'assignee',
    'assignee_fio',
    'executor',
    'executor_fio',
  ];

  for (const field of directFields) {
    const value = task?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const name = value.full_name || value.fio || value.name;
      if (String(name || '').trim()) return String(name).trim();
    }
  }

  return '';
}

function findCommitteeLeader(committee) {
  const committeeKey = normalizeText(committee).replace(/^по\s+/, '');
  if (!committeeKey) return null;

  const records = state.people.msu_ip || [];
  return records.find(person => {
    const position = normalizeText(person.position);
    return position.includes('председател') && position.includes(committeeKey);
  }) || records.find(person => normalizeText(person.position).includes(committeeKey)) || null;
}

function cleanCommitteeValue(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  text = text.replace(/^Комитету\s+/i, '');
  text = text.replace(/^комитет(?:у|ом)?\s+/i, '');
  if (!normalizeText(text).startsWith('по ')) text = text.replace(/^по\s+/i, 'по ');
  return text;
}

function ensurePeriod(value) {
  const text = String(value || '').trim();
  return text && !/[.!?]$/.test(text) ? text + '.' : text;
}

function isFemalePerson(fullName) {
  const p = String(fullName || '').trim().split(/\s+/);
  const first = normalizeText(p[1] || p[0] || '');
  const patronymic = normalizeText(p[2] || '');
  if (patronymic.endsWith('ич')) return false;
  return patronymic.endsWith('вна') || patronymic.endsWith('чна') || /[ая]$/.test(first);
}

function declinePositionGenitive(position) {
  let text = String(position || '').trim();
  if (!text) return '';

  const keepCapital = /^[А-ЯЁ]/.test(text);
  const cap = value => keepCapital ? value[0].toUpperCase() + value.slice(1) : value;

  text = text
    .replace(/^первый заместитель/i, cap('первого заместителя'))
    .replace(/^заместитель/i, cap('заместителя'))
    .replace(/^глава администрации/i, cap('главу администрации'))
    .replace(/^глава города/i, cap('главу города'))
    .replace(/^глава(?=\s|$)/i, cap('главу'))
    .replace(/^председатель/i, cap('председателя'))
    .replace(/^управляющий делами/i, cap('управляющего делами'))
    .replace(/^руководитель аппарата/i, cap('руководителя аппарата'))
    .replace(/^руководитель/i, cap('руководителя'))
    .replace(/^директор/i, cap('директора'))
    .replace(/^депутат/i, cap('депутата'))
    .replace(/^начальник/i, cap('начальника'));

  // Внутренние должности после запятой тоже должны переходить в нужный падеж:
  // "заместителя главы администрации города, руководителя аппарата".
  text = text
    .replace(/,\s*руководитель аппарата/gi, ', руководителя аппарата')
    .replace(/,\s*председатель/gi, ', председателя')
    .replace(/,\s*начальник/gi, ', начальника');

  return text;
}

function declinePositionAccusative(position) {
  return declinePositionGenitive(position);
}


function declineFioGenitive(fullName) {
  const p = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[0])) {
    return `${declineSurnameGenitive(p[1], fullName)} ${p[0]}`;
  }
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[1])) {
    return `${declineSurnameGenitive(p[0], fullName)} ${p[1]}`;
  }
  if (p.length === 2) {
    return `${declineSurnameGenitive(p[0], fullName)} ${p[1][0]}.`;
  }
  if (p.length === 1) return declineSurnameGenitive(p[0], fullName);
  if (p.length < 3) return String(fullName || '').trim();
  let [surname, name, patronymic] = p;

  if (isFemalePerson(fullName)) {
    surname = declineFemaleNameGenitive(surname);
    name = declineFemaleNameGenitive(name);
    patronymic = declineFemaleNameGenitive(patronymic);
  } else {
    surname = declineMaleNameGenitive(surname);
    name = declineMaleNameGenitive(name);
    patronymic = declineMalePatronymicGenitive(patronymic);
  }

  return `${surname} ${name[0]}.${patronymic[0]}.`;
}

function declineFioAccusative(fullName) {
  const p = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[0])) {
    return `${declineSurnameAccusative(p[1], fullName)} ${p[0]}`;
  }
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[1])) {
    return `${declineSurnameAccusative(p[0], fullName)} ${p[1]}`;
  }
  if (p.length === 2) {
    return `${declineSurnameAccusative(p[0], fullName)} ${declineNameAccusative(p[1], fullName)}`;
  }
  if (p.length === 1) return declineSurnameAccusative(p[0], fullName);
  if (p.length < 3) return String(fullName || '').trim();

  const [surname, name, patronymic] = p;
  if (isLikelyAccusativeMaleFullName(p)) return p.join(' ');

  if (isFemalePerson(fullName)) {
    return [
      declineFemaleNameAccusative(surname),
      declineFemaleNameAccusative(name),
      declineFemaleNameAccusative(patronymic),
    ].join(' ');
  }

  return [
    declineSurnameAccusative(surname, fullName),
    declineMaleFirstNameAccusative(name),
    declineMalePatronymicGenitive(patronymic),
  ].join(' ');
}

function isLikelyAccusativeMaleFullName(parts = []) {
  const patronymic = String(parts[2] || '').trim();
  return /ича$/i.test(patronymic);
}

function toAccusativeSurnameInitials(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';

  if (parts.length === 2 && /^[А-ЯЁ]\.$/i.test(parts[1])) {
    return `${declineSurnameAccusative(parts[0], fullName)} ${parts[1]}`;
  }

  if (parts.length >= 2 && /^[А-ЯЁ]\.$/i.test(parts[1])) {
    const initials = parts.slice(1).filter(part => /^[А-ЯЁ]\.$/i.test(part)).join(' ');
    return `${declineSurnameAccusative(parts[0], fullName)} ${initials}`.trim();
  }

  const [surname, name, patronymic] = parts;
  const initials = [name, patronymic]
    .filter(Boolean)
    .map(part => `${part[0].toUpperCase()}.`)
    .join(' ');
  return `${declineSurnameAccusative(surname, fullName)} ${initials}`.trim();
}

function declineSurnameGenitive(surname, fullName = '') {
  return isFemalePerson(fullName) || /(ова|ева|ёва|ина|ына|ая|яя|а|я)$/i.test(String(surname || '').trim())
    ? declineFemaleNameGenitive(surname)
    : declineMaleSurnameGenitive(surname);
}

function declineSurnameAccusative(surname, fullName = '') {
  return isFemalePerson(fullName) || /(ова|ева|ёва|ина|ына|ая|яя|а|я)$/i.test(String(surname || '').trim())
    ? declineFemaleNameAccusative(surname)
    : declineMaleSurnameGenitive(surname);
}

function declineNameAccusative(name, fullName = '') {
  return isFemalePerson(fullName)
    ? declineFemaleNameAccusative(name)
    : declineMaleFirstNameAccusative(name);
}

function declineMaleFirstNameAccusative(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineMaleFirstNameAccusative(part)).join('-');

  const lower = text.toLowerCase();
  const irregular = new Map([
    ['павел', 'павла'],
    ['лев', 'льва'],
    ['пётр', 'петра'],
    ['петр', 'петра'],
  ]);
  const irregularValue = irregular.get(lower);
  if (irregularValue) return matchWordCase(text, irregularValue);

  if (/а$/i.test(text)) return text.slice(0, -1) + matchLastLetterCase(text, 'у');
  if (/я$/i.test(text)) return text.slice(0, -1) + matchLastLetterCase(text, 'ю');
  return declineMaleNameGenitive(text);
}

function declineMaleNameGenitive(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineMaleNameGenitive(part)).join('-');
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(text)) return text + 'а';
  if (/(ов|ев|ёв|ин|ын)$/i.test(text)) return text + 'а';
  if (/ий$/i.test(text)) return text.slice(0, -2) + 'ия';
  if (/ый$/i.test(text) || /ой$/i.test(text)) return text.slice(0, -2) + 'ого';
  if (/ь$/i.test(text)) return text.slice(0, -1) + 'я';
  if (/й$/i.test(text)) return text.slice(0, -1) + 'я';
  return text;
}

function declineMaleSurnameGenitive(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineMaleSurnameGenitive(part)).join('-');
  if (/(ский|цкий)$/i.test(text)) return text.slice(0, -2) + 'ого';
  if (/ий$/i.test(text) && /(н|в|л|р|т|д|з|с)ий$/i.test(text)) return text.slice(0, -2) + 'ого';
  return declineMaleNameGenitive(text);
}

function declineMalePatronymicGenitive(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (/ич$/i.test(text)) return text + 'а';
  return declineMaleNameGenitive(text);
}

function declineFemaleNameGenitive(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineFemaleNameGenitive(part)).join('-');
  if (/(ова|ева|ёва|ина|ына)$/i.test(text)) return text.slice(0, -1) + 'ой';
  if (/ая$/i.test(text)) return text.slice(0, -2) + 'ой';
  if (/яя$/i.test(text)) return text.slice(0, -2) + 'ей';
  if (/а$/i.test(text)) return text.slice(0, -1) + 'ы';
  if (/я$/i.test(text)) return text.slice(0, -1) + 'и';
  return text;
}

function declineFemaleNameAccusative(value) {
  const text = String(value || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineFemaleNameAccusative(part)).join('-');
  if (/(ова|ева|ёва|ина|ына)$/i.test(text)) return text.slice(0, -1) + 'у';
  if (/ая$/i.test(text)) return text.slice(0, -2) + 'ую';
  if (/яя$/i.test(text)) return text.slice(0, -2) + 'юю';
  if (/на$/i.test(text)) return text.slice(0, -1) + 'у';
  if (/а$/i.test(text)) return text.slice(0, -1) + 'у';
  if (/я$/i.test(text)) return text.slice(0, -1) + 'ю';
  return text;
}

function toInitialsFirstDativeSurname(fullName) {
  const p = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (p.length >= 3) return `${p[1][0]}.${p[2][0]}. ${declineSurnameDative(p[0], fullName)}`;
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[0])) return `${p[0]} ${declineSurnameDative(p[1], fullName)}`;
  if (p.length === 2 && /^[А-ЯЁ]\.[А-ЯЁ]\.$/i.test(p[1])) return `${p[1]} ${declineSurnameDative(p[0], fullName)}`;
  if (p.length === 2) return `${p[1][0]}. ${declineSurnameDative(p[0], fullName)}`;
  if (p.length === 1) return declineSurnameDative(p[0], fullName);
  return fullName || '';
}

function declineSurnameDative(surname, fullName = '') {
  const text = String(surname || '').trim();
  if (!text) return text;
  if (text.includes('-')) return text.split('-').map(part => declineSurnameDative(part, fullName)).join('-');
  if (isFemalePerson(fullName) || /(ова|ева|ёва|ина|ына|ая|яя|а|я)$/i.test(text)) {
    if (/(ова|ева|ёва|ина|ына)$/i.test(text)) return text.slice(0, -1) + 'ой';
    if (/ая$/i.test(text)) return text.slice(0, -2) + 'ой';
    if (/яя$/i.test(text)) return text.slice(0, -2) + 'ей';
    if (/а$/i.test(text)) return text.slice(0, -1) + 'ой';
    if (/я$/i.test(text)) return text.slice(0, -1) + 'ей';
    return text;
  }
  const lower = normalizeText(text);
  if (lower.endsWith('у') || lower.endsWith('овому') || lower.endsWith('еву') || lower.endsWith('ину')) return text;
  if (/ий$/i.test(text)) return text.slice(0, -2) + 'ию';
  if (/ый$/i.test(text)) return text.slice(0, -2) + 'ому';
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(text)) return text + 'у';
  if (/(ов|ев|ёв|ин|ын)$/i.test(text)) return text + 'у';
  return text;
}

function lowerFirstLetter(value) {
  return String(value || '').replace(/^(\s*)([А-ЯЁA-Z])/, (_, space, letter) => space + letter.toLowerCase());
}

function upperFirstLetter(value) {
  return String(value || '').replace(/^(\s*)([а-яёa-z])/, (_, space, letter) => space + letter.toUpperCase());
}

function matchWordCase(source, value) {
  const text = String(source || '');
  if (text && text === text.toUpperCase()) return value.toUpperCase();
  if (/^[А-ЯЁA-Z]/.test(text)) return upperFirstLetter(value);
  return value;
}

function matchLastLetterCase(source, letter) {
  const last = String(source || '').slice(-1);
  return last && last === last.toUpperCase() ? letter.toUpperCase() : letter;
}

function typographyRaw(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s(«"„])((?:в|во|на|по|к|ко|с|со|о|об|от|до|для|при|из|за|у|и|а|но|же|ли|бы|или|ул\.|№))\s+/gi, '$1$2&nbsp;')
    .replace(/ул\.\s*Гоголя/gi, 'ул.&nbsp;Гоголя')
    .replace(/([А-ЯЁ]\.)\s*([А-ЯЁ]\.)\s+([А-ЯЁ][а-яё-]+)/g, '$1$2&nbsp;$3')
    .replace(/([А-ЯЁ][а-яё-]+)\s+([А-ЯЁ]\.)\s*([А-ЯЁ]\.)/g, '$1&nbsp;$2$3')
    .replace(/(\d{1,2}\.\d{1,2}\.\d{4})\s+(в|до|от)\s+(\d{1,2}:\d{2})/gi, '$1&nbsp;$2&nbsp;$3')
    .replace(/(\d{1,2}:\d{2})\s+(час\.?)/gi, '$1&nbsp;$2')
    .replace(/:\s+([^\s<]+)/g, ':&nbsp;$1')
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '<span class="no-break">$1</span>');
}

function typography(value) {
  return typographyRaw(escapeHtml(value));
}

function ruDateToIso(value) {
  const [day, month, year] = String(value || '').split('.').map(Number);
  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatToday() {
  const d = new Date();
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('.');
}

function formatNowTime() {
  const d = new Date();
  return [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':');
}

function formatDate(input) {
  let d = String(input.value || '').replace(/\D/g, '').slice(0, 8);
  input.value = d.length > 4 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}.${d.slice(2)}` : d;
}

function formatTime(input) {
  let d = String(input.value || '').replace(/\D/g, '').slice(0, 4);
  input.value = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

function previousDay(dateText) {
  const [d, m, y] = String(dateText || '').split('.').map(Number);
  if (!d || !m || !y) return '';
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return [String(date.getDate()).padStart(2, '0'), String(date.getMonth() + 1).padStart(2, '0'), date.getFullYear()].join('.');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ');
}

function formatFioCell(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length >= 3) return `${escapeHtml(parts[0])}<br>${escapeHtml(parts.slice(1).join(' '))}`;
  return escapeHtml(fullName);
}

function toInitialsFirst(fullName) {
  const p = String(fullName || '').trim().split(/\s+/);
  if (p.length >= 3) return `${p[1][0]}.${p[2][0]}. ${p[0]}`;
  return fullName || '';
}

function toNamePatronymic(fullName) {
  const p = String(fullName || '').trim().split(/\s+/);
  if (p.length >= 3) return `${p[1]} ${p[2]}`;
  return fullName || '';
}

function declinePositionDative(position) {
  let text = String(position || '').trim();
  if (!text) return '';

  const keepCapital = /^[А-ЯЁ]/.test(text);
  const cap = value => keepCapital ? value[0].toUpperCase() + value.slice(1) : value;

  // Дательный падеж для адресата телефонограммы:
  // "Председатель Барнаульской городской Думы" -> "Председателю Барнаульской городской Думы"
  // "Глава города Барнаула" -> "Главе города Барнаула"
  text = text
    .replace(/^первый заместитель/i, cap('первому заместителю'))
    .replace(/^заместитель/i, cap('заместителю'))
    .replace(/^председатель/i, cap('председателю'))
    .replace(/^глава администрации/i, cap('главе администрации'))
    .replace(/^глава города/i, cap('главе города'))
    .replace(/^директор/i, cap('директору'))
    .replace(/^депутат/i, cap('депутату'))
    .replace(/^начальник/i, cap('начальнику'));

  text = text
    .replace(/,\s*руководитель аппарата/gi, ', руководителю аппарата')
    .replace(/,\s*председатель/gi, ', председателю')
    .replace(/,\s*начальник/gi, ', начальнику')
    .replace(/,\s*директор/gi, ', директору');

  return text;
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
