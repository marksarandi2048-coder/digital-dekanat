'use strict';
// Страница профиля. Все данные выводятся через textContent — без риска внедрения скриптов.
(function () {
  const els = {
    title: document.getElementById('page-title'),
    loading: document.getElementById('state-loading'),
    error: document.getElementById('state-error'),
    profile: document.getElementById('profile'),
    avatar: document.getElementById('avatar'),
    fullName: document.getElementById('full-name'),
    role: document.getElementById('role'),
    fields: document.getElementById('fields'),
  };

  function showError(text) {
    els.loading.hidden = true;
    els.profile.hidden = true;
    els.error.textContent = text;
    els.error.hidden = false;
  }

  function addField(label, value) {
    if (value === null || value === undefined || value === '') return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    els.fields.append(dt, dd);
  }

  function render(user, isOwn) {
    els.title.textContent = isOwn ? tr('profile.moy_profil') : tr('profile.profil_studenta');
    document.title = tr('profile.textcontent_tsifrovoy_dekanat', { textContent: els.title.textContent });
    els.avatar.textContent = user.initials;
    els.fullName.textContent = user.fullName;
    els.role.textContent = user.role === 'student' ? tr('profile.student') : tr('profile.sotrudnik_dekanata');

    els.fields.replaceChildren();
    addField(tr('profile.fakultet'), user.faculty);
    if (user.role === 'student') {
      const again = document.getElementById('tour-again');
      if (again && window.DekanatTour) {
        again.hidden = false;
        again.onclick = () => window.DekanatTour.restart();
      }
      addField(tr('profile.napravlenie'), user.program);
      addField(tr('profile.kurs'), user.course ? tr('profile.course_kurs', { course: user.course }) : null);
      addField(tr('profile.gruppa'), user.group);
    } else {
      addField(tr('profile.dolzhnost'), user.position);
    }

    els.loading.hidden = true;
    els.error.hidden = true;
    els.profile.hidden = false;
  }

  async function load() {
    // /profile — мой профиль, /profile?id=2 — профиль по номеру (сервер проверит права).
    const id = new URLSearchParams(window.location.search).get('id');
    const url = id ? `/api/users/${encodeURIComponent(id)}/profile` : '/api/me';

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      window.Dekanat.offlineBar();
      showError(tr('profile.net_podklyucheniya_kogda_poyavitsya'));
      return;
    }

    if (res.status === 401) {
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || tr('profile.ne_udalos_zagruzit_profil'));
      return;
    }
    render(data.user, !id);
    if (!id && data.useful) renderUseful(data.useful);
    if (!id) window.DekanatPwa.mountAppBlock(document.getElementById('app-block'), data.user.role);
  }

  // ---------- Полезное: группа, куратор, деканат ----------
  function link(href, text) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    return a;
  }

  function usefulRow(list, term, ...lines) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    for (const line of lines.filter(Boolean)) {
      const p = document.createElement('p');
      if (typeof line === 'string') p.textContent = line;
      else p.append(line);
      dd.append(p);
    }
    list.append(dt, dd);
    return dd;
  }

  function renderUseful(u) {
    const list = document.getElementById('useful-list');
    list.replaceChildren();
    usefulRow(list, tr('profile.studencheskiy_bilet'), link('/student-card', tr('profile.otkryt_bilet')));
    if (u.group) {
      const dd = usefulRow(list, tr('profile.gruppa'));
      const line = document.createElement('p');
      line.className = 'useful__group';
      const name = document.createElement('span');
      name.className = 'useful__group-name';
      name.textContent = u.group;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'button-link useful__copy';
      copy.textContent = tr('profile.skopirovat');
      const status = document.createElement('span');
      status.className = 'muted useful__copied';
      status.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(u.group);
          status.textContent = tr('profile.skopirovano');
        } catch {
          status.textContent = tr('profile.ne_udalos_skopirovat_vydelite');
        }
        setTimeout(() => { status.textContent = ''; }, 2500);
      });
      line.append(name, copy, status);
      dd.append(line);
    }
    if (u.curator) {
      usefulRow(list, tr('profile.kurator_gruppy'), u.curator.name, u.curator.email && link(`mailto:${u.curator.email}`, u.curator.email));
    }
    const d = u.dean;
    usefulRow(
      list,
      tr('profile.dekanat_fakulteta'),
      d.office,
      d.hours,
      d.phone && link(`tel:${d.phone.replace(/[^+\d]/g, '')}`, d.phone),
      d.email && link(`mailto:${d.email}`, d.email),
    );
    document.getElementById('useful').hidden = false;
  }

  load();

  // ---------- Оформление: три темы, меняются сразу ----------
  const current = window.DekanatTheme ? window.DekanatTheme.get() : 'classic';
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === current;
    input.addEventListener('change', () => {
      if (input.checked && window.DekanatTheme) window.DekanatTheme.set(input.value);
    });
  }
})();
