import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const outputDir = path.resolve('test-results/ui-smoke');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const failures = [];
const consoleErrors = [];

page.on('pageerror', error => failures.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (/favicon|ERR_BLOCKED_BY_CLIENT|Failed to load resource.*(?:tile|nspd|nominatim|openstreetmap)/i.test(text)) return;
  consoleErrors.push(text);
});

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}\n${error.stack || error}`);
  }
}

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openView(viewId) {
  const button = page.locator(`.nav-btn[data-view="${viewId}"]`);
  await button.click();
  await page.locator(`#${viewId}.view.active`).waitFor({ state: 'visible', timeout: 8000 });
}

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

await check('Экран входа отображается', async () => {
  await page.locator('#login-title').waitFor({ state: 'visible' });
  await assert((await page.locator('#login-title').textContent())?.trim() === 'ЮрСфера', 'Неверный заголовок входа');
  await assert(await page.locator('[data-login-particle-canvas]').count() === 1, 'Не найден canvas анимации');
});

await check('Переключатель видимости пароля', async () => {
  const input = page.locator('input[name="password"]');
  const toggle = page.locator('[data-login-password-toggle]');
  await input.fill('admin');
  await toggle.click();
  await assert(await input.getAttribute('type') === 'text', 'Пароль не стал видимым');
  await toggle.click();
  await assert(await input.getAttribute('type') === 'password', 'Пароль не был снова скрыт');
});

await check('Вход с тестовым администратором', async () => {
  await page.locator('input[name="password"]').fill('admin');
  await page.locator('[data-login-form] button[type="submit"]').click();
  await page.locator('.app .sidebar').waitFor({ state: 'visible', timeout: 15000 });
  await assert(await page.locator('.nav-btn').count() === 10, 'Ожидалось 10 пунктов левого меню');
});

await check('Сворачивание и разворачивание левого меню', async () => {
  const button = page.locator('#sidebarCollapseBtn');
  await button.click();
  await page.waitForFunction(() => document.body.classList.contains('sidebar-collapsed'));
  await button.click();
  await page.waitForFunction(() => !document.body.classList.contains('sidebar-collapsed'));
});

await check('Переключение светлой и тёмной темы', async () => {
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('[data-theme-toggle]').click();
  const after = await page.locator('html').getAttribute('data-theme');
  await assert(before !== after, 'Тема не переключилась');
  await page.locator('[data-theme-toggle]').click();
});

await check('Панель рабочих заметок', async () => {
  await page.locator('#openNotesBtn').click();
  const panel = page.locator('#notesPanel');
  await panel.waitFor({ state: 'visible' });
  await page.locator('#newNoteBtn').click();
  await page.locator('#noteTitleInput').fill('Автоматическая проверка');
  await page.locator('#noteTextInput').fill('Проверка полей и автосохранения заметки.');
  await page.waitForTimeout(350);
  await panel.locator('[data-close-utility]').click();
  await panel.waitFor({ state: 'hidden' });
});

await check('Панель уведомлений и вкладки', async () => {
  await page.locator('#openNotificationsBtn').click();
  const panel = page.locator('#notificationsPanel');
  await panel.waitFor({ state: 'visible' });
  await panel.locator('[data-notification-tab="overdue"]').click();
  await assert(await panel.locator('[data-notification-tab="overdue"]').evaluate(node => node.classList.contains('is-active')), 'Вкладка просроченных не активировалась');
  await panel.locator('[data-notification-tab="active"]').click();
  await panel.locator('[data-close-utility]').click();
  await panel.waitFor({ state: 'hidden' });
});

await check('Профиль и выпадающее меню выхода присутствуют', async () => {
  const profile = page.locator('.topbar-profile-card');
  await profile.focus();
  await assert(await page.locator('.topbar-profile-dropdown [data-auth-logout]').count() === 1, 'Не найдена кнопка выхода');
});

await check('Главная страница и четыре существующих виджета', async () => {
  await openView('dashboard');
  await page.waitForTimeout(700);
  const widgets = page.locator('#dashboardGrid .widget-shell');
  await assert(await widgets.count() >= 4, 'На главной отображается меньше четырёх виджетов');
  await assert(await page.locator('.widget-shell-cases').count() === 1, 'Нет виджета общего перечня дел');
  await assert(await page.locator('.widget-shell-calendarKanban').count() === 1, 'Нет виджета ближайших событий');
  await assert(await page.locator('.widget-shell-calendar').count() === 1, 'Нет виджета календаря');
  await assert(await page.locator('.widget-shell-calendarTodayTasks').count() === 1, 'Нет виджета задач на сегодня');
});

