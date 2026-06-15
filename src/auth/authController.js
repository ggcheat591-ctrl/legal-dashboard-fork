import { dbApi } from '../api/dbApi.js';
import { getAuthSession, setAuthSession, clearAuthSession } from './session.js';

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
      <section class="login-card">
        <div class="login-logo">⚖️</div>
        <h1>Legal Dashboard</h1>
        <p>Введите пароль для входа в систему</p>

        <form class="login-form" data-login-form>
          <label>
            <span>Пароль</span>
            <input type="password" name="password" autocomplete="current-password" autofocus>
          </label>

          <div class="login-error" data-login-error hidden></div>

          <button class="btn primary login-submit" type="submit">Войти</button>
        </form>
      </section>
    </main>
  `;

  const form = root.querySelector('[data-login-form]');
  const errorNode = root.querySelector('[data-login-error]');
  const input = form.elements.password;
  input.focus();

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const password = input.value.trim();

    if (!password) {
      showError(errorNode, 'Введите пароль.');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Проверка...';

    try {
      const session = await dbApi.login(password);
      setAuthSession(session);
      onAuthenticated(session);
    } catch {
      showError(errorNode, 'Неверный пароль.');
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

function showError(node, text) {
  if (!node) return;
  node.textContent = text;
  node.hidden = false;
}
