import { dbApi } from '../api/dbApi.js';
import { getAuthSession, setAuthSession, clearAuthSession } from './session.js';
import { initLoginParticleVisual } from './loginParticleVisualCycle.js';

const APP_DISPLAY_NAME = 'ЮрСфера';
const APP_SYSTEM_LABEL = 'Правовая система';

export function initAuthGate(onAuthenticated) {
  const existing = getAuthSession();

  if (existing?.full_name && existing?.token) {
    window.legalDashboardSession = existing;
    onAuthenticated(existing);
    return;
  }

  if (existing) clearAuthSession();

  renderLoginScreen(onAuthenticated);
}

function renderLoginScreen(onAuthenticated) {
  const root = document.querySelector('#app');
  root.innerHTML = `
    <main class="login-screen">
      <section
        class="login-visual"
        data-login-visual-label="${APP_DISPLAY_NAME}"
        aria-label="Интерактивная цифровая фигура"
      >
        <canvas
          class="login-visual-canvas"
          data-login-particle-canvas
          tabindex="0"
          aria-label="Интерактивная сфера защиты"
        ></canvas>
        <div class="login-visual-fallback" data-login-particle-fallback aria-hidden="true" hidden></div>
      </section>

      <section class="login-card" data-login-card data-state="idle" aria-labelledby="login-title">
        <div class="login-brand">
          <span class="login-brand-mark" aria-hidden="true"></span>
          ${APP_SYSTEM_LABEL}
        </div>

        <div class="login-logo" data-login-lock data-state="idle" aria-hidden="true">
          <svg class="login-lock-icon" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
            <path class="login-lock-shield" d="M32 5.5 52 13.8v15.5c0 13.1-8.2 24.2-20 29.2-11.8-5-20-16.1-20-29.2V13.8L32 5.5Z" />
            <path class="login-lock-shackle" d="M23.5 29v-5.2a8.5 8.5 0 0 1 17 0V29" />
            <rect class="login-lock-body" x="20.5" y="27.5" width="23" height="19" rx="6.5" />
            <circle class="login-lock-keyhole" cx="32" cy="36" r="2.8" />
            <path class="login-lock-key-stem" d="M32 38.5v3.8" />
          </svg>
        </div>

        <h1 id="login-title">${APP_DISPLAY_NAME}</h1>
        <p>Введите пароль для входа в систему</p>

        <form class="login-form" data-login-form>
          <label>
            <span>Пароль</span>
            <span class="login-input-wrap">
              <input type="password" name="password" autocomplete="current-password" autofocus aria-describedby="loginStatus">
              <button class="login-password-toggle" data-login-password-toggle type="button" aria-label="Показать пароль" aria-pressed="false">👁</button>
            </span>
          </label>

          <div class="login-error" id="loginStatus" data-login-error role="status" aria-live="polite" hidden></div>

          <button class="btn primary login-submit" type="submit">Войти</button>
        </form>
      </section>
    </main>
  `;

  const form = root.querySelector('[data-login-form]');
  const errorNode = root.querySelector('[data-login-error]');
  const card = root.querySelector('[data-login-card]');
  const lock = root.querySelector('[data-login-lock]');
  const passwordToggle = root.querySelector('[data-login-password-toggle]');
  const visual = initLoginParticleVisual(root.querySelector('.login-visual'));
  const input = form.elements.password;
  input.focus();

  input.addEventListener('input', () => {
    if (card?.dataset.state === 'error') {
      setLoginState(card, errorNode, lock, visual, 'typing');
    } else if (card?.dataset.state !== 'checking') {
      visual.setState(input.value.trim() ? 'typing' : 'idle');
    }
  });

  input.addEventListener('focus', () => {
    if (card?.dataset.state === 'idle') visual.setState('typing');
  });

  passwordToggle?.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', String(!visible));
    passwordToggle.setAttribute('aria-label', visible ? 'Показать пароль' : 'Скрыть пароль');
    passwordToggle.textContent = visible ? '👁' : '●';
    input.focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const password = input.value.trim();

    if (!password) {
      setLoginState(card, errorNode, lock, visual, 'error', 'Введите пароль.');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Проверка...';
    setLoginState(card, errorNode, lock, visual, 'checking', 'Выполняется проверка доступа.');

    try {
      const session = await dbApi.login(password);
      setLoginState(card, errorNode, lock, visual, 'success', 'Доступ подтверждён.');
      await visual.showSuccessText(APP_DISPLAY_NAME);
      await delay(160);
      setAuthSession(session);
      visual.destroy();
      onAuthenticated(session);
    } catch {
      setLoginState(card, errorNode, lock, visual, 'error', 'Неверный пароль.');
      input.select();
    } finally {
      button.disabled = false;
      button.textContent = 'Войти';
    }
  });
}

export function initAuthUi() {
  document.addEventListener('click', async event => {
    if (event.target.closest('[data-auth-logout]')) {
      try { await dbApi.logout(); } catch {}
      clearAuthSession();
      window.location.reload();
    }
  });
}

function setLoginState(card, errorNode, lock, visual, state, message = '') {
  if (card) card.dataset.state = state;
  if (lock) {
    lock.hidden = state === 'success';
    lock.dataset.state = state;
  }

  if (errorNode) {
    errorNode.textContent = message;
    errorNode.hidden = !message;
    errorNode.dataset.type = state === 'success' ? 'success' : state === 'error' ? 'error' : 'info';
  }

  if (state !== 'success') {
    visual.setState(state);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
