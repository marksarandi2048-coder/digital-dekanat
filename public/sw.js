'use strict';
// Сервис-воркер: страницы и стили доступны без интернета.
// Сервер добавляет перед этим текстом SHELL_VERSION и SHELL_FILES (см. src/serviceWorker.js):
// изменился любой файл сайта — браузер сам обновит сохранённую копию.
//
// Правила:
// — пока есть сеть, всё берётся с сервера; копия нужна, только когда сети нет или она «висит»;
// — изменяющие запросы (POST) сюда не попадают: они идут напрямую и без сети честно не проходят;
// — HTML-страницы — пустые заготовки без личных данных, поэтому их можно хранить.

const SHELL_CACHE = `dekanat-shell-${SHELL_VERSION}`;
const PERSONAL_CACHE = 'dekanat-personal'; // очищается при выходе из кабинета
const SIGNED_IN_KEY = '/__signed-in'; // отметка «здесь выполнен вход», без личных данных
const WAIT_MS = 4000; // сколько ждём медленную сеть, прежде чем показать копию
const shellFiles = new Set(SHELL_FILES);

// Каждая очистка увеличивает счётчик. Ответ на запрос, начатый до очистки, не сохраняется.
let wipeCount = 0;

// Личные данные на устройстве — только расписание недели и студенческий билет.
// Дополнительно сервер помечает ответ заголовком (только для студентов): см. personalKey и savePersonal.
const MAX_SAVED_WEEKS = 6; // кроме текущей: недели, которые студент открывал сам

function personalKey(url) {
  const path = url.pathname;
  if (path === '/api/student-card' || path === '/api/student-card/qr.svg') return path;
  if (path === '/api/schedule/week') {
    const start = url.searchParams.get('start');
    if (!start) return path;
    return /^\d{4}-\d{2}-\d{2}$/.test(start) ? `${path}?start=${start}` : null;
  }
  return null;
}

// Какая заготовка отвечает за адрес, когда сети нет.
const CABINET_PAGES = [
  [/^\/home$/, 'home.html'],
  [/^\/today$/, 'today.html'],
  [/^\/week$/, 'week.html'],
  [/^\/grades$/, 'grades.html'],
  [/^\/grades\/bonus$/, 'bonus.html'],
  [/^\/profile$/, 'profile.html'],
  [/^\/requests$/, 'requests.html'],
  [/^\/requests\/new$/, 'request-new.html'],
  [/^\/requests\/[^/]+\/certificate$/, 'certificate.html'],
  [/^\/requests\/[^/]+$/, 'request.html'],
  [/^\/appointments$/, 'appointments.html'],
  [/^\/announcements\/[^/]+$/, 'announcement.html'],
  [/^\/announcements$/, 'announcements.html'],
  [/^\/notifications$/, 'notifications.html'],
  [/^\/student-card$/, 'student-card.html'],
];

function cabinetFile(path) {
  const found = CABINET_PAGES.find(([pattern]) => pattern.test(path));
  return found ? found[1] : null;
}

function normalPath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

async function isSignedIn() {
  const cache = await caches.open(PERSONAL_CACHE);
  return Boolean(await cache.match(SIGNED_IN_KEY));
}

async function shellFileFor(path) {
  const signedIn = await isSignedIn();
  if (path === '/') return signedIn ? 'home.html' : 'index.html';
  const file = cabinetFile(path);
  if (file) return signedIn ? file : 'index.html';
  if (path === '/help') return signedIn ? 'help.html' : 'help-guest.html';
  if (path === '/verify' || path.startsWith('/verify/')) return 'verify.html';
  if (path.startsWith('/check/') || path === '/student-card/check') return 'check.html';
  return '404.html';
}

async function wipePersonal() {
  wipeCount += 1;
  await caches.delete(PERSONAL_CACHE);
}

// Ответ сети; если её нет или она не успела — копия (если копия есть).
async function networkOrCopy(network, getCopy) {
  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(async () => {
      const copy = await getCopy();
      if (copy) resolve(copy);
    }, WAIT_MS);
  });
  try {
    return await Promise.race([network, slow]);
  } catch {
    const copy = await getCopy();
    if (copy) return copy;
    throw new TypeError('Нет подключения');
  } finally {
    clearTimeout(timer);
  }
}

// Сервер показал форму входа: сессии нет (вышли или вход истёк) — личным данным здесь не место.
async function wipeIfSignedOut(path, response) {
  if (path === '/' && response.type === 'basic' && response.status === 200) await wipePersonal();
}

async function trimSavedWeeks(cache) {
  const requests = (await cache.keys()).filter((r) => r.url.includes('/api/schedule/week?start='));
  if (requests.length <= MAX_SAVED_WEEKS) return;
  const dated = await Promise.all(
    requests.map(async (r) => ({ r, at: (await cache.match(r)).headers.get('X-Offline-Saved-At') })),
  );
  dated.sort((a, b) => a.at.localeCompare(b.at));
  await Promise.all(dated.slice(0, dated.length - MAX_SAVED_WEEKS).map(({ r }) => cache.delete(r)));
}

async function savePersonal(key, response, startedAt) {
  if (response.status === 401) {
    await wipePersonal(); // вход истёк
    return;
  }
  if (!response.ok || response.headers.get('X-Offline-Allowed') !== '1') return;
  const body = await response.clone().blob();
  if (startedAt !== wipeCount) return; // пока шёл запрос, студент вышел
  const cache = await caches.open(PERSONAL_CACHE);
  await cache.put(
    key,
    new Response(body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'X-Offline-Saved-At': new Date().toISOString(),
      },
    }),
  );
  if (startedAt !== wipeCount) {
    await caches.delete(PERSONAL_CACHE);
    return;
  }
  await trimSavedWeeks(cache);
}

function handlePersonal(event, key) {
  const startedAt = wipeCount;
  const network = fetch(event.request);
  event.waitUntil(network.then((res) => savePersonal(key, res, startedAt)).catch(() => {}));
  event.respondWith(networkOrCopy(network.then((res) => res.clone()), () => caches.match(key, { cacheName: PERSONAL_CACHE })));
}

function handlePage(event, url) {
  const path = normalPath(url.pathname);
  const network = fetch(event.request);
  event.waitUntil(network.then((res) => wipeIfSignedOut(path, res)).catch(() => {}));
  event.respondWith(
    networkOrCopy(network, async () => {
      const cache = await caches.open(SHELL_CACHE);
      return cache.match(`/${await shellFileFor(path)}`);
    }),
  );
}

// Файлы сайта сохраняются при установке: версия в имени хранилища меняется вместе с любым файлом.
// Поэтому при каждом открытии страницы копию не перезаписываем: лишняя запись задерживала стили и скрипты,
// и браузер отменял плавный переход между страницами.
function handleShellFile(event, url) {
  event.respondWith(networkOrCopy(fetch(event.request), () => caches.match(url.pathname, { cacheName: SHELL_CACHE })));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_FILES.map((file) => new Request(file, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('dekanat-shell-') && n !== SHELL_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'wipe') {
    event.waitUntil(
      wipePersonal().then(() => {
        if (event.ports[0]) event.ports[0].postMessage('done');
      }),
    );
  } else if (type === 'signed-in') {
    event.waitUntil(caches.open(PERSONAL_CACHE).then((cache) => cache.put(SIGNED_IN_KEY, new Response('1'))));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    const key = request.mode === 'navigate' ? null : personalKey(url);
    if (key) handlePersonal(event, key);
    return;
  }
  if (request.mode === 'navigate') handlePage(event, url);
  else if (shellFiles.has(url.pathname)) handleShellFile(event, url);
});
