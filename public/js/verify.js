'use strict';
// Открытая проверка электронной справки по коду (из QR-кода или вручную).
// Вход не нужен. Все данные выводятся через textContent.
(function () {
  const result = document.getElementById('result');
  const loading = document.getElementById('state-loading');
  const form = document.getElementById('verify-form');
  const input = document.getElementById('code-input');

  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  const fullDate = (d) =>
    new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));

  // Принимаем и сам код, и ссылку целиком (…/verify/КОД).
  function extractCode(value) {
    const v = value.trim();
    const m = v.match(/\/verify\/([^/?#\s]+)/);
    return (m ? m[1] : v).slice(0, 100);
  }

  const TITLES = {
    valid: ['ok', '✓ Справка действительна'],
    expired: ['bad', '✕ Срок действия справки истёк'],
    revoked: ['bad', '✕ Справка отозвана деканатом'],
    not_found: ['bad', '✕ Справка не найдена'],
  };

  function render(data) {
    const [tone, title] = TITLES[data.state] || TITLES.not_found;
    const card = el('section', `card verify-result verify-result--${tone}`);
    card.append(el('p', 'verify-result__title', title));
    if (data.state === 'not_found') {
      card.append(el('p', null, 'Проверьте, правильно ли введён код. Если код верный — справка поддельная или обратитесь в деканат.'));
    }
    if (data.certificate) {
      const c = data.certificate;
      const dl = el('dl', 'fields');
      const add = (k, v) => v !== null && v !== undefined && dl.append(el('dt', null, k), el('dd', null, String(v)));
      add('Документ', 'Справка об обучении');
      add('Номер', c.number);
      add('ФИО', c.fullName);
      add('Факультет', c.faculty);
      add('Направление', c.program);
      add('Курс', c.course);
      add('Форма обучения', c.studyForm);
      add('Выдана', fullDate(c.issuedAt));
      add('Действительна до', fullDate(c.validUntil));
      add('Подписал', c.signedBy);
      card.append(dl);
    }
    result.replaceChildren(card);
    document.getElementById('form-title').textContent = 'Проверить другую справку';
  }

  async function check(code) {
    loading.hidden = false;
    let data;
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не удалось проверить справку');
    } catch (err) {
      loading.hidden = true;
      result.replaceChildren(el('p', 'alert', err.message || 'Нет связи с сервером'));
      return;
    }
    loading.hidden = true;
    render(data);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = extractCode(input.value);
    if (!code) {
      input.focus();
      return;
    }
    window.location.href = `/verify/${encodeURIComponent(code)}`;
  });

  const fromPath = window.location.pathname.split('/')[2];
  if (fromPath) {
    let code = fromPath;
    try {
      code = decodeURIComponent(fromPath);
    } catch {
      // испорченный адрес — проверим как есть, сервер ответит «не найдена»
    }
    check(code);
  }
})();
