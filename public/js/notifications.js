'use strict';
// Лента уведомлений студента и «Ближайшие дедлайны».
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const readAll = document.getElementById('read-all');

  // Отметить прочитанным и перейти по ссылке.
  async function openItem(item, event) {
    if (item.read) return;
    event.preventDefault();
    await D.postJSON('/api/notifications/read', { keys: [item.key] });
    window.location.href = item.link;
  }

  function renderDeadlines(list) {
    const section = el('section', 'card deadlines');
    section.append(el('h2', 'section-title', 'Ближайшие дедлайны'));
    if (!list.length) {
      section.append(el('p', 'muted', 'Сроков в ближайшее время нет.'));
      return section;
    }
    const ul = el('ul', 'deadline-list');
    for (const d of list) {
      const li = el('li', `deadline${d.own ? '' : ' deadline--waiting'}${d.own && d.daysLeft <= 3 ? ' deadline--soon' : ''}`);
      const a = el('a', 'deadline__link');
      a.href = d.link;
      const left = el('div', 'deadline__when');
      // Скрытые разделители не дают словам слипнуться без стилей.
      const count = el('span', 'deadline__count', D.countdown(d.daysLeft));
      count.append(el('span', 'visually-hidden', ', '));
      const date = el('span', 'deadline__date', D.dayMonth(d.date));
      date.append(el('span', 'visually-hidden', ' — '));
      left.append(count, date);
      const right = el('div', 'deadline__what');
      const title = el('span', 'deadline__title', d.title);
      title.append(el('span', 'visually-hidden', '. '));
      right.append(title, el('span', 'deadline__note', d.note));
      a.append(left, right);
      li.append(a);
      ul.append(li);
    }
    section.append(ul);
    return section;
  }

  function renderItem(item) {
    const a = el('a', `notif notif--${item.kind}${item.read ? '' : ' notif--unread'}${item.important ? ' notif--important' : ''}`);
    a.href = item.link;
    a.addEventListener('click', (e) => openItem(item, e));
    const top = el('div', 'notif__top');
    if (!item.read) top.append(el('span', 'notif__dot', ''));
    top.append(el('span', 'notif__kind', item.kindLabel));
    if (item.important) top.append(el('span', 'badge badge--cancelled', 'Важное'));
    top.append(el('span', 'notif__time', D.dateTime(item.at)));
    a.append(top, el('p', 'notif__title', item.title), el('p', 'notif__body', item.body));
    if (!item.read) a.setAttribute('aria-label', `Не прочитано. ${item.kindLabel}. ${item.title}`);
    return a;
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/notifications');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    const parts = [renderDeadlines(data.deadlines)];

    const feed = el('section', 'feed');
    const head = el('h2', 'section-title', data.unread ? `Лента · ${data.unread} ${D.plural(data.unread, 'новое', 'новых', 'новых')}` : 'Лента');
    feed.append(head);
    if (!data.items.length) {
      feed.append(D.emptyState({
        illu: 'read',
        title: 'Уведомлений пока нет',
        text: 'Здесь появятся объявления деканата, изменения в расписании и статусы ваших заявок.',
      }));
    } else {
      if (!data.unread) {
        feed.append(D.emptyState({
          illu: 'read',
          inline: true,
          title: 'Все уведомления прочитаны',
          text: 'Новое появится здесь — объявления, изменения в расписании и статусы заявок.',
        }));
      }
      const list = el('div', 'notif-list');
      for (const i of data.items) list.append(renderItem(i));
      feed.append(list);
    }
    parts.push(feed);

    readAll.hidden = !data.unread;
    content.replaceChildren(...parts);
    loading.hidden = true;
    content.hidden = false;
  }

  readAll.addEventListener('click', async () => {
    readAll.disabled = true;
    await D.postJSON('/api/notifications/read', { all: true });
    readAll.disabled = false;
    await load();
    D.updateBell();
  });

  load();
})();
