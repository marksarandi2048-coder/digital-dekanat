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

  CREATE TABLE IF NOT EXISTS disciplines (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
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
    pair           INTEGER NOT NULL CHECK (pair BETWEEN 1 AND 7),
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
`);

module.exports = { db, DB_PATH };
