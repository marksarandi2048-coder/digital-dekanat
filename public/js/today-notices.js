'use strict';
// «Сегодня», блоки для студента: важное объявление и ближайшие дедлайны.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const importantBox = document.getElementById('today-important');
  const deadlinesBox = document.getElementById('today-deadlines');

  // Самое свежее непрочитанное важное объявление.
  // Именно объявление: важными считаются ещё и дедлайны «сегодня/завтра», но у них свой блок.
  function renderImportant(items) {
    const item = items
      .filter((x) => x.kind === 'announcement' && x.important && !x.read)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    if (!item) return;
    const a = el('a', 'today-important today-important--block');
    a.href = item.link;
    a.append(el('span', 'badge badge--cancelled', 'Важное'), el('span', 'today-important__title', item.title));
    if (item.body) a.append(el('span', 'today-important__body', item.body));
    importantBox.replaceChildren(a);
    importantBox.hidden = false;
  }

  function renderDeadlines(deadlines) {
    const soon = deadlines.filter((d) => d.own).slice(0, 3);
    const card = el('section', 'today-deadlines');
    const head = el('div', 'today-deadlines__head');
    head.append(el('h2', 'today-deadlines__title', 'Ближайшие дедлайны'));
    const all = el('a', null, 'Все');
    all.href = '/notifications';
    all.setAttribute('aria-label', 'Все дедлайны');
    head.append(all);
    card.append(head);
    if (!soon.length) card.append(el('p', 'today-bring__none', 'Ближайших дедлайнов нет.'));
    for (const d of soon) {
      const a = el('a', `today-deadline${d.daysLeft <= 3 ? ' today-deadline--soon' : ''}`);
      a.href = d.link;
      // Разделитель « — » скрыт стилями, но не даёт словам слипнуться,
      // если стили не загрузились, и читается программами экранного доступа.
      const count = el('span', 'today-deadline__count', D.countdown(d.daysLeft));
      count.append(el('span', 'visually-hidden', ' — '));
      a.append(count, el('span', 'today-deadline__title', d.title));
      card.append(a);
    }
    deadlinesBox.replaceChildren(card);
    deadlinesBox.hidden = false;
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/notifications');
    } catch {
      return; // блоки необязательные — без них страница работает
    }
    if (data.role !== 'student') return;
    renderImportant(data.items);
    renderDeadlines(data.deadlines);
  }

  load();
})();
