'use strict';
// Короткий блок на «Сегодня»: 2 ближайших дедлайна и непрочитанные важные объявления.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const box = document.getElementById('today-notices');

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/notifications');
    } catch {
      return; // блок необязательный — без него страница работает
    }
    if (data.role !== 'student') return;
    const parts = [];

    for (const i of data.items.filter((x) => x.important && !x.read).slice(0, 2)) {
      const a = el('a', 'today-important');
      a.href = i.link;
      a.append(el('span', 'badge badge--cancelled', 'Важное'), el('span', 'today-important__title', i.title));
      parts.push(a);
    }

    const soon = data.deadlines.filter((d) => d.own).slice(0, 2);
    if (soon.length) {
      const card = el('section', 'today-deadlines');
      const head = el('div', 'today-deadlines__head');
      head.append(el('h2', 'today-deadlines__title', 'Ближайшие дедлайны'));
      const all = el('a', null, 'Все');
      all.href = '/notifications';
      head.append(all);
      card.append(head);
      for (const d of soon) {
        const a = el('a', `today-deadline${d.daysLeft <= 3 ? ' today-deadline--soon' : ''}`);
        a.href = d.link;
        a.append(el('span', 'today-deadline__count', D.countdown(d.daysLeft)), el('span', 'today-deadline__title', d.title));
        card.append(a);
      }
      parts.push(card);
    }
    box.replaceChildren(...parts);
  }

  load();
})();
