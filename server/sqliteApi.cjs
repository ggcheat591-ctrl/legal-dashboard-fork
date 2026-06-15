const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const pathModule = require('path');
const { spawn } = require('child_process');

const activeSessions = new Map();
const schemaInitialization = new Map();
const DEFAULT_JSON_BODY_LIMIT = 10 * 1024 * 1024;
const MAX_CASE_DOCUMENT_BYTES = 100 * 1024 * 1024;
const MAX_CASE_DOCUMENT_BODY_BYTES = Math.ceil(MAX_CASE_DOCUMENT_BYTES * 4 / 3) + 2 * 1024 * 1024;

function openDb(dbPath) {
  const db = new sqlite3.Database(dbPath);
  db.configure('busyTimeout', 15000);
  return db;
}

function all(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDb(dbPath);
    db.all(sql, params, (err, rows) => {
      db.close();
      err ? reject(err) : resolve(rows || []);
    });
  });
}

function get(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDb(dbPath);
    db.get(sql, params, (err, row) => {
      db.close();
      err ? reject(err) : resolve(row || null);
    });
  });
}

function run(dbPath, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDb(dbPath);
    db.run(sql, params, function(err) {
      db.close();
      err ? reject(err) : resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function initializeSchema(dbPath) {
  return new Promise((resolve, reject) => {
    const db = openDb(dbPath);
    db.serialize(() => {
      db.run('PRAGMA journal_mode=WAL');
      db.run('PRAGMA synchronous=NORMAL');
      db.run('PRAGMA busy_timeout=15000');

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT DEFAULT '',
      password TEXT DEFAULT '',
      is_admin INTEGER DEFAULT 0
    )`);
    db.run(`ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN password TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, () => {});
    db.run(`INSERT INTO users (full_name, password, is_admin)
      SELECT 'Администратор', 'admin', 1
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE password='admin')`);

    db.run(`CREATE TABLE IF NOT EXISTS general_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_no TEXT DEFAULT '', court_no TEXT DEFAULT '', court TEXT DEFAULT '', judge TEXT DEFAULT '', executor TEXT DEFAULT '',
      category TEXT DEFAULT '', procedural_position TEXT DEFAULT '', claim_subject TEXT DEFAULT '', claim_address TEXT DEFAULT '', registration_date TEXT DEFAULT '',
      review_result TEXT DEFAULT '', control_flag INTEGER DEFAULT 0, attendance_flag INTEGER DEFAULT 0, attendance_hearing_missing INTEGER DEFAULT 0, review_show_flag INTEGER DEFAULT 0, emergency_fund_flag INTEGER DEFAULT 0, registry_flag INTEGER DEFAULT 0,
      comments TEXT DEFAULT '', judicial_act_date_first TEXT DEFAULT '', first_instance_act_type TEXT DEFAULT '', motivated_decision_date TEXT DEFAULT '', appeal_act_date TEXT DEFAULT '', cassation_act_date TEXT DEFAULT '', documents_json TEXT DEFAULT '', process_kind TEXT DEFAULT '', act_instance TEXT DEFAULT '', proceeding_form TEXT DEFAULT '', appeal_kind TEXT DEFAULT '', order_copy_date TEXT DEFAULT '', apk_cassation_has_appeal TEXT DEFAULT '', supervision_cassation_exhausted TEXT DEFAULT '', late_motivated_received TEXT DEFAULT '', appeals_json TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      plaintiff TEXT DEFAULT '', defendant TEXT DEFAULT ''
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS general_cases_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER,
      case_no TEXT DEFAULT '', court_no TEXT DEFAULT '', court TEXT DEFAULT '', judge TEXT DEFAULT '', executor TEXT DEFAULT '',
      category TEXT DEFAULT '', procedural_position TEXT DEFAULT '', claim_subject TEXT DEFAULT '', claim_address TEXT DEFAULT '', registration_date TEXT DEFAULT '',
      review_result TEXT DEFAULT '', control_flag INTEGER DEFAULT 0, attendance_flag INTEGER DEFAULT 0, attendance_hearing_missing INTEGER DEFAULT 0, review_show_flag INTEGER DEFAULT 0, emergency_fund_flag INTEGER DEFAULT 0, registry_flag INTEGER DEFAULT 0,
      comments TEXT DEFAULT '', judicial_act_date_first TEXT DEFAULT '', first_instance_act_type TEXT DEFAULT '', motivated_decision_date TEXT DEFAULT '', appeal_act_date TEXT DEFAULT '', cassation_act_date TEXT DEFAULT '', documents_json TEXT DEFAULT '', process_kind TEXT DEFAULT '', act_instance TEXT DEFAULT '', proceeding_form TEXT DEFAULT '', appeal_kind TEXT DEFAULT '', order_copy_date TEXT DEFAULT '', apk_cassation_has_appeal TEXT DEFAULT '', supervision_cassation_exhausted TEXT DEFAULT '', late_motivated_received TEXT DEFAULT '', appeals_json TEXT DEFAULT '',
      archived_at TEXT DEFAULT CURRENT_TIMESTAMP, plaintiff TEXT DEFAULT '', defendant TEXT DEFAULT ''
    )`);
    // USER REQUEST FIX: ensure appeal date columns exist in older databases.
    const ensureGeneralCaseColumnMigrations = {
      comments: "TEXT DEFAULT ''",
      claim_address: "TEXT DEFAULT ''",
      judicial_act_date_first: "TEXT DEFAULT ''",
      first_instance_act_type: "TEXT DEFAULT ''",
      motivated_decision_date: "TEXT DEFAULT ''",
      appeal_act_date: "TEXT DEFAULT ''",
      cassation_act_date: "TEXT DEFAULT ''",
      documents_json: "TEXT DEFAULT ''",
      process_kind: "TEXT DEFAULT ''",
      act_instance: "TEXT DEFAULT ''",
      proceeding_form: "TEXT DEFAULT ''",
      appeal_kind: "TEXT DEFAULT ''",
      order_copy_date: "TEXT DEFAULT ''",
      apk_cassation_has_appeal: "TEXT DEFAULT ''",
      supervision_cassation_exhausted: "TEXT DEFAULT ''",
      late_motivated_received: "TEXT DEFAULT ''",
      appeals_json: "TEXT DEFAULT ''",
      review_show_flag: "INTEGER DEFAULT 0",
      emergency_fund_flag: "INTEGER DEFAULT 0",
      registry_flag: "INTEGER DEFAULT 0",
      attendance_hearing_missing: "INTEGER DEFAULT 0"
    };

    for (const [column, type] of Object.entries(ensureGeneralCaseColumnMigrations)) {
      db.run(`ALTER TABLE general_cases ADD COLUMN ${column} ${type}`, () => {});
      db.run(`ALTER TABLE general_cases_archive ADD COLUMN ${column} ${type}`, () => {});
    }

    db.run(`CREATE TABLE IF NOT EXISTS controlled_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT DEFAULT '', plaintiff TEXT DEFAULT '', defendant TEXT DEFAULT '', subject TEXT DEFAULT '', representative TEXT DEFAULT '', result TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, general_case_id INTEGER,
      court_case_number TEXT DEFAULT '', court TEXT DEFAULT ''
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS court_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT DEFAULT '', court TEXT DEFAULT '', time TEXT DEFAULT '', representative TEXT DEFAULT '', plaintiff TEXT DEFAULT '', defendant TEXT DEFAULT '',
      category TEXT DEFAULT '', result TEXT DEFAULT '', is_date_row INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP, hearing_date TEXT DEFAULT '', general_case_id INTEGER, meeting_id INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS calendar_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_str TEXT, user_name TEXT, task_type TEXT, description TEXT, time_val TEXT, court TEXT, subject TEXT, assignment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, meeting_id INTEGER, general_case_id INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS enforcement_proceedings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT DEFAULT '',
      archived INTEGER DEFAULT 0,
      case_number TEXT DEFAULT '',
      ip_number TEXT DEFAULT '',
      subject_execution TEXT DEFAULT '',
      date_start TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      basis TEXT DEFAULT '',
      start_basis TEXT DEFAULT '',
      appeal_info TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      execution_deadline TEXT DEFAULT '',
      term_execution TEXT DEFAULT '',
      nature TEXT DEFAULT 'material',
      production_character TEXT DEFAULT '',
      amount_claimed TEXT DEFAULT '',
      claim_sum TEXT DEFAULT '',
      claim_amount TEXT DEFAULT '',
      payment_info TEXT DEFAULT '',
      payments_json TEXT DEFAULT '',
      total_paid TEXT DEFAULT '',
      amount_paid_total TEXT DEFAULT '',
      debt TEXT DEFAULT '',
      debt_amount TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS app_options (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(category,value))`);
    [
      ['case_category', 'Жилищные споры'],
      ['case_category', 'Благоустройство'],
      ['case_category', 'Дороги'],
      ['procedural_position', 'Истец'],
      ['procedural_position', 'Ответчик'],
      ['procedural_position', 'Заявитель'],
      ['procedural_position', 'Заинтересованное лицо'],
      ['procedural_position', 'Третье лицо с самостоятельными требованиями'],
      ['procedural_position', 'Третье лицо без самостоятельных требований'],
      ['procedural_position', 'Прокурор']
    ].forEach(([category, value]) => {
      db.run('INSERT OR IGNORE INTO app_options (category, value) VALUES (?, ?)', [category, value], () => {});
    });
    db.run(`CREATE TABLE IF NOT EXISTS archive (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id INTEGER, data TEXT NOT NULL, archived_at TEXT DEFAULT CURRENT_TIMESTAMP)`);

    const ensureEnforcementColumnMigrations = {
      mode: "TEXT DEFAULT ''",
      archived: "INTEGER DEFAULT 0",
      case_number: "TEXT DEFAULT ''",
      ip_number: "TEXT DEFAULT ''",
      subject_execution: "TEXT DEFAULT ''",
      date_start: "TEXT DEFAULT ''",
      start_date: "TEXT DEFAULT ''",
      basis: "TEXT DEFAULT ''",
      start_basis: "TEXT DEFAULT ''",
      appeal_info: "TEXT DEFAULT ''",
      deadline: "TEXT DEFAULT ''",
      execution_deadline: "TEXT DEFAULT ''",
      term_execution: "TEXT DEFAULT ''",
      nature: "TEXT DEFAULT 'material'",
      production_character: "TEXT DEFAULT ''",
      amount_claimed: "TEXT DEFAULT ''",
      claim_sum: "TEXT DEFAULT ''",
      claim_amount: "TEXT DEFAULT ''",
      payment_info: "TEXT DEFAULT ''",
      payments_json: "TEXT DEFAULT ''",
      total_paid: "TEXT DEFAULT ''",
      amount_paid_total: "TEXT DEFAULT ''",
      debt: "TEXT DEFAULT ''",
      debt_amount: "TEXT DEFAULT ''",
      created_at: "TEXT DEFAULT ''",
      updated_at: "TEXT DEFAULT ''",
      pk: "TEXT DEFAULT ''",
      case_num: "TEXT DEFAULT ''",
      sum_claim: "TEXT DEFAULT ''",
      provided_area: "TEXT DEFAULT ''",
      execution_quarter: "TEXT DEFAULT ''",
      review_ready: "INTEGER DEFAULT 0",
      total_unfulfilled_sum: "TEXT DEFAULT ''",
      total_fulfilled_sum: "TEXT DEFAULT ''",
      total_unfulfilled_area: "TEXT DEFAULT ''",
      total_provided_area: "TEXT DEFAULT ''"
    };

    for (const [column, type] of Object.entries(ensureEnforcementColumnMigrations)) {
      db.run(`ALTER TABLE enforcement_proceedings ADD COLUMN ${column} ${type}`, () => {});
    }


    const ensureCalendarColumnMigrations = {
      date: "TEXT DEFAULT ''",
      user: "TEXT DEFAULT ''",
      type: "TEXT DEFAULT ''",
      desc: "TEXT DEFAULT ''",
      time: "TEXT DEFAULT ''",
      done: "INTEGER DEFAULT 0",
      end_date: "TEXT DEFAULT ''",
      end_time: "TEXT DEFAULT ''",
      event_scope: "TEXT DEFAULT 'work'",
      personal_kind: "TEXT DEFAULT ''",
      note_text: "TEXT DEFAULT ''",
      private_note: "TEXT DEFAULT ''",
      delegated_to: "TEXT DEFAULT ''",
      delegated_by: "TEXT DEFAULT ''",
      delegation_status: "TEXT DEFAULT ''",
      delegation_source_event_id: "INTEGER",
      conflict_override: "INTEGER DEFAULT 0",
      updated_at: "TEXT DEFAULT ''"
    };

    for (const [column, type] of Object.entries(ensureCalendarColumnMigrations)) {
      db.run(`ALTER TABLE calendar_tasks ADD COLUMN "${column}" ${type}`, () => {});
    }


    const ensureScheduleColumnMigrations = {
      session_date: "TEXT DEFAULT ''",
      court: "TEXT DEFAULT ''",
      time: "TEXT DEFAULT ''",
      representative: "TEXT DEFAULT ''",
      plaintiff: "TEXT DEFAULT ''",
      defendant: "TEXT DEFAULT ''",
      category: "TEXT DEFAULT ''",
      result: "TEXT DEFAULT ''",
      is_date_row: "INTEGER DEFAULT 0",
      hearing_date: "TEXT DEFAULT ''",
      general_case_id: "INTEGER",
      meeting_id: "INTEGER",
      created_at: "TEXT DEFAULT ''",
      updated_at: "TEXT DEFAULT ''"
    };

    for (const [column, type] of Object.entries(ensureScheduleColumnMigrations)) {
      db.run(`ALTER TABLE court_schedule ADD COLUMN ${column} ${type}`, () => {});
    }


const ensureEmergencyFundColumnMigrations = {
  kvartal: "TEXT DEFAULT ''",
  pk_number: "TEXT DEFAULT ''",
  fio: "TEXT DEFAULT ''",
  prosecutor: "TEXT DEFAULT ''",
  address: "TEXT DEFAULT ''",
  district: "TEXT DEFAULT ''",
  requirements: "TEXT DEFAULT ''",
  stage: "TEXT DEFAULT ''",
  case_number: "TEXT DEFAULT ''",
  judicial_act_date: "TEXT DEFAULT ''",
  appeal: "TEXT DEFAULT ''",
  claim_amount: "TEXT DEFAULT ''",
  collected: "TEXT DEFAULT ''",
  area: "TEXT DEFAULT ''",
  address_exec: "TEXT DEFAULT ''",
  sum_property_claim: "TEXT DEFAULT ''",
  sum_property: "TEXT DEFAULT ''",
  execution: "TEXT DEFAULT ''",
  executors: "TEXT DEFAULT ''",
  notes: "TEXT DEFAULT ''",
  court: "TEXT DEFAULT ''",
  latitude: "REAL",
  longitude: "REAL",
  pk: "TEXT DEFAULT ''",
  case_num: "TEXT DEFAULT ''",
  sum_claim: "TEXT DEFAULT ''",
  provided_area: "TEXT DEFAULT ''",
  execution_quarter: "TEXT DEFAULT ''",
  review_ready: "INTEGER DEFAULT 0",
  total_unfulfilled_sum: "TEXT DEFAULT ''",
  total_fulfilled_sum: "TEXT DEFAULT ''",
  total_unfulfilled_area: "TEXT DEFAULT ''",
  total_provided_area: "TEXT DEFAULT ''",
  execution_people_json: "TEXT DEFAULT ''",
  condemned_date: "TEXT DEFAULT ''",
  resettlement_deadline: "TEXT DEFAULT ''",
  created_at: "TEXT DEFAULT ''",
  updated_at: "TEXT DEFAULT ''",
  general_case_id: "INTEGER DEFAULT 0"
};

for (const [column, type] of Object.entries(ensureEmergencyFundColumnMigrations)) {
  db.run(`ALTER TABLE emergency_fund ADD COLUMN ${column} ${type}`, () => {});
}


const ensureRegistryColumnMigrations = {
  pk_number: "TEXT DEFAULT ''",
  kvartal: "TEXT DEFAULT ''",
  address: "TEXT DEFAULT ''",
  fio: "TEXT DEFAULT ''",
  property_type: "TEXT DEFAULT ''",
  notes: "TEXT DEFAULT ''",
  court: "TEXT DEFAULT ''",
  stage: "TEXT DEFAULT ''",
  court_act_date: "TEXT DEFAULT ''",
  court_act_number: "TEXT DEFAULT ''",
  court_act: "TEXT DEFAULT ''",
  requirements: "TEXT DEFAULT ''",
  appeal: "TEXT DEFAULT ''",
  execution: "TEXT DEFAULT ''",
  collected: "TEXT DEFAULT ''",
  review_ready: "INTEGER DEFAULT 0",
  attachments_json: "TEXT DEFAULT ''",
  created_at: "TEXT DEFAULT ''",
  updated_at: "TEXT DEFAULT ''",
  general_case_id: "INTEGER"
};

for (const [column, type] of Object.entries(ensureRegistryColumnMigrations)) {
  db.run(`ALTER TABLE registry ADD COLUMN ${column} ${type}`, () => {});
}


db.run(`CREATE TABLE IF NOT EXISTS registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pk_number TEXT DEFAULT '',
  kvartal TEXT DEFAULT '',
  address TEXT DEFAULT '',
  fio TEXT DEFAULT '',
  property_type TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  court TEXT DEFAULT '',
  stage TEXT DEFAULT '',
  court_act_date TEXT DEFAULT '',
  court_act_number TEXT DEFAULT '',
  court_act TEXT DEFAULT '',
  requirements TEXT DEFAULT '',
  appeal TEXT DEFAULT '',
  execution TEXT DEFAULT '',
  collected TEXT DEFAULT '',
  review_ready INTEGER DEFAULT 0,
  attachments_json TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  general_case_id INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT DEFAULT '',
  date_val TEXT DEFAULT '',
  time_val TEXT DEFAULT '',
  agenda TEXT DEFAULT '',
  protocol TEXT DEFAULT '',
  participants TEXT DEFAULT '',
  invited_participants TEXT DEFAULT '',
  attachment_path TEXT DEFAULT '',
  attachment_type TEXT DEFAULT '',
  has_participants_list INTEGER DEFAULT 0,
  has_telegram INTEGER DEFAULT 0,
  protocol_keeper TEXT DEFAULT '',
  cabinet_number TEXT DEFAULT '',
  telegram_number TEXT DEFAULT '',
  transfer_email TEXT DEFAULT '',
  transfer_fio TEXT DEFAULT '',
  transfer_phone TEXT DEFAULT '',
  telegram_sign_fio TEXT DEFAULT '',
  protocol_number TEXT DEFAULT '',
  protocol_chair_fio TEXT DEFAULT '',
  protocol_chair_position TEXT DEFAULT '',
  agenda_sign_position TEXT DEFAULT '',
  agenda_sign_fio TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS meeting_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  full_name TEXT NOT NULL,
  position TEXT DEFAULT '',
  leadership TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 999
)`);


    const ensureMeetingParticipantsColumnMigrations = {
      category: "TEXT DEFAULT ''",
      full_name: "TEXT DEFAULT ''",
      position: "TEXT DEFAULT ''",
      leadership: "TEXT DEFAULT ''",
      sort_order: "INTEGER DEFAULT 999"
    };
    for (const [column, type] of Object.entries(ensureMeetingParticipantsColumnMigrations)) {
      db.run(`ALTER TABLE meeting_participants ADD COLUMN ${column} ${type}`, () => {});
    }

    db.run(`CREATE TABLE IF NOT EXISTS app_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER,
      full_name TEXT DEFAULT '',
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT DEFAULT ''
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at)`);

    db.run(`CREATE TABLE IF NOT EXISTS notification_reads (
      user_name TEXT NOT NULL,
      notification_key TEXT NOT NULL,
      read_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_name, notification_key)
    )`);

    });
    db.close(error => error ? reject(error) : resolve());
  });
}

function ensureSchema(dbPath) {
  const key = pathModule.resolve(dbPath);
  if (!schemaInitialization.has(key)) {
    const initialization = initializeSchema(key).catch(error => {
      schemaInitialization.delete(key);
      throw error;
    });
    schemaInitialization.set(key, initialization);
  }
  return schemaInitialization.get(key);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(JSON.stringify(data));
}

function readBody(req, { maxBytes = DEFAULT_JSON_BODY_LIMIT } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let finished = false;

    const fail = error => {
      if (finished) return;
      finished = true;
      reject(error);
    };

    req.on('data', chunk => {
      if (finished) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        const error = new Error('Размер запроса превышает допустимый лимит');
        error.code = 'PAYLOAD_TOO_LARGE';
        error.maxBytes = maxBytes;
        fail(error);
        req.resume();
        return;
      }
      chunks.push(buffer);
    });

    req.on('end', () => {
      if (finished) return;
      finished = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) { resolve({}); return; }
      try { resolve(JSON.parse(raw)); }
      catch {
        const error = new Error('Некорректный JSON в запросе');
        error.code = 'INVALID_JSON';
        reject(error);
      }
    });

    req.on('error', fail);
  });
}

