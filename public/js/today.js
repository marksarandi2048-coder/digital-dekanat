'use strict';
// Страница «Сегодня»: таймлайн дня. Пары стоят на шкале времени на своих местах,
// между ними — окна и обед, линия «сейчас» движется сама.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const { card, roomText } = window.DekanatLesson;
  const toMin = D.toMinutes;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const titleBox = document.getElementById('day-title');
  const chipsBox = document.getElementById('day-chips');
  const dayNav = document.getElementById('day-nav');
  const dayNavDays = document.getElementById('day-nav-days');
  const todayButton = document.getElementById('day-nav-today');
  const bringBox = document.getElementById('today-bring');
  const bringList = document.getElementById('today-bring-list');

  const SHORT_BREAK = 15; // обычная перемена — не окно, не подписываем
  const COVERED_MIN = 15; // ближе этого метка «сейчас» закрывает подпись часа
  const TICK_MS = 15 * 1000;
  const RELOAD_MS = 60 * 1000;

  // ---------- Часы: московское время с сервера, а не часы устройства ----------
  let clock = null;
  const minutesNow = () => clock.base + (Date.now() - clock.at) / 60000;
  function syncClock(now) {
    const server = toMin(now.time);
    // Сервер отдаёт время с точностью до минуты: без этой проверки линия дёргалась бы назад.
    if (clock && clock.date === now.date && Math.abs(minutesNow() - server) <= 1.5) return;
    clock = { date: now.date, base: server, at: Date.now() };
  }
  const clockText = (min) => {
    const m = Math.floor(min);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const inMinutes = (min) => D.duration(Math.max(1, Math.ceil(min)));

  // ---------- Из данных — места на шкале ----------
  // Слот — одно время: в нём пара и/или «след» перенесённой (тогда карточки рядом).
  function buildSlots(data) {
    const entries = [
      ...data.lessons.map((lesson) => ({ lesson, ghost: false, pair: lesson.pair, time: lesson.time })),
      ...data.movedAway.map((lesson) => ({ lesson, ghost: true, pair: lesson.change.oldPair, time: lesson.change.oldTime })),
    ].filter((e) => e.time);
    const byPair = new Map();
    for (const e of entries) {
      if (!byPair.has(e.pair)) byPair.set(e.pair, { start: toMin(e.time.start), end: toMin(e.time.end), entries: [] });
      byPair.get(e.pair).entries.push(e);
    }
    const slots = [...byPair.values()].sort((a, b) => a.start - b.start);
    for (const s of slots) s.entries.sort((a, b) => Number(a.ghost) - Number(b.ghost));
    return slots;
  }

  // Окна считаются только между парами, которые состоятся.
  function buildGaps(real, slots, lunch) {
    const gaps = [];
    for (let i = 0; i + 1 < real.length; i += 1) {
      const from = real[i].end;
      const to = real[i + 1].start;
      if (to - from <= SHORT_BREAK) continue;

      // На месте окна могут стоять отменённая пара или «след»: подпись — в самом большом свободном куске.
      const pieces = [];
      let cursor = from;
      for (const s of slots.filter((x) => x.start < to && x.end > from)) {
        if (s.start > cursor) pieces.push([cursor, s.start]);
        cursor = Math.max(cursor, s.end);
      }
      if (cursor < to) pieces.push([cursor, to]);
      if (!pieces.length) continue;
      const [start, end] = pieces.reduce((best, p) => (p[1] - p[0] > best[1] - best[0] ? p : best));

      const length = to - from;
      const hasLunch = lunch && toMin(lunch.start) >= from && toMin(lunch.end) <= to;
      const onlyLunch = hasLunch && length === toMin(lunch.end) - toMin(lunch.start);
      let text = `Окно ${D.duration(length)}`;
      if (onlyLunch) text = `Обед · ${D.duration(length)}`;
      else if (hasLunch) text = `${text} · обед ${lunch.start}–${lunch.end}`;
      gaps.push({ start, end, from, to, text, lunch: onlyLunch });
    }
    return gaps;
  }

  // ---------- Отрисовка ----------
  function positioned(node, rangeStart, start, end) {
    node.style.setProperty('--start', String(start - rangeStart));
    node.style.setProperty('--len', String(end - start));
    return node;
  }

  // Строка «Идёт сейчас · Прошло 68 из 80 минут»: видна только у текущей пары.
  function addLiveRow(btn) {
    const box = el('span', 'tl-live');
    box.hidden = true;
    const elapsed = el('span', 'tl-live__elapsed');
    box.append(el('span', 'tl-live__label', 'Идёт сейчас'), elapsed);
    btn.append(box);
    return { btn, box, elapsed, label: btn.getAttribute('aria-label') };
  }

  function updateLive(slot, t) {
    const { btn, box, elapsed, label } = slot.live;
    const isNow = t >= slot.start && t < slot.end;
    btn.classList.toggle('wk-card--live', isNow);
    box.hidden = !isNow;
    if (!isNow) {
      btn.style.removeProperty('--progress');
      btn.setAttribute('aria-label', label);
      elapsed.textContent = '';
      return;
    }
    const length = slot.end - slot.start;
    // Заливка фона идёт слева направо: её край не выглядит как зачёркивание текста.
    btn.style.setProperty('--progress', `${(((t - slot.start) / length) * 100).toFixed(2)}%`);
    const text = `Прошло ${Math.floor(t - slot.start)} из ${length} ${D.plural(length, 'минуты', 'минут', 'минут')}`;
    if (elapsed.textContent !== text) {
      elapsed.textContent = text;
      btn.setAttribute('aria-label', `${label}. Идёт сейчас. ${text}`);
    }
  }

  function renderScale(slots, gaps) {
    const rangeStart = slots[0].start;
    const rangeEnd = Math.max(...slots.map((s) => s.end));
    const total = rangeEnd - rangeStart;
    const scale = el('div', 'tl');
    scale.style.setProperty('--tl-min', String(total));

    // Часы: только целые, внутри диапазона.
    const ticks = [];
    for (let m = Math.ceil(rangeStart / 60) * 60; m <= rangeEnd; m += 60) {
      const tick = el('div', 'tl-tick');
      tick.setAttribute('aria-hidden', 'true');
      tick.style.setProperty('--at', String(m - rangeStart));
      tick.append(el('span', 'tl-tick__label', clockText(m)));
      scale.append(tick);
      ticks.push({ node: tick, at: m - rangeStart });
    }

    // Разметка идёт по порядку времени — так её читают программы экранного доступа.
    const track = el('ol', 'tl-track');
    const rows = [];
    for (const s of slots) {
      // Две карточки рядом — узкие: полное название и преподаватель в них не поместятся.
      const split = s.entries.length > 1;
      const li = positioned(el('li', `tl-slot${split ? ' tl-slot--split' : ''}`), rangeStart, s.start, s.end);
      for (const e of s.entries) {
        const btn = card(e.lesson, e.ghost, { showEnd: true, detailed: !split });
        li.append(btn);
        if (!e.ghost && e.lesson.status !== 'cancelled') s.live = addLiveRow(btn);
      }
      s.node = li;
      rows.push({ at: s.start, node: li });
    }
    for (const g of gaps) {
      const tight = g.end - g.start < 30;
      const li = positioned(el('li', `tl-gap${g.lunch ? ' tl-gap--lunch' : ''}${tight ? ' tl-gap--tight' : ''}`), rangeStart, g.start, g.end);
      const chip = el('span', 'tl-gap__chip', g.text);
      chip.title = `С ${clockText(g.from)} до ${clockText(g.to)}`;
      li.append(chip);
      rows.push({ at: g.start, node: li });
    }
    rows.sort((a, b) => a.at - b.at);
    track.append(...rows.map((r) => r.node));
    scale.append(track);

    const line = el('div', 'tl-now');
    line.setAttribute('aria-hidden', 'true');
    const lineTime = el('span', 'tl-now__time');
    line.append(lineTime);
    scale.append(line);

    return { scale, line, lineTime, ticks, rangeStart, total };
  }

  let view = null;
  let signature = '';
  let bringKey = null;

  // Сводка дня чипами: «3 пары», «9:00–13:30», «После 13:30 свободно», «1 изменение».
  function renderChips(data, real) {
    const noZero = (time) => time.replace(/^0/, '');
    const chips = [];
    if (real.length) {
      const first = noZero(real[0].lesson.time.start);
      const last = noZero(real[real.length - 1].lesson.time.end);
      chips.push(el('li', 'day-chip', `${real.length} ${D.plural(real.length, 'пара', 'пары', 'пар')}`));
      chips.push(el('li', 'day-chip', `${first}–${last}`));
      chips.push(el('li', 'day-chip', `После ${last} свободно`));
    } else {
      chips.push(el('li', 'day-chip', 'Пар нет'));
    }
    const changes = data.lessons.filter((l) => l.status !== 'normal').length + data.movedAway.length;
    if (changes) chips.push(el('li', 'day-chip day-chip--changes', `${changes} ${D.plural(changes, 'изменение', 'изменения', 'изменений')}`));
    chipsBox.replaceChildren(...chips);
    chipsBox.hidden = false;
  }

  function render(data, query) {
    const isToday = data.date === data.today;
    const weekday = D.capitalize(D.weekdayLong(data.date));
    titleBox.textContent = isToday ? 'Сегодня' : weekday;
    document.getElementById('date-label').textContent = isToday ? `${weekday}, ${D.dayMonth(data.date)}` : D.dayMonth(data.date);

    const real = data.lessons
      .filter((l) => l.status !== 'cancelled' && l.time)
      .map((l) => ({ lesson: l, start: toMin(l.time.start), end: toMin(l.time.end) }))
      .sort((a, b) => a.start - b.start);
    renderChips(data, real);

    const slots = buildSlots(data);
    bringKey = null;
    if (!slots.length) {
      view = null;
      bringBox.hidden = true;
      content.replaceChildren(D.emptyState({
        illu: 'rest',
        title: isToday ? 'Пар сегодня нет — можно выдохнуть' : 'В этот день пар нет',
        text: 'Расписание на ближайшие дни — на «Неделе».',
        action: { href: `/week${query}`, label: 'Посмотреть неделю', secondary: true },
      }));
      return;
    }

    const { scale, line, lineTime, ticks, rangeStart, total } = renderScale(slots, buildGaps(real, slots, data.lunch));
    const status = el('p', 'tl-status');
    const parts = [];
    if (!real.length) {
      parts.push(D.emptyState({
        illu: 'rest',
        inline: true,
        title: isToday ? 'Сегодня занятий не будет' : 'В этот день занятий нет',
        text: 'Пары отменены или перенесены — подробности по нажатию на пару.',
      }));
    }
    const done = D.emptyState({
      illu: 'done',
      title: 'Пары на сегодня закончились',
      text: 'Расписание на ближайшие дни — на «Неделе».',
      action: { href: `/week${query}`, label: 'Посмотреть неделю', secondary: true },
    });
    done.classList.add('tl-done');
    done.hidden = true;
    parts.push(done, status, scale);
    content.replaceChildren(...parts);

    const mode = isToday ? 'today' : data.date < data.today ? 'past' : 'future';
    view = { mode, slots, real, done, status, line, lineTime, ticks, rangeStart, total, bring: data.bring || [], isStaff: Boolean(data.groups) };
  }

  // То, что зависит от времени, обновляется само, без перерисовки карточек:
  // открытая панель и фокус клавиатуры при этом не сбрасываются.
  function tick() {
    if (!view) return;
    // Прошедший день — всё позади, будущий — всё впереди; линия и отсчёт есть только сегодня.
    const isToday = view.mode === 'today';
    const t = { today: minutesNow(), past: Infinity, future: -Infinity }[view.mode];
    const { real } = view;

    for (const s of view.slots) {
      s.node.classList.toggle('tl-slot--past', t >= s.end);
      if (s.live) updateLive(s, t);
    }

    const finished = isToday && real.length > 0 && t >= real[real.length - 1].end;
    view.done.hidden = !finished;

    const current = real.find((r) => t >= r.start && t < r.end);
    const next = real.find((r) => r.start > t);
    let text = '';
    if (!isToday) text = '';
    else if (current) text = `Сейчас: ${current.lesson.shortName} · ещё ${inMinutes(current.end - t)}`;
    else if (next) text = `${next === real[0] ? 'Первая пара' : 'Следующая'}: ${next.lesson.shortName}, ${roomText(next.lesson.room)} · через ${inMinutes(next.start - t)}`;
    if (view.status.textContent !== text) view.status.textContent = text;
    view.status.hidden = !text;

    view.line.hidden = !isToday || !real.length || finished;
    const position = Math.min(view.total, Math.max(0, t - view.rangeStart));
    view.line.style.setProperty('--now', position.toFixed(2));
    for (const mark of view.ticks) {
      mark.node.classList.toggle('tl-tick--covered', !view.line.hidden && Math.abs(position - mark.at) < COVERED_MIN);
    }
    if (isToday) view.lineTime.textContent = clockText(t);

    renderBring(t, Boolean(current || next));
  }

  // «Что взять»: только для пар, которые ещё впереди или идут.
  function renderBring(t, hasLessonsAhead) {
    if (view.isStaff || !hasLessonsAhead) {
      bringBox.hidden = true;
      return;
    }
    const ahead = view.bring.filter((b) => toMin(b.until) > t);
    const key = ahead.map((b) => b.discipline).join('|');
    bringBox.hidden = false;
    if (key === bringKey) return;
    bringKey = key;
    if (!ahead.length) {
      bringList.replaceChildren(el('p', 'today-bring__none', 'Ничего особенного — тетрадь и ручка.'));
      return;
    }
    const list = el('ul', 'today-bring__list');
    for (const b of ahead) {
      const li = el('li');
      li.append(D.disciplineTitle('span', 'today-bring__name', b.shortName, b.color), el('span', null, D.capitalize(b.items.join(', '))));
      list.append(li);
    }
    bringList.replaceChildren(list);
  }

  // ---------- Переключатель дней: другой день без перезагрузки страницы ----------
  let selected = null; // null — сегодня
  let todayDate = null;
  let shownDate = null;
  let weekKey = '';
  let requestId = 0;

  function markDay() {
    for (const btn of dayNavDays.children) {
      const isShown = btn.dataset.date === shownDate;
      btn.classList.toggle('day-nav__day--selected', isShown);
      btn.setAttribute('aria-pressed', String(isShown));
      btn.classList.toggle('day-nav__day--today', btn.dataset.date === todayDate);
      if (btn.dataset.date === todayDate) btn.setAttribute('aria-current', 'date');
      else btn.removeAttribute('aria-current');
    }
    todayButton.hidden = shownDate === todayDate;
  }

  function renderDayNav(week) {
    const key = week.join();
    if (key === weekKey) return;
    weekKey = key;
    dayNavDays.replaceChildren(...week.map((date) => {
      const btn = el('button', 'day-nav__day');
      btn.type = 'button';
      btn.dataset.date = date;
      btn.setAttribute('aria-label', `${D.capitalize(D.weekdayLong(date))}, ${D.dayMonth(date)}`);
      btn.append(el('span', 'day-nav__name', D.capitalize(D.weekdayShort(date))), el('span', 'day-nav__num', Number(date.slice(8))));
      btn.addEventListener('click', () => selectDay(date));
      return btn;
    }));
    dayNav.hidden = false;
  }

  async function selectDay(date) {
    const previous = selected;
    const previousShown = shownDate;
    selected = date === todayDate ? null : date;
    shownDate = date;
    markDay();
    content.setAttribute('aria-busy', 'true');
    const error = await load();
    content.removeAttribute('aria-busy');
    if (error) {
      selected = previous;
      shownDate = previousShown;
      markDay();
      errorBox.textContent = error;
      errorBox.hidden = false;
    }
  }

  todayButton.addEventListener('click', () => selectDay(todayDate));

  // Возвращает текст ошибки, если день загрузить не удалось.
  async function load() {
    const id = (requestId += 1);
    const params = new URLSearchParams(window.location.search);
    const query = params.get('group') ? `?group=${encodeURIComponent(params.get('group'))}` : '';
    const api = new URLSearchParams();
    if (params.get('group')) api.set('group', params.get('group'));
    if (selected) api.set('date', selected);

    let data;
    try {
      data = await D.fetchJSON(`/api/schedule/today?${api}`);
    } catch (err) {
      if (id !== requestId) return null;
      // Связь пропала при обновлении — оставляем на экране то, что уже показано.
      if (signature) return err.message;
      loading.hidden = true;
      errorBox.textContent = err.message;
      if (err.offline) {
        const week = el('a', null, 'Открыть расписание на неделю');
        week.href = '/week';
        errorBox.textContent = 'Нет подключения. ';
        errorBox.append(week);
      }
      errorBox.hidden = false;
      return err.message;
    }
    // Пока шёл ответ, студент нажал другой день — этот ответ уже не нужен.
    if (id !== requestId) return null;

    syncClock(data.now);
    todayDate = data.today;
    shownDate = data.date;
    renderDayNav(data.week);
    markDay();

    const next = JSON.stringify([data.date, data.today, data.group, data.lessons, data.movedAway, data.lunch, data.bring]);
    if (next !== signature) {
      signature = next;
      D.setupGroup(data);
      render(data, query);
    }
    tick();
    errorBox.hidden = true;
    loading.hidden = true;
    content.hidden = false;
    return null;
  }

  // Первая загрузка — с анимацией появления, дальше обновления без неё.
  load().then(() => content.classList.add('is-live'));

  setInterval(() => {
    if (document.visibilityState === 'visible') tick();
  }, TICK_MS);
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, RELOAD_MS);
  // Вернулись на вкладку — сразу показываем актуальное время.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load();
  });
})();
