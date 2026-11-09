'use strict';
// Одно объявление. Сервер сам отмечает его прочитанным.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const id = window.location.pathname.split('/')[2];

  async function load() {
    let data;
    try {
      data = await D.fetchJSON(`/api/announcements/${encodeURIComponent(id)}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    const a = data.announcement;
    document.title = tr('announcement.title_tsifrovoy_dekanat', { title: a.title });
    const card = el('article', `card announcement${a.important ? ' announcement--important' : ''}`);
    const tags = el('div', 'lesson__tags');
    if (a.important) tags.append(el('span', 'badge badge--cancelled', tr('announcement.vazhnoe')));
    if (a.removed) tags.append(el('span', 'badge', tr('announcement.snyato')));
    tags.append(el('span', 'badge', a.audience));
    card.append(tags, el('h1', 'page-title', a.title));
    card.append(el('p', 'muted', `${a.author ? tr('announcement.author_dekanat', { author: a.author }) : ''}${D.dateTime(a.createdAt)}`));
    if (a.deadlineOn) {
      const days = Math.round((Date.parse(`${a.deadlineOn}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000);
      card.append(el('p', 'notice', tr('announcement.srok_p0_p1', { p0: D.fullDate(a.deadlineOn), p1: days >= 0 ? ` — ${D.countdown(days)}` : '' })));
    }
    card.append(el('p', 'announcement__body', a.body));
    content.replaceChildren(card);
    loading.hidden = true;
    content.hidden = false;
    D.updateBell();
  }

  // Сотрудник возвращается к списку объявлений.
  fetch('/api/notifications/count')
    .then((r) => r.json())
    .then((d) => {
      if (d.role === 'staff') {
        const back = document.getElementById('back-link');
        back.href = '/announcements';
        back.textContent = tr('announcement.obyavleniya');
      }
    })
    .catch(() => {});

  load();
})();
