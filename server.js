'use strict';
// Запуск сервера «Цифрового деканата».
const path = require('node:path');
const express = require('express');
const session = require('express-session');

const { db } = require('./src/db'); // создаёт файл базы и таблицы, если их ещё нет
const { seedIfEmpty } = require('./scripts/seed');
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const scheduleRoutes = require('./src/routes/schedule');
const gradesRoutes = require('./src/routes/grades');
const requestsRoutes = require('./src/routes/requests');
const verifyRoutes = require('./src/routes/verify');
const notificationsRoutes = require('./src/routes/notifications');
const homeRoutes = require('./src/routes/home');
const studentCardRoutes = require('./src/routes/studentCard');
const bonusRoutes = require('./src/routes/bonus');
const appointmentRoutes = require('./src/routes/appointments');
const helpRoutes = require('./src/routes/help');
const assistantRoutes = require('./src/routes/assistant');
const { findById } = require('./src/users');
const { PUBLIC_URL, IS_PROD, DB_PATH } = require('./src/config');
const { checkPathFor } = require('./src/studentCard');
const { nowInMoscow } = require('./src/dates');
const { buildServiceWorker } = require('./src/serviceWorker');
const { languageMiddleware, tr } = require('./src/i18n');
const { SweepingMemoryStore } = require('./src/sessionStore');
const { dataLanguageMiddleware } = require('./src/dataEn');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('Ошибка: не задан SESSION_SECRET (локально — в файле .env по образцу .env.example, на хостинге — в его переменных окружения).');
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.warn('Внимание: SESSION_SECRET короче 32 символов — лучше сделать длиннее.');
}

const PORT = Number(process.env.PORT) || 3000;
const COOKIE_NAME = 'dekanat.sid';
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
app.set('sessionCookieName', COOKIE_NAME);
// На хостинге сервер стоит за HTTPS-прокси (на Amvera — nginx): доверяем одному прокси перед нами,
// чтобы Express видел настоящий протокол (https) и адрес посетителя из заголовков X-Forwarded-*.
if (IS_PROD) app.set('trust proxy', 1);
if (IS_PROD && !PUBLIC_URL.startsWith('https://')) {
  console.warn(`Внимание: PUBLIC_URL «${PUBLIC_URL}» — не https-адрес. QR-коды справок будут вести на него.`);
}

// Пустая база (первый запуск на хостинге) — заполняем демо-данными. Заполненную не трогаем.
if (seedIfEmpty()) console.log('База была пустой и заполнена демо-данными.');

// Защитные заголовки: скрипты и стили грузятся только с нашего сервера.
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

// Cookie входа помечен Secure и уходит только по HTTPS. Если прокси не передал X-Forwarded-Proto: https,
// браузер cookie не получит и войти не выйдет — один раз пишем об этом в журнал, чтобы было понятно почему.
let proxyWarned = false;
app.use((req, res, next) => {
  if (IS_PROD && req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
  if (IS_PROD && !req.secure && !proxyWarned) {
    proxyWarned = true;
    console.warn(`Внимание: запрос пришёл не по HTTPS (X-Forwarded-Proto: «${req.get('x-forwarded-proto') || 'нет'}»). Cookie входа выдаётся только по HTTPS.`);
  }
  next();
});

app.use(express.json({ limit: '20kb' }));

// Сессии хранятся в памяти сервера: после перезапуска нужно войти заново. Это сделано нарочно:
// в сессии живёт и переписка с помощником, а её по решению проекта на диск не записываем.
app.use(
  session({
    name: COOKIE_NAME,
    secret: SESSION_SECRET,
    store: new SweepingMemoryStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 8 * 60 * 60 * 1000, // 8 часов
    },
  }),
);

// Язык запроса — из настройки браузера. Стоит после сессии: дальше обработка идёт без ожидания сети.
app.use(languageMiddleware);

// API: ответы с личными данными не кешируются.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// Изменяющие запросы принимаем только в формате JSON — так чужой сайт
// не сможет отправить данные от имени студента обычной HTML-формой.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.headers['content-type'] && !req.is('application/json')) {
    return res.status(415).json({ error: tr('server.ozhidaetsya_json') });
  }
  next();
});
app.use('/api', dataLanguageMiddleware);
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', gradesRoutes);
app.use('/api', requestsRoutes);
app.use('/api', verifyRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', homeRoutes);
app.use('/api', studentCardRoutes);
app.use('/api', bonusRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', helpRoutes);
app.use('/api', assistantRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: tr('server.ne_naydeno') }));

