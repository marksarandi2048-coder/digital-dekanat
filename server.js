'use strict';
// Запуск сервера «Цифрового деканата».
const path = require('node:path');
const express = require('express');
const session = require('express-session');

require('./src/db'); // создаёт файл базы и таблицы, если их ещё нет
const authRoutes = require('./src/routes/auth');
const profileRoutes = require('./src/routes/profile');
const scheduleRoutes = require('./src/routes/schedule');
const gradesRoutes = require('./src/routes/grades');
const requestsRoutes = require('./src/routes/requests');
const verifyRoutes = require('./src/routes/verify');
const notificationsRoutes = require('./src/routes/notifications');
const { findById } = require('./src/users');
const { PUBLIC_URL } = require('./src/config');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('Ошибка: в файле .env не задан SESSION_SECRET. Пример — в .env.example.');
  process.exit(1);
}
if (SESSION_SECRET.length < 32) {
  console.warn('Внимание: SESSION_SECRET короче 32 символов — лучше сделать длиннее.');
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'dekanat.sid';
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
app.set('sessionCookieName', COOKIE_NAME);
if (IS_PROD) app.set('trust proxy', 1);

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

app.use(express.json({ limit: '20kb' }));

// Сессии. Пока хранятся в памяти сервера: после перезапуска нужно войти заново.
app.use(
  session({
    name: COOKIE_NAME,
    secret: SESSION_SECRET,
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

// API: ответы с личными данными не кешируются.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// Изменяющие запросы принимаем только в формате JSON — так чужой сайт
// не сможет отправить данные от имени студента обычной HTML-формой.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.headers['content-type'] && !req.is('application/json')) {
    return res.status(415).json({ error: 'Ожидается JSON' });
  }
  next();
});
app.use('/api', authRoutes);
app.use('/api', profileRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', gradesRoutes);
app.use('/api', requestsRoutes);
app.use('/api', verifyRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Страницы.
// Стартовая страница: студенту — «Сегодня», сотруднику — список заявок.
app.get('/', (req, res) => {
  const user = req.session.userId ? findById(req.session.userId) : null;
  if (user) return res.redirect(user.role === 'staff' ? '/requests' : '/today');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Страницы только для вошедших. Сами данные всё равно защищены на уровне API.
const pages = {
  '/today': 'today.html',
  '/week': 'week.html',
  '/grades': 'grades.html',
  '/profile': 'profile.html',
  '/requests': 'requests.html',
  '/requests/new': 'request-new.html',
  '/requests/:id': 'request.html',
  '/requests/:id/certificate': 'certificate.html',
  '/announcements/:id': 'announcement.html',
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
app.use(express.static(PUBLIC_DIR, { index: false }));

// Общий обработчик ошибок: подробности — в консоль, пользователю — коротко.
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Ошибка сервера' : 'Некорректный запрос' });
});

app.listen(PORT, () => {
  console.log(`Цифровой деканат запущен: http://localhost:${PORT}`);
  console.log(`Адрес для QR-кодов справок (PUBLIC_URL): ${PUBLIC_URL}`);
});
