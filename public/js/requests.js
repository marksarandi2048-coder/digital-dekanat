'use strict';
// Список заявок: у студента — свои, у сотрудника — все, с фильтром по статусу.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');
  const top = document.getElementById('top');

  // Быстрый заказ в одно касание.
  const QUICK = [
    ['study_certificate', 'Справка об обучении', 'можно электронную'],
    ['enrollment_certificate', 'Справка о зачислении', ''],
    ['order_extract', 'Выписка из приказа', ''],
    ['appeal', 'Написать в деканат', 'вопрос или проблема'],
  ];

  const FILTERS = [
    ['', 'Все'],
    ['accepted', 'Приняты'],
    ['in_progress', 'В работе'],
    ['ready', 'Готовы'],
    ['issued', 'Выданы'],
    ['answered', 'Ответ дан'],
    ['rejected', 'Отклонены'],
  ];

  function statusBadge(r) {
    return el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel);
  }

  function card(r, isStaff) {
    const a = el('a', `req-card${r.closed ? ' req-card--closed' : ''}`);
    a.href = `/requests/${r.id}`;
    const head = el('div', 'req-card__head');
    head.append(el('span', 'req-card__title', r.title), statusBadge(r));
    a.append(head);
    if (isStaff) a.append(el('p', 'req-card__who', `${r.student.fullName}, ${r.student.group}`));
    const meta = [];
    if (r.type === 'appeal') meta.push('Обращение');
    else {
      if (r.format === 'electronic') meta.push('Электронная');
      if (r.purpose) meta.push(r.purpose);
    }
    if (meta.length) a.append(el('p', 'req-card__meta', meta.join(' · ')));
    a.append(el('p', 'req-card__date', `№ ${r.id} · подана ${D.dateTime(r.createdAt)}`));
    return a;
  }

  function renderStudent(data) {
    document.getElementById('page-title').textContent = 'Заявки и справки';
    const quick = el('section', 'quick');
    quick.append(el('h2', 'section-title', 'Заказать'));
    const grid = el('div', 'quick__grid');
    for (const [type, label, hint] of QUICK) {
      const a = el('a', 'quick__item');
      a.href = `/requests/new?type=${type}`;
      a.append(el('span', 'quick__label', label));
      if (hint) a.append(el('span', 'quick__hint', hint));
      grid.append(a);
    }
    quick.append(grid);
    top.replaceChildren(quick);

    const list = el('section', 'req-section');
    list.append(el('h2', 'section-title', 'Мои заявки'));
    if (!data.requests.length) {
      const empty = el('div', 'empty');
      empty.append(el('p', 'empty__title', 'Заявок пока нет'), el('p', 'muted', 'Закажите справку выше — это займёт меньше минуты, а статус будет виден здесь.'));
      list.append(empty);
    } else {
      // Сначала активные, потом завершённые.
      const active = data.requests.filter((r) => !r.closed);
      const closed = data.requests.filter((r) => r.closed);
      const wrap = el('div', 'req-list');
      for (const r of [...active, ...closed]) wrap.append(card(r, false));
      list.append(wrap);
    }
    content.replaceChildren(list);
  }

  function renderStaff(data) {
    document.getElementById('page-title').textContent = 'Заявки студентов';
    const total = Object.values(data.counts).reduce((s, n) => s + n, 0);
    const filters = el('nav', 'filters');
    filters.setAttribute('aria-label', 'Фильтр по статусу');
    for (const [status, label] of FILTERS) {
      const n = status ? data.counts[status] || 0 : total;
      const a = el('a', 'filter', `${label} · ${n}`);
      a.href = status ? `/requests?status=${status}` : '/requests';
      if ((data.status || '') === status) a.setAttribute('aria-current', 'true');
      filters.append(a);
    }
    top.replaceChildren(filters);

    if (!data.requests.length) {
      content.replaceChildren(el('div', 'empty', 'Заявок с таким статусом нет'));
      return;
    }
    const wrap = el('div', 'req-list');
    for (const r of data.requests) wrap.append(card(r, true));
    content.replaceChildren(wrap);
  }

  async function load() {
    const status = new URLSearchParams(window.location.search).get('status');
    let data;
    try {
      data = await D.fetchJSON(`/api/requests${status ? `?status=${encodeURIComponent(status)}` : ''}`);
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
