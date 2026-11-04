'use strict';
// Кабинет сотрудника: новое объявление (кому, важное, срок) и список опубликованных.
(function () {
  const D = window.Dekanat;
  const el = D.el;
  const form = document.getElementById('announce-form');
  const audienceList = document.getElementById('audience-list');
  const extra = document.getElementById('audience-extra');
  const errorBox = document.getElementById('form-error');
  const okBox = document.getElementById('form-ok');
  const submit = document.getElementById('submit-button');
  const loading = document.getElementById('state-loading');
  const loadError = document.getElementById('state-error');
  const listSection = document.getElementById('list-section');
  const list = document.getElementById('list');

  let meta;
  let audience = 'all';

  const MODES = [
    ['all', 'Всем студентам'],
    ['faculty', 'Факультету'],
    ['course', 'Курсу'],
    ['group', 'Группе'],
  ];

  function select(id, label, options) {
    const w = el('div', 'field');
    const l = el('label', null, label);
    l.htmlFor = id;
    const s = document.createElement('select');
    s.id = id;
    s.className = 'select';
    for (const [value, text] of options) {
      const o = el('option', null, text);
      o.value = value;
      s.append(o);
    }
    w.append(l, s);
    return w;
  }

  function renderAudience() {
    audienceList.replaceChildren(
      ...MODES.map(([value, title]) => {
        const label = el('label', 'choice');
        const r = document.createElement('input');
        r.type = 'radio';
        r.name = 'audience';
        r.value = value;
        r.checked = audience === value;
        r.addEventListener('change', () => {
          audience = value;
          renderAudience();
        });
        const t = el('span', 'choice__text');
        t.append(el('span', 'choice__title', title));
        label.append(r, t);
        return label;
      }),
    );
    extra.replaceChildren();
    const faculties = meta.faculties.map((f) => [f, f]);
    if (audience === 'faculty') extra.append(select('a-faculty', 'Факультет', faculties));
    if (audience === 'course') {
      extra.append(select('a-faculty', 'Факультет', [['', 'Все факультеты'], ...faculties]));
      extra.append(select('a-course', 'Курс', meta.courses.map((c) => [String(c), `${c} курс`])));
    }
    if (audience === 'group') extra.append(select('a-group', 'Группа', meta.groups.map((g) => [g.name, `${g.name} — ${g.faculty}`])));
  }

  function renderList(items) {
    if (!items.length) {
      list.replaceChildren(el('div', 'empty', 'Объявлений пока нет'));
      return;
    }
    list.replaceChildren(
      ...items.map((a) => {
        const card = el('article', `req-card${a.removed ? ' req-card--closed' : ''}`);
        const head = el('div', 'req-card__head');
        const link = el('a', 'req-card__title', a.title);
        link.href = `/announcements/${a.id}`;
        head.append(link);
        if (a.removed) head.append(el('span', 'status-badge st--issued', 'Снято'));
        else if (a.important) head.append(el('span', 'status-badge st--rejected', 'Важное'));
        card.append(head);
        card.append(el('p', 'req-card__who', a.audience));
        const meta2 = [`${D.dateTime(a.createdAt)}`];
        if (a.deadlineOn) meta2.push(`срок ${D.dayMonth(a.deadlineOn)}`);
        card.append(el('p', 'req-card__meta', meta2.join(' · ')));
        card.append(el('p', 'req-card__date', `Прочитали ${a.read} из ${a.recipients}`));
        if (!a.removed) {
          const btn = el('button', 'button-link button-link--danger', 'Снять объявление');
          btn.type = 'button';
          btn.addEventListener('click', async () => {
            if (!window.confirm(`Снять объявление «${a.title}»? Студенты перестанут его видеть.`)) return;
            btn.disabled = true;
            const { ok, data } = await D.postJSON(`/api/announcements/${a.id}/remove`, {});
            if (!ok) {
              window.alert(data.error || 'Не удалось снять объявление');
              btn.disabled = false;
              return;
            }
            loadList();
          });
          card.append(btn);
        }
        return card;
      }),
    );
  }

  async function loadList() {
    const data = await D.fetchJSON('/api/announcements');
    renderList(data.announcements);
    listSection.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    okBox.hidden = true;
    const v = (id) => (document.getElementById(id) ? document.getElementById(id).value : undefined);
    const body = {
      title: v('a-title'),
      body: v('a-body'),
      audience,
      faculty: v('a-faculty'),
      course: v('a-course'),
      group: v('a-group'),
      important: document.getElementById('a-important').checked,
      deadlineOn: v('a-deadline') || null,
    };
    submit.disabled = true;
    const { ok, data } = await D.postJSON('/api/announcements', body);
    submit.disabled = false;
    if (!ok) {
      errorBox.textContent = data.error || 'Не удалось опубликовать';
      errorBox.hidden = false;
      return;
    }
    form.reset();
    audience = 'all';
    renderAudience();
    okBox.textContent = 'Объявление опубликовано — студенты увидят его в ленте.';
    okBox.hidden = false;
    loadList();
  });

  async function load() {
    try {
      meta = await D.fetchJSON('/api/announcement-audiences');
      await loadList();
    } catch (err) {
      loading.hidden = true;
      loadError.textContent = err.message;
      loadError.hidden = false;
      return;
    }
    renderAudience();
    loading.hidden = true;
    form.hidden = false;
  }

  load();
})();
