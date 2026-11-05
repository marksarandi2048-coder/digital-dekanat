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
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
  };

  // Иконки — наши собственные константы, не данные пользователя, поэтому их можно вставлять как разметку.
  function icon(name) {
    const span = el('span', 'tile__icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    return span;
  }

  // Плитка: заголовок с иконкой, содержимое, внизу — куда ведёт.
  // href есть — вся плитка ссылка; нет — обычный блок (внутри свои ссылки).
  function tile({ kind, title, iconName, href, more, wide }) {
    const node = el(href ? 'a' : 'section', `tile tile--${kind}${wide ? ' tile--wide' : ''}`);
    if (href) node.href = href;
    const head = el('div', 'tile__head');
    head.append(icon(iconName), el(href ? 'span' : 'h2', 'tile__title', title));
    const body = el('div', 'tile__body');
    node.append(head, body);
    if (more) node.append(el('span', 'tile__more', `${more} →`));
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
  function lessonTile(s, today) {
    if (!s) {
      const t = tile({ kind: 'lesson', title: 'Пары', iconName: 'lesson', href: '/today', more: 'Расписание на сегодня', wide: true });
      t.body.append(el('p', 'tile__text', 'Группа не указана в профиле — обратитесь в деканат.'));
      return t.node;
    }

    if (s.current || s.next) {
      const t = tile({ kind: 'lesson', title: s.current ? 'Сейчас' : 'Следующая пара', iconName: 'lesson', href: '/today', more: 'Расписание на сегодня', wide: true });
      if (s.current) {
        t.body.append(D.renderLesson(s.current.lesson, { type: 'now', left: s.current.left }));
        if (s.next) {
          t.body.append(el('p', 'tile__after', `Дальше в ${s.next.lesson.time.start}: ${s.next.lesson.discipline}`));
        }
      } else {
        t.body.append(D.renderLesson(s.next.lesson, { type: 'next', in: s.next.in }));
      }
      if (s.changes) {
        t.body.append(el('p', 'tile__alert', `Сегодня ${s.changes} ${D.plural(s.changes, 'изменение', 'изменения', 'изменений')} в расписании`));
      }
      return t.node;
    }

    // Сегодня пар больше нет — показываем первую пару следующего учебного дня.
    const up = s.upcoming;
    const href = up ? `/week?start=${up.date}#day-${up.date}` : '/week';
    const t = tile({ kind: 'lesson', title: 'Следующая пара', iconName: 'lesson', href, more: 'Расписание на неделю', wide: true });
    t.body.append(el('p', 'tile__text', s.todayCount ? 'Пары на сегодня закончились.' : 'Сегодня пар нет.'));
    if (up) {
      const when = up.date === addDays(today, 1) ? 'Завтра' : D.capitalize(`${D.weekdayLong(up.date)}, ${D.dayMonth(up.date)}`);
      t.body.append(el('p', 'tile__sub', `${when} — ${up.count} ${D.plural(up.count, 'пара', 'пары', 'пар')}, первая в ${up.lesson.time.start}`));
      t.body.append(D.renderLesson(up.lesson));
    } else {
      t.body.append(el('p', 'tile__sub', 'В ближайшие две недели занятий нет.'));
    }
    return t.node;
  }

  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function deadlineTile(d) {
    const t = tile({ kind: 'deadline', title: 'Ближайший дедлайн', iconName: 'deadline', href: '/notifications', more: 'Все сроки' });
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
    else verdict = ['ok', r.isFinal ? 'Семестр закрыт без долгов' : 'Всё идёт по плану'];
    t.body.append(el('p', `tile__verdict tile__verdict--${verdict[0]}`, verdict[1]));
    return t.node;
  }

  function requestTile(r, active) {
    if (!r) {
      const t = tile({ kind: 'request', title: 'Заявки', iconName: 'request', href: '/requests', more: 'Заказать справку' });
      t.body.append(el('p', 'tile__text', 'Заявок пока нет.'), el('p', 'tile__sub', 'Справку можно заказать онлайн меньше чем за минуту.'));
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
      t.body.append(el('p', 'tile__text', 'Всё прочитано.'), el('p', 'tile__sub', 'Новые объявления и изменения появятся здесь.'));
      return t.node;
    }
    const big = el('p', 'tile__big');
    big.append(document.createTextNode(String(n.unread)), el('span', 'tile__of', ` ${D.plural(n.unread, 'непрочитанное', 'непрочитанных', 'непрочитанных')}`));
    t.body.append(big);
    if (n.important) t.body.append(el('span', 'badge badge--cancelled', `Важных: ${n.important}`));
    if (n.latest) t.body.append(el('p', 'tile__text', `${n.latest.kindLabel}: ${n.latest.title}`));
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
    content.className = 'tiles';
    content.replaceChildren(
      lessonTile(data.schedule, data.now.date),
      deadlineTile(data.deadline),
      ratingTile(data.rating),
      requestTile(data.request, data.activeRequests),
      notificationsTile(data.notifications),
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
      main.append(el('span', 'tile__row-title', r.title), el('span', 'tile__sub', `${r.student.fullName}, ${r.student.group} · ${D.dateTime(r.createdAt)}`));
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

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/home');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    document.getElementById('greeting').textContent = `${greeting(data.now.time)}, ${data.firstName}`;
    document.getElementById('date-label').textContent = D.capitalize(`${D.weekdayLong(data.now.date)}, ${D.dayMonth(data.now.date)}`);
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    loading.hidden = true;
    errorBox.hidden = true;
    content.hidden = false;
  }

  load();

  // Раз в минуту обновляем плитки («ещё 40 мин» и т. п.), пока страница открыта.
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 60 * 1000);
})();
