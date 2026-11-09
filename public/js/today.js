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
  const banner = document.getElementById('changes-banner');
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
    // Заливка идёт сверху вниз и заканчивается ровно на линии «сейчас».
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

  function render(data, query) {
    document.getElementById('date-label').textContent = `${D.capitalize(D.weekdayLong(data.date))}, ${D.dayMonth(data.date)}`;

    const changes = data.lessons.filter((l) => l.status !== 'normal').length + data.movedAway.length;
    banner.textContent = changes
      ? `Сегодня ${changes} ${D.plural(changes, 'изменение', 'изменения', 'изменений')} в расписании — нажмите на пару, чтобы узнать подробности.`
      : '';
    banner.hidden = !changes;

    const slots = buildSlots(data);
    bringKey = null;
    if (!slots.length) {
      view = null;
      bringBox.hidden = true;
      content.replaceChildren(D.emptyState({
        illu: 'rest',
        title: 'Пар сегодня нет — можно выдохнуть',
        text: 'Расписание на ближайшие дни — на «Неделе».',
        action: { href: `/week${query}`, label: 'Посмотреть неделю', secondary: true },
      }));
      return;
    }

    const real = data.lessons
      .filter((l) => l.status !== 'cancelled' && l.time)
      .map((l) => ({ lesson: l, start: toMin(l.time.start), end: toMin(l.time.end) }))
      .sort((a, b) => a.start - b.start);

    const { scale, line, lineTime, ticks, rangeStart, total } = renderScale(slots, buildGaps(real, slots, data.lunch));
    const status = el('p', 'tl-status');
    const parts = [];
    if (!real.length) {
      parts.push(D.emptyState({
        illu: 'rest',
        inline: true,
        title: 'Сегодня занятий не будет',
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

    view = { slots, real, done, status, line, lineTime, ticks, rangeStart, total, bring: data.bring || [], isStaff: Boolean(data.groups) };
  }

  // То, что зависит от времени, обновляется само, без перерисовки карточек:
  // открытая панель и фокус клавиатуры при этом не сбрасываются.
  function tick() {
    if (!view) return;
    const t = minutesNow();
    const { real } = view;

    for (const s of view.slots) {
      s.node.classList.toggle('tl-slot--past', t >= s.end);
      if (s.live) updateLive(s, t);
    }

    const finished = real.length > 0 && t >= real[real.length - 1].end;
    view.done.hidden = !finished;

    const current = real.find((r) => t >= r.start && t < r.end);
    const next = real.find((r) => r.start > t);
    let text = '';
    if (current) text = `Сейчас: ${current.lesson.shortName} · ещё ${inMinutes(current.end - t)}`;
    else if (next) text = `${next === real[0] ? 'Первая пара' : 'Следующая'}: ${next.lesson.shortName}, ${roomText(next.lesson.room)} · через ${inMinutes(next.start - t)}`;
    if (view.status.textContent !== text) view.status.textContent = text;
    view.status.hidden = !text;

    view.line.hidden = !real.length || finished;
    const position = Math.min(view.total, Math.max(0, t - view.rangeStart));
    view.line.style.setProperty('--now', position.toFixed(2));
    for (const mark of view.ticks) {
      mark.node.classList.toggle('tl-tick--covered', !view.line.hidden && Math.abs(position - mark.at) < COVERED_MIN);
    }
    view.lineTime.textContent = clockText(t);

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

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('group') ? `?group=${encodeURIComponent(params.get('group'))}` : '';

    let data;
    try {
      data = await D.fetchJSON(`/api/schedule/today${query}`);
    } catch (err) {
      // Связь пропала при обновлении — оставляем на экране то, что уже показано.
      if (signature) return;
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }

    syncClock(data.now);
    const next = JSON.stringify([data.date, data.group, data.lessons, data.movedAway, data.lunch, data.bring]);
    if (next !== signature) {
      signature = next;
      D.setupGroup(data);
      render(data, query);
    }
    tick();
    errorBox.hidden = true;
    loading.hidden = true;
    content.hidden = false;
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
