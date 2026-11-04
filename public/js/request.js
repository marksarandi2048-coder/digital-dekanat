'use strict';
// Страница одной заявки: трекер статусов, где забрать, справка, переписка,
// а для сотрудника — смена статуса и ответ студенту.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const content = document.getElementById('content');

  const id = window.location.pathname.split('/')[2];
  const justCreated = new URLSearchParams(window.location.search).get('created') === '1';

  // ---------- Трекер «как у доставки» ----------
  function renderSteps(r) {
    const ol = el('ol', 'tracker');
    const lastDone = r.steps.reduce((i, s, idx) => (s.done ? idx : i), -1);
    r.steps.forEach((s, idx) => {
      const cls = ['tracker__step'];
      if (s.done) cls.push('is-done');
      if (idx === lastDone) cls.push('is-current');
      if (s.status === 'rejected') cls.push('is-rejected');
      const li = el('li', cls.join(' '));
      const body = el('div', 'tracker__body');
      body.append(el('p', 'tracker__label', s.label));
      body.append(el('p', 'tracker__hint', s.done ? `${D.dateTime(s.at)} · ${s.hint}` : 'Ещё не наступил'));
      li.append(el('span', 'tracker__dot'), body);
      ol.append(li);
    });
    return ol;
  }

  // ---------- Блоки по ситуации ----------
  function notices(r) {
    const out = [];
    if (r.status === 'rejected') {
      const box = el('div', 'notice-box notice-box--bad');
      box.append(el('p', 'notice-box__title', 'Заявка отклонена'), el('p', null, r.rejectReason || ''));
      const again = el('a', 'button button--secondary', 'Подать заново');
      again.href = `/requests/new?type=${r.type}`;
      box.append(again);
      out.push(box);
    }
    if (r.pickup) {
      const box = el('div', 'notice-box notice-box--ok');
      box.append(el('p', 'notice-box__title', 'Можно забирать'));
      const dl = el('dl', 'pickup');
      dl.append(el('dt', null, 'Где'), el('dd', null, r.pickup.place), el('dt', null, 'Когда'), el('dd', null, r.pickup.hours));
      box.append(dl, el('p', 'muted', 'Возьмите с собой студенческий билет.'));
      out.push(box);
    }
    if (r.certificate) {
      const c = r.certificate;
      const valid = c.state === 'valid';
      const box = el('div', `notice-box ${valid ? 'notice-box--ok' : 'notice-box--bad'}`);
      box.append(
        el('p', 'notice-box__title', valid ? 'Электронная справка готова' : c.state === 'expired' ? 'Срок действия справки истёк' : 'Справка отозвана'),
        el('p', null, `№ ${c.number} · ${valid ? 'действует' : 'действовала'} до ${D.fullDate(c.validUntil)}`),
      );
      const open = el('a', valid ? 'button' : 'button button--secondary', 'Открыть справку');
      open.href = `/requests/${r.id}/certificate`;
      box.append(open);
      if (!valid) {
        const again = el('a', 'button button--secondary', 'Заказать новую');
        again.href = '/requests/new?type=study_certificate';
        box.append(again);
      }
      out.push(box);
    }
    return out;
  }

  function details(r, isStaff) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', 'Подробности'));
    const dl = el('dl', 'fields');
    const add = (k, v) => {
      if (v === null || v === undefined || v === '') return;
      dl.append(el('dt', null, k), el('dd', null, String(v)));
    };
    if (isStaff) add('Студент', `${r.student.fullName}, ${r.student.group}`);
    add('Тип', r.typeLabel);
    if (r.type !== 'appeal') add('Формат', r.format === 'electronic' ? 'Электронная, с QR-кодом' : 'Бумажная');
    add('Из какого приказа', r.orderRef);
    add('Для чего / куда', r.purpose);
    add('Экземпляров', r.copies);
    add(r.type === 'appeal' ? 'Сообщение' : 'Комментарий', r.comment);
    card.append(dl);
    return card;
  }

  // ---------- Переписка ----------
  function messages(r, isStaff) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', isStaff ? 'Переписка со студентом' : 'Переписка с деканатом'));
    if (r.messages.length) {
      const list = el('div', 'messages');
      for (const m of r.messages) {
        const b = el('div', `message${m.mine ? ' message--mine' : ''}${m.fromStaff ? ' message--staff' : ''}`);
        b.append(el('p', 'message__author', `${m.mine ? 'Вы' : m.author} · ${D.dateTime(m.createdAt)}`), el('p', 'message__text', m.text));
        list.append(b);
      }
      card.append(list);
    } else {
      card.append(el('p', 'muted', isStaff ? 'Сообщений пока нет.' : 'Сообщений пока нет. Если что-то нужно уточнить — напишите сюда.'));
    }

    const form = el('form', 'message-form');
    form.noValidate = true;
    const label = el('label', 'visually-hidden', isStaff ? 'Ответ студенту' : 'Сообщение сотруднику');
    label.htmlFor = 'message-text';
    const ta = document.createElement('textarea');
    ta.id = 'message-text';
    ta.rows = 3;
    ta.maxLength = 2000;
    ta.placeholder = isStaff ? 'Ответить студенту…' : 'Написать сотруднику…';
    const err = el('p', 'alert', '');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    const btn = el('button', 'button button--secondary', 'Отправить');
    btn.type = 'submit';
    form.append(label, ta, err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      const { ok, data } = await D.postJSON(`/api/requests/${r.id}/messages`, { text: ta.value });
      btn.disabled = false;
      if (!ok) {
        err.textContent = data.error || 'Не удалось отправить';
        err.hidden = false;
        return;
      }
      load();
    });
    card.append(form);
    return card;
  }

  // ---------- Действия сотрудника ----------
  function staffActions(r) {
    const a = r.actions;
    if (!a || (!a.next && !a.canReject)) return null;
    const card = el('section', 'card staff-actions');
    card.append(el('h2', 'section-title', 'Действия'));
    const err = el('p', 'alert', '');
    err.hidden = true;
    err.setAttribute('role', 'alert');

    async function send(body, button) {
      button.disabled = true;
      err.hidden = true;
      const { ok, data } = await D.postJSON(`/api/requests/${r.id}/status`, body);
      if (!ok) {
        err.textContent = data.error || 'Не удалось изменить статус';
        err.hidden = false;
        button.disabled = false;
        return;
      }
      load();
    }

    const field = (fid, label, value, textarea) => {
      const w = el('div', 'field');
      const l = el('label', null, label);
      l.htmlFor = fid;
      const i = document.createElement(textarea ? 'textarea' : 'input');
      i.id = fid;
      if (textarea) i.rows = 3;
      else i.type = 'text';
      i.maxLength = textarea ? 2000 : 200;
      i.value = value || '';
      w.append(l, i);
      return { w, i };
    };

    if (a.next) {
      const f = el('form', 'action-form');
      f.noValidate = true;
      let place;
      let hours;
      if (a.needsPickup) {
        place = field('pickup-place', 'Где забрать', a.pickupDefaults.place);
        hours = field('pickup-hours', 'Часы выдачи', a.pickupDefaults.hours);
        f.append(place.w, hours.w);
      }
      const note = field('status-note', a.needsAnswer ? 'Ответ студенту (обязательно)' : 'Сообщение студенту (необязательно)', '', true);
      f.append(note.w);
      const btn = el('button', 'button', `Перевести в «${a.next.label}»`);
      btn.type = 'submit';
      f.append(btn);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        send({ status: a.next.status, note: note.i.value, pickupPlace: place && place.i.value, pickupHours: hours && hours.i.value }, btn);
      });
      card.append(f);
    }

    if (a.canReject) {
      const det = el('details', 'reject');
      det.append(el('summary', null, 'Отклонить заявку'));
      const f = el('form', 'action-form');
      f.noValidate = true;
      const reason = field('reject-reason', 'Причина (студент её увидит)', '', true);
      const btn = el('button', 'button button--danger', 'Отклонить');
      btn.type = 'submit';
      f.append(reason.w, btn);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        send({ status: 'rejected', reason: reason.i.value }, btn);
      });
      det.append(f);
      card.append(det);
    }
    card.append(err);
    return card;
  }

  // ---------- Сборка ----------
  async function load() {
    let data;
    try {
      data = await D.fetchJSON(`/api/requests/${encodeURIComponent(id)}`);
    } catch (err) {
      loading.hidden = true;
      content.hidden = true;
      errorBox.textContent = err.message;
      errorBox.hidden = false;
      return;
    }
    const r = data.request;
    const isStaff = Boolean(r.actions);
    document.title = `${r.title} — Цифровой деканат`;

    const head = el('div', 'req-head');
    const h1 = el('h1', 'page-title', r.title);
    head.append(h1);
    const sub = el('div', 'req-head__sub');
    sub.append(el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel), el('span', 'muted', `№ ${r.id} · подана ${D.dateTime(r.createdAt)}`));
    head.append(sub);

    const parts = [head];
    if (justCreated) parts.push(el('p', 'verdict verdict--ok', 'Заявка отправлена! Статус будет меняться здесь — заходить в деканат не нужно.'));
    const actions = isStaff ? staffActions(r) : null;
    if (actions) parts.push(actions);
    parts.push(...notices(r));
    const trackCard = el('section', 'card');
    trackCard.append(el('h2', 'section-title', 'Статус'), renderSteps(r));
    parts.push(trackCard, details(r, isStaff), messages(r, isStaff));

    content.replaceChildren(...parts);
    loading.hidden = true;
    content.hidden = false;
  }

  load();
})();
