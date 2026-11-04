'use strict';
// Страница «Сегодня».
(function () {
  const D = window.Dekanat;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  async function load() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('group') ? `?group=${encodeURIComponent(params.get('group'))}` : '';

    let data;
    try {
      data = await D.fetchJSON(`/api/schedule/today${query}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }

    D.setupGroup(data);
    document.getElementById('date-label').textContent = `${D.capitalize(D.weekdayLong(data.date))}, ${D.dayMonth(data.date)}`;

    const changes = data.lessons.filter((l) => l.status !== 'normal').length;
    if (changes) {
      const banner = document.getElementById('changes-banner');
      banner.textContent = `Сегодня ${changes} ${D.plural(changes, 'изменение', 'изменения', 'изменений')} в расписании — они выделены цветом.`;
      banner.hidden = false;
    }

    const { list, count } = D.renderDay(data.date, data);
    if (count) {
      content.replaceChildren(list);
    } else {
      const empty = D.el('div', 'empty');
      empty.append(D.el('p', 'empty__title', 'Сегодня занятий нет'));
      const link = D.el('a', 'button button--secondary', 'Посмотреть неделю');
      link.href = `/week${query}`;
      empty.append(link);
      content.replaceChildren(empty);
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
