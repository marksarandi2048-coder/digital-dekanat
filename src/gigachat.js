'use strict';
// Подключение к GigaChat. Работает только на сервере: ключ и токен не попадают в браузер и в журнал.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const tls = require('node:tls');
const crypto = require('node:crypto');

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
const CERT_PATH = path.join(__dirname, '..', 'certs', 'russian_trusted_root_ca.pem');
const MODEL = 'GigaChat-2';

const TOKEN_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

// Запросы к модели идут по одному: на недорогих тарифах одновременных запросов мало.
const MAX_QUEUE = 8;
const MAX_QUEUE_WAIT_MS = 45_000;

// kind: not_configured | unavailable | auth | quota | rate_limited | busy
class GigaChatError extends Error {
  constructor(kind, detail) {
    super(`GigaChat: ${kind}${detail ? ` (${detail})` : ''}`);
    this.name = 'GigaChatError';
    this.kind = kind;
  }
}

function settings() {
  const authKey = (process.env.GIGACHAT_AUTH_KEY || '').trim().replace(/^Basic\s+/i, '');
  const scope = (process.env.GIGACHAT_SCOPE || '').trim();
  return { authKey, scope };
}

function isConfigured() {
  const { authKey, scope } = settings();
  return Boolean(authKey && scope);
}

// Сертификат Минцифры добавляется к обычным доверенным сертификатам только для этих запросов.
// Проверка защищённого соединения остаётся включённой, весь остальной сервер не затронут.
let trustedCa;
function caList() {
  if (trustedCa) return trustedCa;
  try {
    trustedCa = [...tls.rootCertificates, fs.readFileSync(CERT_PATH, 'utf8')];
  } catch {
    throw new GigaChatError('unavailable', 'нет файла сертификата');
  }
  return trustedCa;
}

function send(url, { method, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, ca: caList() }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error('response too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        clearTimeout(timer);
        let json = null;
        try {
          json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          // тело не JSON: решение ниже принимается по коду ответа
        }
        resolve({ status: res.statusCode, json });
      });
      res.on('error', fail);
    });
    function fail(err) {
      clearTimeout(timer);
      reject(new GigaChatError('unavailable', err.code || err.message));
    }
    const timer = setTimeout(() => req.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), timeoutMs);
    req.on('error', fail);
    if (body) req.write(body);
    req.end();
  });
}

function throwForStatus(status) {
  if (status === 401 || status === 403) throw new GigaChatError('auth', `HTTP ${status}`);
  if (status === 402) throw new GigaChatError('quota', 'HTTP 402');
  if (status === 429) throw new GigaChatError('rate_limited', 'HTTP 429');
  if (status < 200 || status >= 300) throw new GigaChatError('unavailable', `HTTP ${status}`);
}

let token = null; // { value, expiresAt }
let tokenRequest = null;

async function fetchToken() {
  const { authKey, scope } = settings();
  if (!authKey || !scope) throw new GigaChatError('not_configured');
  const body = new URLSearchParams({ scope }).toString();
  const { status, json } = await send(OAUTH_URL, {
    method: 'POST',
    timeoutMs: TOKEN_TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${authKey}`,
      RqUID: crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  throwForStatus(status);
  if (!json || !json.access_token) throw new GigaChatError('unavailable', 'пустой ответ токена');
  return { value: json.access_token, expiresAt: Number(json.expires_at) || Date.now() + 25 * 60_000 };
}

// Токен живёт около 30 минут. Новый запрашивается один раз, даже если он нужен сразу нескольким.
async function getToken() {
  if (token && token.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return token.value;
  if (!tokenRequest) {
    tokenRequest = fetchToken()
      .then((fresh) => {
        token = fresh;
        return fresh;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }
  return (await tokenRequest).value;
}

async function callApi(pathname, method, payload, timeoutMs) {
  const body = payload ? JSON.stringify(payload) : undefined;
  for (let attempt = 0; ; attempt += 1) {
    const value = await getToken();
    const headers = { Authorization: `Bearer ${value}`, Accept: 'application/json' };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const { status, json } = await send(`${API_URL}${pathname}`, { method, headers, body, timeoutMs });
    if (status === 401 && attempt === 0) {
      token = null; // токен успел устареть — берём новый и пробуем ещё раз
      continue;
    }
    throwForStatus(status);
    return json;
  }
}

let queueTail = Promise.resolve();
let queueLength = 0;

function enqueue(task) {
  if (queueLength >= MAX_QUEUE) return Promise.reject(new GigaChatError('busy'));
  queueLength += 1;
  const queuedAt = Date.now();
  const run = queueTail.then(() => {
    if (Date.now() - queuedAt > MAX_QUEUE_WAIT_MS) throw new GigaChatError('busy');
    return task();
  });
  queueTail = run.catch(() => {});
  return run.finally(() => {
    queueLength -= 1;
  });
}

// Один запрос к модели. Возвращает { message, finishReason }.
function chat({ messages, functions, temperature = 0.2, maxTokens = 700 }) {
  const payload = { model: MODEL, messages, temperature, max_tokens: maxTokens };
  if (functions && functions.length) {
    payload.functions = functions;
    payload.function_call = 'auto';
  }
  return enqueue(async () => {
    const json = await callApi('/chat/completions', 'POST', payload, CHAT_TIMEOUT_MS);
    const choice = json && json.choices && json.choices[0];
    if (!choice || !choice.message) throw new GigaChatError('unavailable', 'пустой ответ модели');
    return { message: choice.message, finishReason: choice.finish_reason };
  });
}

async function listModels() {
  const json = await callApi('/models', 'GET', null, TOKEN_TIMEOUT_MS);
  return ((json && json.data) || []).map((m) => m.id);
}

module.exports = { chat, listModels, isConfigured, GigaChatError };
