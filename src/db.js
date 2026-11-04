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
`);

module.exports = { db, DB_PATH };
