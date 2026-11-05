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
    a.dataset.id = String(r.id);
    a.addEventListener('click', (e) => {
      if (!wide.matches) return; // телефон — отдельная страница заявки
      e.preventDefault();
      select(r.id, true);
    });
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
      list.append(D.emptyState({
        illu: 'request',
        title: 'Заявок пока нет — закажите первую справку',
        text: 'Это займёт меньше минуты, а статус будет виден здесь.',
        action: { href: '/requests/new?type=study_certificate', label: 'Заказать справку' },
      }));
      content.className = '';
      content.replaceChildren(list);
      return;
    }
    // Сначала активные, потом завершённые.
    const active = data.requests.filter((r) => !r.closed);
    const closed = data.requests.filter((r) => r.closed);
    const wrap = el('div', 'req-list');
    for (const r of [...active, ...closed]) wrap.append(card(r, false));
    list.append(wrap);
    mountSplit(list, [...active, ...closed]);
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
      content.className = '';
      content.replaceChildren(D.emptyState({ illu: 'read', title: 'Заявок с таким статусом нет', text: 'Выберите другой фильтр выше.' }));
      return;
    }
    const list = el('section', 'req-section');
    list.setAttribute('aria-label', 'Список заявок');
    const wrap = el('div', 'req-list');
    for (const r of data.requests) wrap.append(card(r, true));
    list.append(wrap);
    mountSplit(list, data.requests);
  }

  // ---------- Как в почте: слева список, справа выбранная заявка (только на широком экране) ----------
  const wide = window.matchMedia('(min-width: 1100px)');
  const pageParams = new URLSearchParams(window.location.search);
  let selectedId = Number(pageParams.get('id')) || null;
  const justCreated = pageParams.get('created') === '1';
  let detail = null;
  let defaultId = null; // заявка, которая открыта, если в адресе номера нет

  function mountSplit(listSection, ordered) {
    const side = el('div', 'split__side req-master');
    side.append(listSection);
    detail = el('section', 'split__main split__side--sticky req-detail');
    detail.setAttribute('aria-live', 'polite');
    detail.setAttribute('aria-label', 'Выбранная заявка');
    content.className = 'split split--mail';
    content.replaceChildren(side, detail);
    // По умолчанию — первая активная заявка (список уже отсортирован).
    defaultId = ordered.length ? ordered[0].id : null;
    if (!selectedId || !ordered.some((r) => r.id === selectedId)) selectedId = defaultId;
    if (wide.matches && selectedId) select(selectedId, false);
  }

  async function select(id, push) {
    selectedId = id;
    for (const a of content.querySelectorAll('.req-card')) {
      if (Number(a.dataset.id) === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    if (push) {
      const params = new URLSearchParams(window.location.search);
      params.set('id', String(id));
      params.delete('created');
      history.pushState({ id }, '', `/requests?${params}`);
    }
    detail.replaceChildren(el('p', 'state', 'Загружаем заявку…'));
    await window.RequestView.load({
      container: detail,
      id,
      heading: 'h2',
      justCreated: justCreated && !push,
      onError(message) {
        detail.replaceChildren(el('p', 'state state--error', message));
      },
      // Статус изменился — обновить и список слева (значки статусов, счётчики фильтров).
      onChanged: () => load(),
    });
  }

  // Кнопки «назад/вперёд» браузера переключают выбранную заявку.
  window.addEventListener('popstate', () => {
    const id = Number(new URLSearchParams(window.location.search).get('id')) || defaultId;
    if (id && detail) select(id, false);
  });
  // Окно расширили до компьютерной ширины — показать выбранную заявку.
  wide.addEventListener('change', () => {
    if (wide.matches && detail && selectedId && !detail.childElementCount) select(selectedId, false);
  });

  if (!wide.matches && selectedId) {
    window.location.replace(`/requests/${selectedId}${justCreated ? '?created=1' : ''}`);
    return;
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
