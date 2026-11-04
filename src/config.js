'use strict';
// Общие настройки из .env.

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

module.exports = { PUBLIC_URL };
