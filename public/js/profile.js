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

  function initials(fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
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
    els.avatar.textContent = initials(user.fullName);
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