await check('Фильтры, виды и вкладки общего перечня дел', async () => {
  await openView('cases');
  await page.locator('[data-general-type-filter]').selectOption('control');
  await page.locator('[data-general-type-filter]').selectOption('all');
  await page.locator('[data-general-procedural-position-filter]').selectOption('Истец');
  await page.locator('[data-general-procedural-position-filter]').selectOption('all');
  await page.locator('[data-general-view="cards"]').click();
  await page.locator('[data-general-view="table"]').click();
  await page.locator('[data-general-new]').click();
  const dialog = page.locator('[data-general-dialog]');
  await page.waitForFunction(() => document.querySelector('[data-general-dialog]')?.open === true);
  for (const tab of ['appeal', 'plan', 'documents', 'info']) {
    await dialog.locator(`[data-general-case-tab="${tab}"]`).click();
  }
  await dialog.locator('[data-general-close]').first().click();
});

for (const viewId of ['controlledCases', 'enforcement', 'calendar']) {
  await check(`Открытие раздела ${viewId}`, async () => {
    await openView(viewId);
    await assert(await page.locator(`#${viewId} button`).count() > 0, `В разделе ${viewId} нет кнопок управления`);
  });
}

await check('Кнопка «Добавить дату» в заголовке графика заседаний', async () => {
  await openView('schedule');
  const title = page.locator('.schedule-title-row h2');
  const button = page.locator('.schedule-title-row [data-schedule-date-new]');
  await title.waitFor({ state: 'visible' });
  await button.waitFor({ state: 'visible' });
  const titleBox = await title.boundingBox();
  const buttonBox = await button.boundingBox();
  await assert(titleBox && buttonBox, 'Не удалось измерить элементы заголовка');
  await assert(buttonBox.x > titleBox.x + titleBox.width, 'Кнопка не расположена справа от заголовка');
  await assert(Math.abs((buttonBox.y + buttonBox.height / 2) - (titleBox.y + titleBox.height / 2)) < 35, 'Кнопка не выровнена по строке заголовка');
  await button.click();
  await page.waitForFunction(() => document.querySelector('[data-schedule-date-dialog]')?.open === true);
  await page.locator('[data-schedule-date-close]').first().click();
});

await check('Раздел карты использует существующий iframe', async () => {
  await openView('map');
  const iframe = page.locator('#embeddedUserMap');
  await assert(await iframe.count() === 1, 'Не найден iframe карты');
  const src = await iframe.getAttribute('src');
  await assert(src === '/map/index.html', `Неожиданный источник карты: ${src}`);
  await assert(await page.locator('[data-open-map-fullscreen]').count() === 1, 'Нет кнопки полноэкранного режима карты');
});

for (const viewId of ['emergencyFund', 'municipalRegistry']) {
  await check(`Открытие раздела ${viewId}`, async () => {
    await openView(viewId);
    await assert(await page.locator(`#${viewId}`).isVisible(), `Раздел ${viewId} не виден`);
  });
}

await check('Стартовый экран и выбор типа документа в совещаниях', async () => {
  await openView('meetings');
  await page.locator('[data-meetings-launch-create]').click();
  await page.waitForFunction(() => document.querySelector('[data-meetings-type-dialog]')?.open === true);
  await assert(await page.locator('[data-meetings-type-pick]').count() === 5, 'Ожидалось пять типов документов совещания');
  await page.locator('[data-meetings-type-pick="participants"]').click();
  await page.locator('[data-meetings-editor]').waitFor({ state: 'visible' });
  for (const tab of ['agenda', 'telegram', 'protocol', 'documents', 'participants']) {
    const button = page.locator(`[data-meetings-doc-type="${tab}"]`);
    if (await button.count()) await button.click();
  }
});

await check('Мобильная ширина не ломает основные органы управления', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openView('schedule');
  await assert(await page.locator('[data-schedule-date-new]').isVisible(), 'Кнопка добавления даты скрыта на мобильной ширине');
  await page.setViewportSize({ width: 1440, height: 960 });
});

await page.screenshot({ path: path.join(outputDir, 'final-dashboard.png'), fullPage: true });

if (consoleErrors.length) {
  await fs.writeFile(path.join(outputDir, 'console-errors.txt'), consoleErrors.join('\n'), 'utf8');
  failures.push(`console errors: ${consoleErrors.length}`);
}

await browser.close();

if (failures.length) {
  await fs.writeFile(path.join(outputDir, 'failures.txt'), failures.join('\n'), 'utf8');
  console.error('\nSMOKE TEST FAILURES:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('\nUI smoke tests passed.');
