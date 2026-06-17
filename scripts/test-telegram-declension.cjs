const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/modules/meetings/meetingsController.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export function /gm, 'function ')
  .replace(/^export const /gm, 'const ');

const checks = `
globalThis.__telegramDeclensionChecks = {
  declinePositionAccusative,
  toAccusativeSurnameInitials,
  declineFioAccusative
};
`;

const sandbox = {
  console,
  window: { addEventListener() {}, dispatchEvent() {}, openView() {} },
  document: {
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { click() {}, remove() {} }; },
    body: { appendChild() {} }
  },
  URL: class {},
  Blob: class {},
  setTimeout() {},
  clearTimeout() {},
  requestAnimationFrame(callback) { callback(); },
  dbApi: {},
  showNotification() {},
  getCurrentUserName() { return ''; }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\n${checks}`, sandbox, { filename: 'meetingsController.js' });

const {
  declinePositionAccusative,
  toAccusativeSurnameInitials,
  declineFioAccusative
} = sandbox.__telegramDeclensionChecks;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${expected}\nActual:   ${actual}`);
  }
  console.log(`ok: ${label} -> ${actual}`);
}

assertEqual(
  `${declinePositionAccusative('глава Научногородокской сельской администрации')} ${toAccusativeSurnameInitials('Зеленский Юрий Александрович')}`,
  'главу Научногородокской сельской администрации Зеленского Ю. А.',
  'МСУ invitee after "направить"'
);

assertEqual(declinePositionAccusative('заместитель главы района'), 'заместителя главы района', 'заместитель');
assertEqual(declinePositionAccusative('председатель комитета'), 'председателя комитета', 'председатель');
assertEqual(declinePositionAccusative('управляющий делами администрации'), 'управляющего делами администрации', 'управляющий делами');
assertEqual(declinePositionAccusative('руководитель аппарата'), 'руководителя аппарата', 'руководитель аппарата');
assertEqual(declinePositionAccusative('начальник отдела'), 'начальника отдела', 'начальник');
assertEqual(declinePositionAccusative('директор учреждения'), 'директора учреждения', 'директор');
assertEqual(declineFioAccusative('Сидоров Павел Иванович'), 'Сидорова Павла Ивановича', 'Павел');

console.log('All telegram declension regression checks passed.');
