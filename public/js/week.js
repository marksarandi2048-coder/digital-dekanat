'use strict';
// Страница «Неделя».
(function () {
  const D = window.Dekanat;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

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
      errorBox.hidden = false;
      return;
    }

    D.setupGroup(data);

    // Переключатель недель.
    const weekEndShown = addDays(data.weekStart, 5); // подпись: пн – сб
    document.getElementById('week-label').textContent = `${D.dayMonth(data.weekStart)} – ${D.dayMonth(weekEndShown)}`;
    document.getElementById('week-prev').href = weekLink(data.prevWeek);
    document.getElementById('week-next').href = weekLink(data.nextWeek);
    const current = document.getElementById('week-current');
    if (data.isCurrentWeek) {
      current.replaceWith(D.el('span', 'week-nav__note', 'Текущая неделя'));
    } else {
      current.href = weekLink(null);
      current.hidden = false;
    }

    const changes = data.lessons.filter((l) => l.status !== 'normal').length;
    if (changes) {
      const banner = document.getElementById('changes-banner');
      banner.textContent = `На этой неделе ${changes} ${D.plural(changes, 'изменение', 'изменения', 'изменений')} в расписании — они выделены цветом.`;
      banner.hidden = false;
    }

    // Дни недели: пн–сб всегда, воскресенье — только если в нём есть занятия.
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(data.weekStart, i);
      const day = D.renderDay(date, data);
      if (i === 6 && !day.count) continue;

      const section = D.el('section', 'day' + (date === data.now.date ? ' day--today' : ''));
      section.id = `day-${date}`;
      const head = D.el('h2', 'day__title');
      head.append(D.el('span', null, `${D.capitalize(D.weekdayLong(date))}, ${D.dayMonth(date)}`));
      if (date === data.now.date) head.append(D.el('span', 'tag tag--now', 'Сегодня'));
      section.append(head, day.count ? day.list : D.el('p', 'day__empty', 'Занятий нет'));
      days.push(section);
    }
    content.replaceChildren(...days);

    loading.hidden = true;
    content.hidden = false;

    // Пришли из уведомления (…#day-ГГГГ-ММ-ДД) — показываем нужный день.
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) {
      target.classList.add('day--focus');
      target.scrollIntoView({ block: 'start' });
    }
  }

  load();
})();
