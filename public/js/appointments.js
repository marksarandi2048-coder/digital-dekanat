'use strict';
// Запись на приём: у студента — свои записи и выбор времени, у сотрудника — расписание дня.
// Все данные выводятся через textContent.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const loading = document.getElementById('state-loading');
  const errorBox = document.getElementById('state-error');
  const statusBox = document.getElementById('appt-status');
  const content = document.getElementById('content');

  const month = (d) => new Intl.DateTimeFormat(window.DekanatI18n.locale, { timeZone: 'UTC', month: 'short' }).format(new Date(`${d}T00:00:00Z`)).replace('.', '');
  const whenText = (a) => `${D.weekdayShort(a.date)} ${D.dayMonth(a.date)}, ${a.time}`;
  function addDays(date, n) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function showStatus(text) {
    statusBox.textContent = text;
    statusBox.hidden = !text;
  }
  function showError(text) {
    errorBox.textContent = text || '';
    errorBox.hidden = !text;
  }

  // ---------- Студент ----------
  const form = { topic: null, comment: '', date: null, time: null, moving: null };
  let slotsRequest = 0;

  function resetForm() {
    Object.assign(form, { topic: null, comment: '', date: null, time: null, moving: null });
  }

  function renderCard(a) {
    const card = el('article', 'card appt-card');
    card.append(el('h3', 'appt-card__title', tr('appointments.vy_zapisany_p0_place', { p0: whenText(a), place: a.place })), el('p', 'muted appt-card__text', a.topic));
    if (a.comment) card.append(el('p', 'muted appt-card__text', a.comment));
    if (!a.canChange) {
      card.append(el('p', 'muted appt-card__text', tr('appointments.priem_uzhe_nachalsya_izmenit')));
      return card;
    }
    const actions = el('div', 'appt-card__actions');
    const move = el('button', 'button button--secondary button--small', tr('appointments.perenesti'));
    move.type = 'button';
    move.setAttribute('aria-label', tr('appointments.perenesti_zapis_p0', { p0: whenText(a) }));
    move.addEventListener('click', () => {
      Object.assign(form, { moving: a, date: null, time: null });
      showStatus('');
      showError('');
      load().then(() => document.getElementById('appt-form').scrollIntoView({ block: 'start' }));
    });
    const cancel = el('button', 'button-link button-link--danger', tr('appointments.otmenit'));
    cancel.type = 'button';
    cancel.setAttribute('aria-label', tr('appointments.otmenit_zapis_p0', { p0: whenText(a) }));
    cancel.addEventListener('click', async () => {
      if (!window.confirm(tr('appointments.otmenit_zapis_p0_2', { p0: whenText(a) }))) return;
      cancel.disabled = true;
      const { ok, offline, data } = await D.postJSON(`/api/appointments/${a.id}/cancel`, {});
      showError(ok ? '' : data.error);
      showStatus(ok ? tr('appointments.zapis_otmenena_p0', { p0: whenText(a) }) : '');
      if (offline) {
        cancel.disabled = false;
        return;
      }
      if (ok && form.moving && form.moving.id === a.id) resetForm();
      await load();
    });
    actions.append(move, cancel);
    card.append(actions);
    return card;
  }

  function pressGroup(container, active) {
    for (const b of container.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === active));
  }

  async function loadSlots(box, refresh) {
    const id = (slotsRequest += 1);
    box.replaceChildren(el('p', 'muted appt-note', tr('appointments.zagruzhaem_svobodnoe_vremya')));
    let data;
    try {
      data = await D.fetchJSON(`/api/appointments/slots?date=${form.date}`);
    } catch (err) {
      if (id === slotsRequest) box.replaceChildren(el('p', 'appt-note', err.message));
      return;
    }
    if (id !== slotsRequest) return;
    const free = data.slots.filter((s) => s.state === 'free');
    if (!data.slots.length || !free.length) {
      box.replaceChildren(el('p', 'muted appt-note', tr('appointments.na_etot_den_svobodnogo')));
      return;
    }
    const grid = el('div', 'appt-slots');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', tr('appointments.svobodnoe_vremya'));
    for (const s of data.slots) {
      const b = el('button', `appt-slot${s.state === 'free' ? '' : ' appt-slot--taken'}`, s.time);
      b.type = 'button';
      b.disabled = s.state !== 'free';
      if (s.state === 'free') b.setAttribute('aria-pressed', String(form.time === s.time));
      else b.setAttribute('aria-label', `${s.time}, ${s.state === 'mine' ? tr('appointments.vasha_zapis') : tr('appointments.zanyato')}`);
      b.addEventListener('click', () => {
        form.time = s.time;
        pressGroup(grid, b);
        refresh();
      });
      grid.append(b);
    }
    if (!free.some((s) => s.time === form.time)) form.time = null;
    box.replaceChildren(grid);
    refresh();
  }

  function renderForm(data) {
    const moving = form.moving;
    const box = el('section', 'card appt-form');
    box.id = 'appt-form';
    box.append(el('h2', 'section-title', moving ? tr('appointments.perenesti_zapis_p0', { p0: whenText(moving) }) : tr('appointments.zapisatsya_na_priem')));

    if (!moving) {
      box.append(el('p', 'appt-label', tr('appointments.tema')));
      const topics = el('div', 'appt-chips');
      topics.setAttribute('role', 'group');
      topics.setAttribute('aria-label', tr('appointments.tema_priema'));
      for (const t of data.topics) {
        const b = el('button', 'appt-chip', t.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(form.topic === t.id));
        b.addEventListener('click', () => {
          form.topic = t.id;
          pressGroup(topics, b);
          refresh();
        });
        topics.append(b);
      }
      box.append(topics);
      const field = el('div', 'field appt-comment');
      const label = el('label', null, tr('appointments.kommentariy_neobyazatelno'));
      label.htmlFor = 'appt-comment';
      const area = el('textarea');
      area.id = 'appt-comment';
      area.rows = 2;
      area.maxLength = data.commentMax;
      area.value = form.comment;
      area.addEventListener('input', () => { form.comment = area.value; });
      field.append(label, area);
      box.append(field);
    }

    box.append(el('p', 'appt-label', tr('appointments.data')));
    const usable = (d) => !d.closed && d.free > 0 && (!d.mine || (moving && moving.date === d.date));
    if (!data.days.some(usable)) {
      box.append(el('p', 'muted appt-note', tr('appointments.na_blizhayshie_dve_nedeli')));
      return box;
    }
    if (!data.days.some((d) => d.date === form.date && usable(d))) {
      form.date = data.days.find(usable).date;
      form.time = null;
    }
    const dates = el('div', 'appt-dates');
    dates.setAttribute('role', 'group');
    dates.setAttribute('aria-label', tr('appointments.data_priema'));
    const slotsBox = el('div', 'appt-slots-box');
    for (const d of data.days) {
      const b = el('button', 'appt-date');
      b.type = 'button';
      b.disabled = !usable(d);
      b.append(el('span', 'appt-date__day', D.capitalize(D.weekdayShort(d.date))), el('span', 'appt-date__num', Number(d.date.slice(8))), el('span', 'appt-date__month', month(d.date)));
      const why = d.closed || (d.mine && !usable(d) ? tr('appointments.vy_uzhe_zapisany') : d.free === 0 ? tr('appointments.net_svobodnogo_vremeni') : '');
      b.setAttribute('aria-label', `${D.capitalize(D.weekdayLong(d.date))}, ${D.dayMonth(d.date)}${why ? `, ${why}` : ''}`);
      if (why) b.title = D.capitalize(why);
      b.setAttribute('aria-pressed', String(form.date === d.date));
      b.addEventListener('click', () => {
        form.date = d.date;
        form.time = null;
        pressGroup(dates, b);
        refresh();
        loadSlots(slotsBox, refresh);
      });
      dates.append(b);
    }
    box.append(dates, el('p', 'appt-label', tr('appointments.vremya')), slotsBox);

    const submit = el('button', 'button appt-submit', moving ? tr('appointments.perenesti_na_eto_vremya') : tr('appointments.zapisatsya'));
    function refresh() {
      submit.disabled = !form.date || !form.time || (!moving && !form.topic);
    }
    submit.type = 'button';
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      const url = moving ? `/api/appointments/${moving.id}/reschedule` : '/api/appointments';
      const body = moving ? { date: form.date, time: form.time } : { topic: form.topic, comment: form.comment, date: form.date, time: form.time };
      const { ok, offline, data: answer } = await D.postJSON(url, body);
      if (offline) {
        // Выбранное время и тема остаются на экране: можно нажать ещё раз.
        showStatus('');
        showError(answer.error);
        submit.disabled = false;
        return;
      }
      if (!ok) {
        showStatus('');
        showError(answer.error || tr('appointments.ne_udalos_zapisatsya'));
        form.time = null;
        await load();
        return;
      }
      showError('');
      showStatus(`${moving ? tr('appointments.zapis_perenesena') : tr('appointments.vy_zapisany')}: ${whenText(answer.appointment)}, ${answer.appointment.place}`);
      resetForm();
      await load();
      statusBox.scrollIntoView({ block: 'center' });
    });
    box.append(submit);
    if (moving) {
      const back = el('button', 'button-link appt-back', tr('appointments.ne_perenosit'));
      back.type = 'button';
      back.addEventListener('click', () => {
        resetForm();
        load();
      });
      box.append(back);
    }
    refresh();
    loadSlots(slotsBox, refresh);
    return box;
  }

  function renderStudent(data) {
    const side = el('section', 'split__side');
    side.append(el('h2', 'section-title', tr('appointments.moi_zapisi')));
    if (data.appointments.length) side.append(...data.appointments.map(renderCard));
    else side.append(el('p', 'muted', tr('appointments.zapisey_poka_net_vyberite')));
    const main = el('div', 'split__main');
    main.append(renderForm(data));
    content.className = 'split';
    content.replaceChildren(side, main);
  }

  // ---------- Сотрудник ----------
  const staff = { date: null, faculty: null };
  const STATUS = {
    active: [tr('appointments.ozhidaetsya'), 'badge'],
    attended: [tr('appointments.prishel'), 'badge tag--now'],
    missed: [tr('appointments.ne_prishel'), 'badge badge--cancelled'],
  };

  function renderRow(a, canMark) {
    const row = el('article', 'card appt-row');
    row.append(el('p', 'appt-row__time', a.time));
    const info = el('div', 'appt-row__info');
    info.append(el('h3', 'appt-row__name', [a.student.fullName, a.student.group].filter(Boolean).join(', ')), el('p', 'muted appt-card__text', a.topic));
    if (a.comment) info.append(el('p', 'muted appt-card__text', a.comment));
    info.append(el('span', STATUS[a.status][1], STATUS[a.status][0]));
    const actions = el('div', 'appt-card__actions');
    for (const [result, label] of [['attended', tr('appointments.prishel')], ['missed', tr('appointments.ne_prishel')]]) {
      const b = el('button', 'appt-chip', label);
      b.type = 'button';
      b.disabled = !canMark;
      b.setAttribute('aria-pressed', String(a.status === result));
      b.setAttribute('aria-label', `${label}: ${a.student.fullName}, ${a.time}`);
      b.addEventListener('click', async () => {
        b.disabled = true;
        const { ok, offline, data } = await D.postJSON(`/api/appointments/${a.id}/mark`, { result });
        showError(ok ? '' : data.error);
        showStatus(ok ? `${a.student.fullName}: ${label.toLowerCase()}` : '');
        if (offline) {
          b.disabled = false;
          return;
        }
        await load();
      });
      actions.append(b);
    }
    info.append(actions);
    row.append(info);
    return row;
  }

  function renderStaff(data) {
    staff.date = data.date;
    staff.faculty = data.faculty;
    document.getElementById('page-title').textContent = tr('appointments.priem_v_dekanate');

    const picker = el('div', 'group-picker');
    const label = el('label', null, tr('appointments.fakultet'));
    label.htmlFor = 'appt-faculty';
    const select = el('select');
    select.id = 'appt-faculty';
    for (const f of data.faculties) {
      const o = el('option', null, f.short || f.name);
      o.value = f.name;
      o.selected = f.name === data.faculty;
      select.append(o);
    }
    select.addEventListener('change', () => {
      staff.faculty = select.value;
      load();
    });
    picker.append(label, select);

    const nav = el('div', 'week-nav');
    const arrow = (text, aria, step) => {
      const b = el('button', 'week-nav__arrow appt-arrow', text);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => {
        staff.date = addDays(staff.date, step);
        load();
      });
      return b;
    };
    const center = el('div', 'week-nav__center');
    center.append(el('span', 'week-nav__label', `${D.capitalize(D.weekdayLong(data.date))}, ${D.dayMonth(data.date)}`));
    if (data.date !== data.today) {
      const today = el('button', 'button-link week-nav__note', tr('appointments.k_segodnya'));
      today.type = 'button';
      today.addEventListener('click', () => {
        staff.date = data.today;
        load();
      });
      center.append(today);
    } else center.append(el('span', 'week-nav__note', tr('appointments.segodnya')));
    nav.append(arrow('‹', tr('appointments.predyduschiy_den'), -1), center, arrow('›', tr('appointments.sleduyuschiy_den'), 1));

    const parts = [picker, nav];
    if (data.closed) parts.push(D.emptyState({ illu: 'rest', inline: true, title: tr('appointments.priema_net_closed', { closed: data.closed }) }));
    else if (!data.reception) parts.push(D.emptyState({ illu: 'rest', inline: true, title: tr('appointments.v_etot_den_priema') }));
    else if (!data.appointments.length) parts.push(D.emptyState({ illu: 'read', inline: true, title: tr('appointments.na_etot_den_nikto'), text: data.place }));
    else {
      parts.push(el('p', 'muted appt-note', tr('appointments.place_zapisey_length', { place: data.place, length: data.appointments.length })));
      const list = el('div', 'appt-list');
      list.append(...data.appointments.map((a) => renderRow(a, data.canMark)));
      parts.push(list);
      if (!data.canMark) parts.push(el('p', 'muted appt-note', tr('appointments.otmetit_prikhod_mozhno_nachinaya')));
    }
    content.className = '';
    content.replaceChildren(...parts);
  }

  async function load() {
    const api = new URLSearchParams();
    if (staff.date) api.set('date', staff.date);
    if (staff.faculty) api.set('faculty', staff.faculty);
    let data;
    try {
      data = await D.fetchJSON(`/api/appointments?${api}`);
    } catch (err) {
      loading.hidden = true;
      showError(err.message);
      return;
    }
    if (data.role === 'staff') renderStaff(data);
    else renderStudent(data);
    loading.hidden = true;
    content.hidden = false;
  }

  load().then(() => content.classList.add('is-live'));
})();
