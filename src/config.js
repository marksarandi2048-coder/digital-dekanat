'use strict';
// Общие настройки из переменных окружения: локально — из .env, на хостинге — из его кабинета.
const path = require('node:path');

const IS_PROD = process.env.NODE_ENV === 'production';

// Папка для всего, что пишется во время работы (сейчас это база SQLite).
// Локально — data/ в проекте. На хостинге — постоянное хранилище, например DATA_DIR=/data на Amvera:
// всё, что лежит вне него, может пропасть при перезапуске или пересборке.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(DATA_DIR, 'dekanat.db'));
if (IS_PROD && !process.env.DATA_DIR && !process.env.DB_PATH) {
  console.warn(`Внимание: DATA_DIR не задан, база пишется в ${DB_PATH}. На хостинге она может пропасть при перезапуске — задайте DATA_DIR (на Amvera: /data).`);
}

// Адрес сайта для ссылок в QR-кодах электронных справок.
// После выкладки на хостинг в .env задаётся настоящий адрес, например https://dekanat.example.ru
function readPublicUrl() {
  const fallback = 'http://localhost:3000';
  const raw = (process.env.PUBLIC_URL || fallback).trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return raw;
  } catch {
    // ниже — предупреждение
  }
  console.warn(`Внимание: PUBLIC_URL «${raw}» — не адрес сайта. Использую ${fallback}.`);
  return fallback;
}

const PUBLIC_URL = readPublicUrl();

module.exports = { PUBLIC_URL, IS_PROD, DATA_DIR, DB_PATH };
