import { readStorage, writeStorage } from './storage.js';

const THEME_KEY = 'legal-dashboard-theme-v1';
const THEMES = new Set(['light', 'dark']);

export function getStoredTheme() {
  const stored = readStorage(THEME_KEY, 'light');
  return THEMES.has(stored) ? stored : 'light';
}

export function applyTheme(theme = getStoredTheme(), persist = false) {
  const safeTheme = THEMES.has(theme) ? theme : 'light';
  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.style.colorScheme = safeTheme;

  if (persist) writeStorage(THEME_KEY, safeTheme);
  updateThemeToggle(safeTheme);
  return safeTheme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || getStoredTheme();
  return applyTheme(current === 'dark' ? 'light' : 'dark', true);
}

export function initThemeUi() {
  applyTheme(getStoredTheme(), false);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;

    event.preventDefault();
    toggleTheme();
  });

  updateThemeToggle(document.documentElement.dataset.theme || getStoredTheme());
}

function updateThemeToggle(theme) {
  const isDark = theme === 'dark';
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
    button.title = isDark ? 'Светлая тема' : 'Тёмная тема';
    const label = button.querySelector('[data-theme-toggle-label]');
    if (label) label.textContent = isDark ? 'Светлая' : 'Тёмная';
    const icon = button.querySelector('[data-theme-toggle-icon]');
    if (icon) icon.textContent = isDark ? '☀' : '☾';
  });
}
