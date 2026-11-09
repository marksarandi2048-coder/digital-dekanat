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
    ['all', tr('announcements.vsem_studentam')],
    ['faculty', tr('announcements.fakultetu')],
    ['course', tr('announcements.kursu')],
    ['group', tr('announcements.gruppe')],
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
    if (audience === 'faculty') extra.append(select('a-faculty', tr('announcements.fakultet'), faculties));
    if (audience === 'course') {
      extra.append(select('a-faculty', tr('announcements.fakultet'), [['', tr('announcements.vse_fakultety')], ...faculties]));
      extra.append(select('a-course', tr('announcements.kurs'), meta.courses.map((c) => [String(c), tr('announcements.c_kurs', { c })])));
    }
    if (audience === 'group') extra.append(select('a-group', tr('announcements.gruppa'), meta.groups.map((g) => [g.name, `${g.name} — ${g.faculty}`])));
  }

  function renderList(items) {
    if (!items.length) {
      list.replaceChildren(el('div', 'empty', tr('announcements.obyavleniy_poka_net')));
      return;
    }
    list.replaceChildren(
      ...items.map((a) => {
        const card = el('article', `req-card${a.removed ? ' req-card--closed' : ''}`);
        const head = el('div', 'req-card__head');
        const link = el('a', 'req-card__title', a.title);
        link.href = `/announcements/${a.id}`;
        head.append(link);
        if (a.removed) head.append(el('span', 'status-badge st--issued', tr('announcements.snyato')));
        else if (a.important) head.append(el('span', 'status-badge st--rejected', tr('announcements.vazhnoe')));
        card.append(head);
        card.append(el('p', 'req-card__who', a.audience));
        const meta2 = [`${D.dateTime(a.createdAt)}`];
        if (a.deadlineOn) meta2.push(tr('announcements.srok_p0', { p0: D.dayMonth(a.deadlineOn) }));
        card.append(el('p', 'req-card__meta', meta2.join(' · ')));
        card.append(el('p', 'req-card__date', tr('announcements.prochitali_read_iz_recipients', { read: a.read, recipients: a.recipients })));
        if (!a.removed) {
          const btn = el('button', 'button-link button-link--danger', tr('announcements.snyat_obyavlenie'));
          btn.type = 'button';
          btn.addEventListener('click', async () => {
            if (!window.confirm(tr('announcements.snyat_obyavlenie_title_studenty', { title: a.title }))) return;
            btn.disabled = true;
            const { ok, data } = await D.postJSON(`/api/announcements/${a.id}/remove`, {});
            if (!ok) {
              window.alert(data.error || tr('announcements.ne_udalos_snyat_obyavlenie'));
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
      errorBox.textContent = data.error || tr('announcements.ne_udalos_opublikovat');
      errorBox.hidden = false;
      return;
    }
    form.reset();
    audience = 'all';
    renderAudience();
    okBox.textContent = tr('announcements.obyavlenie_opublikovano_studenty_uvidyat');
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
