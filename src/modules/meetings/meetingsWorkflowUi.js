const SECTION_META = {
  participants: {
    title: 'Список участников',
    description: 'Выберите участников и приглашённых для совещания.',
  },
  agenda: {
    title: 'Повестка',
    description: 'Заполните вопросы повестки и участников совещания.',
  },
  telegram: {
    title: 'Телефонограмма',
    description: 'Заполните параметры телефонограммы и отправки.',
  },
  protocol: {
    title: 'Протокол',
    description: 'Заполните поручения, сроки и данные протокола.',
  },
  documents: {
    title: 'Документы',
    description: 'Прикрепите файл совещания или откройте сохранённый документ.',
  },
};

let initialized = false;
let currentSection = 'parameters';
let startingMeeting = false;

export function initMeetingsWorkflowUi() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', handleClick, true);
  document.addEventListener('dblclick', handleDoubleClick, true);
  document.addEventListener('keydown', handleKeydown);

  window.addEventListener('meetings:open-meeting', () => {
    window.setTimeout(syncOpenedMeetingSection, 520);
  });

  window.addEventListener('app:view-changed', event => {
    if (event.detail?.viewId !== 'meetings') return;
    closeSectionMenu();
    currentSection = 'parameters';
  });
}

function handleClick(event) {
  const startButton = event.target.closest('[data-meetings-start-create]');
  if (startButton) {
    event.preventDefault();
    event.stopPropagation();
    startNewMeeting();
    return;
  }

  const pickerTrigger = event.target.closest('[data-meetings-section-picker-trigger]');
  if (pickerTrigger) {
    event.preventDefault();
    event.stopPropagation();
    toggleSectionMenu();
    return;
  }

  const sectionButton = event.target.closest('[data-meetings-section-menu] [data-meetings-doc-type]');
  if (sectionButton) {
    showSection(sectionButton.dataset.meetingsDocType);
    closeSectionMenu();
    return;
  }

  const parametersButton = event.target.closest('[data-meetings-show-parameters]');
  if (parametersButton) {
    event.preventDefault();
    event.stopPropagation();
    showParameters();
    return;
  }

  if (event.target.closest('[data-meetings-open-row]')) {
    window.setTimeout(syncOpenedMeetingSection, 620);
  }

  if (event.target.closest('[data-meetings-back-home], [data-meetings-breadcrumb-action="home"]')) {
    closeSectionMenu();
  }

  if (!event.target.closest('[data-meetings-section-picker]')) {
    closeSectionMenu();
  }
}

function handleDoubleClick(event) {
  if (!event.target.closest('[data-meetings-row]')) return;
  window.setTimeout(syncOpenedMeetingSection, 620);
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return;
  closeSectionMenu();
}

function startNewMeeting() {
  if (startingMeeting) return;
  startingMeeting = true;
  closeSectionMenu();

  const participantsTrigger = document.querySelector(
    '[data-meetings-type-dialog] [data-meetings-type-pick="participants"]',
  );

  if (participantsTrigger) {
    participantsTrigger.click();
  } else {
    document.querySelector('[data-meetings-editor]')?.classList.add('is-open');
  }

  window.requestAnimationFrame(() => {
    showParameters();
    startingMeeting = false;
  });
}

function showParameters() {
  const parameters = document.querySelector('[data-meetings-parameters]');
  const content = document.querySelector('[data-meetings-section-content]');
  const editor = document.querySelector('[data-meetings-editor]');
  const title = document.querySelector('[data-meetings-editor-title]');
  const hint = document.querySelector('[data-meetings-current-id]');

  if (!parameters || !content || !editor) return;

  currentSection = 'parameters';
  editor.classList.add('is-open');
  parameters.hidden = false;
  content.hidden = true;

  const form = document.querySelector('[data-meetings-form]');
  const editing = Boolean(form?.elements.id?.value);

  if (title) title.textContent = editing ? 'Редактирование совещания' : 'Новое совещание';
  if (hint) {
    hint.textContent = editing
      ? `ID ${form.elements.id.value} · основные параметры совещания`
      : 'Заполните параметры совещания';
  }

  updateBreadcrumb();
  closeSectionMenu();
  scrollEditorIntoView();
}

function showSection(section) {
  if (!SECTION_META[section]) return;

  const parameters = document.querySelector('[data-meetings-parameters]');
  const content = document.querySelector('[data-meetings-section-content]');
  const title = document.querySelector('[data-meetings-section-context-title]');
  const description = document.querySelector('[data-meetings-section-context-description]');

  if (!parameters || !content) return;

  currentSection = section;
  parameters.hidden = true;
  content.hidden = false;

  if (title) title.textContent = SECTION_META[section].title;
  if (description) description.textContent = SECTION_META[section].description;

  updateBreadcrumb(section);
  scrollEditorIntoView();
}

function syncOpenedMeetingSection() {
  const form = document.querySelector('[data-meetings-form]');
  const editor = document.querySelector('[data-meetings-editor]');
  if (!form || !editor?.classList.contains('is-open')) return;

  const section = form.elements.attachment_type?.value || 'documents';
  showSection(SECTION_META[section] ? section : 'documents');
}

function updateBreadcrumb(section = currentSection) {
  const current = document.querySelector('[data-meetings-breadcrumb-current]');
  const separator = document.querySelector('[data-meetings-section-separator]');
  const parametersCrumb = document.querySelector('.meetings-parameters-crumb');
  const parent = document.querySelector('[data-meetings-breadcrumb-parent]');
  const form = document.querySelector('[data-meetings-form]');
  const editing = Boolean(form?.elements.id?.value);

  if (parent) parent.textContent = editing ? 'Карточка совещания' : 'Новое совещание';

  if (section === 'parameters') {
    if (current) current.textContent = 'Параметры совещания';
    if (separator) separator.hidden = true;
    if (parametersCrumb) {
      parametersCrumb.hidden = true;
      parametersCrumb.removeAttribute('aria-current');
    }
    return;
  }

  if (parametersCrumb) {
    parametersCrumb.hidden = false;
    parametersCrumb.setAttribute('aria-current', 'false');
  }
  if (separator) separator.hidden = false;
  if (current) current.textContent = SECTION_META[section]?.title || section;
}

function toggleSectionMenu() {
  const menu = document.querySelector('[data-meetings-section-menu]');
  const trigger = document.querySelector('[data-meetings-section-picker-trigger]');
  if (!menu || !trigger) return;

  const open = menu.hidden;
  menu.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  document.querySelector('[data-meetings-section-picker]')?.classList.toggle('is-open', open);
}

function closeSectionMenu() {
  const menu = document.querySelector('[data-meetings-section-menu]');
  const trigger = document.querySelector('[data-meetings-section-picker-trigger]');
  if (menu) menu.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  document.querySelector('[data-meetings-section-picker]')?.classList.remove('is-open');
}

function scrollEditorIntoView() {
  window.requestAnimationFrame(() => {
    document.querySelector('[data-meetings-editor]')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}