// Страницы.
// Стартовая страница: вошедшего — на «Главную» (у студента и сотрудника она своя).
app.get('/', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  if (user) return res.redirect('/home');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Страницы только для вошедших. Сами данные всё равно защищены на уровне API.
const pages = {
  '/home': 'home.html',
  '/today': 'today.html',
  '/week': 'week.html',
  '/grades': 'grades.html',
  '/grades/bonus': 'bonus.html',
  '/profile': 'profile.html',
  '/requests': 'requests.html',
  '/appointments': 'appointments.html',
  '/requests/new': 'request-new.html',
  '/requests/:id': 'request.html',
  '/requests/:id/certificate': 'certificate.html',
  '/announcements/:id': 'announcement.html',
  '/student-card': 'student-card.html',
};

// Лента — у студента, объявления — у сотрудника; каждого ведём на «своё».
app.get('/notifications', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  if (!user) return res.redirect('/');
  if (user.role === 'staff') return res.redirect('/announcements');
  res.sendFile(path.join(PUBLIC_DIR, 'notifications.html'));
});
app.get('/announcements', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  if (!user) return res.redirect('/');
  if (user.role !== 'staff') return res.redirect('/notifications');
  res.sendFile(path.join(PUBLIC_DIR, 'announcements.html'));
});
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.sendFile(path.join(PUBLIC_DIR, file));
  });
}

// Старый адрес «Написать в деканат» ведёт на форму обращения.
app.get('/contact', (req, res) => {
  const params = new URLSearchParams({ type: 'appeal' });
  if (typeof req.query.topic === 'string') params.set('topic', req.query.topic.slice(0, 300));
  res.redirect(`/requests/new?${params}`);
});

// Проверка подлинности справки — открыта для всех, вход не нужен.
app.get(['/verify', '/verify/:code'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'verify.html'));
});
// «Помощь» открыта и без входа: гостю — страница без меню кабинета.
app.get('/help', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  res.sendFile(path.join(PUBLIC_DIR, user ? 'help.html' : 'help-guest.html'));
});

// «Проверить мой билет»: ведёт вошедшего студента на проверку его собственного билета.
app.get('/student-card/check', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  if (!user) return res.redirect('/');
  if (user.role !== 'student') return res.redirect('/home');
  res.redirect(checkPathFor(user, nowInMoscow().date));
});

// Проверка студенческого билета по QR — тоже открыта для всех.
app.get('/check/:code', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'check.html'));
});
// Сервис-воркер со списком файлов сайта для работы без сети.
const serviceWorkerSource = buildServiceWorker(PUBLIC_DIR);
app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache').type('text/javascript').send(serviceWorkerSource);
});

// Стили и скрипты: браузер каждый раз сверяется с сервером (по ETag),
// чтобы после обновления сайта не показывать страницу со старыми стилями.
// Если файл не менялся, сервер отвечает коротким «304», без повторной загрузки.
app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
  }),
);

// Нет такой страницы — страница «404» в стиле кабинета (адреса /api/… отвечают JSON выше).
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

// Общий обработчик ошибок: подробности — в консоль, пользователю — коротко.
// Запросам к API — JSON, страницам — оформленная страница ошибки.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: status >= 500 ? tr('server.oshibka_servera') : tr('server.nekorrektnyy_zapros') });
  }
  // Ошибка в самом адресе (например, испорченная ссылка) — показываем «нет такой страницы».
  res.status(status).sendFile(path.join(PUBLIC_DIR, status >= 500 ? '500.html' : '404.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Цифровой деканат запущен: http://localhost:${PORT}`);
  console.log(`Адрес для QR-кодов справок (PUBLIC_URL): ${PUBLIC_URL}`);
  console.log(`База: ${DB_PATH}`);
});

// Остановка (перезапуск или новая версия на хостинге): дожидаемся текущих запросов
// и закрываем базу, чтобы последние изменения из журнала SQLite были записаны в файл.
function shutdown(signal) {
  console.log(`Получен ${signal}, останавливаюсь…`);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    db.close();
    process.exit(0);
  };
  server.close(finish);
  setTimeout(finish, 5000).unref(); // не ждём дольше 5 секунд (например, долгий запрос к помощнику)
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
