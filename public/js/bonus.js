'use strict';
// «Где заработать надбавку»: у студента — лента и свои записи, у сотрудника — подтверждение.
// Все данные выводятся через textContent.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const statusBox = document.getElementById('bonus-status');
  const content = document.getElementById('content');
  const num = (n) => String(n).replace('.', ',');

  const CATEGORY = { volunteering: 'Волонтёрство', sport: 'Спортивная секция', research: 'Научная работа' };
  const STATUS = {
    submitted: { label: 'Заявка подана', badge: 'badge', step: 1 },
    confirmed: { label: 'Подтверждено', badge: 'badge badge--room_changed', step: 2 },
    awarded: { label: 'Баллы начислены', badge: 'badge tag--now', step: 3 },
    rejected: { label: 'Отклонено', badge: 'badge badge--cancelled', step: 0 },
  };
  const badge = (status) => el('span', STATUS[status].badge, STATUS[status].label);

  let staffFilter = 'submitted';

  // Запрос-действие: при ошибке сообщение остаётся на экране, список обновляется в любом случае.
  async function run(button, url, body, done) {
    button.disabled = true;
    const { ok, data } = await D.postJSON(url, body);
    errorBox.hidden = ok;
    if (!ok) errorBox.textContent = data.error || 'Не удалось выполнить действие';
    statusBox.textContent = ok ? done : '';
    await load();
  }

  // ---------- Студент ----------
  function renderProgress(p) {
    const box = el('section', 'card bonus-progress');
    box.setAttribute('aria-label', 'Прогресс надбавки');
    const line = el('p', 'bonus-progress__value');
    line.append(el('span', 'bonus-progress__label', 'Надбавка: '), el('strong', null, `+${num(p.points)}`), el('span', 'bonus-progress__max', ` из ${p.max}`));
    const track = el('div', 'bonus-progress__track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(p.max));
    track.setAttribute('aria-valuenow', String(p.points));
    track.setAttribute('aria-label', 'Набрано баллов надбавки');
    const fill = el('span', 'bonus-progress__fill');
    fill.style.width = `${Math.min(100, (p.points / p.max) * 100)}%`;
    track.append(fill);
    box.append(line, track, el('p', 'muted bonus-progress__hint', p.left > 0
      ? `До максимума не хватает ${num(p.left)} ${D.plural(Math.ceil(p.left), 'балла', 'баллов', 'баллов')}`
      : 'Максимум надбавки набран'));
    return box;
  }

  function renderMine(mine) {
    const box = el('section', 'card bonus-mine');
    box.append(el('h2', 'section-title', 'Мои активности'));
    if (!mine.length) {
      box.append(el('p', 'muted', 'Пока пусто: запишитесь на любую возможность из ленты.'));
      return box;
    }
    const ul = el('ul', 'bonus-mine__list');
    for (const m of mine) {
      const li = el('li', 'bonus-mine__item');
      const head = el('div', 'bonus-mine__head');
      head.append(el('p', 'bonus-mine__title', m.title), el('span', 'bonus__points', `+${num(m.points)}`));
      li.append(head, badge(m.status));
      if (STATUS[m.status].step) {
        const track = el('div', 'bonus-track');
        track.setAttribute('aria-hidden', 'true');
        for (let i = 1; i <= 3; i += 1) track.append(el('span', i <= STATUS[m.status].step ? 'is-done' : null));
        li.append(track);
      }
      if (m.status === 'submitted') {
        const cancel = el('button', 'button-link', 'Отменить запись');
        cancel.type = 'button';
        cancel.addEventListener('click', () => run(cancel, `/api/bonus/enrollments/${m.id}/cancel`, {}, `Запись отменена: ${m.title}`));
        li.append(cancel);
      }
      ul.append(li);
    }
    box.append(ul);
    return box;
  }

  function renderOpportunity(o) {
    const card = el('article', `card bonus-opp${o.open ? '' : ' bonus-opp--closed'}`);
    const top = el('div', 'bonus-opp__top');
    top.append(el('span', 'badge', CATEGORY[o.category]), el('span', 'bonus__points', `+${num(o.points)}`));
    card.append(top, el('h3', 'bonus-opp__title', o.title), el('p', 'muted bonus-opp__text', o.description));

    const facts = [o.organizer];
    if (o.eventOn) facts.push(`Когда: ${D.dayMonth(o.eventOn)}`);
    card.append(el('p', 'muted bonus-opp__text', facts.join(' · ')));
    card.append(el('p', 'bonus-opp__deadline', o.open
      ? `Запись до ${D.dayMonth(o.signupUntil)} · ${D.countdown(o.daysLeft)}`
      : `Запись закончилась ${D.dayMonth(o.signupUntil)}`));

    if (o.status) {
      card.append(badge(o.status));
    } else if (o.open) {
      if (o.room !== null) {
        card.append(el('p', 'bonus-opp__limit', o.room > 0
          ? `Максимум — +10: в рейтинг пойдёт только +${num(o.room)}`
          : 'Максимум +10 уже занят: баллы не пойдут в рейтинг'));
      }
      const button = el('button', 'button button--small bonus-opp__enroll', 'Записаться');
      button.type = 'button';
      button.setAttribute('aria-label', `Записаться: ${o.title}`);
      button.addEventListener('click', () => run(button, `/api/bonus/opportunities/${o.id}/enroll`, {}, `Заявка подана: ${o.title}`));
      card.append(button);
    }
    return card;
  }

  function renderStudent(data) {
    const side = el('aside', 'split__side split__side--sticky');
    side.setAttribute('aria-label', 'Моя надбавка');
    side.append(renderProgress(data.progress), renderMine(data.mine));

    const main = el('section', 'split__main');
    main.append(el('h2', 'section-title', 'Где заработать'));
    if (data.opportunities.length) {
      const feed = el('div', 'bonus-feed');
      feed.append(...data.opportunities.map(renderOpportunity));
      main.append(feed);
    } else {
      main.append(D.emptyState({ illu: 'read', title: 'Возможностей пока нет', text: 'Новые появятся здесь.' }));
    }
    content.className = 'split';
    content.replaceChildren(side, main);
  }

  // ---------- Сотрудник ----------
  const STAFF_FILTERS = [
    ['submitted', 'Ждут подтверждения'],
    ['confirmed', 'Подтверждены'],
    ['awarded', 'Начислено'],
    ['rejected', 'Отклонены'],
  ];

  function staffButton(e, text, action, secondary, question, done) {
    const b = el('button', `button button--small${secondary ? ' button--secondary' : ''}`, text);
    b.type = 'button';
    b.setAttribute('aria-label', `${text}: ${e.student.fullName}, ${e.title}`);
    b.addEventListener('click', () => {
      if (question && !window.confirm(question)) return;
      run(b, `/api/bonus/enrollments/${e.id}/status`, { action }, done);
    });
    return b;
  }

  function renderEnrollment(e) {
    const card = el('article', 'card bonus-staff');
    const who = [e.student.fullName, e.student.group].filter(Boolean).join(', ');
    const head = el('div', 'bonus-opp__top');
    head.append(badge(e.status), el('span', 'bonus__points', `+${num(e.points)}`));
    card.append(head, el('h3', 'bonus-opp__title', e.title), el('p', 'bonus-staff__who', who),
      el('p', 'muted bonus-opp__text', `${CATEGORY[e.category]} · заявка от ${D.dateTime(e.createdAt)}`));
    const actions = el('div', 'bonus-staff__actions');
    if (e.status === 'submitted') actions.append(staffButton(e, 'Подтвердить', 'confirm', false, null, `Участие подтверждено: ${e.student.fullName}`));
    if (e.status === 'confirmed') {
      actions.append(staffButton(e, 'Начислить баллы', 'award', false, `Начислить +${num(e.points)} студенту ${e.student.fullName}? Отменить будет нельзя.`, `Баллы начислены: ${e.student.fullName}`));
    }
    if (e.status === 'submitted' || e.status === 'confirmed') {
      actions.append(staffButton(e, 'Отклонить', 'reject', true, `Отклонить заявку: ${e.student.fullName}, «${e.title}»?`, `Заявка отклонена: ${e.student.fullName}`));
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }

  function renderStaff(data) {
    const filters = el('div', 'filters');
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Фильтр по статусу');
    for (const [status, label] of STAFF_FILTERS) {
      const n = data.enrollments.filter((e) => e.status === status).length;
      const b = el('button', 'filter', `${label} · ${n}`);
      b.type = 'button';
      if (status === staffFilter) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => {
        staffFilter = status;
        renderStaff(data);
      });
      filters.append(b);
    }
    const shown = data.enrollments.filter((e) => e.status === staffFilter);
    const list = el('div', 'bonus-feed');
    list.append(...shown.map(renderEnrollment));
    content.className = '';
    content.replaceChildren(filters, shown.length ? list : D.emptyState({ illu: 'read', inline: true, title: 'Здесь пока никого нет' }));
  }

  async function load() {
    let data;
    try {
      data = await D.fetchJSON('/api/bonus');
    } catch (err) {
      loading.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    document.getElementById('bonus-title').textContent = data.role === 'staff' ? 'Участие в активностях' : 'Где заработать надбавку';
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    loading.hidden = true;
    content.hidden = false;
  }

  load().then(() => content.classList.add('is-live'));
})();
