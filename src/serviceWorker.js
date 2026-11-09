'use strict';
// Собирает файл сервис-воркера: список файлов сайта для работы без сети и их общий «отпечаток».
// Изменился любой файл — изменился отпечаток — браузер сам обновит сохранённую копию сайта.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const OFFLINE_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.png', '.woff2', '.webmanifest']);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function buildServiceWorker(publicDir) {
  const source = path.join(publicDir, 'sw.js');
  const files = listFiles(publicDir)
    .filter((file) => file !== source && OFFLINE_EXTENSIONS.has(path.extname(file)))
    .sort();
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(source));
  for (const file of files) hash.update(file).update(fs.readFileSync(file));
  const urls = files.map((file) => `/${path.relative(publicDir, file).split(path.sep).join('/')}`);
  return `const SHELL_VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 16))};\n`
    + `const SHELL_FILES = ${JSON.stringify(urls)};\n${fs.readFileSync(source, 'utf8')}`;
}

module.exports = { buildServiceWorker };
