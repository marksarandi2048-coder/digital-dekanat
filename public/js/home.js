'use strict';
// «Главная»: приветствие и плитки-виджеты. У студента и сотрудника — свои плитки.
// Каждая плитка ведёт в свой раздел. Данные — одним запросом /api/home.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  const ICONS = {
    lesson: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/>',
    deadline: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    rating: '<path d="M12 3l10 5-10 5L2 8z"/><path d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/><path d="M22 8v6"/>',
    request: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.5 16c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M15 10h3M15 14h3"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
  };

  // Иконки — наши собственные константы, не данные пользователя, поэтому их можно вставлять как разметку.
  function icon(name) {
    const span = el('span', 'tile__icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    return span;
  }

  // Плитка: заголовок с иконкой и стрелкой «перейти», под ним — содержимое.
  // href есть — вся плитка ссылка; нет — обычный блок (внутри свои ссылки).
  // more — куда ведёт плитка: видна стрелка →, текст читают программы экранного доступа.
  function tile({ kind, title, iconName, href, more, wide }) {
    const node = el(href ? 'a' : 'section', `tile tile--${kind}${wide ? ' tile--wide' : ''}`);
    if (href) node.href = href;
    const head = el('div', 'tile__head');
    head.append(icon(iconName), el(href ? 'span' : 'h2', 'tile__title', title));
    if (more) {
      const go = el('span', 'tile__go');
      go.append(el('span', 'visually-hidden', ` — ${more}`));
      const arrow = el('span', null, '→');
      arrow.setAttribute('aria-hidden', 'true');
      go.append(arrow);
      head.append(go);
    }
    const body = el('div', 'tile__body');
    node.append(head, body);
    return { node, body };
  }

  function greeting(time) {
    const h = Number(time.slice(0, 2));
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 17) return 'Добрый день';
    if (h >= 17 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  }

  const num = (n) => String(n).replace('.', ',');

  // ---------- Студент ----------
  // Главный блок: текущая или следующая пара — крупно.
  function heroShell(href, label, goText) {
    const node = el('a', 'tile tile--hero tile--full');
    node.href = href;
    const top = el('div', 'hero__top');
    top.append(el('span', 'hero__label', label));
    const go = el('span', 'hero__go', `${goText} `);
    const arrow = el('span', null, '→');
    arrow.setAttribute('aria-hidden', 'true');
    go.append(arrow);
    top.append(go);
    const main = el('div', 'hero__main');
    const info = el('div', 'hero__info');
    const side = el('div', 'hero__side');
    main.append(info, side);
    node.append(top, main);
    return { node, info, side };
  }

  // Дисциплина, время, аудитория, преподаватель и что изменилось.
  function heroLesson(info, l) {
    if (l.status !== 'normal') info.append(el('span', `badge badge--${l.status} hero__badge`, D.BADGE[l.status]));
    info.append(D.disciplineTitle('p', 'hero__title', l.discipline, l.color));
    const when = el('p', 'hero__when');
    when.append(el('span', 'hero__time', `${l.time.start}–${l.time.end}`), document.createTextNode(` · ${l.pair} пара · ${D.KIND[l.kind] || ''}`));
    info.append(when);
    const where = el('p', 'hero__where');
    where.append(
      el('span', `hero__room${l.status === 'room_changed' ? ' is-changed' : ''}`, D.place(l.building, l.room)),
      document.createTextNode(' · '),
      el('span', l.status === 'teacher_changed' ? 'is-changed' : null, D.shortName(l.teacher)),
    );
    info.append(where);
    const lines = D.changeLines(l);
    if (lines.length) info.append(el('p', 'hero__change', lines.join(' · ')));
  }

  // Полоска «прошло 35 из 80 минут».
  function progress(side, lesson, left) {
    const total = D.minutesBetween(lesson.time.start, lesson.time.end);
    const passed = Math.max(0, total - left);
    const box = el('div', 'hero__progress');
    box.append(el('p', 'hero__big', `ещё ${D.duration(left)}`));
    const bar = el('div', 'hero__bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Сколько прошло от пары');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(passed));
    bar.setAttribute('aria-valuetext', `прошло ${passed} из ${total} минут`);
    const fill = el('span', 'hero__fill');
    fill.style.width = `${Math.round((passed / total) * 100)}%`;
    bar.append(fill);
    box.append(bar, el('p', 'hero__note', `Прошло ${passed} из ${total} минут`));
    side.append(box);
  }

  // Обратный отсчёт до начала.
  function countdown(side, minutes) {
    const box = el('div', 'hero__countdown');
    box.append(el('p', 'hero__note', 'Начало через'), el('p', 'hero__big', D.duration(minutes)));
    side.append(box);
  }

  function lessonTile(s, today) {
    if (!s) {
      const h = heroShell('/today', 'Пары', 'Расписание');
      h.info.append(el('p', 'hero__title', 'Группа не указана в профиле'), el('p', 'hero__where', 'Обратитесь в деканат.'));
      return h.node;
    }

    if (s.current || s.next) {
      const h = heroShell('/today', s.current ? 'Сейчас идёт' : 'Следующая пара', 'Расписание на сегодня');
      if (s.current) {
        heroLesson(h.info, s.current.lesson);
        progress(h.side, s.current.lesson, s.current.left);
        if (s.next) h.info.append(el('p', 'hero__after', `Дальше в ${s.next.lesson.time.start}: ${s.next.lesson.discipline}`));
      } else {
        heroLesson(h.info, s.next.lesson);
        countdown(h.side, s.next.in);
      }
      if (s.changes) {
        h.info.append(el('p', 'hero__alert', `Сегодня ${s.changes} ${D.plural(s.changes, 'изменение', 'изменения', 'изменений')} в расписании`));
      }
      return h.node;
    }

    // Сегодня пар больше нет — показываем первую пару следующего учебного дня.
    const up = s.upcoming;
    const href = up ? `/week?start=${up.date}#day-${up.date}` : '/week';
    const h = heroShell(href, s.todayCount ? 'Пары на сегодня закончились' : 'Пар сегодня нет — можно выдохнуть', 'Расписание на неделю');
    if (up) {
      const when = up.date === addDays(today, 1) ? 'Завтра' : D.capitalize(`${D.weekdayLong(up.date)}, ${D.dayMonth(up.date)}`);
      h.info.append(el('p', 'hero__day', `${when} · ${up.count} ${D.plural(up.count, 'пара', 'пары', 'пар')}, первая:`));
      heroLesson(h.info, up.lesson);
      const box = el('div', 'hero__countdown');
      box.append(el('p', 'hero__note', when), el('p', 'hero__big', `в ${up.lesson.time.start}`));
      h.side.append(box);
    } else {
      h.info.append(el('p', 'hero__title', 'Занятий в ближайшие две недели нет'));
    }
    return h.node;
  }

  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function deadlineTile(d) {
    const t = tile({ kind: 'deadline', title: 'Дедлайн', iconName: 'deadline', href: '/notifications', more: 'Все сроки' });
    if (!d) {
      t.body.append(el('p', 'tile__text', 'Сроков в ближайшее время нет.'));
      return t.node;
    }
    const soon = d.own && d.daysLeft <= 3;
    t.body.append(
      el('p', `tile__big${soon ? ' tile__big--soon' : ''}`, D.capitalize(D.countdown(d.daysLeft))),
      el('p', 'tile__text', d.title),
      el('p', 'tile__sub', `${d.own ? 'Срок' : 'Ожидается от преподавателя до'}: ${D.dayMonth(d.date)}`),
    );
    if (d.more > 0) t.body.append(el('p', 'tile__sub', `И ещё ${d.more} ${D.plural(d.more, 'срок', 'срока', 'сроков')}`));
    return t.node;
  }

  function ratingTile(r) {
    const t = tile({ kind: 'rating', title: 'Успеваемость', iconName: 'rating', href: '/grades', more: 'Оценки' });
    if (!r) {
      t.body.append(el('p', 'tile__text', 'Данных о семестре пока нет.'));
      return t.node;
    }
    const big = el('p', 'tile__big');
    if (r.isFinal) {
      t.body.append(el('p', 'tile__sub', `Рейтинг · ${r.semester}`));
      big.append(document.createTextNode(num(r.total)), el('span', 'tile__of', ` из ${r.max}`));
      t.body.append(big);
    } else if (r.soFar.possible > 0) {
      t.body.append(el('p', 'tile__sub', `Набрано на сегодня · ${r.semester}`));
      big.append(document.createTextNode(num(r.soFar.points)), el('span', 'tile__of', ` из ${num(r.soFar.possible)} возможных`));
      t.body.append(big);
      if (r.soFar.percent !== null) t.body.append(el('p', 'tile__sub', `${r.soFar.percent} % от возможного`));
    } else {
      t.body.append(el('p', 'tile__sub', r.semester), el('p', 'tile__text', 'Оценок за семестр пока нет.'));
    }
    if (r.bonus > 0) t.body.append(el('p', 'tile__sub', `Надбавка: +${num(r.bonus)}`));

    let verdict;
    if (r.debts) verdict = ['bad', r.debts === 1 ? 'Есть долг' : `Есть долги: ${r.debts}`];
    else if (r.overdue) verdict = ['bad', `${r.overdue} ${D.plural(r.overdue, 'оценка не выставлена', 'оценки не выставлены', 'оценок не выставлено')} в срок`];
    else if (r.isFinal || r.pending) verdict = ['ok', r.isFinal ? 'Семестр закрыт без долгов' : 'Всё идёт по плану'];
    if (verdict) t.body.append(el('p', `tile__verdict tile__verdict--${verdict[0]}`, verdict[1]));
    return t.node;
  }

  function requestTile(r, active) {
    if (!r) {
      const t = tile({ kind: 'request', title: 'Заявки', iconName: 'request', href: '/requests', more: 'Заказать справку' });
      t.body.append(D.illustration('request', 'illu--small'), el('p', 'tile__text', 'Заявок пока нет — закажите первую справку'));
      return t.node;
    }
    const t = tile({ kind: 'request', title: 'Последняя заявка', iconName: 'request', href: `/requests/${r.id}`, more: 'Открыть заявку' });
    t.body.append(
      el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel),
      el('p', 'tile__text', r.title),
      el('p', 'tile__sub', `№ ${r.id} · подана ${D.dateTime(r.createdAt)}`),
    );
    if (active > 1) t.body.append(el('p', 'tile__sub', `Активных заявок: ${active}`));
    return t.node;
  }

  function notificationsTile(n) {
    const t = tile({ kind: 'notifications', title: 'Уведомления', iconName: 'bell', href: '/notifications', more: 'Все уведомления' });
    if (!n.unread) {
      t.body.append(D.illustration('read', 'illu--small'), el('p', 'tile__text', 'Все уведомления прочитаны'));
      return t.node;
    }
    const big = el('p', 'tile__big');
    big.append(document.createTextNode(String(n.unread)), el('span', 'tile__of', ` ${D.plural(n.unread, 'непрочитанное', 'непрочитанных', 'непрочитанных')}`));
    t.body.append(big);
    if (n.important) t.body.append(el('span', 'badge badge--cancelled', `Важных: ${n.important}`));
    if (n.latest) t.body.append(el('p', 'tile__text', `${n.latest.kindLabel}: ${n.latest.title}`));
    return t.node;
  }

  // Мини-превью билета. Картинка одна на все обновления плиток (раз в минуту), чтобы QR не мигал.
  let cardQr = null;
  function cardTile(card) {
    const t = tile({ kind: 'card', title: 'Студенческий', iconName: 'card', href: '/student-card', more: 'Открыть студенческий билет' });
    if (!cardQr) {
      cardQr = window.DekanatCardFull.qrImage('tile-card__qr', 72);
      cardQr.alt = '';
    }
    const row = el('div', 'tile-card');
    const facts = el('dl', 'tile-card__facts');
    facts.append(el('dt', null, 'Номер'), el('dd', null, card.number), el('dt', null, 'Действует до'), el('dd', null, D.fullDate(card.validUntil)));
    row.append(facts, cardQr);
    t.body.append(row, el('p', 'stc-concept stc-concept--tile', window.DekanatCardFull.CONCEPT));
    return t.node;
  }

  function bonusTile(r) {
    const t = tile({ kind: 'bonus', title: 'Надбавка', iconName: 'star', href: '/grades/bonus' });
    if (r) {
      const big = el('p', 'tile__big');
      big.append(document.createTextNode(`+${num(r.bonus)}`), el('span', 'tile__of', ` из ${r.bonusMax}`));
      t.body.append(big);
    }
    t.body.append(el('p', 'tile__where', 'где заработать →'));
    return t.node;
  }

  function quickTile() {
    const t = tile({ kind: 'quick', title: 'Быстрые действия', iconName: 'bolt' });
    t.node.classList.add('tile--full');
    const row = el('div', 'tile__actions');
    const order = el('a', 'button', 'Заказать справку');
    order.href = '/requests/new?type=study_certificate';
    const week = el('a', 'button button--secondary', 'Расписание на неделю');
    week.href = '/week';
    row.append(order, week);
    t.body.append(row);
    return t.node;
  }

  function renderStudent(data) {
    content.className = 'tiles tiles--student';
    content.replaceChildren(
      lessonTile(data.schedule, data.now.date),
      deadlineTile(data.deadline),
      ratingTile(data.rating),
      requestTile(data.request, data.activeRequests),
      notificationsTile(data.notifications),
      cardTile(data.card),
      bonusTile(data.rating),
      quickTile(),
    );
  }

  // ---------- Сотрудник ----------
  function counter(n, label, status) {
    const a = el('a', `tile tile--counter${n ? '' : ' tile--zero'}`);
    a.href = `/requests?status=${status}`;
    a.append(el('span', 'tile__big', String(n)), el('span', 'tile__text', label));
    a.setAttribute('aria-label', `${label}: ${n}`);
    return a;
  }

  function openRequestsTile(list, total) {
    const t = tile({ kind: 'open', title: 'Ждут обработки', iconName: 'request', wide: true });
    if (!list.length) {
      t.body.append(el('p', 'tile__text', 'Открытых заявок нет — всё обработано.'));
      return t.node;
    }
    const ul = el('ul', 'tile__list');
    for (const r of list) {
      const li = el('li');
      const a = el('a', 'tile__row');
      a.href = `/requests/${r.id}`;
      const main = el('span', 'tile__row-main');
      main.append(el('span', 'tile__row-title', r.title), el('span', 'tile__sub', `${[r.student.fullName, r.student.group].filter(Boolean).join(', ')} · ${D.dateTime(r.createdAt)}`));
      a.append(main, el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel));
      li.append(a);
      ul.append(li);
    }
    const all = el('a', 'tile__more', `Все открытые заявки (${total}) →`);
    all.href = '/requests';
    t.body.append(ul);
    t.node.append(all);
    return t.node;
  }

  function announcementsTile(list) {
    const t = tile({ kind: 'announcements', title: 'Последние объявления', iconName: 'megaphone' });
    if (!list.length) {
      t.body.append(el('p', 'tile__text', 'Объявлений пока нет.'));
    } else {
      const ul = el('ul', 'tile__list');
      for (const a of list) {
        const li = el('li');
        const link = el('a', 'tile__row');
        link.href = `/announcements/${a.id}`;
        const main = el('span', 'tile__row-main');
        main.append(el('span', 'tile__row-title', a.title), el('span', 'tile__sub', `${a.audience} · прочитали ${a.read} из ${a.recipients}`));
        link.append(main);
        if (a.important) link.append(el('span', 'badge badge--cancelled', 'Важное'));
        li.append(link);
        ul.append(li);
      }
      t.body.append(ul);
    }
    const add = el('a', 'button button--secondary', 'Новое объявление');
    add.href = '/announcements';
    t.node.append(add);
    return t.node;
  }

  function renderStaff(data) {
    const counters = el('div', 'tile-counters tile--full');
    counters.append(
      counter(data.counts.accepted, 'Новые заявки', 'accepted'),
      counter(data.counts.inProgress, 'В работе', 'in_progress'),
      counter(data.counts.ready, 'Готовы к выдаче', 'ready'),
    );
    content.className = 'tiles';
    content.replaceChildren(counters, openRequestsTile(data.openRequests, data.openTotal), announcementsTile(data.announcements));
  }

  // Главная без сети: то, что доступно, — крупными кнопками.
  async function showOffline() {
    let saved = null;
    try {
      saved = await D.fetchJSON('/api/student-card');
    } catch {
      // сохранённого билета нет — покажем просто сообщение
    }
    loading.hidden = true;
    D.offlineBar();
    if (saved && saved.card && saved.offlineSavedAt) {
      const box = el('section', 'card offline-home');
      box.append(el('h2', 'section-title', 'Без интернета доступны'));
      for (const [href, label] of [['/week', 'Расписание на неделю'], ['/student-card', 'Студенческий билет']]) {
        const link = el('a', 'button', label);
        link.href = href;
        box.append(link);
      }
      box.append(el('p', 'muted', 'Заявки, оценки и остальное откроются, когда вернётся интернет.'));
      content.className = '';
      content.replaceChildren(box);
      content.hidden = false;
    } else {
      errorBox.textContent = 'Нет подключения. Кабинет откроется, когда вернётся интернет.';
      errorBox.hidden = false;
    }
  }

  let offlineScreen = false;

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/home');
    } catch (err) {
      if (err.offline) {
        if (!content.hidden && !offlineScreen) {
          D.offlineBar(); // плитки уже на экране — оставляем их, предупреждаем плашкой
          return;
        }
        if (!offlineScreen) {
          offlineScreen = true;
          D.reloadWhenOnline();
          await showOffline();
        }
        return;
      }
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    if (offlineScreen) {
      window.location.reload(); // связь вернулась
      return;
    }
    document.getElementById('greeting').textContent = `${greeting(data.now.time)}, ${data.firstName}`;
    document.getElementById('date-label').textContent = D.capitalize(`${D.weekdayLong(data.now.date)}, ${D.dayMonth(data.now.date)}`);
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    window.DekanatPwa.mountInstallHint(document.getElementById('install-hint'), data.role);
    loading.hidden = true;
    errorBox.hidden = true;
    content.hidden = false;
  }

  // Первая загрузка — с анимацией появления, дальше обновления раз в минуту без неё.
  load().then(() => content.classList.add('is-live'));

  // Раз в минуту обновляем плитки («ещё 40 мин» и т. п.), пока страница открыта.
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 60 * 1000);
})();
