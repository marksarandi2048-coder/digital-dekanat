'use strict';
// Страница «Неделя»: минимум на карточке, все детали — по нажатию.
// На телефоне — дни списком, на компьютере (CSS, от 1100 px) — сетка «пары × дни».
// Порядок в разметке один (день за днём) — так его читают программы экранного доступа;
// место в сетке задаётся через grid-row / grid-column.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const { card } = window.DekanatLesson;

  function addDays(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Ссылка на другую неделю с сохранением выбранной группы.
  function weekLink(start) {
    const params = new URLSearchParams(window.location.search);
    if (start) params.set('start', start);
    else params.delete('start');
    const qs = params.toString();
    return `/week${qs ? `?${qs}` : ''}`;
  }

  // ---------- Неделя ----------
  async function load() {
    const params = new URLSearchParams(window.location.search);
    const api = new URLSearchParams();
    if (params.get('start')) api.set('start', params.get('start'));
    if (params.get('group')) api.set('group', params.get('group'));

    let data;
    try {
      data = await D.fetchJSON(`/api/schedule/week?${api}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      if (err.offline) {
        D.offlineBar();
        D.reloadWhenOnline();
        if (params.get('start')) {
          const back = el('a', null, tr('week.otkryt_sokhranennuyu_nedelyu'));
          back.href = '/week';
          errorBox.textContent = tr('week.net_podklyucheniya_eta_nedelya');
          errorBox.append(back);
        } else {
          errorBox.textContent = tr('week.net_podklyucheniya_sokhranennogo_raspisaniya');
        }
      }
      errorBox.hidden = false;
      return;
    }

    // Сохранённая копия: «сегодня» считаем по текущей дате, а не по дате сохранения.
    const offline = Boolean(data.offlineSavedAt);
    const today = offline ? D.todayInMoscow() : data.now.date;
    const isCurrentWeek = offline ? today >= data.weekStart && today <= data.weekEnd : data.isCurrentWeek;
    if (offline) {
      D.offlineBar(data.offlineSavedAt);
      D.reloadWhenOnline();
    }

    D.setupGroup(data);
    if (data.groups && data.group) {
      document.getElementById('ics-link').href = `/api/schedule/calendar.ics?group=${encodeURIComponent(data.group)}`;
    }

    // Переключатель недель.
    document.getElementById('week-label').textContent = `${D.dayMonth(data.weekStart)} – ${D.dayMonth(addDays(data.weekStart, 5))}`;
    document.getElementById('week-prev').href = weekLink(data.prevWeek);
    document.getElementById('week-next').href = weekLink(data.nextWeek);
    const current = document.getElementById('week-current');
    if (isCurrentWeek) current.replaceWith(el('span', 'week-nav__note', tr('week.tekuschaya_nedelya')));
    else if (offline && !params.get('start')) current.replaceWith(el('span', 'week-nav__note', tr('week.novee_dannykh_net')));
    else {
      current.href = weekLink(null);
      current.hidden = false;
    }

    const changes = data.lessons.filter((l) => l.status !== 'normal').length;
    const banner = document.getElementById('changes-banner');
    if (changes) {
      banner.textContent = tr('week.changes_p1_na_nedele', { changes, p1: D.plural(changes, tr('week.izmenenie'), tr('week.izmeneniya'), tr('week.izmeneniy')) });
      banner.hidden = false;
    }

    // Дни: пн–сб всегда, воскресенье — только если в нём есть занятия.
    const items = [
      ...data.lessons.map((l) => ({ date: l.date, pair: l.pair, lesson: l })),
      ...data.movedAway.map((l) => ({ date: l.change.oldDate, pair: l.change.oldPair, lesson: l, ghost: true })),
    ];
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(data.weekStart, i);
      if (i === 6 && !items.some((x) => x.date === date)) continue;
      days.push(date);
    }

    // Строки сетки — от первой до последней пары, которые есть на этой неделе.
    const pairs = items.map((x) => x.pair);
    const minPair = pairs.length ? Math.min(...pairs) : 1;
    const maxPair = pairs.length ? Math.max(...pairs) : 1;
    content.style.setProperty('--wk-days', String(days.length));
    content.style.setProperty('--wk-rows', String(maxPair - minPair + 1));
    const rowOf = (pair) => pair - minPair + 2; // строка 1 — названия дней

    const nodes = [];
    days.forEach((date, i) => {
      const col = i + 2; // колонка 1 — номера пар
      const isToday = date === today;
      const section = el('section', `wk-day${isToday ? ' wk-day--today' : ''}`);
      section.id = `day-${date}`;
      const head = el('h2', 'wk-day__title');
      head.append(el('span', 'wk-day__name', D.capitalize(D.weekdayShort(date))), el('span', 'wk-day__date', D.dayMonth(date)));
      if (isToday) head.append(el('span', 'tag tag--now', tr('week.segodnya')));
      head.style.gridColumn = String(col);
      section.append(head);

      const dayItems = items.filter((x) => x.date === date).sort((a, b) => a.pair - b.pair || (a.ghost ? 1 : -1));
      if (!dayItems.length) section.append(el('p', 'wk-day__empty', tr('week.zanyatiy_net')));
      // Ячейка «день × пара»: в ней может быть пара и «след» перенесённой.
      for (const pair of [...new Set(dayItems.map((x) => x.pair))]) {
        const slot = el('div', 'wk-slot');
        slot.style.gridColumn = String(col);
        slot.style.gridRow = String(rowOf(pair));
        for (const x of dayItems.filter((y) => y.pair === pair)) slot.append(card(x.lesson, x.ghost));
        section.append(slot);
      }

      if (isToday) {
        const band = el('div', 'wk-today-band');
        band.setAttribute('aria-hidden', 'true');
        band.style.gridColumn = String(col);
        nodes.push(band);
      }
      nodes.push(section);
    });

    // Номера пар и время — слева в сетке (только на широком экране).
    for (let p = minPair; p <= maxPair; p += 1) {
      const time = data.pairs && data.pairs[p];
      const line = el('div', 'wk-row');
      line.setAttribute('aria-hidden', 'true');
      line.style.gridRow = String(rowOf(p));
      line.append(el('span', 'wk-row__pair', tr('week.p_para', { p })));
      if (time) line.append(el('span', 'wk-row__time', `${time.start}–${time.end}`));
      nodes.push(line);
    }

    content.replaceChildren(...nodes);
    loading.hidden = true;
    content.hidden = false;

    // Пришли из уведомления (…#day-ГГГГ-ММ-ДД) — показываем нужный день.
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) {
      target.classList.add('wk-day--focus');
      target.scrollIntoView({ block: 'start' });
    }
  }

  load();
})();
