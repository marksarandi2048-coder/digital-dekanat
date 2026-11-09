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
    new Intl.DateTimeFormat(window.DekanatI18n.locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));

  // Принимаем и сам код, и ссылку целиком (…/verify/КОД).
  function extractCode(value) {
    const v = value.trim();
    const m = v.match(/\/verify\/([^/?#\s]+)/);
    return (m ? m[1] : v).slice(0, 100);
  }

  const TITLES = {
    valid: ['ok', tr('verify.spravka_deystvitelna')],
    expired: ['bad', tr('verify.srok_deystviya_spravki_istek')],
    revoked: ['bad', tr('verify.spravka_otozvana_dekanatom')],
    not_found: ['bad', tr('verify.spravka_ne_naydena')],
  };

  function render(data) {
    const [tone, title] = TITLES[data.state] || TITLES.not_found;
    const card = el('section', `card verify-result verify-result--${tone}`);
    card.append(el('p', 'verify-result__title', title));
    if (data.state === 'not_found') {
      card.append(el('p', null, tr('verify.proverte_pravilno_li_vveden')));
    }
    if (data.certificate) {
      const c = data.certificate;
      const dl = el('dl', 'fields');
      const add = (k, v) => v !== null && v !== undefined && dl.append(el('dt', null, k), el('dd', null, String(v)));
      add(tr('verify.dokument'), tr('verify.spravka_ob_obuchenii'));
      add(tr('verify.nomer'), c.number);
      add(tr('verify.fio'), c.fullName);
      add(tr('verify.fakultet'), c.faculty);
      add(tr('verify.napravlenie'), c.program);
      add(tr('verify.kurs'), c.course);
      add(tr('verify.forma_obucheniya'), c.studyForm);
      add(tr('verify.vydana'), fullDate(c.issuedAt));
      add(tr('verify.deystvitelna_do'), fullDate(c.validUntil));
      add(tr('verify.podpisal'), c.signedBy);
      card.append(dl);
    }
    result.replaceChildren(card);
    document.getElementById('form-title').textContent = tr('verify.proverit_druguyu_spravku');
  }

  async function check(code) {
    loading.hidden = false;
    let data;
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(code)}`, { headers: { Accept: 'application/json' } });
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('verify.ne_udalos_proverit_spravku'));
    } catch (err) {
      loading.hidden = true;
      result.replaceChildren(el('p', 'alert', err instanceof TypeError ? tr('verify.net_podklyucheniya_proverka_rabotaet') : err.message));
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
