'use strict';
// Подключение к базе SQLite и создание таблиц.
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'dekanat.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Создание таблиц (если их ещё нет). Вызывается при запуске; seed может
// пересоздать таблицы с тестовыми данными и вызвать её снова.
function createSchema() {
// Один пользователь — одна строка. Поля студента (направление, курс, группа)
// у сотрудника пустые, а поле «должность» — наоборот.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    login         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('student', 'staff')),
    full_name     TEXT    NOT NULL,
    faculty       TEXT    NOT NULL,
    program       TEXT,
    course        INTEGER CHECK (course IS NULL OR course BETWEEN 1 AND 6),
    group_name    TEXT,
    position      TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Учебные группы. Факультет группы определяет расписание звонков.
  -- Куратор группы (вымышленный) показывается в профиле студента.
  CREATE TABLE IF NOT EXISTS groups (
    name          TEXT PRIMARY KEY,
    faculty       TEXT NOT NULL,
    curator_name  TEXT,
    curator_email TEXT
  );

  -- short_name — короткое название для карточек «Недели» (например, «МВКО»).
  CREATE TABLE IF NOT EXISTS disciplines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    short_name TEXT
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    title     TEXT
  );

  -- Каждое занятие — отдельная строка с конкретной датой и номером пары.
  -- Если занятие изменили, в полях old_* лежит то, как было раньше.
  CREATE TABLE IF NOT EXISTS lessons (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name     TEXT    NOT NULL,
    discipline_id  INTEGER NOT NULL REFERENCES disciplines(id),
    teacher_id     INTEGER NOT NULL REFERENCES teachers(id),
    kind           TEXT    NOT NULL CHECK (kind IN ('lecture', 'seminar', 'practice')),
    date           TEXT    NOT NULL,              -- ГГГГ-ММ-ДД
    pair           INTEGER NOT NULL CHECK (pair BETWEEN 1 AND 8),
    building       TEXT    NOT NULL,
    room           TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'normal'
                   CHECK (status IN ('normal', 'moved', 'teacher_changed', 'room_changed', 'cancelled')),
    old_date       TEXT,
    old_pair       INTEGER,
    old_building   TEXT,
    old_room       TEXT,
    old_teacher_id INTEGER REFERENCES teachers(id),
    change_note    TEXT,
    changed_at     TEXT
  );

  CREATE INDEX IF NOT EXISTS lessons_group_date ON lessons (group_name, date);
  CREATE INDEX IF NOT EXISTS lessons_group_old_date ON lessons (group_name, old_date);

  -- ---------- Успеваемость ----------
  CREATE TABLE IF NOT EXISTS semesters (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on   TEXT NOT NULL
  );

  -- Что группа сдаёт в семестре: дисциплина, форма контроля и сроки.
  CREATE TABLE IF NOT EXISTS assessments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id   INTEGER NOT NULL REFERENCES semesters(id),
    group_name    TEXT    NOT NULL,
    discipline_id INTEGER NOT NULL REFERENCES disciplines(id),
    teacher_id    INTEGER NOT NULL REFERENCES teachers(id),
    control       TEXT    NOT NULL CHECK (control IN ('exam', 'credit')),
    current_max   INTEGER NOT NULL CHECK (current_max > 0),
    current_due   TEXT    NOT NULL,  -- до какого числа выставят баллы за работу в семестре
    result_due    TEXT    NOT NULL,  -- до какого числа выставят оценку за экзамен / зачёт
    exam_date     TEXT,
    UNIQUE (semester_id, group_name, discipline_id)
  );

  -- Оценки студента: одна строка на студента и дисциплину. Пусто = ещё не выставлено.
  CREATE TABLE IF NOT EXISTS results (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id     INTEGER NOT NULL REFERENCES users(id),
    assessment_id  INTEGER NOT NULL REFERENCES assessments(id),
    current_points REAL,
    current_set_at TEXT,
    grade          TEXT CHECK (grade IS NULL OR grade IN ('5', '4', '3', '2', 'passed', 'failed')),
    grade_set_at   TEXT,
    UNIQUE (student_id, assessment_id)
  );

  -- Общественная активность (в нынешнем ЛК — Б3).
  CREATE TABLE IF NOT EXISTS social_scores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES users(id),
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    points      REAL,
    max_points  INTEGER NOT NULL,
    note        TEXT,
    set_at      TEXT,
    due         TEXT    NOT NULL,
    UNIQUE (student_id, semester_id)
  );

  -- Надбавка: каждое начисление отдельной строкой, с причиной.
  CREATE TABLE IF NOT EXISTS bonuses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL REFERENCES users(id),
    semester_id INTEGER NOT NULL REFERENCES semesters(id),
    category    TEXT    NOT NULL CHECK (category IN ('volunteering', 'sport', 'research')),
    title       TEXT    NOT NULL,
    points      REAL    NOT NULL CHECK (points > 0),
    awarded_on  TEXT    NOT NULL
  );

  -- ---------- Заявки и справки ----------
  -- Время везде — московское, в формате «ГГГГ-ММ-ДД ЧЧ:ММ».
  CREATE TABLE IF NOT EXISTS requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES users(id),
    type          TEXT    NOT NULL
                  CHECK (type IN ('study_certificate', 'enrollment_certificate', 'order_extract', 'appeal')),
    format        TEXT    CHECK (format IS NULL OR format IN ('paper', 'electronic')),
    purpose       TEXT,
    order_ref     TEXT,
    copies        INTEGER CHECK (copies IS NULL OR copies BETWEEN 1 AND 5),
    subject       TEXT,
    comment       TEXT,
    status        TEXT    NOT NULL DEFAULT 'accepted'
                  CHECK (status IN ('accepted', 'in_progress', 'ready', 'issued', 'answered', 'rejected')),
    reject_reason TEXT,
    pickup_place  TEXT,
    pickup_hours  TEXT,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS requests_student ON requests (student_id);
  CREATE INDEX IF NOT EXISTS requests_status ON requests (status);

  -- История статусов: по строке на каждый шаг (даты для «трекера»).
  CREATE TABLE IF NOT EXISTS request_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    status     TEXT    NOT NULL,
    at         TEXT    NOT NULL,
    actor_id   INTEGER REFERENCES users(id),
    note       TEXT
  );
  CREATE INDEX IF NOT EXISTS request_events_request ON request_events (request_id);

  -- Переписка по заявке (ответ сотрудника, уточнение студента).
  CREATE TABLE IF NOT EXISTS request_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    author_id  INTEGER NOT NULL REFERENCES users(id),
    text       TEXT    NOT NULL,
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS request_messages_request ON request_messages (request_id);

  -- Запись на приём в деканат. Занять слот дважды и взять две записи на день мешают индексы.
  CREATE TABLE IF NOT EXISTS appointments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    faculty    TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    time       TEXT    NOT NULL,
    topic      TEXT    NOT NULL CHECK (topic IN ('certificates', 'academic_debt', 'transfer', 'other')),
    comment    TEXT,
    status     TEXT    NOT NULL CHECK (status IN ('active', 'cancelled', 'attended', 'missed')),
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot ON appointments (faculty, date, time) WHERE status != 'cancelled';
  CREATE UNIQUE INDEX IF NOT EXISTS appointments_student_day ON appointments (student_id, date) WHERE status = 'active';
  CREATE TABLE IF NOT EXISTS reception_closed_days (
    faculty TEXT NOT NULL,
    date    TEXT NOT NULL,
    reason  TEXT NOT NULL,
    PRIMARY KEY (faculty, date)
  );

  -- Где заработать надбавку: возможности и записи студентов.
  CREATE TABLE IF NOT EXISTS bonus_opportunities (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category     TEXT    NOT NULL CHECK (category IN ('volunteering', 'sport', 'research')),
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    organizer    TEXT    NOT NULL,
    points       REAL    NOT NULL CHECK (points > 0),
    signup_until TEXT    NOT NULL,
    event_on     TEXT
  );
  CREATE TABLE IF NOT EXISTS bonus_enrollments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL REFERENCES bonus_opportunities(id),
    student_id     INTEGER NOT NULL REFERENCES users(id),
    status         TEXT    NOT NULL CHECK (status IN ('submitted', 'confirmed', 'awarded', 'rejected')),
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL,
    bonus_id       INTEGER REFERENCES bonuses(id),
    UNIQUE (opportunity_id, student_id)
  );

  -- Цифровые студенческие билеты (концепт). code — случайный код для открытой проверки.
  CREATE TABLE IF NOT EXISTS student_cards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id),
    code        TEXT    NOT NULL UNIQUE,
    number      TEXT    NOT NULL UNIQUE,
    issued_on   TEXT    NOT NULL,
    valid_until TEXT    NOT NULL
  );

  -- Реестр электронных справок. code — длинный случайный секрет для QR-проверки.
  -- Данные студента — снимок на момент выдачи.
  CREATE TABLE IF NOT EXISTS e_certificates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id  INTEGER NOT NULL UNIQUE REFERENCES requests(id),
    code        TEXT    NOT NULL UNIQUE,
    number      TEXT    NOT NULL UNIQUE,
    full_name   TEXT    NOT NULL,
    faculty     TEXT    NOT NULL,
    program     TEXT,
    course      INTEGER,
    study_form  TEXT    NOT NULL,
    purpose     TEXT,
    issued_at   TEXT    NOT NULL,
    valid_until TEXT    NOT NULL,
    signed_by   TEXT    NOT NULL,
    revoked_at  TEXT
  );

  -- ---------- Уведомления ----------
  -- Объявления деканата. Кому: пустое поле = «любой». Студент видит объявление,
  -- если подходит по ВСЕМ заполненным полям. removed_at — объявление снято.
  CREATE TABLE IF NOT EXISTS announcements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id   INTEGER NOT NULL REFERENCES users(id),
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    title_en    TEXT,
    body_en     TEXT,
    important   INTEGER NOT NULL DEFAULT 0 CHECK (important IN (0, 1)),
    faculty     TEXT,
    course      INTEGER CHECK (course IS NULL OR course BETWEEN 1 AND 6),
    group_name  TEXT,
    deadline_on TEXT,
    created_at  TEXT    NOT NULL,
    removed_at  TEXT
  );

  -- Отметки «прочитано». Автоматические уведомления не хранятся — лента
  -- собирается на лету из расписания, заявок и оценок; здесь только ключи прочитанного.
  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id  INTEGER NOT NULL REFERENCES users(id),
    item_key TEXT    NOT NULL,
    read_at  TEXT    NOT NULL,
    PRIMARY KEY (user_id, item_key)
  );
`);
}

createSchema();

// Небольшие доработки схемы для уже существующей базы (без потери данных).
function migrate() {
  const has = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  // Цвет дисциплины (номер цвета из палитры) — одинаковый в расписании и в оценках.
  if (!has('disciplines', 'color')) db.exec('ALTER TABLE disciplines ADD COLUMN color INTEGER');
  // Короткое название дисциплины и куратор группы (заполняются в npm run seed).
  if (!has('disciplines', 'short_name')) db.exec('ALTER TABLE disciplines ADD COLUMN short_name TEXT');
  if (!has('groups', 'curator_name')) db.exec('ALTER TABLE groups ADD COLUMN curator_name TEXT');
  if (!has('groups', 'curator_email')) db.exec('ALTER TABLE groups ADD COLUMN curator_email TEXT');
  // Английская версия объявления (необязательная).
  if (!has('announcements', 'title_en')) db.exec('ALTER TABLE announcements ADD COLUMN title_en TEXT');
  if (!has('announcements', 'body_en')) db.exec('ALTER TABLE announcements ADD COLUMN body_en TEXT');
}
migrate();

module.exports = { db, DB_PATH, createSchema };
