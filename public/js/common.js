'use strict';
// Общие функции для всех страниц личного кабинета.
// Важно: любые данные выводятся только через textContent — так текст
// никогда не превратится в HTML-код (защита от внедрения скриптов).
window.Dekanat = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  const NO_CONNECTION = 'Нет подключения. Когда появится интернет, обновите страницу.';

  // Запрос к серверу. Если сессия закончилась — отправляем на страницу входа.
  async function fetchJSON(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      const error = new Error(NO_CONNECTION);
      error.offline = true;
      throw error;
    }
    if (res.status === 401) {
      window.location.href = '/';
      return new Promise(() => {}); // страница уходит, дальше ничего не делаем
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Не удалось загрузить данные');
    // Ответ из сохранённой копии: сервис-воркер сообщает, когда она получена.
    const savedAt = res.headers.get('X-Offline-Saved-At');
    if (savedAt) data.offlineSavedAt = savedAt;
    return data;
  }

  // ---------- Работа без сети ----------
  const MOSCOW = 'Europe/Moscow';
  const moscowDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: MOSCOW }).format(d); // ГГГГ-ММ-ДД
  const todayInMoscow = () => moscowDate(new Date());

  // «Офлайн · обновлено в 10:24», а если данные не сегодняшние — с датой.
  function savedLabel(iso) {
    const saved = new Date(iso);
    const time = new Intl.DateTimeFormat('ru-RU', { timeZone: MOSCOW, hour: '2-digit', minute: '2-digit' }).format(saved);
    const day = moscowDate(saved);
    return `Офлайн · обновлено ${day === todayInMoscow() ? '' : `${dayMonth(day)} `}в ${time}`;
  }

  // Плашка вверху страницы: без аргумента — «Нет подключения», с датой — когда обновлены данные.
  function offlineBar(savedAt) {
    const main = document.getElementById('main');
    if (!main) return;
    let bar = document.getElementById('offline-bar');
    if (!bar) {
      bar = el('p', 'offline-bar');
      bar.id = 'offline-bar';
      bar.setAttribute('role', 'status');
      main.prepend(bar);
    }
    bar.textContent = savedAt ? savedLabel(savedAt) : 'Нет подключения';
  }

  function hideOfflineBar() {
    const bar = document.getElementById('offline-bar');
    if (bar) bar.remove();
  }

  // Для страниц без форм: связь вернулась — показываем свежие данные.
  function reloadWhenOnline() {
    window.addEventListener('online', async () => {
      try {
        await fetch('/api/notifications/count'); // событие бывает ложным: убеждаемся, что сервер отвечает
        window.location.reload();
      } catch {
        // связи ещё нет — дождёмся следующего раза
      }
    });
  }

  // ---------- Даты ----------
  // Дата приходит как «ГГГГ-ММ-ДД»; форматируем её без сдвига часовых поясов.
  function formatDate(dateStr, options) {
    return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', ...options }).format(
      new Date(`${dateStr}T00:00:00Z`),
    );
  }
  const dayMonth = (d) => formatDate(d, { day: 'numeric', month: 'long' });
  const weekdayLong = (d) => formatDate(d, { weekday: 'long' });
  const weekdayShort = (d) => formatDate(d, { weekday: 'short' });
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // «ЧЧ:ММ» → минуты между двумя моментами одного дня.
  const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const minutesBetween = (from, to) => toMinutes(to) - toMinutes(from);
  // 25 → «25 мин», 80 → «1 ч 20 мин», 120 → «2 ч»
  function duration(min) {
    if (min < 1) return 'меньше минуты';
    if (min < 60) return `${min} мин`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }
  const fullDate = (d) => formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' });
  // «ГГГГ-ММ-ДД ЧЧ:ММ» → «3 ноября, 15:40»
  const dateTime = (stamp) => (stamp ? `${dayMonth(stamp.slice(0, 10))}, ${stamp.slice(11, 16)}` : '');

  // Отправка данных на сервер. Возвращает { ok, data }.
  async function postJSON(url, body) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      return { ok: false, data: { error: 'Нет связи с сервером. Попробуйте ещё раз.' } };
    }
    if (res.status === 401) {
      window.location.href = '/';
      return new Promise(() => {});
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ---------- Занятия ----------
  const KIND = { lecture: 'Лекция', seminar: 'Семинар', practice: 'Практическое занятие' };
  const BADGE = {
    moved: 'Перенесено',
    teacher_changed: 'Замена преподавателя',
    room_changed: 'Другая аудитория',
    cancelled: 'Отменено',
  };

  // «Беляев Игорь Сергеевич» → «Беляев И. С.»
  function shortName(fullName) {
    if (!fullName) return '';
    const [last, ...rest] = fullName.split(/\s+/);
    return [last, ...rest.map((p) => `${p[0]}.`)].join(' ');
  }

  function place(building, room) {
    const roomText = /^\d+[а-яА-Яa-zA-Z]?$/.test(room) ? `ауд. ${room}` : room;
    return `${building}, ${roomText}`;
  }

  const slot = (date, pair, time) =>
    `${weekdayShort(date)}, ${dayMonth(date)}, ${pair} пара${time ? ` (${time.start}–${time.end})` : ''}`;

  // Название дисциплины с цветной меткой (цвет — подсказка, название всегда рядом).
  function disciplineTitle(tag, className, name, color) {
    const title = el(tag, className);
    const dot = el('span', `disc-dot disc-${Number.isInteger(color) ? color : 0}`);
    dot.setAttribute('aria-hidden', 'true');
    title.append(dot, document.createTextNode(name));
    return title;
  }

  // Что изменилось у занятия — строками («Было: …», «Вместо: …», причина).
  function changeLines(lesson) {
    const c = lesson.change;
    if (!c) return [];
    const lines = [];
    if (lesson.status === 'moved') lines.push(`Было: ${slot(c.oldDate, c.oldPair, c.oldTime)}`);
    if (lesson.status === 'teacher_changed') lines.push(`Вместо: ${shortName(c.oldTeacher)}`);
    if (lesson.status === 'room_changed') lines.push(`Было: ${place(c.oldBuilding, c.oldRoom)}`);
    if (c.note) lines.push(c.note);
    return lines;
  }

  // ---------- Выбор группы (только для сотрудника) и подпись группы ----------
  function setupGroup(data) {
    const info = document.getElementById('group-info');
    const picker = document.getElementById('group-picker');
    if (!data.groups) {
      if (info && data.group) {
        info.textContent = `Группа ${data.group}`;
        info.hidden = false;
      }
      return;
    }
    const select = document.getElementById('group-select');
    select.replaceChildren(...data.groups.map((g) => {
      const option = el('option', null, g);
      option.value = g;
      option.selected = g === data.group;
      return option;
    }));
    select.onchange = () => {
      const params = new URLSearchParams(window.location.search);
      params.set('group', select.value);
      window.location.search = params.toString();
    };
    picker.hidden = false;
  }

  // ---------- Пустые состояния с иллюстрациями ----------
  // Иллюстрации — собственные простые рисунки. Цвета берутся из темы (CSS-переменные --illu-*).
  // Это наши константы, а не данные пользователя, поэтому их можно вставлять как разметку.
  const ILLUSTRATIONS = {
    // Чашка с паром и солнце — «можно выдохнуть»
    rest: '<ellipse cx="80" cy="106" rx="54" ry="7" class="i-fill"/><circle cx="124" cy="28" r="12" class="i-accent"/>'
      + '<path d="M44 56h58v18a26 26 0 0 1-26 26h-6a26 26 0 0 1-26-26z" class="i-paper i-line"/>'
      + '<path d="M102 62h6a10 10 0 0 1 0 20h-8" class="i-line"/><path d="M34 102h92" class="i-line"/>'
      + '<path d="M60 44c-5-6 5-10 0-17M73 44c-5-6 5-10 0-17M86 44c-5-6 5-10 0-17" class="i-line i-soft"/>',
    // Документ с плюсом — «закажите первую справку»
    request: '<ellipse cx="80" cy="108" rx="50" ry="6" class="i-fill"/>'
      + '<path d="M54 12h38l20 20v64a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z" class="i-paper i-line"/>'
      + '<path d="M92 12v20h20" class="i-line"/><path d="M60 48h34M60 60h34M60 72h22" class="i-line i-soft"/>'
      + '<circle cx="112" cy="86" r="17" class="i-accent"/><path d="M112 78v16M104 86h16" class="i-on-accent"/>',
    // Колокольчик с галочкой — «всё прочитано»
    read: '<ellipse cx="80" cy="108" rx="48" ry="6" class="i-fill"/>'
      + '<path d="M78 18a28 28 0 0 0-28 28c0 26-10 36-10 36h76s-10-10-10-36a28 28 0 0 0-28-28z" class="i-paper i-line"/>'
      + '<path d="M70 90a8 8 0 0 0 16 0" class="i-line"/>'
      + '<circle cx="112" cy="34" r="17" class="i-accent"/><path d="M104 34l6 6 10-12" class="i-on-accent"/>',
    // Стопка книг и месяц — «пары закончились»
    done: '<ellipse cx="80" cy="108" rx="56" ry="6" class="i-fill"/>'
      + '<rect x="38" y="78" width="84" height="24" rx="4" class="i-paper i-line"/><path d="M50 90h44" class="i-line i-soft"/>'
      + '<rect x="50" y="54" width="62" height="24" rx="4" class="i-paper i-line"/><path d="M62 66h26" class="i-line i-soft"/>'
      + '<path d="M120 12a19 19 0 1 0 15 31 16 16 0 0 1-15-31z" class="i-accent"/>'
      + '<path d="M46 24v10M41 29h10M82 16v6M79 19h6" class="i-line i-soft"/>',
    // Указатель «не туда» — для страницы 404
    lost: '<ellipse cx="80" cy="108" rx="52" ry="6" class="i-fill"/><path d="M80 24v80" class="i-line"/>'
      + '<path d="M80 30h36l10 10-10 10H80z" class="i-paper i-line"/><path d="M80 58H44L34 68l10 10h36z" class="i-paper i-line"/>'
      + '<circle cx="80" cy="18" r="6" class="i-accent"/><path d="M92 40h18M50 68h18" class="i-line i-soft"/>',
    // Отключённая вилка — для страницы 500
    error: '<ellipse cx="80" cy="108" rx="52" ry="6" class="i-fill"/>'
      + '<path d="M30 70h22M108 70h22" class="i-line"/>'
      + '<path d="M52 54h14a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H52z" class="i-paper i-line"/><path d="M72 62h6M72 78h6" class="i-line"/>'
      + '<path d="M108 54H94a6 6 0 0 0-6 6v20a6 6 0 0 0 6 6h14z" class="i-paper i-line"/>'
      + '<circle cx="80" cy="30" r="14" class="i-accent"/><path d="M80 22v9M80 37v1" class="i-on-accent"/>',
  };

  function illustration(name, className) {
    const box = el('span', `illu${className ? ` ${className}` : ''}`);
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `<svg viewBox="0 0 160 120" width="160" height="120" fill="none" stroke-linecap="round" stroke-linejoin="round">${ILLUSTRATIONS[name]}</svg>`;
    return box;
  }

  // Пустое состояние: рисунок, заголовок, пояснение и (по желанию) кнопка.
  // inline — компактный вариант в строку (рисунок слева).
  function emptyState({ illu, title, text, action, inline }) {
    const box = el('div', `empty${inline ? ' empty--inline' : ''}`);
    if (illu) box.append(illustration(illu));
    const words = el('div', 'empty__words');
    words.append(el('p', 'empty__title', title));
    if (text) words.append(el('p', 'muted empty__text', text));
    box.append(words);
    if (action) {
      const a = el('a', `button ${action.secondary ? 'button--secondary ' : ''}empty__action`, action.label);
      a.href = action.href;
      box.append(a);
    }
    return box;
  }

  // ---------- Обратный отсчёт: «сегодня», «завтра», «через 3 дня» ----------
  function countdown(days) {
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'завтра';
    return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }

  // ---------- Скелетоны: серые заглушки, пока грузятся данные ----------
  // На странице: <div class="state skeleton" data-skeleton="tiles|lessons|list|card|summary|profile">.
  // Страница сама прячет этот блок, когда данные пришли.
  function skLine(width, size) {
    return el('span', `sk sk-line sk-w${width}${size ? ` sk-${size}` : ''}`);
  }
  function skCard(...children) {
    const card = el('div', 'sk-card');
    card.append(...children);
    return card;
  }
  const SKELETONS = {
    tiles() {
      const grid = el('div', 'tiles tiles--student');
      const hero = el('div', 'sk-card sk-hero tile--full');
      hero.append(skLine(30, 'small'), skLine(60, 'big'), skLine(40), skLine(50));
      grid.append(hero);
      for (let i = 0; i < 4; i += 1) grid.append(skCard(skLine(50, 'small'), skLine(40, 'big'), skLine(90), skLine(70)));
      return [grid];
    },
    lessons() {
      return [1, 2, 3].map(() => skCard(skLine(20, 'small'), skLine(60), skLine(80), skLine(40)));
    },
    list() {
      return [1, 2, 3, 4].map(() => skCard(skLine(30, 'small'), skLine(70), skLine(50)));
    },
    card() {
      return [skCard(skLine(50, 'big'), skLine(90), skLine(80), skLine(85), skLine(60))];
    },
    summary() {
      return [skCard(skLine(40, 'small'), skLine(30, 'big'), skLine(90), skLine(90), skLine(70)), ...this.list().slice(0, 3)];
    },
    profile() {
      const head = el('div', 'sk-row');
      head.append(el('span', 'sk sk-avatar'), skLine(50, 'big'));
      return [head, skLine(70), skLine(60), skLine(40)];
    },
  };
  for (const box of document.querySelectorAll('[data-skeleton]')) {
    const make = SKELETONS[box.dataset.skeleton];
    if (!make) continue;
    const parts = make.call(SKELETONS);
    for (const part of parts) part.setAttribute('aria-hidden', 'true');
    box.append(...parts);
  }

  // ---------- «Липкая» левая колонка на широких страницах ----------
  // Колонка ниже окна прилипает своим низом: её можно дочитать без отдельной прокрутки.
  const GAP = 24;
  function fitSticky() {
    for (const side of document.querySelectorAll('.split__side--sticky')) {
      const top = Math.min(GAP, window.innerHeight - side.offsetHeight - GAP);
      side.style.setProperty('--sticky-top', `${top}px`);
    }
  }
  window.addEventListener('resize', fitSticky);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(fitSticky);
    new MutationObserver(() => {
      for (const side of document.querySelectorAll('.split__side--sticky')) ro.observe(side);
      fitSticky();
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------- Колокольчик со счётчиком непрочитанных ----------
  async function updateBell() {
    const bell = document.getElementById('bell');
    if (!bell) return;
    const badge = document.getElementById('bell-count');
    let data;
    try {
      const res = await fetch('/api/notifications/count', { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    window.DekanatPwa.sessionConfirmed(data.role);
    // Пункт «Уведомления» в боковом меню (на компьютере) — с тем же счётчиком.
    const navItem = document.getElementById('nav-notifications');
    const navCount = document.getElementById('nav-count');
    if (data.role === 'staff') {
      // Студенческий билет есть только у студента.
      for (const id of ['nav-student-card', 'header-card']) {
        const node = document.getElementById(id);
        if (node) node.hidden = true;
      }
      bell.href = '/announcements';
      bell.setAttribute('aria-label', 'Объявления');
      if (navItem) {
        navItem.href = '/announcements';
        document.getElementById('nav-notifications-label').textContent = 'Объявления';
      }
      return;
    }
    const n = data.count || 0;
    const label = n ? `Уведомления: ${n} ${plural(n, 'непрочитанное', 'непрочитанных', 'непрочитанных')}` : 'Уведомления';
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    bell.setAttribute('aria-label', label);
    if (navCount) {
      navCount.textContent = badge.textContent;
      navCount.hidden = n === 0;
      navItem.setAttribute('aria-label', label);
    }
  }
  updateBell();

  // ---------- Вкладки «День / Неделя»: выбранная сотрудником группа не теряется ----------
  const keptGroup = new URLSearchParams(window.location.search).get('group');
  if (keptGroup) {
    for (const tab of document.querySelectorAll('.tab[data-keep-group]')) {
      tab.href = `${tab.getAttribute('href')}?group=${encodeURIComponent(keptGroup)}`;
    }
  }

  // ---------- Выход ----------
  const logout = document.getElementById('logout-button');
  if (logout) {
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      await window.DekanatPwa.signOut();
      window.location.href = '/';
    });
  }

  return { offlineBar, hideOfflineBar, reloadWhenOnline, savedLabel, todayInMoscow, disciplineTitle, el, fetchJSON, postJSON, dayMonth, fullDate, dateTime, weekdayLong, weekdayShort, capitalize, plural, countdown, duration, updateBell, setupGroup, changeLines, shortName, place, toMinutes, minutesBetween, KIND, BADGE, illustration, emptyState };
})();
