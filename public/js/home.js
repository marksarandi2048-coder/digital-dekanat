'use strict';
// «Главная»: приветствие и плитки-виджеты. У студента и сотрудника — свои плитки.
// Каждая плитка ведёт в свой раздел. Данные — одним запросом /api/home.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  // Собственный набор журнальных иконок: контур — цветом текста, акцент — золотой линией (группа j-gold).
  const gold = (shapes) => `<g class="j-gold">${shapes}</g>`;
  const ICONS = {
    deadline: `<path d="M10 5h12M10 27h12M11 5c0 6 5 8 5 11s-5 5-5 11M21 5c0 6-5 8-5 11s5 5 5 11"/>${gold('<path d="M13.4 9h5.2M13 24.6c1.1-1.5 2-2.2 3-2.9 1 .7 1.9 1.4 3 2.9z"/>')}`,
    rating: `<path d="M16 27.5c-6 0-11-4.7-11-11.7 0-3 1-5.6 2.6-7.6M16 27.5c6 0 11-4.7 11-11.7 0-3-1-5.6-2.6-7.6"/>${gold('<path d="M6.3 13c1.7.2 3 1.3 3.5 3M5.8 18.6c1.6-.3 3.2.4 4 1.9M9 24c1.2-1 3-1.1 4.3-.2M25.7 13c-1.7.2-3 1.3-3.5 3M26.2 18.6c-1.6-.3-3.2.4-4 1.9M23 24c-1.2-1-3-1.1-4.3-.2"/>')}<path d="M16 9.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z"/>`,
    request: `<path d="M7 4h12.5L25 9.5V20M7 4v24h9M19.5 4v5.5H25M11 13h10M11 17h6"/>${gold('<circle cx="21.5" cy="22.5" r="3.6"/><path d="M19.6 25.7l-1 3.8 2.9-1.4 2.9 1.4-1-3.8"/>')}`,
    bell: `<path d="M16 5.5c-5 0-8 3.7-8 9 0 5.4-2 7.4-3 8.9h22c-1-1.5-3-3.5-3-8.9 0-5.3-3-9-8-9zM16 5.5V3"/>${gold('<path d="M13 26.5c.6 1.6 1.7 2.5 3 2.5s2.4-.9 3-2.5M11.5 14c0-2.7 1.5-4.5 3.7-5"/>')}`,
    card: `<rect x="4" y="7" width="24" height="18" rx="1.5"/><path d="M18 13h6.5M18 17h6.5M18 21h3.5"/>${gold('<circle cx="10.8" cy="13.5" r="2.7"/><path d="M6.9 21.2c.7-2.3 2.1-3.5 3.9-3.5s3.2 1.2 3.9 3.5"/>')}`,
    star: `<circle cx="16" cy="20.5" r="8"/><path d="M11 14L7 4h5l4 7.5M21 14l4-10h-5l-3.2 6"/>${gold('<path d="M16 15.9l1.4 2.9 3.2.5-2.3 2.2.5 3.2-2.8-1.5-2.8 1.5.5-3.2-2.3-2.2 3.2-.5z"/>')}`,
    bolt: `<path d="M27 4c-9 0-17 5-19.5 15-.5 2-.5 4 0 5.2 1.2.5 3.2.5 5.2 0C22 21.5 27 13 27 4zM13.5 19.5h6M11.3 15.5h5"/>${gold('<path d="M4.5 28.5L20 11.5"/>')}`,
    megaphone: `<path d="M5 13v6l5 1.2L24 25.5v-19L10 11.8zM24 12c2.2 0 3.5 1.8 3.5 4s-1.3 4-3.5 4"/>${gold('<path d="M11 20.8l1.6 6.2h4l-1.5-5"/>')}`,
  };

  // Иконки — наши собственные константы, не данные пользователя, поэтому их можно вставлять как разметку.
  function icon(name) {
    const span = el('span', 'tile__icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
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
    if (h >= 5 && h < 12) return tr('home.dobroe_utro');
    if (h >= 12 && h < 17) return tr('home.dobryy_den');
    if (h >= 17 && h < 23) return tr('home.dobryy_vecher');
    return tr('home.dobroy_nochi');
  }

  const num = D.decimal;

  // Крупная цифра. При первом показе она «набегает» от нуля.
  function countUp(value) {
    const span = el('span', 'j-num', num(value));
    span.dataset.count = String(value);
    return span;
  }

  const COUNT_MS = 1100;
  function runCounters() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = [...content.querySelectorAll('[data-count]')].map((node) => {
      const target = Number(node.dataset.count);
      const decimals = (node.dataset.count.split('.')[1] || '').length;
      return { node, target, decimals };
    });
    if (!items.length) return;
    const show = (share) => {
      for (const { node, target, decimals } of items) node.textContent = num((target * share).toFixed(decimals));
    };
    show(0);
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / COUNT_MS);
      show(1 - (1 - t) ** 3);
      if (t < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

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
    when.append(el('span', 'hero__time', `${l.time.start}–${l.time.end}`), document.createTextNode(tr('home.pair_para_p1', { pair: l.pair, p1: D.KIND[l.kind] || '' })));
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
    box.append(el('p', 'hero__big', tr('home.esche_p0', { p0: D.duration(left) })));
    const bar = el('div', 'hero__bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', tr('home.skolko_proshlo_ot_pary'));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(passed));
    bar.setAttribute('aria-valuetext', tr('home.proshlo_passed_iz_total', { passed, total }));
    const fill = el('span', 'hero__fill');
    fill.style.width = `${Math.round((passed / total) * 100)}%`;
    bar.append(fill);
    box.append(bar, el('p', 'hero__note', tr('home.proshlo_passed_iz_total_2', { passed, total })));
    side.append(box);
  }

  // Обратный отсчёт до начала.
  function countdown(side, minutes) {
    const box = el('div', 'hero__countdown');
    box.append(el('p', 'hero__note', tr('home.nachalo_cherez')), el('p', 'hero__big', D.duration(minutes)));
    side.append(box);
  }

  function lessonTile(s, today) {
    if (!s) {
      const h = heroShell('/today', tr('home.pary'), tr('home.raspisanie'));
      h.info.append(el('p', 'hero__title', tr('home.gruppa_ne_ukazana_v')), el('p', 'hero__where', tr('home.obratites_v_dekanat')));
      return h.node;
    }

    if (s.current || s.next) {
      const h = heroShell('/today', s.current ? tr('home.seychas_idet') : tr('home.sleduyuschaya_para'), tr('home.raspisanie_na_segodnya'));
      if (s.current) {
        heroLesson(h.info, s.current.lesson);
        progress(h.side, s.current.lesson, s.current.left);
        if (s.next) h.info.append(el('p', 'hero__after', tr('home.dalshe_v_start_discipline', { start: s.next.lesson.time.start, discipline: s.next.lesson.discipline })));
      } else {
        heroLesson(h.info, s.next.lesson);
        countdown(h.side, s.next.in);
      }
      if (s.changes) {
        h.info.append(el('p', 'hero__alert', tr('home.segodnya_changes_p1_v', { changes: s.changes, p1: D.plural(s.changes, tr('home.izmenenie'), tr('home.izmeneniya'), tr('home.izmeneniy')) })));
      }
      return h.node;
    }

    // Сегодня пар больше нет — показываем первую пару следующего учебного дня.
    const up = s.upcoming;
    const href = up ? `/week?start=${up.date}#day-${up.date}` : '/week';
    const h = heroShell(href, s.todayCount ? tr('home.pary_na_segodnya_zakonchilis') : tr('home.par_segodnya_net_mozhno'), tr('home.raspisanie_na_nedelyu'));
    if (up) {
      const when = up.date === addDays(today, 1) ? tr('home.zavtra') : D.capitalize(`${D.weekdayLong(up.date)}, ${D.dayMonth(up.date)}`);
      h.info.append(el('p', 'hero__day', tr('home.when_count_p2_pervaya', { when, count: up.count, p2: D.plural(up.count, tr('home.para'), tr('home.pary_2'), tr('home.par')) })));
      heroLesson(h.info, up.lesson);
      const box = el('div', 'hero__countdown');
      box.append(el('p', 'hero__note', when), el('p', 'hero__big', tr('home.v_start', { start: up.lesson.time.start })));
      h.side.append(box);
    } else {
      h.info.append(el('p', 'hero__title', tr('home.zanyatiy_v_blizhayshie_dve')));
    }
    return h.node;
  }

  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function deadlineTile(d) {
    const t = tile({ kind: 'deadline', title: tr('home.dedlayn'), iconName: 'deadline', href: '/notifications', more: tr('home.vse_sroki') });
    if (!d) {
      t.body.append(el('p', 'tile__text', tr('home.srokov_v_blizhayshee_vremya')));
      return t.node;
    }
    const soon = d.own && d.daysLeft <= 3;
    const big = el('p', `tile__big${soon ? ' tile__big--soon' : ''}`);
    const words = D.capitalize(D.countdown(d.daysLeft)).match(/^(.*?)(\d+)(.*)$/);
    if (words) {
      big.append(document.createTextNode(`${words[1]} `), countUp(Number(words[2])), document.createTextNode(` ${words[3]}`));
      big.classList.add('tile__big--number');
    } else {
      big.textContent = D.capitalize(D.countdown(d.daysLeft));
    }
    t.body.append(
      big,
      el('p', 'tile__text', d.title),
      el('p', 'tile__sub', `${d.own ? tr('home.srok') : tr('home.ozhidaetsya_ot_prepodavatelya_do')}: ${D.dayMonth(d.date)}`),
    );
    if (d.more > 0) t.body.append(el('p', 'tile__sub', tr('home.i_esche_more_p1', { more: d.more, p1: D.plural(d.more, tr('home.srok_2'), tr('home.sroka'), tr('home.srokov')) })));
    return t.node;
  }

  function ratingTile(r) {
    const t = tile({ kind: 'rating', title: tr('home.uspevaemost'), iconName: 'rating', href: '/grades', more: tr('home.otsenki') });
    if (!r) {
      t.body.append(el('p', 'tile__text', tr('home.dannykh_o_semestre_poka')));
      return t.node;
    }
    const big = el('p', 'tile__big');
    if (r.isFinal) {
      t.body.append(el('p', 'tile__sub', tr('home.reyting_semester', { semester: r.semester })));
      big.append(countUp(r.total), el('span', 'tile__of', tr('home.iz_max', { max: r.max })));
      t.body.append(big);
    } else if (r.soFar.possible > 0) {
      t.body.append(el('p', 'tile__sub', tr('home.nabrano_na_segodnya_semester', { semester: r.semester })));
      big.append(countUp(r.soFar.points), el('span', 'tile__of', tr('home.iz_p0_vozmozhnykh', { p0: num(r.soFar.possible) })));
      t.body.append(big);
      if (r.soFar.percent !== null) t.body.append(el('p', 'tile__sub', tr('home.percent_ot_vozmozhnogo', { percent: r.soFar.percent })));
    } else {
      t.body.append(el('p', 'tile__sub', r.semester), el('p', 'tile__text', tr('home.otsenok_za_semestr_poka')));
    }
    if (r.bonus > 0) t.body.append(el('p', 'tile__sub', tr('home.nadbavka_p0', { p0: num(r.bonus) })));

    let verdict;
    if (r.debts) verdict = ['bad', r.debts === 1 ? tr('home.est_dolg') : tr('home.est_dolgi_debts', { debts: r.debts })];
    else if (r.overdue) verdict = ['bad', tr('home.overdue_p1_v_srok', { overdue: r.overdue, p1: D.plural(r.overdue, tr('home.otsenka_ne_vystavlena'), tr('home.otsenki_ne_vystavleny'), tr('home.otsenok_ne_vystavleno')) })];
    else if (r.isFinal || r.pending) verdict = ['ok', r.isFinal ? tr('home.semestr_zakryt_bez_dolgov') : tr('home.vse_idet_po_planu')];
    if (verdict) t.body.append(el('p', `tile__verdict tile__verdict--${verdict[0]}`, verdict[1]));
    return t.node;
  }

  function requestTile(r, active) {
    if (!r) {
      const t = tile({ kind: 'request', title: tr('home.zayavki'), iconName: 'request', href: '/requests', more: tr('home.zakazat_spravku') });
      t.body.append(D.illustration('request', 'illu--small'), el('p', 'tile__text', tr('home.zayavok_poka_net_zakazhite')));
      return t.node;
    }
    const t = tile({ kind: 'request', title: tr('home.poslednyaya_zayavka'), iconName: 'request', href: `/requests/${r.id}`, more: tr('home.otkryt_zayavku') });
    t.body.append(
      el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel),
      el('p', 'tile__text', r.title),
      el('p', 'tile__sub', tr('home.id_podana_p1', { id: r.id, p1: D.dateTime(r.createdAt) })),
    );
    if (active > 1) t.body.append(el('p', 'tile__sub', tr('home.aktivnykh_zayavok_active', { active })));
    return t.node;
  }

  function notificationsTile(n) {
    const t = tile({ kind: 'notifications', title: tr('home.uvedomleniya'), iconName: 'bell', href: '/notifications', more: tr('home.vse_uvedomleniya') });
    if (!n.unread) {
      t.body.append(D.illustration('read', 'illu--small'), el('p', 'tile__text', tr('home.vse_uvedomleniya_prochitany')));
      return t.node;
    }
    const big = el('p', 'tile__big');
    big.append(countUp(n.unread), el('span', 'tile__of', ` ${D.plural(n.unread, tr('home.neprochitannoe'), tr('home.neprochitannykh'), tr('home.neprochitannykh'))}`));
    t.body.append(big);
    if (n.important) t.body.append(el('span', 'badge badge--cancelled', tr('home.vazhnykh_important', { important: n.important })));
    if (n.latest) t.body.append(el('p', 'tile__text', `${n.latest.kindLabel}: ${n.latest.title}`));
    return t.node;
  }

  // Мини-превью билета. Картинка одна на все обновления плиток (раз в минуту), чтобы QR не мигал.
  let cardQr = null;
  function cardTile(card) {
    const t = tile({ kind: 'card', title: tr('home.studencheskiy'), iconName: 'card', href: '/student-card', more: tr('home.otkryt_studencheskiy_bilet') });
    if (!cardQr) {
      cardQr = window.DekanatCardFull.qrImage('tile-card__qr', 72);
      cardQr.alt = '';
    }
    const row = el('div', 'tile-card');
    const facts = el('dl', 'tile-card__facts');
    facts.append(el('dt', null, tr('home.nomer')), el('dd', null, card.number), el('dt', null, tr('home.deystvuet_do')), el('dd', null, D.fullDate(card.validUntil)));
    row.append(facts, cardQr);
    t.body.append(row, el('p', 'stc-concept stc-concept--tile', window.DekanatCardFull.CONCEPT));
    return t.node;
  }

  function bonusTile(r) {
    const t = tile({ kind: 'bonus', title: tr('home.nadbavka'), iconName: 'star', href: '/grades/bonus' });
    if (r) {
      const big = el('p', 'tile__big');
      const plus = el('span', 'j-num j-num--plus', '+');
      big.append(plus, countUp(r.bonus));
      big.append(el('span', 'tile__of', tr('home.iz_bonusmax', { bonusMax: r.bonusMax })));
      t.body.append(big);
    }
    t.body.append(el('p', 'tile__where', tr('home.gde_zarabotat')));
    return t.node;
  }

  function quickTile() {
    const t = tile({ kind: 'quick', title: tr('home.bystrye_deystviya'), iconName: 'bolt' });
    t.node.classList.add('tile--full');
    const row = el('div', 'tile__actions');
    const order = el('a', 'button', tr('home.zakazat_spravku'));
    order.href = '/requests/new?type=study_certificate';
    const week = el('a', 'button button--secondary', tr('home.raspisanie_na_nedelyu'));
    week.href = '/week';
    row.append(order, week);
    t.body.append(row);
    return t.node;
  }

  function renderStudent(data) {
    content.className = 'tiles tiles--student';
    content.replaceChildren(
      lessonTile(data.schedule, data.now.date),
      ratingTile(data.rating),
      deadlineTile(data.deadline),
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
    const big = el('span', 'tile__big');
    big.append(countUp(n));
    a.append(big, el('span', 'tile__text', label));
    a.setAttribute('aria-label', `${label}: ${n}`);
    return a;
  }

  function openRequestsTile(list, total) {
    const t = tile({ kind: 'open', title: tr('home.zhdut_obrabotki'), iconName: 'request', wide: true });
    if (!list.length) {
      t.body.append(el('p', 'tile__text', tr('home.otkrytykh_zayavok_net_vse')));
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
    const all = el('a', 'tile__more', tr('home.vse_otkrytye_zayavki_total', { total }));
    all.href = '/requests';
    t.body.append(ul);
    t.node.append(all);
    return t.node;
  }

  function announcementsTile(list) {
    const t = tile({ kind: 'announcements', title: tr('home.poslednie_obyavleniya'), iconName: 'megaphone' });
    if (!list.length) {
      t.body.append(el('p', 'tile__text', tr('home.obyavleniy_poka_net')));
    } else {
      const ul = el('ul', 'tile__list');
      for (const a of list) {
        const li = el('li');
        const link = el('a', 'tile__row');
        link.href = `/announcements/${a.id}`;
        const main = el('span', 'tile__row-main');
        main.append(el('span', 'tile__row-title', a.title), el('span', 'tile__sub', tr('home.audience_prochitali_read_iz', { audience: a.audience, read: a.read, recipients: a.recipients })));
        link.append(main);
        if (a.important) link.append(el('span', 'badge badge--cancelled', tr('home.vazhnoe')));
        li.append(link);
        ul.append(li);
      }
      t.body.append(ul);
    }
    const add = el('a', 'button button--secondary', tr('home.novoe_obyavlenie'));
    add.href = '/announcements';
    t.node.append(add);
    return t.node;
  }

  function renderStaff(data) {
    const counters = el('div', 'tile-counters tile--full');
    counters.append(
      counter(data.counts.accepted, tr('home.novye_zayavki'), 'accepted'),
      counter(data.counts.inProgress, tr('home.v_rabote'), 'in_progress'),
      counter(data.counts.ready, tr('home.gotovy_k_vydache'), 'ready'),
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
      box.append(el('h2', 'section-title', tr('home.bez_interneta_dostupny')));
      for (const [href, label] of [['/week', tr('home.raspisanie_na_nedelyu')], ['/student-card', tr('home.studencheskiy_bilet')]]) {
        const link = el('a', 'button', label);
        link.href = href;
        box.append(link);
      }
      box.append(el('p', 'muted', tr('home.zayavki_otsenki_i_ostalnoe')));
      content.className = '';
      content.replaceChildren(box);
      content.hidden = false;
    } else {
      errorBox.textContent = tr('home.net_podklyucheniya_kabinet_otkroetsya');
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
    const today = D.capitalize(`${D.weekdayLong(data.now.date)}, ${D.dayMonth(data.now.date)}`);
    document.getElementById('date-label').textContent = data.rating ? `${today} · ${data.rating.semester}` : today;
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    window.DekanatPwa.mountInstallHint(document.getElementById('install-hint'), data.role);
    loading.hidden = true;
    errorBox.hidden = true;
    content.hidden = false;
  }

  // Первая загрузка — с анимацией появления, дальше обновления раз в минуту без неё.
  // Пока идёт появление, обновлений нет: первое придёт только через минуту.
  const APPEAR_MS = 1400;
  load().then(() => {
    runCounters();
    window.setTimeout(() => content.classList.add('is-live'), APPEAR_MS);
  });

  // Раз в минуту обновляем плитки («ещё 40 мин» и т. п.), пока страница открыта.
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 60 * 1000);
})();
