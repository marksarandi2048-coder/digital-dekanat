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
    els.title.textContent = isOwn ? 'Мой профиль' : 'Профиль студента';
    document.title = `${els.title.textContent} — Цифровой деканат`;
    els.avatar.textContent = user.initials;
    els.fullName.textContent = user.fullName;
    els.role.textContent = user.role === 'student' ? 'Студент' : 'Сотрудник деканата';

    els.fields.replaceChildren();
    addField('Факультет', user.faculty);
    if (user.role === 'student') {
      addField('Направление', user.program);
      addField('Курс', user.course ? `${user.course} курс` : null);
      addField('Группа', user.group);
    } else {
      addField('Должность', user.position);
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
      showError('Нет связи с сервером. Обновите страницу.');
      return;
    }

    if (res.status === 401) {
      window.location.href = '/';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || 'Не удалось загрузить профиль');
      return;
    }
    render(data.user, !id);
    if (!id && data.useful) renderUseful(data.useful);
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
    usefulRow(list, 'Студенческий билет', link('/student-card', 'Открыть билет'));
    if (u.group) {
      const dd = usefulRow(list, 'Группа');
      const line = document.createElement('p');
      line.className = 'useful__group';
      const name = document.createElement('span');
      name.className = 'useful__group-name';
      name.textContent = u.group;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'button-link useful__copy';
      copy.textContent = 'Скопировать';
      const status = document.createElement('span');
      status.className = 'muted useful__copied';
      status.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(u.group);
          status.textContent = 'Скопировано';
        } catch {
          status.textContent = 'Не удалось скопировать — выделите номер вручную';
        }
        setTimeout(() => { status.textContent = ''; }, 2500);
      });
      line.append(name, copy, status);
      dd.append(line);
    }
    if (u.curator) {
      usefulRow(list, 'Куратор группы', u.curator.name, u.curator.email && link(`mailto:${u.curator.email}`, u.curator.email));
    }
    const d = u.dean;
    usefulRow(
      list,
      'Деканат факультета',
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
