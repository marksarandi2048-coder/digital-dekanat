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

    const { list, count, finished } = D.renderDay(data.date, data);
    if (count) {
      const parts = [];
      if (finished) parts.push(D.el('p', 'notice notice--calm', 'Пары на сегодня закончились.'));
      parts.push(list);
      content.replaceChildren(...parts);
    } else {
      content.replaceChildren(D.emptyState({
        illu: 'rest',
        title: 'Пар сегодня нет — можно выдохнуть',
        text: 'Расписание на ближайшие дни — на «Неделе».',
        action: { href: `/week${query}`, label: 'Посмотреть неделю', secondary: true },
      }));
    }
    loading.hidden = true;
    content.hidden = false;
  }

  load();

  // Раз в минуту обновляем «сейчас идёт / следующая через N минут» без перезагрузки страницы.
  setInterval(() => {
    if (document.visibilityState === 'visible') load();
  }, 60 * 1000);
})();
