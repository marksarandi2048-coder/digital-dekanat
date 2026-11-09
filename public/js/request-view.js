'use strict';
// Одна заявка: трекер статусов, где забрать, справка, переписка, а для сотрудника —
// смена статуса и ответ студенту. Используется и на отдельной странице заявки
// (/requests/5, телефон), и справа от списка на странице «Заявки» (компьютер).
window.RequestView = (function () {
  const D = window.Dekanat;
  const el = D.el;

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
      body.append(el('p', 'tracker__hint', s.done ? `${D.dateTime(s.at)} · ${s.hint}` : tr('request_view.esche_ne_nastupil')));
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
      box.append(el('p', 'notice-box__title', tr('request_view.zayavka_otklonena')), el('p', null, r.rejectReason || ''));
      const again = el('a', 'button button--secondary', tr('request_view.podat_zanovo'));
      again.href = `/requests/new?type=${r.type}`;
      box.append(again);
      out.push(box);
    }
    if (r.pickup) {
      const box = el('div', 'notice-box notice-box--ok');
      box.append(el('p', 'notice-box__title', tr('request_view.mozhno_zabirat')));
      const dl = el('dl', 'pickup');
      dl.append(el('dt', null, tr('request_view.gde')), el('dd', null, r.pickup.place), el('dt', null, tr('request_view.kogda')), el('dd', null, r.pickup.hours));
      box.append(dl, el('p', 'muted', tr('request_view.vozmite_s_soboy_studencheskiy')));
      out.push(box);
    }
    if (r.certificate) {
      const c = r.certificate;
      const valid = c.state === 'valid';
      const box = el('div', `notice-box ${valid ? 'notice-box--ok' : 'notice-box--bad'}`);
      box.append(
        el('p', 'notice-box__title', valid ? tr('request_view.elektronnaya_spravka_gotova') : c.state === 'expired' ? tr('request_view.srok_deystviya_spravki_istek') : tr('request_view.spravka_otozvana')),
        el('p', null, tr('request_view.number_p1_do_p2', { number: c.number, p1: valid ? tr('request_view.deystvuet') : tr('request_view.deystvovala'), p2: D.fullDate(c.validUntil) })),
      );
      const open = el('a', valid ? 'button' : 'button button--secondary', tr('request_view.otkryt_spravku'));
      open.href = `/requests/${r.id}/certificate`;
      box.append(open);
      if (!valid) {
        const again = el('a', 'button button--secondary', tr('request_view.zakazat_novuyu'));
        again.href = '/requests/new?type=study_certificate';
        box.append(again);
      }
      out.push(box);
    }
    return out;
  }

  function details(r, isStaff) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', tr('request_view.podrobnosti')));
    const dl = el('dl', 'fields');
    const add = (k, v) => {
      if (v === null || v === undefined || v === '') return;
      dl.append(el('dt', null, k), el('dd', null, String(v)));
    };
    if (isStaff) add(tr('request_view.student'), [r.student.fullName, r.student.group].filter(Boolean).join(', '));
    add(tr('request_view.tip'), r.typeLabel);
    if (r.type !== 'appeal') add(tr('request_view.format'), r.format === 'electronic' ? tr('request_view.elektronnaya_s_qr_kodom') : tr('request_view.bumazhnaya'));
    add(tr('request_view.iz_kakogo_prikaza'), r.orderRef);
    add(tr('request_view.dlya_chego_kuda'), r.purpose);
    add(tr('request_view.ekzemplyarov'), r.copies);
    add(r.type === 'appeal' ? tr('request_view.soobschenie') : tr('request_view.kommentariy'), r.comment);
    card.append(dl);
    return card;
  }

  // ---------- Переписка ----------
  function messages(r, isStaff, ctx) {
    const card = el('section', 'card');
    card.append(el('h2', 'section-title', isStaff ? tr('request_view.perepiska_so_studentom') : tr('request_view.perepiska_s_dekanatom')));
    if (r.messages.length) {
      const list = el('div', 'messages');
      for (const m of r.messages) {
        const b = el('div', `message${m.mine ? ' message--mine' : ''}${m.fromStaff ? ' message--staff' : ''}`);
        b.append(el('p', 'message__author', `${m.mine ? tr('request_view.vy') : m.author} · ${D.dateTime(m.createdAt)}`), el('p', 'message__text', m.text));
        list.append(b);
      }
      card.append(list);
    } else {
      card.append(el('p', 'muted', isStaff ? tr('request_view.soobscheniy_poka_net') : tr('request_view.soobscheniy_poka_net_esli')));
    }

    const form = el('form', 'message-form');
    form.noValidate = true;
    const label = el('label', 'visually-hidden', isStaff ? tr('request_view.otvet_studentu') : tr('request_view.soobschenie_sotrudniku'));
    label.htmlFor = 'message-text';
    const ta = document.createElement('textarea');
    ta.id = 'message-text';
    ta.rows = 3;
    ta.maxLength = 2000;
    ta.placeholder = isStaff ? tr('request_view.otvetit_studentu') : tr('request_view.napisat_sotrudniku');
    const err = el('p', 'alert', '');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    const btn = el('button', 'button button--secondary', tr('request_view.otpravit'));
    btn.type = 'submit';
    form.append(label, ta, err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      const { ok, data } = await D.postJSON(`/api/requests/${r.id}/messages`, { text: ta.value });
      btn.disabled = false;
      if (!ok) {
        err.textContent = data.error || tr('request_view.ne_udalos_otpravit');
        err.hidden = false;
        return;
      }
      ctx.reload();
    });
    card.append(form);
    return card;
  }

  // ---------- Действия сотрудника ----------
  function staffActions(r, ctx) {
    const a = r.actions;
    if (!a || (!a.next && !a.canReject)) return null;
    const card = el('section', 'card staff-actions');
    card.append(el('h2', 'section-title', tr('request_view.deystviya')));
    const err = el('p', 'alert', '');
    err.hidden = true;
    err.setAttribute('role', 'alert');

    async function send(body, button) {
      button.disabled = true;
      err.hidden = true;
      const { ok, data } = await D.postJSON(`/api/requests/${r.id}/status`, body);
      if (!ok) {
        err.textContent = data.error || tr('request_view.ne_udalos_izmenit_status');
        err.hidden = false;
        button.disabled = false;
        return;
      }
      ctx.reload();
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
        place = field('pickup-place', tr('request_view.gde_zabrat'), a.pickupDefaults.place);
        hours = field('pickup-hours', tr('request_view.chasy_vydachi'), a.pickupDefaults.hours);
        f.append(place.w, hours.w);
      }
      const note = field('status-note', a.needsAnswer ? tr('request_view.otvet_studentu_obyazatelno') : tr('request_view.soobschenie_studentu_neobyazatelno'), '', true);
      f.append(note.w);
      const btn = el('button', 'button', tr('request_view.perevesti_v_label', { label: a.next.label }));
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
      det.append(el('summary', null, tr('request_view.otklonit_zayavku')));
      const f = el('form', 'action-form');
      f.noValidate = true;
      const reason = field('reject-reason', tr('request_view.prichina_student_ee_uvidit'), '', true);
      const btn = el('button', 'button button--danger', tr('request_view.otklonit'));
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
  // opts: { container, id, heading ('h1' | 'h2'), justCreated, onError(message), onChanged() }
  async function load(opts) {
    let data;
    try {
      data = await D.fetchJSON(`/api/requests/${encodeURIComponent(opts.id)}`);
    } catch (err) {
      opts.onError(err.message);
      return null;
    }
    const r = data.request;
    const isStaff = Boolean(r.actions);
    // После отправки сообщения или смены статуса — перерисовать заявку (и список рядом, если он есть).
    // Если рядом есть список, onChanged обновит и его, и эту заявку — одним проходом.
    const ctx = {
      reload: () => (opts.onChanged ? opts.onChanged() : load({ ...opts, justCreated: false })),
    };

    const head = el('div', 'req-head');
    head.append(el(opts.heading || 'h1', 'page-title', r.title));
    const sub = el('div', 'req-head__sub');
    sub.append(el('span', `status-badge st--${r.statusClass || r.status}`, r.statusLabel), el('span', 'muted', tr('request_view.id_podana_p1', { id: r.id, p1: D.dateTime(r.createdAt) })));
    head.append(sub);

    const parts = [head];
    if (opts.justCreated) parts.push(el('p', 'verdict verdict--ok', tr('request_view.zayavka_otpravlena_status_budet')));
    const actions = isStaff ? staffActions(r, ctx) : null;
    if (actions) parts.push(actions);
    parts.push(...notices(r));
    const trackCard = el('section', 'card');
    trackCard.append(el('h2', 'section-title', tr('request_view.status')), renderSteps(r));
    parts.push(trackCard, details(r, isStaff), messages(r, isStaff, ctx));

    opts.container.replaceChildren(...parts);
    return r;
  }

  return { load };
})();