const CASE_DOCUMENT_MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function caseDocumentsDir(dbPath) {
  return pathModule.join(pathModule.dirname(dbPath), 'uploads', 'general-cases');
}

function sanitizeUploadedFileName(value) {
  const original = pathModule.basename(String(value || 'document'));
  const clean = original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();
  return clean || 'document';
}

function isPathInside(parent, candidate) {
  const relative = pathModule.relative(pathModule.resolve(parent), pathModule.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
}

function streamInlineFile(res, filePath, mimeType) {
  let stat;
  try { stat = fs.statSync(filePath); } catch { sendJson(res, 404, { error: 'file_not_found' }); return; }
  if (!stat.isFile()) { sendJson(res, 404, { error: 'file_not_found' }); return; }
  res.writeHead(200, {
    'Content-Type': mimeType || CASE_DOCUMENT_MIME[pathModule.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(pathModule.basename(filePath))}`,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

function convertWordDocumentToPdf(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      reject(new Error('Word preview is available on Windows with Microsoft Word installed'));
      return;
    }
    const quote = value => String(value).replace(/'/g, "''");
    const script = `$ErrorActionPreference='Stop';$word=New-Object -ComObject Word.Application;$word.Visible=$false;try{$doc=$word.Documents.Open('${quote(inputPath)}',$false,$true);$doc.ExportAsFixedFormat('${quote(outputPath)}',17);$doc.Close($false)}finally{$word.Quit()}`;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(stderr.trim() || `Word exited with code ${code}`));
    });
  });
}

function openFileWithSystem(filePath) {
  return new Promise((resolve, reject) => {
    let command;
    let args;
    if (process.platform === 'win32') {
      command = 'cmd.exe';
      args = ['/c', 'start', '', filePath];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [filePath];
    } else {
      command = 'xdg-open';
      args = [filePath];
    }
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function normCase(data = {}) {
  return {
    case_no: data.case_no || '', court_no: data.court_no || '', court: data.court || '', judge: data.judge || '', executor: data.executor || '',
    category: data.category || '', procedural_position: data.procedural_position || '', claim_subject: data.claim_subject || '',
    claim_address: data.claim_address || '',
    registration_date: data.registration_date || '', review_result: data.review_result || '', plaintiff: data.plaintiff || '', defendant: data.defendant || '',
    comments: data.comments || '',
    judicial_act_date_first: data.judicial_act_date_first || '',
    first_instance_act_type: data.first_instance_act_type || '',
    motivated_decision_date: data.motivated_decision_date || '',
    appeal_act_date: data.appeal_act_date || '',
    cassation_act_date: data.cassation_act_date || '',
    documents_json: data.documents_json || '',
    process_kind: data.process_kind || '',
    act_instance: data.act_instance || '',
    proceeding_form: data.proceeding_form || '',
    appeal_kind: data.appeal_kind || '',
    order_copy_date: data.order_copy_date || '',
    apk_cassation_has_appeal: data.apk_cassation_has_appeal || '',
    supervision_cassation_exhausted: data.supervision_cassation_exhausted || '',
    late_motivated_received: data.late_motivated_received || '',
    appeals_json: data.appeals_json || '',
    review_show_flag: data.review_show_flag ? 1 : 0,
    emergency_fund_flag: data.emergency_fund_flag ? 1 : 0,
    registry_flag: data.registry_flag ? 1 : 0,
    attendance_hearing_missing: Number(data.attendance_hearing_missing || 0) ? 1 : 0,
    control_flag: data.control_flag ? 1 : 0, attendance_flag: data.attendance_flag ? 1 : 0
  };
}


function controlledValue(data = {}, keys = [], defaultValue = '') {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return defaultValue;
}

function normControlled(data = {}) {
  return {
    case_number: controlledValue(data, ['case_number', 'case_num', 'case_no']),
    plaintiff: controlledValue(data, ['plaintiff']),
    defendant: controlledValue(data, ['defendant']),
    subject: controlledValue(data, ['subject', 'claim_subject']),
    representative: controlledValue(data, ['representative', 'executor']),
    result: controlledValue(data, ['result', 'history_results']),
    court_case_number: controlledValue(data, ['court_case_number', 'court_case_num', 'court_no']),
    court: controlledValue(data, ['court', 'court_name']),
    general_case_id: controlledValue(data, ['general_case_id'], null)
  };
}

async function syncLinked(dbPath, id, d) {
  if (Number(d.control_flag) === 1) {
    const existing = await get(dbPath, 'SELECT id FROM controlled_cases WHERE general_case_id=? LIMIT 1', [id]);
    const vals = [d.case_no, d.plaintiff, d.defendant, d.claim_subject, d.executor, d.review_result, d.court_no, d.court, id, new Date().toISOString()];
    if (existing) {
      await run(dbPath, `UPDATE controlled_cases SET case_number=?, plaintiff=?, defendant=?, subject=?, representative=?, result=?, court_case_number=?, court=?, general_case_id=?, updated_at=? WHERE id=?`, [...vals, existing.id]);
    } else {
      await run(dbPath, `INSERT INTO controlled_cases (case_number, plaintiff, defendant, subject, representative, result, court_case_number, court, general_case_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, vals);
    }
  }
  if (Number(d.attendance_flag) === 1) {
    try { await run(dbPath, 'ALTER TABLE court_schedule ADD COLUMN general_case_id INTEGER'); } catch {}
    const existing = await get(dbPath, 'SELECT id FROM court_schedule WHERE general_case_id=? LIMIT 1', [id]);
    const date = d.registration_date || '';
    const vals = [date, d.court, '', d.executor, d.plaintiff, d.defendant, d.category, d.claim_subject, 0, date, id, new Date().toISOString()];
    if (existing) {
      await run(dbPath, `UPDATE court_schedule SET session_date=?, court=?, time=?, representative=?, plaintiff=?, defendant=?, category=?, result=?, is_date_row=?, hearing_date=?, general_case_id=?, updated_at=? WHERE id=?`, [...vals, existing.id]);
    } else {
      await run(dbPath, `INSERT INTO court_schedule (session_date, court, time, representative, plaintiff, defendant, category, result, is_date_row, hearing_date, general_case_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, vals);
    }
  }
}


function anyValue(data = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function normEnforcement(data = {}) {
  const character = anyValue(data, ['production_character', 'Характер'], '');
  return {
    mode: anyValue(data, ['mode'], 'debtor'),
    archived: Number(anyValue(data, ['archived'], 0)) ? 1 : 0,

    case_number: anyValue(data, ['case_number', 'ip_number', 'Номер ИП']),
    ip_number: anyValue(data, ['ip_number', 'case_number', 'Номер ИП']),
    subject_execution: anyValue(data, ['subject_execution', 'Предмет исполнения']),

    date_start: anyValue(data, ['date_start', 'start_date', 'Дата возбуждения']),
    start_date: anyValue(data, ['start_date', 'date_start', 'Дата возбуждения']),

    basis: anyValue(data, ['basis', 'start_basis', 'Основание возбуждения ИП']),
    start_basis: anyValue(data, ['start_basis', 'basis', 'Основание возбуждения ИП']),

    appeal_info: anyValue(data, ['appeal_info', 'Сведения об обжаловании']),

    deadline: anyValue(data, ['deadline', 'execution_deadline', 'term_execution', 'Срок исполнения']),
    execution_deadline: anyValue(data, ['execution_deadline', 'deadline', 'term_execution', 'Срок исполнения']),
    term_execution: anyValue(data, ['term_execution', 'deadline', 'execution_deadline', 'Срок исполнения']),

    nature: anyValue(data, ['nature'], character === 'Нематериальное' ? 'non_material' : 'material'),
    production_character: character,

    amount_claimed: anyValue(data, ['amount_claimed', 'claim_sum', 'claim_amount', 'Сумма требований(руб.)']),
    claim_sum: anyValue(data, ['claim_sum', 'amount_claimed', 'claim_amount', 'Сумма требований(руб.)']),
    claim_amount: anyValue(data, ['claim_amount', 'amount_claimed', 'claim_sum', 'Сумма требований(руб.)']),

    payment_info: anyValue(data, ['payment_info', 'payments_json', 'Сведения об оплате']),
    payments_json: anyValue(data, ['payments_json', 'payment_info', 'Сведения об оплате']),

    total_paid: anyValue(data, ['total_paid', 'amount_paid_total', 'Итого оплачено']),
    amount_paid_total: anyValue(data, ['amount_paid_total', 'total_paid', 'Итого оплачено']),

    debt: anyValue(data, ['debt', 'debt_amount', 'Долг']),
    debt_amount: anyValue(data, ['debt_amount', 'debt', 'Долг'])
  };
}



function normCalendarTask(data = {}) {
  return {
    date: anyValue(data, ['date', 'date_str'], ''),
    end_date: anyValue(data, ['end_date'], ''),
    user: anyValue(data, ['user', 'user_name'], ''),
    type: anyValue(data, ['type', 'task_type'], 'судебное_заседание'),
    event_scope: anyValue(data, ['event_scope'], 'work'),
    personal_kind: anyValue(data, ['personal_kind'], ''),
    desc: anyValue(data, ['desc', 'description'], ''),
    time: anyValue(data, ['time', 'time_val'], ''),
    end_time: anyValue(data, ['end_time'], ''),
    court: anyValue(data, ['court'], ''),
    subject: anyValue(data, ['subject'], ''),
    assignment: anyValue(data, ['assignment'], ''),
    note_text: anyValue(data, ['note_text'], ''),
    private_note: anyValue(data, ['private_note'], ''),
    delegated_to: anyValue(data, ['delegated_to'], ''),
    delegated_by: anyValue(data, ['delegated_by'], ''),
    delegation_status: anyValue(data, ['delegation_status'], ''),
    delegation_source_event_id: anyValue(data, ['delegation_source_event_id'], null),
    conflict_override: Number(anyValue(data, ['conflict_override'], 0)) ? 1 : 0,
    done: Number(anyValue(data, ['done'], 0)) ? 1 : 0,
    meeting_id: anyValue(data, ['meeting_id'], null),
    general_case_id: anyValue(data, ['general_case_id'], null)
  };
}

async function getRequestSession(req, dbPath) {
  const header = String(req.headers?.authorization || req.headers?.['x-session-token'] || '').trim();
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : header;
  if (!token) return null;

  const cached = activeSessions.get(token);
  if (cached) return cached;

  const row = await get(dbPath, `
    SELECT user_id AS id, full_name, is_admin, expires_at
    FROM app_sessions
    WHERE token=?
    LIMIT 1
  `, [token]).catch(() => null);

  if (!row) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) {
    await run(dbPath, 'DELETE FROM app_sessions WHERE token=?', [token]).catch(() => {});
    return null;
  }

  const session = {
    id: row.id || null,
    full_name: row.full_name || 'Пользователь',
    is_admin: Number(row.is_admin || 0) === 1
  };
  activeSessions.set(token, session);
  return session;
}

function canEditCalendarTask(session, row) {
  if (!session || !row) return false;
  if (session.is_admin) return true;
  return String(row.user_name || row.user || '') === String(session.full_name || '');
}

function maskCalendarTaskForViewer(row, session) {
  const owner = String(row.user_name || row.user || '');
  const scope = String(row.event_scope || 'work');
  if (scope !== 'personal' || !session || owner === String(session.full_name || '')) return row;
  return {
    ...row,
    description: 'Отсутствие',
    desc: 'Отсутствие',
    personal_kind: '',
    private_note: '',
    note_text: '',
    court: '',
    subject: '',
    assignment: '',
    is_private_masked: 1
  };
}

function toIsoDateLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateTime(dateValue = '', timeValue = '', endOfDay = false) {
  const match = String(dateValue || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const timeMatch = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? Number(timeMatch[1]) : (endOfDay ? 23 : 0);
  const minutes = timeMatch ? Number(timeMatch[2]) : (endOfDay ? 59 : 0);
  const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hours, minutes, endOfDay && !timeMatch ? 59 : 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

function formatRuDateServer(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || '');
}

function dayDifference(fromIso, toIso) {
  const from = String(fromIso || '').split('-').map(Number);
  const to = String(toIso || '').split('-').map(Number);
  if (from.length !== 3 || to.length !== 3 || from.some(Number.isNaN) || to.some(Number.isNaN)) return 0;
  return Math.round((Date.UTC(to[0], to[1] - 1, to[2]) - Date.UTC(from[0], from[1] - 1, from[2])) / 86400000);
}

function pluralDays(value) {
  const number = Math.abs(Number(value || 0));
  const mod100 = number % 100;
  const mod10 = number % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function cleanNotificationTaskTitle(value = '') {
  return String(value || '')
    .replace(/^\[Авто общего перечня\]\s*/i, '')
    .trim() || 'Выполнить задачу';
}

function getDeadlineLabel(description = '') {
  const text = cleanNotificationTaskTitle(description);
  const match = text.match(/последн(?:ий|его)\s+день\s+подач[аи]\s+(.+?)(?:\s+по\s+делу|$)/i);
  if (!match) return 'процессуального срока';
  return `срока на ${String(match[1] || '').trim().toLowerCase()}`;
}

function notificationCaseLabel(row = {}) {
  const value = row.case_no || row.court_no || row.subject || '';
  return value ? `№${String(value).replace(/^№\s*/, '')}` : 'без номера';
}

async function buildUserNotifications(dbPath, session) {
  const userName = String(session?.full_name || '').trim();
  if (!userName) return [];

  const now = new Date();
  const todayIso = toIsoDateLocal(now);
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59, 999);
  const overdueFloor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60, 0, 0, 0, 0);

  const taskRows = await all(dbPath, `
    SELECT c.*, g.case_no, g.court_no
    FROM calendar_tasks c
    LEFT JOIN general_cases g ON g.id=c.general_case_id
    WHERE (COALESCE(NULLIF(c.user_name, ''), c."user", '')=? OR COALESCE(c.delegated_to, '')=?)
      AND COALESCE(c.done, 0)=0
      AND COALESCE(c.event_scope, 'work')<>'personal'
    ORDER BY COALESCE(NULLIF(c.date_str, ''), c."date", '') ASC,
             COALESCE(NULLIF(c.time_val, ''), c."time", '') ASC,
             c.id ASC
  `, [userName, userName]).catch(() => []);

  const notifications = [];
  for (const row of taskRows) {
    const type = String(row.task_type || row.type || '').trim();
    const dateValue = String(row.date_str || row.date || '').trim();
    const timeValue = String(row.time_val || row.time || '').trim();
    if (!dateValue) continue;

    if (type === 'судебное_заседание') {
      const eventAt = parseLocalDateTime(dateValue, timeValue, !timeValue);
      if (!eventAt || eventAt < overdueFloor || eventAt > horizon) continue;
      const overdue = eventAt.getTime() <= now.getTime();
      const caseLabel = notificationCaseLabel(row);
      const when = dateValue === todayIso
        ? `сегодня${timeValue ? ` в ${timeValue}` : ''}`
        : `${formatRuDateServer(dateValue)}${timeValue ? ` в ${timeValue}` : ''}`;
      notifications.push({
        key: `hearing:${row.id}:${dateValue}:${timeValue || 'all-day'}`,
        status: overdue ? 'overdue' : 'active',
        severity: 'hearing',
        title: overdue ? 'Просроченное судебное заседание' : 'Судебное заседание',
        message: `По делу ${caseLabel} судебное заседание назначено ${when}.`,
        due_at: eventAt.toISOString(),
        source_type: 'calendar_task',
        source_id: row.id,
        general_case_id: row.general_case_id || null
      });
      continue;
    }

    const taskDescription = String(row.description || row.desc || row.assignment || '');
    const isDeadlineTask = type === 'процессуальный_срок'
      || (type === 'поручение' && /(срок|последн(?:ий|его)\s+день|подать|подач[аи]|жалоб)/i.test(taskDescription));
    if (isDeadlineTask) {
      const dueAt = parseLocalDateTime(dateValue, timeValue, true);
      if (!dueAt || dueAt < overdueFloor || dueAt > horizon) continue;
      const overdue = dueAt.getTime() <= now.getTime();
      const days = dayDifference(todayIso, dateValue);
      const caseLabel = notificationCaseLabel(row);
      const taskTitle = cleanNotificationTaskTitle(taskDescription);
      const deadlineLabel = getDeadlineLabel(taskDescription);
      let message;
      if (overdue) {
        message = `По делу ${caseLabel} ${deadlineLabel} истёк ${formatRuDateServer(dateValue)}, а задача «${taskTitle}» не выполнена!`;
      } else if (days === 0) {
        message = `По делу ${caseLabel} ${deadlineLabel} истекает сегодня, а задача «${taskTitle}» не выполнена!`;
      } else {
        message = `По делу ${caseLabel} до окончания ${deadlineLabel} осталось ${days} ${pluralDays(days)}, а задача «${taskTitle}» не выполнена!`;
      }
      notifications.push({
        key: `deadline:${row.id}:${dateValue}:${timeValue || 'end-of-day'}`,
        status: overdue ? 'overdue' : 'active',
        severity: 'deadline',
        title: overdue ? 'Просроченный процессуальный срок' : 'Процессуальный срок',
        message,
        due_at: dueAt.toISOString(),
        source_type: 'calendar_task',
        source_id: row.id,
        general_case_id: row.general_case_id || null
      });
    }
  }

  const staleParams = [];
  let staleWhere = 'COALESCE(control_flag, 0)=1';
  if (!session.is_admin) {
    staleWhere += ` AND COALESCE(executor, '')=?`;
    staleParams.push(userName);
  }
  const staleRows = await all(dbPath, `
    SELECT id, case_no, court_no, executor, updated_at, created_at
    FROM general_cases
    WHERE ${staleWhere}
    ORDER BY COALESCE(updated_at, created_at, '') ASC
    LIMIT 500
  `, staleParams).catch(() => []);

  for (const row of staleRows) {
    const changedAt = new Date(row.updated_at || row.created_at || 0);
    if (Number.isNaN(changedAt.getTime())) continue;
    const inactiveDays = Math.floor((now.getTime() - changedAt.getTime()) / 86400000);
    if (inactiveDays < 14) continue;
    const caseLabel = notificationCaseLabel(row);
    notifications.push({
      key: `stale-case:${row.id}:${toIsoDateLocal(changedAt)}`,
      status: 'active',
      severity: 'stale',
      title: 'Дело давно не обновлялось',
      message: `Дело ${caseLabel} на контроле у руководителя, но не обновлялось ${inactiveDays} ${pluralDays(inactiveDays)}.`,
      due_at: changedAt.toISOString(),
      source_type: 'general_case',
      source_id: row.id,
      general_case_id: row.id
    });
  }

  const readRows = await all(dbPath, 'SELECT notification_key FROM notification_reads WHERE user_name=?', [userName]).catch(() => []);
  const readKeys = new Set(readRows.map(row => String(row.notification_key || '')));
  return notifications
    .map(item => ({ ...item, unread: readKeys.has(item.key) ? 0 : 1 }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1;
      if (a.unread !== b.unread) return b.unread - a.unread;
      return new Date(a.due_at || 0).getTime() - new Date(b.due_at || 0).getTime();
    });
}


function normSchedule(data = {}) {
  return {
    session_date: anyValue(data, ['session_date'], ''),
    court: anyValue(data, ['court'], ''),
    time: anyValue(data, ['time'], ''),
    representative: anyValue(data, ['representative'], ''),
    plaintiff: anyValue(data, ['plaintiff'], ''),
    defendant: anyValue(data, ['defendant'], ''),
    category: anyValue(data, ['category'], ''),
    result: anyValue(data, ['result'], ''),
    hearing_date: anyValue(data, ['hearing_date'], ''),
    general_case_id: anyValue(data, ['general_case_id'], null),
    meeting_id: anyValue(data, ['meeting_id'], null)
  };
}



function ruDateToIsoServer(value = '') {
  const [day, month, year] = String(value || '').split('.').map(Number);
  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}


function normEmergencyFund(data = {}) {
  return {
    kvartal: anyValue(data, ['kvartal'], ''),
    pk_number: anyValue(data, ['pk_number', 'pkNumber'], ''),
    fio: anyValue(data, ['fio'], ''),
    prosecutor: anyValue(data, ['prosecutor'], ''),
    address: anyValue(data, ['address'], ''),
    district: anyValue(data, ['district'], ''),
    requirements: anyValue(data, ['requirements'], ''),
    stage: anyValue(data, ['stage'], ''),
    case_number: anyValue(data, ['case_number', 'caseNumber'], ''),
    judicial_act_date: anyValue(data, ['judicial_act_date', 'judicialActDate'], ''),
    appeal: anyValue(data, ['appeal'], ''),
    claim_amount: anyValue(data, ['claim_amount', 'claimAmount'], ''),
    collected: anyValue(data, ['collected'], ''),
    area: anyValue(data, ['area'], ''),
    address_exec: anyValue(data, ['address_exec', 'addressExec'], ''),
    sum_property_claim: anyValue(data, ['sum_property_claim', 'sumPropertyClaim'], ''),
    sum_property: anyValue(data, ['sum_property', 'sumProperty'], ''),
    execution: anyValue(data, ['execution'], ''),
    executors: anyValue(data, ['executors'], ''),
    notes: anyValue(data, ['notes'], ''),
    court: anyValue(data, ['court'], ''),
    latitude: anyValue(data, ['latitude'], null),
    longitude: anyValue(data, ['longitude'], null),
    pk: anyValue(data, ['pk'], ''),
    case_num: anyValue(data, ['case_num'], ''),
    sum_claim: anyValue(data, ['sum_claim'], ''),
    provided_area: anyValue(data, ['provided_area'], ''),
    execution_quarter: anyValue(data, ['execution_quarter'], ''),
    review_ready: anyValue(data, ['review_ready'], 0),
    total_unfulfilled_sum: anyValue(data, ['total_unfulfilled_sum'], ''),
    total_fulfilled_sum: anyValue(data, ['total_fulfilled_sum'], ''),
    total_unfulfilled_area: anyValue(data, ['total_unfulfilled_area'], ''),
    total_provided_area: anyValue(data, ['total_provided_area'], ''),
    execution_people_json: anyValue(data, ['execution_people_json', 'executionPeopleJson'], ''),
    condemned_date: anyValue(data, ['condemned_date', 'condemnedDate'], ''),
    resettlement_deadline: anyValue(data, ['resettlement_deadline', 'resettlementDeadline'], ''),
    general_case_id: anyValue(data, ['general_case_id', 'generalCaseId'], 0)
  };
}



function normMunicipalRegistry(data = {}) {
  return {
    pk_number: anyValue(data, ['pk_number'], ''),
    kvartal: anyValue(data, ['kvartal'], ''),
    address: anyValue(data, ['address'], ''),
    fio: anyValue(data, ['fio'], ''),
    property_type: anyValue(data, ['property_type'], ''),
    notes: anyValue(data, ['notes'], ''),
    court: anyValue(data, ['court'], ''),
    stage: anyValue(data, ['stage'], ''),
    court_act_date: anyValue(data, ['court_act_date'], ''),
    court_act_number: anyValue(data, ['court_act_number'], ''),
    court_act: anyValue(data, ['court_act'], ''),
    requirements: anyValue(data, ['requirements'], ''),
    appeal: anyValue(data, ['appeal'], ''),
    execution: anyValue(data, ['execution'], ''),
    collected: anyValue(data, ['collected'], ''),
    review_ready: Number(anyValue(data, ['review_ready'], 0) || 0),
    attachments_json: anyValue(data, ['attachments_json'], ''),
    general_case_id: Number(anyValue(data, ['general_case_id'], 0) || 0)
  };
}




function normMeeting(data = {}) {
  return {
    title: anyValue(data, ['title'], ''),
    date_val: anyValue(data, ['date_val'], ''),
    time_val: anyValue(data, ['time_val'], ''),
    agenda: anyValue(data, ['agenda'], ''),
    protocol: anyValue(data, ['protocol'], ''),
    participants: anyValue(data, ['participants'], ''),
    invited_participants: anyValue(data, ['invited_participants'], ''),
    attachment_path: anyValue(data, ['attachment_path'], ''),
    attachment_type: anyValue(data, ['attachment_type'], ''),
    has_participants_list: anyValue(data, ['has_participants_list'], 0),
    has_telegram: anyValue(data, ['has_telegram'], 0),
    protocol_keeper: anyValue(data, ['protocol_keeper'], ''),
    cabinet_number: anyValue(data, ['cabinet_number'], ''),
    telegram_number: anyValue(data, ['telegram_number'], ''),
    transfer_email: anyValue(data, ['transfer_email'], ''),
    transfer_fio: anyValue(data, ['transfer_fio'], ''),
    transfer_phone: anyValue(data, ['transfer_phone'], ''),
    telegram_sign_fio: anyValue(data, ['telegram_sign_fio'], ''),
    protocol_number: anyValue(data, ['protocol_number'], ''),
    protocol_chair_fio: anyValue(data, ['protocol_chair_fio'], ''),
    protocol_chair_position: anyValue(data, ['protocol_chair_position'], ''),
    agenda_sign_position: anyValue(data, ['agenda_sign_position'], ''),
    agenda_sign_fio: anyValue(data, ['agenda_sign_fio'], '')
  };
}


async function handleApiRequest(req, res, parsedUrl, dbPath) {
  if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return true; }
  const path = parsedUrl.pathname;
  try {
    await ensureSchema(dbPath);


    // MEETING_PARTICIPANTS_ROUTE_PATCHED
    if (path === '/api/meeting-participants' && req.method === 'GET') {
      const category = parsedUrl.searchParams.get('category') || '';
      const rows = await all(dbPath, 'SELECT id, category, full_name, position, leadership, sort_order FROM meeting_participants WHERE (? = "" OR category = ?) ORDER BY sort_order, full_name', [category, category]).catch(() => []);
      if (rows.length) {
        sendJson(res, 200, rows);
        return true;
      }
      const users = await all(dbPath, 'SELECT id, full_name, "" as position, "" as leadership FROM users ORDER BY full_name', []).catch(() => []);
      sendJson(res, 200, users.map(row => ({ id: row.id, category, full_name: row.full_name, position: row.position || '', leadership: row.leadership || '', sort_order: 999 })));
      return true;
    }



// Source-port API routes inserted early so Vite never falls through to HTML.
if (path === '/api/meeting-participants' && req.method === 'GET') {
  const category = parsedUrl.searchParams.get('category') || '';
  const rows = await all(dbPath, 'SELECT * FROM meeting_participants WHERE (? = "" OR category = ?) ORDER BY sort_order, full_name', [category, category]).catch(() => []);
  if (rows.length) {
    sendJson(res, 200, rows);
    return true;
  }
  const users = await all(dbPath, 'SELECT full_name FROM users ORDER BY full_name', []).catch(() => []);
  sendJson(res, 200, users.map(row => ({ full_name: row.full_name })));
  return true;
}

if (path === '/api/meetings' && req.method === 'GET') {
  sendJson(res, 200, await all(dbPath, 'SELECT * FROM meetings ORDER BY date_val DESC, time_val DESC, id DESC LIMIT 5000'));
  return true;
}

if (path === '/api/meetings' && req.method === 'POST') {
  const d = normMeeting(await readBody(req));
  const result = await run(dbPath, `
    INSERT INTO meetings (
      title, date_val, time_val, agenda, protocol, participants, invited_participants,
      attachment_path, attachment_type, has_participants_list, has_telegram, protocol_keeper,
      cabinet_number, telegram_number, transfer_email, transfer_fio, transfer_phone,
      telegram_sign_fio, protocol_number, protocol_chair_fio, protocol_chair_position,
      agenda_sign_position, agenda_sign_fio, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    d.title, d.date_val, d.time_val, d.agenda, d.protocol, d.participants, d.invited_participants,
    d.attachment_path, d.attachment_type, d.has_participants_list, d.has_telegram, d.protocol_keeper,
    d.cabinet_number, d.telegram_number, d.transfer_email, d.transfer_fio, d.transfer_phone,
    d.telegram_sign_fio, d.protocol_number, d.protocol_chair_fio, d.protocol_chair_position,
    d.agenda_sign_position, d.agenda_sign_fio, new Date().toISOString(), new Date().toISOString()
  ]);
  sendJson(res, 201, await get(dbPath, 'SELECT * FROM meetings WHERE id=?', [result.id]));
  return true;
}

const meetingsMatchSourcePort = path.match(/^\/api\/meetings\/(\d+)$/);
if (meetingsMatchSourcePort) {
  const id = Number(meetingsMatchSourcePort[1]);
  if (req.method === 'PUT') {
    const d = normMeeting(await readBody(req));
    await run(dbPath, `
      UPDATE meetings SET
        title=?, date_val=?, time_val=?, agenda=?, protocol=?, participants=?, invited_participants=?,
        attachment_path=?, attachment_type=?, has_participants_list=?, has_telegram=?, protocol_keeper=?,
        cabinet_number=?, telegram_number=?, transfer_email=?, transfer_fio=?, transfer_phone=?,
        telegram_sign_fio=?, protocol_number=?, protocol_chair_fio=?, protocol_chair_position=?,
        agenda_sign_position=?, agenda_sign_fio=?, updated_at=?
      WHERE id=?
    `, [
      d.title, d.date_val, d.time_val, d.agenda, d.protocol, d.participants, d.invited_participants,
      d.attachment_path, d.attachment_type, d.has_participants_list, d.has_telegram, d.protocol_keeper,
      d.cabinet_number, d.telegram_number, d.transfer_email, d.transfer_fio, d.transfer_phone,
      d.telegram_sign_fio, d.protocol_number, d.protocol_chair_fio, d.protocol_chair_position,
      d.agenda_sign_position, d.agenda_sign_fio, new Date().toISOString(), id
    ]);
    sendJson(res, 200, await get(dbPath, 'SELECT * FROM meetings WHERE id=?', [id]));
    return true;
  }
  if (req.method === 'DELETE') {
    await run(dbPath, 'DELETE FROM meetings WHERE id=?', [id]);
    sendJson(res, 200, { ok: true });
    return true;
  }
}


    if (path === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const password = String(body.password || '').trim();

      if (!password) {
        sendJson(res, 400, { error: 'password_required' });
        return true;
      }

      const user = await get(dbPath, 'SELECT * FROM users WHERE password=? LIMIT 1', [password]).catch(() => null);

      if (!user) {
        sendJson(res, 401, { error: 'invalid_password' });
        return true;
      }

      const isAdmin = Number(user.is_admin || user.admin || 0) === 1 || String(user.role || '').toLowerCase() === 'admin';

      const token = crypto.randomBytes(32).toString('hex');
      const session = {
        id: user.id || null,
        full_name: user.full_name || user.name || 'Пользователь',
        is_admin: isAdmin
      };
      activeSessions.set(token, session);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await run(dbPath, `
        INSERT OR REPLACE INTO app_sessions (token, user_id, full_name, is_admin, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [token, session.id, session.full_name, session.is_admin ? 1 : 0, new Date().toISOString(), expiresAt]);
      await run(dbPath, "DELETE FROM app_sessions WHERE expires_at<>'' AND expires_at<?", [new Date().toISOString()]).catch(() => {});

      sendJson(res, 200, {
        ok: true,
        ...session,
        token
      });
      return true;
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const header = String(req.headers?.authorization || req.headers?.['x-session-token'] || '').trim();
      const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : header;
      if (token) {
        activeSessions.delete(token);
        await run(dbPath, 'DELETE FROM app_sessions WHERE token=?', [token]).catch(() => {});
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (path === '/api/health') { sendJson(res, 200, { ok: true, dbPath }); return true; }

    if (path === '/api/general-case-files' && req.method === 'POST') {
      const session = await getRequestSession(req, dbPath);
      if (!session) { sendJson(res, 401, { error: 'auth_required' }); return true; }
      const body = await readBody(req, { maxBytes: MAX_CASE_DOCUMENT_BODY_BYTES });
      const name = sanitizeUploadedFileName(body.name);
      const ext = pathModule.extname(name).toLowerCase();
      if (!CASE_DOCUMENT_MIME[ext]) {
        sendJson(res, 415, { error: 'unsupported_file_type', allowed: ['pdf', 'doc', 'docx'] });
        return true;
      }
      const raw = String(body.data_base64 || '').replace(/^data:[^;]+;base64,/, '');
      let bytes;
      try { bytes = Buffer.from(raw, 'base64'); } catch { bytes = null; }
      if (!bytes?.length) { sendJson(res, 400, { error: 'empty_file' }); return true; }
      if (bytes.length > MAX_CASE_DOCUMENT_BYTES) { sendJson(res, 413, { error: 'file_too_large', max_mb: 100 }); return true; }
      const uploadDir = caseDocumentsDir(dbPath);
      fs.mkdirSync(uploadDir, { recursive: true });
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${name}`;
      const filePath = pathModule.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, bytes);
      sendJson(res, 201, {
        ok: true,
        name,
        path: filePath,
        mime: CASE_DOCUMENT_MIME[ext],
        size: bytes.length
      });
      return true;
    }

    if (path === '/api/general-case-files/preview' && req.method === 'GET') {
      const session = await getRequestSession(req, dbPath);
      if (!session) { sendJson(res, 401, { error: 'auth_required' }); return true; }
      const requestedPath = String(parsedUrl.searchParams.get('path') || '').trim();
      const uploadDir = caseDocumentsDir(dbPath);
      const filePath = pathModule.resolve(requestedPath);
      if (!requestedPath || !isPathInside(uploadDir, filePath)) {
        sendJson(res, 403, { error: 'preview_path_forbidden' });
        return true;
      }
      let stat;
      try { stat = fs.statSync(filePath); } catch { sendJson(res, 404, { error: 'file_not_found' }); return true; }
      if (!stat.isFile()) { sendJson(res, 404, { error: 'file_not_found' }); return true; }
      const ext = pathModule.extname(filePath).toLowerCase();
      if (ext === '.pdf') { streamInlineFile(res, filePath, CASE_DOCUMENT_MIME[ext]); return true; }
      if (ext === '.doc' || ext === '.docx') {
        const cacheDir = pathModule.join(pathModule.dirname(dbPath), 'preview-cache');
        fs.mkdirSync(cacheDir, { recursive: true });
        const cacheKey = crypto.createHash('sha256').update(`${filePath}|${stat.mtimeMs}|${stat.size}`).digest('hex');
        const pdfPath = pathModule.join(cacheDir, `${cacheKey}.pdf`);
        try {
          if (!fs.existsSync(pdfPath)) await convertWordDocumentToPdf(filePath, pdfPath);
          streamInlineFile(res, pdfPath, 'application/pdf');
        } catch (error) {
          sendJson(res, 501, { error: 'word_preview_unavailable', message: error.message });
        }
        return true;
      }
      sendJson(res, 415, { error: 'unsupported_file_type' });
      return true;
    }

    if (path === '/api/general-case-files/open' && req.method === 'POST') {
      const session = await getRequestSession(req, dbPath);
      if (!session) { sendJson(res, 401, { error: 'auth_required' }); return true; }
      const body = await readBody(req);
      const requestedPath = String(body.path || '').trim();
      const uploadDir = caseDocumentsDir(dbPath);
      const filePath = pathModule.resolve(requestedPath);
      if (!requestedPath || !isPathInside(uploadDir, filePath)) {
        sendJson(res, 403, { error: 'open_path_forbidden' });
        return true;
      }
      let stat;
      try { stat = fs.statSync(filePath); } catch { sendJson(res, 404, { error: 'file_not_found' }); return true; }
      if (!stat.isFile()) { sendJson(res, 404, { error: 'file_not_found' }); return true; }
      try {
        await openFileWithSystem(filePath);
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 500, { error: 'open_failed', message: error.message });
      }
      return true;
    }

    if (path === '/api/users' && req.method === 'GET') {
      const rows = await all(dbPath, 'SELECT full_name FROM users ORDER BY full_name', []).catch(() => []);
      const users = rows.map(row => row.full_name).filter(Boolean);
      sendJson(res, 200, users.length ? users : ['Администратор']);
      return true;
    }

    if (path === '/api/notifications' && req.method === 'GET') {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }
      const items = await buildUserNotifications(dbPath, session);
      sendJson(res, 200, {
        items,
        unread_count: items.filter(item => Number(item.unread) === 1).length,
        active_count: items.filter(item => item.status === 'active').length,
        overdue_count: items.filter(item => item.status === 'overdue').length
      });
      return true;
    }

    if (path === '/api/notifications/read' && req.method === 'POST') {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }
      const body = await readBody(req);
      const keys = Array.isArray(body.keys)
        ? [...new Set(body.keys.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 500)
        : [];
      const now = new Date().toISOString();
      for (const key of keys) {
        await run(dbPath, `
          INSERT OR REPLACE INTO notification_reads (user_name, notification_key, read_at)
          VALUES (?, ?, ?)
        `, [session.full_name, key, now]);
      }
      sendJson(res, 200, { ok: true, changed: keys.length });
      return true;
    }

    if (path === '/api/options' && req.method === 'GET') {
      const category = parsedUrl.searchParams.get('category') || '';
      const rows = await all(dbPath, 'SELECT value FROM app_options WHERE category=? ORDER BY value', [category]);
      sendJson(res, 200, rows.map(r => r.value)); return true;
    }
    if (path === '/api/general-cases' && req.method === 'GET') {
      const archived = parsedUrl.searchParams.get('archived') === '1';
      const search = (parsedUrl.searchParams.get('search') || '').trim();
      const table = archived ? 'general_cases_archive' : 'general_cases';
      const cols = ['case_no','court_no','court','judge','executor','category','procedural_position','claim_subject','claim_address','registration_date','review_result','plaintiff','defendant','comments','judicial_act_date_first','first_instance_act_type','motivated_decision_date','appeal_act_date','cassation_act_date','documents_json','process_kind','act_instance','proceeding_form','appeal_kind','order_copy_date','apk_cassation_has_appeal','supervision_cassation_exhausted','late_motivated_received','appeals_json','emergency_fund_flag','registry_flag'];
      const where = search ? 'WHERE ' + cols.map(c => `LOWER(COALESCE(${c},'')) LIKE LOWER(?)`).join(' OR ') : '';
      const params = search ? cols.map(() => `%${search}%`) : [];
      const rows = await all(dbPath, `SELECT * FROM ${table} ${where} ORDER BY id DESC LIMIT 2000`, params);
      sendJson(res, 200, rows); return true;
    }
    if (path === '/api/general-cases' && req.method === 'POST') {
      const rawGeneralBody = await readBody(req);
      const d = normCase(rawGeneralBody);
      const result = await run(dbPath, `INSERT INTO general_cases (case_no,court_no,court,judge,executor,category,procedural_position,claim_subject,claim_address,registration_date,review_result,control_flag,attendance_flag,attendance_hearing_missing,review_show_flag,emergency_fund_flag,registry_flag,comments,judicial_act_date_first,first_instance_act_type,motivated_decision_date,appeal_act_date,cassation_act_date,documents_json,process_kind,act_instance,proceeding_form,appeal_kind,order_copy_date,apk_cassation_has_appeal,supervision_cassation_exhausted,late_motivated_received,appeals_json,created_at,updated_at,plaintiff,defendant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [d.case_no,d.court_no,d.court,d.judge,d.executor,d.category,d.procedural_position,d.claim_subject,d.claim_address,d.registration_date,d.review_result,d.control_flag,d.attendance_flag,d.attendance_hearing_missing,d.review_show_flag,d.emergency_fund_flag,d.registry_flag,d.comments,d.judicial_act_date_first,d.first_instance_act_type,d.motivated_decision_date,d.appeal_act_date,d.cassation_act_date,d.documents_json,d.process_kind,d.act_instance,d.proceeding_form,d.appeal_kind,d.order_copy_date,d.apk_cassation_has_appeal,d.supervision_cassation_exhausted,d.late_motivated_received,d.appeals_json,new Date().toISOString(),new Date().toISOString(),d.plaintiff,d.defendant]);
      if (!rawGeneralBody.skip_linked) await syncLinked(dbPath, result.id, d);
      sendJson(res, 201, await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [result.id])); return true;
    }

    const controlLinkMatch = path.match(/^\/api\/general-cases\/(\d+)\/controlled-link$/);
    if (controlLinkMatch && req.method === 'POST') {
      const id = Number(controlLinkMatch[1]);
      const body = await readBody(req);
      const historyText = String(body.history_text || body.result || '').trim();
      const row = await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [id]);

      if (!row) {
        sendJson(res, 404, { error: 'general_case_not_found' });
        return true;
      }

      const existing = await get(dbPath, 'SELECT id FROM controlled_cases WHERE general_case_id=? LIMIT 1', [id]);
      const vals = [
        row.case_no || '',
        row.plaintiff || '',
        row.defendant || '',
        row.claim_subject || '',
        row.executor || '',
        historyText,
        row.court_no || '',
        row.court || '',
        id,
        new Date().toISOString()
      ];

      if (existing) {
        await run(dbPath, `UPDATE controlled_cases SET case_number=?, plaintiff=?, defendant=?, subject=?, representative=?, result=?, court_case_number=?, court=?, general_case_id=?, updated_at=? WHERE id=?`, [...vals, existing.id]);
        sendJson(res, 200, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [existing.id]));
      } else {
        const result = await run(dbPath, `INSERT INTO controlled_cases (case_number, plaintiff, defendant, subject, representative, result, court_case_number, court, general_case_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, vals);
        sendJson(res, 201, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [result.id]));
      }
      return true;
    }

    const attendanceHearingMatch = path.match(/^\/api\/general-cases\/(\d+)\/attendance-hearing$/);
    if (attendanceHearingMatch && req.method === 'POST') {
      const id = Number(attendanceHearingMatch[1]);
      const body = await readBody(req);
      const hearingDate = String(body.hearing_date || '').trim();
      const hearingTime = String(body.hearing_time || body.time || '').trim();
      const currentUser = String(body.user || '').trim();
      const isoDate = ruDateToIsoServer(hearingDate);
      const row = await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [id]);

      if (!row) {
        sendJson(res, 404, { error: 'general_case_not_found' });
        return true;
      }

      if (!isoDate || !hearingTime) {
        sendJson(res, 400, { error: 'invalid_hearing_datetime' });
        return true;
      }

      const existingDate = await get(dbPath, 'SELECT id FROM court_schedule WHERE is_date_row=1 AND session_date=? LIMIT 1', [hearingDate]);
      if (!existingDate) {
        await run(dbPath, `INSERT INTO court_schedule (session_date, court, time, representative, plaintiff, defendant, category, result, is_date_row, hearing_date, general_case_id, created_at, updated_at) VALUES (?, '', '', '', '', '', '', '', 1, '', NULL, ?, ?)`, [hearingDate, new Date().toISOString(), new Date().toISOString()]);
      }

      const scheduleVals = [
        hearingDate,
        row.court || '',
        hearingTime,
        row.executor || currentUser || '',
        row.plaintiff || '',
        row.defendant || '',
        row.review_result || '',
        row.claim_subject || '',
        0,
        '',
        id,
        new Date().toISOString()
      ];

      const existingSchedule = await get(dbPath, 'SELECT id FROM court_schedule WHERE general_case_id=? AND is_date_row=0 LIMIT 1', [id]);
      let scheduleRow;
      if (existingSchedule) {
        await run(dbPath, `UPDATE court_schedule SET session_date=?, court=?, time=?, representative=?, plaintiff=?, defendant=?, category=?, result=?, is_date_row=?, hearing_date=?, general_case_id=?, updated_at=? WHERE id=?`, [...scheduleVals, existingSchedule.id]);
        scheduleRow = await get(dbPath, 'SELECT * FROM court_schedule WHERE id=?', [existingSchedule.id]);
      } else {
        const scheduleResult = await run(dbPath, `INSERT INTO court_schedule (session_date, court, time, representative, plaintiff, defendant, category, result, is_date_row, hearing_date, general_case_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, scheduleVals);
        scheduleRow = await get(dbPath, 'SELECT * FROM court_schedule WHERE id=?', [scheduleResult.id]);
      }

      const desc = `Явочное дело № ${row.case_no || ''} по предмету ${row.claim_subject || ''}`.trim();
      const assignment = `${desc}\nИстец: ${row.plaintiff || ''}\nОтветчик: ${row.defendant || ''}`;
      const calendarVals = [
        isoDate, isoDate,
        currentUser || row.executor || 'Администратор', currentUser || row.executor || 'Администратор',
        'судебное_заседание', 'судебное_заседание',
        desc || 'Судебное заседание', desc || 'Судебное заседание',
        hearingTime, hearingTime,
        row.court || '',
        row.claim_subject || '',
        assignment,
        0,
        null,
        id,
        new Date().toISOString()
      ];

      const existingTask = await get(dbPath, 'SELECT id FROM calendar_tasks WHERE general_case_id=? LIMIT 1', [id]);
      let calendarRow;
      if (existingTask) {
        await run(dbPath, `UPDATE calendar_tasks SET date_str=?, "date"=?, user_name=?, "user"=?, task_type=?, "type"=?, description=?, "desc"=?, time_val=?, "time"=?, court=?, subject=?, assignment=?, done=?, meeting_id=COALESCE(?, meeting_id), general_case_id=?, created_at=COALESCE(created_at, ?) WHERE id=?`, [...calendarVals, existingTask.id]);
        calendarRow = await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [existingTask.id]);
      } else {
        const calendarResult = await run(dbPath, `INSERT INTO calendar_tasks (date_str, "date", user_name, "user", task_type, "type", description, "desc", time_val, "time", court, subject, assignment, done, meeting_id, general_case_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, calendarVals);
        calendarRow = await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [calendarResult.id]);
      }

      sendJson(res, 200, { ok: true, schedule: scheduleRow, calendar: calendarRow });
      return true;
    }

    const generalArchiveRestoreMatch = path.match(/^\/api\/general-cases\/archive\/(\d+)\/restore$/);
    if (generalArchiveRestoreMatch && req.method === 'POST') {
      const archiveId = Number(generalArchiveRestoreMatch[1]);
      const row = await get(dbPath, 'SELECT * FROM general_cases_archive WHERE id=?', [archiveId]);

      if (!row) {
        sendJson(res, 404, { error: 'general_case_archive_not_found' });
        return true;
      }

      const result = await run(dbPath, `INSERT INTO general_cases (case_no,court_no,court,judge,executor,category,procedural_position,claim_subject,claim_address,registration_date,review_result,control_flag,attendance_flag,attendance_hearing_missing,review_show_flag,emergency_fund_flag,registry_flag,comments,judicial_act_date_first,first_instance_act_type,motivated_decision_date,appeal_act_date,cassation_act_date,documents_json,process_kind,act_instance,proceeding_form,appeal_kind,order_copy_date,apk_cassation_has_appeal,supervision_cassation_exhausted,late_motivated_received,appeals_json,created_at,updated_at,plaintiff,defendant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.case_no,row.court_no,row.court,row.judge,row.executor,row.category,row.procedural_position,row.claim_subject,row.claim_address || '',row.registration_date,row.review_result,row.control_flag,row.attendance_flag,row.attendance_hearing_missing || 0,row.review_show_flag || 0,row.emergency_fund_flag || 0,row.registry_flag || 0,row.comments || '',row.judicial_act_date_first || '',row.first_instance_act_type || '',row.motivated_decision_date || '',row.appeal_act_date || '',row.cassation_act_date || '',row.documents_json || '',row.process_kind || '',row.act_instance || '',row.proceeding_form || '',row.appeal_kind || '',row.order_copy_date || '',row.apk_cassation_has_appeal || '',row.supervision_cassation_exhausted || '',row.late_motivated_received || '',row.appeals_json || '',new Date().toISOString(),new Date().toISOString(),row.plaintiff,row.defendant]);
      await run(dbPath, 'DELETE FROM general_cases_archive WHERE id=?', [archiveId]);
      sendJson(res, 200, await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [result.id]));
      return true;
    }

    const m = path.match(/^\/api\/general-cases\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      if (req.method === 'GET') { sendJson(res, 200, await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [id])); return true; }
      if (req.method === 'PUT') {
        const rawGeneralBody = await readBody(req);
        const d = normCase(rawGeneralBody);
        await run(dbPath, `UPDATE general_cases SET case_no=?,court_no=?,court=?,judge=?,executor=?,category=?,procedural_position=?,claim_subject=?,claim_address=?,registration_date=?,review_result=?,control_flag=?,attendance_flag=?,attendance_hearing_missing=?,review_show_flag=?,emergency_fund_flag=?,registry_flag=?,comments=?,judicial_act_date_first=?,first_instance_act_type=?,motivated_decision_date=?,appeal_act_date=?,cassation_act_date=?,documents_json=?,process_kind=?,act_instance=?,proceeding_form=?,appeal_kind=?,order_copy_date=?,apk_cassation_has_appeal=?,supervision_cassation_exhausted=?,late_motivated_received=?,appeals_json=?,updated_at=?,plaintiff=?,defendant=? WHERE id=?`, [d.case_no,d.court_no,d.court,d.judge,d.executor,d.category,d.procedural_position,d.claim_subject,d.claim_address,d.registration_date,d.review_result,d.control_flag,d.attendance_flag,d.attendance_hearing_missing,d.review_show_flag,d.emergency_fund_flag,d.registry_flag,d.comments,d.judicial_act_date_first,d.first_instance_act_type,d.motivated_decision_date,d.appeal_act_date,d.cassation_act_date,d.documents_json,d.process_kind,d.act_instance,d.proceeding_form,d.appeal_kind,d.order_copy_date,d.apk_cassation_has_appeal,d.supervision_cassation_exhausted,d.late_motivated_received,d.appeals_json,new Date().toISOString(),d.plaintiff,d.defendant,id]);
        if (!rawGeneralBody.skip_linked) await syncLinked(dbPath, id, d);
        sendJson(res, 200, await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [id])); return true;
      }
      if (req.method === 'DELETE') {
        const row = await get(dbPath, 'SELECT * FROM general_cases WHERE id=?', [id]);
        if (row) {
          await run(dbPath, `INSERT INTO general_cases_archive (source_id,case_no,court_no,court,judge,executor,category,procedural_position,claim_subject,claim_address,registration_date,review_result,control_flag,attendance_flag,attendance_hearing_missing,review_show_flag,emergency_fund_flag,registry_flag,comments,judicial_act_date_first,first_instance_act_type,motivated_decision_date,appeal_act_date,cassation_act_date,documents_json,process_kind,act_instance,proceeding_form,appeal_kind,order_copy_date,apk_cassation_has_appeal,supervision_cassation_exhausted,late_motivated_received,appeals_json,archived_at,plaintiff,defendant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [row.id,row.case_no,row.court_no,row.court,row.judge,row.executor,row.category,row.procedural_position,row.claim_subject,row.claim_address || '',row.registration_date,row.review_result,row.control_flag,row.attendance_flag,row.attendance_hearing_missing || 0,row.review_show_flag || 0,row.emergency_fund_flag || 0,row.registry_flag || 0,row.comments || '',row.judicial_act_date_first || '',row.first_instance_act_type || '',row.motivated_decision_date || '',row.appeal_act_date || '',row.cassation_act_date || '',row.documents_json || '',row.process_kind || '',row.act_instance || '',row.proceeding_form || '',row.appeal_kind || '',row.order_copy_date || '',row.apk_cassation_has_appeal || '',row.supervision_cassation_exhausted || '',row.late_motivated_received || '',row.appeals_json || '',new Date().toISOString(),row.plaintiff,row.defendant]);
          await run(dbPath, 'DELETE FROM general_cases WHERE id=?', [id]);
        }
        sendJson(res, 200, { ok: true }); return true;
      }
    }

    if (path === '/api/controlled-cases' && req.method === 'GET') {
      const search = (parsedUrl.searchParams.get('search') || '').trim();
      const cols = ['case_number','plaintiff','defendant','subject','representative','result','court_case_number','court'];
      const where = search ? 'WHERE ' + cols.map(c => `LOWER(COALESCE(${c},'')) LIKE LOWER(?)`).join(' OR ') : '';
      const params = search ? cols.map(() => `%${search}%`) : [];
      sendJson(res, 200, await all(dbPath, `SELECT * FROM controlled_cases ${where} ORDER BY id DESC LIMIT 2000`, params));
      return true;
    }

    if (path === '/api/controlled-cases' && req.method === 'POST') {
      const d = normControlled(await readBody(req));
      const result = await run(dbPath, `
        INSERT INTO controlled_cases (
          case_number, plaintiff, defendant, subject, representative, result,
          court_case_number, court, general_case_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.case_number, d.plaintiff, d.defendant, d.subject, d.representative, d.result,
        d.court_case_number, d.court, d.general_case_id, new Date().toISOString(), new Date().toISOString()
      ]);

      sendJson(res, 201, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [result.id]));
      return true;
    }

    if (path === '/api/controlled-cases/archive' && req.method === 'GET') {
      const rows = await all(dbPath, 'SELECT * FROM archive WHERE table_name=? ORDER BY id DESC LIMIT 2000', ['controlled_cases']);
      sendJson(res, 200, rows.map(row => {
        let data = {};
        try { data = JSON.parse(row.data || '{}'); } catch {}
        return { ...row, data };
      }));
      return true;
    }

    const controlledArchiveRestoreMatch = path.match(/^\/api\/controlled-cases\/archive\/(\d+)\/restore$/);
    if (controlledArchiveRestoreMatch && req.method === 'POST') {
      const archiveId = Number(controlledArchiveRestoreMatch[1]);
      const archiveRow = await get(dbPath, 'SELECT * FROM archive WHERE id=? AND table_name=?', [archiveId, 'controlled_cases']);

      if (!archiveRow) {
        sendJson(res, 404, { error: 'archive_record_not_found' });
        return true;
      }

      let parsed = {};
      try { parsed = JSON.parse(archiveRow.data || '{}'); } catch {}
      const d = normControlled(parsed);

      const result = await run(dbPath, `
        INSERT INTO controlled_cases (
          case_number, plaintiff, defendant, subject, representative, result,
          court_case_number, court, general_case_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.case_number, d.plaintiff, d.defendant, d.subject, d.representative, d.result,
        d.court_case_number, d.court, d.general_case_id, new Date().toISOString(), new Date().toISOString()
      ]);

      await run(dbPath, 'DELETE FROM archive WHERE id=?', [archiveId]);
      sendJson(res, 200, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [result.id]));
      return true;
    }

    const controlledArchiveDeleteMatch = path.match(/^\/api\/controlled-cases\/archive\/(\d+)$/);
    if (controlledArchiveDeleteMatch && req.method === 'DELETE') {
      await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [Number(controlledArchiveDeleteMatch[1]), 'controlled_cases']);
      sendJson(res, 200, { ok: true });
      return true;
    }

    const controlledMatch = path.match(/^\/api\/controlled-cases\/(\d+)$/);
    if (controlledMatch) {
      const id = Number(controlledMatch[1]);

      if (req.method === 'GET') {
        sendJson(res, 200, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'PUT') {
        const d = normControlled(await readBody(req));
        await run(dbPath, `
          UPDATE controlled_cases
          SET case_number=?, plaintiff=?, defendant=?, subject=?, representative=?, result=?,
              court_case_number=?, court=?, general_case_id=COALESCE(?, general_case_id), updated_at=?
          WHERE id=?
        `, [
          d.case_number, d.plaintiff, d.defendant, d.subject, d.representative, d.result,
          d.court_case_number, d.court, d.general_case_id, new Date().toISOString(), id
        ]);

        sendJson(res, 200, await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'DELETE') {
        const row = await get(dbPath, 'SELECT * FROM controlled_cases WHERE id=?', [id]);

        if (row) {
          await run(dbPath, 'INSERT INTO archive (table_name, record_id, data, archived_at) VALUES (?, ?, ?, ?)', [
            'controlled_cases',
            id,
            JSON.stringify(row),
            new Date().toISOString()
          ]);

          await run(dbPath, 'DELETE FROM controlled_cases WHERE id=?', [id]);
        }

        sendJson(res, 200, { ok: true });
        return true;
      }
    }


    if (path === '/api/enforcement' && req.method === 'GET') {
      const mode = parsedUrl.searchParams.get('mode') || '';
      const archived = parsedUrl.searchParams.get('archived') === '1';
      const search = (parsedUrl.searchParams.get('search') || '').trim();

      const cols = [
        'case_number', 'ip_number', 'subject_execution', 'date_start', 'start_date',
        'basis', 'start_basis', 'appeal_info', 'deadline', 'execution_deadline',
        'amount_claimed', 'claim_sum', 'payment_info', 'total_paid', 'debt', 'production_character'
      ];

      const where = ['archived=?'];
      const params = [archived ? 1 : 0];

      if (mode) {
        where.push('mode=?');
        params.push(mode);
      }

      if (search) {
        where.push('(' + cols.map(c => `LOWER(COALESCE(${c},'')) LIKE LOWER(?)`).join(' OR ') + ')');
        params.push(...cols.map(() => `%${search}%`));
      }

      sendJson(res, 200, await all(dbPath, `SELECT * FROM enforcement_proceedings WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 2000`, params));
      return true;
    }

    if (path === '/api/enforcement' && req.method === 'POST') {
      const d = normEnforcement(await readBody(req));
      const result = await run(dbPath, `
        INSERT INTO enforcement_proceedings (
          mode, archived, case_number, ip_number, subject_execution,
          date_start, start_date, basis, start_basis, appeal_info,
          deadline, execution_deadline, term_execution, nature, production_character,
          amount_claimed, claim_sum, claim_amount, payment_info, payments_json,
          total_paid, amount_paid_total, debt, debt_amount, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.mode, 0, d.case_number, d.ip_number, d.subject_execution,
        d.date_start, d.start_date, d.basis, d.start_basis, d.appeal_info,
        d.deadline, d.execution_deadline, d.term_execution, d.nature, d.production_character,
        d.amount_claimed, d.claim_sum, d.claim_amount, d.payment_info, d.payments_json,
        d.total_paid, d.amount_paid_total, d.debt, d.debt_amount, new Date().toISOString(), new Date().toISOString()
      ]);

      sendJson(res, 201, await get(dbPath, 'SELECT * FROM enforcement_proceedings WHERE id=?', [result.id]));
      return true;
    }

    if (path === '/api/enforcement/archive' && req.method === 'GET') {
      const mode = parsedUrl.searchParams.get('mode') || '';

      const rows = await all(dbPath, 'SELECT * FROM archive WHERE table_name=? ORDER BY id DESC LIMIT 2000', ['enforcement_proceedings']);
      const parsed = rows.map(row => {
        let data = {};
        try { data = JSON.parse(row.data || '{}'); } catch {}
        return { ...row, data };
      }).filter(row => !mode || row.data?.mode === mode);

      sendJson(res, 200, parsed);
      return true;
    }

    const enforcementArchiveRestoreMatch = path.match(/^\/api\/enforcement\/archive\/(\d+)\/restore$/);
    if (enforcementArchiveRestoreMatch && req.method === 'POST') {
      const archiveId = Number(enforcementArchiveRestoreMatch[1]);
      const archiveRow = await get(dbPath, 'SELECT * FROM archive WHERE id=? AND table_name=?', [archiveId, 'enforcement_proceedings']);

      if (!archiveRow) {
        sendJson(res, 404, { error: 'archive_record_not_found' });
        return true;
      }

      let data = {};
      try { data = JSON.parse(archiveRow.data || '{}'); } catch {}
      const d = normEnforcement(data);

      const result = await run(dbPath, `
        INSERT INTO enforcement_proceedings (
          mode, archived, case_number, ip_number, subject_execution,
          date_start, start_date, basis, start_basis, appeal_info,
          deadline, execution_deadline, term_execution, nature, production_character,
          amount_claimed, claim_sum, claim_amount, payment_info, payments_json,
          total_paid, amount_paid_total, debt, debt_amount, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.mode, 0, d.case_number, d.ip_number, d.subject_execution,
        d.date_start, d.start_date, d.basis, d.start_basis, d.appeal_info,
        d.deadline, d.execution_deadline, d.term_execution, d.nature, d.production_character,
        d.amount_claimed, d.claim_sum, d.claim_amount, d.payment_info, d.payments_json,
        d.total_paid, d.amount_paid_total, d.debt, d.debt_amount, new Date().toISOString(), new Date().toISOString()
      ]);

      await run(dbPath, 'DELETE FROM archive WHERE id=?', [archiveId]);
      sendJson(res, 200, await get(dbPath, 'SELECT * FROM enforcement_proceedings WHERE id=?', [result.id]));
      return true;
    }

    const enforcementArchiveDeleteMatch = path.match(/^\/api\/enforcement\/archive\/(\d+)$/);
    if (enforcementArchiveDeleteMatch && req.method === 'DELETE') {
      await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [Number(enforcementArchiveDeleteMatch[1]), 'enforcement_proceedings']);
      sendJson(res, 200, { ok: true });
      return true;
    }

    const enforcementArchiveMatch = path.match(/^\/api\/enforcement\/(\d+)\/archive$/);
    if (enforcementArchiveMatch && req.method === 'POST') {
      const id = Number(enforcementArchiveMatch[1]);
      const row = await get(dbPath, 'SELECT * FROM enforcement_proceedings WHERE id=?', [id]);

      if (row) {
        await run(dbPath, 'INSERT INTO archive (table_name, record_id, data, archived_at) VALUES (?, ?, ?, ?)', [
          'enforcement_proceedings',
          id,
          JSON.stringify(row),
          new Date().toISOString()
        ]);
        await run(dbPath, 'DELETE FROM enforcement_proceedings WHERE id=?', [id]);
      }

      sendJson(res, 200, { ok: true });
      return true;
    }

    const enforcementMatch = path.match(/^\/api\/enforcement\/(\d+)$/);
    if (enforcementMatch) {
      const id = Number(enforcementMatch[1]);

      if (req.method === 'GET') {
        sendJson(res, 200, await get(dbPath, 'SELECT * FROM enforcement_proceedings WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'PUT') {
        const d = normEnforcement(await readBody(req));
        await run(dbPath, `
          UPDATE enforcement_proceedings
          SET mode=?, archived=?, case_number=?, ip_number=?, subject_execution=?,
              date_start=?, start_date=?, basis=?, start_basis=?, appeal_info=?,
              deadline=?, execution_deadline=?, term_execution=?, nature=?, production_character=?,
              amount_claimed=?, claim_sum=?, claim_amount=?, payment_info=?, payments_json=?,
              total_paid=?, amount_paid_total=?, debt=?, debt_amount=?, updated_at=?
          WHERE id=?
        `, [
          d.mode, 0, d.case_number, d.ip_number, d.subject_execution,
          d.date_start, d.start_date, d.basis, d.start_basis, d.appeal_info,
          d.deadline, d.execution_deadline, d.term_execution, d.nature, d.production_character,
          d.amount_claimed, d.claim_sum, d.claim_amount, d.payment_info, d.payments_json,
          d.total_paid, d.amount_paid_total, d.debt, d.debt_amount, new Date().toISOString(), id
        ]);

        sendJson(res, 200, await get(dbPath, 'SELECT * FROM enforcement_proceedings WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'DELETE') {
        await run(dbPath, 'DELETE FROM enforcement_proceedings WHERE id=?', [id]);
        sendJson(res, 200, { ok: true });
        return true;
      }
    }





if (path === '/api/meetings' && req.method === 'GET') {
  sendJson(res, 200, await all(dbPath, 'SELECT * FROM meetings ORDER BY date_val DESC, time_val DESC, id DESC LIMIT 5000'));
  return true;
}

if (path === '/api/meetings' && req.method === 'POST') {
  const d = normMeeting(await readBody(req));
  const result = await run(dbPath, `INSERT INTO meetings (title,date_val,time_val,agenda,protocol,participants,attachment_path,has_participants_list,has_telegram,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.title,d.date_val,d.time_val,d.agenda,d.protocol,d.participants,d.attachment_path,d.has_participants_list,d.has_telegram,new Date().toISOString(),new Date().toISOString()]);
  sendJson(res, 201, await get(dbPath, 'SELECT * FROM meetings WHERE id=?', [result.id]));
  return true;
}

const meetingsMatch = path.match(/^\/api\/meetings\/(\d+)$/);
if (meetingsMatch) {
  const id = Number(meetingsMatch[1]);
  if (req.method === 'PUT') {
    const d = normMeeting(await readBody(req));
    await run(dbPath, `UPDATE meetings SET title=?, date_val=?, time_val=?, agenda=?, protocol=?, participants=?, attachment_path=?, has_participants_list=?, has_telegram=?, updated_at=? WHERE id=?`,
      [d.title,d.date_val,d.time_val,d.agenda,d.protocol,d.participants,d.attachment_path,d.has_participants_list,d.has_telegram,new Date().toISOString(),id]);
    sendJson(res, 200, await get(dbPath, 'SELECT * FROM meetings WHERE id=?', [id]));
    return true;
  }
  if (req.method === 'DELETE') {
    await run(dbPath, 'DELETE FROM meetings WHERE id=?', [id]);
    sendJson(res, 200, { ok: true });
    return true;
  }
}

if (path === '/api/municipal-registry' && req.method === 'GET') {
  const search = String(parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
  const rows = await all(dbPath, 'SELECT * FROM registry ORDER BY id DESC LIMIT 5000');
  if (!search) { sendJson(res, 200, rows); return true; }
  const parts = search.split(',').map(s => s.trim()).filter(Boolean);
  sendJson(res, 200, rows.filter(row => {
    const haystack = Object.values(row).map(value => String(value ?? '').toLowerCase()).join(' | ');
    return parts.every(part => haystack.includes(part));
  }));
  return true;
}

if (path === '/api/municipal-registry/archive' && req.method === 'GET') {
  const rows = await all(dbPath, 'SELECT * FROM archive WHERE table_name=? ORDER BY id DESC LIMIT 5000', ['registry']);
  sendJson(res, 200, rows.map(row => {
    let data = {};
    try { data = JSON.parse(row.data || '{}'); } catch {}
    return { ...data, archive_id: row.id, original_id: row.record_id, archived_at: row.archived_at };
  }));
  return true;
}

if (path === '/api/municipal-registry' && req.method === 'POST') {
  const d = normMunicipalRegistry(await readBody(req));
  const result = await run(dbPath, `INSERT INTO registry (pk_number,kvartal,address,fio,property_type,notes,court,stage,court_act_date,court_act_number,court_act,requirements,appeal,execution,collected,review_ready,attachments_json,general_case_id,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.pk_number,d.kvartal,d.address,d.fio,d.property_type,d.notes,d.court,d.stage,d.court_act_date,d.court_act_number,d.court_act || [d.court_act_date,d.court_act_number].filter(Boolean).join(', '),d.requirements,d.appeal,d.execution,d.collected,d.review_ready,d.attachments_json,d.general_case_id,new Date().toISOString(),new Date().toISOString()]);
  sendJson(res, 201, await get(dbPath, 'SELECT * FROM registry WHERE id=?', [result.id]));
  return true;
}

const registryArchiveRestoreMatch = path.match(/^\/api\/municipal-registry\/archive\/(\d+)\/restore$/);
if (registryArchiveRestoreMatch && req.method === 'POST') {
  const archiveId = Number(registryArchiveRestoreMatch[1]);
  const archiveRow = await get(dbPath, 'SELECT * FROM archive WHERE id=? AND table_name=?', [archiveId, 'registry']);
  if (!archiveRow) { sendJson(res, 404, { error: 'archive_record_not_found' }); return true; }
  let d = {}; try { d = normMunicipalRegistry(JSON.parse(archiveRow.data || '{}')); } catch { d = normMunicipalRegistry({}); }
  const result = await run(dbPath, `INSERT INTO registry (pk_number,kvartal,address,fio,property_type,notes,court,stage,court_act_date,court_act_number,court_act,requirements,appeal,execution,collected,review_ready,attachments_json,general_case_id,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.pk_number,d.kvartal,d.address,d.fio,d.property_type,d.notes,d.court,d.stage,d.court_act_date,d.court_act_number,d.court_act,d.requirements,d.appeal,d.execution,d.collected,d.review_ready,d.attachments_json,d.general_case_id,new Date().toISOString(),new Date().toISOString()]);
  await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [archiveId, 'registry']);
  sendJson(res, 200, await get(dbPath, 'SELECT * FROM registry WHERE id=?', [result.id]));
  return true;
}

const registryArchiveDeleteMatch = path.match(/^\/api\/municipal-registry\/archive\/(\d+)$/);
if (registryArchiveDeleteMatch && req.method === 'DELETE') {
  await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [Number(registryArchiveDeleteMatch[1]), 'registry']);
  sendJson(res, 200, { ok: true });
  return true;
}

const registryArchiveMatch = path.match(/^\/api\/municipal-registry\/(\d+)\/archive$/);
if (registryArchiveMatch && req.method === 'POST') {
  const id = Number(registryArchiveMatch[1]);
  const row = await get(dbPath, 'SELECT * FROM registry WHERE id=?', [id]);
  if (!row) { sendJson(res, 404, { error: 'not_found' }); return true; }
  await run(dbPath, 'INSERT INTO archive (table_name, record_id, data) VALUES (?, ?, ?)', ['registry', id, JSON.stringify(row)]);
  await run(dbPath, 'DELETE FROM registry WHERE id=?', [id]);
  sendJson(res, 200, { ok: true });
  return true;
}

const registryMatch = path.match(/^\/api\/municipal-registry\/(\d+)$/);
if (registryMatch) {
  const id = Number(registryMatch[1]);
  if (req.method === 'PUT') {
    const d = normMunicipalRegistry(await readBody(req));
    await run(dbPath, `UPDATE registry SET pk_number=?, kvartal=?, address=?, fio=?, property_type=?, notes=?, court=?, stage=?, court_act_date=?, court_act_number=?, court_act=?, requirements=?, appeal=?, execution=?, collected=?, review_ready=?, attachments_json=?, general_case_id=?, updated_at=? WHERE id=?`,
      [d.pk_number,d.kvartal,d.address,d.fio,d.property_type,d.notes,d.court,d.stage,d.court_act_date,d.court_act_number,d.court_act || [d.court_act_date,d.court_act_number].filter(Boolean).join(', '),d.requirements,d.appeal,d.execution,d.collected,d.review_ready,d.attachments_json,d.general_case_id,new Date().toISOString(),id]);
    sendJson(res, 200, await get(dbPath, 'SELECT * FROM registry WHERE id=?', [id]));
    return true;
  }
  if (req.method === 'DELETE') {
    await run(dbPath, 'DELETE FROM registry WHERE id=?', [id]);
    sendJson(res, 200, { ok: true });
    return true;
  }
}

if (path === '/api/emergency-fund' && req.method === 'GET') {
  const search = String(parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
  const rows = await all(dbPath, 'SELECT * FROM emergency_fund ORDER BY id DESC LIMIT 5000');

  if (!search) {
    sendJson(res, 200, rows);
    return true;
  }

  const parts = search.split(',').map(s => s.trim()).filter(Boolean);
  const filtered = rows.filter(row => {
    const haystack = Object.values(row).map(value => String(value ?? '').toLowerCase()).join(' | ');
    return parts.every(part => haystack.includes(part));
  });

  sendJson(res, 200, filtered);
  return true;
}

if (path === '/api/emergency-fund' && req.method === 'POST') {
  const d = normEmergencyFund(await readBody(req));
  const result = await run(dbPath, `
    INSERT INTO emergency_fund (
      kvartal, pk_number, fio, prosecutor, address, district, requirements, stage,
      case_number, judicial_act_date, appeal, claim_amount, collected, area, address_exec,
      sum_property_claim, sum_property, execution, executors, notes, court, latitude, longitude,
      pk, case_num, sum_claim, provided_area, execution_quarter, review_ready,
      total_unfulfilled_sum, total_fulfilled_sum, total_unfulfilled_area, total_provided_area, execution_people_json,
      condemned_date, resettlement_deadline, general_case_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    d.kvartal, d.pk_number, d.fio, d.prosecutor, d.address, d.district, d.requirements, d.stage,
    d.case_number, d.judicial_act_date, d.appeal, d.claim_amount, d.collected, d.area, d.address_exec,
    d.sum_property_claim, d.sum_property, d.execution, d.executors, d.notes, d.court, d.latitude, d.longitude,
    d.pk, d.case_num, d.sum_claim, d.provided_area, d.execution_quarter, d.review_ready,
    d.total_unfulfilled_sum, d.total_fulfilled_sum, d.total_unfulfilled_area, d.total_provided_area, d.execution_people_json,
    d.condemned_date, d.resettlement_deadline, d.general_case_id, new Date().toISOString(), new Date().toISOString()
  ]);

  sendJson(res, 201, await get(dbPath, 'SELECT * FROM emergency_fund WHERE id=?', [result.id]));
  return true;
}

if (path === '/api/emergency-fund/archive' && req.method === 'GET') {
  const rows = await all(dbPath, 'SELECT * FROM archive WHERE table_name=? ORDER BY id DESC LIMIT 5000', ['emergency']);
  const parsed = rows.map(row => {
    let data = {};
    try { data = JSON.parse(row.data || '{}'); } catch {}
    return { ...data, archive_id: row.id, original_id: row.record_id, archived_at: row.archived_at };
  });
  sendJson(res, 200, parsed);
  return true;
}

const emergencyArchiveRestoreMatch = path.match(/^\/api\/emergency-fund\/archive\/(\d+)\/restore$/);
if (emergencyArchiveRestoreMatch && req.method === 'POST') {
  const archiveId = Number(emergencyArchiveRestoreMatch[1]);
  const archiveRow = await get(dbPath, 'SELECT * FROM archive WHERE id=? AND table_name=?', [archiveId, 'emergency']);

  if (!archiveRow) {
    sendJson(res, 404, { error: 'archive_record_not_found' });
    return true;
  }

  let d = {};
  try { d = normEmergencyFund(JSON.parse(archiveRow.data || '{}')); } catch { d = normEmergencyFund({}); }

  const result = await run(dbPath, `
    INSERT INTO emergency_fund (
      kvartal, pk_number, fio, prosecutor, address, district, requirements, stage,
      case_number, judicial_act_date, appeal, claim_amount, collected, area, address_exec,
      sum_property_claim, sum_property, execution, executors, notes, court, latitude, longitude,
      pk, case_num, sum_claim, provided_area, execution_quarter, review_ready,
      total_unfulfilled_sum, total_fulfilled_sum, total_unfulfilled_area, total_provided_area, execution_people_json,
      condemned_date, resettlement_deadline, general_case_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    d.kvartal, d.pk_number, d.fio, d.prosecutor, d.address, d.district, d.requirements, d.stage,
    d.case_number, d.judicial_act_date, d.appeal, d.claim_amount, d.collected, d.area, d.address_exec,
    d.sum_property_claim, d.sum_property, d.execution, d.executors, d.notes, d.court, d.latitude, d.longitude,
    d.pk, d.case_num, d.sum_claim, d.provided_area, d.execution_quarter, d.review_ready,
    d.total_unfulfilled_sum, d.total_fulfilled_sum, d.total_unfulfilled_area, d.total_provided_area, d.execution_people_json,
    d.condemned_date, d.resettlement_deadline, d.general_case_id, new Date().toISOString(), new Date().toISOString()
  ]);

  await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [archiveId, 'emergency']);
  sendJson(res, 200, await get(dbPath, 'SELECT * FROM emergency_fund WHERE id=?', [result.id]));
  return true;
}

const emergencyArchiveDeleteMatch = path.match(/^\/api\/emergency-fund\/archive\/(\d+)$/);
if (emergencyArchiveDeleteMatch && req.method === 'DELETE') {
  await run(dbPath, 'DELETE FROM archive WHERE id=? AND table_name=?', [Number(emergencyArchiveDeleteMatch[1]), 'emergency']);
  sendJson(res, 200, { ok: true });
  return true;
}

const emergencyArchiveMatch = path.match(/^\/api\/emergency-fund\/(\d+)\/archive$/);
if (emergencyArchiveMatch && req.method === 'POST') {
  const id = Number(emergencyArchiveMatch[1]);
  const row = await get(dbPath, 'SELECT * FROM emergency_fund WHERE id=?', [id]);

  if (!row) {
    sendJson(res, 404, { error: 'not_found' });
    return true;
  }

  try {
    await run(dbPath, 'INSERT INTO archive (table_name, record_id, data) VALUES (?, ?, ?)', ['emergency', id, JSON.stringify(row)]);
  } catch {
    await run(dbPath, `CREATE TABLE IF NOT EXISTS archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      data TEXT NOT NULL,
      archived_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(dbPath, 'INSERT INTO archive (table_name, record_id, data) VALUES (?, ?, ?)', ['emergency', id, JSON.stringify(row)]);
  }

  await run(dbPath, 'DELETE FROM emergency_fund WHERE id=?', [id]);
  sendJson(res, 200, { ok: true });
  return true;
}

const emergencyMatch = path.match(/^\/api\/emergency-fund\/(\d+)$/);
if (emergencyMatch) {
  const id = Number(emergencyMatch[1]);

  if (req.method === 'PUT') {
    const d = normEmergencyFund(await readBody(req));
    await run(dbPath, `
      UPDATE emergency_fund
      SET kvartal=?, pk_number=?, fio=?, prosecutor=?, address=?, district=?, requirements=?, stage=?,
          case_number=?, judicial_act_date=?, appeal=?, claim_amount=?, collected=?, area=?, address_exec=?,
          sum_property_claim=?, sum_property=?, execution=?, executors=?, notes=?, court=?, latitude=?, longitude=?,
          pk=?, case_num=?, sum_claim=?, provided_area=?, execution_quarter=?, review_ready=?,
          total_unfulfilled_sum=?, total_fulfilled_sum=?, total_unfulfilled_area=?, total_provided_area=?, execution_people_json=?,
          condemned_date=?, resettlement_deadline=?, general_case_id=?, updated_at=?
      WHERE id=?
    `, [
      d.kvartal, d.pk_number, d.fio, d.prosecutor, d.address, d.district, d.requirements, d.stage,
      d.case_number, d.judicial_act_date, d.appeal, d.claim_amount, d.collected, d.area, d.address_exec,
      d.sum_property_claim, d.sum_property, d.execution, d.executors, d.notes, d.court, d.latitude, d.longitude,
      d.pk, d.case_num, d.sum_claim, d.provided_area, d.execution_quarter, d.review_ready,
      d.total_unfulfilled_sum, d.total_fulfilled_sum, d.total_unfulfilled_area, d.total_provided_area, d.execution_people_json,
      d.condemned_date, d.resettlement_deadline, d.general_case_id, new Date().toISOString(), id
    ]);

    sendJson(res, 200, await get(dbPath, 'SELECT * FROM emergency_fund WHERE id=?', [id]));
    return true;
  }

  if (req.method === 'DELETE') {
    await run(dbPath, 'DELETE FROM emergency_fund WHERE id=?', [id]);
    sendJson(res, 200, { ok: true });
    return true;
  }
}

    if (path === '/api/court-schedule' && req.method === 'GET') {
      const rows = await all(dbPath, `
        SELECT *
        FROM court_schedule
        ORDER BY
          CASE WHEN session_date IS NULL OR session_date='' THEN 1 ELSE 0 END,
          substr(session_date, 7, 4) || '-' || substr(session_date, 4, 2) || '-' || substr(session_date, 1, 2) ASC,
          is_date_row DESC,
          COALESCE(time, '') ASC,
          id ASC
        LIMIT 5000
      `);
      sendJson(res, 200, rows);
      return true;
    }

    if (path === '/api/court-schedule/date' && req.method === 'POST') {
      const d = normSchedule(await readBody(req));
      if (!d.session_date) {
        sendJson(res, 400, { error: 'session_date_required' });
        return true;
      }

      const existing = await get(dbPath, 'SELECT * FROM court_schedule WHERE is_date_row=1 AND session_date=? LIMIT 1', [d.session_date]);
      if (existing) {
        sendJson(res, 200, existing);
        return true;
      }

      const result = await run(dbPath, `
        INSERT INTO court_schedule (
          session_date, court, time, representative, plaintiff, defendant,
          category, result, is_date_row, hearing_date, general_case_id, meeting_id, created_at, updated_at
        )
        VALUES (?, '', '', '', '', '', '', '', 1, '', NULL, NULL, ?, ?)
      `, [d.session_date, new Date().toISOString(), new Date().toISOString()]);

      sendJson(res, 201, await get(dbPath, 'SELECT * FROM court_schedule WHERE id=?', [result.id]));
      return true;
    }

    if (path === '/api/court-schedule/case' && req.method === 'POST') {
      const d = normSchedule(await readBody(req));

      if (!d.session_date) {
        sendJson(res, 400, { error: 'session_date_required' });
        return true;
      }

      const result = await run(dbPath, `
        INSERT INTO court_schedule (
          session_date, court, time, representative, plaintiff, defendant,
          category, result, is_date_row, hearing_date, general_case_id, meeting_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `, [
        d.session_date, d.court, d.time, d.representative, d.plaintiff, d.defendant,
        d.category, d.result, d.hearing_date, d.general_case_id, d.meeting_id, new Date().toISOString(), new Date().toISOString()
      ]);

      sendJson(res, 201, await get(dbPath, 'SELECT * FROM court_schedule WHERE id=?', [result.id]));
      return true;
    }

    const courtScheduleMatch = path.match(/^\/api\/court-schedule\/(\d+)$/);
    if (courtScheduleMatch) {
      const id = Number(courtScheduleMatch[1]);

      if (req.method === 'PUT') {
        const d = normSchedule(await readBody(req));
        await run(dbPath, `
          UPDATE court_schedule
          SET session_date=?, court=?, time=?, representative=?, plaintiff=?, defendant=?,
              category=?, result=?, hearing_date=?, general_case_id=COALESCE(?, general_case_id), meeting_id=COALESCE(?, meeting_id), updated_at=?
          WHERE id=?
        `, [
          d.session_date, d.court, d.time, d.representative, d.plaintiff, d.defendant,
          d.category, d.result, d.hearing_date, d.general_case_id, d.meeting_id, new Date().toISOString(), id
        ]);

        sendJson(res, 200, await get(dbPath, 'SELECT * FROM court_schedule WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'DELETE') {
        await run(dbPath, 'DELETE FROM court_schedule WHERE id=?', [id]);
        sendJson(res, 200, { ok: true });
        return true;
      }
    }


    if (path === '/api/calendar-tasks' && req.method === 'GET') {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }

      const date = parsedUrl.searchParams.get('date') || '';
      const start = parsedUrl.searchParams.get('start') || '';
      const end = parsedUrl.searchParams.get('end') || '';
      const requestedUser = parsedUrl.searchParams.get('user') || '';
      const generalCaseId = Number(parsedUrl.searchParams.get('general_case_id') || 0);
      const effectiveUser = session.is_admin ? requestedUser : session.full_name;

      const where = [];
      const params = [];

      if (date) {
        where.push(`COALESCE(date_str, "date", '')=?`);
        params.push(date);
      }

      if (start) {
        where.push(`COALESCE(NULLIF(end_date, ''), COALESCE(date_str, "date", ''))>=?`);
        params.push(start);
      }

      if (end) {
        where.push(`COALESCE(date_str, "date", '')<=?`);
        params.push(end);
      }

      if (effectiveUser && !generalCaseId) {
        where.push(`(COALESCE(user_name, "user", '')=? OR COALESCE(delegated_to, '')=?)`);
        params.push(effectiveUser, effectiveUser);
      }

      if (generalCaseId) {
        where.push('COALESCE(general_case_id, 0)=?');
        params.push(generalCaseId);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const rows = await all(dbPath, `
        SELECT
          id,
          COALESCE(date_str, "date", '') AS date_str,
          COALESCE("date", date_str, '') AS "date",
          COALESCE(end_date, '') AS end_date,
          COALESCE(user_name, "user", '') AS user_name,
          COALESCE("user", user_name, '') AS "user",
          COALESCE(task_type, "type", '') AS task_type,
          COALESCE("type", task_type, '') AS "type",
          COALESCE(event_scope, 'work') AS event_scope,
          COALESCE(personal_kind, '') AS personal_kind,
          COALESCE(description, "desc", '') AS description,
          COALESCE("desc", description, '') AS "desc",
          COALESCE(time_val, "time", '') AS time_val,
          COALESCE("time", time_val, '') AS "time",
          COALESCE(end_time, '') AS end_time,
          court,
          subject,
          assignment,
          COALESCE(note_text, '') AS note_text,
          COALESCE(private_note, '') AS private_note,
          COALESCE(delegated_to, '') AS delegated_to,
          COALESCE(delegated_by, '') AS delegated_by,
          COALESCE(delegation_status, '') AS delegation_status,
          delegation_source_event_id,
          COALESCE(conflict_override, 0) AS conflict_override,
          COALESCE(done, 0) AS done,
          meeting_id,
          general_case_id,
          created_at,
          updated_at
        FROM calendar_tasks
        ${whereSql}
        ORDER BY COALESCE(date_str, "date", '') ASC, COALESCE(time_val, "time", '') ASC, id ASC
        LIMIT 5000
      `, params);

      sendJson(res, 200, rows.map(row => maskCalendarTaskForViewer(row, session)));
      return true;
    }

    if (path === '/api/calendar-tasks' && req.method === 'POST') {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }
      const d = normCalendarTask(await readBody(req));
      d.user = session.full_name;
      if (d.general_case_id) {
        const linkedCase = await get(dbPath, 'SELECT id FROM general_cases WHERE id=? LIMIT 1', [d.general_case_id]);
        if (!linkedCase) {
          sendJson(res, 400, { error: 'general_case_not_found' });
          return true;
        }
      }
      const now = new Date().toISOString();
      const result = await run(dbPath, `
        INSERT INTO calendar_tasks (
          date_str, "date", end_date, user_name, "user", task_type, "type", event_scope, personal_kind,
          description, "desc", time_val, "time", end_time, court, subject, assignment, note_text, private_note,
          delegated_to, delegated_by, delegation_status, delegation_source_event_id, conflict_override, done, meeting_id, general_case_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.date, d.date, d.end_date, d.user, d.user, d.type, d.type, d.event_scope, d.personal_kind,
        d.desc, d.desc, d.time, d.time, d.end_time, d.court, d.subject, d.assignment, d.note_text, d.private_note,
        d.delegated_to, d.delegated_by, d.delegation_status, d.delegation_source_event_id, d.conflict_override, d.done, d.meeting_id, d.general_case_id,
        now, now
      ]);

      sendJson(res, 201, await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [result.id]));
      return true;
    }

    if (path === '/api/calendar-tasks/delegate' && req.method === 'POST') {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      const delegatedTo = String(body.delegated_to || '').trim();
      const sourceEventId = Number(body.source_event_id || 0);
      if (!sourceEventId) {
        sendJson(res, 400, { error: 'source_event_required' });
        return true;
      }
      const sourceEvent = await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [sourceEventId]);
      if (!canEditCalendarTask(session, sourceEvent)) {
        sendJson(res, 403, { error: 'forbidden' });
        return true;
      }
      await run(dbPath, `UPDATE calendar_tasks SET delegated_to='', delegated_by='', delegation_status='', delegation_source_event_id=NULL, updated_at=? WHERE delegation_source_event_id=?`, [new Date().toISOString(), sourceEventId]);
      let changed = 0;
      if (delegatedTo) {
        for (const id of ids) {
          const row = await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [id]);
          if (!canEditCalendarTask(session, row)) continue;
          const result = await run(dbPath, `UPDATE calendar_tasks SET delegated_to=?, delegated_by=?, delegation_status='active', delegation_source_event_id=?, updated_at=? WHERE id=?`, [delegatedTo, session.full_name, sourceEventId, new Date().toISOString(), id]);
          changed += Number(result.changes || 0);
        }
      }
      sendJson(res, 200, { ok: true, changed });
      return true;
    }

    const calendarTaskMatch = path.match(/^\/api\/calendar-tasks\/(\d+)$/);
    if (calendarTaskMatch) {
      const session = await getRequestSession(req, dbPath);
      if (!session) {
        sendJson(res, 401, { error: 'auth_required' });
        return true;
      }
      const id = Number(calendarTaskMatch[1]);
      const existing = await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [id]);
      if (!existing) {
        sendJson(res, 404, { error: 'not_found' });
        return true;
      }
      if (!canEditCalendarTask(session, existing)) {
        sendJson(res, 403, { error: 'forbidden' });
        return true;
      }

      if (req.method === 'PUT') {
        const d = normCalendarTask(await readBody(req));
        d.user = existing.user_name || existing.user || session.full_name;
        if (d.general_case_id) {
          const linkedCase = await get(dbPath, 'SELECT id FROM general_cases WHERE id=? LIMIT 1', [d.general_case_id]);
          if (!linkedCase) {
            sendJson(res, 400, { error: 'general_case_not_found' });
            return true;
          }
        }
        await run(dbPath, `
          UPDATE calendar_tasks
          SET date_str=?, "date"=?, end_date=?, user_name=?, "user"=?, task_type=?, "type"=?, event_scope=?, personal_kind=?,
              description=?, "desc"=?, time_val=?, "time"=?, end_time=?, court=?, subject=?, assignment=?, note_text=?, private_note=?,
              delegated_to=?, delegated_by=?, delegation_status=?, delegation_source_event_id=?, conflict_override=?, done=?, meeting_id=?, general_case_id=?, updated_at=?
          WHERE id=?
        `, [
          d.date, d.date, d.end_date, d.user, d.user, d.type, d.type, d.event_scope, d.personal_kind,
          d.desc, d.desc, d.time, d.time, d.end_time, d.court, d.subject, d.assignment, d.note_text, d.private_note,
          d.delegated_to, d.delegated_by, d.delegation_status, d.delegation_source_event_id, d.conflict_override, d.done, d.meeting_id, d.general_case_id,
          new Date().toISOString(), id
        ]);

        sendJson(res, 200, await get(dbPath, 'SELECT * FROM calendar_tasks WHERE id=?', [id]));
        return true;
      }

      if (req.method === 'DELETE') {
        if (String(existing.event_scope || '') === 'personal') {
          await run(dbPath, `UPDATE calendar_tasks SET delegated_to='', delegated_by='', delegation_status='', delegation_source_event_id=NULL, updated_at=? WHERE delegation_source_event_id=?`, [new Date().toISOString(), id]);
        }
        await run(dbPath, 'DELETE FROM calendar_tasks WHERE id=?', [id]);
        sendJson(res, 200, { ok: true });
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error(err);
    if (res.writableEnded || res.destroyed) return true;
    if (err?.code === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'payload_too_large', message: err.message, max_bytes: err.maxBytes || DEFAULT_JSON_BODY_LIMIT });
      return true;
    }
    if (err?.code === 'INVALID_JSON') {
      sendJson(res, 400, { error: 'invalid_json', message: err.message });
      return true;
    }
    sendJson(res, 500, { error: 'server_error', message: err?.message || 'Внутренняя ошибка сервера' });
    return true;
  }
}

module.exports = { ensureSchema, handleApiRequest };
